import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
  const privateKeyPem = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")!.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${b64url(header)}.${b64url(payload)}`;
  const keyData = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = `${unsignedToken}.${b64Sig}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Google auth failed");
  return tokenData.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const moduleId = url.searchParams.get("module_id");
    const authHeader = req.headers.get("Authorization");
    if (!moduleId || !authHeader) {
      return new Response("Missing params", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: student }, { data: roleRow }, { data: mod }] = await Promise.all([
      admin.from("course_students").select("user_id").eq("user_id", user.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      admin.from("course_modules").select("drive_file_id, is_published").eq("id", moduleId).maybeSingle(),
    ]);

    const isAdmin = roleRow?.role === "admin" || roleRow?.role === "head_of_content";
    if (!student && !isAdmin) {
      return new Response("Not enrolled", { status: 403, headers: corsHeaders });
    }
    if (!mod || (!mod.is_published && !isAdmin) || !mod.drive_file_id) {
      return new Response("Module unavailable", { status: 404, headers: corsHeaders });
    }

    const accessToken = await getGoogleAccessToken();
    const rangeHeader = req.headers.get("range");
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${mod.drive_file_id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}`, ...(rangeHeader ? { Range: rangeHeader } : {}) } }
    );

    const headers = new Headers(corsHeaders);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const v = driveRes.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, max-age=3600");

    return new Response(driveRes.body, { status: driveRes.status, headers });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
  }
});
