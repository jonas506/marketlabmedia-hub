import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  const [reelCount, setReelCount] = useState(5);
  const [storyCount, setStoryCount] = useState(0);
  const [targetMonth, setTargetMonth] = useState(month);
  const [targetYear, setTargetYear] = useState(year);

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
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDay) return;
      const totalClips = reelCount + storyCount;
      await supabase.from("shoot_days").update({ status: "completed", clip_count: totalClips }).eq("id", selectedDay.id);
      
      const pieces: any[] = [];
      for (let i = 0; i < reelCount; i++) {
        pieces.push({
          client_id: clientId,
          shoot_day_id: selectedDay.id,
          type: "reel",
          phase: "filmed",
          target_month: targetMonth,
          target_year: targetYear,
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
        });
      }
      if (pieces.length > 0) {
        await supabase.from("content_pieces").insert(pieces);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shoot-days", clientId] });
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      setCompleteOpen(false);
      setSelectedDay(null);
    },
  });

  const openComplete = (day: ShootDay) => {
    setSelectedDay(day);
    setReelCount(5);
    setStoryCount(0);
    setTargetMonth(month);
    setTargetYear(year);
    setCompleteOpen(true);
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 + i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: format(d, "MMMM yyyy", { locale: de }) };
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">DREHTAGE</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)} className="gap-1 text-xs h-7">
            <Plus className="h-3 w-3" /> Planen
          </Button>
        )}
      </div>

      {monthDays.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body">Keine Drehtage in diesem Monat.</p>
      ) : (
        <div className="space-y-2">
          {monthDays.map((day) => (
            <div key={day.id} className="flex items-center gap-3 rounded border border-border p-3">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm">{format(new Date(day.date), "dd. MMMM yyyy", { locale: de })}</span>
                {day.notes && <p className="text-xs text-muted-foreground font-body truncate">{day.notes}</p>}
              </div>
              {day.status === "completed" ? (
                <span className="flex items-center gap-1 text-xs font-mono text-runway-green">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {day.clip_count} CLIPS
                </span>
              ) : canEdit ? (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openComplete(day)}>
                  Abschließen
                </Button>
              ) : (
                <span className="font-mono text-xs text-muted-foreground">GEPLANT</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Drehtag planen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Datum</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Notizen</label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Location, Themen, etc." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={!newDate || createMutation.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Drehtag abschließen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Reels entstanden</label>
              <Input type="number" min={0} value={reelCount} onChange={(e) => setReelCount(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Stories entstanden</label>
              <Input type="number" min={0} value={storyCount} onChange={(e) => setStoryCount(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Zielmonat</label>
              <Select value={`${targetMonth}-${targetYear}`} onValueChange={(v) => {
                const [m, y] = v.split("-").map(Number);
                setTargetMonth(m);
                setTargetYear(y);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              Abschließen & {reelCount + storyCount} Pieces anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyShootDays;
