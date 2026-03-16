import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Plus, CheckCircle2, Clapperboard, FileText } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";

interface ShootDay {
  id: string;
  client_id: string;
  date: string;
  notes: string | null;
  clip_count: number;
  status: string;
}

interface MonthlyShootDaysProps {
  clientId: string;
  shootDays: ShootDay[];
  month: number;
  year: number;
  canEdit: boolean;
}

const MonthlyShootDays: React.FC<MonthlyShootDaysProps> = ({ clientId, shootDays, month, year, canEdit }) => {
  const qc = useQueryClient();
  const [planOpen, setPlanOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<ShootDay | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [reelCount, setReelCount] = useState(0);
  const [storyCount, setStoryCount] = useState(0);
  const [targetMonth, setTargetMonth] = useState(month);
  const [targetYear, setTargetYear] = useState(year);
  const [selectedScriptedIds, setSelectedScriptedIds] = useState<Set<string>>(new Set());

  // Fetch scripted reels (phase = "script") for this client
  const { data: scriptedReels = [] } = useQuery({
    queryKey: ["scripted-reels", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_pieces")
        .select("id, title, type, phase, target_month, target_year, has_script, script_text")
        .eq("client_id", clientId)
        .eq("type", "reel")
        .eq("phase", "script")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const monthDays = shootDays.filter((d) => {
    const dt = new Date(d.date);
    return dt.getMonth() + 1 === month && dt.getFullYear() === year;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shoot_days").insert({
        client_id: clientId,
        date: newDate,
        notes: newNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shoot-days", clientId] });
      setPlanOpen(false);
      setNewDate("");
      setNewNotes("");
      toast.success("📅 Drehtag geplant!", { description: `Am ${format(new Date(newDate), "dd. MMMM yyyy", { locale: de })}` });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDay) return;

      // 1. Move selected scripted reels to "filmed" and link to this shoot day
      const scriptedIds = Array.from(selectedScriptedIds);
      if (scriptedIds.length > 0) {
        await supabase
          .from("content_pieces")
          .update({
            phase: "filmed",
            shoot_day_id: selectedDay.id,
            target_month: targetMonth,
            target_year: targetYear,
          })
          .in("id", scriptedIds);
      }

      // 2. Create additional new reels (beyond scripted ones)
      const pieces: any[] = [];
      for (let i = 0; i < reelCount; i++) {
        pieces.push({
          client_id: clientId,
          shoot_day_id: selectedDay.id,
          type: "reel",
          phase: "filmed",
          target_month: targetMonth,
          target_year: targetYear,
          title: `Reel ${i + 1}`,
        });
      }
      for (let i = 0; i < storyCount; i++) {
        pieces.push({
          client_id: clientId,
          shoot_day_id: selectedDay.id,
          type: "story",
          phase: "filmed",
          target_month: targetMonth,
          target_year: targetYear,
          title: `Story ${i + 1}`,
        });
      }
      if (pieces.length > 0) {
        await supabase.from("content_pieces").insert(pieces);
      }

      const totalClips = scriptedIds.length + reelCount + storyCount;
      await supabase.from("shoot_days").update({ status: "completed", clip_count: totalClips }).eq("id", selectedDay.id);
      return totalClips;
    },
    onSuccess: (totalClips) => {
      qc.invalidateQueries({ queryKey: ["shoot-days", clientId] });
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      qc.invalidateQueries({ queryKey: ["scripted-reels", clientId] });
      setCompleteOpen(false);
      setSelectedDay(null);
      setSelectedScriptedIds(new Set());
      
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#0083F7", "#21089B", "#FAFBFF", "#10B981", "#F59E0B"],
      });
      toast.success(`🎬 Drehtag abgeschlossen!`, {
        description: `${totalClips} Clips wurden als "Gedreht" in die Pipeline gelegt`,
        duration: 5000,
      });
    },
  });

  const openComplete = (day: ShootDay) => {
    setSelectedDay(day);
    setReelCount(0);
    setStoryCount(0);
    setTargetMonth(month);
    setTargetYear(year);
    setSelectedScriptedIds(new Set());
    setCompleteOpen(true);
  };

  const toggleScripted = (id: string) => {
    setSelectedScriptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllScripted = () => {
    if (selectedScriptedIds.size === scriptedReels.length) {
      setSelectedScriptedIds(new Set());
    } else {
      setSelectedScriptedIds(new Set(scriptedReels.map((r: any) => r.id)));
    }
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, "MMMM yyyy", { locale: de }) };
  });

  const totalClips = selectedScriptedIds.size + reelCount + storyCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-lg"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">DREHTAGE</h3>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setPlanOpen(true)} className="gap-2 text-sm">
            <Plus className="h-4 w-4" /> Drehtag planen
          </Button>
        )}
      </div>

      {monthDays.length === 0 ? (
        <div className="py-8 text-center">
          <span className="text-3xl block mb-2">📹</span>
          <p className="text-sm text-muted-foreground font-body">Noch keine Drehtage in diesem Monat</p>
          {canEdit && (
            <Button variant="ghost" className="mt-2 text-primary gap-1.5" onClick={() => setPlanOpen(true)}>
              <Plus className="h-4 w-4" /> Ersten Drehtag planen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {monthDays.map((day, i) => (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                className={`flex items-center gap-4 rounded-lg border p-4 transition-all ${
                  day.status === "completed"
                    ? "border-[hsl(var(--runway-green))]/20 bg-[hsl(var(--runway-green))]/5"
                    : "border-border hover:border-primary/20"
                }`}
              >
                <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${
                  day.status === "completed" ? "bg-[hsl(var(--runway-green))]/10" : "bg-muted"
                }`}>
                  <Calendar className={`h-5 w-5 ${day.status === "completed" ? "text-[hsl(var(--runway-green))]" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm font-medium">{format(new Date(day.date), "dd. MMMM yyyy", { locale: de })}</span>
                  {day.notes && <p className="text-xs text-muted-foreground font-body truncate mt-0.5">{day.notes}</p>}
                </div>
                {day.status === "completed" ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 rounded-lg bg-[hsl(var(--runway-green))]/10 px-3 py-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--runway-green))]" />
                    <span className="text-sm font-mono font-bold text-[hsl(var(--runway-green))]">{day.clip_count} Clips</span>
                  </motion.div>
                ) : canEdit ? (
                  <Button variant="outline" className="text-sm gap-1.5" onClick={() => openComplete(day)}>
                    <CheckCircle2 className="h-4 w-4" /> Abschließen
                  </Button>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded">GEPLANT</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>📅 Drehtag planen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground font-body mb-1.5 block">Datum</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-body mb-1.5 block">Notizen</label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Location, Themen, etc." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={!newDate || createMutation.isPending} className="gap-2">
              <Calendar className="h-4 w-4" /> Drehtag planen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🎬 Drehtag abschließen</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {/* Scripted Reels Section */}
            {scriptedReels.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Geskriptete Reels</span>
                    <span className="text-xs text-muted-foreground">({scriptedReels.length} verfügbar)</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllScripted}>
                    {selectedScriptedIds.size === scriptedReels.length ? "Keine" : "Alle"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bereits geskriptete Reels werden beim Abschließen automatisch auf „Gedreht" verschoben.
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {scriptedReels.map((reel: any) => (
                    <label
                      key={reel.id}
                      className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer transition-all ${
                        selectedScriptedIds.has(reel.id)
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <Checkbox
                        checked={selectedScriptedIds.has(reel.id)}
                        onCheckedChange={() => toggleScripted(reel.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{reel.title || "Ohne Titel"}</span>
                        {reel.script_text && (
                          <span className="text-xs text-muted-foreground truncate block">{reel.script_text.slice(0, 60)}{"…"}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Additional new clips */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {scriptedReels.length > 0
                  ? "Zusätzliche neue Clips ohne Skript erstellen:"
                  : 'Wie viele Clips sind beim Dreh entstanden? Die Clips werden direkt als \u201EGedreht\u201C in die Pipeline gelegt.'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 text-center">
                  <span className="text-2xl block mb-2">🎬</span>
                  <label className="text-sm text-muted-foreground font-body mb-2 block">
                    {scriptedReels.length > 0 ? "Neue Reels" : "Reels"}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={reelCount}
                    onChange={(e) => setReelCount(Number(e.target.value))}
                    className="h-12 text-center text-xl font-mono font-bold"
                  />
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <span className="text-2xl block mb-2">📱</span>
                  <label className="text-sm text-muted-foreground font-body mb-2 block">Stories</label>
                  <Input
                    type="number"
                    min={0}
                    value={storyCount}
                    onChange={(e) => setStoryCount(Number(e.target.value))}
                    className="h-12 text-center text-xl font-mono font-bold"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground font-body mb-1.5 block">Zielmonat</label>
              <Select value={`${targetMonth}-${targetYear}`} onValueChange={(v) => {
                const [m, y] = v.split("-").map(Number);
                setTargetMonth(m);
                setTargetYear(y);
              }}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {totalClips > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center"
              >
                <span className="font-mono text-lg font-bold text-primary">{totalClips} Clips</span>
                <span className="text-sm text-muted-foreground ml-2">werden in „Gedreht" angelegt</span>
                {selectedScriptedIds.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    davon {selectedScriptedIds.size} geskriptet
                  </p>
                )}
              </motion.div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending || totalClips === 0}
              className="gap-2 bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] shadow-lg shadow-primary/20"
            >
              🚀 Abschließen & {totalClips} Pieces anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MonthlyShootDays;
