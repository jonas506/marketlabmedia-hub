import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, CheckCircle2, ChevronRight, ExternalLink, PlayCircle, Clock, ChevronLeft } from "lucide-react";
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

const fmtDuration = (s: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")}` : `${m}:00`;
};

const CoursePlayer = () => {
  const { moduleId } = useParams();
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [current, setCurrent] = useState<Module | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [startPos, setStartPos] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !moduleId) return;
    (async () => {
      const [{ data: allMods }, { data: prog }, { data: allProg }] = await Promise.all([
        supabase.from("course_modules").select("id,title,description,duration_seconds,sort_order,resources").eq("is_published", true).order("sort_order"),
        supabase.from("course_progress").select("last_position_seconds").eq("user_id", user.id).eq("module_id", moduleId).maybeSingle(),
        supabase.from("course_progress").select("module_id, completed_at").eq("user_id", user.id),
      ]);
      setModules((allMods || []) as Module[]);
      const cur = (allMods || []).find((m: any) => m.id === moduleId) as Module | undefined;
      setCurrent(cur || null);
      setStartPos(Number(prog?.last_position_seconds) || 0);
      const p: Record<string, boolean> = {};
      (allProg || []).forEach((r: any) => { if (r.completed_at) p[r.module_id] = true; });
      setProgress(p);
    })();
  }, [user, moduleId]);

  useEffect(() => {
    if (!moduleId || !session?.access_token) return;
    const url = `https://winsekbpsgwtwfdehyms.supabase.co/functions/v1/course-video-proxy?module_id=${moduleId}&t=${encodeURIComponent(session.access_token)}`;
    setVideoUrl(url);
  }, [moduleId, session?.access_token]);

  const currentIdx = useMemo(() => modules.findIndex((m) => m.id === moduleId), [modules, moduleId]);
  const nextModule = currentIdx >= 0 ? modules[currentIdx + 1] : null;
  const prevModule = currentIdx > 0 ? modules[currentIdx - 1] : null;

  const saveProgress = async (pos: number, completed = false) => {
    if (!user || !moduleId) return;
    await supabase.from("course_progress").upsert({
      user_id: user.id,
      module_id: moduleId,
      last_position_seconds: pos,
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    }, { onConflict: "user_id,module_id" });
    if (completed) setProgress((p) => ({ ...p, [moduleId]: true }));
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || saveTimer.current) return;
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

  const isDone = current && progress[current.id];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <header className="relative border-b border-border/60 sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 h-16">
          <Link to="/kurs" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Alle Module</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground hidden sm:inline">
              {String(currentIdx + 1).padStart(2, "0")} / {String(modules.length).padStart(2, "0")}
            </span>
            <img src={logoLight} alt="Marketlab Media" className="h-5 w-auto" />
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-8 py-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {/* Video */}
          <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl shadow-primary/5 ring-1 ring-border/60">
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
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="mt-8">
            <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
              <span className="text-primary">Modul {String(currentIdx + 1).padStart(2, "0")}</span>
              {current?.duration_seconds && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDuration(current.duration_seconds)} Min</span>
              )}
              {isDone && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Abgeschlossen</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight leading-tight">{current?.title || "…"}</h1>
            {current?.description && (
              <p className="text-muted-foreground mt-4 font-body whitespace-pre-wrap leading-relaxed max-w-2xl">{current.description}</p>
            )}

            {current?.resources && current.resources.length > 0 && (
              <div className="mt-8 rounded-xl border border-border/60 bg-card/40 p-5">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Ressourcen</h2>
                <div className="space-y-2">
                  {current.resources.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> {r.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Nav CTA */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-t border-border/60 pt-8">
              <div>
                {prevModule ? (
                  <Button variant="ghost" onClick={() => navigate(`/kurs/${prevModule.id}`)} className="gap-2 -ml-3">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Zurück</span>
                      <span className="block text-sm truncate max-w-[200px]">{prevModule.title}</span>
                    </span>
                  </Button>
                ) : <div />}
              </div>

              <div className="flex gap-2">
                <Button onClick={markComplete} size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  <CheckCircle2 className="h-4 w-4" />
                  {nextModule ? "Fertig & weiter" : "Kurs abschließen"}
                  {nextModule && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {nextModule && (
              <Link
                to={`/kurs/${nextModule.id}`}
                className="mt-6 group flex items-center gap-4 rounded-xl border border-border/60 bg-card/40 p-4 hover:border-primary/40 hover:bg-primary/[0.03] transition-all"
              >
                <div className="shrink-0 h-12 w-12 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Als Nächstes · Modul {String(currentIdx + 2).padStart(2, "0")}</div>
                  <div className="font-display font-semibold text-base truncate mt-0.5">{nextModule.title}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start space-y-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Kursübersicht</h2>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {Object.keys(progress).length}/{modules.length}
            </span>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto">
            {modules.map((m, i) => {
              const active = m.id === moduleId;
              const done = progress[m.id];
              return (
                <Link
                  key={m.id}
                  to={`/kurs/${m.id}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                    active ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-surface-elevated"
                  }`}
                >
                  <div className={`shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-mono font-semibold ${
                    active ? "bg-primary/20 text-primary" : done ? "bg-emerald-500/15 text-emerald-400" : "bg-surface-elevated text-muted-foreground"
                  }`}>
                    {done && !active ? <CheckCircle2 className="h-3.5 w-3.5" /> : String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`truncate ${active ? "font-semibold" : ""}`}>{m.title}</div>
                    {m.duration_seconds && (
                      <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{fmtDuration(m.duration_seconds)} Min</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default CoursePlayer;
