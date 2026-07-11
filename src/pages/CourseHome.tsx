import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, PlayCircle, LogOut, Clock, ArrowRight, Sparkles } from "lucide-react";
import logoLight from "@/assets/logo-light.png";
import { Button } from "@/components/ui/button";

interface Module {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
}

const fmtDuration = (s: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")} Min` : `${m} Min`;
};

const CourseHome = () => {
  const { user, loading, signOut, profile } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Record<string, { completed_at: string | null }>>({});
  const [enrolled, setEnrolled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: mods }, { data: prog }, { data: student }, { data: role }] = await Promise.all([
        supabase.from("course_modules").select("id,title,description,thumbnail_url,duration_seconds,sort_order").eq("is_published", true).order("sort_order"),
        supabase.from("course_progress").select("module_id, completed_at").eq("user_id", user.id),
        supabase.from("course_students").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      setEnrolled(!!student || role?.role === "admin" || role?.role === "head_of_content");
      setModules(mods || []);
      const p: Record<string, { completed_at: string | null }> = {};
      (prog || []).forEach((r: any) => { p[r.module_id] = { completed_at: r.completed_at }; });
      setProgress(p);
    })();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const completedCount = modules.filter((m) => progress[m.id]?.completed_at).length;
  const totalSeconds = modules.reduce((s, m) => s + (m.duration_seconds || 0), 0);
  const pct = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;
  const nextUp = modules.find((m) => !progress[m.id]?.completed_at) || modules[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <header className="relative border-b border-border/60 sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-8 h-16">
          <div className="flex items-center gap-3">
            <img src={logoLight} alt="Marketlab Media" className="h-5 w-auto" />
            <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground border-l border-border pl-3">Videokurs</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{profile?.name}</span>
            <Button size="sm" variant="ghost" onClick={signOut} className="gap-2">
              <LogOut className="h-3.5 w-3.5" /> Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {/* HERO */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-6">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Marketlab Academy</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight leading-[1.05] max-w-3xl">
            Content, der <span className="italic text-primary">wirklich</span> verkauft.
          </h1>
          <p className="text-muted-foreground mt-5 font-body text-base sm:text-lg max-w-xl leading-relaxed">
            Ehrlich, kompakt, umsetzbar. In {modules.length || "wenigen"} Modulen lernst du alles, was du für deinen Content-Start brauchst.
          </p>

          {enrolled && modules.length > 0 && (
            <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="max-w-md">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  <span>{completedCount}/{modules.length} Module</span>
                  <span className="text-primary">{pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-surface-elevated overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 text-[11px] font-mono text-muted-foreground/70">
                  {fmtDuration(totalSeconds)} gesamt
                </div>
              </div>

              {nextUp && (
                <Link to={`/kurs/${nextUp.id}`}>
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                    <PlayCircle className="h-4 w-4" />
                    {completedCount === 0 ? "Jetzt starten" : "Weitermachen"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {enrolled === false && (
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur p-10 text-center">
            <p className="font-body text-muted-foreground">Du bist noch nicht für den Kurs freigeschaltet. Bitte melde dich bei deinem Ansprechpartner.</p>
          </div>
        )}

        {enrolled && modules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-body text-muted-foreground">Bald geht's los. Der Kurs wird gerade vorbereitet.</p>
          </div>
        )}

        {/* MODULE LIST */}
        {enrolled && modules.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Alle Module</h2>
              <div className="text-xs font-mono text-muted-foreground/60">{modules.length} Kapitel</div>
            </div>

            <div className="space-y-2">
              {modules.map((m, i) => {
                const done = !!progress[m.id]?.completed_at;
                const isNext = nextUp?.id === m.id && !done;
                return (
                  <Link
                    key={m.id}
                    to={`/kurs/${m.id}`}
                    className={`group relative flex items-center gap-5 rounded-xl border p-4 sm:p-5 transition-all ${
                      isNext
                        ? "border-primary/40 bg-primary/[0.04] hover:border-primary/60"
                        : "border-border/60 bg-card/40 hover:bg-card hover:border-border"
                    }`}
                  >
                    {/* Number */}
                    <div className={`shrink-0 flex flex-col items-center justify-center h-14 w-14 rounded-lg ${
                      done ? "bg-emerald-500/15 text-emerald-400" : isNext ? "bg-primary/15 text-primary" : "bg-surface-elevated text-muted-foreground"
                    }`}>
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span className="font-display font-bold text-lg tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="hidden sm:block relative shrink-0 w-32 h-[72px] rounded-md overflow-hidden bg-surface-elevated">
                      {m.thumbnail_url ? (
                        <img src={m.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                          <PlayCircle className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isNext && <span className="text-[9px] font-mono uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded">Als Nächstes</span>}
                        {done && <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400">Fertig</span>}
                      </div>
                      <h3 className="font-display font-semibold text-base sm:text-lg leading-tight truncate">{m.title}</h3>
                      {m.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1 font-body">{m.description}</p>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {fmtDuration(m.duration_seconds)}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CourseHome;
