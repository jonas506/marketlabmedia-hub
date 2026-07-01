import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, CheckCircle2, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoLight from "@/assets/logo-light.png";

interface Module {
  id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  sort_order: number;
  resources: Array<{ label: string; url: string }> | null;
}

const CoursePlayer = () => {
  const { moduleId } = useParams();
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [current, setCurrent] = useState<Module | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [startPos, setStartPos] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !moduleId) return;
    (async () => {
      const [{ data: allMods }, { data: prog }] = await Promise.all([
        supabase.from("course_modules").select("id,title,description,duration_seconds,sort_order,resources").eq("is_published", true).order("sort_order"),
        supabase.from("course_progress").select("last_position_seconds").eq("user_id", user.id).eq("module_id", moduleId).maybeSingle(),
      ]);
      setModules((allMods || []) as Module[]);
      const cur = (allMods || []).find((m: any) => m.id === moduleId) as Module | undefined;
      setCurrent(cur || null);
      setStartPos(Number(prog?.last_position_seconds) || 0);
    })();
  }, [user, moduleId]);

  useEffect(() => {
    if (!moduleId || !session?.access_token) return;
    const url = `https://winsekbpsgwtwfdehyms.supabase.co/functions/v1/course-video-proxy?module_id=${moduleId}&t=${encodeURIComponent(session.access_token)}`;
    // We need the auth header; fetch as blob URL is heavy. Instead, use a signed proxy pattern:
    // Since video element can't send Authorization header, we pass token via query and validate it in the function.
    setVideoUrl(url);
  }, [moduleId, session?.access_token]);

  const currentIdx = useMemo(() => modules.findIndex((m) => m.id === moduleId), [modules, moduleId]);
  const nextModule = currentIdx >= 0 ? modules[currentIdx + 1] : null;

  const saveProgress = async (pos: number, completed = false) => {
    if (!user || !moduleId) return;
    await supabase.from("course_progress").upsert({
      user_id: user.id,
      module_id: moduleId,
      last_position_seconds: pos,
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    }, { onConflict: "user_id,module_id" });
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (saveTimer.current) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      saveProgress(v.currentTime);
    }, 5000);
  };

  const handleEnded = () => saveProgress(videoRef.current?.currentTime ?? 0, true);

  const markComplete = async () => {
    await saveProgress(videoRef.current?.currentTime ?? 0, true);
    if (nextModule) navigate(`/kurs/${nextModule.id}`);
    else navigate("/kurs");
  };

  useEffect(() => {
    const v = videoRef.current;
    if (v && startPos > 0) {
      const onLoaded = () => { v.currentTime = startPos; v.removeEventListener("loadedmetadata", onLoaded); };
      v.addEventListener("loadedmetadata", onLoaded);
    }
  }, [startPos, videoUrl]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link to="/kurs" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Alle Module
          </Link>
          <img src={logoLight} alt="Marketlab Media" className="h-5 w-auto" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                controlsList="nodownload"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Lädt…</div>
            )}
          </div>

          <div className="mt-6">
            <h1 className="text-2xl font-display font-semibold tracking-tight">{current?.title || "…"}</h1>
            {current?.description && <p className="text-muted-foreground mt-2 font-body whitespace-pre-wrap">{current.description}</p>}

            {current?.resources && current.resources.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xs font-mono uppercase text-muted-foreground mb-2">Ressourcen</h2>
                <div className="space-y-1.5">
                  {current.resources.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> {r.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <Button onClick={markComplete} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Abgeschlossen{nextModule ? " & weiter" : ""}
              </Button>
              {nextModule && (
                <Button variant="outline" onClick={() => navigate(`/kurs/${nextModule.id}`)} className="gap-2">
                  Nächstes Modul <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-1">
          <h2 className="text-xs font-mono uppercase text-muted-foreground mb-2 px-1">Kursübersicht</h2>
          {modules.map((m, i) => {
            const active = m.id === moduleId;
            return (
              <Link
                key={m.id}
                to={`/kurs/${m.id}`}
                className={`block rounded-lg px-3 py-2.5 text-sm transition-all ${active ? "bg-primary/12 text-primary font-semibold" : "text-foreground/70 hover:bg-surface-elevated"}`}
              >
                <span className="font-mono text-[10px] text-muted-foreground mr-2">{String(i + 1).padStart(2, "0")}</span>
                {m.title}
              </Link>
            );
          })}
        </aside>
      </main>
    </div>
  );
};

export default CoursePlayer;
