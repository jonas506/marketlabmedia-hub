import { MouseEvent, useState } from "react";
import { CanvasNode, CTYPES } from "@/lib/content-types";
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

export default function ContentNode({ node, onDrag, onPort, onDel, onUpdate, onDuplicate, isSelected, conns, brands }: Props) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const ct = CTYPES.find((c) => c.id === node.ctype) || CTYPES[0];

  const copy = () => {
    navigator.clipboard.writeText(node.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={200} defaultMinH={100} brands={brands}>
      <div
        className="bg-blue-50 border rounded-lg overflow-hidden shadow-sm"
        style={{
          borderColor: `${ct.color}55`,
          minWidth: node.width ? undefined : 220,
          maxWidth: node.width ? undefined : 280,
          height: node.height ? `${node.height}px` : undefined,
        }}
      >
        <div
          className="px-3 py-2 flex items-center justify-between bg-white/50"
          style={{ borderBottom: `1px solid ${ct.color}33` }}
        >
          <span className="text-[11px] font-semibold" style={{ color: ct.color }}>
            {ct.icon} {ct.label}
          </span>
          <div className="flex gap-1">
            <button className="cb-na-btn" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setEditing(!editing); }} title="Bearbeiten">✎</button>
            <button className="cb-na-btn" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); copy(); }}>{copied ? "✓" : "⧉"}</button>
            <button className="cb-na-btn" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDel(); }}>✕</button>
          </div>
        </div>
        <div className="p-3" style={{ height: node.height ? `calc(100% - 38px)` : undefined }}>
          {node.loading ? (
            <div className="flex items-center py-2">
              <div className="cb-ld" /><div className="cb-ld" /><div className="cb-ld" />
              <span className="text-[11px] text-muted-foreground ml-1.5">Generiert…</span>
            </div>
          ) : editing ? (
            <textarea
              autoFocus
              className="w-full h-full border border-border rounded-sm px-2 py-1.5 text-xs text-foreground bg-background resize-none outline-none focus:border-primary"
              style={{ minHeight: node.height ? undefined : 100 }}
              value={node.content || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={() => setEditing(false)}
            />
          ) : (
            <div
              className="text-xs leading-relaxed text-foreground overflow-y-auto whitespace-pre-wrap cb-content-scroll cursor-text"
              style={{ maxHeight: node.height ? "100%" : 140 }}
              onDoubleClick={() => setEditing(true)}
            >
              {node.content || <span className="text-muted-foreground">Doppelklick zum Bearbeiten…</span>}
            </div>
          )}
        </div>
      </div>
      <div className={`cb-port in${conns?.in ? " hit" : ""}`} onMouseDown={(e) => { e.stopPropagation(); onPort(e, node.id, "in"); }} />
    </NodeWrapper>
  );
}
