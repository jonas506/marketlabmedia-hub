import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowRight, UserPlus, Plus, CheckCircle2, Trash2,
  Calendar, AlertTriangle, RefreshCw, Clock, Filter
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

interface ClientActivityTimelineProps {
  clientId: string;
}

const ClientActivityTimeline: React.FC<ClientActivityTimelineProps> = ({ clientId }) => {
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState("all");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["activity-log", clientId, limit, filter],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filter === "pieces") query = query.eq("entity_type", "content_piece");
      if (filter === "tasks") query = query.eq("entity_type", "task");
      if (filter === "assigned") query = query.eq("action", "assigned");

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

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-3 w-3 rounded-full animate-pulse bg-muted/40 mt-1" />
            <div className="flex-1 h-8 animate-pulse rounded bg-muted/30" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Aktivitäten</SelectItem>
            <SelectItem value="pieces">Nur Content Pieces</SelectItem>
            <SelectItem value="tasks">Nur Aufgaben</SelectItem>
            <SelectItem value="assigned">Nur Zuweisungen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {entries.length === 0 ? (
        <div className="py-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50 font-mono">Noch keine Aktivitäten aufgezeichnet</p>
        </div>
      ) : (
        <div className="space-y-4">
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
                      transition={{ delay: i * 0.02 }}
                      className="flex items-start gap-3 pl-4 py-2 relative"
                    >
                      {/* Dot */}
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
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
                        {formatDistanceToNow(new Date(entry.created_at), { locale: de, addSuffix: true })}
                      </span>
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
              onClick={() => setLimit((l) => l + 50)}
            >
              Mehr laden
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientActivityTimeline;
