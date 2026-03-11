import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Globe, Trash2, Eye, EyeOff, ExternalLink, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

interface LandingPagesListProps {
  clientId: string;
  canEdit: boolean;
}

const LandingPagesList = ({ clientId, canEdit }: LandingPagesListProps) => {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEditUrl, setNewEditUrl] = useState("");
  const [newPublishedUrl, setNewPublishedUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing-pages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addPage = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("landing_pages").insert({
      client_id: clientId,
      title: newTitle.trim(),
      edit_url: newEditUrl.trim() || null,
      published_url: newPublishedUrl.trim() || null,
    });
    setSaving(false);
    if (error) toast.error("Fehler beim Erstellen");
    else {
      toast.success("Landing Page hinzugefügt");
      qc.invalidateQueries({ queryKey: ["landing-pages", clientId] });
      setShowAdd(false);
      setNewTitle("");
      setNewEditUrl("");
      setNewPublishedUrl("");
    }
  };

  const deletePage = async (id: string) => {
    if (!confirm("Landing Page wirklich löschen?")) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) toast.error("Fehler beim Löschen");
    else {
      toast.success("Landing Page gelöscht");
      qc.invalidateQueries({ queryKey: ["landing-pages", clientId] });
    }
  };

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase.from("landing_pages").update({ is_published: !current }).eq("id", id);
    if (error) toast.error("Fehler");
    else {
      qc.invalidateQueries({ queryKey: ["landing-pages", clientId] });
      toast.success(!current ? "Landing Page veröffentlicht" : "Landing Page auf Entwurf gesetzt");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-display text-base font-semibold">Landing Pages</h2>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Hinzufügen
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : !pages?.length ? (
        <div className="p-8 text-center">
          <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Noch keine Landing Pages</p>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 h-8 text-xs gap-1.5"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Erste Landing Page hinzufügen
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {pages.map((page: any, i: number) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors group"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{page.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(page.created_at), "dd. MMM yyyy", { locale: de })}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {page.edit_url && (
                  <a href={page.edit_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Bearbeiten">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
                {page.published_url && page.is_published && (
                  <a href={page.published_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Veröffentlichte Seite öffnen">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => togglePublish(page.id, page.is_published)}
                    >
                      {page.is_published ? (
                        <Eye className="h-3.5 w-3.5 text-[hsl(var(--runway-green))]" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deletePage(page.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
              <div
                className={`h-2 w-2 rounded-full shrink-0 ${
                  page.is_published ? "bg-[hsl(var(--runway-green))]" : "bg-muted-foreground/30"
                }`}
              />
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Landing Page hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lp-title">Titel</Label>
              <Input
                id="lp-title"
                placeholder="z.B. Hauptseite Redesign"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-edit">Bearbeitungslink (Lovable-Projekt)</Label>
              <Input
                id="lp-edit"
                placeholder="https://lovable.dev/projects/..."
                value={newEditUrl}
                onChange={(e) => setNewEditUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-published">Veröffentlichter Link</Label>
              <Input
                id="lp-published"
                placeholder="https://kunde.lovable.app oder Custom Domain"
                value={newPublishedUrl}
                onChange={(e) => setNewPublishedUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Abbrechen</Button>
            <Button onClick={addPage} disabled={!newTitle.trim() || saving}>
              {saving ? "Speichern…" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPagesList;
