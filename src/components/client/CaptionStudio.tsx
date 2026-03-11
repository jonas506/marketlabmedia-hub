import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, Copy, Check, Loader2, Wand2, RotateCcw, FileText, ChevronDown, ChevronUp, BookmarkIcon } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CaptionPiece {
  id: string;
  title: string | null;
  type: string;
  caption?: string | null;
  script_text?: string | null;
  phase: string;
}

interface CaptionStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: CaptionPiece[];
  clientId: string;
}

const CaptionStudio: React.FC<CaptionStudioProps> = ({ open, onOpenChange, pieces, clientId }) => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [editingCaption, setEditingCaption] = useState<Record<string, string>>({});
  const [refineInput, setRefineInput] = useState<Record<string, string>>({});
  const [showRefine, setShowRefine] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === pieces.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pieces.map(p => p.id)));
    }
  };

  const selectWithoutCaption = () => {
    setSelected(new Set(pieces.filter(p => !p.caption).map(p => p.id)));
  };

  const generateSingle = useCallback(async (pieceId: string) => {
    setGenerating(prev => new Set(prev).add(pieceId));
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", {
        body: { action: "generate", piece_id: pieceId },
      });
      if (error) throw error;
      if (data?.caption) {
        setEditingCaption(prev => ({ ...prev, [pieceId]: data.caption }));
        qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      }
    } catch (err: any) {
      toast.error("Fehler", { description: err.message || "Caption konnte nicht generiert werden" });
    } finally {
      setGenerating(prev => { const s = new Set(prev); s.delete(pieceId); return s; });
    }
  }, [clientId, qc]);

  const bulkGenerate = useCallback(async () => {
    const ids = [...selected];
    if (!ids.length) { toast.error("Bitte mindestens ein Piece auswählen"); return; }
    setBulkGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", {
        body: { action: "bulk_generate", piece_ids: ids },
      });
      if (error) throw error;
      if (data?.results) {
        const newCaptions: Record<string, string> = {};
        let successCount = 0;
        for (const r of data.results) {
          if (r.caption) { newCaptions[r.id] = r.caption; successCount++; }
        }
        setEditingCaption(prev => ({ ...prev, ...newCaptions }));
        qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
        toast.success(`${successCount}/${ids.length} Captions generiert!`);
      }
    } catch (err: any) {
      toast.error("Bulk-Generierung fehlgeschlagen", { description: err.message });
    } finally {
      setBulkGenerating(false);
    }
  }, [selected, clientId, qc]);

  const refineSingle = useCallback(async (pieceId: string) => {
    const instruction = refineInput[pieceId];
    const currentCaption = editingCaption[pieceId] || pieces.find(p => p.id === pieceId)?.caption || "";
    if (!instruction?.trim()) { toast.error("Bitte Anweisung eingeben"); return; }
    
    setGenerating(prev => new Set(prev).add(pieceId));
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", {
        body: { action: "refine", piece_id: pieceId, current_caption: currentCaption, instruction },
      });
      if (error) throw error;
      if (data?.caption) {
        setEditingCaption(prev => ({ ...prev, [pieceId]: data.caption }));
        setRefineInput(prev => ({ ...prev, [pieceId]: "" }));
        setShowRefine(prev => ({ ...prev, [pieceId]: false }));
        qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
        toast.success("Caption angepasst!");
      }
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setGenerating(prev => { const s = new Set(prev); s.delete(pieceId); return s; });
    }
  }, [refineInput, editingCaption, pieces, clientId, qc]);

  const saveCaption = useCallback(async (pieceId: string, caption: string) => {
    await supabase.from("content_pieces").update({ caption }).eq("id", pieceId);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    toast.success("Caption gespeichert");
  }, [clientId, qc]);

  const copyCaption = (pieceId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(pieceId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const TYPE_EMOJI: Record<string, string> = { reel: "🎬", carousel: "📸", story: "📱", ad: "📢" };
  const piecesWithCaptions = pieces.filter(p => p.caption || editingCaption[p.id]);
  const piecesWithoutCaptions = pieces.filter(p => !p.caption && !editingCaption[p.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Caption Studio
            <span className="text-sm font-mono text-muted-foreground ml-2">
              {piecesWithCaptions.length}/{pieces.length} Captions
            </span>
          </DialogTitle>
          
          {/* Bulk actions bar */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs font-mono gap-1"
              onClick={toggleAll}
            >
              <Checkbox checked={selected.size === pieces.length && pieces.length > 0} className="h-3 w-3" />
              {selected.size === pieces.length ? "Keine" : "Alle"}
            </Button>
            {piecesWithoutCaptions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-mono"
                onClick={selectWithoutCaption}
              >
                Ohne Caption ({piecesWithoutCaptions.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs font-mono gap-1.5 ml-auto"
              disabled={selected.size === 0 || bulkGenerating}
              onClick={bulkGenerate}
            >
              {bulkGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {bulkGenerating
                ? "Generiere..."
                : `${selected.size} Caption${selected.size !== 1 ? "s" : ""} generieren`}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            <AnimatePresence initial={false}>
              {pieces.map((piece, idx) => {
                const caption = editingCaption[piece.id] ?? piece.caption ?? "";
                const isGenerating = generating.has(piece.id);
                const isExpanded = expandedId === piece.id;
                const hasCaption = !!caption;

                return (
                  <motion.div
                    key={piece.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      "rounded-lg border transition-colors",
                      isExpanded ? "border-primary/30 bg-card" : "border-border bg-card/60 hover:bg-card",
                    )}
                  >
                    {/* Collapsed row */}
                    <div className="flex items-center gap-3 px-4 py-2.5 min-h-[44px]">
                      <Checkbox
                        checked={selected.has(piece.id)}
                        onCheckedChange={() => toggleSelect(piece.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="text-sm shrink-0">{TYPE_EMOJI[piece.type] || "📄"}</span>
                      <span className="text-sm font-medium truncate flex-1 min-w-0">
                        {piece.title || "Ohne Titel"}
                      </span>

                      {/* Status indicator */}
                      {hasCaption ? (
                        <span className="h-5 px-2 rounded-full bg-[hsl(var(--runway-green))]/15 text-[hsl(var(--runway-green))] text-[10px] font-mono flex items-center gap-1 shrink-0">
                          <Check className="h-2.5 w-2.5" /> Caption
                        </span>
                      ) : (
                        <span className="h-5 px-2 rounded-full bg-muted text-muted-foreground text-[10px] font-mono shrink-0">
                          Keine Caption
                        </span>
                      )}

                      {/* Quick actions */}
                      {!isGenerating && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => generateSingle(piece.id)}
                          title={hasCaption ? "Neu generieren" : "Generieren"}
                        >
                          {hasCaption ? <RotateCcw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      {isGenerating && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      )}
                      {hasCaption && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => copyCaption(piece.id, caption)}
                        >
                          {copiedId === piece.id
                            ? <Check className="h-3.5 w-3.5 text-[hsl(var(--runway-green))]" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => setExpandedId(isExpanded ? null : piece.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>

                    {/* Expanded panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                            {/* Editable caption */}
                            <div>
                              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
                                Caption
                              </label>
                              <Textarea
                                value={editingCaption[piece.id] ?? piece.caption ?? ""}
                                placeholder="Caption hier eingeben oder generieren lassen..."
                                className="text-sm border-border bg-background/50 rounded-md resize-y min-h-[80px] max-h-[200px]"
                                rows={4}
                                onChange={(e) => setEditingCaption(prev => ({ ...prev, [piece.id]: e.target.value }))}
                              />
                              <div className="flex items-center gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs font-mono gap-1"
                                  onClick={() => saveCaption(piece.id, editingCaption[piece.id] ?? piece.caption ?? "")}
                                >
                                  Speichern
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-mono gap-1"
                                  onClick={() => copyCaption(piece.id, editingCaption[piece.id] ?? piece.caption ?? "")}
                                >
                                  {copiedId === piece.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                  Kopieren
                                </Button>
                                <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                                  {(editingCaption[piece.id] ?? piece.caption ?? "").length}/2200
                                </span>
                              </div>
                            </div>

                            {/* AI Refine */}
                            {hasCaption && (
                              <div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs font-mono gap-1 text-muted-foreground"
                                  onClick={() => setShowRefine(prev => ({ ...prev, [piece.id]: !prev[piece.id] }))}
                                >
                                  <Wand2 className="h-3 w-3" />
                                  Mit KI anpassen
                                </Button>
                                <AnimatePresence>
                                  {showRefine[piece.id] && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="flex gap-2 mt-2">
                                        <Input
                                          value={refineInput[piece.id] || ""}
                                          placeholder="z.B. 'Kürzer machen' oder 'Mehr Emojis' oder 'Professioneller'"
                                          className="h-8 text-xs flex-1 bg-background/50"
                                          onChange={(e) => setRefineInput(prev => ({ ...prev, [piece.id]: e.target.value }))}
                                          onKeyDown={(e) => e.key === "Enter" && refineSingle(piece.id)}
                                        />
                                        <Button
                                          size="sm"
                                          className="h-8 text-xs font-mono gap-1"
                                          disabled={isGenerating}
                                          onClick={() => refineSingle(piece.id)}
                                        >
                                          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                          Anpassen
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {/* Script text preview */}
                            {piece.script_text && (
                              <details className="group">
                                <summary className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground">
                                  Skript anzeigen
                                </summary>
                                <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-1 whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                                  {piece.script_text}
                                </p>
                              </details>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {pieces.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Keine Content Pieces für diesen Monat vorhanden.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CaptionStudio;
