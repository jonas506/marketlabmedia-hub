import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClients } from "@/hooks/useClients";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Calendar, Filter } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const Checklists = () => {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "head_of_content";
  const qc = useQueryClient();

  const now = new Date();
  const [selectedWeek, setSelectedWeek] = useState(getWeekNumber(now));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: clients } = useClients();

  const { data: items, isLoading } = useQuery({
    queryKey: ["checklist-items", selectedWeek, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("week_number", selectedWeek)
        .eq("year", selectedYear)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (clientFilter === "all") return items;
    return items.filter((i) => i.client_id === clientFilter);
  }, [items, clientFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const list = map.get(item.client_id) || [];
      list.push(item);
      map.set(item.client_id, list);
    }
    return map;
  }, [filteredItems]);

  const getClientName = (id: string) =>
    clients?.find((c) => c.id === id)?.name ?? "Unbekannt";

  const toggleItem = async (id: string, current: boolean) => {
    await supabase.from("checklist_items").update({ is_completed: !current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["checklist-items", selectedWeek, selectedYear] });
  };

  // Generate week options (current ±4 weeks)
  const weekOptions = Array.from({ length: 9 }, (_, i) => {
    const w = getWeekNumber(now) - 4 + i;
    const y = w <= 0 ? selectedYear - 1 : w > 52 ? selectedYear + 1 : selectedYear;
    const adjustedW = w <= 0 ? 52 + w : w > 52 ? w - 52 : w;
    return { week: adjustedW, year: y, label: `KW ${adjustedW} · ${y}` };
  });

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/15">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Checklisten</h1>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Wöchentliche Aufgaben pro Kunde
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Week selector */}
            <Select
              value={`${selectedWeek}-${selectedYear}`}
              onValueChange={(v) => {
                const [w, y] = v.split("-").map(Number);
                setSelectedWeek(w);
                setSelectedYear(y);
              }}
            >
              <SelectTrigger className="w-[160px] bg-card border-border font-body text-sm">
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((o) => (
                  <SelectItem key={`${o.week}-${o.year}`} value={`${o.week}-${o.year}`}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Client filter */}
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px] bg-card border-border font-body text-sm">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Alle Kunden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kunden</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-card border border-border" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card">
            <p className="text-sm text-muted-foreground font-body">
              Keine Checklisten-Items für KW {selectedWeek}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([clientId, clientItems], gi) => (
              <motion.div
                key={clientId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.05, duration: 0.25 }}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                {/* Group header */}
                <div className="monday-group-header flex items-center gap-2 px-4 py-2.5 bg-primary/10 border-b border-border">
                  <div className="w-1 h-5 rounded-full bg-primary" />
                  <span className="font-display font-bold text-sm text-foreground">
                    {getClientName(clientId)}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {clientItems.filter((i) => i.is_completed).length}/{clientItems.length}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-border">
                  {clientItems.map((item) => (
                    <div
                      key={item.id}
                      className="monday-row flex items-center gap-3 px-4 py-2.5 hover:bg-surface-elevated/50 transition-colors"
                    >
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={() => canEdit && toggleItem(item.id, item.is_completed)}
                        disabled={!canEdit}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span
                        className={cn(
                          "font-body text-sm flex-1 transition-all truncate",
                          item.is_completed
                            ? "line-through text-muted-foreground/50"
                            : "text-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default Checklists;
