import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("approval_token", token)
        .single();

      if (clientError || !client) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pieces } = await supabase
        .from("content_pieces")
        .select("id, title, type, phase, preview_link, client_comment")
        .eq("client_id", client.id)
        .eq("phase", "review")
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ client, pieces: pieces || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { token, piece_id, action, comment } = await req.json();

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("approval_token", token)
        .single();

      if (!client) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: piece } = await supabase
        .from("content_pieces")
        .select("id, client_id, phase, type")
        .eq("id", piece_id)
        .single();

      if (!piece || piece.client_id !== client.id || piece.phase !== "review") {
        return new Response(JSON.stringify({ error: "Invalid piece" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve") {
        await supabase
          .from("content_pieces")
          .update({ phase: "approved", client_comment: null })
          .eq("id", piece_id);
      } else if (action === "reject") {
        const backPhase = piece.type === "carousel" ? "script" : "editing";
        await supabase
          .from("content_pieces")
          .update({ phase: backPhase, client_comment: comment || "Änderung gewünscht" })
          .eq("id", piece_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
