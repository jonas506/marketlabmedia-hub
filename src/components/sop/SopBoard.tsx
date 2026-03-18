import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft, Square, Diamond, Circle, Triangle, Hexagon, Type,
  StickyNote, Trash2, ZoomIn, ZoomOut, Sparkles, Save, MessageSquare,
  X, Send, Loader2, MousePointer, ArrowRight, PlayCircle, StopCircle,
  CheckSquare, User, Clock, FileDown, Plus, Minus, Columns, ChevronRight,
  ListChecks, UserCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// ─── Types ─────────────────────────────────────
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface SopNode {
  id: string;
  type: "start" | "end" | "process" | "decision" | "parallel" | "checklist" | "note" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  fontSize?: number;
  responsible?: string;
  timeframe?: string;
  description?: string;
  checklistItems?: ChecklistItem[];
  swimlane?: string;
}

export interface SopConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface Swimlane {
  id: string;
  label: string;
  color: string;
  y: number;
  height: number;
}

export interface BoardData {
  nodes: SopNode[];
  connections: SopConnection[];
  swimlanes?: Swimlane[];
}

interface SopTemplateRef {
  id: string;
  name: string;
  category: string | null;
  board_data: BoardData | null;
}

interface Props {
  templateId: string;
  templateName: string;
  initialBoard: BoardData;
  onBack: () => void;
  canEdit: boolean;
  allTemplates?: SopTemplateRef[];
  onSwitchTemplate?: (tpl: SopTemplateRef) => void;
  category?: string | null;
}

// ─── Constants ─────────────────────────────────
let _nid = 0;
const genId = () => `sn_${Date.now()}_${++_nid}`;

const NODE_TYPES = [
  { type: "start", icon: PlayCircle, label: "Start", defaultColor: "#10b981" },
  { type: "end", icon: StopCircle, label: "Ende", defaultColor: "#ef4444" },
  { type: "process", icon: Square, label: "Prozess", defaultColor: "#3b82f6" },
  { type: "decision", icon: Diamond, label: "Entscheidung", defaultColor: "#f59e0b" },
  { type: "parallel", icon: Columns, label: "Parallel", defaultColor: "#8b5cf6" },
  { type: "checklist", icon: CheckSquare, label: "Checkliste", defaultColor: "#06b6d4" },
  { type: "note", icon: StickyNote, label: "Hinweis", defaultColor: "#eab308" },
  { type: "text", icon: Type, label: "Text", defaultColor: "#6b7280" },
] as const;

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const SWIMLANE_COLORS = [
  "#3b82f620", "#10b98120", "#8b5cf620", "#f59e0b20", "#ec489920", "#06b6d420",
];

const RESPONSIBLE_OPTIONS = [
  "Geschäftsführer", "Head of Content", "Cutter", "Alle", "Katha", "Jonas",
];

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  start: { w: 160, h: 60 },
  end: { w: 160, h: 60 },
  process: { w: 180, h: 80 },
  decision: { w: 140, h: 140 },
  parallel: { w: 180, h: 80 },
  checklist: { w: 200, h: 100 },
  note: { w: 180, h: 120 },
  text: { w: 200, h: 40 },
};

// ─── Shape SVG Renderers ───────────────────────
function ShapeSvg({ type, w, h, color }: { type: string; w: number; h: number; color: string }) {
  const fill = color + "22";
  const stroke = color;

  switch (type) {
    case "start":
    case "end":
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={h / 2} fill={fill} stroke={stroke} strokeWidth={2.5} />;
    case "process":
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "decision":
      return <polygon points={`${w / 2},4 ${w - 4},${h / 2} ${w / 2},${h - 4} 4,${h / 2}`} fill={fill} stroke={stroke} strokeWidth={2} />;
    case "parallel":
      return (
        <>
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} fill={fill} stroke={stroke} strokeWidth={2} />
          <line x1={10} y1={6} x2={10} y2={h - 6} stroke={stroke} strokeWidth={2} />
          <line x1={16} y1={6} x2={16} y2={h - 6} stroke={stroke} strokeWidth={2} />
        </>
      );
    case "checklist":
      return (
        <>
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={6} fill={fill} stroke={stroke} strokeWidth={2} />
          <rect x={10} y={h / 2 - 5} width={10} height={10} rx={2} fill="none" stroke={stroke} strokeWidth={1.5} />
          <polyline points={`12,${h / 2} 14,${h / 2 + 3} 18,${h / 2 - 3}`} fill="none" stroke={stroke} strokeWidth={1.5} />
        </>
      );
    case "note":
      return (
        <>
          <rect x={2} y={2} width={w - 4} height={h - 4} rx={4} fill={color + "33"} stroke={color + "66"} strokeWidth={1.5} />
          <path d={`M${w - 20},2 L${w - 4},18`} stroke={color + "44"} strokeWidth={1} />
        </>
      );
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

  let sx: number, sy: number, ex: number, ey: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    sx = dx > 0 ? from.x + from.w : from.x;
    sy = from.y + from.h / 2;
    ex = dx > 0 ? to.x : to.x + to.w;
    ey = to.y + to.h / 2;
  } else {
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

// ─── Main Component ────────────────────────────
export default function SopBoard({
  templateId, templateName, initialBoard, onBack, canEdit,
  allTemplates = [], onSwitchTemplate, category
}: Props) {
  const [nodes, setNodes] = useState<SopNode[]>(initialBoard.nodes || []);
  const [connections, setConnections] = useState<SopConnection[]>(initialBoard.connections || []);
  const [swimlanes, setSwimlanes] = useState<Swimlane[]>(initialBoard.swimlanes || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [tool, setTool] = useState<"select" | "connect">("select");
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave
  const schedSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const boardData = { nodes, connections, swimlanes };
      await supabase
        .from("sop_templates")
        .update({ board_data: boardData as any, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      setSaving(false);
    }, 2000);
  }, [nodes, connections, swimlanes, templateId]);

  useEffect(() => {
    if (canEdit) schedSave();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [nodes, connections, swimlanes, schedSave, canEdit]);

  // ─── Node CRUD ─────────────────────────────
  const addNode = (type: string) => {
    const conf = NODE_TYPES.find(t => t.type === type);
    const size = DEFAULT_SIZES[type] || { w: 160, h: 80 };
    const cx = (-pan.x + 500) / zoom;
    const cy = (-pan.y + 300) / zoom;
    const node: SopNode = {
      id: genId(), type: type as SopNode["type"],
      x: cx - size.w / 2, y: cy - size.h / 2,
      w: size.w, h: size.h,
      label: "",
      color: conf?.defaultColor || COLORS[nodes.length % COLORS.length],
      checklistItems: type === "checklist" ? [] : undefined,
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
    setDetailOpen(false);
  };

  // ─── Swimlanes ────────────────────────────
  const addSwimlane = () => {
    const lastLane = swimlanes[swimlanes.length - 1];
    const y = lastLane ? lastLane.y + lastLane.height : 0;
    setSwimlanes(prev => [...prev, {
      id: genId(),
      label: `Lane ${prev.length + 1}`,
      color: SWIMLANE_COLORS[prev.length % SWIMLANE_COLORS.length],
      y,
      height: 250,
    }]);
  };

  const updateSwimlane = (id: string, upd: Partial<Swimlane>) => {
    setSwimlanes(prev => prev.map(s => s.id === id ? { ...s, ...upd } : s));
  };

  const removeSwimlane = (id: string) => {
    setSwimlanes(prev => prev.filter(s => s.id !== id));
  };

  // ─── Checklist Items ──────────────────────
  const addChecklistItem = (nodeId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const items = [...(n.checklistItems || []), { id: genId(), text: "", done: false }];
      return { ...n, checklistItems: items };
    }));
  };

  const updateChecklistItem = (nodeId: string, itemId: string, upd: Partial<ChecklistItem>) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const items = (n.checklistItems || []).map(i => i.id === itemId ? { ...i, ...upd } : i);
      return { ...n, checklistItems: items };
    }));
  };

  const removeChecklistItem = (nodeId: string, itemId: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const items = (n.checklistItems || []).filter(i => i.id !== itemId);
      return { ...n, checklistItems: items };
    }));
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
      setDetailOpen(false);
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

  const onMouseUp = () => { dragRef.current = null; panRef.current = null; };

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
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
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
        body: { messages: newMsgs, currentBoard: { nodes, connections, swimlanes }, templateName },
      });
      if (resp.error) throw resp.error;
      const data = resp.data;

      if (data.board) {
        if (data.board.nodes) setNodes(data.board.nodes);
        if (data.board.connections) setConnections(data.board.connections);
        if (data.board.swimlanes) setSwimlanes(data.board.swimlanes);
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

  // ─── PDF Export ────────────────────────────
  const exportPDF = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: "#1a1a2e",
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;
      const isLandscape = imgW > imgH;
      const pdf = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: "a3" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;
      const scale = Math.min(usableW / imgW, usableH / imgH);

      pdf.addImage(imgData, "PNG", margin, margin, imgW * scale, imgH * scale);
      pdf.save(`${templateName || "SOP"}.pdf`);
      toast.success("PDF exportiert");
    } catch (err) {
      console.error(err);
      toast.error("Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  // ─── Keyboard ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingLabel || detailOpen) return;
        if (selectedId) deleteSelected();
      }
      if (e.key === "Escape") {
        setSelectedId(null); setConnecting(null); setEditingLabel(null); setDetailOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editingLabel, detailOpen]);

  const selectedNode = nodes.find(n => n.id === selectedId);

  // Breadcrumb categories
  const categories = [...new Set(allTemplates.map(t => t.category).filter(Boolean))] as string[];
  const sameCategoryTemplates = allTemplates.filter(t => t.category === category);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ─── Breadcrumb Bar ──────────────── */}
      {allTemplates.length > 0 && (
        <div className="px-4 py-1.5 border-b border-border bg-card/40 text-xs shrink-0 z-20">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink className="cursor-pointer text-xs hover:text-foreground" onClick={onBack}>
                  SOP-Boards
                </BreadcrumbLink>
              </BreadcrumbItem>
              {category && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="text-xs text-muted-foreground">{category}</span>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {sameCategoryTemplates.length > 1 ? (
                  <Select
                    value={templateId}
                    onValueChange={(val) => {
                      const tpl = allTemplates.find(t => t.id === val);
                      if (tpl && onSwitchTemplate) onSwitchTemplate(tpl);
                    }}
                  >
                    <SelectTrigger className="h-6 text-xs border-none bg-transparent p-0 w-auto gap-1 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sameCategoryTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <BreadcrumbPage className="text-xs">{templateName}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}

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
          <>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addSwimlane}>
              <Columns className="h-3 w-3" /> Swimlane
            </Button>
            <Button
              variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
              onClick={exportPDF} disabled={exporting}
            >
              <FileDown className="h-3 w-3" /> {exporting ? "..." : "PDF"}
            </Button>
            <Button
              variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <Sparkles className="h-3 w-3" /> KI
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Shape Toolbar (Left) ─────────── */}
        {canEdit && (
          <div className="w-12 border-r border-border bg-card/50 flex flex-col items-center py-2 gap-1 shrink-0 z-10">
            {NODE_TYPES.map(s => (
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
          <div
            className="sop-canvas-bg absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--cb-dot)) 1px, transparent 1px)`,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />

          <div
            ref={boardRef}
            className="absolute inset-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          >
            {/* Swimlanes */}
            {swimlanes.map((lane, idx) => (
              <div
                key={lane.id}
                className="absolute left-0 border-b border-dashed"
                style={{
                  top: lane.y,
                  width: 4000,
                  height: lane.height,
                  backgroundColor: lane.color,
                  borderColor: lane.color.replace("20", "50"),
                }}
              >
                <div className="sticky left-0 flex items-center gap-2 px-3 py-1.5">
                  {canEdit ? (
                    <input
                      className="bg-transparent text-xs font-semibold text-foreground/70 border-none outline-none w-32"
                      value={lane.label}
                      onChange={e => updateSwimlane(lane.id, { label: e.target.value })}
                    />
                  ) : (
                    <span className="text-xs font-semibold text-foreground/70">{lane.label}</span>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => removeSwimlane(lane.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}

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
                const mx = (fromNode.x + fromNode.w / 2 + toNode.x + toNode.w / 2) / 2;
                const my = (fromNode.y + fromNode.h / 2 + toNode.y + toNode.h / 2) / 2;
                return (
                  <g key={conn.id}>
                    <path
                      d={path} fill="none" stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2} markerEnd="url(#sop-arrowhead)"
                      className="pointer-events-auto cursor-pointer hover:stroke-destructive"
                      onClick={() => canEdit && setConnections(prev => prev.filter(c => c.id !== conn.id))}
                    />
                    {conn.label && (
                      <text x={mx} y={my - 6} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
                        {conn.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {connecting && (() => {
                const fromNode = nodes.find(n => n.id === connecting);
                if (!fromNode) return null;
                return (
                  <circle
                    cx={fromNode.x + fromNode.w / 2} cy={fromNode.y + fromNode.h / 2}
                    r={8} fill="none" stroke="hsl(var(--primary))"
                    strokeWidth={2} strokeDasharray="4 2" className="animate-pulse"
                  />
                );
              })()}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <div
                key={node.id}
                className={cn(
                  "absolute select-none group/node",
                  selectedId === node.id && "ring-2 ring-primary ring-offset-1 ring-offset-transparent rounded-lg",
                  connecting === node.id && "ring-2 ring-primary/50 rounded-lg",
                  tool === "connect" ? "cursor-crosshair" : "cursor-move",
                )}
                style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
                onMouseDown={e => onNodeDown(e, node.id)}
                onDoubleClick={() => {
                  if (!canEdit) return;
                  setSelectedId(node.id);
                  setDetailOpen(true);
                }}
              >
                <svg width={node.w} height={node.h} className="absolute inset-0" style={{ overflow: "visible" }}>
                  <ShapeSvg type={node.type} w={node.w} h={node.h} color={node.color} />
                </svg>

                {/* Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 z-10">
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
                    <>
                      <span
                        className="text-foreground text-center leading-tight break-words w-full"
                        style={{ fontSize: node.fontSize || 12 }}
                        onClick={() => { if (canEdit && tool === "select") setEditingLabel(node.id); }}
                      >
                        {node.label || <span className="text-muted-foreground/50 italic text-[10px]">Doppelklick</span>}
                      </span>
                    </>
                  )}
                </div>

                {/* Responsible badge */}
                {node.responsible && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-[16px] bg-primary/20 text-primary border-0 whitespace-nowrap">
                      <UserCircle className="h-2.5 w-2.5 mr-0.5" />
                      {node.responsible}
                    </Badge>
                  </div>
                )}

                {/* Timeframe badge */}
                {node.timeframe && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-[16px] bg-background/80 border-border whitespace-nowrap">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {node.timeframe}
                    </Badge>
                  </div>
                )}

                {/* Checklist indicator */}
                {node.checklistItems && node.checklistItems.length > 0 && (
                  <div className="absolute top-1 right-1 z-20">
                    <span className="text-[8px] font-mono text-muted-foreground bg-background/60 rounded px-1">
                      {node.checklistItems.filter(i => i.done).length}/{node.checklistItems.length}
                    </span>
                  </div>
                )}

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

        {/* ─── Detail Panel (Node Sidebar) ────── */}
        <AnimatePresence>
          {detailOpen && selectedNode && canEdit && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="border-l border-border bg-card/90 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden z-10"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-sm font-semibold">Node-Details</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDetailOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Titel</label>
                  <Input
                    value={selectedNode.label}
                    onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Schritt-Titel..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Beschreibung</label>
                  <Textarea
                    value={selectedNode.description || ""}
                    onChange={e => updateNode(selectedNode.id, { description: e.target.value })}
                    className="text-xs min-h-[60px] resize-none"
                    placeholder="Detaillierte Beschreibung..."
                    rows={3}
                  />
                </div>

                {/* Responsible */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Verantwortlicher</label>
                  <Select
                    value={selectedNode.responsible || "none"}
                    onValueChange={v => updateNode(selectedNode.id, { responsible: v === "none" ? undefined : v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Keiner</SelectItem>
                      {RESPONSIBLE_OPTIONS.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeframe */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Zeitrahmen</label>
                  <Input
                    value={selectedNode.timeframe || ""}
                    onChange={e => updateNode(selectedNode.id, { timeframe: e.target.value || undefined })}
                    className="h-8 text-xs"
                    placeholder="z.B. innerhalb 24h, 3-4 Tage"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Farbe</label>
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

                {/* Size */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Breite</label>
                    <Input
                      type="number" value={Math.round(selectedNode.w)}
                      onChange={e => updateNode(selectedNode.id, { w: parseInt(e.target.value) || 100 })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Höhe</label>
                    <Input
                      type="number" value={Math.round(selectedNode.h)}
                      onChange={e => updateNode(selectedNode.id, { h: parseInt(e.target.value) || 60 })}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Checkliste</label>
                    <button
                      onClick={() => addChecklistItem(selectedNode.id)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(selectedNode.checklistItems || []).map(item => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <Checkbox
                          checked={item.done}
                          onCheckedChange={(checked) => updateChecklistItem(selectedNode.id, item.id, { done: !!checked })}
                          className="h-3.5 w-3.5"
                        />
                        <input
                          value={item.text}
                          onChange={e => updateChecklistItem(selectedNode.id, item.id, { text: e.target.value })}
                          className={cn(
                            "flex-1 bg-transparent text-xs outline-none border-b border-transparent focus:border-border",
                            item.done && "line-through text-muted-foreground"
                          )}
                          placeholder="Item..."
                        />
                        <button
                          onClick={() => removeChecklistItem(selectedNode.id, item.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {(!selectedNode.checklistItems || selectedNode.checklistItems.length === 0) && (
                      <p className="text-[10px] text-muted-foreground/50 italic">Keine Items</p>
                    )}
                  </div>
                </div>

                <Button variant="destructive" size="sm" className="w-full h-7 text-xs gap-1" onClick={deleteSelected}>
                  <Trash2 className="h-3 w-3" /> Node löschen
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Properties Mini Panel ──────────── */}
        {selectedNode && canEdit && !detailOpen && (
          <div className="w-48 border-l border-border bg-card/50 p-3 shrink-0 space-y-2 overflow-y-auto z-10">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick</h4>
              <button onClick={() => setDetailOpen(true)} className="text-primary text-[10px] hover:underline">Details →</button>
            </div>
            <Input
              value={selectedNode.label}
              onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
              className="h-7 text-xs" placeholder="Label"
            />
            <div className="flex flex-wrap gap-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={cn("w-4 h-4 rounded-full border-2 transition-transform",
                    selectedNode.color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: c }}
                  onClick={() => updateNode(selectedNode.id, { color: c })}
                />
              ))}
            </div>
            <Button variant="destructive" size="sm" className="w-full h-6 text-[10px]" onClick={deleteSelected}>
              <Trash2 className="h-2.5 w-2.5 mr-1" /> Löschen
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
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-xs mb-4">Beschreibe deinen Prozess oder nutze einen Befehl:</p>
                    <div className="space-y-2 text-left">
                      {[
                        "Erstelle Prozess: Kunden-Onboarding mit Vertrag, Setup & Kick-off",
                        "Erstelle Prozess: Content-Produktion von Skript bis Freigabe",
                        "Füge Checkliste hinzu für: Kick-off Meeting",
                        "Wer ist verantwortlich für Schnitt?",
                        "Erstelle Swimlanes für Jonas, Katha, Head of Content",
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => setChatInput(suggestion)}
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
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
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
