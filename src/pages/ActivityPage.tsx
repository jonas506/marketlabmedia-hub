import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday, isYesterday, subDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowRight, UserPlus, Plus, CheckCircle2, Trash2,
  Calendar, AlertTriangle, RefreshCw, Clock, Filter, Activity
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ActivityEntry {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  client_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  summary: string;
  metadata: any;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-500",
  phase_changed: "bg-primary",
  assigned: "bg-amber-500",
  completed: "bg-status-done",
  deleted: "bg-destructive",
  deadline_changed: "bg-violet-500",
  priority_changed: "bg-orange-500",
  status_changed: "bg-status-working",
};

const ACTION_ICONS: Record<string, React.ComponentType<any>> = {
  phase_changed: ArrowRight,
  assigned: UserPlus,
  created: Plus,
  completed: CheckCircle2,
  deleted: Trash2,
  deadline_changed: Calendar,
  priority_changed: AlertTriangle,
  status_changed: RefreshCw,
};

const ActivityPage = () => {
  const [limit, setLimit] = useState(100);
  const [clientFilter, setClientFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("7d");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list-activity"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["global-activity", limit, clientFilter, actionFilter, timeFilter],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (clientFilter !== "all") query = query.eq("client_id", clientFilter);
      if (actionFilter === "phase") query = query.eq("action", "phase_changed");
      else if (actionFilter === "assigned") query = query.eq("action", "assigned");
      else if (actionFilter === "tasks") query = query.eq("entity_type", "task");
      else if (actionFilter === "created") query = query.eq("action", "created");
      else if (actionFilter === "deleted") query = query.eq("action", "deleted");

      if (timeFilter === "today") query = query.gte("created_at", new Date().toISOString().split("T")[0]);
      else if (timeFilter === "7d") query = query.gte("created_at", subDays(new Date(), 7).toISOString());
      else if (timeFilter === "30d") query = query.gte("created_at", subDays(new Date(), 30).toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActivityEntry[];
    },
  });

  const grouped = useMemo(() => {
    const groups: { label: string; entries: ActivityEntry[] }[] = [];
    let currentLabel = "";
    entries.forEach((entry) => {
      const date = new Date(entry.created_at);
      let label: string;
      if (isToday(date)) label = "Heute";
      else if (isYesterday(date)) label = "Gestern";
      else label = format(date, "EEEE, dd. MMMM yyyy", { locale: de });

      if (label !== currentLabel) {
        groups.push({ label, entries: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].entries.push(entry);
    });
    return groups;
  }, [entries]);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [clients]);

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <div className="mb-5">
          <h1 className="text-lg font-display font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Aktivität
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">Was im Team passiert ist</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kunden</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="Aktion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Aktionen</SelectItem>
              <SelectItem value="phase">Phase-Wechsel</SelectItem>
              <SelectItem value="assigned">Zuweisungen</SelectItem>
              <SelectItem value="tasks">Aufgaben</SelectItem>
              <SelectItem value="created">Erstellung</SelectItem>
              <SelectItem value="deleted">Löschung</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="Zeitraum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Heute</SelectItem>
              <SelectItem value="7d">Letzte 7 Tage</SelectItem>
              <SelectItem value="30d">Letzte 30 Tage</SelectItem>
              <SelectItem value="all">Alles</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-3 w-3 rounded-full animate-pulse bg-muted/40 mt-1" />
                <div className="flex-1 h-8 animate-pulse rounded bg-muted/30" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-12 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50 font-mono">Keine Aktivitäten im gewählten Zeitraum</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 space-y-5">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">{group.label}</p>
                <div className="border-l-2 border-border/50 ml-1.5 space-y-0">
                  {group.entries.map((entry, i) => {
                    const Icon = ACTION_ICONS[entry.action] || RefreshCw;
                    const dotColor = ACTION_COLORS[entry.action] || "bg-muted-foreground";

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.015 }}
                        className="flex items-start gap-3 pl-4 py-2 relative"
                      >
                        <div className={cn("absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-card", dotColor)} />
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body leading-snug">{entry.summary}</p>
                          {entry.old_value && entry.new_value && entry.field_name && !["assigned_to"].includes(entry.field_name) && (
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono">
                              <span className="line-through text-muted-foreground">{entry.old_value}</span>
                              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="font-semibold text-foreground">{entry.new_value}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {entry.client_id && clientMap[entry.client_id] && (
                            <span className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded hidden sm:inline">
                              {clientMap[entry.client_id]}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.created_at), { locale: de, addSuffix: true })}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {entries.length >= limit && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs font-mono text-muted-foreground"
                onClick={() => setLimit((l) => l + 100)}
              >
                Mehr laden
              </Button>
            )}
          </div>
        )}
      </motion.div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default ActivityPage;
