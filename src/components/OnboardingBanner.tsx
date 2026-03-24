import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import { Rocket, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string;
}

const OnboardingBanner = ({ clientId }: Props) => {
  const { data: onboardingData } = useQuery({
    queryKey: ["onboarding-progress", clientId],
    queryFn: async () => {
      const { data: checklists } = await supabase
        .from("checklists")
        .select("id, name, status")
        .eq("client_id", clientId)
        .eq("category", "onboarding");

      if (!checklists || checklists.length === 0) return null;

      const checklistIds = checklists.map((c) => c.id);
      const { data: steps } = await supabase
        .from("checklist_steps")
        .select("id, checklist_id, title, is_completed, sort_order")
        .in("checklist_id", checklistIds)
        .order("sort_order");

      const totalSteps = steps?.length || 0;
      const completedSteps = steps?.filter((s) => s.is_completed).length || 0;
      const nextStep = steps?.find((s) => !s.is_completed);

      return {
        totalSteps,
        completedSteps,
        progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        nextStep,
        isComplete: completedSteps === totalSteps && totalSteps > 0,
      };
    },
  });

  if (!onboardingData || onboardingData.isComplete) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden mt-4"
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/15">
              <Rocket className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <span className="font-display text-sm font-semibold">Onboarding läuft</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {onboardingData.completedSteps}/{onboardingData.totalSteps} Schritte
          </span>
          <span className={cn(
            "text-xs font-mono font-semibold",
            onboardingData.progress > 80 ? "text-emerald-500" : "text-amber-500"
          )}>
            {onboardingData.progress}%
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-amber-500/10 overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              onboardingData.progress > 80 ? "bg-emerald-500" : "bg-amber-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${onboardingData.progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {onboardingData.nextStep && (
          <div className="flex items-center gap-2 mt-2.5">
            <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground">Nächster Schritt:</span>
            <span className="text-[10px] font-body text-foreground truncate">{onboardingData.nextStep.title}</span>
            <button
              onClick={() => {
                const tabTrigger = document.querySelector('[value="checklists"]') as HTMLElement;
                tabTrigger?.click();
              }}
              className="ml-auto text-[10px] font-mono text-amber-500 hover:text-amber-400 transition-colors shrink-0"
            >
              Checkliste öffnen →
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default OnboardingBanner;
