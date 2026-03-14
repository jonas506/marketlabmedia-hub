import { MouseEvent, useState, useRef, useEffect } from "react";
import { CanvasNode } from "@/lib/content-types";
import NodeWrapper from "./NodeWrapper";
import type { BrandOption } from "./NodeWrapper";

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

export default function TextNode({ node, onDrag, onUpdate, onDuplicate, isSelected, brands }: Props) {
  const [editing, setEditing] = useState(!node.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.select(); }
  }, [editing]);

  const fontSize = node.fontSize || 14;

  return (
    <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={80} defaultMinH={24} brands={brands}>
      <div className="w-full h-full flex items-start" style={{ minWidth: 80, minHeight: 24 }} onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <textarea
            ref={ref}
            className="w-full bg-transparent border-none outline-none resize-none text-foreground p-1"
            style={{ fontSize, lineHeight: 1.4 }}
            value={node.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); e.stopPropagation(); }}
            onMouseDown={(e) => e.stopPropagation()}
            rows={2}
          />
        ) : (
          <p className="w-full text-foreground p-1 cursor-text whitespace-pre-wrap break-words m-0" style={{ fontSize, lineHeight: 1.4 }}>
            {node.text || "Doppelklick zum Bearbeiten…"}
          </p>
        )}
      </div>
    </NodeWrapper>
  );
}
