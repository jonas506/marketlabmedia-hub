import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, AlertTriangle, X } from "lucide-react";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Task, TeamMember } from "@/components/tasks/constants";
import TaskKanbanBoard from "@/components/tasks/TaskKanbanBoard";
import NewTaskSheet from "@/components/tasks/NewTaskSheet";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";

interface ClientInfo { id: string; name: string; logo_url: string | null }

const Tasks = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const doneCutoff = subDays(new Date(), 1).toISOString();

  const person = params.get("person") || "all"; // all | me | userId
  const clientFilter = params.get("client") || "all";
  const priorityFilter = params.get("priority") || "all";
  const search = params.get("q") || "";

  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === "all") next.delete(key); else next.set(key, val);
    setParams(next, { replace: true });
  };

  const { data: allTasks = [] } = useQuery({
    queryKey: ["kanban-tasks"],
    queryFn: async () => {
      // Include all open tasks + tasks completed within 24h
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .is("parent_id", null)
        .or(`is_completed.eq.false,completed_at.gte.${doneCutoff}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as Task[];
    },
    refetchInterval: 30000,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, name, email")
        .in("user_id", roles.map(r => r.user_id));
      return (profiles ?? []) as TeamMember[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-with-logos"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, logo_url").order("name");
      return (data ?? []) as ClientInfo[];
    },
  });

  const clientMap = useMemo(() => {
    const m: Record<string, ClientInfo> = {};
    clients.forEach(c => m[c.id] = c);
    return m;
  }, [clients]);

  const teamMap = useMemo(() => {
    const m: Record<string, TeamMember> = {};
    team.forEach(t => m[t.user_id] = t);
    return m;
  }, [team]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks.filter(t => {
      if (person === "me" && t.assigned_to !== user?.id) return false;
      if (person !== "all" && person !== "me" && t.assigned_to !== person) return false;
      if (clientFilter !== "all" && t.client_id !== clientFilter) return false;
      if (priorityFilter === "high" && !(t.priority === "high" || t.priority === "urgent")) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allTasks, person, clientFilter, priorityFilter, search, user?.id]);

  const overdueCount = useMemo(
    () => filteredTasks.filter(t => !t.is_completed && t.deadline && t.deadline < todayStr).length,
    [filteredTasks, todayStr]
  );

  const closeDetail = useCallback(() => setSelectedTask(null), []);

  const hasActiveFilter = person !== "all" || clientFilter !== "all" || priorityFilter !== "all" || !!search;

  return (
    <AppLayout>
      <ErrorBoundary level="section">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {/* Header */}
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-display font-bold tracking-tight">Aufgaben</h1>
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" /> {overdueCount} überfällig
                </span>
              )}
            </div>
            <Button onClick={() => setNewOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Neue Aufgabe
            </Button>
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2 p-2 rounded-xl bg-surface-elevated border border-border">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setParam("q", e.target.value)}
                placeholder="Suchen…"
                className="h-8 pl-8 text-xs bg-transparent border-0 shadow-none focus-visible:ring-1"
              />
            </div>

            <Select value={person} onValueChange={v => setParam("person", v)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Personen</SelectItem>
                <SelectItem value="me">Nur ich</SelectItem>
                {team.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={v => setParam("client", v)}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kunden</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={v => setParam("priority", v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Priorität</SelectItem>
                <SelectItem value="high">Hoch + Dringend</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setParams({}, { replace: true })}>
                <X className="h-3 w-3" /> Zurücksetzen
              </Button>
            )}
          </div>

          {/* Kanban board */}
          <TaskKanbanBoard
            tasks={filteredTasks}
            clientMap={clientMap}
            teamMap={teamMap}
            todayStr={todayStr}
            onSelect={setSelectedTask}
          />

          {filteredTasks.length === 0 && (
            <div className="mt-8 py-12 text-center">
              <p className="text-sm text-muted-foreground/60 font-mono mb-3">
                {hasActiveFilter ? "Keine Aufgaben mit diesen Filtern" : "Noch keine Aufgaben"}
              </p>
              <Button onClick={() => setNewOpen(true)} size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" /> Erste Aufgabe erstellen
              </Button>
            </div>
          )}
        </motion.div>

        <NewTaskSheet
          open={newOpen}
          onClose={() => setNewOpen(false)}
          team={team}
          clients={clients}
          defaultClientId={clientFilter !== "all" ? clientFilter : null}
          defaultAssignee={person !== "all" && person !== "me" ? person : (person === "me" ? user?.id : null)}
        />

        <TaskDetailSheet
          task={selectedTask}
          onClose={closeDetail}
          team={team}
          clients={clients}
          teamMap={teamMap}
        />
      </ErrorBoundary>
    </AppLayout>
  );
};

export default Tasks;
