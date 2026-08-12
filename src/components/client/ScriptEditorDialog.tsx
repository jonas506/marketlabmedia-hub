import { useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Copy, Check, FileText, Link as LinkIcon, X, ExternalLink, Image as ImageIcon, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScriptLink {
  url: string;
  tag: string;
}

interface ScriptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: {
    id: string;
    title: string | null;
    type: string;
    script_text?: string | null;
    has_script?: boolean;
    script_links?: ScriptLink[] | null;
    script_images?: string[] | null;
  } | null;
  clientId: string;
  canEdit: boolean;
}

const TYPE_EMOJI: Record<string, string> = { reel: "🎬", carousel: "📸", story: "📱", ad: "📢", youtube: "▶️" };

const HOOK_SEPARATOR = "\n---HOOKS---\n";
const HOOK_LINE_PREFIX = "HOOK: ";

function parseScript(scriptText: string | null | undefined): { hooks: string[]; body: string } {
  if (!scriptText) return { hooks: [""], body: "" };

  const separatorIdx = scriptText.indexOf(HOOK_SEPARATOR);
  if (separatorIdx === -1) {
    // Legacy format — entire text is the body
    return { hooks: [""], body: scriptText };
  }

  const hooksPart = scriptText.slice(0, separatorIdx);
  const body = scriptText.slice(separatorIdx + HOOK_SEPARATOR.length);

  const hooks = hooksPart
    .split("\n")
    .filter((l) => l.startsWith(HOOK_LINE_PREFIX))
    .map((l) => l.slice(HOOK_LINE_PREFIX.length));

  return { hooks: hooks.length > 0 ? hooks : [""], body };
}

function serializeScript(hooks: string[], body: string): string {
  const nonEmptyHooks = hooks.filter((h) => h.trim());
  if (nonEmptyHooks.length === 0) return body;

  const hooksBlock = nonEmptyHooks.map((h) => `${HOOK_LINE_PREFIX}${h}`).join("\n");
  return `${hooksBlock}${HOOK_SEPARATOR}${body}`;
}

const ScriptEditorDialog: React.FC<ScriptEditorDialogProps> = ({
  open,
  onOpenChange,
  piece,
  clientId,
  canEdit,
}) => {
  const qc = useQueryClient();
  const [hooks, setHooks] = useState<string[]>([""]);
  const [body, setBody] = useState("");
  const [links, setLinks] = useState<ScriptLink[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedLinkIdx, setCopiedLinkIdx] = useState<number | null>(null);
  const [lastPieceId, setLastPieceId] = useState<string | null>(null);

  // Fetch all existing tags from other pieces for suggestions
  const { data: allPiecesLinks } = useQuery({
    queryKey: ["script-link-tags", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_pieces")
        .select("script_links")
        .eq("client_id", clientId)
        .not("script_links", "is", null);
      return data ?? [];
    },
    enabled: open,
  });

  const tagSuggestions = useMemo(() => {
    const tags = new Set<string>();
    allPiecesLinks?.forEach((p: any) => {
      const pLinks = p.script_links as ScriptLink[] | null;
      pLinks?.forEach((l) => { if (l.tag?.trim()) tags.add(l.tag.trim()); });
    });
    return Array.from(tags).sort();
  }, [allPiecesLinks]);

  // Sync state when piece changes
  if (piece && piece.id !== lastPieceId) {
    setLastPieceId(piece.id);
    const parsed = parseScript(piece.script_text);
    setHooks(parsed.hooks);
    setBody(parsed.body);
    setLinks(Array.isArray(piece.script_links) ? piece.script_links : []);
    setImages(Array.isArray(piece.script_images) ? piece.script_images : []);
  }

  const addHook = () => setHooks((prev) => [...prev, ""]);

  const removeHook = (idx: number) => {
    setHooks((prev) => {
      if (prev.length <= 1) return [""];
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateHook = (idx: number, value: string) => {
    setHooks((prev) => prev.map((h, i) => (i === idx ? value : h)));
  };

  const copyHook = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const [copiedAll, setCopiedAll] = useState(false);
  const copyFullScript = () => {
    const nonEmptyHooks = hooks.filter((h) => h.trim());
    const parts: string[] = [];
    if (nonEmptyHooks.length > 0) {
      parts.push(nonEmptyHooks.map((h, i) => `Hook ${i + 1}: ${h.trim()}`).join("\n"));
    }
    if (body.trim()) parts.push(body.trim());
    const text = parts.join("\n\n");
    if (!text) { toast.error("Kein Skript zum Kopieren"); return; }
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success("Skript kopiert");
    setTimeout(() => setCopiedAll(false), 1500);
  };


  const addLink = () => setLinks((prev) => [...prev, { url: "", tag: "Inspiration" }]);
  const removeLink = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: keyof ScriptLink, value: string) =>
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  const copyLink = (idx: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIdx(idx);
    setTimeout(() => setCopiedLinkIdx(null), 1500);
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!piece || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${clientId}/${piece.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("reference-images").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} Bild(er) hochgeladen`);
    } catch (err: any) {
      toast.error("Upload fehlgeschlagen: " + (err?.message || "Unbekannter Fehler"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const save = useCallback(async () => {
    if (!piece) return;
    const scriptText = serializeScript(hooks, body);
    const hasScript = !!(hooks.some((h) => h.trim()) || body.trim());
    const cleanLinks = links.filter((l) => l.url.trim());

    await supabase
      .from("content_pieces")
      .update({ script_text: scriptText, has_script: hasScript, script_links: cleanLinks, script_images: images } as any)
      .eq("id", piece.id);

    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    qc.invalidateQueries({ queryKey: ["script-link-tags", clientId] });
    toast.success("Skript gespeichert!");
  }, [piece, hooks, body, links, images, clientId, qc]);

  if (!piece) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <span>{TYPE_EMOJI[piece.type] || "📄"}</span>
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">Skript — {piece.title || "Ohne Titel"}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto mr-6 h-8 gap-1.5 text-xs shrink-0"
              onClick={copyFullScript}
              title="Skript kopieren"
            >
              {copiedAll ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedAll ? "Kopiert" : "Kopieren"}
            </Button>
          </DialogTitle>
        </DialogHeader>


        <ScrollArea className="flex-1 min-h-0 overflow-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div className="px-6 py-5 space-y-6">
            {/* Links section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-display">🔗 Referenz-Links</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {links.length}
                  </span>
                </div>
                {canEdit && (
                  <Button size="sm" variant="outline" className="h-7 text-xs font-mono gap-1" onClick={addLink}>
                    <Plus className="h-3 w-3" /> Link hinzufügen
                  </Button>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {links.map((link, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 group"
                    >
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        value={link.url}
                        onChange={(e) => updateLink(idx, "url", e.target.value)}
                        placeholder="https://..."
                        className="flex-1 text-xs h-8 bg-muted/20 border-muted-foreground/10"
                        disabled={!canEdit}
                      />
                      <Input
                        value={link.tag}
                        onChange={(e) => updateLink(idx, "tag", e.target.value)}
                        placeholder="Tag…"
                        className="w-28 text-xs h-8 bg-muted/20 border-muted-foreground/10"
                        disabled={!canEdit}
                        list={`tag-suggestions-${idx}`}
                      />
                      <datalist id={`tag-suggestions-${idx}`}>
                        {tagSuggestions.map((t) => <option key={t} value={t} />)}
                      </datalist>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => copyLink(idx, link.url)}
                        disabled={!link.url.trim()}
                      >
                        {copiedLinkIdx === idx ? (
                          <Check className="h-3 w-3 text-[hsl(var(--runway-green))]" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      {link.url.trim() && (
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                        </a>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeLink(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>

              {canEdit && tagSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">Tags:</span>
                  {tagSuggestions.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px] px-2 py-0 h-5 cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => {
                        if (links.length === 0) {
                          setLinks([{ url: "", tag }]);
                        } else {
                          const lastEmpty = [...links].reverse().findIndex((l) => !l.tag.trim());
                          const actualIdx = lastEmpty >= 0 ? links.length - 1 - lastEmpty : -1;
                          if (actualIdx >= 0) {
                            updateLink(actualIdx, "tag", tag);
                          }
                        }
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Images section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm font-semibold font-display">Bilder</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {images.length}
                  </span>
                </div>
                {canEdit && (
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    <span className={cn(
                      "inline-flex items-center gap-1 h-7 px-2.5 text-xs font-mono rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                      uploading && "opacity-50 cursor-not-allowed"
                    )}>
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      {uploading ? "Lädt…" : "Bild hochladen"}
                    </span>
                  </label>
                )}
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-md overflow-hidden bg-muted/30 border border-border">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Bild ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                          aria-label="Bild entfernen"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hooks section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-display">🪝 Hooks</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {hooks.filter((h) => h.trim()).length} Varianten
                  </span>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs font-mono gap-1"
                    onClick={addHook}
                  >
                    <Plus className="h-3 w-3" /> Hook hinzufügen
                  </Button>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {hooks.map((hook, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 group"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground mt-2.5 w-5 shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      <Textarea
                        value={hook}
                        onChange={(e) => {
                          updateHook(idx, e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }
                        }}
                        placeholder={`Hook-Variante ${idx + 1}…`}
                        className={cn(
                          "flex-1 text-sm resize-none min-h-[44px] bg-muted/20 border-muted-foreground/10",
                          "focus-visible:bg-background transition-colors"
                        )}
                        rows={1}
                        disabled={!canEdit}
                      />
                      <div className="flex flex-col gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => copyHook(idx, hook)}
                          disabled={!hook.trim()}
                        >
                          {copiedIdx === idx ? (
                            <Check className="h-3 w-3 text-[hsl(var(--runway-green))]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        {canEdit && hooks.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeHook(idx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Skript-Body</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Script body */}
            <div>
              <Textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }
                }}
                placeholder="Hauptteil des Skripts hier schreiben…"
                className="text-sm bg-background/50 resize-none min-h-[120px]"
                rows={5}
                disabled={!canEdit}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          {canEdit && (
            <Button size="sm" className="gap-1.5 font-mono" onClick={save}>
              <Save className="h-3.5 w-3.5" /> Speichern
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScriptEditorDialog;
