import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PlaybookShell from './PlaybookShell';
import { track } from './tracking';

export default function PlaybookDownloadPage() {
  const { token = '' } = useParams();
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    supabase.functions.invoke('playbook?action=download', { body: { token } }).then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError || data?.error || !data?.url) { setError(data?.error || 'Das PDF ist noch nicht verfügbar. Bitte versuche es gleich erneut.'); return; }
      setUrl(data.url); track('download');
      window.location.assign(data.url);
    });
    return () => { active = false; };
  }, [token]);
  return <PlaybookShell noindex><main className="pb-thanks"><p className="pb-thanks-kicker">Leads-Playbook 2027</p><h1>{error ? 'Download nicht bereit' : 'Dein Download startet.'}</h1><div className="pb-download-card">{error ? <p className="pb-thanks-intro">{error}</p> : <p className="pb-thanks-intro">Falls er nicht automatisch beginnt, nutze den Button.</p>}{url && <div className="pb-button-shell"><a className="pb-button" href={url} download>PDF herunterladen</a></div>}{error && <div className="pb-button-shell"><button className="pb-button" onClick={() => location.reload()}>Erneut versuchen</button></div>}</div></main></PlaybookShell>;
}
