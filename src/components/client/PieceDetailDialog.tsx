import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Check, Loader2, Wand2, FileText, BookmarkIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
    phase: string;
    client_id: string;
  } | null;
  clientId: string;
}

const PieceDetailDialog: React.FC<PieceDetailDialogProps> = ({ open, onOpenChange, piece, clientId }) => {
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");
  const [transcript, setTranscript] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("caption");
  const [selectedPromptId, setSelectedPromptId] = useState("");

  // Load saved prompts
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
      if (data?.transcript) {
        setTranscript(data.transcript);
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

  const saveCaption = useCallback(async () => {
    if (!piece) return;
    await supabase.from("content_pieces").update({ caption, transcript }).eq("id", piece.id);
    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    toast.success("Gespeichert!");
  }, [piece, caption, transcript, clientId, qc]);

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

  const TYPE_EMOJI: Record<string, string> = { reel: "🎬", carousel: "📸", story: "📱", ad: "📢" };
  const isLoading = generating || refining;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <span>{TYPE_EMOJI[piece.type] || "📄"}</span>
            {piece.title || "Ohne Titel"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 h-9 bg-muted/50 shrink-0">
              <TabsTrigger value="caption" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Caption
              </TabsTrigger>
              <TabsTrigger value="transcript" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Transkript
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0">
              <TabsContent value="caption" className="px-6 py-4 space-y-4 mt-0">
                {/* Caption editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Caption</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{caption.length}/2200</span>
                  </div>
                  <Textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Caption hier eingeben oder generieren lassen..."
                    className="text-sm bg-background/50 resize-y min-h-[120px] max-h-[300px]"
                    rows={6}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs font-mono gap-1" onClick={saveCaption}>
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
                      {caption ? "Neu generieren" : "Generieren"}
                    </Button>
                  </div>
                </div>

                {/* AI Prompt input with saved prompts */}
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <span className="text-xs font-mono font-semibold">KI-Anpassung</span>
                  </div>

                  {/* Saved prompts selector */}
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
                    />
                    <Button
                      size="sm"
                      className="h-9 text-xs font-mono gap-1"
                      disabled={isLoading || !promptInput.trim()}
                      onClick={caption ? refineCaption : generateCaption}
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      {caption ? "Anpassen" : "Generieren"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="px-6 py-4 space-y-4 mt-0">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Transkript</label>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] font-mono gap-1" onClick={() => copyText("transcript", transcript)} disabled={!transcript}>
                      {copiedField === "transcript" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Kopieren
                    </Button>
                  </div>
                  <Textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Transkript wird automatisch generiert oder hier manuell eingeben..."
                    className="text-sm bg-background/50 resize-y min-h-[200px] max-h-[400px]"
                    rows={10}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs font-mono gap-1" onClick={saveCaption}>
                      <Save className="h-3 w-3" /> Speichern
                    </Button>
                  </div>
                </div>

                {/* Script text for reference */}
                {piece.script_text && (
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 block">Skript (Referenz)</label>
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                      {piece.script_text}
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PieceDetailDialog;
