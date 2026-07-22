import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileDatePicker from "@/components/MobileDatePicker";
import { CalendarIcon, Sparkles, Repeat, BookmarkPlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TeamMember, PRIORITY_CONFIG } from "./constants";

const QUICK_TEMPLATES = [
  "Reel posten", "Carousel posten", "Skript schreiben", "Schnitt",
  "Feedback einholen", "Setting Call", "Follow-up",
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Einmalig" },
  { value: "daily", label: "Täglich" },
  { value: "weekdays", label: "Mo–Fr" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
];

interface CustomTemplate {
  id: string; name: string; title: string; priority: string | null;
  default_assignee: string | null; default_client_id: string | null;
  deadline_offset_days: number | null;
  recurrence_rule: string | null; notes: string | null;
  created_by: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  team: TeamMember[];
  clients: { id: string; name: string }[];
  defaultClientId?: string | null;
  defaultAssignee?: string | null;
}

const NewTaskSheet: React.FC<Props> = ({ open, onClose, team, clients, defaultClientId, defaultAssignee }) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [saving, setSaving] = useState(false);
  const [saveAsTpl, setSaveAsTpl] = useState(false);
  const [tplName, setTplName] = useState("");

  const { data: customTemplates = [] } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("task_templates" as any).select("*").order("name");
      return (data ?? []) as CustomTemplate[];
    },
  });

  useEffect(() => {
    if (open) {
      setTitle(""); setClientId(defaultClientId || "");
      setAssignee(defaultAssignee || user?.id || "");
      setDeadline(undefined); setDueTime("");
      setPriority("normal"); setNotes("");
      setRecurrence("none"); setSaveAsTpl(false); setTplName("");
    }
  }, [open, defaultClientId, defaultAssignee, user?.id]);

  const applyTemplate = (tpl: CustomTemplate) => {
    setTitle(tpl.title);
    setPriority(tpl.priority || "normal");
    if (tpl.default_assignee) setAssignee(tpl.default_assignee);
    if (tpl.default_client_id) setClientId(tpl.default_client_id);
    if (tpl.deadline_offset_days != null) {
      const d = new Date(); d.setDate(d.getDate() + tpl.deadline_offset_days);
      setDeadline(d);
    }
    if (tpl.recurrence_rule) setRecurrence(tpl.recurrence_rule);
    if (tpl.notes) setNotes(tpl.notes);
  };

  const canSave = title.trim().length > 0 && !!assignee;

  const save = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        client_id: clientId || null,
        assigned_to: assignee,
        created_by: user.id,
        status: "not_started",
        priority,
        deadline: deadline ? format(deadline, "yyyy-MM-dd") : null,
        due_time: dueTime || null,
        notes: notes.trim() || null,
        recurrence_rule: recurrence === "none" ? null : recurrence,
      };
      const { error } = await supabase.from("tasks" as any).insert(payload);
      if (error) throw error;

      if (saveAsTpl && tplName.trim()) {
        await supabase.from("task_templates" as any).insert({
          name: tplName.trim(),
          title: title.trim(),
          priority,
          default_assignee: assignee,
          default_client_id: clientId || null,
          deadline_offset_days: deadline ? Math.round((deadline.getTime() - Date.now()) / 86400000) : null,
          recurrence_rule: recurrence === "none" ? null : recurrence,
          notes: notes.trim() || null,
          is_shared: true,
          created_by: user.id,
        });
        qc.invalidateQueries({ queryKey: ["task-templates"] });
      }

      qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
      qc.invalidateQueries({ queryKey: ["my-todos-page"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("Aufgabe erstellt");
      onClose();
    } catch (e: any) {
      toast.error("Fehler: " + (e?.message || "Unbekannt"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Vorlage löschen?")) return;
    await supabase.from("task_templates" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-templates"] });
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Neue Aufgabe</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Vorlagen</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map(tpl => (
                <button key={tpl} type="button" onClick={() => setTitle(tpl)}
                  className={cn("px-2.5 py-1 rounded-full text-xs border transition-all",
                    title === tpl ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-elevated border-border hover:border-primary/50")}
                >{tpl}</button>
              ))}
            </div>
            {customTemplates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {customTemplates.map(tpl => (
                  <div key={tpl.id} className="group flex items-center gap-0.5 bg-primary/10 rounded-full border border-primary/30">
                    <button type="button" onClick={() => applyTemplate(tpl)}
                      className="px-2.5 py-1 text-xs text-primary hover:text-primary-foreground hover:bg-primary rounded-full transition-colors">
                      ⚡ {tpl.name}
                    </button>
                    {tpl.created_by === user?.id && (
                      <button type="button" onClick={() => deleteTemplate(tpl.id)}
                        className="opacity-0 group-hover:opacity-100 pr-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Titel *</label>
            <Input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Was ist zu tun?" className="h-10"
              onKeyDown={e => { if (e.key === "Enter" && canSave) save(); }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Zuweisen an *</label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>
                  {team.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Kunde</label>
              <Select value={clientId || "none"} onValueChange={v => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Kunde —</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Deadline</label>
              <MobileDatePicker selected={deadline} onSelect={setDeadline}>
                <Button variant="outline" className="h-9 w-full text-xs justify-start gap-2">
                  <CalendarIcon className="h-3 w-3" />
                  {deadline ? format(deadline, "dd. MMM yyyy", { locale: de }) : "Keine"}
                </Button>
              </MobileDatePicker>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Uhrzeit</label>
              <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Wiederholung
              </label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {recurrence !== "none" && (
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  Nach Erledigung wird automatisch die nächste Instanz erstellt.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Priorität</label>
              <div className="flex gap-1.5">
                {PRIORITY_CONFIG.map(p => (
                  <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-all",
                      priority === p.value ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    <span className={cn("w-2 h-2 rounded-full", p.dot)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Notiz</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Kontext, Links …" className="min-h-[70px] text-sm" />
          </div>

          <div className="rounded-lg border border-border/60 bg-surface-elevated/40 p-3">
            <button type="button" onClick={() => setSaveAsTpl(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <BookmarkPlus className="h-3.5 w-3.5" />
              {saveAsTpl ? "Nicht als Vorlage speichern" : "Als Vorlage speichern"}
            </button>
            {saveAsTpl && (
              <Input value={tplName} onChange={e => setTplName(e.target.value)}
                placeholder="Vorlagen-Name (z.B. Weekly Reporting)"
                className="mt-2 h-8 text-xs" />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Abbrechen</Button>
            <Button onClick={save} disabled={!canSave || saving} className="flex-1">
              {saving ? "Speichern…" : "Aufgabe erstellen"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NewTaskSheet;
