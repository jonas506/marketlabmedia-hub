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

      // Fetch comments for all review pieces
      const pieceIds = (pieces || []).map((p: any) => p.id);
      let comments: any[] = [];
      if (pieceIds.length > 0) {
        const { data: commentsData } = await supabase
          .from("content_piece_comments")
          .select("id, content_piece_id, timestamp_seconds, comment_text, created_at")
          .in("content_piece_id", pieceIds)
          .order("created_at", { ascending: true });
        comments = commentsData || [];
      }

      return new Response(JSON.stringify({ client, pieces: pieces || [], comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { token, piece_id, action, comment, timestamp_seconds, comments: timestampComments } = body;

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

      // Handle adding a single timestamp comment
      if (action === "add_comment") {
        const { data: piece } = await supabase
          .from("content_pieces")
          .select("id, client_id, phase")
          .eq("id", piece_id)
          .single();

        if (!piece || piece.client_id !== client.id || piece.phase !== "review") {
          return new Response(JSON.stringify({ error: "Invalid piece" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: newComment, error: insertError } = await supabase
          .from("content_piece_comments")
          .insert({
            content_piece_id: piece_id,
            client_id: client.id,
            timestamp_seconds: timestamp_seconds ?? null,
            comment_text: comment,
          })
          .select()
          .single();

        if (insertError) {
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, comment: newComment }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle deleting a comment
      if (action === "delete_comment") {
        await supabase
          .from("content_piece_comments")
          .delete()
          .eq("id", body.comment_id)
          .eq("client_id", client.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle approve / reject
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
        // Clear comments on approve
        await supabase
          .from("content_piece_comments")
          .delete()
          .eq("content_piece_id", piece_id);
      } else if (action === "reject") {
        const backPhase = piece.type === "carousel" ? "script" : "editing";
        // Build combined comment from timestamp comments
        let combinedComment = comment || "";
        if (timestampComments && timestampComments.length > 0) {
          const parts = timestampComments.map((c: any) => {
            if (c.timestamp_seconds != null) {
              const mins = Math.floor(c.timestamp_seconds / 60);
              const secs = Math.floor(c.timestamp_seconds % 60);
              return `[${mins}:${String(secs).padStart(2, "0")}] ${c.comment_text}`;
            }
            return c.comment_text;
          });
          combinedComment = parts.join("\n");
        }
        await supabase
          .from("content_pieces")
          .update({ phase: backPhase, client_comment: combinedComment || "Änderung gewünscht" })
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
