import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, Check, Loader2, Wand2, Save, BookmarkIcon } from "lucide-react";
import { toast } from "sonner";
import PieceActivityLog from "@/components/client/PieceActivityLog";

interface PieceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: {
    id: string;
    title: string | null;
    type: string;
    caption?: string | null;
    transcript?: string | null;
    script_text?: string | null;
    video_path?: string | null;
    preview_link?: string | null;
    phase: string;
    client_id: string;
  } | null;
  clientId: string;
}

const TYPE_EMOJI: Record<string, string> = { reel: "🎬", carousel: "📸", story: "📱", ad: "📢" };

const PieceDetailDialog: React.FC<PieceDetailDialogProps> = ({ open, onOpenChange, piece, clientId }) => {
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");
  const [transcript, setTranscript] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  

  const { data: savedPrompts = [] } = useQuery({
    queryKey: ["saved-prompts"],
    queryFn: async () => {
      const { data } = await supabase.from("saved_prompts").select("*").order("name");
      return data ?? [];
    },
  });

  // Sync state when piece changes
  const [lastPieceId, setLastPieceId] = useState<string | null>(null);
  if (piece && piece.id !== lastPieceId) {
    setLastPieceId(piece.id);
    setCaption(piece.caption || "");
    setTranscript(piece.transcript || "");
    setPromptInput("");
    setSelectedPromptId("");
    
  }

  const runAutoGenerate = async (pieceId: string) => {
    setAutoGenerating(true);
    try {
      const hasTranscript = !!transcript;
      if (!hasTranscript) {
        const { data: tData, error: tErr } = await supabase.functions.invoke("transcribe-caption", {
          body: { action: "transcribe", piece_id: pieceId },
        });
        if (tErr) throw tErr;
        if (tData?.transcript) setTranscript(tData.transcript);
      }

      const { data: cData, error: cErr } = await supabase.functions.invoke("transcribe-caption", {
        body: { action: "generate", piece_id: pieceId },
      });
      if (cErr) throw cErr;
      if (cData?.caption) {
        setCaption(cData.caption);
        toast.success("Caption erstellt!");
      }

      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    } catch (err: any) {
      toast.error("Generierung fehlgeschlagen", { description: err.message });
    } finally {
      setAutoGenerating(false);
    }
  };

  const generateCaption = useCallback(async () => {
    if (!piece) return;
    setGenerating(true);
    try {
      const body: any = { action: "generate", piece_id: piece.id };
      if (promptInput.trim()) body.custom_prompt = promptInput.trim();
      const { data, error } = await supabase.functions.invoke("transcribe-caption", { body });
      if (error) throw error;
      if (data?.caption) {
        setCaption(data.caption);
        toast.success("Caption generiert!");
      }
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setGenerating(false);
    }
  }, [piece, clientId, qc, promptInput]);

  const refineCaption = useCallback(async () => {
    if (!piece || !promptInput.trim()) {
      toast.error("Bitte eine Anweisung eingeben");
      return;
    }
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", {
        body: { action: "refine", piece_id: piece.id, current_caption: caption, instruction: promptInput.trim() },
      });
      if (error) throw error;
      if (data?.caption) {
        setCaption(data.caption);
        setPromptInput("");
        toast.success("Caption angepasst!");
      }
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setRefining(false);
    }
  }, [piece, caption, promptInput, clientId, qc]);

  const saveAll = useCallback(async () => {
    if (!piece) return;
    await supabase.from("content_pieces").update({ caption, transcript }).eq("id", piece.id);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    toast.success("Gespeichert!");
    onOpenChange(false);
  }, [piece, caption, transcript, clientId, qc, onOpenChange]);

  const copyText = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const insertSavedPrompt = (promptId: string) => {
    const found = savedPrompts.find((p: any) => p.id === promptId);
    if (found) {
      setPromptInput(found.prompt_text);
      setSelectedPromptId(promptId);
    }
  };

  if (!piece) return null;

  const isLoading = generating || refining || autoGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <span>{TYPE_EMOJI[piece.type] || "📄"}</span>
            {piece.title || "Ohne Titel"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-5">
            {/* Auto-generating indicator */}
            {autoGenerating && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-primary font-medium">Transkript & Caption werden erstellt…</span>
              </div>
            )}

            {/* Caption */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Caption</label>
                <span className="text-[10px] font-mono text-muted-foreground">{caption.length}/2200</span>
              </div>
              <Textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder={autoGenerating ? "Wird generiert…" : "Caption hier eingeben oder generieren lassen..."}
                className="text-sm bg-background/50 resize-y min-h-[120px] max-h-[300px]"
                rows={6}
                disabled={autoGenerating}
              />
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs font-mono gap-1" onClick={saveAll} disabled={isLoading}>
                  <Save className="h-3 w-3" /> Speichern
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs font-mono gap-1" onClick={() => copyText("caption", caption)} disabled={!caption}>
                  {copiedField === "caption" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Kopieren
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-mono gap-1 ml-auto"
                  onClick={generateCaption}
                  disabled={isLoading}
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Neu generieren
                </Button>
              </div>
            </div>

            {/* AI Refinement */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono font-semibold">KI-Anpassung</span>
              </div>

              {savedPrompts.length > 0 && (
                <div className="flex items-center gap-2">
                  <BookmarkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select value={selectedPromptId} onValueChange={insertSavedPrompt}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Gespeicherten Prompt einfügen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedPrompts.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="truncate">{p.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={promptInput}
                  onChange={e => setPromptInput(e.target.value)}
                  placeholder="z.B. 'Kürzer fassen', 'Mehr Emojis', 'Professioneller'..."
                  className="h-9 text-xs flex-1 bg-background"
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (caption ? refineCaption() : generateCaption())}
                  disabled={isLoading}
                />
                <Button
                  size="sm"
                  className="h-9 text-xs font-mono gap-1"
                  disabled={isLoading || !promptInput.trim()}
                  onClick={caption ? refineCaption : generateCaption}
                >
                  {(generating || refining) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  {caption ? "Anpassen" : "Generieren"}
                </Button>
              </div>
            </div>

            {/* Transcript – always visible */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Transkript</label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 text-[10px] font-mono gap-1"
                  onClick={() => copyText("transcript", transcript)}
                  disabled={!transcript}
                >
                  {copiedField === "transcript" ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                  Kopieren
                </Button>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 whitespace-pre-wrap max-h-[200px] overflow-y-auto min-h-[60px]">
                {autoGenerating && !transcript ? (
                  <span className="italic text-muted-foreground/60">Wird transkribiert…</span>
                ) : transcript || (
                  <span className="italic text-muted-foreground/60">Kein Transkript vorhanden</span>
                )}
              </div>
            </div>

            {/* Activity Log */}
            {piece && (
              <div className="border-t border-border pt-3">
                <PieceActivityLog entityType="content_piece" entityId={piece.id} />
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PieceDetailDialog;
