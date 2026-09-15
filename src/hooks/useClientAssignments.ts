import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface ClientAssignment {
  id: string;
  client_id: string;
  user_id: string;
}

export const useClientAssignments = () =>
  useQuery({
    queryKey: ["client-assignments"],
    queryFn: async (): Promise<ClientAssignment[]> => {
      const { data, error } = await supabase
        .from("client_assignments")
        .select("id, client_id, user_id");
      if (error) throw error;
      return data ?? [];
    },
  });

/** Team members that can be assigned to clients (cutters). */
export const useAssignableMembers = () =>
  useQuery({
    queryKey: ["assignable-members"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", ids);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roles!.find((r) => r.user_id === p.user_id)?.role ?? "cutter",
      }));
    },
  });

export const useSetClientAccess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      userId,
      enabled,
    }: { clientId: string; userId: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase
          .from("client_assignments")
          .upsert({ client_id: clientId, user_id: userId }, { onConflict: "client_id,user_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_assignments")
          .delete()
          .eq("client_id", clientId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-assignments"] });
    },
    onError: (e: any) => toast.error(e.message || "Zugriff konnte nicht geändert werden"),
  });
};
