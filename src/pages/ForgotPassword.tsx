import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoLight from "@/assets/logo-light.png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 p-8">
        <div className="flex flex-col items-center gap-3">
          <img src={logoLight} alt="Marketlab Media" className="h-6 w-auto" />
          <p className="text-sm text-muted-foreground font-body">Passwort zurücksetzen</p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-body text-foreground">
              Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt.
            </p>
            <p className="text-xs text-muted-foreground font-body">
              Schau auch im Spam-Ordner nach.
            </p>
            <Link to="/login" className="text-sm font-mono text-primary hover:underline">
              ZURÜCK ZUM LOGIN
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card border-border font-body"
              />
            </div>

            {error && <p className="text-sm text-destructive font-body">{error}</p>}

            <Button type="submit" className="w-full font-mono text-sm" disabled={loading}>
              {loading ? "SENDEN..." : "LINK SENDEN"}
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-xs font-mono text-muted-foreground hover:text-foreground">
                ZURÜCK ZUM LOGIN
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
