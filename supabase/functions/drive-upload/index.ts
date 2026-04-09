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
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedToken = `${b64url(header)}.${b64url(payload)}`;

  const keyData = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

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

async function findFolder(
  name: string,
  parentId: string,
  token: string
): Promise<string | null> {
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

async function createFolder(
  name: string,
  parentId: string,
  token: string
): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Failed to create folder: ${JSON.stringify(data)}`);
  return data.id;
}

async function uploadFile(
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
  parentFolderId: string,
  token: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = JSON.stringify({
    name: fileName,
    parents: [parentFolderId],
  });
  const boundary = "boundary_" + Date.now();
  const encoder = new TextEncoder();

  const part1 = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
  );
  const part2 = encoder.encode(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const ending = encoder.encode(`\r\n--${boundary}--`);

  const fullBody = new Uint8Array(
    part1.length + part2.length + fileBytes.length + ending.length
  );
  fullBody.set(part1, 0);
  fullBody.set(part2, part1.length);
  fullBody.set(fileBytes, part1.length + part2.length);
  fullBody.set(ending, part1.length + part2.length + fileBytes.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    }
  );

  const data = await res.json();
  if (!data.id) throw new Error(`Upload failed: ${JSON.stringify(data)}`);

  // Make publicly viewable
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${data.id}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  return { id: data.id, webViewLink: data.webViewLink };
}

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "application/pdf",
  "image/vnd.adobe.photoshop",
  "application/postscript",
]);

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("client_id") as string | null;
    const contentPieceId = formData.get("content_piece_id") as string | null;
    const clientName = formData.get("client_name") as string | null;
    const targetMonth = formData.get("target_month") as string | null;
    const existingFolderId = formData.get("drive_folder_id") as string | null;

    if (!file || !clientId || !clientName || !targetMonth) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file, client_id, client_name, target_month" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return new Response(
        JSON.stringify({ error: `Dateityp nicht erlaubt: ${file.type}. Erlaubt: MP4, MOV, JPG, PNG, PDF, PSD, AI` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "Datei zu groß (max. 100 MB). Bitte direkt in Google Drive hochladen." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) for client ${clientName}`);

    const googleToken = await getGoogleAccessToken();
    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID")!;

    // 1. Find or create client folder
    let clientFolderId = existingFolderId;
    if (!clientFolderId) {
      clientFolderId = await findFolder(clientName, rootFolderId, googleToken);
      if (!clientFolderId) {
        clientFolderId = await createFolder(clientName, rootFolderId, googleToken);
      }
      await supabase
        .from("clients")
        .update({ drive_folder_id: clientFolderId })
        .eq("id", clientId);
    }

    // 2. Find or create month folder
    let monthFolderId = await findFolder(targetMonth, clientFolderId, googleToken);
    if (!monthFolderId) {
      monthFolderId = await createFolder(targetMonth, clientFolderId, googleToken);
    }

    // 3. Upload file
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadFile(
      fileBytes,
      file.name,
      file.type,
      monthFolderId,
      googleToken
    );

    console.log(`Upload complete: ${result.id} → ${result.webViewLink}`);

    // 4. Update content piece if provided
    if (contentPieceId) {
      await supabase
        .from("content_pieces")
        .update({
          preview_link: result.webViewLink,
          drive_file_id: result.id,
          drive_file_name: file.name,
          drive_uploaded_at: new Date().toISOString(),
        })
        .eq("id", contentPieceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_id: result.id,
        web_view_link: result.webViewLink,
        file_name: file.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Drive upload error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Upload fehlgeschlagen" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
