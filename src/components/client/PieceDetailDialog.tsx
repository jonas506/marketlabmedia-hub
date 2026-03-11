import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Check, Loader2, Wand2, FileText, BookmarkIcon, Save, Upload, Video } from "lucide-react";
import { toast } from "sonner";
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
    video_path?: string | null;
    preview_link?: string | null;
    phase: string;
    client_id: string;
  } | null;
  clientId: string;
}

const PieceDetailDialog: React.FC<PieceDetailDialogProps> = ({ open, onOpenChange, piece, clientId }) => {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [transcript, setTranscript] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("caption");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);

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
    setVideoPath(piece.video_path || null);
    setPromptInput("");
    setSelectedPromptId("");
  }

  // Upload video file
  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !piece) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Datei zu groß", { description: "Maximal 20 MB erlaubt" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${clientId}/${piece.id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("content-videos")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      await supabase.from("content_pieces").update({ video_path: path }).eq("id", piece.id);
      setVideoPath(path);
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
      toast.success("Video hochgeladen!", { description: "Jetzt kannst du transkribieren lassen" });
    } catch (err: any) {
      toast.error("Upload fehlgeschlagen", { description: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [piece, clientId, qc]);

  // Transcribe video via ElevenLabs, optionally generate caption after
  const transcribeVideo = useCallback(async (andCaption = false) => {
    if (!piece) return;
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-caption", {
        body: { action: "transcribe", piece_id: piece.id },
      });
      if (error) throw error;
      if (data?.transcript) {
        setTranscript(data.transcript);
        toast.success("Transkript erstellt!");
        qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });

        // Combined flow: generate caption based on fresh transcript
        if (andCaption) {
          setTranscribing(false);
          setGenerating(true);
          setActiveTab("caption");
          try {
            const capBody: any = { action: "generate", piece_id: piece.id };
            if (promptInput.trim()) capBody.custom_prompt = promptInput.trim();
            const { data: capData, error: capErr } = await supabase.functions.invoke("transcribe-caption", { body: capBody });
            if (capErr) throw capErr;
            if (capData?.caption) {
              setCaption(capData.caption);
              toast.success("Caption aus Transkript generiert!");
            }
            qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
          } catch (err: any) {
            toast.error("Caption-Generierung fehlgeschlagen", { description: err.message });
          } finally {
            setGenerating(false);
          }
          return;
        }
      }
      if (data?.error) {
        toast.error("Transkription fehlgeschlagen", { description: data.error });
      }
      qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setTranscribing(false);
    }
  }, [piece, clientId, qc, promptInput]);

  // Generate caption (uses transcript if available)
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

  // Refine caption
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
  const hasVideo = !!videoPath;
  const hasPreviewLink = !!piece.preview_link;
  const canTranscribe = hasPreviewLink || hasVideo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
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
                    <Button size="sm" className="h-7 text-xs font-mono gap-1" onClick={saveAll}>
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

                {/* AI Prompt input */}
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
                {/* Transcription source section */}
                <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4">
                  <div className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      {hasPreviewLink ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-[hsl(var(--runway-green))]">✓ Preview-Link vorhanden</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono gap-1"
                            onClick={() => transcribeVideo(false)}
                            disabled={transcribing || generating}
                          >
                            {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {transcript ? "Neu transkribieren" : "Transkribieren"}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs font-mono gap-1"
                            onClick={() => transcribeVideo(true)}
                            disabled={transcribing || generating}
                          >
                            {(transcribing || generating) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                            Transkript → Caption
                          </Button>
                        </div>
                      ) : hasVideo ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-[hsl(var(--runway-green))]">✓ Video hochgeladen</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono gap-1"
                            onClick={() => transcribeVideo(false)}
                            disabled={transcribing || generating}
                          >
                            {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {transcript ? "Neu transkribieren" : "Transkribieren"}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs font-mono gap-1"
                            onClick={() => transcribeVideo(true)}
                            disabled={transcribing || generating}
                          >
                            {(transcribing || generating) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                            Transkript → Caption
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Setze einen Preview-Link, um das Video zu transkribieren</span>
                      )}
                    </div>
                    {!hasPreviewLink && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*,audio/*"
                          className="hidden"
                          onChange={handleVideoUpload}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-mono gap-1"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          {hasVideo ? "Ersetzen" : "Oder Video hochladen"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Transcript editor */}
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
                    placeholder="Transkript wird nach Video-Upload automatisch erstellt oder hier manuell eingeben..."
                    className="text-sm bg-background/50 resize-y min-h-[200px] max-h-[400px]"
                    rows={10}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs font-mono gap-1" onClick={saveAll}>
                      <Save className="h-3 w-3" /> Speichern
                    </Button>
                  </div>
                </div>

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
