import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, AlertTriangle, TrendingUp, Sparkles, Trash2 } from "lucide-react";
import {
  WEEK_CONFIGS,
  MOOD_OPTIONS,
  getCurrentWeekFocus,
  getISOWeek,
  type WeekFocus,
} from "@/lib/checkin-constants";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  clientId: string;
  canEdit: boolean;
}

interface CheckinRow {
  id: string;
  checkin_date: string;
  calendar_week: number;
  year: number;
  week_focus: number;
  mood: string | null;
  answers: Record<string, string>;
  wishes: string | null;
  content_ideas: string | null;
  nps: number | null;
  next_action: string | null;
  next_action_date: string | null;
  escalated: boolean;
  upsell_flag: boolean;
  created_at: string;
}

export default function ClientCheckins({ clientId, canEdit }: Props) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canDelete = role === "admin";
  const [open, setOpen] = useState(false);

  const { data: checkins, isLoading } = useQuery({
    queryKey: ["client-checkins", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_checkins")
        .select("*")
        .eq("client_id", clientId)
        .order("checkin_date", { ascending: false });
      if (error) throw error;
      return data as unknown as CheckinRow[];
    },
  });

  const currentFocus = getCurrentWeekFocus();
  const { week, year } = getISOWeek(new Date());
  const alreadyThisWeek = checkins?.some((c) => c.calendar_week === week && c.year === year);

  const npsScores = (checkins ?? []).filter((c) => c.nps !== null).slice(0, 6).reverse();
  const avgNps = npsScores.length
    ? Math.round((npsScores.reduce((s, c) => s + (c.nps ?? 0), 0) / npsScores.length) * 10) / 10
    : null;

  const handleDelete = async (id: string) => {
    if (!confirm("Check-in wirklich löschen?")) return;
    const { error } = await supabase.from("client_checkins").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Check-in gelöscht");
    qc.invalidateQueries({ queryKey: ["client-checkins", clientId] });
    qc.invalidateQueries({ queryKey: ["checkins-overview"] });
  };

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <Card className={cn("p-4 border", WEEK_CONFIGS[currentFocus].accent)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium opacity-80">
              <span>Diese Woche · KW {week}</span>
              <span className="opacity-60">·</span>
              <span>{WEEK_CONFIGS[currentFocus].badge}</span>
            </div>
            <h2 className="text-lg font-semibold mt-0.5 font-heading text-foreground">
              {WEEK_CONFIGS[currentFocus].title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {WEEK_CONFIGS[currentFocus].subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alreadyThisWeek && (
              <span className="text-xs text-emerald-400">✓ diese Woche erledigt</span>
            )}
            {canEdit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Check-in
                  </Button>
                </DialogTrigger>
                <CheckinDialog
                  clientId={clientId}
                  onClose={() => setOpen(false)}
                  onSaved={() => {
                    qc.invalidateQueries({ queryKey: ["client-checkins", clientId] });
                    qc.invalidateQueries({ queryKey: ["checkins-overview"] });
                    setOpen(false);
                  }}
                />
              </Dialog>
            )}
          </div>
        </div>
      </Card>

      {/* NPS mini-trend */}
      {avgNps !== null && (
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Ø NPS (letzte {npsScores.length})</p>
            <p className="text-2xl font-semibold font-heading">{avgNps}</p>
          </div>
          <div className="flex items-end gap-1 h-10">
            {npsScores.map((c) => (
              <div
                key={c.id}
                title={`NPS ${c.nps} · KW ${c.calendar_week}`}
                className={cn(
                  "w-3 rounded-sm",
                  (c.nps ?? 0) >= 9 ? "bg-emerald-500" : (c.nps ?? 0) >= 7 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ height: `${((c.nps ?? 0) / 10) * 100}%` }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* History */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Historie</h3>
        {isLoading ? (
          <div className="h-24 rounded-lg bg-card/50 border border-border animate-pulse" />
        ) : !checkins?.length ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-sm text-muted-foreground">Noch kein Check-in vorhanden.</p>
            {canEdit && (
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Ersten Check-in anlegen
              </Button>
            )}
          </Card>
        ) : (
          checkins.map((c) => {
            const cfg = WEEK_CONFIGS[c.week_focus as WeekFocus];
            const mood = MOOD_OPTIONS.find((m) => m.value === c.mood);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-md border", cfg.accent)}>
                        {cfg.badge}
                      </span>
                      <span className="text-sm font-medium">{cfg.title}</span>
                      <span className="text-xs text-muted-foreground">
                        · {format(parseISO(c.checkin_date), "EEE, d. MMM yyyy", { locale: de })} · KW {c.calendar_week}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {mood && <span className={cn("text-lg", mood.color)} title={mood.label}>{mood.emoji}</span>}
                      {c.nps !== null && (
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-md",
                          c.nps >= 9 ? "bg-emerald-500/15 text-emerald-400"
                          : c.nps >= 7 ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                        )}>
                          NPS {c.nps}
                        </span>
                      )}
                      {c.escalated && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Eskaliert
                        </span>
                      )}
                      {c.upsell_flag && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Upsell
                        </span>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {cfg.questions.map((q, i) => {
                    const a = c.answers?.[`q${i + 1}`];
                    if (!a) return null;
                    return (
                      <div key={i} className="text-sm">
                        <p className="text-xs text-muted-foreground mb-0.5">{q}</p>
                        <p className="whitespace-pre-wrap">{a}</p>
                      </div>
                    );
                  })}

                  {c.wishes && (
                    <div className="text-sm rounded-md bg-amber-500/5 border border-amber-500/20 p-2.5">
                      <p className="text-xs text-amber-400 mb-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Wünsche / Upsell
                      </p>
                      <p className="whitespace-pre-wrap">{c.wishes}</p>
                    </div>
                  )}
                  {c.content_ideas && (
                    <div className="text-sm rounded-md bg-sky-500/5 border border-sky-500/20 p-2.5">
                      <p className="text-xs text-sky-400 mb-0.5">Content-Ideen</p>
                      <p className="whitespace-pre-wrap">{c.content_ideas}</p>
                    </div>
                  )}
                  {c.next_action && (
                    <div className="text-sm rounded-md bg-primary/5 border border-primary/20 p-2.5">
                      <p className="text-xs text-primary mb-0.5">
                        Next Action{c.next_action_date ? ` bis ${format(parseISO(c.next_action_date), "d. MMM", { locale: de })}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{c.next_action}</p>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------- Dialog ---------- */

function CheckinDialog({
  clientId,
  onClose,
  onSaved,
}: { clientId: string; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const focus = getCurrentWeekFocus();
  const { week, year } = getISOWeek(new Date());
  const cfg = WEEK_CONFIGS[focus];
  const [mood, setMood] = useState<"happy" | "neutral" | "unhappy" | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wishes, setWishes] = useState("");
  const [contentIdeas, setContentIdeas] = useState("");
  const [nps, setNps] = useState<string>("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const [createTask, setCreateTask] = useState(true);

  const save = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("client_checkins").insert({
        client_id: clientId,
        checkin_date: new Date().toISOString().slice(0, 10),
        calendar_week: week,
        year,
        week_focus: focus,
        mood: mood || null,
        answers,
        wishes: wishes.trim() || null,
        content_ideas: contentIdeas.trim() || null,
        nps: focus === 4 && nps !== "" ? Number(nps) : null,
        next_action: nextAction.trim() || null,
        next_action_date: nextActionDate || null,
        escalated,
        upsell_flag: upsell || focus === 3,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;

      if (createTask && nextAction.trim()) {
        await supabase.from("tasks").insert({
          client_id: clientId,
          title: `Check-in Next Action: ${nextAction.trim().slice(0, 100)}`,
          deadline: nextActionDate || null,
          priority: escalated ? "urgent" : "normal",
          status: "not_started",
          tag: "checkin",
          assigned_to: userData.user?.id ?? null,
        });
      }

      toast.success("Check-in gespeichert");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className={cn("text-xs px-2 py-0.5 rounded-md border", cfg.accent)}>{cfg.badge}</span>
          {cfg.title}
        </DialogTitle>
        <p className="text-xs text-muted-foreground">{cfg.subtitle} · KW {week}</p>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label className="text-xs">Stimmung</Label>
          <div className="flex gap-2 mt-1.5">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(mood === m.value ? "" : m.value)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-2xl transition-all",
                  mood === m.value ? "border-primary bg-primary/10 scale-105" : "border-border hover:bg-muted/40"
                )}
                title={m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        {cfg.questions.map((q, i) => (
          <div key={i}>
            <Label className="text-xs leading-relaxed">{q}</Label>
            <Textarea
              className="mt-1.5 text-sm"
              rows={2}
              value={answers[`q${i + 1}`] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [`q${i + 1}`]: e.target.value })}
              placeholder="Antwort / Notiz…"
            />
          </div>
        ))}

        {focus === 4 && (
          <div>
            <Label className="text-xs">NPS-Wert (0–10)</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={nps}
              onChange={(e) => setNps(e.target.value)}
              className="mt-1.5 w-24"
            />
          </div>
        )}

        <div>
          <Label className="text-xs">Wünsche / Upsell-Potenzial</Label>
          <Textarea className="mt-1.5 text-sm" rows={2} value={wishes} onChange={(e) => setWishes(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Content-Ideen</Label>
          <Textarea className="mt-1.5 text-sm" rows={2} value={contentIdeas} onChange={(e) => setContentIdeas(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Next Action</Label>
            <Input className="mt-1.5 text-sm" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">bis</Label>
            <Input type="date" className="mt-1.5 text-sm" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={escalated} onCheckedChange={(v) => setEscalated(!!v)} />
            <span className="text-red-400">Eskalieren (sofort)</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={upsell} onCheckedChange={(v) => setUpsell(!!v)} />
            <span className="text-amber-400">Upsell-Flag an Jonas</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={createTask} onCheckedChange={(v) => setCreateTask(!!v)} />
            Task für Next Action anlegen
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Speichere…" : "Check-in speichern"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
