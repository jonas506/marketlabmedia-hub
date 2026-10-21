import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Pin, PinOff, Pencil, Trash2, Check, X, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPES, ACTIVITY_TYPE_MAP, TIMELINE_FILTERS, COMPACT_TYPES,
  filterActivities, groupActivitiesByDay, buildActivityInsert, type CrmActivity,
} from "@/lib/crm-activity";

export default function ActivityPanel({
  activities, leadId, contactId, onChanged, background,
}: {
  activities: CrmActivity[];
  leadId?: string | null;
  contactId?: string | null;
  onChanged: () => void;
  background?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [type, setType] = useState("note");
  const [text, setText] = useState("");
  const [at, setAt] = useState<Date | undefined>();
  const [followup, setFollowup] = useState(false);
  const [followupDate, setFollowupDate] = useState<Date | undefined>();
  const [filter, setFilter] = useState("Alle");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const shown = useMemo(() => groupActivitiesByDay(filterActivities(activities, filter)), [activities, filter]);

  const save = async () => {
    if (!text.trim() || !user || saving) return;
    setSaving(true);
    const row = buildActivityInsert({ text, type, userId: user.id, leadId, contactId, at });
    const { error } = await supabase.from("crm_activities").insert(row as any);
    if (error) {
      setSaving(false);
      toast.error("Aktivität konnte nicht gespeichert werden");
      return;
    }
    const t = ACTIVITY_TYPE_MAP[type];
    if (t?.channel && contactId) {
      await supabase.from("crm_contacts").update({ last_contact_at: row.created_at, last_channel: t.channel as any }).eq("id", contactId);
    }
    if (followup && followupDate) {
      const iso = format(followupDate, "yyyy-MM-dd");
      if (contactId) await supabase.from("crm_contacts").update({ next_followup_date: iso }).eq("id", contactId);
      if (leadId) await supabase.from("crm_leads").update({ next_step_date: iso } as any).eq("id", leadId);
    }
    setSaving(false);
    setText(""); setAt(undefined); setFollowup(false); setFollowupDate(undefined);
    onChanged();
  };

  const togglePin = async (a: CrmActivity) => {
    const metadata = { ...(a.metadata ?? {}), pinned: !a.metadata?.pinned };
    await supabase.from("crm_activities").update({ metadata } as any).eq("id", a.id);
    onChanged();
  };

  const remove = async (a: CrmActivity) => {
    const { error } = await supabase.from("crm_activities").delete().eq("id", a.id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    onChanged();
  };

  const saveEdit = async (a: CrmActivity) => {
    const body = editBody.trim();
    const title = body.split("\n")[0]?.slice(0, 80) || a.title;
    await supabase.from("crm_activities").update({ title, body: body || null } as any).eq("id", a.id);
    setEditId(null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {ACTIVITY_TYPES.slice(0, 6).map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border",
                type === t.value ? "border-primary/50 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}>
              <t.icon className="h-3.5 w-3.5" style={{ color: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Was ist passiert? Erste Zeile wird der Titel…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
          className="min-h-[70px] text-sm bg-background"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 gap-1.5 text-xs", !at && "text-muted-foreground")}>
                <CalendarClock className="h-3 w-3" />
                {at ? format(at, "dd.MM.yyyy") : "Jetzt"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={at} onSelect={setAt} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={followup} onCheckedChange={v => setFollowup(!!v)} /> Follow-up
          </label>
          {followup && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs", !followupDate && "text-muted-foreground")}>
                  {followupDate ? format(followupDate, "dd.MM.yyyy") : "Datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={followupDate} onSelect={setFollowupDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          )}
          <Button size="sm" className="ml-auto h-7 text-xs" onClick={save} disabled={!text.trim() || saving}>
            Speichern <span className="ml-1 opacity-60">⌘⏎</span>
          </Button>
        </div>
      </div>

      {background}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {TIMELINE_FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}>
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-5">
        {shown.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Aktivitäten.</p>}
        {shown.map(group => (
          <div key={group.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">{group.label}</p>
            <div className="space-y-2">
              {group.items.map(a => {
                const t = ACTIVITY_TYPE_MAP[a.type];
                const Icon = t?.icon ?? ACTIVITY_TYPES[0].icon;
                const own = a.created_by === user?.id;
                if (COMPACT_TYPES.has(a.type)) {
                  return (
                    <div key={a.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3 shrink-0" style={{ color: t?.color }} />
                      <span className="truncate">{a.title}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground/50">{format(new Date(a.created_at), "HH:mm")}</span>
                    </div>
                  );
                }
                return (
                  <div key={a.id} className={cn("rounded-lg border border-border bg-card p-3", a.metadata?.pinned && "border-primary/30")}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: t?.color }} />
                      <span className="text-sm font-medium truncate">{a.title}</span>
                      {a.metadata?.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/60">{format(new Date(a.created_at), "HH:mm")}</span>
                      {own && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => togglePin(a)} className="p-1 text-muted-foreground/50 hover:text-foreground" title={a.metadata?.pinned ? "Lösen" : "Anpinnen"}>
                            {a.metadata?.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </button>
                          <button onClick={() => { setEditId(a.id); setEditBody([a.title, a.body].filter(Boolean).join("\n")); }} className="p-1 text-muted-foreground/50 hover:text-foreground" title="Bearbeiten">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => remove(a)} className="p-1 text-muted-foreground/50 hover:text-destructive" title="Löschen">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>
                    {editId === a.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea autoFocus value={editBody} onChange={e => setEditBody(e.target.value)} className="min-h-[60px] text-sm bg-background" />
                        <div className="flex gap-1.5 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}><X className="h-3 w-3 mr-1" />Abbrechen</Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => saveEdit(a)}><Check className="h-3 w-3 mr-1" />Speichern</Button>
                        </div>
                      </div>
                    ) : (
                      a.body && <p className="mt-1.5 text-sm text-foreground/80 whitespace-pre-wrap">{a.body}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
