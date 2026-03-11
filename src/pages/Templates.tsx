import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Pencil, Trash2, Eye, Loader2, LayoutTemplate, Search } from "lucide-react";

const Templates = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = role === "admin" || role === "head_of_content";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["landing-page-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("landing_page_templates")
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          category: editCategory.trim() || "allgemein",
        })
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vorlage aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["landing-page-templates"] });
      setEditDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_page_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vorlage gelöscht");
      queryClient.invalidateQueries({ queryKey: ["landing-page-templates"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditDescription(t.description || "");
    setEditCategory(t.category || "allgemein");
    setEditDialogOpen(true);
  };

  const categories = [...new Set((templates || []).map((t) => t.category || "allgemein"))];

  const filtered = (templates || []).filter((t) => {
    if (categoryFilter && (t.category || "allgemein") !== categoryFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutTemplate className="h-6 w-6 text-primary" />
              Vorlagen
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gespeicherte Landing-Page-Vorlagen verwalten
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Vorlage suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={categoryFilter === null ? "default" : "outline"}
              onClick={() => setCategoryFilter(null)}
            >
              Alle
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? "default" : "outline"}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Keine Vorlagen gefunden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                      {t.category || "allgemein"}
                    </Badge>
                  </div>

                  <p className="text-[10px] text-muted-foreground/60">
                    {new Date(t.created_at).toLocaleDateString("de-DE")}
                  </p>

                  <div className="flex gap-2 mt-auto pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => setPreviewHtml(t.html_content)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Vorschau
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 gap-1.5 text-xs"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Vorlagen-Vorschau</DialogTitle>
          </DialogHeader>
          <iframe
            srcDoc={previewHtml || ""}
            className="flex-1 w-full border border-border rounded-lg"
            sandbox="allow-scripts"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vorlage bearbeiten</DialogTitle>
            <DialogDescription>Name, Beschreibung und Kategorie ändern.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Beschreibung</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1 min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs">Kategorie</Label>
              <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editName.trim()}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Templates;
