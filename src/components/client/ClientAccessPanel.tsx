import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Users } from "lucide-react";
import {
  useAssignableMembers,
  useClientAssignments,
  useSetClientAccess,
} from "@/hooks/useClientAssignments";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_of_content: "Head of Content",
  cutter: "Cutter",
};

const ClientAccessPanel = ({ clientId }: { clientId: string }) => {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "head_of_content";
  const { data: members = [] } = useAssignableMembers();
  const { data: assignments = [] } = useClientAssignments();
  const setAccess = useSetClientAccess();

  if (!canManage) return null;

  const cutters = members.filter((m) => m.role === "cutter");
  const assignedIds = new Set(
    assignments.filter((a) => a.client_id === clientId).map((a) => a.user_id)
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Zugriff</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Admins & Head of Content sehen alle Kunden
        </span>
      </div>
      {cutters.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Cutter im Team.</p>
      ) : (
        <div className="space-y-1">
          {cutters.map((m) => {
            const checked = assignedIds.has(m.user_id);
            return (
              <label
                key={m.user_id}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-elevated"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setAccess.mutate({ clientId, userId: m.user_id, enabled: !!v })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{m.name || m.email}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientAccessPanel;
