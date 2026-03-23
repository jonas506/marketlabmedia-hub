import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScriptPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  script_text?: string | null;
  has_script?: boolean;
  tag?: string | null;
}

interface PrintScriptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: ScriptPiece[];
}

const HOOK_SEPARATOR = "\n---HOOKS---\n";
const HOOK_LINE_PREFIX = "HOOK: ";

function parseScript(scriptText: string | null | undefined): { hooks: string[]; body: string } {
  if (!scriptText) return { hooks: [], body: "" };
  const separatorIdx = scriptText.indexOf(HOOK_SEPARATOR);
  if (separatorIdx === -1) return { hooks: [], body: scriptText };
  const hooksPart = scriptText.slice(0, separatorIdx);
  const body = scriptText.slice(separatorIdx + HOOK_SEPARATOR.length);
  const hooks = hooksPart
    .split("\n")
    .filter((l) => l.startsWith(HOOK_LINE_PREFIX))
    .map((l) => l.slice(HOOK_LINE_PREFIX.length));
  return { hooks, body };
}

const TYPE_CONFIG: { key: string; label: string; emoji: string }[] = [
  { key: "reel", label: "Reels", emoji: "🎬" },
  { key: "carousel", label: "Karussells", emoji: "🖼️" },
  { key: "ad", label: "Ads", emoji: "📢" },
  { key: "youtube_longform", label: "YouTube", emoji: "🎥" },
];

const PHASE_CONFIG: { key: string; label: string }[] = [
  { key: "script", label: "Skript" },
  { key: "filmed", label: "Gedreht" },
  { key: "editing", label: "Schnitt" },
  { key: "review", label: "Review" },
  { key: "approved", label: "Freigegeben" },
  { key: "handed_over", label: "Übergeben" },
];

const PrintScriptsDialog: React.FC<PrintScriptsDialogProps> = ({ open, onOpenChange, pieces }) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["reel", "carousel", "ad", "youtube_longform"]));
  const [selectedPhases, setSelectedPhases] = useState<Set<string>>(new Set(["script", "filmed", "editing"]));
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showPieces, setShowPieces] = useState(false);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const togglePhase = (phase: string) => {
    setSelectedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const togglePiece = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPieces = useMemo(() => {
    return pieces.filter(
      (p) =>
        selectedTypes.has(p.type) &&
        selectedPhases.has(p.phase) &&
        p.has_script &&
        p.script_text?.trim()
    );
  }, [pieces, selectedTypes, selectedPhases]);

  const scriptPieces = useMemo(() => {
    return filteredPieces.filter((p) => !excludedIds.has(p.id));
  }, [filteredPieces, excludedIds]);

  const availablePhases = useMemo(() => {
    const phases = new Set(pieces.filter((p) => p.has_script && p.script_text?.trim()).map((p) => p.phase));
    return PHASE_CONFIG.filter((ph) => phases.has(ph.key));
  }, [pieces]);

  const handlePrint = () => {
    const printContent = scriptPieces.map((piece) => {
      const { hooks, body } = parseScript(piece.script_text);
      const typeLabel = TYPE_CONFIG.find((t) => t.key === piece.type)?.label ?? piece.type;

      let html = `<div class="script-block">`;
      html += `<h2>${escapeHtml(piece.title || "Ohne Titel")} <span class="type-badge">${typeLabel}</span>`;
      if (piece.tag) html += ` <span class="tag-badge">${escapeHtml(piece.tag)}</span>`;
      html += `</h2>`;

      if (hooks.length > 0) {
        html += `<div class="hooks-section">`;
        hooks.forEach((hook, i) => {
          html += `<div class="hook"><span class="hook-label">Hook ${i + 1}:</span> ${escapeHtml(hook)}</div>`;
        });
        html += `</div>`;
      }

      if (body.trim()) {
        html += `<div class="body-section">${escapeHtml(body).replace(/\n/g, "<br/>")}</div>`;
      }

      html += `</div>`;
      return html;
    }).join("");

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Skripte – Teleprompter</title>
  <style>
    @page { margin: 2cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 18px;
      line-height: 1.7;
      color: #111;
      padding: 1rem;
    }
    .script-block {
      page-break-inside: avoid;
      margin-bottom: 2.5rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #e5e5e5;
    }
    .script-block:last-child { border-bottom: none; }
    h2 {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .type-badge {
      font-size: 0.7rem;
      font-weight: 600;
      background: #f0f0f0;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .tag-badge {
      font-size: 0.7rem;
      font-weight: 600;
      background: #e0e7ff;
      color: #3730a3;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }
    .hooks-section {
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      background: #f8f8f8;
      border-radius: 6px;
      border-left: 3px solid #0083F7;
    }
    .hook { margin-bottom: 0.4rem; }
    .hook:last-child { margin-bottom: 0; }
    .hook-label {
      font-weight: 700;
      color: #0083F7;
      font-size: 0.85em;
    }
    .body-section {
      font-size: 1.15rem;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  ${printContent}
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Printer className="h-4 w-4" />
            Skripte drucken
          </DialogTitle>
        </DialogHeader>

        {/* Phase filter */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {availablePhases.map((ph) => {
              const count = pieces.filter(
                (p) => p.phase === ph.key && selectedTypes.has(p.type) && p.has_script && p.script_text?.trim()
              ).length;
              return (
                <button
                  key={ph.key}
                  onClick={() => togglePhase(ph.key)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md border transition-colors",
                    selectedPhases.has(ph.key)
                      ? "border-primary/40 bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                    count === 0 && "opacity-30 cursor-not-allowed"
                  )}
                  disabled={count === 0}
                >
                  {ph.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Type filter */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Content-Typ</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CONFIG.map((t) => {
              const count = pieces.filter(
                (p) => p.type === t.key && selectedPhases.has(p.phase) && p.has_script && p.script_text?.trim()
              ).length;
              return (
                <button
                  key={t.key}
                  onClick={() => count > 0 && toggleType(t.key)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md border transition-colors",
                    selectedTypes.has(t.key)
                      ? "border-primary/40 bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                    count === 0 && "opacity-30 cursor-not-allowed"
                  )}
                  disabled={count === 0}
                >
                  {t.emoji} {t.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Individual piece selection */}
        {filteredPieces.length > 0 && (
          <div>
            <button
              onClick={() => setShowPieces(!showPieces)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showPieces ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Einzelne Skripte auswählen ({scriptPieces.length}/{filteredPieces.length})
            </button>

            {showPieces && (
              <ScrollArea className="mt-2 max-h-48">
                <div className="space-y-1">
                  {filteredPieces.map((p) => {
                    const isSelected = !excludedIds.has(p.id);
                    const typeEmoji = TYPE_CONFIG.find((t) => t.key === p.type)?.emoji ?? "";
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md border px-2.5 py-2 cursor-pointer transition-colors text-xs",
                          isSelected
                            ? "border-primary/30 bg-primary/5"
                            : "border-border opacity-50 hover:opacity-75"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePiece(p.id)}
                        />
                        <span className="truncate flex-1">
                          {typeEmoji} {p.title || "Ohne Titel"}
                        </span>
                        {p.tag && (
                          <span className="text-[10px] bg-accent/50 text-accent-foreground px-1.5 py-0.5 rounded">
                            {p.tag}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={scriptPieces.length === 0}
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" />
            {scriptPieces.length} {scriptPieces.length === 1 ? "Skript" : "Skripte"} drucken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default PrintScriptsDialog;
