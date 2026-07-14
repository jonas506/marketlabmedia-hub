import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, ChevronDown, ChevronUp, FileText, Loader2, ExternalLink, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import marketlabLogo from "@/assets/marketlab-logo.png";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const getLogoBase64 = async (): Promise<string> => {
  const response = await fetch(marketlabLogo);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.readAsDataURL(blob);
  });
};

interface ScriptLink {
  url: string;
  label?: string;
}

interface ScriptPiece {
  id: string;
  title: string | null;
  type: string;
  phase: string;
  script_text?: string | null;
  has_script?: boolean;
  tag?: string | null;
  funnel_stage?: string | null;
  script_links?: ScriptLink[] | null;
  script_images?: string[] | null;
}

const FUNNEL_BADGE: Record<string, { label: string; bg: string }> = {
  tofu: { label: "TOFU · Reichweite", bg: "#3b82f6" },
  mofu: { label: "MOFU · Vertrauen", bg: "#8b5cf6" },
  bofu: { label: "BOFU · Conversion", bg: "#10b981" },
};

const urlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

interface PrintScriptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: ScriptPiece[];
  clientName?: string | null;
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
  { key: "feedback", label: "Feedback" },
  { key: "approved", label: "Freigegeben" },
  { key: "handed_over", label: "Übergeben" },
];

const PrintScriptsDialog: React.FC<PrintScriptsDialogProps> = ({ open, onOpenChange, pieces, clientName }) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["reel", "carousel", "ad", "youtube_longform"]));
  const [selectedPhases, setSelectedPhases] = useState<Set<string>>(new Set(["script", "filmed", "editing"]));
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showPieces, setShowPieces] = useState(false);
  const [exportingGDoc, setExportingGDoc] = useState(false);
  const [gdocResult, setGdocResult] = useState<{ url: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
      (p) => selectedTypes.has(p.type) && selectedPhases.has(p.phase)
    );
  }, [pieces, selectedTypes, selectedPhases]);

  const scriptPieces = useMemo(() => {
    return filteredPieces.filter((p) => !excludedIds.has(p.id));
  }, [filteredPieces, excludedIds]);

  const availablePhases = useMemo(() => {
    const phases = new Set(pieces.map((p) => p.phase));
    return PHASE_CONFIG.filter((ph) => phases.has(ph.key));
  }, [pieces]);

  const handleExportGDoc = async () => {
    if (scriptPieces.length === 0) return;
    setExportingGDoc(true);
    setGdocResult(null);
    try {
      const payload = {
        clientName: clientName || "Kunde",
        pieces: scriptPieces.map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type,
          phase: p.phase,
          script_text: p.script_text ?? null,
          tag: p.tag ?? null,
          funnel_stage: p.funnel_stage ?? null,
          script_links: p.script_links ?? null,
          script_images: p.script_images ?? null,
        })),
      };
      const { data, error } = await supabase.functions.invoke("export-scripts-gdoc", { body: payload });
      if (error) throw error;
      if (!data?.url) throw new Error("Kein Doc-Link zurückgegeben");
      setGdocResult({ url: data.url, name: data.name });
      window.open(data.url, "_blank", "noopener,noreferrer");
      toast.success("Google Doc erstellt", { description: "Geöffnet in neuem Tab. Link kann geteilt werden." });
    } catch (e: any) {
      console.error(e);
      toast.error("Export fehlgeschlagen", { description: e?.message ?? "Bitte erneut versuchen" });
    } finally {
      setExportingGDoc(false);
    }
  };

  const handleCopyLink = async () => {
    if (!gdocResult) return;
    await navigator.clipboard.writeText(gdocResult.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = async () => {
    const logoBase64 = await getLogoBase64();

    const blocks = await Promise.all(scriptPieces.map(async (piece, idx) => {
      const { hooks, body } = parseScript(piece.script_text);
      const typeLabel = TYPE_CONFIG.find((t) => t.key === piece.type)?.label ?? piece.type;
      const num = String(idx + 1).padStart(2, "0");

      let html = `<div class="script-block">`;
      html += `<div class="script-header">`;
      html += `<span class="script-number">${num}</span>`;
      html += `<div class="script-meta">`;
      html += `<h2>${escapeHtml(piece.title || "Ohne Titel")}</h2>`;
      html += `<div class="badges"><span class="type-badge">${typeLabel}</span>`;
      const funnel = piece.funnel_stage ? FUNNEL_BADGE[piece.funnel_stage] : null;
      if (funnel) html += `<span class="funnel-badge" style="background:${funnel.bg};">${funnel.label}</span>`;
      if (piece.tag) html += `<span class="tag-badge">${escapeHtml(piece.tag)}</span>`;
      html += `</div></div></div>`;

      if (hooks.length > 0) {
        html += `<div class="hooks-section">`;
        html += `<div class="hooks-label">HOOKS</div>`;
        hooks.forEach((hook, i) => {
          html += `<div class="hook"><span class="hook-num">${i + 1}</span><span class="hook-text">${escapeHtml(hook)}</span></div>`;
        });
        html += `</div>`;
      }

      if (body.trim()) {
        html += `<div class="body-section"><div class="body-label">SKRIPT</div><div class="body-text">${escapeHtml(body).replace(/\n/g, "<br/>")}</div></div>`;
      } else if (hooks.length === 0) {
        html += `<div class="body-section"><div class="body-text" style="color:#aaa;font-style:italic;">Kein Skript hinterlegt</div></div>`;
      }

      const images = (piece.script_images || []).filter(Boolean);
      if (images.length > 0) {
        const dataUrls = await Promise.all(images.map(urlToDataUrl));
        const valid = dataUrls.filter((u): u is string => !!u);
        if (valid.length > 0) {
          html += `<div class="images-section"><div class="images-label">BILDER</div><div class="images-grid">`;
          valid.forEach((src) => {
            html += `<div class="image-item"><img src="${src}" alt="" /></div>`;
          });
          html += `</div></div>`;
        }
      }

      const links = (piece.script_links || []) as ScriptLink[];
      if (links.length > 0) {
        html += `<div class="links-section"><div class="links-label">LINKS</div>`;
        links.forEach((link) => {
          const label = link.label || link.url;
          html += `<div class="link-item"><span class="link-icon">🔗</span><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(label)}</a></div>`;
        });
        html += `</div>`;
      }

      html += `</div>`;
      return html;
    }));
    const printContent = blocks.join("");

    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Skripte – Marketlab Media</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      margin: 18mm 16mm 20mm 16mm;
      @bottom-center {
        content: "Marketlab Media · Vertraulich · Seite " counter(page) " / " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 9pt;
        color: #bbb;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
    }
    .page-header {
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo { height: 26px; }
    .header-right {
      text-align: right;
      font-size: 11px;
      color: #888;
    }
    .header-right .date { margin-top: 2px; }
    .content { padding: 0; }
    .doc-title {
      font-size: 22px;
      font-weight: 700;
      color: #111;
      margin-bottom: 0.25rem;
    }
    .doc-subtitle {
      font-size: 13px;
      color: #888;
      margin-bottom: 2.5rem;
    }
    .script-block {
      page-break-inside: avoid;
      margin-bottom: 2rem;
      border: 1px solid #eee;
      border-radius: 10px;
      overflow: hidden;
    }
    .script-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: #fafafa;
      border-bottom: 1px solid #eee;
    }
    .script-number {
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      background: #111;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .script-meta { flex: 1; }
    h2 {
      font-size: 15px;
      font-weight: 600;
      color: #111;
      margin: 0;
    }
    .badges { display: flex; gap: 6px; margin-top: 4px; }
    .type-badge {
      font-size: 10px;
      font-weight: 600;
      background: #111;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .tag-badge {
      font-size: 10px;
      font-weight: 500;
      background: #f0f0f0;
      color: #555;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .funnel-badge {
      font-size: 10px;
      font-weight: 600;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.03em;
    }
    .hooks-section {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #eee;
    }
    .hooks-label, .body-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #aaa;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    .hook {
      display: flex;
      gap: 0.6rem;
      align-items: baseline;
      margin-bottom: 0.4rem;
    }
    .hook:last-child { margin-bottom: 0; }
    .hook-num {
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      background: #0083F7;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .hook-text {
      font-size: 13px;
      line-height: 1.5;
      color: #333;
    }
    .body-section {
      padding: 1rem 1.25rem 1.25rem;
    }
    .body-text {
      font-size: 14px;
      line-height: 1.8;
      color: #333;
    }
    .images-section {
      padding: 0.75rem 1.25rem 1rem;
      border-top: 1px solid #eee;
    }
    .images-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #aaa;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    .images-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }
    .image-item {
      border: 1px solid #eee;
      border-radius: 6px;
      overflow: hidden;
      background: #fafafa;
    }
    .image-item img {
      width: 100%;
      height: auto;
      display: block;
      max-height: 280px;
      object-fit: contain;
    }
    .links-section {
      padding: 0.75rem 1.25rem 1rem;
      border-top: 1px solid #eee;
    }
    .links-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #aaa;
      text-transform: uppercase;
      margin-bottom: 0.4rem;
    }
    .link-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.3rem;
      font-size: 13px;
    }
    .link-icon { font-size: 12px; }
    .link-item a {
      color: #0083F7;
      text-decoration: none;
      word-break: break-all;
    }
    .link-item a:hover { text-decoration: underline; }
    .page-footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #bbb;
    }
    @media print {
      .script-block { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Marketlab Media" />
    <div class="header-right">
      <div style="font-weight:600;color:#333;">Content Skripte</div>
      <div class="date">${today}</div>
    </div>
  </div>
  <div class="content">
    <div class="doc-title">${scriptPieces.length} ${scriptPieces.length === 1 ? "Skript" : "Skripte"}</div>
    <div class="doc-subtitle">Vorbereitet von Marketlab Media</div>
    ${printContent}
  </div>
  <script>window.onload = function() { setTimeout(function(){ window.print(); }, 150); }</script>
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
                (p) => p.phase === ph.key && selectedTypes.has(p.type)
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
                (p) => p.type === t.key && selectedPhases.has(p.phase)
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
              <ScrollArea className="mt-2 max-h-56 rounded-md border border-border">
                <div className="min-w-[420px]">
                  {/* Table header */}
                  <div className="grid grid-cols-[32px_1fr_90px_90px_80px] items-center gap-2 px-2 py-1.5 border-b border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="text-center">✓</span>
                    <span>Skript</span>
                    <span>Typ</span>
                    <span>Status</span>
                    <span>Tag</span>
                  </div>
                  {/* Table rows */}
                  {filteredPieces.map((p) => {
                    const isSelected = !excludedIds.has(p.id);
                    const typeConfig = TYPE_CONFIG.find((t) => t.key === p.type);
                    const phaseConfig = PHASE_CONFIG.find((ph) => ph.key === p.phase);
                    return (
                      <label
                        key={p.id}
                        onClick={() => togglePiece(p.id)}
                        className={cn(
                          "grid grid-cols-[32px_1fr_90px_90px_80px] items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-xs border-b border-border last:border-b-0",
                          isSelected
                            ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                            : "opacity-45 hover:opacity-70"
                        )}
                      >
                        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => togglePiece(p.id)}
                          />
                        </div>
                        <span className="truncate" title={p.title || "Ohne Titel"}>
                          {p.title || "Ohne Titel"}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {typeConfig?.emoji} {typeConfig?.label ?? p.type}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {phaseConfig?.label ?? p.phase}
                        </span>
                        <span className="truncate">
                          {p.tag ? (
                            <span className="text-[9px] bg-accent/50 text-accent-foreground px-1 py-0.5 rounded">
                              {p.tag}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">–</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {gdocResult && (
          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{gdocResult.name}</p>
              <p className="text-[10px] text-muted-foreground">Jeder mit dem Link kann bearbeiten</p>
            </div>
            <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={handleCopyLink}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Kopiert" : "Link"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5" asChild>
              <a href={gdocResult.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" /> Öffnen
              </a>
            </Button>
          </div>
        )}

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={scriptPieces.length === 0 || exportingGDoc}
            onClick={handleExportGDoc}
          >
            {exportingGDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {exportingGDoc ? "Erstelle Google Doc…" : "Als Google Doc"}
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
