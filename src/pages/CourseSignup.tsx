import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import logoLight from "@/assets/logo-light.png";

const perks = [
  "Sofortiger Zugang zu allen Modulen",
  "Mindset, Setup, B-Roll, Algorithmus",
  "In deinem Tempo — jederzeit erneut ansehen",
];

const CourseSignup = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/kurs" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("course-signup", { body: form });
      if (error || (data && (data as any).error)) {
        const msg = (data as any)?.error || error?.message || "Registrierung fehlgeschlagen";
        toast.error(msg);
        setSubmitting(false);
        return;
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email, password: form.password,
      });
      if (signInErr) {
        toast.success("Account erstellt. Bitte einloggen.");
        navigate("/login");
        return;
      }
      toast.success("Willkommen!");
      navigate("/kurs");
    } catch (err: any) {
      toast.error(err.message || "Fehler");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between px-6 py-6">
        <img src={logoLight} alt="Marketlab Media" className="h-6 w-auto" />
        <Link to="/login" className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition">
          Login
        </Link>
      </header>

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto grid lg:grid-cols-2 gap-12 px-6 py-8 lg:py-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-6">
            <PlayCircle className="h-3 w-3" /> Videokurs · Kostenlos für Kunden
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-[1.05]">
            Content, der wirklich verkauft.
          </h1>
          <p className="mt-5 text-muted-foreground font-body leading-relaxed max-w-md">
            Der komplette Marketlab-Media-Onboarding-Kurs — Mindset, Setup, B-Roll und Algorithmus in kompakten Modulen.
          </p>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-foreground/80">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-primary/5">
          <h2 className="text-xl font-display font-semibold">Account erstellen</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-6">Direkter Zugang, keine Bestätigungs-Mail nötig.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider">Name</Label>
              <Input id="name" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider">E-Mail</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider">Passwort</Label>
              <Input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="h-11" />
              <p className="text-[10px] text-muted-foreground">Mindestens 8 Zeichen</p>
            </div>
            <Button type="submit" size="lg" className="w-full gap-2 mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Zugang freischalten
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              Bereits registriert? <Link to="/login" className="text-primary hover:underline">Einloggen</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CourseSignup;
