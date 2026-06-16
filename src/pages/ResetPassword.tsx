import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoLight from "@/assets/logo-light.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setValidSession(true);
      }
      setReady(true);
    });

    // Fallback: if no event fires (e.g. already in session), check existing session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/", { replace: true }), 1500);
  };

  if (!ready) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 p-8">
        <div className="flex flex-col items-center gap-3">
          <img src={logoLight} alt="Marketlab Media" className="h-6 w-auto" />
          <p className="text-sm text-muted-foreground font-body">Neues Passwort setzen</p>
        </div>

        {!validSession ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-body text-destructive">
              Der Link ist ungültig oder abgelaufen.
            </p>
            <Button onClick={() => navigate("/forgot-password")} className="w-full font-mono text-sm">
              NEUEN LINK ANFORDERN
            </Button>
          </div>
        ) : done ? (
          <p className="text-sm font-body text-center text-foreground">
            Passwort aktualisiert. Du wirst weitergeleitet...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-body text-sm text-muted-foreground">Neues Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="bg-card border-border font-body"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="font-body text-sm text-muted-foreground">Passwort bestätigen</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="bg-card border-border font-body"
              />
            </div>

            {error && <p className="text-sm text-destructive font-body">{error}</p>}

            <Button type="submit" className="w-full font-mono text-sm" disabled={loading}>
              {loading ? "SPEICHERN..." : "PASSWORT SPEICHERN"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
