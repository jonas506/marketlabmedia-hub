import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_drive';

interface ScriptLink { url: string; label?: string }
interface ScriptPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  script_text?: string | null;
  tag?: string | null;
  funnel_stage?: string | null;
  script_links?: ScriptLink[] | null;
  script_images?: string[] | null;
}

const TYPE_LABEL: Record<string, string> = {
  reel: 'Reel',
  carousel: 'Karussell',
  ad: 'Ad',
  youtube_longform: 'YouTube',
};

const FUNNEL_BADGE: Record<string, { label: string; color: string }> = {
  tofu: { label: 'TOFU · Reichweite', color: '#3b82f6' },
  mofu: { label: 'MOFU · Vertrauen', color: '#8b5cf6' },
  bofu: { label: 'BOFU · Conversion', color: '#10b981' },
};

const HOOK_SEPARATOR = '\n---HOOKS---\n';
const HOOK_LINE_PREFIX = 'HOOK: ';

function parseScript(scriptText?: string | null): { hooks: string[]; body: string } {
  if (!scriptText) return { hooks: [], body: '' };
  const idx = scriptText.indexOf(HOOK_SEPARATOR);
  if (idx === -1) return { hooks: [], body: scriptText };
  const hooks = scriptText.slice(0, idx)
    .split('\n')
    .filter(l => l.startsWith(HOOK_LINE_PREFIX))
    .map(l => l.slice(HOOK_LINE_PREFIX.length));
  return { hooks, body: scriptText.slice(idx + HOOK_SEPARATOR.length) };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(pieces: ScriptPiece[], clientName: string): string {
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const blocks = pieces.map((p, i) => {
    const { hooks, body } = parseScript(p.script_text);
    const typeLabel = TYPE_LABEL[p.type] ?? p.type;
    const num = String(i + 1).padStart(2, '0');
    const funnel = p.funnel_stage ? FUNNEL_BADGE[p.funnel_stage] : null;

    let html = `<h2 style="font-family:Arial,sans-serif;font-size:18pt;color:#111;margin-top:32pt;margin-bottom:4pt;">${num} · ${esc(p.title || 'Ohne Titel')}</h2>`;
    html += `<p style="font-family:Arial,sans-serif;font-size:10pt;color:#666;margin-top:0;margin-bottom:14pt;">`;
    html += `<b style="color:#111;">${esc(typeLabel)}</b>`;
    if (funnel) html += ` &nbsp;·&nbsp; <span style="color:${funnel.color};"><b>${esc(funnel.label)}</b></span>`;
    if (p.tag) html += ` &nbsp;·&nbsp; ${esc(p.tag)}`;
    html += `</p>`;

    if (hooks.length > 0) {
      html += `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#888;letter-spacing:1.5px;margin-bottom:4pt;"><b>HOOKS</b></p>`;
      html += `<ol style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;color:#222;margin-top:0;">`;
      hooks.forEach(h => { html += `<li>${esc(h)}</li>`; });
      html += `</ol>`;
    }

    if (body.trim()) {
      html += `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#888;letter-spacing:1.5px;margin-top:14pt;margin-bottom:4pt;"><b>SKRIPT</b></p>`;
      const paragraphs = body.split(/\n\n+/).map(par =>
        `<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.7;color:#222;margin:0 0 10pt 0;">${esc(par).replace(/\n/g, '<br/>')}</p>`
      ).join('');
      html += paragraphs;
    } else if (hooks.length === 0) {
      html += `<p style="font-family:Arial,sans-serif;font-size:11pt;color:#999;font-style:italic;">Kein Skript hinterlegt</p>`;
    }

    const links = (p.script_links || []) as ScriptLink[];
    if (links.length > 0) {
      html += `<p style="font-family:Arial,sans-serif;font-size:9pt;color:#888;letter-spacing:1.5px;margin-top:14pt;margin-bottom:4pt;"><b>LINKS</b></p>`;
      html += `<ul style="font-family:Arial,sans-serif;font-size:11pt;color:#0083F7;margin-top:0;">`;
      links.forEach(l => {
        const label = l.label || l.url;
        html += `<li><a href="${esc(l.url)}" style="color:#0083F7;">${esc(label)}</a></li>`;
      });
      html += `</ul>`;
    }

    html += `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24pt 0;" />`;
    return html;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Skripte ${esc(clientName)}</title></head><body>
    <h1 style="font-family:Arial,sans-serif;font-size:26pt;color:#111;margin-bottom:2pt;">Content Skripte</h1>
    <p style="font-family:Arial,sans-serif;font-size:12pt;color:#666;margin-top:0;">${esc(clientName)} · ${today}</p>
    <p style="font-family:Arial,sans-serif;font-size:10pt;color:#999;margin-bottom:24pt;">${pieces.length} ${pieces.length === 1 ? 'Skript' : 'Skripte'} · Vorbereitet von Marketlab Media</p>
    <hr style="border:none;border-top:2px solid #111;margin:8pt 0 24pt 0;" />
    ${blocks}
  </body></html>`;
}

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const driveKey = Deno.env.get('GOOGLE_DRIVE_API_KEY');
  if (!lovableKey || !driveKey) throw new Error('Google Drive connection is not configured');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${lovableKey}`);
  headers.set('X-Connection-Api-Key', driveKey);
  return fetch(`${GATEWAY}${path}`, { ...init, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pieces, clientName, permission } = await req.json() as {
      pieces: ScriptPiece[]; clientName?: string; permission?: 'writer' | 'reader' | 'commenter';
    };
    if (!Array.isArray(pieces) || pieces.length === 0) {
      return new Response(JSON.stringify({ error: 'No pieces provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml(pieces, clientName || 'Kunde');
    const title = `Content Skripte – ${clientName || 'Kunde'} – ${new Date().toLocaleDateString('de-DE')}`;

    // Multipart upload: metadata + HTML body, target mimeType Google Doc → auto-convert
    const boundary = `----lovable_${crypto.randomUUID()}`;
    const metadata = { name: title, mimeType: 'application/vnd.google-apps.document' };
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
      `${html}\r\n` +
      `--${boundary}--`;

    const uploadRes = await gatewayFetch('/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });

    if (!uploadRes.ok) {
      const details = await uploadRes.text();
      console.error(`Drive upload failed [${uploadRes.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: 'Google Drive upload failed', status: uploadRes.status, details }),
        { status: uploadRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const file = await uploadRes.json();

    // Share: anyone with the link → writer (or provided)
    const permRole = permission || 'writer';
    const permRes = await gatewayFetch(`/drive/v3/files/${file.id}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: permRole, type: 'anyone' }),
    });
    if (!permRes.ok) {
      const details = await permRes.text();
      console.error(`Drive permission failed [${permRes.status}]: ${details}`);
      // Still return the doc; sharing may just need manual adjustment
    }

    return new Response(JSON.stringify({
      id: file.id,
      url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      name: file.name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('export-scripts-gdoc error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
