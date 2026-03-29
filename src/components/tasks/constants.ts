import { AlertTriangle, Clock, Calendar as CalendarIconAlt, CalendarIcon } from "lucide-react";

export interface Task {
  id: string;
  client_id: string;
  title: string;
  tag: string | null;
  assigned_to: string | null;
  deadline: string | null;
  due_time: string | null;
  is_completed: boolean;
  notes: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  sort_order: number | null;
  content_piece_id?: string | null;
}

export interface TeamMember {
  user_id: string;
  name: string | null;
  email: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export const STATUS_CONFIG = [
  { value: "not_started", label: "Offen", cssClass: "monday-status-default" },
  { value: "in_progress", label: "Begonnen", cssClass: "monday-status-working" },
  { value: "review", label: "Besprechen", cssClass: "monday-status-review" },
  { value: "done", label: "Fertig", cssClass: "monday-status-done" },
];

export const PRIORITY_CONFIG = [
  { value: "low", label: "Niedrig", dot: "bg-[hsl(var(--status-default))]" },
  { value: "normal", label: "Normal", dot: "bg-[hsl(var(--status-working))]" },
  { value: "high", label: "Hoch", dot: "bg-[hsl(var(--status-review))]" },
  { value: "urgent", label: "Dringend", dot: "bg-[hsl(var(--status-stuck))]" },
];

export type GroupKey = "overdue" | "today" | "week" | "later" | "no_deadline";

export const GROUP_META: Record<GroupKey, { label: string; color: string; icon: any }> = {
  overdue: { label: "Überfällig", color: "text-destructive", icon: AlertTriangle },
  today: { label: "Heute", color: "text-[hsl(var(--status-working))]", icon: Clock },
  week: { label: "Diese Woche", color: "text-muted-foreground", icon: CalendarIconAlt },
  later: { label: "Später", color: "text-muted-foreground", icon: CalendarIcon },
  no_deadline: { label: "Ohne Deadline", color: "text-muted-foreground/50", icon: CalendarIcon },
};

export const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const getInitials = (name: string | null | undefined) => {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

export const getSC = (s: string | null) => STATUS_CONFIG.find(c => c.value === (s || "not_started")) || STATUS_CONFIG[0];
export const getPC = (p: string | null) => PRIORITY_CONFIG.find(c => c.value === (p || "normal")) || PRIORITY_CONFIG[1];

export function sortByPriority(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => (PRIORITY_ORDER[a.priority || "normal"] ?? 2) - (PRIORITY_ORDER[b.priority || "normal"] ?? 2));
}

import { startOfDay, endOfWeek, isToday, isBefore } from "date-fns";

export function groupTasks(tasks: Task[], todayStr: string): Record<GroupKey, Task[]> {
  const today = startOfDay(new Date(todayStr));
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const groups: Record<GroupKey, Task[]> = { overdue: [], today: [], week: [], later: [], no_deadline: [] };
  tasks.forEach(t => {
    if (!t.deadline) { groups.no_deadline.push(t); return; }
    const d = startOfDay(new Date(t.deadline));
    if (isBefore(d, today)) groups.overdue.push(t);
    else if (isToday(d)) groups.today.push(t);
    else if (isBefore(d, weekEnd) || d.getTime() === weekEnd.getTime()) groups.week.push(t);
    else groups.later.push(t);
  });
  for (const key of Object.keys(groups) as GroupKey[]) {
    sortByPriority(groups[key]);
  }
  return groups;
}
