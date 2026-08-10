import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  name: string;
  weekly_target_hours?: number | null;
}

/** Admin-Einstellung: Wochen-Soll-Stunden pro Teammitglied. */
export default function TargetHoursSettings({ profiles }: { profiles: Profile[] }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(profiles.map(p => [p.user_id, String(p.weekly_target_hours ?? 40)])));
  }, [profiles]);

  const save = async () => {
    setSaving(true);
    const updates = profiles.filter(p => {
      const v = parseFloat(values[p.user_id]);
      return !isNaN(v) && v !== Number(p.weekly_target_hours ?? 40);
    });
    for (const p of updates) {
      const { error } = await supabase
        .from("profiles")
        .update({ weekly_target_hours: parseFloat(values[p.user_id]) } as any)
        .eq("user_id", p.user_id);
      if (error) {
        setSaving(false);
        toast.error("Speichern fehlgeschlagen");
        return;
      }
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
    toast.success("Soll-Stunden gespeichert");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" /> Soll-Stunden
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="text-xs font-semibold mb-3">Wochen-Soll pro Mitarbeiter</p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {profiles.map(p => (
            <div key={p.user_id} className="flex items-center justify-between gap-2">
              <span className="text-sm truncate">{p.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="80"
                  className="h-8 w-20 text-xs"
                  value={values[p.user_id] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [p.user_id]: e.target.value }))}
                />
                <span className="text-xs text-muted-foreground">h</span>
              </div>
            </div>
          ))}
        </div>
        <Button size="sm" className="w-full mt-3" onClick={save} disabled={saving}>
          {saving ? "Speichert…" : "Speichern"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
