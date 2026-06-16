import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoLight from "@/assets/logo-light.png";

const Login = () => {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
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
          <p className="text-sm text-muted-foreground font-body">Content Pipeline</p>
        </div>

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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="font-body text-sm text-muted-foreground">Passwort</Label>
              <Link to="/forgot-password" className="text-xs font-mono text-muted-foreground hover:text-foreground">
                VERGESSEN?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-card border-border font-body"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}

          <Button type="submit" className="w-full font-mono text-sm" disabled={loading}>
            {loading ? "ANMELDEN..." : "ANMELDEN"}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground font-mono">ODER</span></div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full font-mono text-sm gap-2"
            disabled={loading}
            onClick={async () => {
              setError("");
              setLoading(true);
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) {
                setError(result.error.message || "Google-Anmeldung fehlgeschlagen");
                setLoading(false);
                return;
              }
              if (result.redirected) return;
              navigate("/", { replace: true });
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Mit Google anmelden
          </Button>

          {(window.location.hostname.includes('preview') || window.location.hostname.includes('lovableproject.com') || window.location.hostname === 'localhost') && (
            <Button
              type="button"
              variant="outline"
              className="w-full font-mono text-xs text-muted-foreground"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  const { data, error: fnError } = await supabase.functions.invoke("dev-login", {
                    body: { email: "jonas@marketlab-media.de" },
                  });
                  if (fnError || data?.error) {
                    setError(fnError?.message || data?.error || "Dev-Login fehlgeschlagen");
                    setLoading(false);
                    return;
                  }
                  const { error: otpError } = await supabase.auth.verifyOtp({
                    token_hash: data.token_hash,
                    type: "magiclink",
                  });
                  if (otpError) {
                    setError(otpError.message);
                    setLoading(false);
                  } else {
                    navigate("/", { replace: true });
                  }
                } catch (e: any) {
                  setError(e.message);
                  setLoading(false);
                }
              }}
            >
              DEV LOGIN
            </Button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
