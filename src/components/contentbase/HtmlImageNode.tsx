import { MouseEvent, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CanvasNode } from "@/lib/content-types";
import NodeWrapper, { BrandOption } from "./NodeWrapper";

const FORMATS = [
  { id: "instagram-post", label: "Insta Post", icon: "📸", w: 1080, h: 1080 },
  { id: "instagram-story", label: "Insta Story", icon: "⭕", w: 1080, h: 1920 },
  { id: "instagram-carousel", label: "Insta Carousel", icon: "🎠", w: 1080, h: 1080 },
  { id: "linkedin-post", label: "LinkedIn", icon: "💼", w: 1200, h: 627 },
  { id: "tiktok", label: "TikTok", icon: "🎵", w: 1080, h: 1920 },
  { id: "x-post", label: "X / Twitter", icon: "🐦", w: 1200, h: 675 },
] as const;

interface Props {
  node: CanvasNode;
  onDrag: (e: MouseEvent) => void;
  onPort: (e: MouseEvent, id: string, side: string) => void;
  onDel: () => void;
  onUpdate: (u: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  isSelected?: boolean;
  conns: { out: boolean; in: boolean };
  brands?: BrandOption[];
}

export default function HtmlImageNode({ node, onDrag, onPort, onDel, onUpdate, onDuplicate, isSelected, conns, brands }: Props) {
  const [preview, setPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const htmlContent = node.content || "";
  const currentFormat = FORMATS.find(f => f.id === node.format) || FORMATS[0];

  const handleDownloadHtml = (e: MouseEvent) => {
    e.stopPropagation();
    if (!htmlContent) return;
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `design-${currentFormat.id}-${node.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const previewScale = Math.min(260 / currentFormat.w, 240 / currentFormat.h);

  return (
    <>
      <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={290} defaultMinH={360} brands={brands}>
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm" style={{ minWidth: node.width ? undefined : 290, height: node.height ? `${node.height}px` : undefined }}>
          <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
            <span className="text-[11px] font-semibold" style={{ color: "#16a34a" }}>🖼️ HTML-Bild</span>
            <div className="flex items-center gap-1">
              {htmlContent && (
                <>
                  <button className="text-[10px] px-1.5 py-0.5 rounded border-none cursor-pointer" style={{ background: "#dcfce7", color: "#16a34a" }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPreview(true); }}>🔍</button>
                  <button className="text-[10px] px-1.5 py-0.5 rounded border-none cursor-pointer" style={{ background: "#dcfce7", color: "#16a34a" }} onMouseDown={(e) => e.stopPropagation()} onClick={handleDownloadHtml}>⬇</button>
                </>
              )}
              <button className="cb-na-btn" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDel(); }}>✕</button>
            </div>
          </div>
          <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b border-border bg-muted/20">
            {FORMATS.map((fmt) => (
              <button key={fmt.id} className="px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-all"
                style={{ background: node.format === fmt.id || (!node.format && fmt.id === "instagram-post") ? "#16a34a" : "transparent", color: node.format === fmt.id || (!node.format && fmt.id === "instagram-post") ? "#fff" : "#6b7280", borderColor: node.format === fmt.id || (!node.format && fmt.id === "instagram-post") ? "#16a34a" : "#e5e7eb" }}
                onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onUpdate({ format: fmt.id }); }} title={`${fmt.w}×${fmt.h}px`}
              >{fmt.icon} {fmt.label}</button>
            ))}
          </div>
          <div className="px-3 py-1 text-[9px] text-muted-foreground text-center" style={{ background: "#fafafa" }}>{currentFormat.w} × {currentFormat.h}px</div>
          <div className="p-2" style={{ height: node.height ? `calc(100% - 100px)` : undefined }}>
            {node.loading ? (
              <div className="w-full rounded-sm flex flex-col items-center justify-center gap-1.5" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px dashed #bbf7d0", height: 200 }}>
                <div className="cb-ld" /><div className="cb-ld" /><div className="cb-ld" />
                <span className="mt-1.5 text-[11px]">Generiert HTML…</span>
              </div>
            ) : htmlContent ? (
              <div className="relative group">
                <div className="rounded-sm border border-border overflow-hidden mx-auto" style={{ width: currentFormat.w * previewScale, height: currentFormat.h * previewScale }}>
                  <iframe ref={iframeRef} srcDoc={htmlContent} style={{ width: currentFormat.w, height: currentFormat.h, transform: `scale(${previewScale})`, transformOrigin: "top left", border: "none", pointerEvents: "none" }} sandbox="allow-same-origin" title="HTML Preview" />
                </div>
              </div>
            ) : (
              <div className="w-full rounded-sm flex flex-col items-center justify-center gap-1.5" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px dashed #bbf7d0", fontSize: "11px", height: 200 }}>
                <span className="text-[28px]">🖼️</span>
                <span>Format wählen & generieren</span>
              </div>
            )}
          </div>
        </div>
        <div className={`cb-port in${conns?.in ? " hit" : ""}`} onMouseDown={(e) => { e.stopPropagation(); onPort(e, node.id, "in"); }} />
      </NodeWrapper>
      {preview && htmlContent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreview(false)}>
          <div className="relative bg-card rounded-xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "95vw", maxHeight: "95vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <span className="text-sm font-semibold text-foreground">🖼️ {currentFormat.label} — {currentFormat.w}×{currentFormat.h}px</span>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadHtml} className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground cursor-pointer border-none hover:opacity-90">⬇ HTML</button>
                <button onClick={() => setPreview(false)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer border-none bg-transparent text-sm">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-neutral-900">
              <iframe ref={previewIframeRef} srcDoc={htmlContent} style={{ width: currentFormat.w, height: currentFormat.h, border: "none", background: "#fff", flexShrink: 0 }} sandbox="allow-same-origin allow-scripts allow-modals" title="HTML Full Preview" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
