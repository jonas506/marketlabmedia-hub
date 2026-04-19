import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Settings2, Pencil, Trash2, GripVertical } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KpiDef {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_value: number;
  unit: string;
  cadence: "daily" | "weekly";
  is_active: boolean;
  sort_order: number;
}

interface KpiEntry {
  id: string;
  kpi_id: string;
  user_id: string;
  date: string;
  value: number;
  note: string | null;
}

interface Profile {
  user_id: string;
  name: string;
}

const EMOJI_PRESETS = ["📊", "🎬", "✍️", "📩", "📞", "🎯", "💰", "📈", "🚀", "✅", "📝", "🎨", "📸", "💬", "⚡"];

function getWeekStart(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

function fmtRange(weekStart: Date) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  return `${format(weekStart, "dd.MM.", { locale: de })} – ${format(weekEnd, "dd.MM.yyyy", { locale: de })}`;
}

function getWeekNumber(d: Date) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

interface Props {
  profiles: Profile[];
}

export default function KPITab({ profiles }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [manageOpen, setManageOpen] = useState(false);
  const [adminFocusUser, setAdminFocusUser] = useState<string>("__all__");

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Load KPIs
  const { data: kpis = [] } = useQuery({
    queryKey: ["kpi-defs", isAdmin, user?.id],
    queryFn: async () => {
      let q = supabase.from("kpi_definitions").select("*").eq("is_active", true).order("sort_order");
      if (!isAdmin) q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as KpiDef[];
    },
    enabled: !!user,
  });

  // Load entries for the visible week
  const { data: entries = [] } = useQuery({
    queryKey: ["kpi-entries", weekStartStr, weekEndStr, isAdmin, user?.id],
    queryFn: async () => {
      let q = supabase.from("kpi_entries").select("*").gte("date", weekStartStr).lte("date", weekEndStr);
      if (!isAdmin) q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as KpiEntry[];
    },
    enabled: !!user,
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["kpi-defs"] });
    qc.invalidateQueries({ queryKey: ["kpi-entries"] });
  };

  // ---- Save value ----
  async function saveValue(kpi: KpiDef, dateStr: string, value: number, note?: string) {
    const targetUserId = kpi.user_id;
    const existing = entries.find(e => e.kpi_id === kpi.id && e.date === dateStr);
    if (existing) {
      const { error } = await supabase
        .from("kpi_entries")
        .update({ value, note: note ?? existing.note })
        .eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("kpi_entries").insert({
        kpi_id: kpi.id,
        user_id: targetUserId,
        date: dateStr,
        value,
        note: note ?? null,
      });
      if (error) { toast.error(error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["kpi-entries"] });
  }

  // ---- Aggregate per KPI for the week ----
  function aggregate(kpiId: string) {
    return entries.filter(e => e.kpi_id === kpiId).reduce((sum, e) => sum + Number(e.value), 0);
  }

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Header: period nav + admin filter + manage */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[200px] text-center">
            KW {getWeekNumber(weekStart)} · {fmtRange(weekStart)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>
            Heute
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={adminFocusUser} onValueChange={setAdminFocusUser}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Mitarbeiter</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" /> KPIs verwalten
            </Button>
          )}
        </div>
      </div>

      {/* Content area */}
      {isAdmin ? (
        <AdminGrid
          kpis={kpis}
          entries={entries}
          profiles={profiles}
          focusUser={adminFocusUser}
          weekStart={weekStart}
          onSave={saveValue}
        />
      ) : (
        <MemberCards
          kpis={kpis}
          entries={entries}
          weekStart={weekStart}
          onSave={saveValue}
        />
      )}

      {/* Manage dialog */}
      {isAdmin && (
        <ManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          profiles={profiles}
          onChanged={refetchAll}
        />
      )}
    </div>
  );
}

// ============================================================
// MEMBER VIEW: Cards per KPI with progress
// ============================================================
function MemberCards({
  kpis,
  entries,
  weekStart,
  onSave,
}: {
  kpis: KpiDef[];
  entries: KpiEntry[];
  weekStart: Date;
  onSave: (kpi: KpiDef, dateStr: string, value: number, note?: string) => Promise<void>;
}) {
  if (kpis.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Noch keine KPIs für dich definiert. Sag Jonas Bescheid, damit er welche anlegt.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map(k => (
        <KpiCard key={k.id} kpi={k} entries={entries} weekStart={weekStart} onSave={onSave} />
      ))}
    </div>
  );
}

function KpiCard({
  kpi,
  entries,
  weekStart,
  onSave,
}: {
  kpi: KpiDef;
  entries: KpiEntry[];
  weekStart: Date;
  onSave: (kpi: KpiDef, dateStr: string, value: number, note?: string) => Promise<void>;
}) {
  const myEntries = entries.filter(e => e.kpi_id === kpi.id);
  const total = myEntries.reduce((s, e) => s + Number(e.value), 0);
  const pct = Math.min(100, Math.round((total / kpi.target_value) * 100));
  const reached = total >= kpi.target_value;

  // For weekly: single input for the week (date = weekStart)
  // For daily: input per day
  if (kpi.cadence === "weekly") {
    const weekStr = format(weekStart, "yyyy-MM-dd");
    const existing = myEntries.find(e => e.date === weekStr);
    const [val, setVal] = useState<string>(existing ? String(existing.value) : "");
    const [note, setNote] = useState<string>(existing?.note ?? "");

    return (
      <div className="rounded-xl border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{kpi.emoji}</span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{kpi.name}</div>
              <div className="text-xs text-muted-foreground">Ziel: {kpi.target_value}{kpi.unit ? ` ${kpi.unit}` : ""} / Woche</div>
            </div>
          </div>
          {reached && <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0">✓</Badge>}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className={cn("font-bold tabular-nums", reached ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
              {total}
            </span>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Wert"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="h-9"
          />
          <Button
            size="sm"
            onClick={async () => {
              const n = parseFloat(val);
              if (isNaN(n) || n < 0) { toast.error("Ungültiger Wert"); return; }
              await onSave(kpi, weekStr, n, note);
              toast.success("Gespeichert");
            }}
          >
            Speichern
          </Button>
        </div>
        <Textarea
          placeholder="Notiz (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />
      </div>
    );
  }

  // Daily KPI: 7 inputs
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm sm:col-span-2 lg:col-span-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{kpi.emoji}</span>
          <div className="min-w-0">
            <div className="font-semibold truncate">{kpi.name}</div>
            <div className="text-xs text-muted-foreground">Ziel: {kpi.target_value}{kpi.unit ? ` ${kpi.unit}` : ""} / Tag</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Woche gesamt</div>
          <div className="font-bold tabular-nums">{total} / {(kpi.target_value * 7).toFixed(0)}</div>
        </div>
      </div>

      <Progress value={Math.min(100, Math.round((total / (kpi.target_value * 7)) * 100))} className="h-2" />

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const dStr = format(d, "yyyy-MM-dd");
          const e = myEntries.find(en => en.date === dStr);
          return (
            <DailyCell
              key={dStr}
              date={d}
              kpi={kpi}
              existing={e}
              onSave={onSave}
            />
          );
        })}
      </div>
    </div>
  );
}

function DailyCell({
  date,
  kpi,
  existing,
  onSave,
}: {
  date: Date;
  kpi: KpiDef;
  existing?: KpiEntry;
  onSave: (kpi: KpiDef, dateStr: string, value: number, note?: string) => Promise<void>;
}) {
  const [val, setVal] = useState<string>(existing ? String(existing.value) : "");
  const dStr = format(date, "yyyy-MM-dd");
  const isToday = dStr === format(startOfDay(new Date()), "yyyy-MM-dd");
  const reached = existing && Number(existing.value) >= kpi.target_value;

  return (
    <div className={cn(
      "rounded-md border p-2 space-y-1",
      isToday && "ring-1 ring-primary/40",
      reached && "bg-emerald-500/5 border-emerald-500/30"
    )}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
        {format(date, "EE", { locale: de })}
      </div>
      <Input
        type="number"
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={async () => {
          if (val === "" && !existing) return;
          if (val === String(existing?.value ?? "")) return;
          const n = parseFloat(val || "0");
          if (isNaN(n) || n < 0) { toast.error("Ungültig"); return; }
          await onSave(kpi, dStr, n);
        }}
        className="h-8 text-center text-sm tabular-nums px-1"
        placeholder="–"
      />
    </div>
  );
}

// ============================================================
// ADMIN VIEW: Grid of all employees with their KPIs
// ============================================================
function AdminGrid({
  kpis,
  entries,
  profiles,
  focusUser,
  weekStart,
  onSave,
}: {
  kpis: KpiDef[];
  entries: KpiEntry[];
  profiles: Profile[];
  focusUser: string;
  weekStart: Date;
  onSave: (kpi: KpiDef, dateStr: string, value: number, note?: string) => Promise<void>;
}) {
  const visibleUsers = focusUser === "__all__"
    ? profiles.filter(p => kpis.some(k => k.user_id === p.user_id))
    : profiles.filter(p => p.user_id === focusUser);

  if (visibleUsers.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Noch keine KPIs definiert. Klick auf <span className="font-medium">„KPIs verwalten"</span>, um anzulegen.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleUsers.map(p => {
        const userKpis = kpis.filter(k => k.user_id === p.user_id);
        if (userKpis.length === 0) return null;
        return (
          <div key={p.user_id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{p.name}</h3>
              <span className="text-xs text-muted-foreground">{userKpis.length} KPI{userKpis.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userKpis.map(k => (
                <KpiCard key={k.id} kpi={k} entries={entries} weekStart={weekStart} onSave={onSave} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// MANAGE DIALOG (admin only)
// ============================================================
function ManageDialog({
  open,
  onOpenChange,
  profiles,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Profile[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: allKpis = [], refetch } = useQuery({
    queryKey: ["kpi-defs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*")
        .order("user_id")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as KpiDef[];
    },
    enabled: open,
  });

  const [editing, setEditing] = useState<Partial<KpiDef> | null>(null);

  function newKpi() {
    setEditing({
      user_id: profiles[0]?.user_id || "",
      name: "",
      emoji: "📊",
      target_value: 1,
      unit: "",
      cadence: "weekly",
      is_active: true,
      sort_order: 0,
    });
  }

  async function saveKpi() {
    if (!editing) return;
    if (!editing.name?.trim()) { toast.error("Name fehlt"); return; }
    if (!editing.user_id) { toast.error("Mitarbeiter wählen"); return; }
    if (!editing.target_value || editing.target_value <= 0) { toast.error("Zielwert muss > 0 sein"); return; }

    if (editing.id) {
      const { error } = await supabase
        .from("kpi_definitions")
        .update({
          name: editing.name,
          emoji: editing.emoji,
          target_value: editing.target_value,
          unit: editing.unit ?? "",
          cadence: editing.cadence,
          is_active: editing.is_active,
          user_id: editing.user_id,
        })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("kpi_definitions").insert({
        user_id: editing.user_id!,
        name: editing.name!,
        emoji: editing.emoji || "📊",
        target_value: editing.target_value!,
        unit: editing.unit ?? "",
        cadence: editing.cadence || "weekly",
        is_active: editing.is_active ?? true,
        sort_order: allKpis.filter(k => k.user_id === editing.user_id).length,
        created_by: user!.id,
      });
      if (error) { toast.error(error.message); return; }
    }
    setEditing(null);
    refetch();
    onChanged();
    toast.success("Gespeichert");
  }

  async function deleteKpi(id: string) {
    if (!confirm("KPI wirklich löschen? Alle Einträge dazu werden mit gelöscht.")) return;
    const { error } = await supabase.from("kpi_definitions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
    onChanged();
    toast.success("Gelöscht");
  }

  async function toggleActive(k: KpiDef) {
    await supabase.from("kpi_definitions").update({ is_active: !k.is_active }).eq("id", k.id);
    refetch();
    onChanged();
  }

  // Group by user
  const grouped = profiles
    .map(p => ({ profile: p, items: allKpis.filter(k => k.user_id === p.user_id) }))
    .filter(g => g.items.length > 0 || true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KPIs verwalten</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex justify-end">
            <Button size="sm" onClick={newKpi}>
              <Plus className="h-4 w-4 mr-2" /> Neuer KPI
            </Button>
          </div>

          {grouped.map(({ profile, items }) => (
            <div key={profile.user_id} className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground">{profile.name}</div>
              {items.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-3 py-2">Keine KPIs</div>
              ) : (
                <div className="space-y-1">
                  {items.map(k => (
                    <div key={k.id} className="flex items-center gap-2 rounded-md border bg-card p-2">
                      <span className="text-lg">{k.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", !k.is_active && "text-muted-foreground line-through")}>
                          {k.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Ziel: {k.target_value}{k.unit ? ` ${k.unit}` : ""} / {k.cadence === "daily" ? "Tag" : "Woche"}
                        </div>
                      </div>
                      <Switch checked={k.is_active} onCheckedChange={() => toggleActive(k)} />
                      <Button size="icon" variant="ghost" onClick={() => setEditing(k)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteKpi(k.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Edit/Create sheet inline */}
        {editing && (
          <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing.id ? "KPI bearbeiten" : "Neuer KPI"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Mitarbeiter</Label>
                  <Select value={editing.user_id} onValueChange={(v) => setEditing({ ...editing, user_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editing.name || ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="z.B. Reels geschnitten"
                  />
                </div>
                <div>
                  <Label>Emoji</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {EMOJI_PRESETS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setEditing({ ...editing, emoji: em })}
                        className={cn(
                          "h-9 w-9 rounded-md border text-lg hover:bg-accent transition-colors",
                          editing.emoji === em && "ring-2 ring-primary border-primary"
                        )}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Zielwert</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editing.target_value ?? ""}
                      onChange={(e) => setEditing({ ...editing, target_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Einheit (optional)</Label>
                    <Input
                      value={editing.unit ?? ""}
                      onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                      placeholder="Stück"
                    />
                  </div>
                </div>
                <div>
                  <Label>Kadenz</Label>
                  <Select value={editing.cadence} onValueChange={(v) => setEditing({ ...editing, cadence: v as "daily" | "weekly" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Pro Woche</SelectItem>
                      <SelectItem value="daily">Pro Tag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Aktiv</Label>
                  <Switch
                    checked={editing.is_active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
                <Button onClick={saveKpi}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
