import { MouseEvent, useState } from "react";
import { CanvasNode } from "@/lib/content-types";
import NodeWrapper, { BrandOption } from "./NodeWrapper";

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

export default function ImageNode({ node, onDrag, onPort, onDel, onUpdate, onDuplicate, isSelected, conns, brands }: Props) {
  const [preview, setPreview] = useState(false);

  const handleDownload = (e: MouseEvent) => {
    e.stopPropagation();
    if (!node.imageUrl) return;
    const link = document.createElement("a");
    link.href = node.imageUrl;
    link.download = `bild-${node.id}.png`;
    link.target = "_blank";
    if (node.imageUrl.startsWith("data:")) {
      link.click();
    } else {
      fetch(node.imageUrl).then((r) => r.blob()).then((blob) => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }).catch(() => window.open(node.imageUrl!, "_blank"));
    }
  };

  return (
    <>
      <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={180} defaultMinH={180} brands={brands}>
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm" style={{ minWidth: node.width ? undefined : 200, height: node.height ? `${node.height}px` : undefined }}>
          <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#fff7ed", borderBottom: "1px solid #fed7aa" }}>
            <span className="text-[11px] font-semibold" style={{ color: "#ea580c" }}>KI-Bild</span>
            <button className="cb-na-btn" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDel(); }}>✕</button>
          </div>
          <div className="p-3" style={{ height: node.height ? `calc(100% - 38px)` : undefined }}>
            {node.loading ? (
              <div className="w-full aspect-square rounded-sm flex flex-col items-center justify-center gap-1.5" style={{ background: "#fff7ed", color: "#ea580c", border: "1px dashed #fed7aa" }}>
                <div className="cb-ld" /><div className="cb-ld" /><div className="cb-ld" />
                <span className="mt-1.5 text-[11px]">Generiert…</span>
              </div>
            ) : node.imageUrl ? (
              <div className="relative group">
                <img src={node.imageUrl} alt="Generiertes Bild" className="w-full aspect-square rounded-sm object-cover block cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPreview(true); }} />
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPreview(true); }} className="bg-black/60 hover:bg-black/80 text-white rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer border-none">Vorschau</button>
                  <button onMouseDown={(e) => e.stopPropagation()} onClick={handleDownload} className="bg-black/60 hover:bg-black/80 text-white rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer border-none">⬇ Download</button>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square rounded-sm flex flex-col items-center justify-center gap-1.5" style={{ background: "#fff7ed", color: "#ea580c", border: "1px dashed #fed7aa", fontSize: "11px" }}>
                <span className="text-[28px]">⬜</span>
                <span>{node.prompt ? "Prompt bereit" : "Warte auf Prompt…"}</span>
              </div>
            )}
          </div>
        </div>
        <div className={`cb-port in${conns?.in ? " hit" : ""}`} onMouseDown={(e) => { e.stopPropagation(); onPort(e, node.id, "in"); }} />
      </NodeWrapper>
      {preview && node.imageUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreview(false)} style={{ cursor: "zoom-out" }}>
          <div className="relative max-w-[90vw] max-h-[90vh] bg-card rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-sm font-semibold text-foreground">Bild-Vorschau</span>
              <div className="flex items-center gap-2">
                <button onClick={handleDownload} className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground cursor-pointer border-none hover:opacity-90 transition-opacity">⬇ Herunterladen</button>
                <button onClick={() => setPreview(false)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border-none bg-transparent text-sm">✕</button>
              </div>
            </div>
            <img src={node.imageUrl} alt="Vollansicht" className="block max-w-[85vw] max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
