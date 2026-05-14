import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReferenceCard from "./ReferenceCard";
import AddReferenceDialog from "./AddReferenceDialog";
import AddFormatDialog from "./AddFormatDialog";
import { stageMeta, type ContentFormat, type FormatReference } from "./constants";

interface Props {
  formatId: string;
  isAdmin: boolean;
}

const FormatDetail: React.FC<Props> = ({ formatId, isAdmin }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addRefOpen, setAddRefOpen] = useState(false);
  const [editRef, setEditRef] = useState<FormatReference | null>(null);
  const [editFormatOpen, setEditFormatOpen] = useState(false);
  const [deleteRefId, setDeleteRefId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: format } = useQuery({
    queryKey: ["content_format", formatId],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_formats").select("*").eq("id", formatId).maybeSingle();
      if (error) throw error;
      return data as unknown as ContentFormat | null;
    },
  });

  const { data: references = [] } = useQuery({
    queryKey: ["format_references", formatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("format_references")
        .select("*")
        .eq("format_id", formatId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FormatReference[];
    },
  });

  const sorted = useMemo(() => {
    const own = references.filter((r) => r.is_own);
    const insp = references.filter((r) => !r.is_own);
    return [...own, ...insp];
  }, [references]);

  const meta = format ? stageMeta(format.funnel_stage) : null;

  const handleDelete = async () => {
    if (!deleteRefId) return;
    const ref = references.find((r) => r.id === deleteRefId);
    try {
      // Try to delete thumbnail from storage if present
      if (ref?.thumbnail_url) {
        const match = ref.thumbnail_url.match(/reference-thumbnails\/(.+?)(?:\?|$)/);
        if (match) await supabase.storage.from("reference-thumbnails").remove([match[1]]);
      }
      const { error } = await supabase.from("format_references").delete().eq("id", deleteRefId);
      if (error) throw error;
      toast.success("Referenz gelöscht");
      qc.invalidateQueries({ queryKey: ["format_references", formatId] });
      qc.invalidateQueries({ queryKey: ["format_reference_counts"] });
    } catch (e: any) {
      toast.error("Fehler", { description: e.message });
    } finally {
      setDeleteRefId(null);
    }
  };

  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = sorted.map((r) => r.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    // persist new sort_order
    try {
      await Promise.all(next.map((id, i) => supabase.from("format_references").update({ sort_order: i }).eq("id", id)));
      qc.invalidateQueries({ queryKey: ["format_references", formatId] });
    } catch (e: any) {
      toast.error("Sortierung fehlgeschlagen");
    }
    setDragId(null);
  };

  if (!format) {
    return <div className="p-6 text-sm text-muted-foreground">Lädt…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/referenzen")} className="gap-1 -ml-2 mb-2 h-8 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Button>
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-start gap-4">
            <div className="text-5xl leading-none">{format.emoji || "🎬"}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-semibold">{format.name}</h1>
                {meta && (
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.chipClass}`}>
                    {meta.label} · {meta.subtitle}
                  </span>
                )}
              </div>
              {format.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{format.description}</p>}
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setEditFormatOpen(true)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Format bearbeiten
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Referenzen <span className="text-muted-foreground font-normal">({references.length})</span>
        </h2>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditRef(null); setAddRefOpen(true); }} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Referenz hinzufügen
          </Button>
        )}
      </div>

      {references.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Noch keine Referenzen.</p>
          {isAdmin && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddRefOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Erste Referenz hinzufügen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sorted.map((r) => (
            <ReferenceCard
              key={r.id}
              reference={r}
              isAdmin={isAdmin}
              onEdit={() => { setEditRef(r); setAddRefOpen(true); }}
              onDelete={() => setDeleteRefId(r.id)}
              draggable
              onDragStart={() => setDragId(r.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(r.id)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <>
          <AddReferenceDialog
            open={addRefOpen}
            onOpenChange={(o) => { setAddRefOpen(o); if (!o) setEditRef(null); }}
            formatId={formatId}
            reference={editRef}
          />
          <AddFormatDialog open={editFormatOpen} onOpenChange={setEditFormatOpen} format={format} />
        </>
      )}

      <AlertDialog open={!!deleteRefId} onOpenChange={(o) => !o && setDeleteRefId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Referenz löschen?</AlertDialogTitle>
            <AlertDialogDescription>Dies kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-1" /> Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FormatDetail;
