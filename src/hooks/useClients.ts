import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  status: string;
  monthly_reels: number;
  monthly_carousels: number;
  monthly_stories: number;
  drive_branding_link: string | null;
  drive_logo_link: string | null;
  drive_styleguide_link: string | null;
  contract_start: string | null;
  contract_duration: string | null;
}

export interface PipelineCounts {
  inPipeline: number;
  handedOver: number;
}

export type LifecyclePhase = "onboarding" | "active" | "contract_ending";

export interface ClientDashboardData extends Client {
  pipelineCounts: PipelineCounts;
  handedOverThisMonth: { reels: number; carousels: number; stories: number };
  nextShootDay: string | null;
  runway: number;
  lifecyclePhase: LifecyclePhase;
}

const getCurrentMonth = () => {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
};

export const useClients = () => {
  return useQuery({
    queryKey: ["clients-dashboard"],
    queryFn: async (): Promise<ClientDashboardData[]> => {
      const { data: clients, error } = await supabase.from("clients").select("*");
      if (error) throw error;
      if (!clients?.length) return [];

      const clientIds = clients.map((c) => c.id);

      const { data: allPieces } = await supabase
        .from("content_pieces")
        .select("client_id, phase, type, target_month, target_year")
        .in("client_id", clientIds);

      const today = new Date().toISOString().split("T")[0];
      const { data: shootDays } = await supabase
        .from("shoot_days")
        .select("client_id, date")
        .in("client_id", clientIds)
        .eq("status", "planned")
        .gte("date", today)
        .order("date", { ascending: true });

      // Fetch onboarding checklists to determine lifecycle phase
      const { data: onboardingChecklists } = await supabase
        .from("checklists")
        .select("client_id, status, category")
        .in("client_id", clientIds)
        .eq("category", "onboarding");

      const { month, year } = getCurrentMonth();

      return clients.map((client) => {
        const pieces = allPieces?.filter((c) => c.client_id === client.id) ?? [];
        
        const inPipeline = pieces.filter((c) => c.phase !== "handed_over" && c.phase !== "approved").length;
        const handedOver = pieces.filter((c) => c.phase === "handed_over").length;

        const handedOverThisMonth = pieces.filter(
          (c) => (c.phase === "approved" || c.phase === "handed_over") && Number(c.target_month) === month && Number(c.target_year) === year
        );

        // Runway: only reels, done + handed_over
        const reelTarget = client.monthly_reels;
        const dailyFreq = reelTarget / 30;
        const readyPieces = pieces.filter(
          (c) => c.type === "reel" && (c.phase === "approved" || c.phase === "handed_over") &&
          Number(c.target_month) === month && Number(c.target_year) === year
        ).length;
        const runway = dailyFreq > 0 ? Math.round(readyPieces / dailyFreq) : 999;

        const nextShoot = shootDays?.find((s) => s.client_id === client.id);

        // Compute lifecycle phase
        const clientOnboarding = onboardingChecklists?.filter(
          (c) => c.client_id === client.id && c.status !== "done"
        ) ?? [];
        const hasOpenOnboarding = clientOnboarding.length > 0;

        let lifecyclePhase: LifecyclePhase = "active";
        if (hasOpenOnboarding) {
          lifecyclePhase = "onboarding";
        } else if (client.contract_start && client.contract_duration) {
          const durationMonths = parseInt(client.contract_duration) || 0;
          if (durationMonths > 0) {
            const start = new Date(client.contract_start);
            const end = new Date(start);
            end.setMonth(end.getMonth() + durationMonths);
            const now = new Date();
            const fourWeeksFromNow = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
            if (end <= fourWeeksFromNow) {
              lifecyclePhase = "contract_ending";
            }
          }
        }

        return {
          ...client,
          pipelineCounts: { inPipeline, handedOver },
          handedOverThisMonth: {
            reels: handedOverThisMonth.filter((c) => c.type === "reel").length,
            carousels: handedOverThisMonth.filter((c) => c.type === "carousel").length,
            stories: handedOverThisMonth.filter((c) => c.type === "story").length,
          },
          nextShootDay: nextShoot?.date ?? null,
          runway,
          lifecyclePhase,
        };
      }).sort((a, b) => a.runway - b.runway);
    },
  });
};
