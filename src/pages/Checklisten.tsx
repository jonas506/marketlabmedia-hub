import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { getISOWeek, getYear } from "date-fns";

const Checklisten = () => {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canEdit = role === "admin" || role === "head_of_content";

  const now = new Date();
  const [week, setWeek] = useState(getISOWeek(now));
  const [year, setYear] = useState(getYear(now));
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active");
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["checklist", selectedClient, week, year],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("client_id", selectedClient)
        .eq("week_number", week)
        .eq("year", year);
      return data ?? [];
    },
    enabled: !!selectedClient,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient || !newLabel.trim()) return;
      await supabase.from("checklist_items").insert({
        client_id: selectedClient,
        week_number: week,
        year: year,
        label: newLabel.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", selectedClient, week, year] });
      setNewLabel("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await supabase.from("checklist_items").update({ is_completed: completed }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", selectedClient, week, year] });
    },
  });

  const completedCount = items?.filter((i) => i.is_completed).length ?? 0;
  const totalCount = items?.length ?? 0;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Set first client as default
  if (clients?.length && !selectedClient) {
    setSelectedClient(clients[0].id);
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">CHECKLISTEN</h1>
        <p className="font-body text-sm text-muted-foreground">
          Wöchentliche Aufgaben pro Kunde.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-48 bg-card border-border font-body">
            <SelectValue placeholder="Kunde wählen" />
          </SelectTrigger>
          <SelectContent>
            {clients?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (week === 1) { setWeek(52); setYear(year - 1); }
              else setWeek(week - 1);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm">KW {week} / {year}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (week === 52) { setWeek(1); setYear(year + 1); }
              else setWeek(week + 1);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      {selectedClient && totalCount > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-muted-foreground">FORTSCHRITT</span>
            <span className="font-mono text-sm font-bold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Items */}
      {selectedClient && (
        <div className="space-y-2">
          {items?.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ id: item.id, completed: !!checked })
                }
                disabled={!canEdit}
              />
              <span className={`font-body text-sm ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                {item.label}
              </span>
            </div>
          ))}

          {/* Add new */}
          {canEdit && (
            <div className="flex gap-2 mt-4">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Neuer Eintrag..."
                className="bg-card border-border font-body"
                onKeyDown={(e) => e.key === "Enter" && addMutation.mutate()}
              />
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!newLabel.trim()}
                className="gap-1 font-mono text-xs"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Checklisten;
