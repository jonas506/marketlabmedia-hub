import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useInternalReviewCount() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["internal-review-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("content_pieces")
        .select("id", { count: "exact", head: true })
        .eq("phase", "internal_review");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("internal-review-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_pieces" },
        () => qc.invalidateQueries({ queryKey: ["internal-review-count"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query.data ?? 0;
}
