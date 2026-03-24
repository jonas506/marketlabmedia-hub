import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Rocket, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OnboardingClient {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  progress: number;
  completedSteps: number;
  totalSteps: number;
  daysSinceCreation: number;
}

const OnboardingOverview = () => {
  const navigate = useNavigate();

  const { data: onboardingClients } = useQuery({
    queryKey: ["onboarding-overview"],
    queryFn: async (): Promise<OnboardingClient[]> => {
      const { data: checklists } = await supabase
        .from("checklists")
        .select("id, client_id, name, status")
        .eq("category", "onboarding")
        .neq("status", "done")
        .neq("status", "completed");

      if (!checklists || checklists.length === 0) return [];

      const clientIds = [...new Set(checklists.map((c) => c.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, logo_url, created_at")
        .in("id", clientIds);

      const checklistIds = checklists.map((c) => c.id);
      const { data: steps } = await supabase
        .from("checklist_steps")
        .select("checklist_id, is_completed")
        .in("checklist_id", checklistIds);

      return (clients ?? []).map((client) => {
        const clientChecklists = checklists.filter((c) => c.client_id === client.id);
        const clientChecklistIds = clientChecklists.map((c) => c.id);
        const clientSteps = (steps ?? []).filter((s) => clientChecklistIds.includes(s.checklist_id));
        const total = clientSteps.length;
        const completed = clientSteps.filter((s) => s.is_completed).length;

        return {
          ...client,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          completedSteps: completed,
          totalSteps: total,
          daysSinceCreation: Math.floor(
            (Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
        };
      }).sort((a, b) => a.progress - b.progress);
    },
  });

  if (!onboardingClients || onboardingClients.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-border bg-card overflow-hidden mb-6"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-surface-elevated border-b border-border">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-amber-500" />
          <h3 className="font-display text-sm font-semibold">Onboarding</h3>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {onboardingClients.length} {onboardingClients.length === 1 ? "Kunde" : "Kunden"}
        </span>
      </div>

      <div className="divide-y divide-border/30">
        {onboardingClients.map((client) => (
          <button
            key={client.id}
            onClick={() => navigate(`/client/${client.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
          >
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-7 w-7 rounded-md object-contain bg-white p-0.5 ring-1 ring-border shrink-0"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 font-display text-xs font-bold text-primary shrink-0">
                {client.name.charAt(0)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-body text-sm font-medium truncate">{client.name}</span>
                <span className={cn(
                  "text-[10px] font-mono shrink-0 ml-2",
                  client.daysSinceCreation > 7 ? "text-amber-500" : "text-muted-foreground"
                )}>
                  {client.daysSinceCreation > 7 && <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />}
                  seit {client.daysSinceCreation} {client.daysSinceCreation === 1 ? "Tag" : "Tagen"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-amber-500/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      client.progress > 80 ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    style={{ width: `${client.progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-7 text-right">
                  {client.progress}%
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {client.completedSteps}/{client.totalSteps}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default OnboardingOverview;
