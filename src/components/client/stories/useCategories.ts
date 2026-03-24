import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Category } from "./constants";

export function useCategories(clientId: string) {
  return useQuery({
    queryKey: ["story-categories", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_categories" as any)
        .select("*")
        .eq("client_id", clientId)
        .eq("scope", "sequence")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Category[];
    },
  });
}
