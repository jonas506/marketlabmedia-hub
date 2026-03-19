import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function CrmInbox() {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery({
    queryKey: ["crm-inbox-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_tasks")
        .select("*, crm_leads(id, name)")
        .eq("is_completed", false)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data || [];
    },
  });

  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date());
  const upcoming = tasks.filter((t: any) => !t.due_date || new Date(t.due_date) >= new Date());

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-crm-border">
        <h1 className="text-xl font-bold">Inbox</h1>
        <p className="text-sm text-crm-muted mt-1">{tasks.length} offene Aufgaben</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {overdue.length > 0 && (
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <AlertCircle className="w-3.5 h-3.5" /> Überfällig ({overdue.length})
            </h3>
            <div className="space-y-1">
              {overdue.map((t: any) => (
                <InboxTask key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}
        <div className="px-6 py-3">
          <h3 className="text-xs font-semibold text-crm-muted uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Clock className="w-3.5 h-3.5" /> Anstehend ({upcoming.length})
          </h3>
          <div className="space-y-1">
            {upcoming.map((t: any) => (
              <InboxTask key={t.id} task={t} />
            ))}
          </div>
        </div>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-crm-muted">
            <CheckCircle2 className="w-10 h-10 mb-3 text-green-500/30" />
            <p className="text-sm">Alles erledigt! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InboxTask({ task }: { task: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-crm-bg/50 transition-colors">
      <Circle className="w-4 h-4 text-crm-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{task.title}</p>
        {task.crm_leads && (
          <Link to={`/crm/leads/${task.crm_leads.id}`} className="text-xs text-crm-primary hover:underline">
            {task.crm_leads.name}
          </Link>
        )}
      </div>
      {task.due_date && (
        <span className={`text-xs ${new Date(task.due_date) < new Date() ? "text-red-400" : "text-crm-muted"}`}>
          {format(new Date(task.due_date), "dd.MM.yyyy")}
        </span>
      )}
    </div>
  );
}
