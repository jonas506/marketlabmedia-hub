import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { PDFDocument, PDFName, rgb, setCharacterSpacing } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { z } from 'npm:zod@3.25.76';
import { cleanName } from '../_shared/playbook-utils.ts';

const BUCKET = 'playbook';
const TEMPLATE = 'vorlage/Leads-Playbook-2027_Vorlage.pdf';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fontSources = {
  'PlusJakartaSans-Regular.ttf': 'https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-Regular.ttf',
  'PlusJakartaSans-Medium.ttf': 'https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-Medium.ttf',
  'PlusJakartaSans-SemiBold.ttf': 'https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-SemiBold.ttf',
};
const fontCache = new Map<string, Uint8Array>();

async function loadFont(db: any, filename: keyof typeof fontSources) {
  if (fontCache.has(filename)) return fontCache.get(filename)!;
  const path = `fonts/${filename}`;
  const { data: existing } = await db.storage.from(BUCKET).download(path);
  if (existing) {
    const bytes = new Uint8Array(await existing.arrayBuffer());
    fontCache.set(filename, bytes);
    return bytes;
  }
  const response = await fetch(fontSources[filename]);
  if (!response.ok) throw new Error(`Schrift konnte nicht geladen werden: ${filename}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'font/ttf', upsert: true });
  if (error) console.error('playbook font cache upload failed', error.message);
  fontCache.set(filename, bytes);
  return bytes;
}

async function generate(db: any, token: string) {
  const { data: submission, error: submissionError } = await db.from('playbook_submissions').select('*').eq('token', token).maybeSingle();
  if (submissionError || !submission) throw new Error('Eintrag nicht gefunden');
  if (submission.pdf_path && submission.pdf_status === 'ready') return { path: submission.pdf_path, submission };
  await db.from('playbook_submissions').update({ pdf_status: 'processing', pdf_error: null, updated_at: new Date().toISOString() }).eq('id', submission.id);
  try {
    const { data: template, error: templateError } = await db.storage.from(BUCKET).download(TEMPLATE);
    if (templateError || !template) throw new Error('Die PDF-Vorlage ist noch nicht hochgeladen.');
    const [regularBytes, mediumBytes, semiBoldBytes] = await Promise.all([
      loadFont(db, 'PlusJakartaSans-Regular.ttf'), loadFont(db, 'PlusJakartaSans-Medium.ttf'), loadFont(db, 'PlusJakartaSans-SemiBold.ttf'),
    ]);
    const pdf = await PDFDocument.load(await template.arrayBuffer(), { ignoreEncryption: true });
    if (pdf.getPageCount() < 2) throw new Error('Die PDF-Vorlage braucht mindestens zwei Seiten.');
    pdf.registerFontkit(fontkit);
    const [regular, medium, semiBold] = await Promise.all([
      pdf.embedFont(regularBytes, { subset: true }), pdf.embedFont(mediumBytes, { subset: true }), pdf.embedFont(semiBoldBytes, { subset: true }),
    ]);
    const firstName = cleanName(submission.first_name);
    const lastName = cleanName(submission.last_name);
    if (!firstName || !lastName) throw new Error('Name für das PDF ungültig');
    const fullName = `${firstName} ${lastName}`;
    const cover = pdf.getPage(0);
    const prefix = 'Persönliche Ausgabe für ';
    const suffix = ' · 2027';
    let coverSize = 8.5;
    while (coverSize > 7 && regular.widthOfTextAtSize(prefix, coverSize) + semiBold.widthOfTextAtSize(fullName, coverSize) + regular.widthOfTextAtSize(suffix, coverSize) > 400) coverSize = Math.max(7, coverSize - 0.25);
    let x = 42.52;
    cover.drawText(prefix, { x, y: 31.92, size: coverSize, font: regular, color: rgb(123 / 255, 131 / 255, 149 / 255) });
    x += regular.widthOfTextAtSize(prefix, coverSize);
    cover.drawText(fullName, { x, y: 31.92, size: coverSize, font: semiBold, color: rgb(236 / 255, 238 / 255, 244 / 255) });
    x += semiBold.widthOfTextAtSize(fullName, coverSize);
    cover.drawText(suffix, { x, y: 31.92, size: coverSize, font: regular, color: rgb(123 / 255, 131 / 255, 149 / 255) });

    const intro = pdf.getPage(1);
    const greeting = `Schön, dass du da bist, ${firstName}.`;
    let size = 28;
    let spacing = -0.03 * size;
    while (size > 20 && medium.widthOfTextAtSize(greeting, size) + spacing * greeting.length > 487) { size -= 1; spacing = -0.03 * size; }
    intro.pushOperators(setCharacterSpacing(spacing));
    intro.drawText(greeting, { x: 42.52, y: 706.92, size, font: medium, color: rgb(236 / 255, 238 / 255, 244 / 255) });
    intro.pushOperators(setCharacterSpacing(0));
    pdf.setTitle('Das Leads-Playbook 2027');
    pdf.setAuthor('Marketlab Media');
    // The uploaded template carries stale XMP metadata; Info metadata is the single source of truth.
    pdf.catalog.delete(PDFName.of('Metadata'));
    const bytes = await pdf.save();
    const path = `leads/${token}.pdf`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;
    await db.from('playbook_submissions').update({ pdf_path: path, pdf_status: 'ready', pdf_error: null, updated_at: new Date().toISOString() }).eq('id', submission.id);
    return { path, submission: { ...submission, first_name: firstName, last_name: lastName } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from('playbook_submissions').update({ pdf_status: 'failed', pdf_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', submission.id);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const body = z.object({ token: z.string().uuid() }).parse(await req.json());
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const result = await generate(db, body.token);
    return json({ success: true, path: result.path });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'Ungültiger Token' }, 400);
    console.error('playbook-pdf failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof Error ? error.message : 'PDF konnte nicht erzeugt werden.' }, 500);
  }
});
