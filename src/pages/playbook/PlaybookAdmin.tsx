import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import cover from '@/assets/playbook-cover-mockup.png.asset.json';
import './playbook.css';

type Settings = { aktion_bis: string | null; cover_bild_url: string | null };
type Row = { id: string; created_at: string; first_name: string; last_name: string; berater_typ: string | null; umsatz_stufe: string | null; pdf_status: string; pdf_path: string | null; lead_id: string | null };
type StoredFile = { name: string; size: number; updated_at: string };

export default function PlaybookAdmin() {
  const [settings, setSettings] = useState<Settings>({ aktion_bis: null, cover_bild_url: cover.url });
  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [status, setStatus] = useState('');
  const templateInput = useRef<HTMLInputElement>(null);
  const fallbackInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [settingsResult, submissionsResult, filesResult] = await Promise.all([
      supabase.from('playbook_settings').select('aktion_bis,cover_bild_url').eq('id', true).maybeSingle(),
      supabase.from('playbook_submissions').select('id,created_at,first_name,last_name,berater_typ,umsatz_stufe,pdf_status,pdf_path,lead_id').order('created_at', { ascending: false }).limit(20),
      supabase.functions.invoke('playbook?action=files', { body: {} }),
    ]);
    if (settingsResult.data) setSettings(settingsResult.data);
    if (submissionsResult.data) setRows(submissionsResult.data);
    if (filesResult.data?.files) setFiles(filesResult.data.files);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault(); setStatus('Einstellungen werden gespeichert …');
    if (settings.cover_bild_url && !settings.cover_bild_url.startsWith('https://')) { setStatus('Das Cover braucht eine https-URL.'); return; }
    const { error } = await supabase.from('playbook_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', true);
    setStatus(error ? 'Einstellungen konnten nicht gespeichert werden.' : 'Einstellungen gespeichert.');
  }
  async function upload(kind: 'vorlage' | 'ohne_name', file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setStatus('Bitte eine PDF-Datei auswählen.'); return; }
    setStatus('PDF wird hochgeladen …');
    const { data, error } = await supabase.functions.invoke('playbook?action=upload_url', { body: { datei: kind } });
    if (error || !data?.signedUrl) { setStatus('Upload-Link konnte nicht erstellt werden.'); return; }
    const response = await fetch(data.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: file });
    setStatus(response.ok ? 'PDF hochgeladen.' : 'PDF-Upload fehlgeschlagen.');
    if (response.ok) load();
  }

  return <div className="pb pb-admin"><div className="pb-admin-inner">
    <h1>Leads-Playbook 2027</h1>
    <p>Einstellungen, Vorlagen und die letzten 20 Einträge.</p>
    <form className="pb-admin-section" onSubmit={saveSettings}>
      <h2>Einstellungen</h2>
      <div className="pb-admin-grid">
        <label>Aktion gültig bis<input type="date" value={settings.aktion_bis || ''} onChange={(event) => setSettings({ ...settings, aktion_bis: event.target.value || null })} /></label>
        <label>Cover-Bild-URL (https)<input type="url" value={settings.cover_bild_url || ''} onChange={(event) => setSettings({ ...settings, cover_bild_url: event.target.value })} /></label>
        <button type="submit">Speichern</button>
      </div>
    </form>
    <section className="pb-admin-section">
      <h2>PDF-Vorlagen</h2>
      <p>Vorlage: <code>vorlage/Leads-Playbook-2027_Vorlage.pdf</code><br />Fallback: <code>vorlage/Leads-Playbook-2027_ohne-Name.pdf</code></p>
      <input ref={templateInput} hidden type="file" accept="application/pdf" onChange={(event) => upload('vorlage', event.target.files?.[0])} />
      <input ref={fallbackInput} hidden type="file" accept="application/pdf" onChange={(event) => upload('ohne_name', event.target.files?.[0])} />
      <button type="button" onClick={() => templateInput.current?.click()}>Vorlage hochladen</button>{' '}
      <button type="button" className="secondary" onClick={() => fallbackInput.current?.click()}>Fallback hochladen</button>
      <table><thead><tr><th>Datei</th><th>Größe</th><th>Aktualisiert</th></tr></thead><tbody>{files.map((file) => <tr key={file.name}><td>{file.name}</td><td>{(file.size / 1024 / 1024).toFixed(2)} MB</td><td>{file.updated_at ? new Date(file.updated_at).toLocaleString('de-DE') : '–'}</td></tr>)}{!files.length && <tr><td colSpan={3}>Noch keine Vorlage hochgeladen.</td></tr>}</tbody></table>
    </section>
    <p className="pb-admin-status" role="status">{status}</p>
    <section className="pb-admin-section">
      <h2>Letzte 20 Einträge</h2>
      <div className="pb-table-scroll"><table><thead><tr><th>Name</th><th>Datum</th><th>Typ</th><th>Umsatz</th><th>PDF</th><th>CRM</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.first_name} {row.last_name}</td><td>{new Date(row.created_at).toLocaleString('de-DE')}</td><td>{row.berater_typ || '–'}</td><td>{row.umsatz_stufe || '–'}</td><td>{row.pdf_status}</td><td>{row.lead_id ? <Link to={`/crm/lead/${row.lead_id}`}>Lead öffnen</Link> : '–'}</td></tr>)}{!rows.length && <tr><td colSpan={6}>Noch keine Einträge.</td></tr>}</tbody></table></div>
    </section>
    <section className="pb-admin-section">
      <h2>Mail-Vorschau – nur Vorschau, kein Versand</h2>
      <div className="pb-mail-preview"><span>MARKETLAB MEDIA</span><h3>Dein Leads-Playbook 2027</h3><p>Hallo Maximilian,</p><p>hier ist dein persönliches Leads-Playbook 2027. Darin findest du die 7 Phasen des Marktführer-Funnels, mit denen du über Social Media an Leads kommst, die nur dir gehören.</p><a className="pb-mail-cta" href="#vorschau" onClick={(event) => event.preventDefault()}>Playbook herunterladen</a><p>Wir rufen dich in den nächsten Tagen kurz an und schauen mit dir, welche Phase dir noch fehlt.</p><p>Viele Grüße<br />Jonas Fesser<br />Marketlab Media</p><small>Marketlab Media · Impressum · Datenschutz</small></div>
    </section>
  </div></div>;
}
