import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import SopBoard, { type BoardData } from "@/components/sop/SopBoard";

interface SopTemplate {
  id: string;
  name: string;
  category: string | null;
  trigger_type: string | null;
  created_at: string;
  board_data: BoardData | null;
}

const CATEGORY_OPTIONS = [
  "Sales", "Onboarding", "Content-Produktion", "Drehtag",
  "Post-Production", "Kampagne", "Organisch", "Intern",
];

const CATEGORY_COLORS: Record<string, string> = {
  sales: "bg-emerald-500/15 text-emerald-400",
  onboarding: "bg-blue-500/15 text-blue-400",
  "content-produktion": "bg-purple-500/15 text-purple-400",
  drehtag: "bg-amber-500/15 text-amber-400",
  "post-production": "bg-rose-500/15 text-rose-400",
  kampagne: "bg-cyan-500/15 text-cyan-400",
  organisch: "bg-lime-500/15 text-lime-400",
  intern: "bg-slate-500/15 text-slate-400",
};

const getCategoryColor = (cat: string) =>
  CATEGORY_COLORS[cat.toLowerCase()] || "bg-primary/15 text-primary";

const SOPs = () => {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canEdit = role === "admin" || role === "head_of_content";

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [triggerType, setTriggerType] = useState<string>("none");
  const [activeBoard, setActiveBoard] = useState<SopTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["sop-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sop_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map(t => ({
        ...t,
        board_data: t.board_data as BoardData | null,
      })) as SopTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name ist erforderlich");
      const trigger = triggerType === "none" ? null : triggerType;
      const { data, error } = await supabase
        .from("sop_templates")
        .insert({ name: name.trim(), category: category.trim() || null, trigger_type: trigger })
        .select("*")
        .single();
      if (error) throw error;
      return { ...data, board_data: (data as any).board_data as BoardData | null } as SopTemplate;
    },
    onSuccess: (tpl) => {
      qc.invalidateQueries({ queryKey: ["sop-templates"] });
      toast.success("SOP erstellt");
      setCreateOpen(false);
      setName(""); setCategory(""); setTriggerType("none");
      setActiveBoard(tpl);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sop_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sop-templates"] }); toast.success("SOP gelöscht"); },
  });

  if (activeBoard) {
    return (
      <SopBoard
        templateId={activeBoard.id}
        templateName={activeBoard.name}
        initialBoard={activeBoard.board_data || { nodes: [], connections: [] }}
        onBack={() => { setActiveBoard(null); qc.invalidateQueries({ queryKey: ["sop-templates"] }); }}
        canEdit={canEdit}
        category={activeBoard.category}
        allTemplates={templates.map(t => ({ id: t.id, name: t.name, category: t.category, board_data: t.board_data }))}
        onSwitchTemplate={(tpl) => {
          const full = templates.find(t => t.id === tpl.id);
          if (full) setActiveBoard(full);
        }}
      />
    );
  }

  // Group by category
  const grouped = templates.reduce<Record<string, SopTemplate[]>>((acc, t) => {
    const cat = t.category || "Ungekategorisiert";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">SOP-Boards</h1>
            <p className="text-sm text-muted-foreground mt-1">Visuelle Prozess-Flowcharts erstellen und verwalten</p>
          </div>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Neues Board
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine SOP-Boards erstellt</p>
            {canEdit && (
              <Button onClick={() => setCreateOpen(true)} variant="outline" size="sm" className="mt-4 gap-2">
                <Plus className="h-3.5 w-3.5" /> Erstes Board erstellen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, tpls]) => (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {tpls.map((tpl) => {
                      const nodeCount = tpl.board_data?.nodes?.length || 0;
                      const connCount = tpl.board_data?.connections?.length || 0;
                      return (
                        <motion.div
                          key={tpl.id} layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className={cn(
                            "rounded-lg border border-border bg-card p-4 transition-all group",
                            "cursor-pointer hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                          )}
                          onClick={() => setActiveBoard(tpl)}
                        >
                          <div className="h-24 rounded-md bg-background/50 border border-border/50 mb-3 overflow-hidden relative">
                            {nodeCount > 0 ? (
                              <svg className="w-full h-full" viewBox="0 0 400 200">
                                {tpl.board_data!.connections.map(conn => {
                                  const from = tpl.board_data!.nodes.find(n => n.id === conn.from);
                                  const to = tpl.board_data!.nodes.find(n => n.id === conn.to);
                                  if (!from || !to) return null;
                                  return (
                                    <line key={conn.id}
                                      x1={from.x + from.w / 2} y1={from.y + from.h / 2}
                                      x2={to.x + to.w / 2} y2={to.y + to.h / 2}
                                      stroke="hsl(var(--muted-foreground))" strokeWidth={1} opacity={0.4}
                                    />
                                  );
                                })}
                                {tpl.board_data!.nodes.map(node => (
                                  <rect key={node.id}
                                    x={node.x} y={node.y} width={node.w} height={node.h}
                                    rx={node.type === "start" || node.type === "end" ? 20 : node.type === "decision" ? 0 : 4}
                                    fill={node.color + "33"} stroke={node.color} strokeWidth={1}
                                  />
                                ))}
                              </svg>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <GitBranch className="h-6 w-6 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-2">
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
                                <span className="font-mono">{nodeCount} Nodes</span>
                                <span className="font-mono">{connCount} Verbindungen</span>
                                {tpl.trigger_type && <Zap className="h-3 w-3 text-amber-400" />}
                              </div>
                            </div>
                            {canEdit && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); if (confirm("SOP-Board löschen?")) deleteMutation.mutate(tpl.id); }}
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
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Neues SOP-Board</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Erstelle ein neues Board und nutze KI zum Generieren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Kunden-Onboarding" className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kategorie</Label>
                <Select value={category || "none"} onValueChange={v => setCategory(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine</SelectItem>
                    {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trigger</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Trigger</SelectItem>
                    <SelectItem value="new_client">Neuer Kunde</SelectItem>
                    <SelectItem value="new_month">Neuer Monat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Erstellen..." : "Board erstellen & öffnen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SOPs;
