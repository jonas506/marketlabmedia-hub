import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (!tokenData.access_token) {
    throw new Error(`Google auth failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    const folderId = url.searchParams.get("folder_id");

    let targetFolderId = folderId;

    if (!targetFolderId && clientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("drive_folder_id")
        .eq("id", clientId)
        .single();

      targetFolderId = client?.drive_folder_id;
    }

    if (!targetFolderId) {
      return new Response(
        JSON.stringify({ error: "Kein Drive-Ordner für diesen Kunden vorhanden", files: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleToken = await getGoogleAccessToken();

    // List all files recursively (folders + files)
    const q = `'${targetFolderId}' in parents and trashed=false`;
    const fields = "files(id,name,mimeType,webViewLink,thumbnailLink,size,modifiedTime)";
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    console.log("Drive API request:", driveUrl);
    const res = await fetch(driveUrl, { 
      headers: { Authorization: `Bearer ${googleToken}` } 
    });

    const data = await res.json();
    console.log("Drive API response status:", res.status, "files count:", data.files?.length ?? 0, "error:", JSON.stringify(data.error ?? null));

    // For subfolders, also list their contents
    const files = [];
    const subfolders = [];

    for (const f of data.files || []) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        subfolders.push(f);
      } else {
        files.push({ ...f, folder: null });
      }
    }

    // List files in each subfolder
    for (const folder of subfolders) {
      const subQ = `'${folder.id}' in parents and trashed=false`;
      const subRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQ)}&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc&pageSize=100`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      const subData = await subRes.json();
      for (const sf of subData.files || []) {
        if (sf.mimeType !== "application/vnd.google-apps.folder") {
          files.push({ ...sf, folder: folder.name });
        }
      }
    }

    const serviceEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? null;

    return new Response(
      JSON.stringify({ 
        files, 
        subfolders: subfolders.map((f) => ({ id: f.id, name: f.name })),
        service_account_email: serviceEmail,
        drive_error: data.error ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Drive list error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Fehler beim Laden der Dateien" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
