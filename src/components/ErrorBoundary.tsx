import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  level?: "page" | "section" | "widget";
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const level = this.props.level || "page";

    if (level === "page") {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="font-display text-lg font-bold">Etwas ist schiefgelaufen</h2>
            <p className="font-body text-sm text-muted-foreground">
              Diese Seite konnte nicht geladen werden. Das passiert manchmal bei Verbindungsproblemen.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = "/"}
                className="gap-2 font-mono text-xs"
              >
                <Home className="h-3.5 w-3.5" />
                Zum Dashboard
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  this.handleReset();
                  window.location.reload();
                }}
                className="gap-2 font-mono text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Seite neu laden
              </Button>
            </div>
            {this.state.error && (
              <details className="text-left mt-4">
                <summary className="text-[10px] font-mono text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Technische Details
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted/30 rounded p-2 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    if (level === "section") {
      return (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="font-body text-sm text-muted-foreground flex-1">
            Dieser Bereich konnte nicht geladen werden.
          </span>
          <Button variant="ghost" size="sm" onClick={this.handleReset} className="gap-1.5 text-xs font-mono shrink-0">
            <RefreshCw className="h-3 w-3" />
            Erneut versuchen
          </Button>
        </div>
      );
    }

    // Widget-level
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-destructive" />
        <span className="text-[10px] font-mono">Fehler beim Laden</span>
        <button onClick={this.handleReset} className="text-[10px] font-mono text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
