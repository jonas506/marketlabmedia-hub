import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, ListChecks } from "lucide-react";
import { motion } from "framer-motion";

interface MonthlyChecklistProps {
  clientId: string;
  month: number;
  year: number;
  canEdit: boolean;
}

const getWeeksInMonth = (month: number, year: number) => {
  const weeks: { week: number; year: number }[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
    const wk = Math.ceil((days + jan1.getDay() + 1) / 7);
    const key = `${wk}-${d.getFullYear()}`;
    if (!weeks.find((w) => `${w.week}-${w.year}` === key)) {
      weeks.push({ week: wk, year: d.getFullYear() });
    }
    d.setDate(d.getDate() + 1);
  }
  return weeks;
};

const MonthlyChecklist: React.FC<MonthlyChecklistProps> = ({ clientId, month, year, canEdit }) => {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const weeks = useMemo(() => getWeeksInMonth(month, year), [month, year]);
  const weekNumbers = weeks.map((w) => w.week);

  const { data: items } = useQuery({
    queryKey: ["checklist", clientId, month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("client_id", clientId)
        .in("week_number", weekNumbers)
        .eq("year", year);
      if (error) throw error;
      return data;
    },
    enabled: weekNumbers.length > 0,
  });

  const totalCount = items?.length ?? 0;
  const completedCount = items?.filter((i) => i.is_completed).length ?? 0;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-all duration-300 text-left group">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="font-display text-sm font-semibold tracking-tight">Wochen-Checkliste</h3>
          <div className="flex-1" />
          {totalCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-runway-green"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
            </div>
          )}
          <div className={`flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 text-muted-foreground transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-2 rounded-xl border border-border bg-card p-6 space-y-6"
        >
          {weeks.map((w) => (
            <WeekSection key={`${w.week}-${w.year}`} clientId={clientId} week={w.week} year={w.year}
              items={items?.filter((i) => i.week_number === w.week && i.year === w.year) ?? []}
              canEdit={canEdit} queryKey={["checklist", clientId, month, year]} />
          ))}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const WeekSection: React.FC<{
  clientId: string; week: number; year: number; items: any[]; canEdit: boolean; queryKey: any[];
}> = ({ clientId, week, year, items, canEdit, queryKey }) => {
  const [newLabel, setNewLabel] = useState("");
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checklist_items").insert({
        client_id: clientId, week_number: week, year, label: newLabel,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); setNewLabel(""); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await supabase.from("checklist_items").update({ is_completed: completed }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const completed = items.filter((i) => i.is_completed).length;
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-xs font-semibold text-foreground bg-muted/50 px-2.5 py-1 rounded-md">KW {week}</span>
        {items.length > 0 && (
          <span className={`font-mono text-xs ${pct === 100 ? 'text-runway-green' : 'text-muted-foreground'}`}>
            {pct === 100 ? '✓ Fertig' : `${pct}%`}
          </span>
        )}
      </div>
      <div className="space-y-2 mb-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 cursor-pointer group rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
            <Checkbox checked={item.is_completed} disabled={!canEdit}
              onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, completed: !!v })} />
            <span className={`text-sm font-body transition-all ${item.is_completed ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
      {canEdit && (
        <div className="flex gap-2 pl-3">
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Neuer Eintrag..."
            className="h-9 text-sm flex-1 bg-muted/20 border-0" onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) addMutation.mutate(); }} />
          <Button size="sm" variant="ghost" className="h-9 px-3 hover:bg-primary/10 hover:text-primary" onClick={() => newLabel.trim() && addMutation.mutate()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MonthlyChecklist;
