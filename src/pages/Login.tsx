import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
            <Label htmlFor="password" className="font-body text-sm text-muted-foreground">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-card border-border font-body"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}

          <Button type="submit" className="w-full font-mono text-sm" disabled={loading}>
            {loading ? "ANMELDEN..." : "ANMELDEN"}
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
                    email: "jonas@marketlab-media.de",
                    token: data.token_hash,
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
