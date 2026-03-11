import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const domain = url.searchParams.get("domain");

    if (!slug && !domain) {
      return new Response("Not found", { status: 404 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    let query = sb.from("landing_pages").select("html_content, is_published, title").eq("is_published", true);
    if (slug) query = query.eq("slug", slug);
    else if (domain) query = query.eq("custom_domain", domain);

    const { data, error } = await query.single();
    if (error || !data) {
      return new Response("Landing Page nicht gefunden", { status: 404 });
    }

    return new Response(data.html_content || "<html><body><h1>Leer</h1></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("serve-landing-page error:", e);
    return new Response("Server error", { status: 500 });
  }
});
