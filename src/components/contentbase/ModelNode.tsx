import { MouseEvent } from "react";
import { CanvasNode } from "@/lib/content-types";
import NodeWrapper, { BrandOption } from "./NodeWrapper";

interface Props {
  node: CanvasNode;
  onDrag: (e: MouseEvent) => void;
  onPort: (e: MouseEvent, id: string, side: string) => void;
  onUpdate: (u: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  isSelected?: boolean;
  conns: { out: boolean; in: boolean };
  brands?: BrandOption[];
}

export default function ModelNode({ node, onDrag, onPort, onUpdate, onDuplicate, isSelected, conns, brands }: Props) {
  const isImg = node.model === "imagen";
  const col = isImg ? "#ea580c" : "#2563eb";

  return (
    <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={160} defaultMinH={70} brands={brands}>
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm" style={{ minWidth: node.width ? undefined : 185, height: node.height ? `${node.height}px` : undefined }}>
        <div className="px-3 py-2.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
          <span className="text-xs font-semibold">{isImg ? "Imagen" : "✦ Claude"}</span>
        </div>
        <div className="px-3 pb-3">
          <select
            className="w-full bg-background border border-border rounded-sm px-2.5 py-[7px] text-xs text-foreground outline-none cursor-pointer"
            value={node.model}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate({ model: e.target.value })}
          >
            <option value="claude">Claude Sonnet</option>
            <option value="claude-haiku">Claude Haiku</option>
            <option value="imagen">Google Imagen</option>
          </select>
        </div>
      </div>
      <div className={`cb-port out${conns?.out ? " hit" : ""}`} onMouseDown={(e) => { e.stopPropagation(); onPort(e, node.id, "out"); }} />
      <div className={`cb-port in${conns?.in ? " hit" : ""}`} onMouseDown={(e) => { e.stopPropagation(); onPort(e, node.id, "in"); }} />
    </NodeWrapper>
  );
}
