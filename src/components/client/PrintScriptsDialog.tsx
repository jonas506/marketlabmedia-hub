import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptPiece {
  id: string;
  title: string | null;
  type: string;
  script_text?: string | null;
  has_script?: boolean;
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
  { key: "story", label: "Story Ads", emoji: "📱" },
  { key: "ad", label: "Ads", emoji: "📢" },
  { key: "youtube_longform", label: "YouTube", emoji: "🎥" },
];

const PrintScriptsDialog: React.FC<PrintScriptsDialogProps> = ({ open, onOpenChange, pieces }) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["reel"]));

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const scriptPieces = useMemo(() => {
    return pieces.filter(
      (p) => selectedTypes.has(p.type) && p.has_script && p.script_text?.trim()
    );
  }, [pieces, selectedTypes]);

  const handlePrint = () => {
    const printContent = scriptPieces.map((piece) => {
      const { hooks, body } = parseScript(piece.script_text);
      const typeLabel = TYPE_CONFIG.find((t) => t.key === piece.type)?.label ?? piece.type;

      let html = `<div class="script-block">`;
      html += `<h2>${piece.title || "Ohne Titel"} <span class="type-badge">${typeLabel}</span></h2>`;

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Printer className="h-4 w-4" />
            Skripte drucken
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Wähle die Content-Typen aus, deren Skripte du drucken möchtest. Nur Pieces mit Skript werden berücksichtigt.
        </p>

        <div className="space-y-2 mt-2">
          {TYPE_CONFIG.map((t) => {
            const count = pieces.filter(
              (p) => p.type === t.key && p.has_script && p.script_text?.trim()
            ).length;
            return (
              <label
                key={t.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  selectedTypes.has(t.key)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-muted/50",
                  count === 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                <Checkbox
                  checked={selectedTypes.has(t.key)}
                  onCheckedChange={() => count > 0 && toggleType(t.key)}
                  disabled={count === 0}
                />
                <span className="text-sm">
                  {t.emoji} {t.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {count} {count === 1 ? "Skript" : "Skripte"}
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="mt-4">
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
