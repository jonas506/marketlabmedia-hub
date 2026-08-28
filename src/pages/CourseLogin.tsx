import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayCircle } from "lucide-react";
import logoLight from "@/assets/logo-light.png";

const CourseLogin = () => {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (user) return <Navigate to="/kurs" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError("E-Mail oder Passwort ist nicht korrekt.");
      setLoading(false);
    } else {
      navigate("/kurs", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logoLight} alt="Marketlab Media" className="h-6 w-auto" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
            <PlayCircle className="h-3 w-3" /> Videokurs · Kundenzugang
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-muted-foreground">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Passwort</Label>
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Vergessen?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-card border-border"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
            {loading ? "Anmelden…" : "Zum Kurs anmelden"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Noch keinen Zugang?{" "}
            <Link to="/kurs/anmelden" className="text-primary hover:underline">
              Kostenlos registrieren
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default CourseLogin;
