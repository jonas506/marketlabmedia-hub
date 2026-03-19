import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { StickyNote, Phone, Mail, MessageSquare, Activity, DollarSign, CheckCircle2, Plus } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const icons: Record<string, any> = {
  note: StickyNote, call: Phone, email: Mail, sms: MessageSquare,
  status_change: Activity, opportunity_change: DollarSign, task_completed: CheckCircle2, created: Plus,
};
const colors: Record<string, string> = {
  note: "#0083F7", call: "#8B5CF6", email: "#F59E0B", sms: "#EC4899",
  status_change: "#F59E0B", opportunity_change: "#22C55E", task_completed: "#22C55E", created: "#6B7280",
};

export default function CrmActivities() {
  const { data: activities = [] } = useQuery({
    queryKey: ["crm-all-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_activities")
        .select("*, crm_leads(id, name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-crm-border">
        <h1 className="text-xl font-bold">Activities</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {activities.map((a: any) => {
          const Icon = icons[a.type] || Activity;
          const color = colors[a.type] || "#6B7280";
          return (
            <div key={a.id} className="flex gap-3 py-3 border-b border-crm-border/50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {a.crm_leads && (
                    <Link to={`/crm/leads/${a.crm_leads.id}`} className="text-xs text-crm-primary hover:underline font-medium">
                      {a.crm_leads.name}
                    </Link>
                  )}
                </div>
                <p className="text-sm font-medium mt-0.5">{a.title}</p>
                {a.body && <p className="text-sm text-crm-muted mt-0.5 line-clamp-2">{a.body}</p>}
              </div>
              <span className="text-xs text-crm-muted shrink-0">
                {format(new Date(a.created_at), "d MMM HH:mm", { locale: de })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
