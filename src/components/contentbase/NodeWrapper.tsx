import { MouseEvent, useState, useRef, useCallback, ReactNode } from "react";
import { CanvasNode } from "@/lib/content-types";

export interface BrandOption {
  id: string;
  name: string;
  logos: string[];
}

const PRESET_COLORS = [
  "", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

interface Props {
  node: CanvasNode;
  onDrag: (e: MouseEvent) => void;
  onUpdate: (u: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  isSelected?: boolean;
  children: ReactNode;
  defaultMinW?: number;
  defaultMinH?: number;
  brands?: BrandOption[];
}

export default function NodeWrapper({ node, onDrag, onUpdate, onDuplicate, isSelected, children, defaultMinW = 180, defaultMinH = 80, brands = [] }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeDown = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget.closest(".cb-node") as HTMLElement | null;
    if (!el) return;
    const startW = node.width || el.offsetWidth;
    const startH = node.height || el.offsetHeight;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW, startH };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      onUpdate({
        width: Math.max(defaultMinW, resizeRef.current.startW + dw),
        height: Math.max(defaultMinH, resizeRef.current.startH + dh),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [node.width, node.height, defaultMinW, defaultMinH, onUpdate]);

  return (
    <div
      className={`cb-node${isSelected ? " cb-node-selected" : ""}`}
      data-node-id={node.id}
      style={{
        left: node.x,
        top: node.y,
        width: node.width ? `${node.width}px` : undefined,
      }}
      onMouseDown={onDrag}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDuplicate?.();
      }}
    >
      {(node.label || editingLabel) && (
        <div className="absolute -top-6 left-0 right-0" onMouseDown={(e) => e.stopPropagation()}>
          {editingLabel ? (
            <input
              autoFocus
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-card border border-border text-foreground outline-none w-full"
              value={node.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              onBlur={() => setEditingLabel(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingLabel(false)}
            />
          ) : (
            <span
              className="text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onDoubleClick={() => setEditingLabel(true)}
            >
              {node.label}
            </span>
          )}
        </div>
      )}

      <div className="cb-node-settings">
        <button
          className="cb-node-settings-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
        >
          ⚙
        </button>
        {showSettings && (
          <div className="cb-node-settings-panel" onMouseDown={(e) => e.stopPropagation()}>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-1">Label</span>
              <input
                className="w-full text-[11px] px-2 py-1 rounded border border-border bg-background text-foreground outline-none"
                placeholder="Label hinzufügen…"
                value={node.label || ""}
                onChange={(e) => onUpdate({ label: e.target.value })}
              />
            </div>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-1">Farbe</span>
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c || "none"}
                    className={`cb-color-swatch${node.color === c ? " active" : ""}`}
                    style={{ background: c || "hsl(var(--card))", border: !c ? "2px solid hsl(var(--border))" : undefined }}
                    onClick={() => onUpdate({ color: c })}
                  />
                ))}
              </div>
            </div>
            {brands.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block mb-1">Marke / CI</span>
                <select
                  className="w-full text-[11px] px-2 py-1 rounded border border-border bg-background text-foreground outline-none"
                  value={node.brandId || ""}
                  onChange={(e) => onUpdate({ brandId: e.target.value || undefined })}
                >
                  <option value="">Keine Marke</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            {onDuplicate && (
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer bg-transparent border-none p-0"
                onClick={() => { onDuplicate(); setShowSettings(false); }}
              >
                ⧉ Duplizieren
              </button>
            )}
            {(node.width || node.height) && (
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer bg-transparent border-none p-0"
                onClick={() => onUpdate({ width: undefined, height: undefined })}
              >
                ↺ Größe zurücksetzen
              </button>
            )}
          </div>
        )}
      </div>

      {node.color && (
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg" style={{ background: node.color }} />
      )}

      {children}

      <div className="cb-resize-handle" onMouseDown={handleResizeDown} />
    </div>
  );
}
