import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { Plus, Check, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ShootDay {
  id: string;
  client_id: string;
  date: string;
  notes: string | null;
  clip_count: number;
  status: string;
}

interface ShootDaySectionProps {
  clientId: string;
  shootDays: ShootDay[];
  canEdit: boolean;
}

const ShootDaySection: React.FC<ShootDaySectionProps> = ({ clientId, shootDays, canEdit }) => {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [clipCount, setClipCount] = useState("");

  const today = new Date();
  const lastCompleted = shootDays.find((s) => s.status === "completed");
  const nextPlanned = [...shootDays]
    .filter((s) => s.status === "planned" && new Date(s.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const daysSinceLast = lastCompleted
    ? differenceInDays(today, new Date(lastCompleted.date))
    : null;

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
      setShowNew(false);
      setNewDate("");
      setNewNotes("");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const count = parseInt(clipCount);
      if (!completingId || isNaN(count) || count < 0) return;

      // Update shoot day
      await supabase.from("shoot_days").update({
        status: "completed",
        clip_count: count,
      }).eq("id", completingId);

      // Batch create clips
      if (count > 0) {
        const clips = Array.from({ length: count }, () => ({
          client_id: clientId,
          shoot_day_id: completingId,
          phase: "raw",
        }));
        await supabase.from("clips").insert(clips);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shoot-days", clientId] });
      qc.invalidateQueries({ queryKey: ["clips", clientId] });
      setCompletingId(null);
      setClipCount("");
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground">DREHTAGE</h2>
        {canEdit && (
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1 font-mono text-xs">
            <Plus className="h-3 w-3" />
            NEUER DREHTAG
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-6">
        <div>
          <span className="font-mono text-2xl font-bold">{daysSinceLast ?? "–"}</span>
          <p className="font-body text-xs text-muted-foreground">Tage seit letztem Dreh</p>
        </div>
        <div>
          <span className="font-mono text-2xl font-bold">
            {nextPlanned ? format(new Date(nextPlanned.date), "dd.MM.", { locale: de }) : "–"}
          </span>
          <p className="font-body text-xs text-muted-foreground">Nächster Drehtag</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {shootDays.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">0 DREHTAGE</p>
        ) : (
          shootDays.map((day) => (
            <div
              key={day.id}
              className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">
                  {format(new Date(day.date), "dd.MM.yyyy", { locale: de })}
                </span>
                {day.notes && (
                  <span className="font-body text-sm text-muted-foreground">{day.notes}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {day.status === "completed" ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {day.clip_count} CLIPS
                  </span>
                ) : (
                  canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCompletingId(day.id)}
                      className="gap-1 font-mono text-xs"
                    >
                      <Check className="h-3 w-3" />
                      ABGESCHLOSSEN
                    </Button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New shoot day dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-mono">NEUEN DREHTAG PLANEN</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-xs text-muted-foreground">Datum</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-background border-border font-mono"
              />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Notizen (optional)</label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="bg-background border-border font-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={!newDate} className="font-mono text-xs">
              DREHTAG PLANEN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete shoot day dialog */}
      <Dialog open={!!completingId} onOpenChange={() => setCompletingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-mono">DREHTAG ABSCHLIESSEN</DialogTitle>
          </DialogHeader>
          <div>
            <label className="font-body text-xs text-muted-foreground">Anzahl Clips</label>
            <Input
              type="number"
              value={clipCount}
              onChange={(e) => setClipCount(e.target.value)}
              placeholder="0"
              className="bg-background border-border font-mono text-2xl text-center py-6"
              min="0"
            />
            {clipCount && parseInt(clipCount) > 0 && (
              <p className="mt-3 font-mono text-xs text-muted-foreground text-center">
                {clipCount} Clips werden als 'Roh' angelegt.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={!clipCount || parseInt(clipCount) < 0}
              className="font-mono text-xs"
            >
              ABSCHLIESSEN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ShootDaySection;
