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
}

export interface PipelineCounts {
  inPipeline: number;
  handedOver: number;
}

export interface ClientDashboardData extends Client {
  pipelineCounts: PipelineCounts;
  handedOverThisMonth: { reels: number; carousels: number; stories: number };
  nextShootDay: string | null;
  runway: number;
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

      const { month, year } = getCurrentMonth();

      return clients.map((client) => {
        const pieces = allPieces?.filter((c) => c.client_id === client.id) ?? [];
        
        const inPipeline = pieces.filter((c) => c.phase !== "handed_over").length;
        const handedOver = pieces.filter((c) => c.phase === "handed_over").length;

        const handedOverThisMonth = pieces.filter(
          (c) => c.phase === "handed_over" && c.target_month === month && c.target_year === year
        );

        // Runway: only reels + stories, done + handed_over
        const reelStoryTarget = client.monthly_reels + client.monthly_stories;
        const dailyFreq = reelStoryTarget / 30;
        const readyPieces = pieces.filter(
          (c) => (c.type === "reel" || c.type === "story") && (c.phase === "done" || c.phase === "handed_over") &&
          c.target_month === month && c.target_year === year
        ).length;
        const runway = dailyFreq > 0 ? Math.round(readyPieces / dailyFreq) : 999;

        const nextShoot = shootDays?.find((s) => s.client_id === client.id);

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
        };
      }).sort((a, b) => a.runway - b.runway);
    },
  });
};
