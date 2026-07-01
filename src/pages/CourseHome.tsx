import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, PlayCircle, LogOut } from "lucide-react";
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
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m} Min.`;
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
  const pct = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <img src={logoLight} alt="Marketlab Media" className="h-5 w-auto" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-body hidden sm:inline">{profile?.name}</span>
            <Button size="sm" variant="ghost" onClick={signOut} className="gap-2">
              <LogOut className="h-3.5 w-3.5" /> Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Marketlab Videokurs</h1>
          <p className="text-muted-foreground mt-2 font-body">Alles, was du brauchst, um mit deinem Content durchzustarten.</p>
          {enrolled && modules.length > 0 && (
            <div className="mt-6 max-w-md">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono mb-1.5">
                <span>{completedCount} von {modules.length} abgeschlossen</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {enrolled === false && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-body text-muted-foreground">Du bist noch nicht für den Kurs freigeschaltet. Bitte melde dich bei deinem Ansprechpartner.</p>
          </div>
        )}

        {enrolled && modules.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-body text-muted-foreground">Bald geht's los. Der Kurs wird gerade vorbereitet.</p>
          </div>
        )}

        {enrolled && modules.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m, i) => {
              const done = !!progress[m.id]?.completed_at;
              return (
                <Link
                  key={m.id}
                  to={`/kurs/${m.id}`}
                  className="group rounded-xl border border-border bg-card hover:border-primary/40 transition-all overflow-hidden"
                >
                  <div className="aspect-video bg-surface-elevated relative overflow-hidden">
                    {m.thumbnail_url ? (
                      <img src={m.thumbnail_url} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <PlayCircle className="h-12 w-12" />
                      </div>
                    )}
                    {done && (
                      <div className="absolute top-2 right-2 rounded-full bg-emerald-500/95 text-white p-1">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-sm leading-snug">{m.title}</h3>
                    {m.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 font-body">{m.description}</p>}
                    {m.duration_seconds && <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono">{fmtDuration(m.duration_seconds)}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default CourseHome;
