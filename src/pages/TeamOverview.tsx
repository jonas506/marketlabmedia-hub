import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Mail, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  filmed: { label: "Gedreht", color: "bg-muted text-muted-foreground" },
  script: { label: "Skript", color: "bg-muted text-muted-foreground" },
  editing: { label: "Im Schnitt", color: "bg-status-working/15 text-status-working" },
  review: { label: "Zur Freigabe", color: "bg-status-review/15 text-status-review" },
  approved: { label: "Freigegeben", color: "bg-status-done/15 text-status-done" },
  handed_over: { label: "Übergeben", color: "bg-primary/15 text-primary" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_of_content: "Head of Content",
  cutter: "Cutter",
};

const TeamOverview = () => {
  const { role: myRole } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("cutter");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [editMember, setEditMember] = useState<{ user_id: string; name: string; role: string } | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["team-overview"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (!roles?.length) return [];

      const userIds = roles.map((r) => r.user_id);
      const [{ data: profiles }, { data: pieces }, { data: clients }, { data: taskData }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, email").in("user_id", userIds),
        supabase.from("content_pieces").select("id, client_id, assigned_to, phase, type").in("assigned_to", userIds),
        supabase.from("clients").select("id, name"),
        supabase.from("tasks" as any).select("id, assigned_to, is_completed").in("assigned_to", userIds).eq("is_completed", false),
      ]);

      return (profiles ?? []).map((profile) => {
        const userPieces = pieces?.filter((p) => p.assigned_to === profile.user_id) ?? [];
        const byPhase: Record<string, number> = {};
        userPieces.forEach((p) => { byPhase[p.phase] = (byPhase[p.phase] || 0) + 1; });
        const byClient = (clients ?? [])
          .map((client) => ({ clientName: client.name, count: userPieces.filter((p) => p.client_id === client.id).length }))
          .filter((c) => c.count > 0);

        return {
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          role: roles.find((r) => r.user_id === profile.user_id)?.role ?? "cutter",
          totalPieces: userPieces.length,
          editingCount: byPhase["editing"] || 0,
          reviewCount: byPhase["review"] || 0,
          byPhase,
          byClient,
        };
      });
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: { email: inviteEmail, role: inviteRole, name: inviteName || undefined },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Fehler beim Einladen");
      } else {
        toast.success(`Einladung an ${inviteEmail} gesendet!`);
        setInviteOpen(false);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("cutter");
        qc.invalidateQueries({ queryKey: ["team-overview"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setInviteLoading(false);
  };

  const handleUpdate = async () => {
    if (!editMember) return;
    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-team-member", {
        body: { user_id: editMember.user_id, role: editRole, name: editName || undefined },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Fehler");
      } else {
        toast.success("Aktualisiert");
        setEditMember(null);
        qc.invalidateQueries({ queryKey: ["team-overview"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setEditLoading(false);
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`${name} wirklich aus dem Team entfernen?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("update-team-member", {
        body: { user_id: userId, action: "delete" },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Fehler");
      } else {
        toast.success(`${name} entfernt`);
        qc.invalidateQueries({ queryKey: ["team-overview"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isAdmin = myRole === "admin";

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold tracking-tight">Team</h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Teammitglieder verwalten und Arbeitslast überblicken
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)} size="sm" className="gap-1.5 font-mono text-xs">
            <Plus className="h-3.5 w-3.5" /> Einladen
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-card border border-border" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-mono text-xs text-muted-foreground mb-4">Noch keine Teammitglieder</p>
          {isAdmin && (
            <Button onClick={() => setInviteOpen(true)} variant="outline" size="sm" className="gap-1.5 font-mono text-xs">
              <Mail className="h-3.5 w-3.5" /> Erstes Mitglied einladen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.map((member, i) => (
            <motion.div
              key={member.user_id}
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0">
                        {ROLE_LABELS[member.role] || member.role}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{member.email}</span>
                    </div>
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
                  {isAdmin && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => {
                          setEditMember({ user_id: member.user_id, name: member.name || "", role: member.role });
                          setEditRole(member.role);
                          setEditName(member.name || "");
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.user_id, member.name || "Mitglied")}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

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

              {member.byClient.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/50">
                  {member.byClient.map((c) => (
                    <span key={c.clientName} className="rounded-md bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                      {c.clientName}: {c.count}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Teammitglied einladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-body text-sm text-muted-foreground">Name</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Max Mustermann"
                className="bg-card border-border font-body"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-sm text-muted-foreground">E-Mail *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="max@beispiel.de"
                required
                className="bg-card border-border font-body"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-sm text-muted-foreground">Rolle *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-card border-border font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cutter">Cutter</SelectItem>
                  <SelectItem value="head_of_content">Head of Content</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} className="font-mono text-xs">
              Abbrechen
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviteLoading} className="gap-1.5 font-mono text-xs">
              <Mail className="h-3.5 w-3.5" />
              {inviteLoading ? "Wird gesendet..." : "Einladung senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Mitglied bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-body text-sm text-muted-foreground">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-card border-border font-body"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-sm text-muted-foreground">Rolle</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="bg-card border-border font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cutter">Cutter</SelectItem>
                  <SelectItem value="head_of_content">Head of Content</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditMember(null)} className="font-mono text-xs">
              Abbrechen
            </Button>
            <Button onClick={handleUpdate} disabled={editLoading} className="font-mono text-xs">
              {editLoading ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TeamOverview;
