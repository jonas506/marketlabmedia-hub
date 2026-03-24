import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Target, Bell, Sparkles, Loader2, X } from "lucide-react";

interface StepStrategyProps {
  strategyText: string;
  setStrategyText: (v: string) => void;
  isAiStrategy: boolean;
  onGenerateStrategy: () => void;
  notifyEmails: string[];
  setNotifyEmails: React.Dispatch<React.SetStateAction<string[]>>;
  clientStatus: string;
  setClientStatus: (v: string) => void;
}

const StepStrategy: React.FC<StepStrategyProps> = ({
  strategyText, setStrategyText, isAiStrategy, onGenerateStrategy,
  notifyEmails, setNotifyEmails, clientStatus, setClientStatus,
}) => {
  const [notifyInput, setNotifyInput] = React.useState("");

  const addNotifyEmail = () => {
    const v = notifyInput.trim();
    if (v && v.includes("@")) { setNotifyEmails(prev => [...prev, v]); setNotifyInput(""); }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Strategie & Ziel
          </Label>
          <Button variant="outline" size="sm" onClick={onGenerateStrategy} disabled={isAiStrategy} className="gap-1.5 text-xs h-7">
            {isAiStrategy ? <><Loader2 className="h-3 w-3 animate-spin" /> Generiert...</> : <><Sparkles className="h-3 w-3" /> Mit KI erstellen</>}
          </Button>
        </div>
        <Textarea value={strategyText} onChange={(e) => setStrategyText(e.target.value)}
          placeholder="Was machen wir für den Kunden? Was ist das Ziel? Oder klicke 'Mit KI erstellen'..." rows={5} className="bg-background/50" />
      </div>

      <div>
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          <Bell className="h-3.5 w-3.5" /> Freigabe-Benachrichtigungen
        </Label>
        <p className="text-xs text-muted-foreground mb-2">E-Mail-Adressen, die bei Freigaben benachrichtigt werden.</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {notifyEmails.map((email, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={() => setNotifyEmails(prev => prev.filter((_, j) => j !== i))}>
              {email} <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
        <Input value={notifyInput} onChange={(e) => setNotifyInput(e.target.value)} placeholder="email@kunde.de + Enter" type="email"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNotifyEmail(); } }} className="bg-background/50" />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 p-4">
        <div>
          <Label className="text-sm font-semibold">Kunde sofort aktiv?</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Kann später geändert werden</p>
        </div>
        <Switch checked={clientStatus === "active"} onCheckedChange={(v) => setClientStatus(v ? "active" : "paused")} />
      </div>
    </div>
  );
};

export default React.memo(StepStrategy);
