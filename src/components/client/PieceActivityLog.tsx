import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowRight, UserPlus, Plus, CheckCircle2, Trash2, Calendar, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ActivityEntry {
  id: string;
  action: string;
  summary: string;
  created_at: string;
  old_value: string | null;
  new_value: string | null;
  field_name: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-500", phase_changed: "bg-primary", assigned: "bg-amber-500",
  completed: "bg-status-done", deleted: "bg-destructive", deadline_changed: "bg-violet-500",
  priority_changed: "bg-orange-500", status_changed: "bg-status-working",
};

const ACTION_ICONS: Record<string, React.ComponentType<any>> = {
  phase_changed: ArrowRight, assigned: UserPlus, created: Plus, completed: CheckCircle2,
  deleted: Trash2, deadline_changed: Calendar, priority_changed: AlertTriangle, status_changed: RefreshCw,
};

interface PieceActivityLogProps {
  entityType: string;
  entityId: string;
}

const PieceActivityLog: React.FC<PieceActivityLogProps> = ({ entityType, entityId }) => {
  const [open, setOpen] = useState(false);

  const { data: entries = [] } = useQuery({
    queryKey: ["piece-activity", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, summary, created_at, old_value, new_value, field_name")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ActivityEntry[];
    },
    enabled: open,
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Verlauf anzeigen {entries.length > 0 && `(${entries.length})`}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-l-2 border-border/50 ml-1 space-y-0 mt-1 mb-2">
          {entries.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50 font-mono pl-4 py-2">Keine Einträge</p>
          ) : (
            entries.map((entry, i) => {
              const Icon = ACTION_ICONS[entry.action] || RefreshCw;
              const dotColor = ACTION_COLORS[entry.action] || "bg-muted-foreground";
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-2 pl-4 py-1.5 relative"
                >
                  <div className={cn("absolute -left-[4px] top-2.5 h-2 w-2 rounded-full ring-2 ring-card", dotColor)} />
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[11px] font-body leading-snug flex-1">{entry.summary}</p>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(entry.created_at), { locale: de, addSuffix: true })}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PieceActivityLog;
