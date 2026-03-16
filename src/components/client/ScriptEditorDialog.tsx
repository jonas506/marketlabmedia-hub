import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Plus, Trash2, GripVertical, Copy, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScriptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: {
    id: string;
    title: string | null;
    type: string;
    script_text?: string | null;
    has_script?: boolean;
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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [lastPieceId, setLastPieceId] = useState<string | null>(null);

  // Sync state when piece changes
  if (piece && piece.id !== lastPieceId) {
    setLastPieceId(piece.id);
    const parsed = parseScript(piece.script_text);
    setHooks(parsed.hooks);
    setBody(parsed.body);
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

  const save = useCallback(async () => {
    if (!piece) return;
    const scriptText = serializeScript(hooks, body);
    const hasScript = !!(hooks.some((h) => h.trim()) || body.trim());

    await supabase
      .from("content_pieces")
      .update({ script_text: scriptText, has_script: hasScript })
      .eq("id", piece.id);

    qc.invalidateQueries({ queryKey: ["content-pieces", clientId] });
    toast.success("Skript gespeichert!");
  }, [piece, hooks, body, clientId, qc]);

  if (!piece) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <span>{TYPE_EMOJI[piece.type] || "📄"}</span>
            <FileText className="h-4 w-4 text-muted-foreground" />
            Skript — {piece.title || "Ohne Titel"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">
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
                          "flex-1 text-sm resize-none min-h-[44px] bg-muted/20 border-muted-foreground/10 overflow-hidden",
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
                className="text-sm bg-background/50 resize-none min-h-[120px] overflow-hidden"
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
