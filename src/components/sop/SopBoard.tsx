import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Square, Diamond, Circle, Triangle, Hexagon, Type,
  StickyNote, Trash2, ZoomIn, ZoomOut, Sparkles, Save, MessageSquare,
  X, Send, Loader2, MousePointer, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// ─── Types ─────────────────────────────────────
export interface SopNode {
  id: string;
  type: "rectangle" | "diamond" | "oval" | "trapezoid" | "triangle" | "circle" | "parallelogram" | "hexagon" | "sticky" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  fontSize?: number;
}

export interface SopConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface BoardData {
  nodes: SopNode[];
  connections: SopConnection[];
}

interface Props {
  templateId: string;
  templateName: string;
  initialBoard: BoardData;
  onBack: () => void;
  canEdit: boolean;
}

// ─── Helpers ───────────────────────────────────
let _nid = 0;
const genId = () => `sn_${Date.now()}_${++_nid}`;

const SHAPE_TYPES = [
  { type: "rectangle", icon: Square, label: "Rechteck" },
  { type: "diamond", icon: Diamond, label: "Raute" },
  { type: "oval", icon: Circle, label: "Oval" },
  { type: "circle", icon: Circle, label: "Kreis" },
  { type: "triangle", icon: Triangle, label: "Dreieck" },
  { type: "hexagon", icon: Hexagon, label: "Hexagon" },
  { type: "trapezoid", icon: Square, label: "Trapez" },
  { type: "parallelogram", icon: Square, label: "Parallelogramm" },
  { type: "sticky", icon: StickyNote, label: "Sticky Note" },
  { type: "text", icon: Type, label: "Text" },
] as const;

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  rectangle: { w: 160, h: 80 },
  diamond: { w: 120, h: 120 },
  oval: { w: 160, h: 80 },
  circle: { w: 100, h: 100 },
  triangle: { w: 120, h: 100 },
  hexagon: { w: 140, h: 120 },
  trapezoid: { w: 160, h: 80 },
  parallelogram: { w: 180, h: 80 },
  sticky: { w: 180, h: 140 },
  text: { w: 200, h: 40 },
};

// ─── Shape SVG Renderers ───────────────────────
function ShapeSvg({ type, w, h, color }: { type: string; w: number; h: number; color: string }) {
  const fill = color + "22";
  const stroke = color;

  switch (type) {
    case "rectangle":
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "diamond":
      return <polygon points={`${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}`} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "oval":
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "circle":
      return <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 2} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "triangle":
      return <polygon points={`${w / 2},4 ${w - 4},${h - 4} 4,${h - 4}`} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "hexagon": {
      const cx = w / 2, cy = h / 2, rx = w / 2 - 4, ry = h / 2 - 4;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`;
      }).join(" ");
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2} />;
    }
    case "trapezoid":
      return <polygon points={`${w * 0.15},${h - 4} ${w * 0.85},${h - 4} ${w - 4},4 4,4`} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "parallelogram":
      return <polygon points={`${w * 0.2},${h - 4} ${w - 4},${h - 4} ${w * 0.8},4 4,4`} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "sticky":
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={4} fill={color + "33"} stroke={color + "55"} strokeWidth={1.5} />;
    case "text":
      return null;
    default:
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} fill={fill} stroke={stroke} strokeWidth={2} />;
  }
}

// ─── Connection Path ───────────────────────────
function connectionPath(from: SopNode, to: SopNode): string {
  const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
  const tx = to.x + to.w / 2, ty = to.y + to.h / 2;
  const dx = tx - fx, dy = ty - fy;

  // Find best exit/entry points
  let sx: number, sy: number, ex: number, ey: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    sx = dx > 0 ? from.x + from.w : from.x;
    sy = from.y + from.h / 2;
    ex = dx > 0 ? to.x : to.x + to.w;
    ey = to.y + to.h / 2;
  } else {
    // Vertical connection
    sx = from.x + from.w / 2;
    sy = dy > 0 ? from.y + from.h : from.y;
    ex = to.x + to.w / 2;
    ey = dy > 0 ? to.y : to.y + to.h;
  }

  const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
  if (Math.abs(dx) > Math.abs(dy)) {
    return `M${sx},${sy} C${midX},${sy} ${midX},${ey} ${ex},${ey}`;
  } else {
    return `M${sx},${sy} C${sx},${midY} ${ex},${midY} ${ex},${ey}`;
  }
}

function arrowHead(from: SopNode, to: SopNode): { x: number; y: number; angle: number } {
  const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
  const tx = to.x + to.w / 2, ty = to.y + to.h / 2;
  const dx = tx - fx, dy = ty - fy;

  let ex: number, ey: number;
  if (Math.abs(dx) > Math.abs(dy)) {
    ex = dx > 0 ? to.x : to.x + to.w;
    ey = to.y + to.h / 2;
  } else {
    ex = to.x + to.w / 2;
    ey = dy > 0 ? to.y : to.y + to.h;
  }

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return { x: ex, y: ey, angle };
}

// ─── Main Component ────────────────────────────
export default function SopBoard({ templateId, templateName, initialBoard, onBack, canEdit }: Props) {
  const [nodes, setNodes] = useState<SopNode[]>(initialBoard.nodes || []);
  const [connections, setConnections] = useState<SopConnection[]>(initialBoard.connections || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [tool, setTool] = useState<"select" | "connect">("select");

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave
  const schedSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const boardData = { nodes, connections };
      await supabase
        .from("sop_templates")
        .update({ board_data: boardData as any, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      setSaving(false);
    }, 2000);
  }, [nodes, connections, templateId]);

  useEffect(() => {
    if (canEdit) schedSave();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [nodes, connections, schedSave, canEdit]);

  // ─── Node CRUD ─────────────────────────────
  const addNode = (type: string) => {
    const size = DEFAULT_SIZES[type] || { w: 160, h: 80 };
    const cx = (-pan.x + 500) / zoom;
    const cy = (-pan.y + 300) / zoom;
    const node: SopNode = {
      id: genId(), type: type as SopNode["type"],
      x: cx - size.w / 2, y: cy - size.h / 2,
      w: size.w, h: size.h,
      label: "", color: COLORS[nodes.length % COLORS.length],
    };
    setNodes(prev => [...prev, node]);
    setSelectedId(node.id);
  };

  const updateNode = (id: string, upd: Partial<SopNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...upd } : n));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedId));
    setConnections(prev => prev.filter(c => c.from !== selectedId && c.to !== selectedId));
    setSelectedId(null);
  };

  // ─── Drag ──────────────────────────────────
  const onNodeDown = (e: React.MouseEvent, id: string) => {
    if (!canEdit) return;
    e.stopPropagation();

    if (tool === "connect") {
      if (connecting) {
        if (connecting !== id) {
          setConnections(prev => [...prev, { id: genId(), from: connecting, to: id }]);
        }
        setConnecting(null);
      } else {
        setConnecting(id);
      }
      return;
    }

    setSelectedId(id);
    const node = nodes.find(n => n.id === id)!;
    dragRef.current = { id, ox: node.x, oy: node.y, startX: e.clientX, startY: e.clientY };
  };

  const onCanvasDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("sop-canvas-bg")) {
      setSelectedId(null);
      setConnecting(null);
      panRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) / zoom;
      const dy = (e.clientY - dragRef.current.startY) / zoom;
      updateNode(dragRef.current.id, { x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
    }
    if (panRef.current) {
      setPan({
        x: panRef.current.panX + (e.clientX - panRef.current.startX),
        y: panRef.current.panY + (e.clientY - panRef.current.startY),
      });
    }
  };

  const onMouseUp = () => {
    dragRef.current = null;
    panRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  };

  // ─── Resize ────────────────────────────────
  const onResizeDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId)!;
    const startX = e.clientX, startY = e.clientY;
    const startW = node.w, startH = node.h;

    const onMove = (me: MouseEvent) => {
      const dw = (me.clientX - startX) / zoom;
      const dh = (me.clientY - startY) / zoom;
      updateNode(nodeId, { w: Math.max(60, startW + dw), h: Math.max(40, startH + dh) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ─── AI Chat ───────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMsgs = [...chatMessages, { role: "user" as const, content: userMsg }];
    setChatMessages(newMsgs);
    setChatLoading(true);

    try {
      const resp = await supabase.functions.invoke("generate-sop-flow", {
        body: {
          messages: newMsgs,
          currentBoard: { nodes, connections },
          templateName,
        },
      });

      if (resp.error) throw resp.error;
      const data = resp.data;

      if (data.board) {
        setNodes(data.board.nodes || []);
        setConnections(data.board.connections || []);
        toast.success("Flowchart aktualisiert");
      }

      setChatMessages(prev => [...prev, { role: "assistant", content: data.message || "Fertig!" }]);
    } catch (err: any) {
      console.error(err);
      toast.error("KI-Fehler: " + (err.message || "Unbekannt"));
      setChatMessages(prev => [...prev, { role: "assistant", content: "Fehler bei der Generierung. Bitte versuche es erneut." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ─── Delete connection ─────────────────────
  const deleteConnection = (connId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connId));
  };

  // ─── Keyboard ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingLabel) return;
        if (selectedId) deleteSelected();
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setConnecting(null);
        setEditingLabel(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editingLabel]);

  const selectedNode = nodes.find(n => n.id === selectedId);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ─── Top Bar ────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0 z-20">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>
        <div className="h-5 w-px bg-border" />
        <h2 className="font-display font-semibold text-sm truncate flex-1">{templateName}</h2>

        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <button
            onClick={() => { setTool("select"); setConnecting(null); }}
            className={cn("p-1.5 rounded transition-colors", tool === "select" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            title="Auswählen"
          >
            <MousePointer className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTool("connect")}
            className={cn("p-1.5 rounded transition-colors", tool === "connect" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            title="Verbinden"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(3, z + 0.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </div>

        {saving && <span className="text-[10px] text-muted-foreground">Speichern...</span>}

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <Sparkles className="h-3 w-3" />
            KI-Assistent
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Shape Toolbar (Left) ─────────── */}
        {canEdit && (
          <div className="w-12 border-r border-border bg-card/50 flex flex-col items-center py-2 gap-1 shrink-0 z-10">
            {SHAPE_TYPES.map(s => (
              <button
                key={s.type}
                onClick={() => addNode(s.type)}
                className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={s.label}
              >
                <s.icon className="h-4 w-4" />
              </button>
            ))}
            <div className="h-px w-6 bg-border my-1" />
            {selectedId && (
              <button
                onClick={deleteSelected}
                className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                title="Löschen (Del)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* ─── Canvas ─────────────────────────── */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={onCanvasDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
        >
          {/* Dot grid background */}
          <div
            className="sop-canvas-bg absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--cb-dot)) 1px, transparent 1px)`,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />

          {/* Transform container */}
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          >
            {/* SVG for connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
              <defs>
                <marker id="sop-arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                  <polygon points="0 0, 10 4, 0 8" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>
              {connections.map(conn => {
                const fromNode = nodes.find(n => n.id === conn.from);
                const toNode = nodes.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                const path = connectionPath(fromNode, toNode);
                return (
                  <g key={conn.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      markerEnd="url(#sop-arrowhead)"
                      className="pointer-events-auto cursor-pointer hover:stroke-destructive"
                      onClick={() => canEdit && deleteConnection(conn.id)}
                    />
                    {conn.label && (() => {
                      const ah = arrowHead(fromNode, toNode);
                      const mx = (fromNode.x + fromNode.w / 2 + toNode.x + toNode.w / 2) / 2;
                      const my = (fromNode.y + fromNode.h / 2 + toNode.y + toNode.h / 2) / 2;
                      return (
                        <text x={mx} y={my - 6} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
                          {conn.label}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Connecting indicator */}
              {connecting && (() => {
                const fromNode = nodes.find(n => n.id === connecting);
                if (!fromNode) return null;
                return (
                  <circle
                    cx={fromNode.x + fromNode.w / 2}
                    cy={fromNode.y + fromNode.h / 2}
                    r={8}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    className="animate-pulse"
                  />
                );
              })()}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <div
                key={node.id}
                className={cn(
                  "absolute select-none group",
                  selectedId === node.id && "ring-2 ring-primary ring-offset-1 ring-offset-transparent rounded-lg",
                  connecting === node.id && "ring-2 ring-primary/50 rounded-lg",
                  tool === "connect" ? "cursor-crosshair" : "cursor-move",
                )}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                }}
                onMouseDown={e => onNodeDown(e, node.id)}
                onDoubleClick={() => { if (canEdit) setEditingLabel(node.id); }}
              >
                {/* Shape background */}
                <svg width={node.w} height={node.h} className="absolute inset-0" style={{ overflow: "visible" }}>
                  <ShapeSvg type={node.type} w={node.w} h={node.h} color={node.color} />
                </svg>

                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center p-2 z-10">
                  {editingLabel === node.id ? (
                    <textarea
                      autoFocus
                      value={node.label}
                      onChange={e => updateNode(node.id, { label: e.target.value })}
                      onBlur={() => setEditingLabel(null)}
                      onKeyDown={e => { if (e.key === "Escape") setEditingLabel(null); }}
                      className="w-full h-full bg-transparent text-center text-foreground text-xs resize-none outline-none border-none"
                      style={{ fontSize: node.fontSize || 12 }}
                    />
                  ) : (
                    <span
                      className="text-foreground text-center leading-tight break-words w-full"
                      style={{ fontSize: node.fontSize || 12 }}
                    >
                      {node.label || (
                        <span className="text-muted-foreground/50 italic text-[10px]">Doppelklick</span>
                      )}
                    </span>
                  )}
                </div>

                {/* Resize handle */}
                {canEdit && selectedId === node.id && (
                  <div
                    className="absolute -right-1 -bottom-1 w-3 h-3 bg-primary rounded-sm cursor-se-resize z-20"
                    onMouseDown={e => onResizeDown(e, node.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Properties Panel ───────────────── */}
        {selectedNode && canEdit && (
          <div className="w-56 border-l border-border bg-card/50 p-3 shrink-0 space-y-3 overflow-y-auto z-10">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eigenschaften</h4>

            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground">Label</label>
              <Input
                value={selectedNode.label}
                onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
                className="h-7 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground">Farbe</label>
              <div className="flex flex-wrap gap-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-transform",
                      selectedNode.color === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ background: c }}
                    onClick={() => updateNode(selectedNode.id, { color: c })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground">Schriftgröße</label>
              <Input
                type="number"
                value={selectedNode.fontSize || 12}
                onChange={e => updateNode(selectedNode.id, { fontSize: parseInt(e.target.value) || 12 })}
                min={8}
                max={32}
                className="h-7 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Breite</label>
                <Input
                  type="number"
                  value={Math.round(selectedNode.w)}
                  onChange={e => updateNode(selectedNode.id, { w: parseInt(e.target.value) || 100 })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Höhe</label>
                <Input
                  type="number"
                  value={Math.round(selectedNode.h)}
                  onChange={e => updateNode(selectedNode.id, { h: parseInt(e.target.value) || 60 })}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <Button variant="destructive" size="sm" className="w-full h-7 text-xs gap-1" onClick={deleteSelected}>
              <Trash2 className="h-3 w-3" /> Löschen
            </Button>
          </div>
        )}

        {/* ─── AI Chat Sidebar ────────────────── */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border bg-card/80 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden z-10"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">KI-Assistent</span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setChatOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-xs">Beschreibe deinen SOP-Prozess und die KI erstellt ein Flowchart dafür.</p>
                    <div className="mt-4 space-y-2">
                      {[
                        "Erstelle einen Onboarding-Prozess für neue Kunden",
                        "Content-Produktion Workflow mit Freigabe",
                        "Shoot-Day Vorbereitung Checkliste als Flow",
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => { setChatInput(suggestion); }}
                          className="block w-full text-left text-[11px] px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={e => {
                      setChatInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                    }}
                    placeholder="Beschreibe den Prozess..."
                    className="text-xs min-h-[32px] max-h-[160px] resize-none py-1.5"
                    rows={1}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    disabled={chatLoading}
                  />
                  <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
