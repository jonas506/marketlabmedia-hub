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

export interface ClipPhaseCounts {
  raw: number;
  editing: number;
  done: number;
  scheduled: number;
  posted: number;
}

export interface ClientDashboardData extends Client {
  clipCounts: ClipPhaseCounts;
  postedThisMonth: { reels: number; carousels: number; stories: number };
  nextShootDay: string | null;
  runway: number;
}

const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export const useClients = () => {
  return useQuery({
    queryKey: ["clients-dashboard"],
    queryFn: async (): Promise<ClientDashboardData[]> => {
      const { data: clients, error } = await supabase.from("clients").select("*");
      if (error) throw error;
      if (!clients?.length) return [];

      const clientIds = clients.map((c) => c.id);

      // Fetch all clips for these clients
      const { data: allClips } = await supabase
        .from("clips")
        .select("client_id, phase, type, updated_at")
        .in("client_id", clientIds);

      // Fetch next planned shoot days
      const today = new Date().toISOString().split("T")[0];
      const { data: shootDays } = await supabase
        .from("shoot_days")
        .select("client_id, date")
        .in("client_id", clientIds)
        .eq("status", "planned")
        .gte("date", today)
        .order("date", { ascending: true });

      const firstOfMonth = getFirstDayOfMonth();

      return clients.map((client) => {
        const clips = allClips?.filter((c) => c.client_id === client.id) ?? [];
        
        const clipCounts: ClipPhaseCounts = {
          raw: clips.filter((c) => c.phase === "raw").length,
          editing: clips.filter((c) => c.phase === "editing").length,
          done: clips.filter((c) => c.phase === "done").length,
          scheduled: clips.filter((c) => c.phase === "scheduled").length,
          posted: clips.filter((c) => c.phase === "posted").length,
        };

        // Posted this month
        const postedThisMonth = clips.filter(
          (c) => c.phase === "posted" && c.updated_at >= firstOfMonth
        );

        const totalMonthly = client.monthly_reels + client.monthly_carousels + client.monthly_stories;
        const dailyFreq = totalMonthly / 30;
        const readyClips = clipCounts.done + clipCounts.scheduled;
        const runway = dailyFreq > 0 ? Math.round(readyClips / dailyFreq) : 999;

        const nextShoot = shootDays?.find((s) => s.client_id === client.id);

        return {
          ...client,
          clipCounts,
          postedThisMonth: {
            reels: postedThisMonth.filter((c) => c.type === "reel").length,
            carousels: postedThisMonth.filter((c) => c.type === "carousel").length,
            stories: postedThisMonth.filter((c) => c.type === "story").length,
          },
          nextShootDay: nextShoot?.date ?? null,
          runway,
        };
      }).sort((a, b) => a.runway - b.runway);
    },
  });
};
