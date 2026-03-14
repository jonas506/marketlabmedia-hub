import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string | null = null;
    let niche = "Instagram Reels trends";
    try { const body = await req.json(); userId = body.user_id || null; niche = body.niche || niche; } catch { }

    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `best performing Instagram Reels ideas ${niche} this week 2025 2026`, limit: 8, scrapeOptions: { formats: ["markdown"] } }),
    });

    let trendData = "";
    if (searchRes.ok) {
      const searchJson = await searchRes.json();
      trendData = (searchJson.data || []).map((r: any) => `Source: ${r.url || ""}\n${(r.markdown || "").slice(0, 1500)}`).join("\n\n---\n\n");
    } else { trendData = "Keine externen Daten verfügbar."; }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du bist ein Instagram Growth Experte. Antworte IMMER mit validem JSON-Array." },
          { role: "user", content: `Basierend auf Trend-Daten, generiere 3 Reel-Ideen.\n\nTREND-DATEN:\n${trendData.slice(0, 8000)}\n\nNISCHE: ${niche}` },
        ],
        tools: [{ type: "function", function: { name: "suggest_reel_ideas", description: "Return 3 reel ideas", parameters: { type: "object", properties: { ideas: { type: "array", items: { type: "object", properties: { title: { type: "string" }, hook: { type: "string" }, concept: { type: "string" }, format_tip: { type: "string" }, virality_score: { type: "number" } }, required: ["title", "hook", "concept", "format_tip", "virality_score"] } }, sources_summary: { type: "string" } }, required: ["ideas", "sources_summary"] } } }],
        tool_choice: { type: "function", function: { name: "suggest_reel_ideas" } },
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let ideas: any[] = [];
    if (toolCall?.function?.arguments) { const parsed = JSON.parse(toolCall.function.arguments); ideas = parsed.ideas || []; }
    if (ideas.length === 0) throw new Error("No ideas generated");

    if (userId) {
      await supabase.from("cb_reel_ideas").insert({ user_id: userId, ideas, sources: [], niche });
    }

    return new Response(JSON.stringify({ success: true, ideas }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
