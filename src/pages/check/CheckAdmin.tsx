import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_TRUST, trustSettingsSchema } from './trust-settings';

interface Gebiet { plz_prefix: string; status: string }

export default function CheckAdmin() {
  const [video, setVideo] = useState('');
  const [calendar, setCalendar] = useState('');
  const [rows, setRows] = useState<Gebiet[]>([]);
  const [prefix, setPrefix] = useState('');
  const [trustScore, setTrustScore] = useState(String(DEFAULT_TRUST.trustpilot_score));
  const [trustReviews, setTrustReviews] = useState(String(DEFAULT_TRUST.trustpilot_reviews));

  async function load() {
    const [s, g] = await Promise.all([
      supabase.from('vertriebs_check_settings').select('video_url,calendar_url,trustpilot_score,trustpilot_reviews').eq('id', true).maybeSingle(),
      supabase.from('gebiete').select('plz_prefix,status').order('plz_prefix'),
    ]);
    setVideo(s.data?.video_url ?? ''); setCalendar(s.data?.calendar_url ?? '');
    setTrustScore(String(s.data?.trustpilot_score ?? DEFAULT_TRUST.trustpilot_score));
    setTrustReviews(String(s.data?.trustpilot_reviews ?? DEFAULT_TRUST.trustpilot_reviews));
    setRows(g.data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function saveSettings() {
    const url = video.trim() || null;
    if (url && !/^https:\/\//.test(url)) { toast.error('Die Video-Adresse muss mit https:// beginnen.'); return; }
    const { error } = await supabase.from('vertriebs_check_settings').upsert({ id: true, video_url: url, calendar_url: calendar.trim() || 'https://calendar.app.google/i2jtG5DapbEjzWba6', updated_at: new Date().toISOString() });
    if (error) toast.error('Speichern fehlgeschlagen.'); else toast.success('Gespeichert');
  }
  async function addGebiet() {
    if (!/^\d{3}$/.test(prefix)) { toast.error('Bitte genau 3 Ziffern eingeben.'); return; }
    const { error } = await supabase.from('gebiete').upsert({ plz_prefix: prefix, status: 'vergeben', updated_at: new Date().toISOString() });
    if (error) toast.error('Speichern fehlgeschlagen.'); else { setPrefix(''); void load(); }
  }
  async function saveTrust() {
    const parsed = trustSettingsSchema.safeParse({ trustpilot_score: trustScore.trim() ? Number(trustScore.replace(',', '.')) : NaN, trustpilot_reviews: trustReviews.trim() ? Number(trustReviews) : NaN });
    if (!parsed.success) { toast.error('Bewertung: 0 bis 5 mit einer Nachkommastelle. Anzahl: ganze Zahl ab 0.'); return; }
    const { error } = await supabase.from('vertriebs_check_settings').upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() });
    if (error) toast.error('Speichern fehlgeschlagen.'); else toast.success('Trustpilot-Bewertung gespeichert');
  }
  async function setStatus(p: string, status: string) {
    const { error } = await supabase.from('gebiete').update({ status, updated_at: new Date().toISOString() }).eq('plz_prefix', p);
    if (error) toast.error('Speichern fehlgeschlagen.'); else void load();
  }
  async function remove(p: string) {
    const { error } = await supabase.from('gebiete').delete().eq('plz_prefix', p);
    if (error) toast.error('Löschen fehlgeschlagen.'); else void load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Vertriebs-Check</h1>
        <p className="text-sm text-muted-foreground">Video, Kalender und PLZ-Gebiete für die Auswertung. Vorschau: <a className="underline" href="/check/auswertung/vorschau?weg=a&a=0,1,2,0,1" target="_blank" rel="noreferrer">Weg A</a> · <a className="underline" href="/check/auswertung/vorschau?weg=b&a=2,0,1,1,0" target="_blank" rel="noreferrer">Weg B</a></p>
      </div>
      <Card className="space-y-4 p-5">
        <div><label className="mb-1 block text-sm font-medium">Video-Adresse (https://…)</label><Input value={video} onChange={e => setVideo(e.target.value)} placeholder="Leer = Vorschaubild" /></div>
        <div><label className="mb-1 block text-sm font-medium">Kalender-Adresse</label><Input value={calendar} onChange={e => setCalendar(e.target.value)} /></div>
        <Button onClick={saveSettings} className="min-h-11">Speichern</Button>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">PLZ-Gebiete</h2>
        <p className="text-sm text-muted-foreground">Nicht eingetragene Bereiche gelten als frei.</p>
        <div className="flex gap-2"><Input value={prefix} onChange={e => setPrefix(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="z. B. 123" inputMode="numeric" className="max-w-32" /><Button onClick={addGebiet} className="min-h-11">Als vergeben hinzufügen</Button></div>
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.plz_prefix} className="flex items-center gap-3 py-2">
              <span className="w-16 font-mono">{r.plz_prefix}</span>
              <select className="h-11 rounded-md border border-border bg-background px-2 text-sm" value={r.status} onChange={e => setStatus(r.plz_prefix, e.target.value)}>
                <option value="frei">frei</option><option value="vergeben">vergeben</option>
              </select>
              <Button variant="ghost" size="icon" className="ml-auto h-11 w-11" aria-label="Gebiet löschen" onClick={() => remove(r.plz_prefix)}><Trash2 size={16} /></Button>
            </li>
          ))}
          {rows.length === 0 && <li className="py-2 text-sm text-muted-foreground">Noch keine Gebiete eingetragen.</li>}
        </ul>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Trustpilot</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="vc-trust-score" className="mb-1 block text-sm font-medium">Bewertung (0–5)</label><Input id="vc-trust-score" type="number" min="0" max="5" step="0.1" value={trustScore} onChange={e => setTrustScore(e.target.value)} /></div>
          <div><label htmlFor="vc-trust-reviews" className="mb-1 block text-sm font-medium">Anzahl Bewertungen</label><Input id="vc-trust-reviews" type="number" min="0" step="1" value={trustReviews} onChange={e => setTrustReviews(e.target.value)} /></div>
        </div>
        <Button onClick={saveTrust} className="min-h-11">Trustpilot speichern</Button>
      </Card>
    </div>
  );
}
