import { MouseEvent, useState, useRef } from "react";
import { CanvasNode } from "@/lib/content-types";

interface Props {
  node: CanvasNode;
  onDrag: (e: MouseEvent) => void;
  onUpdate: (u: Record<string, unknown>) => void;
  isSelected?: boolean;
}

export default function ZoneNode({ node, onDrag, onUpdate, isSelected }: Props) {
  const [editingLabel, setEditingLabel] = useState(false);
  const w = node.width || 280;
  const h = node.height || 600;
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeDown = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: w, startH: h };
    const onMove = (ev: globalThis.MouseEvent) => {
      if (!resizeRef.current) return;
      onUpdate({ width: Math.max(180, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX)), height: Math.max(200, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY)) });
    };
    const onUp = () => { resizeRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div data-node-id={node.id} style={{ position: "absolute", left: node.x, top: node.y, width: w, height: h, pointerEvents: "all", zIndex: -1 }} onMouseDown={onDrag}>
      <div className="w-full h-full rounded-xl" style={{ background: node.color ? `${node.color}08` : "hsla(var(--muted) / 0.15)", border: `2px dashed ${node.color || "hsl(var(--border))"}`, opacity: isSelected ? 1 : 0.7, transition: "opacity 0.15s" }}>
        <div className="px-3 py-2 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
          {editingLabel ? (
            <input autoFocus className="text-sm font-bold bg-transparent border-none outline-none w-full" style={{ color: node.color || "hsl(var(--foreground))" }} value={node.zoneLabel || ""} onChange={(e) => onUpdate({ zoneLabel: e.target.value })} onBlur={() => setEditingLabel(false)} onKeyDown={(e) => { if (e.key === "Enter") setEditingLabel(false); e.stopPropagation(); }} />
          ) : (
            <span className="text-sm font-bold cursor-pointer select-none" style={{ color: node.color || "hsl(var(--muted-foreground))" }} onDoubleClick={() => setEditingLabel(true)}>{node.zoneLabel || "Zone"}</span>
          )}
        </div>
      </div>
      <div className="cb-resize-handle" onMouseDown={handleResizeDown} />
    </div>
  );
}
