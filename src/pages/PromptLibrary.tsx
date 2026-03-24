import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy, Check, Pencil, BookmarkIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ErrorBoundary from "@/components/ErrorBoundary";

const CATEGORIES = [
  { value: "caption", label: "Caption" },
  { value: "refine", label: "Anpassung" },
  { value: "transcript", label: "Transkript" },
  { value: "other", label: "Sonstiges" },
];

const PromptLibrary = () => {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const canEdit = role === "admin" || role === "head_of_content";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [category, setCategory] = useState("caption");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("all");

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["saved-prompts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_prompts")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = filterCat === "all" ? prompts : prompts.filter((p: any) => p.category === filterCat);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        await supabase.from("saved_prompts").update({ name, prompt_text: promptText, category }).eq("id", editingId);
      } else {
        await supabase.from("saved_prompts").insert({ name, prompt_text: promptText, category, created_by: user?.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-prompts"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? "Prompt aktualisiert" : "Prompt gespeichert");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("saved_prompts").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-prompts"] });
      toast.success("Prompt gelöscht");
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPromptText("");
    setCategory("caption");
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name);
    setPromptText(p.prompt_text);
    setCategory(p.category || "caption");
    setDialogOpen(true);
  };

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Prompt-Bibliothek</h1>
            <p className="text-sm text-muted-foreground mt-1">Gespeicherte Prompts für Caption-Generierung und KI-Anpassungen</p>
          </div>
          {canEdit && (
            <Button className="gap-2" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Neuer Prompt
            </Button>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={filterCat === "all" ? "default" : "outline"}
            className="h-8 text-xs font-mono"
            onClick={() => setFilterCat("all")}
          >
            Alle ({prompts.length})
          </Button>
          {CATEGORIES.map(c => {
            const count = prompts.filter((p: any) => p.category === c.value).length;
            return (
              <Button
                key={c.value}
                size="sm"
                variant={filterCat === c.value ? "default" : "outline"}
                className="h-8 text-xs font-mono"
                onClick={() => setFilterCat(c.value)}
              >
                {c.label} ({count})
              </Button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookmarkIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Prompts gespeichert</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((p: any) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                          {CATEGORIES.find(c => c.value === p.category)?.label || p.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{p.prompt_text}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyPrompt(p.id, p.prompt_text)}>
                        {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-[hsl(var(--runway-green))]" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      {canEdit && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Prompt bearbeiten" : "Neuer Prompt"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. 'Kurze Caption für Reels'" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Kategorie</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Prompt</label>
                <Textarea
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder="Den Prompt-Text hier eingeben..."
                  rows={6}
                  className="resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || !promptText.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? "Speichere..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default PromptLibrary;
