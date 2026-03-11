import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  filmed: { label: "Gedreht", color: "bg-muted text-muted-foreground" },
  script: { label: "Skript", color: "bg-muted text-muted-foreground" },
  editing: { label: "Im Schnitt", color: "bg-status-working/15 text-status-working" },
  review: { label: "Zur Freigabe", color: "bg-status-review/15 text-status-review" },
  approved: { label: "Freigegeben", color: "bg-status-done/15 text-status-done" },
  handed_over: { label: "Übergeben", color: "bg-primary/15 text-primary" },
};

const TeamOverview = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["team-overview"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["cutter", "head_of_content"]);
      if (!roles?.length) return [];

      const userIds = roles.map((r) => r.user_id);
      const [{ data: profiles }, { data: pieces }, { data: clients }] = await Promise.all([
        supabase.from("profiles").select("user_id, name").in("user_id", userIds),
        supabase.from("content_pieces").select("id, client_id, assigned_to, phase, type").in("assigned_to", userIds),
        supabase.from("clients").select("id, name"),
      ]);

      return (profiles ?? []).map((profile) => {
        const userPieces = pieces?.filter((p) => p.assigned_to === profile.user_id) ?? [];

        // Group by phase
        const byPhase: Record<string, number> = {};
        userPieces.forEach((p) => {
          byPhase[p.phase] = (byPhase[p.phase] || 0) + 1;
        });

        // Group by client
        const byClient = (clients ?? [])
          .map((client) => ({
            clientName: client.name,
            count: userPieces.filter((p) => p.client_id === client.id).length,
          }))
          .filter((c) => c.count > 0);

        return {
          name: profile.name,
          role: roles.find((r) => r.user_id === profile.user_id)?.role,
          totalPieces: userPieces.length,
          editingCount: byPhase["editing"] || 0,
          reviewCount: byPhase["review"] || 0,
          byPhase,
          byClient,
        };
      });
    },
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold tracking-tight">Team</h1>
        <p className="font-body text-xs text-muted-foreground mt-0.5">
          Content-Pieces pro Teammitglied und Phase
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-card border border-border" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">
          Keine Teammitglieder
        </p>
      ) : (
        <div className="space-y-3">
          {data?.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary text-[11px] font-bold text-white">
                    {member.name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?"}
                  </div>
                  <div>
                    <h3 className="font-body text-sm font-medium">{member.name}</h3>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase">
                      {member.role === "head_of_content" ? "Head of Content" : "Cutter"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {member.editingCount > 0 && (
                    <div className="text-center">
                      <span className="font-mono text-xl font-bold text-status-working">{member.editingCount}</span>
                      <p className="text-[9px] font-mono text-muted-foreground">Im Schnitt</p>
                    </div>
                  )}
                  {member.reviewCount > 0 && (
                    <div className="text-center">
                      <span className="font-mono text-xl font-bold text-status-review">{member.reviewCount}</span>
                      <p className="text-[9px] font-mono text-muted-foreground">Freigabe</p>
                    </div>
                  )}
                  <div className="text-center">
                    <span className="font-mono text-xl font-bold">{member.totalPieces}</span>
                    <p className="text-[9px] font-mono text-muted-foreground">Gesamt</p>
                  </div>
                </div>
              </div>

              {/* Phase breakdown */}
              {Object.keys(member.byPhase).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(member.byPhase).map(([phase, count]) => {
                    const cfg = PHASE_CONFIG[phase] || { label: phase, color: "bg-muted text-muted-foreground" };
                    return (
                      <Badge key={phase} variant="secondary" className={cn("text-[10px] font-mono px-2 py-0.5 border-0", cfg.color)}>
                        {cfg.label}: {count}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Client breakdown */}
              {member.byClient.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/50">
                  {member.byClient.map((c) => (
                    <span
                      key={c.clientName}
                      className="rounded-md bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      {c.clientName}: {c.count}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default TeamOverview;
