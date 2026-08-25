import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, clientId, current } = await req.json();
    if (!messages?.length || !clientId) {
      return new Response(JSON.stringify({ error: "messages und clientId erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY fehlt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: client } = await sb
      .from("clients")
      .select("name, industry, sector, target_audience, usps, tonality, strategy_text")
      .eq("id", clientId)
      .maybeSingle();

    let ctx = "";
    if (client) {
      ctx = Object.entries(client)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    }

    const systemPrompt = `Du hilfst einer Social-Media-Agentur (Marketlab Media), den Ergebnis-Abschnitt einer Kunden-Empfehlungsseite zu schreiben.
Der Nutzer beschreibt im Chat locker, was für den Kunden gemacht wurde und welche Ergebnisse erzielt wurden. Du formulierst daraus einen überzeugenden, seriösen deutschen Fließtext (2-4 kurze Absätze, kein Marketing-Blabla, konkret, "Wir"-Perspektive) und bis zu 4 Kennzahlen.

Kunden-Kontext:
${ctx || "keine"}

Aktueller Stand auf der Seite:
Text: ${current?.results_text || "(leer)"}
Kennzahlen: ${JSON.stringify(current?.stats || [])}

Antworte AUSSCHLIESSLICH mit JSON in diesem Format:
{"reply":"kurze Antwort an den Nutzer auf Deutsch (1-2 Sätze, ggf. Rückfrage)","results_text":"der fertige Text","stats":[{"value":"+38.000","label":"neue Follower"}]}
Wenn dir Infos fehlen, frage in "reply" nach und gib trotzdem den bestmöglichen Entwurf zurück. Erfinde keine Zahlen, die der Nutzer nicht genannt hat.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const status = res.status;
      const msg =
        status === 429
          ? "Rate Limit erreicht. Bitte kurz warten."
          : status === 402
            ? "KI-Guthaben aufgebraucht."
            : "KI-Fehler";
      console.error("gateway error", status, await res.text());
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { reply: raw };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("referral-results-chat", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
