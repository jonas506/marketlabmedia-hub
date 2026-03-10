import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, FileText, GripVertical, Trash2, ChevronDown, ChevronUp, Zap, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SopTemplate {
  id: string;
  name: string;
  category: string | null;
  trigger_type: string | null;
  created_at: string;
}

interface SopStep {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  default_role: string | null;
  sort_order: number;
}

interface StepDraft {
  id?: string;
  title: string;
  description: string;
  default_role: string;
  expanded: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  new_client: "Neuer Kunde angelegt",
  new_month: "Neuer Monat beginnt",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_of_content: "Head of Content",
  cutter: "Cutter",
};

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

const SOPs = () => {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canEdit = role === "admin" || role === "head_of_content";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SopTemplate | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [triggerType, setTriggerType] = useState<string>("none");
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["sop-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sop_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SopTemplate[];
    },
  });

  const { data: allSteps = [] } = useQuery({
    queryKey: ["sop-template-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sop_template_steps")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as SopStep[];
    },
  });

  const stepsMap = allSteps.reduce<Record<string, SopStep[]>>((acc, s) => {
    if (!acc[s.template_id]) acc[s.template_id] = [];
    acc[s.template_id].push(s);
    return acc;
  }, {});

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setCategory("");
    setTriggerType("none");
    setSteps([]);
    setDialogOpen(true);
  };

  const openEdit = async (tpl: SopTemplate) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setCategory(tpl.category || "");
    setTriggerType(tpl.trigger_type || "none");
    const tplSteps = stepsMap[tpl.id] || [];
    setSteps(
      tplSteps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description || "",
        default_role: s.default_role || "",
        expanded: false,
      }))
    );
    setDialogOpen(true);
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { title: "", description: "", default_role: "", expanded: true }]);
  };

  const updateStep = (idx: number, field: keyof StepDraft, value: any) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    setSteps((prev) => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name ist erforderlich");
      const trigger = triggerType === "none" ? null : triggerType;

      let templateId: string;

      if (editingTemplate) {
        const { error } = await supabase
          .from("sop_templates")
          .update({ name: name.trim(), category: category.trim() || null, trigger_type: trigger, updated_at: new Date().toISOString() })
          .eq("id", editingTemplate.id);
        if (error) throw error;
        templateId = editingTemplate.id;

        // Delete old steps and re-insert
        await supabase.from("sop_template_steps").delete().eq("template_id", templateId);
      } else {
        const { data, error } = await supabase
          .from("sop_templates")
          .insert({ name: name.trim(), category: category.trim() || null, trigger_type: trigger })
          .select("id")
          .single();
        if (error) throw error;
        templateId = data.id;
      }

      // Insert steps
      if (steps.length > 0) {
        const stepsToInsert = steps.filter((s) => s.title.trim()).map((s, i) => ({
          template_id: templateId,
          title: s.title.trim(),
          description: s.description.trim() || null,
          default_role: s.default_role || null,
          sort_order: i,
        }));
        if (stepsToInsert.length > 0) {
          const { error } = await supabase.from("sop_template_steps").insert(stepsToInsert);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sop-templates"] });
      qc.invalidateQueries({ queryKey: ["sop-template-steps"] });
      toast.success(editingTemplate ? "SOP aktualisiert" : "SOP erstellt");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sop_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sop-templates"] });
      qc.invalidateQueries({ queryKey: ["sop-template-steps"] });
      toast.success("SOP gelöscht");
    },
  });

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">SOP-Vorlagen</h1>
            <p className="text-sm text-muted-foreground mt-1">Standard Operating Procedures verwalten</p>
          </div>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Neue SOP
            </Button>
          )}
        </div>

        {/* Templates list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine SOPs erstellt</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {templates.map((tpl) => {
                const tplSteps = stepsMap[tpl.id] || [];
                return (
                  <motion.div
                    key={tpl.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "rounded-lg border border-border bg-card p-4 transition-colors",
                      canEdit && "cursor-pointer hover:border-primary/30"
                    )}
                    onClick={() => canEdit && openEdit(tpl)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold text-sm truncate">{tpl.name}</h3>
                          {tpl.category && (
                            <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 h-[18px] rounded border-0 shrink-0", getCategoryColor(tpl.category))}>
                              {tpl.category}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono">{tplSteps.length} Schritte</span>
                          {tpl.trigger_type && (
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-amber-400" />
                              {TRIGGER_LABELS[tpl.trigger_type]}
                            </span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("SOP löschen?")) deleteMutation.mutate(tpl.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingTemplate ? "SOP bearbeiten" : "Neue SOP erstellen"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Definiere Name, Kategorie, Trigger und die einzelnen Schritte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Kunden-Onboarding" className="bg-background/50" />
            </div>

            {/* Category + Trigger */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kategorie</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="z.B. Onboarding, Dreh" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trigger</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Trigger (manuell)</SelectItem>
                    <SelectItem value="new_client">Neuer Kunde angelegt</SelectItem>
                    <SelectItem value="new_month">Neuer Monat beginnt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schritte</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Schritt
                </Button>
              </div>

              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-border/50 bg-background/30 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-5 text-center">{idx + 1}</span>
                      <Input
                        value={step.title}
                        onChange={(e) => updateStep(idx, "title", e.target.value)}
                        placeholder="Schritt-Titel"
                        className="flex-1 h-8 text-sm bg-transparent border-0 focus-visible:ring-1"
                      />
                      <Select value={step.default_role || "none"} onValueChange={(v) => updateStep(idx, "default_role", v === "none" ? "" : v)}>
                        <SelectTrigger className="w-32 h-8 text-xs bg-transparent border-0">
                          <Users className="h-3 w-3 mr-1 shrink-0" />
                          <SelectValue placeholder="Rolle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keine</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="head_of_content">Head of Content</SelectItem>
                          <SelectItem value="cutter">Cutter</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => updateStep(idx, "expanded", !step.expanded)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        {step.expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {step.expanded && (
                      <div className="mt-2 pl-10">
                        <Textarea
                          value={step.description}
                          onChange={(e) => updateStep(idx, "description", e.target.value)}
                          placeholder="Beschreibung, Anleitung, Links..."
                          rows={2}
                          className="text-xs bg-background/50"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? "Speichern..." : editingTemplate ? "Aktualisieren" : "SOP erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SOPs;
