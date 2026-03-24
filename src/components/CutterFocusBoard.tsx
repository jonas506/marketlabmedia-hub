import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Scissors, Eye, Pen, Camera, CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

interface WorkItem {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  deadline: string | null;
  phase?: string;
  type?: string;
  kind: "piece" | "task" | "sop";
  priority?: string | null;
}

const PhaseIcon = ({ phase }: { phase?: string }) => {
  switch (phase) {
    case "script": return <Pen className="h-3 w-3 text-muted-foreground shrink-0" />;
    case "filmed": return <Camera className="h-3 w-3 text-muted-foreground shrink-0" />;
    case "editing": return <Scissors className="h-3 w-3 text-status-working shrink-0" />;
    case "review": return <Eye className="h-3 w-3 text-status-review shrink-0" />;
    default: return <Scissors className="h-3 w-3 text-muted-foreground shrink-0" />;
  }
};

const PHASE_LABELS: Record<string, { label: string; css: string }> = {
  script: { label: "Skript", css: "monday-status-default" },
  filmed: { label: "Gedreht", css: "monday-status-default" },
  editing: { label: "Schnitt", css: "monday-status-working" },
  feedback: { label: "Feedback", css: "monday-status-stuck" },
  review: { label: "Freigabe", css: "monday-status-review" },
};

const CutterFocusBoard = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overdue: true,
    today: true,
    week: true,
    later: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cutter-focus", user?.id],
    queryFn: async () => {
      const [{ data: pieces }, { data: tasks }, { data: steps }, { data: clients }] = await Promise.all([
        supabase.from("content_pieces")
          .select("id, client_id, title, type, phase, deadline, priority")
          .eq("assigned_to", user!.id)
          .not("phase", "in", "(approved,handed_over)"),
        supabase.from("tasks")
          .select("id, client_id, title, deadline, priority, is_completed")
          .eq("assigned_to", user!.id)
          .eq("is_completed", false),
        supabase.from("checklist_steps")
          .select("id, checklist_id, title, is_completed, assigned_to")
          .eq("assigned_to", user!.id)
          .eq("is_completed", false),
        supabase.from("clients").select("id, name"),
      ]);

      const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));

      // Get checklist → client mapping
      let stepItems: WorkItem[] = [];
      if (steps && steps.length > 0) {
        const clIds = [...new Set(steps.map((s) => s.checklist_id))];
        const { data: checklists } = await supabase.from("checklists").select("id, client_id").in("id", clIds);
        const clMap = new Map((checklists ?? []).map((cl) => [cl.id, cl.client_id]));
        stepItems = steps.map((s) => {
          const cid = clMap.get(s.checklist_id) || "";
          return { id: s.id, title: s.title, clientId: cid, clientName: clientMap.get(cid) || "—", deadline: null, kind: "sop" as const };
        });
      }

      const pieceItems: WorkItem[] = (pieces ?? []).map((p) => ({
        id: p.id, title: p.title || "Ohne Titel", clientId: p.client_id,
        clientName: clientMap.get(p.client_id) || "—", deadline: p.deadline,
        phase: p.phase, type: p.type, kind: "piece" as const, priority: p.priority,
      }));

      const taskItems: WorkItem[] = (tasks ?? []).map((t) => ({
        id: t.id, title: t.title, clientId: t.client_id,
        clientName: clientMap.get(t.client_id) || "—", deadline: t.deadline,
        kind: "task" as const, priority: t.priority,
      }));

      return [...pieceItems, ...taskItems, ...stepItems];
    },
    enabled: !!user?.id,
  });

  const columns = useMemo(() => {
    if (!data) return { overdue: [], today: [], week: [], later: [] };
    const todayStr = new Date().toISOString().split("T")[0];
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const overdue: WorkItem[] = [];
    const today: WorkItem[] = [];
    const week: WorkItem[] = [];
    const later: WorkItem[] = [];

    data.forEach((item) => {
      if (!item.deadline) {
        // Pieces in editing without deadline go to "today" column
        if (item.kind === "piece" && item.phase === "editing") {
          today.push(item);
        } else {
          later.push(item);
        }
      } else if (item.deadline < todayStr) {
        overdue.push(item);
      } else if (item.deadline === todayStr) {
        today.push(item);
      } else if (item.deadline <= weekEndStr) {
        week.push(item);
      } else {
        later.push(item);
      }
    });

    // Sort each by priority
    const prioOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const sortFn = (a: WorkItem, b: WorkItem) => {
      const ap = prioOrder[a.priority || "normal"] ?? 2;
      const bp = prioOrder[b.priority || "normal"] ?? 2;
      return ap - bp;
    };

    overdue.sort(sortFn);
    today.sort(sortFn);
    week.sort(sortFn);
    later.sort(sortFn);

    return { overdue, today, week, later };
  }, [data]);

  const totalCount = (data ?? []).length;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderItem = (item: WorkItem, borderColor: string) => (
    <Link
      key={`${item.kind}-${item.id}`}
      to={`/client/${item.clientId}`}
      className={cn("flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors border-l-2", borderColor)}
    >
      <PhaseIcon phase={item.phase} />
      {item.phase && PHASE_LABELS[item.phase] && (
        <span className={cn("monday-status text-[9px] py-0.5 px-2 hidden sm:inline-block", PHASE_LABELS[item.phase].css)}>
          {PHASE_LABELS[item.phase].label}
        </span>
      )}
      <span className="flex-1 text-sm font-body truncate">{item.title}</span>
      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px] hidden sm:inline">{item.clientName}</span>
      {item.deadline && (
        <span className={cn("text-[10px] font-mono shrink-0", item.deadline < new Date().toISOString().split("T")[0] ? "text-destructive font-semibold" : "text-muted-foreground")}>
          {format(new Date(item.deadline), "dd. MMM", { locale: de })}
        </span>
      )}
    </Link>
  );

  const sections = [
    { key: "overdue", label: "Überfällig", items: columns.overdue, dotColor: "bg-destructive", borderColor: "border-destructive/50", textColor: "text-destructive" },
    { key: "today", label: "Heute", items: columns.today, dotColor: "bg-primary", borderColor: "border-primary/50", textColor: "text-primary" },
    { key: "week", label: "Diese Woche", items: columns.week, dotColor: "bg-muted-foreground", borderColor: "border-muted-foreground/30", textColor: "text-muted-foreground" },
    { key: "later", label: "Demnächst", items: columns.later, dotColor: "bg-muted-foreground/50", borderColor: "border-muted-foreground/20", textColor: "text-muted-foreground" },
  ];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 mb-5">
        <div className="h-5 w-40 animate-pulse bg-muted/40 rounded mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              {[...Array(4)].map((_, j) => <div key={j} className="h-10 animate-pulse rounded bg-muted/30" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card overflow-hidden mb-5">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
          <Scissors className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Mein Arbeitstag</h3>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{totalCount}</span>
        </div>

        {sections.map((section) => {
          if (section.items.length === 0) return null;
          const isExpanded = expandedSections[section.key] ?? true;
          return (
            <div key={section.key}>
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className={cn("w-2 h-2 rounded-full", section.dotColor)} />
                <span className={cn("text-xs font-display font-semibold", section.textColor)}>{section.label}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{section.items.length}</span>
                {isExpanded ? <ChevronUp className="h-3 w-3 ml-auto text-muted-foreground" /> : <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />}
              </button>
              {isExpanded && section.items.map((item) => renderItem(item, section.borderColor))}
            </div>
          );
        })}

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">{totalCount} offene Aufgaben</span>
          <Link to="/tasks" className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors">Alle Aufgaben →</Link>
        </div>
      </motion.div>
    );
  }

  // Desktop: 3-column layout (overdue+today | week | later)
  const col1 = sections.filter((s) => s.key === "overdue" || s.key === "today");
  const col2 = sections.filter((s) => s.key === "week");
  const col3 = sections.filter((s) => s.key === "later");

  const renderColumn = (cols: typeof sections) => (
    <div className="space-y-0 divide-y divide-border/30">
      {cols.map((section) => {
        if (section.items.length === 0) return null;
        return (
          <div key={section.key}>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
              <div className={cn("w-2 h-2 rounded-full", section.dotColor)} />
              <span className={cn("text-[11px] font-display font-semibold", section.textColor)}>{section.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{section.items.length}</span>
            </div>
            {section.items.map((item) => renderItem(item, section.borderColor))}
          </div>
        );
      })}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card overflow-hidden mb-5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-elevated">
        <Scissors className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold">Mein Arbeitstag</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{totalCount}</span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border min-h-[200px]">
        <div>{renderColumn(col1)}</div>
        <div>{renderColumn(col2)}</div>
        <div>{renderColumn(col3)}</div>
      </div>

      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">{totalCount} offene Aufgaben</span>
        <Link to="/tasks" className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors">Alle Aufgaben →</Link>
      </div>
    </motion.div>
  );
};

export default CutterFocusBoard;
