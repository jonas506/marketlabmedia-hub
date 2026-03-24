import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Task, TeamMember, GroupKey, getInitials } from "./constants";
import TaskCard from "./TaskCard";

interface TeamTaskColumnProps {
  member: TeamMember;
  grouped: Record<GroupKey, Task[]>;
  clientMap: Record<string, string>;
  todayStr: string;
  onComplete: (task: Task) => void;
  onSelect: (task: Task) => void;
}

const TEAM_GROUPS: { key: GroupKey; label: string; color: string }[] = [
  { key: "overdue", label: "Überfällig", color: "text-destructive" },
  { key: "today", label: "Heute", color: "text-[hsl(var(--status-working))]" },
  { key: "week", label: "Diese Woche", color: "text-muted-foreground" },
];

const TeamTaskColumn: React.FC<TeamTaskColumnProps> = ({ member, grouped, clientMap, todayStr, onComplete, onSelect }) => {
  const totalTasks = Object.values(grouped).flat().length;

  return (
    <div className="min-w-[280px] md:min-w-0 md:flex-1 snap-start">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Person header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-elevated border-b border-border">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-primary to-secondary text-white">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-display font-semibold truncate">{member.name || member.email}</p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
            {totalTasks}
          </span>
        </div>

        {/* Task groups */}
        <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
          {TEAM_GROUPS.map(({ key, label, color }) =>
            grouped[key].length > 0 && (
              <div key={key}>
                <p className={`text-[10px] font-mono font-semibold px-1 mb-1 ${color}`}>{label}</p>
                <div className="space-y-1">
                  <AnimatePresence mode="popLayout">
                    {grouped[key].map(t => (
                      <TaskCard key={t.id} task={t} clientMap={clientMap} todayStr={todayStr} onComplete={onComplete} onSelect={onSelect} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          )}
          {grouped.no_deadline.length > 0 && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-1 px-1 py-0.5 w-full text-left">
                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40 transition-transform [[data-state=closed]_&]:-rotate-90" />
                <span className="text-[10px] font-mono text-muted-foreground/40">Ohne Deadline ({grouped.no_deadline.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                <AnimatePresence mode="popLayout">
                  {grouped.no_deadline.map(t => (
                    <TaskCard key={t.id} task={t} clientMap={clientMap} todayStr={todayStr} onComplete={onComplete} onSelect={onSelect} />
                  ))}
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>
          )}
          {totalTasks === 0 && (
            <div className="py-6 text-center text-[10px] text-muted-foreground/30 font-mono">Keine Aufgaben</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TeamTaskColumn);
