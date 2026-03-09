import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const TeamOverview = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["team-overview"],
    queryFn: async () => {
      // Get all cutters
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["cutter", "head_of_content"]);
      if (!roles?.length) return [];

      const userIds = roles.map((r) => r.user_id);
      const [{ data: profiles }, { data: clips }, { data: clients }] = await Promise.all([
        supabase.from("profiles").select("user_id, name").in("user_id", userIds),
        supabase.from("clips").select("id, client_id, assigned_to, phase").eq("phase", "editing").in("assigned_to", userIds),
        supabase.from("clients").select("id, name"),
      ]);

      return (profiles ?? []).map((profile) => {
        const userClips = clips?.filter((c) => c.assigned_to === profile.user_id) ?? [];
        const byClient = (clients ?? [])
          .map((client) => ({
            clientName: client.name,
            count: userClips.filter((c) => c.client_id === client.id).length,
          }))
          .filter((c) => c.count > 0);

        return {
          name: profile.name,
          role: roles.find((r) => r.user_id === profile.user_id)?.role,
          totalEditing: userClips.length,
          byClient,
        };
      });
    },
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">TEAM</h1>
        <p className="font-body text-sm text-muted-foreground">
          Clips im Status „Im Schnitt" pro Teammitglied.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">
          0 TEAMMITGLIEDER
        </p>
      ) : (
        <div className="space-y-3">
          {data?.map((member) => (
            <div
              key={member.name}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-body text-sm font-medium">{member.name}</h3>
                  <p className="font-mono text-xs text-muted-foreground uppercase">
                    {member.role === "head_of_content" ? "Head of Content" : "Cutter"}
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold">{member.totalEditing}</span>
              </div>

              {member.byClient.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {member.byClient.map((c) => (
                    <span
                      key={c.clientName}
                      className="rounded-md bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground"
                    >
                      {c.clientName}: {c.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default TeamOverview;
