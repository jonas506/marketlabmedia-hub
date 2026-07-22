import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, ArrowUpDown, ChevronUp, ChevronDown, X, Trash2, CheckCircle2, UserCog } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Task, TeamMember, getInitials, PRIORITY_ORDER, STATUS_CONFIG } from "./constants";

interface ClientInfo { id: string; name: string; logo_url: string | null }

interface Props {
  tasks: Task[];
  clientMap: Record<string, ClientInfo>;
  teamMap: Record<string, TeamMember>;
  todayStr: string;
  onSelect: (t: Task) => void;
}

type SortKey = "title" | "client" | "assignee" | "status" | "priority" | "deadline";
type SortDir = "asc" | "desc";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Offen", cls: "bg-muted/60 text-foreground/70" },
  in_progress: { label: "In Arbeit", cls: "bg-blue-500/20 text-blue-300" },
  review: { label: "Review", cls: "bg-amber-500/20 text-amber-300" },
  on_hold: { label: "On Hold", cls: "bg-zinc-500/20 text-zinc-300" },
  done: { label: "Erledigt", cls: "bg-emerald-500/20 text-emerald-300" },
};

const PRIO_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Dringend", cls: "text-red-400" },
  high: { label: "Hoch", cls: "text-orange-400" },
  normal: { label: "Normal", cls: "text-blue-400" },
  low: { label: "Niedrig", cls: "text-muted-foreground" },
};

function clientHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

const TaskListView: React.FC<Props> = ({ tasks, clientMap, teamMap, todayStr, onSelect }) => {
  const qc = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case "client":
          av = (a.client_id && clientMap[a.client_id]?.name || "zzz").toLowerCase();
          bv = (b.client_id && clientMap[b.client_id]?.name || "zzz").toLowerCase();
          break;
        case "assignee":
          av = (a.assigned_to && (teamMap[a.assigned_to]?.name || teamMap[a.assigned_to]?.email) || "zzz").toLowerCase();
          bv = (b.assigned_to && (teamMap[b.assigned_to]?.name || teamMap[b.assigned_to]?.email) || "zzz").toLowerCase();
          break;
        case "status":
          av = a.status || "not_started"; bv = b.status || "not_started"; break;
        case "priority":
          av = PRIORITY_ORDER[a.priority || "normal"] ?? 2;
          bv = PRIORITY_ORDER[b.priority || "normal"] ?? 2;
          break;
        case "deadline":
          av = a.deadline || "9999-12-31"; bv = b.deadline || "9999-12-31"; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, sortDir, clientMap, teamMap]);

  const toggleDone = async (t: Task, checked: boolean) => {
    const updates: any = checked
      ? { is_completed: true, completed_at: new Date().toISOString(), status: "done" }
      : { is_completed: false, completed_at: null, status: t.status === "done" ? "not_started" : t.status };
    await supabase.from("tasks" as any).update(updates).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    if (checked) toast.success("✓ Erledigt");
  };

  const toggleSelect = (id: string) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = sorted.length > 0 && sorted.every(t => selected.has(t.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map(t => t.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const ids = () => Array.from(selected);
  const bulkComplete = async () => {
    await supabase.from("tasks" as any).update({ is_completed: true, completed_at: new Date().toISOString(), status: "done" }).in("id", ids());
    toast.success(`${selected.size} erledigt`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
  };
  const bulkDelete = async () => {
    if (!confirm(`${selected.size} Aufgaben wirklich löschen?`)) return;
    await supabase.from("tasks" as any).delete().in("id", ids());
    toast.success(`${selected.size} gelöscht`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
  };
  const bulkAssign = async (userId: string) => {
    await supabase.from("tasks" as any).update({ assigned_to: userId }).in("id", ids());
    toast.success(`${selected.size} zugewiesen`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
  };
  const bulkStatus = async (status: string) => {
    const upd: any = { status };
    if (status === "done") { upd.is_completed = true; upd.completed_at = new Date().toISOString(); }
    await supabase.from("tasks" as any).update(upd).in("id", ids());
    toast.success(`${selected.size} aktualisiert`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
  };

  const teamList = Object.values(teamMap);

  const SortHeader: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className }) => (
    <button onClick={() => toggleSort(k)}
      className={cn("flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors", className)}
    >
      {children}
      {sortKey === k ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />}
    </button>
  );

  if (sorted.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground/60 font-mono rounded-xl border border-border/50 bg-surface-elevated/40">
        Keine Aufgaben
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/40 bg-primary/10 sticky top-0 z-10">
          <span className="text-xs font-medium">{selected.size} ausgewählt</span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={bulkComplete} className="h-7 gap-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Erledigen
          </Button>
          <Select onValueChange={bulkStatus}>
            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="Status ändern" /></SelectTrigger>
            <SelectContent>
              {STATUS_CONFIG.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={bulkAssign}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <div className="flex items-center gap-1"><UserCog className="h-3 w-3" /><SelectValue placeholder="Zuweisen…" /></div>
            </SelectTrigger>
            <SelectContent>
              {teamList.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name || m.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={bulkDelete} className="h-7 gap-1 text-xs text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Löschen
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="h-7 ml-auto gap-1 text-xs">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-surface-elevated/40 overflow-hidden">
        <div className="grid grid-cols-[32px_32px_1fr_180px_160px_120px_110px_110px] gap-3 px-3 py-2.5 border-b border-border/50 bg-background/30">
          <div className="flex items-center justify-center">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </div>
          <div />
          <SortHeader k="title">Titel</SortHeader>
          <SortHeader k="client">Kunde</SortHeader>
          <SortHeader k="assignee">Zuweisung</SortHeader>
          <SortHeader k="status">Status</SortHeader>
          <SortHeader k="priority">Priorität</SortHeader>
          <SortHeader k="deadline">Deadline</SortHeader>
        </div>

        <div className="divide-y divide-border/40">
          {sorted.map(t => {
            const client = t.client_id ? clientMap[t.client_id] : null;
            const assignee = t.assigned_to ? teamMap[t.assigned_to] : null;
            const status = STATUS_META[t.status || "not_started"] || STATUS_META.not_started;
            const prio = PRIO_META[t.priority || "normal"] || PRIO_META.normal;
            const hue = client ? clientHue(client.id) : 220;
            const isSel = selected.has(t.id);

            let deadlineNode: React.ReactNode = <span className="text-[11px] text-muted-foreground/40">—</span>;
            if (t.deadline) {
              const days = differenceInCalendarDays(new Date(t.deadline), new Date(todayStr));
              let cls = "text-muted-foreground";
              let label = format(new Date(t.deadline), "dd. MMM", { locale: de });
              if (days < 0) { cls = "text-destructive"; label = `${label} · ${Math.abs(days)}d spät`; }
              else if (days === 0) { cls = "text-orange-400"; label = "Heute"; }
              else if (days === 1) { cls = "text-orange-400"; label = "Morgen"; }
              deadlineNode = <span className={cn("text-[11px] font-mono", cls)}>{label}</span>;
            }

            return (
              <div key={t.id}
                className={cn(
                  "grid grid-cols-[32px_32px_1fr_180px_160px_120px_110px_110px] gap-3 px-3 py-2 items-center hover:bg-muted/20 transition-colors cursor-pointer",
                  t.is_completed && "opacity-50",
                  isSel && "bg-primary/5"
                )}
                onClick={() => onSelect(t)}
              >
                <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                  <Checkbox checked={isSel} onCheckedChange={() => toggleSelect(t.id)} />
                </div>
                <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                  <Checkbox checked={t.is_completed} onCheckedChange={c => toggleDone(t, !!c)} />
                </div>
                <div className={cn("text-sm font-medium truncate", t.is_completed && "line-through")}>{t.title}</div>
                <div className="min-w-0">
                  {client ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full max-w-full truncate"
                      style={{ background: `hsl(${hue} 70% 55% / 0.15)`, color: `hsl(${hue} 70% 75%)` }}>
                      <span className="truncate">{client.name}</span>
                    </span>
                  ) : <span className="text-[11px] text-muted-foreground/40">—</span>}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  {assignee ? (
                    <>
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[9px] font-mono bg-primary/20 text-primary">
                          {getInitials(assignee.name || assignee.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] truncate">{assignee.name || assignee.email}</span>
                    </>
                  ) : <span className="text-[11px] text-muted-foreground/40">—</span>}
                </div>
                <div>
                  <span className={cn("inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full", status.cls)}>
                    {status.label}
                  </span>
                </div>
                <div className={cn("flex items-center gap-1 text-[11px] font-mono", prio.cls)}>
                  <Flag className="h-3 w-3" fill="currentColor" />
                  {prio.label}
                </div>
                <div>{deadlineNode}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TaskListView;
