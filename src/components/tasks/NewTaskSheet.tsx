import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileDatePicker from "@/components/MobileDatePicker";
import { CalendarIcon, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TeamMember, PRIORITY_CONFIG } from "./constants";

const QUICK_TEMPLATES = [
  "Reel posten",
  "Carousel posten",
  "Skript schreiben",
  "Schnitt",
  "Feedback einholen",
  "Setting Call",
  "Follow-up",
];

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setClientId(defaultClientId || "");
      setAssignee(defaultAssignee || user?.id || "");
      setDeadline(undefined);
      setDueTime("");
      setPriority("normal");
      setNotes("");
    }
  }, [open, defaultClientId, defaultAssignee, user?.id]);

  const canSave = title.trim().length > 0 && !!assignee;

  const save = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tasks" as any).insert({
        title: title.trim(),
        client_id: clientId || null,
        assigned_to: assignee,
        created_by: user.id,
        status: "not_started",
        priority,
        deadline: deadline ? format(deadline, "yyyy-MM-dd") : null,
        due_time: dueTime || null,
        notes: notes.trim() || null,
      } as any);
      if (error) throw error;
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

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Neue Aufgabe</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          {/* Quick templates */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Vorlagen</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map(tpl => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setTitle(tpl)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs border transition-all",
                    title === tpl
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-elevated border-border hover:border-primary/50 text-foreground"
                  )}
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Titel *</label>
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Was ist zu tun?"
              className="h-10"
              onKeyDown={e => { if (e.key === "Enter" && canSave) save(); }}
            />
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
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Priorität</label>
              <div className="flex gap-1.5">
                {PRIORITY_CONFIG.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-all",
                      priority === p.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", p.dot)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Notiz (optional)</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Kontext, Links …" className="min-h-[70px] text-sm" />
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
