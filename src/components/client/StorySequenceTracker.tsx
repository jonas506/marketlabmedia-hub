import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ChevronLeft, ChevronRight, Edit2, Eye, MessageSquare, Zap, MousePointerClick, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

interface Props {
  clientId: string;
  canEdit: boolean;
}

const DAY_TYPES = [
  { value: "Value", color: "bg-blue-500/20 text-blue-400" },
  { value: "Education", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "Credibility", color: "bg-amber-500/20 text-amber-400" },
  { value: "Transformation", color: "bg-purple-500/20 text-purple-400" },
  { value: "BTS", color: "bg-pink-500/20 text-pink-400" },
  { value: "Social Proof", color: "bg-orange-500/20 text-orange-400" },
  { value: "Conversion", color: "bg-red-500/20 text-red-400" },
] as const;

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getDayTypeColor(type: string) {
  return DAY_TYPES.find((d) => d.value === type)?.color ?? "bg-muted text-muted-foreground";
}

interface StoryTrackingRow {
  id: string;
  client_id: string;
  tracking_date: string;
  day_type: string;
  stories_posted: number;
  story_views: number;
  story_replies: number;
  keyword_triggers_received: number;
  link_clicks: number;
  profile_visits_from_stories: number;
  notes: string | null;
}

interface SequenceDay {
  id: string;
  template_id: string;
  day_number: number;
  day_label: string;
  slides: { text: string; type: string }[];
  keyword_trigger: string | null;
}

interface SequenceTemplate {
  id: string;
  client_id: string;
  name: string;
  is_active: boolean;
}

const TRACKING_COLUMNS = [
  { key: "tracking_date", label: "Datum", type: "text", headerBg: "bg-slate-500/10 text-slate-300", cellBg: "bg-slate-500/[0.04]" },
  { key: "day_type", label: "Typ", type: "select", headerBg: "bg-violet-500/10 text-violet-300", cellBg: "bg-violet-500/[0.04]" },
  { key: "stories_posted", label: "Stories", type: "number", headerBg: "bg-blue-500/10 text-blue-300", cellBg: "bg-blue-500/[0.04]" },
  { key: "story_views", label: "Views", type: "number", headerBg: "bg-emerald-500/10 text-emerald-300", cellBg: "bg-emerald-500/[0.04]" },
  { key: "story_replies", label: "Replies", type: "number", headerBg: "bg-amber-500/10 text-amber-300", cellBg: "bg-amber-500/[0.04]" },
  { key: "keyword_triggers_received", label: "Triggers", type: "number", headerBg: "bg-pink-500/10 text-pink-300", cellBg: "bg-pink-500/[0.04]" },
  { key: "link_clicks", label: "Link Clicks", type: "number", headerBg: "bg-orange-500/10 text-orange-300", cellBg: "bg-orange-500/[0.04]" },
  { key: "profile_visits_from_stories", label: "Profilbesuche", type: "number", headerBg: "bg-purple-500/10 text-purple-300", cellBg: "bg-purple-500/[0.04]" },
  { key: "drop_off", label: "Drop-Off", type: "computed", headerBg: "bg-red-500/10 text-red-300", cellBg: "bg-red-500/[0.04]" },
] as const;

export default function StorySequenceTracker({ clientId, canEdit }: Props) {
  const qc = useQueryClient();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  // ── Tracking Data ──
  const { data: trackingRows = [] } = useQuery({
    queryKey: ["story-tracking", clientId, viewMonth.month, viewMonth.year],
    queryFn: async () => {
      const startDate = new Date(viewMonth.year, viewMonth.month, 1);
      const endDate = new Date(viewMonth.year, viewMonth.month + 1, 0);
      const { data, error } = await supabase
        .from("story_tracking")
        .select("*")
        .eq("client_id", clientId)
        .gte("tracking_date", format(startDate, "yyyy-MM-dd"))
        .lte("tracking_date", format(endDate, "yyyy-MM-dd"))
        .order("tracking_date", { ascending: true });
      if (error) throw error;
      return data as StoryTrackingRow[];
    },
  });

  // ── Templates ──
  const { data: templates = [] } = useQuery({
    queryKey: ["story-templates", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_sequence_templates")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SequenceTemplate[];
    },
  });

  const activeTemplate = templates.find((t) => t.is_active) ?? templates[0];

  const { data: days = [] } = useQuery({
    queryKey: ["story-template-days", activeTemplate?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_sequence_days")
        .select("*")
        .eq("template_id", activeTemplate!.id)
        .order("day_number", { ascending: true });
      if (error) throw error;
      return data as SequenceDay[];
    },
    enabled: !!activeTemplate,
  });

  // ── KPI Summary ──
  const summary = useMemo(() => {
    if (!trackingRows.length) return { avgViews: 0, avgReplies: 0, totalTriggers: 0, engagementRate: 0 };
    const totalViews = trackingRows.reduce((s, r) => s + Number(r.story_views || 0), 0);
    const totalReplies = trackingRows.reduce((s, r) => s + Number(r.story_replies || 0), 0);
    const totalTriggers = trackingRows.reduce((s, r) => s + Number(r.keyword_triggers_received || 0), 0);
    return {
      avgViews: Math.round(totalViews / trackingRows.length),
      avgReplies: Math.round(totalReplies / trackingRows.length),
      totalTriggers,
      engagementRate: totalViews > 0 ? ((totalReplies / totalViews) * 100) : 0,
    };
  }, [trackingRows]);

  // ── Mutations ──
  const addRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("story_tracking").insert({
        client_id: clientId,
        tracking_date: format(new Date(), "yyyy-MM-dd"),
        day_type: "Value",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["story-tracking", clientId] }); toast.success("Eintrag hinzugefügt"); },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Eintrag für heute existiert bereits" : "Fehler beim Hinzufügen"),
  });

  const updateCell = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: string; value: any }) => {
      const { error } = await supabase.from("story_tracking").update({ [key]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-tracking", clientId] }),
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("story_tracking").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["story-tracking", clientId] }); toast.success("Gelöscht"); },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const { data: tmpl, error: e1 } = await supabase
        .from("story_sequence_templates")
        .insert({ client_id: clientId, name: `Zyklus KW${getISOWeek(now)}` })
        .select()
        .single();
      if (e1) throw e1;
      const defaultDays = DAY_TYPES.map((dt, i) => ({
        template_id: tmpl.id,
        day_number: i + 1,
        day_label: dt.value,
        slides: [],
      }));
      const { error: e2 } = await supabase.from("story_sequence_days").insert(defaultDays);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story-templates", clientId] });
      toast.success("Neuer Zyklus erstellt");
    },
  });

  const handleBlur = useCallback((id: string, key: string, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val)) return;
    updateCell.mutate({ id, key, value: val });
  }, [updateCell]);

  const shiftMonth = (dir: number) => {
    setViewMonth((p) => {
      let m = p.month + dir;
      let y = p.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { month: m, year: y };
    });
  };

  const monthLabel = format(new Date(viewMonth.year, viewMonth.month), "MMMM yyyy", { locale: de });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Eye className="h-4 w-4 text-emerald-400" />} label="Ø Views/Tag" value={summary.avgViews.toLocaleString("de-DE")} />
        <KpiCard icon={<MessageSquare className="h-4 w-4 text-amber-400" />} label="Ø Replies/Tag" value={summary.avgReplies.toLocaleString("de-DE")} />
        <KpiCard icon={<Zap className="h-4 w-4 text-pink-400" />} label="Keyword-Triggers" value={summary.totalTriggers.toLocaleString("de-DE")} />
        <KpiCard icon={<Users className="h-4 w-4 text-blue-400" />} label="Engagement Rate" value={`${summary.engagementRate.toFixed(1)}%`} />
      </div>

      <Tabs defaultValue="plan" className="mt-2">
        <TabsList className="bg-card border border-border h-auto p-0.5">
          <TabsTrigger value="plan" className="text-xs h-8 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">Wochenplan</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs h-8 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">Tracking</TabsTrigger>
        </TabsList>

        {/* ── WOCHENPLAN ── */}
        <TabsContent value="plan" className="mt-4">
          <WeekPlan
            template={activeTemplate}
            days={days}
            canEdit={canEdit}
            onCreateTemplate={() => createTemplate.mutate()}
            clientId={clientId}
          />
        </TabsContent>

        {/* ── TRACKING ── */}
        <TabsContent value="tracking" className="mt-4">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-display font-semibold">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {TRACKING_COLUMNS.map((col) => (
                    <th key={col.key} className={cn("px-2 py-2 text-center font-medium whitespace-nowrap", col.headerBg)}>{col.label}</th>
                  ))}
                  {canEdit && <th className="px-2 py-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {trackingRows.map((row) => {
                  const dropOff = Number(row.story_views) > 0 ? (100 - ((Number(row.story_replies) / Number(row.story_views)) * 100)).toFixed(1) : "–";
                  return (
                    <tr key={row.id} className="border-t border-border/50 hover:bg-muted/30">
                      {TRACKING_COLUMNS.map((col) => (
                        <td key={col.key} className={cn("px-1 py-1 text-center", col.cellBg)}>
                          {col.key === "tracking_date" ? (
                            canEdit ? (
                              <Input
                                type="date"
                                defaultValue={row.tracking_date}
                                className="h-7 text-xs bg-transparent border-0 text-center font-mono w-[110px]"
                                onBlur={(e) => updateCell.mutate({ id: row.id, key: "tracking_date", value: e.target.value })}
                              />
                            ) : (
                              <span className="font-mono">{row.tracking_date}</span>
                            )
                          ) : col.key === "day_type" ? (
                            canEdit ? (
                              <Select value={row.day_type} onValueChange={(v) => updateCell.mutate({ id: row.id, key: "day_type", value: v })}>
                                <SelectTrigger className="h-7 text-xs bg-transparent border-0 w-[100px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {DAY_TYPES.map((dt) => <SelectItem key={dt.value} value={dt.value}>{dt.value}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={cn("text-xs px-1.5 py-0.5 rounded", getDayTypeColor(row.day_type))}>{row.day_type}</span>
                            )
                          ) : col.key === "drop_off" ? (
                            <span className="font-mono">{dropOff}{dropOff !== "–" ? "%" : ""}</span>
                          ) : (
                            canEdit ? (
                              <Input
                                type="number"
                                defaultValue={String((row as any)[col.key] ?? 0)}
                                className="h-7 text-xs bg-transparent border-0 text-center font-mono w-[70px]"
                                onBlur={(e) => handleBlur(row.id, col.key, e.target.value)}
                              />
                            ) : (
                              <span className="font-mono">{(row as any)[col.key] ?? 0}</span>
                            )
                          )}
                        </td>
                      ))}
                      {canEdit && (
                        <td className="px-1 py-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteRow.mutate(row.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <Button variant="outline" size="sm" className="mt-3 text-xs gap-1.5" onClick={() => addRow.mutate()}>
              <Plus className="h-3 w-3" /> Eintrag
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

// ── Sub-components ──

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-mono font-bold">{value}</p>
      </div>
    </div>
  );
}

function WeekPlan({
  template,
  days,
  canEdit,
  onCreateTemplate,
  clientId,
}: {
  template?: SequenceTemplate;
  days: SequenceDay[];
  canEdit: boolean;
  onCreateTemplate: () => void;
  clientId: string;
}) {
  const qc = useQueryClient();
  const [editDay, setEditDay] = useState<SequenceDay | null>(null);

  const updateDay = useMutation({
    mutationFn: async (updates: Partial<SequenceDay> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from("story_sequence_days").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story-template-days"] });
      toast.success("Gespeichert");
      setEditDay(null);
    },
  });

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm mb-4">Noch kein Story-Zyklus erstellt.</p>
        {canEdit && (
          <Button onClick={onCreateTemplate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neuen Zyklus erstellen
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-semibold">{template.name}</h3>
        {canEdit && (
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onCreateTemplate}>
            <Plus className="h-3 w-3" /> Neuer Zyklus
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, i) => {
          const day = days.find((d) => d.day_number === i + 1);
          const dayLabel = day?.day_label ?? DAY_TYPES[i]?.value ?? "Value";
          const slides = (day?.slides as any[]) ?? [];
          const trigger = day?.keyword_trigger;

          return (
            <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-2 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono">{DAY_NAMES[i]}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", getDayTypeColor(dayLabel))}>{dayLabel}</span>
                </div>
                {canEdit && day && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditDay(day)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="p-2 min-h-[60px] space-y-1">
                {slides.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Keine Slides</p>
                ) : (
                  slides.map((s: any, si: number) => (
                    <div key={si} className="text-[10px] text-foreground/80 bg-muted/50 rounded px-1.5 py-1 truncate">
                      {s.type === "poll" ? "📊 " : s.type === "cta" ? "🔗 " : s.type === "video" ? "🎬 " : "📝 "}
                      {s.text || "–"}
                    </div>
                  ))
                )}
              </div>
              {trigger && (
                <div className="px-2 py-1 border-t border-border/50">
                  <p className="text-[9px] text-muted-foreground">Trigger: <span className="font-mono text-pink-400">{trigger}</span></p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Day Dialog */}
      <EditDayDialog
        day={editDay}
        open={!!editDay}
        onClose={() => setEditDay(null)}
        onSave={(updates) => updateDay.mutate(updates)}
      />
    </>
  );
}

function EditDayDialog({
  day,
  open,
  onClose,
  onSave,
}: {
  day: SequenceDay | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<SequenceDay> & { id: string }) => void;
}) {
  const [dayLabel, setDayLabel] = useState(day?.day_label ?? "Value");
  const [slides, setSlides] = useState<{ text: string; type: string }[]>([]);
  const [trigger, setTrigger] = useState(day?.keyword_trigger ?? "");

  // Reset when day changes
  const currentDayId = day?.id;
  useState(() => {
    if (day) {
      setDayLabel(day.day_label);
      setSlides((day.slides as any[]) ?? []);
      setTrigger(day.keyword_trigger ?? "");
    }
  });

  // Sync state on open
  if (day && dayLabel !== day.day_label && slides.length === 0) {
    setDayLabel(day.day_label);
    setSlides((day.slides as any[]) ?? []);
    setTrigger(day.keyword_trigger ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm">Tag bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Day Type</label>
            <Select value={dayLabel} onValueChange={setDayLabel}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_TYPES.map((dt) => <SelectItem key={dt.value} value={dt.value}>{dt.value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Slides</label>
            <div className="space-y-2">
              {slides.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={s.type} onValueChange={(v) => {
                    const next = [...slides];
                    next[i] = { ...next[i], type: v };
                    setSlides(next);
                  }}>
                    <SelectTrigger className="h-7 text-xs w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="poll">Poll</SelectItem>
                      <SelectItem value="cta">CTA</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={s.text}
                    onChange={(e) => {
                      const next = [...slides];
                      next[i] = { ...next[i], text: e.target.value };
                      setSlides(next);
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="Slide-Inhalt..."
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSlides(slides.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setSlides([...slides, { text: "", type: "text" }])}>
                <Plus className="h-3 w-3" /> Slide
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Keyword-Trigger</label>
            <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} className="h-8 text-xs" placeholder="z.B. MARKETING" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button
            size="sm"
            onClick={() => {
              if (!day) return;
              onSave({ id: day.id, day_label: dayLabel, slides: slides as any, keyword_trigger: trigger || null });
            }}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
