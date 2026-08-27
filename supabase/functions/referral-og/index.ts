import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) return new Response("missing slug", { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data } = await supabase.rpc("get_referral_page", { _slug: slug });
    const page = data as { photo_url?: string | null; logo_url?: string | null } | null;
    if (!page) return new Response("not found", { status: 404, headers: corsHeaders });

    const path = page.photo_url || null;

    if (path) {
      if (path.startsWith("http")) {
        return Response.redirect(path, 302);
      }
      const { data: file, error } = await supabase.storage.from("referral-assets").download(path);
      if (!error && file) {
        return new Response(file.stream(), {
          headers: {
            ...corsHeaders,
            "Content-Type": file.type || "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    if (page.logo_url) {
      return Response.redirect(page.logo_url, 302);
    }

    return new Response("no image", { status: 404, headers: corsHeaders });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
});
