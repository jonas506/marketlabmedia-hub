import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkle, Check } from "lucide-react";
import { toast } from "sonner";

interface Stat {
  label: string;
  value: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Draft {
  results_text: string;
  stats: Stat[];
}

interface Props {
  clientId: string;
  current: { results_text: string; stats: Stat[] };
  onApply: (draft: Draft) => void;
  disabled?: boolean;
}

const ReferralResultsChat = ({ clientId, current, onApply, disabled }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("referral-results-chat", {
        body: { clientId, messages: next, current },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const reply: string = data?.reply || "Entwurf erstellt.";
      setMessages([...next, { role: "assistant", content: reply }]);
      if (data?.results_text || data?.stats) {
        setDraft({
          results_text: data.results_text || "",
          stats: Array.isArray(data.stats) ? data.stats.slice(0, 4) : [],
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "KI-Fehler");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkle className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Ergebnisse per Chat erstellen</p>
      </div>

      {messages.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto w-fit max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "w-fit max-w-[95%] whitespace-pre-line text-sm text-foreground"
              }
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Denkt nach …
            </div>
          )}
        </div>
      )}

      {draft && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Entwurf</p>
          <p className="whitespace-pre-line text-sm">{draft.results_text}</p>
          {draft.stats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {draft.stats.map((s, i) => (
                <span key={i} className="rounded-md border border-border px-2 py-1 text-xs">
                  <strong className="text-primary">{s.value}</strong> {s.label}
                </span>
              ))}
            </div>
          )}
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              onApply(draft);
              toast.success("In die Felder übernommen");
            }}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" /> Übernehmen
          </Button>
        </div>
      )}

      <Textarea
        rows={3}
        value={input}
        disabled={disabled || loading}
        placeholder="z. B. Seit März 3 Reels/Woche, Follower von 1.200 auf 9.400, 18 Anfragen über Instagram …"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={send} disabled={disabled || loading || !input.trim()}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkle className="mr-1.5 h-3.5 w-3.5" />}
          Senden
        </Button>
      </div>
    </div>
  );
};

export default ReferralResultsChat;
