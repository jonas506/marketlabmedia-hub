const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function scrape(url: string, key: string) {
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: false }),
    });
    if (!r.ok) { console.error("firecrawl", r.status, await r.text()); return null; }
    const d = await r.json();
    return { markdown: (d?.data?.markdown || "") as string, links: (d?.data?.links || []) as string[], metadata: d?.data?.metadata || {} };
  } catch (e) { console.error(e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let { url } = await req.json();
    if (!url) return json({ error: "URL fehlt" }, 400);
    url = String(url).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const FC = Deno.env.get("FIRECRAWL_API_KEY");
    const AI = Deno.env.get("LOVABLE_API_KEY");
    if (!FC || !AI) return json({ error: "Nicht konfiguriert" }, 500);

    const main = await scrape(url, FC);
    if (!main) return json({ error: "Website konnte nicht geladen werden" }, 502);

    // Impressum / Kontakt pages usually hold phone, email, owner
    const host = new URL(url).host;
    const extra = main.links
      .filter((l) => { try { return new URL(l).host === host; } catch { return false; } })
      .filter((l) => /impressum|imprint|kontakt|contact|about|ueber-uns|uber-uns/i.test(l))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 2);
    const subs = await Promise.all(extra.map((l) => scrape(l, FC)));

    const socialLinks = main.links.filter((l) => /instagram\.com|linkedin\.com/i.test(l)).slice(0, 10);
    const content = [
      `HAUPTSEITE ${url}\n${main.markdown.substring(0, 9000)}`,
      ...subs.map((s, i) => (s ? `SEITE ${extra[i]}\n${s.markdown.substring(0, 5000)}` : "")),
      `SOCIAL LINKS:\n${socialLinks.join("\n")}`,
    ].join("\n\n---\n\n");

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Du extrahierst Lead-Daten aus Website-Inhalten für eine Social-Media-Agentur. Antworte nur als JSON:
{"company":"Firmenname oder null","contact_name":"Inhaber/Geschäftsführer/Ansprechpartner oder null","email":"E-Mail oder null","phone":"Telefon im Format +49 ... oder null","instagram":"@handle oder null","linkedin":"LinkedIn-URL oder null","description":"1-2 Sätze was die Firma macht","summary":"3-4 Sätze: Angebot, Zielgruppe, Anknüpfungspunkte für Social-Media-Marketing"}
Erfinde nichts. Bevorzuge Daten aus dem Impressum.`,
          },
          { role: "user", content },
        ],
      }),
    });
    if (ai.status === 429) return json({ error: "Rate limit, bitte gleich nochmal versuchen" }, 429);
    if (ai.status === 402) return json({ error: "AI-Credits aufgebraucht" }, 402);
    if (!ai.ok) { console.error(await ai.text()); return json({ error: "Analyse fehlgeschlagen" }, 500); }
    const d = await ai.json();
    let parsed: Record<string, string | null> = {};
    try { parsed = JSON.parse(d.choices?.[0]?.message?.content || "{}"); } catch { /* ignore */ }

    for (const k of Object.keys(parsed)) {
      const v = parsed[k];
      if (typeof v === "string" && ["null", "", "n/a", "unbekannt"].includes(v.trim().toLowerCase())) parsed[k] = null;
    }
    return json({ ...parsed, website: url, profile_image_url: main.metadata?.ogImage || null });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Fehler" }, 500);
  }
});
