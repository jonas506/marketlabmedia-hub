import { MouseEvent, useState, useRef, useEffect } from "react";
import { CanvasNode } from "@/lib/content-types";
import NodeWrapper from "./NodeWrapper";
import type { BrandOption } from "./NodeWrapper";

const STICKY_COLORS = [
  { id: "yellow", bg: "#fef9c3", border: "#facc15" },
  { id: "green", bg: "#dcfce7", border: "#4ade80" },
  { id: "blue", bg: "#dbeafe", border: "#60a5fa" },
  { id: "pink", bg: "#fce7f3", border: "#f472b6" },
  { id: "orange", bg: "#ffedd5", border: "#fb923c" },
  { id: "purple", bg: "#f3e8ff", border: "#c084fc" },
];

interface Props {
  node: CanvasNode;
  onDrag: (e: MouseEvent) => void;
  onUpdate: (u: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  isSelected?: boolean;
  onPort: (e: MouseEvent, id: string, side: string) => void;
  conns: { out: boolean; in: boolean };
  brands?: BrandOption[];
}

export default function StickyNode({ node, onDrag, onUpdate, onDuplicate, isSelected, onPort, conns, brands }: Props) {
  const [editing, setEditing] = useState(!node.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const stickyColor = STICKY_COLORS.find((c) => c.id === (node.stickyColor || "yellow")) || STICKY_COLORS[0];

  return (
    <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={120} defaultMinH={100} brands={brands}>
      <div
        className="w-full h-full rounded-md p-2.5 flex flex-col gap-1.5"
        style={{ background: stickyColor.bg, border: `1.5px solid ${stickyColor.border}`, minWidth: 120, minHeight: 100, boxShadow: "2px 3px 8px rgba(0,0,0,0.08)" }}
        onDoubleClick={() => setEditing(true)}
      >
        <div className="flex gap-1 mb-1" onMouseDown={(e) => e.stopPropagation()}>
          {STICKY_COLORS.map((c) => (
            <div key={c.id} className="w-3.5 h-3.5 rounded-full cursor-pointer transition-transform hover:scale-125"
              style={{ background: c.bg, border: `2px solid ${c.border}`, outline: node.stickyColor === c.id || (!node.stickyColor && c.id === "yellow") ? "2px solid rgba(0,0,0,0.3)" : "none", outlineOffset: 1 }}
              onClick={() => onUpdate({ stickyColor: c.id })}
            />
          ))}
        </div>
        {editing ? (
          <textarea ref={ref} className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm leading-snug" style={{ color: "#1a1a1a", fontFamily: "'Comic Sans MS', cursive" }} value={node.text || ""} onChange={(e) => onUpdate({ text: e.target.value })} onBlur={() => setEditing(false)} onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); e.stopPropagation(); }} onMouseDown={(e) => e.stopPropagation()} placeholder="Notiz schreiben…" />
        ) : (
          <p className="flex-1 w-full text-sm leading-snug cursor-text whitespace-pre-wrap break-words m-0" style={{ color: "#1a1a1a", fontFamily: "'Comic Sans MS', cursive" }}>{node.text || "Notiz schreiben…"}</p>
        )}
        <div className={`cb-port cb-port-in${conns.in ? " connected" : ""}`} onMouseDown={(e) => onPort(e, node.id, "in")} />
        <div className={`cb-port cb-port-out${conns.out ? " connected" : ""}`} onMouseDown={(e) => onPort(e, node.id, "out")} />
      </div>
    </NodeWrapper>
  );
}
