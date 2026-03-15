import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoLight from "@/assets/logo-light.png";

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for the SIGNED_IN event from the invite link token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 p-8">
        <div className="flex flex-col items-center gap-3">
          <img src={logoLight} alt="Marketlab Media" className="h-6 w-auto" />
          <p className="text-sm text-muted-foreground font-body">Willkommen im Team!</p>
          <p className="text-xs text-muted-foreground font-body text-center">
            Setze ein Passwort, um dein Konto zu aktivieren.
          </p>
        </div>

        {!ready ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground font-body">Einladung wird verarbeitet…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-body text-sm text-muted-foreground">
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-card border-border font-body"
                placeholder="Mindestens 6 Zeichen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-body text-sm text-muted-foreground">
                Passwort bestätigen
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-card border-border font-body"
              />
            </div>

            {error && <p className="text-sm text-destructive font-body">{error}</p>}

            <Button type="submit" className="w-full font-mono text-sm" disabled={loading}>
              {loading ? "WIRD GESPEICHERT..." : "KONTO AKTIVIEREN"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
