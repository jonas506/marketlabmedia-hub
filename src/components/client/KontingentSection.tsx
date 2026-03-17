import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

interface KontingentSectionProps {
  client: {
    id: string;
    monthly_reels: number;
    monthly_carousels: number;
    monthly_stories: number;
  };
  clips: Array<{ phase: string; type: string | null; updated_at: string }>;
  canEdit: boolean;
}

const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const KontingentSection: React.FC<KontingentSectionProps> = ({ client, clips, canEdit }) => {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    monthly_reels: client.monthly_reels,
    monthly_carousels: client.monthly_carousels,
    monthly_stories: client.monthly_stories,
  });
  const qc = useQueryClient();
  const firstOfMonth = getFirstDayOfMonth();
  const postedThisMonth = clips.filter((c) => c.phase === "posted" && c.updated_at >= firstOfMonth);

  const types = [
    { key: "monthly_reels" as const, label: "Reels", type: "reel" },
    { key: "monthly_carousels" as const, label: "Karussell", type: "carousel" },
    { key: "monthly_stories" as const, label: "Story Ads", type: "story" },
  ];

  const save = async () => {
    await supabase.from("clients").update(values).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
    setEditing(false);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground">KONTINGENT</h2>
        {canEdit && !editing && (
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={save}><Check className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {types.map(({ key, label, type }) => {
          const target = client[key];
          const posted = postedThisMonth.filter((c) => c.type === type).length;
          const pct = target > 0 ? Math.min((posted / target) * 100, 100) : 0;

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm">{label}</span>
                {editing ? (
                  <Input
                    type="number"
                    value={values[key]}
                    onChange={(e) => setValues({ ...values, [key]: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-background border-border font-mono text-sm text-right"
                  />
                ) : (
                  <span className="font-mono text-sm">
                    {posted}
                    <span className="text-muted-foreground">/{target}</span>
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default KontingentSection;
