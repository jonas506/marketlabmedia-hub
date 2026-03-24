import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronRight, ClipboardCheck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface Props {
  clientId: string;
  canEdit: boolean;
}

interface Checklist {
  id: string;
  client_id: string;
  template_id: string | null;
  name: string;
  category: string | null;
  status: string;
  month: number | null;
  year: number | null;
  created_at: string;
}

interface ChecklistStep {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  is_completed: boolean;
  sort_order: number;
  completed_at: string | null;
}

interface SopTemplate {
  id: string;
  name: string;
  category: string | null;
}

interface SopStep {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  default_role: string | null;
  sort_order: number;
}

interface Profile {
  id: string;
  user_id: string;
  name: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  onboarding: "bg-emerald-500/15 text-emerald-400",
  dreh: "bg-blue-500/15 text-blue-400",
  schnitt: "bg-purple-500/15 text-purple-400",
  skripte: "bg-amber-500/15 text-amber-400",
  tools: "bg-rose-500/15 text-rose-400",
  monatsplanung: "bg-cyan-500/15 text-cyan-400",
};

const getCategoryColor = (cat: string) =>
  CATEGORY_COLORS[cat.toLowerCase()] || "bg-primary/15 text-primary";

const ClientChecklists = ({ clientId, canEdit }: Props) => {
  const qc = useQueryClient();
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());

  const { data: checklists = [] } = useQuery({
    queryKey: ["checklists", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Checklist[];
    },
  });

  const { data: allChecklistSteps = [] } = useQuery({
    queryKey: ["checklist-steps", clientId],
    queryFn: async () => {
      if (checklists.length === 0) return [];
      const ids = checklists.map((c) => c.id);
      const { data, error } = await supabase
        .from("checklist_steps")
        .select("*")
        .in("checklist_id", ids)
        .order("sort_order");
      if (error) throw error;
      return data as ChecklistStep[];
    },
    enabled: checklists.length > 0,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["sop-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sop_templates").select("*");
      if (error) throw error;
      return data as SopTemplate[];
    },
  });

  const { data: templateSteps = [] } = useQuery({
    queryKey: ["sop-template-steps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sop_template_steps").select("*").order("sort_order");
      if (error) throw error;
      return data as SopStep[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, user_id, name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as UserRole[];
    },
  });

  const stepsMap = allChecklistSteps.reduce<Record<string, ChecklistStep[]>>((acc, s) => {
    if (!acc[s.checklist_id]) acc[s.checklist_id] = [];
    acc[s.checklist_id].push(s);
    return acc;
  }, {});

  const getUserByRole = (role: string): string | null => {
    const ur = userRoles.find((r) => r.role === role);
    return ur ? ur.user_id : null;
  };

  const getProfileName = (userId: string | null): string => {
    if (!userId) return "—";
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.name || "—";
  };

  const createFromTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) throw new Error("Vorlage nicht gefunden");

      const tplSteps = templateSteps.filter((s) => s.template_id === templateId);

      const { data: checklist, error } = await supabase
        .from("checklists")
        .insert({
          client_id: clientId,
          template_id: templateId,
          name: tpl.name,
          category: tpl.category,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (tplSteps.length > 0) {
        const stepsToInsert = tplSteps.map((s) => ({
          checklist_id: checklist.id,
          title: s.title,
          description: s.description,
          assigned_to: s.default_role ? getUserByRole(s.default_role) : null,
          sort_order: s.sort_order,
        }));
        const { error: stepsError } = await supabase.from("checklist_steps").insert(stepsToInsert);
        if (stepsError) throw stepsError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists", clientId] });
      qc.invalidateQueries({ queryKey: ["checklist-steps", clientId] });
      toast.success("Checkliste erstellt");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStep = useMutation({
    mutationFn: async ({ stepId, completed }: { stepId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("checklist_steps")
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", stepId);
      if (error) throw error;

      const step = allChecklistSteps.find((s) => s.id === stepId);
      if (step && completed) {
        const clSteps = allChecklistSteps.filter((s) => s.checklist_id === step.checklist_id);
        const allDone = clSteps.every((s) => (s.id === stepId ? true : s.is_completed));
        if (allDone) {
          await supabase.from("checklists").update({ status: "completed" }).eq("id", step.checklist_id);

          // Check if this was an onboarding checklist and all onboarding is done
          const { data: checklist } = await supabase
            .from("checklists")
            .select("category, client_id")
            .eq("id", step.checklist_id)
            .single();

          if (checklist?.category === "onboarding") {
            const { data: openOnboarding } = await supabase
              .from("checklists")
              .select("id")
              .eq("client_id", checklist.client_id)
              .eq("category", "onboarding")
              .neq("status", "done")
              .neq("status", "completed");

            if (!openOnboarding || openOnboarding.length === 0) {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#0083F7", "#21089B", "#10B981", "#F59E0B"],
              });
              toast.success("🎉 Onboarding abgeschlossen!", {
                description: "Alle Onboarding-Schritte sind erledigt. Der Kunde ist jetzt aktiv.",
                duration: 6000,
              });
            }
          }
        }
      } else if (step && !completed) {
        await supabase.from("checklists").update({ status: "open" }).eq("id", step.checklist_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists", clientId] });
      qc.invalidateQueries({ queryKey: ["checklist-steps", clientId] });
      qc.invalidateQueries({ queryKey: ["my-checklist-steps"] });
      qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
      qc.invalidateQueries({ queryKey: ["onboarding-progress"] });
      qc.invalidateQueries({ queryKey: ["onboarding-overview"] });
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async ({ stepId, userId }: { stepId: string; userId: string | null }) => {
      const { error } = await supabase
        .from("checklist_steps")
        .update({ assigned_to: userId })
        .eq("id", stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-steps", clientId] });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedChecklists((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDesc = (id: string) => {
    setExpandedDescs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openChecklists = checklists.filter((c) => c.status === "open");
  const completedChecklists = checklists.filter((c) => c.status === "completed");

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-elevated border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-emerald-500" />
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">Checklisten</h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {openChecklists.length} offen
          </span>
        </div>
        {canEdit && templates.length > 0 && (
          <Select onValueChange={(v) => createFromTemplate.mutate(v)}>
            <SelectTrigger className="w-auto h-8 gap-2 text-xs bg-transparent border-dashed">
              <Plus className="h-3 w-3" />
              <SelectValue placeholder="Aus Vorlage erstellen" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {checklists.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground/40 font-mono">
          Keine Checklisten vorhanden
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {[...openChecklists, ...completedChecklists].map((cl) => {
            const clSteps = stepsMap[cl.id] || [];
            const doneCount = clSteps.filter((s) => s.is_completed).length;
            const totalCount = clSteps.length;
            const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
            const isExpanded = expandedChecklists.has(cl.id);
            const isCompleted = cl.status === "completed";

            return (
              <div key={cl.id} className={cn(isCompleted && "opacity-60")}>
                {/* Collapsed header */}
                <button
                  onClick={() => toggleExpanded(cl.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                  <span className={cn("font-display text-sm font-medium flex-1 truncate", isCompleted && "line-through")}>{cl.name}</span>
                  {cl.category && (
                    <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 h-[18px] rounded border-0 shrink-0", getCategoryColor(cl.category))}>
                      {cl.category}
                    </Badge>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {doneCount}/{totalCount}
                  </span>
                  <div className="w-16 shrink-0">
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  {isCompleted && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-[18px] rounded border-0 bg-emerald-500/15 text-emerald-400 shrink-0">
                      ✓ Erledigt
                    </Badge>
                  )}
                </button>

                {/* Expanded steps */}
                {isExpanded && (
                  <div className="border-t border-border/20 bg-background/30">
                    {clSteps.map((step) => (
                      <div
                        key={step.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-2.5 pl-10 border-b border-border/10 last:border-0",
                          step.is_completed && "opacity-50"
                        )}
                      >
                        <Checkbox
                          checked={step.is_completed}
                          onCheckedChange={(v) => toggleStep.mutate({ stepId: step.id, completed: !!v })}
                          className="mt-0.5 shrink-0"
                          disabled={!canEdit && step.assigned_to === null}
                        />
                        <div className="flex-1 min-w-0">
                          <span className={cn("text-sm font-body", step.is_completed && "line-through text-muted-foreground")}>
                            {step.title}
                          </span>
                          {step.description && (
                            <button
                              onClick={() => toggleDesc(step.id)}
                              className="block text-[10px] text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
                            >
                              {expandedDescs.has(step.id) ? "▾ Beschreibung" : "▸ Beschreibung"}
                            </button>
                          )}
                          {step.description && expandedDescs.has(step.id) && (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed bg-muted/20 rounded p-2">
                              {step.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {canEdit ? (
                            <Select
                              value={step.assigned_to || "none"}
                              onValueChange={(v) => updateAssignment.mutate({ stepId: step.id, userId: v === "none" ? null : v })}
                            >
                              <SelectTrigger className="w-28 h-7 text-[10px] bg-transparent border-0">
                                <SelectValue placeholder="Zuweisen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Niemand</SelectItem>
                                {profiles.map((p) => (
                                  <SelectItem key={p.user_id} value={p.user_id}>
                                    {p.name || p.user_id.slice(0, 8)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">{getProfileName(step.assigned_to)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientChecklists;
