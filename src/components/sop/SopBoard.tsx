import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft, Square, Diamond, Type,
  StickyNote, Trash2, ZoomIn, ZoomOut, Sparkles, MessageSquare,
  X, Send, Loader2, MousePointer, ArrowRight, PlayCircle, StopCircle,
  CheckSquare, Clock, FileDown, Plus, Minus, Columns, ChevronRight,
  ListChecks, UserCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// ─── Types ─────────────────────────────────
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
  "Geschäftsführer", "Head of Content", "Cutter", "Alle", "Katha", "Jonas", "Maren", "Moritz", "Kunde",
];

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  start: { w: 180, h: 56 },
  end: { w: 180, h: 56 },
  process: { w: 220, h: 80 },
  decision: { w: 160, h: 160 },
  parallel: { w: 220, h: 80 },
  checklist: { w: 240, h: 110 },
  note: { w: 200, h: 100 },
  text: { w: 200, h: 40 },
};

// ─── Responsible color map ───────────────────
const RESPONSIBLE_COLORS: Record<string, string> = {
  "Jonas": "#3b82f6",
  "Geschäftsführer": "#3b82f6",
  "admin": "#3b82f6",
  "Maren": "#8b5cf6",
  "Head of Content": "#8b5cf6",
  "head_of_content": "#8b5cf6",
  "Moritz": "#f59e0b",
  "Cutter": "#f59e0b",
  "cutter": "#f59e0b",
  "Kunde": "#6b7280",
  "Alle": "#10b981",
};

function getResponsibleColor(name?: string) {
  if (!name) return "#6b7280";
  return RESPONSIBLE_COLORS[name] || "#6b7280";
}

// ─── Node Renderers (HTML-based for better styling) ──
function NodeShape({ node, isSelected, isConnecting }: { node: SopNode; isSelected: boolean; isConnecting: boolean }) {
  const color = node.color;
  const respColor = getResponsibleColor(node.responsible);

  if (node.type === "start" || node.type === "end") {
    const isStart = node.type === "start";
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          borderRadius: 999,
          background: `linear-gradient(135deg, ${color}18, ${color}30)`,
          border: `2.5px solid ${color}`,
          boxShadow: isSelected
            ? `0 0 0 3px ${color}40, 0 4px 20px ${color}25`
            : `0 2px 12px ${color}15`,
        }}
      >
        <div className="flex items-center gap-2 px-4">
          {isStart ? (
            <PlayCircle className="h-4 w-4 shrink-0" style={{ color }} />
          ) : (
            <StopCircle className="h-4 w-4 shrink-0" style={{ color }} />
          )}
          <span className="text-[13px] font-semibold text-foreground tracking-tight">
            {node.label || (isStart ? "Start" : "Ende")}
          </span>
        </div>
      </div>
    );
  }

  if (node.type === "decision") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="absolute"
          style={{
            width: "70.7%",
            height: "70.7%",
            top: "14.6%",
            left: "14.6%",
            transform: "rotate(45deg)",
            background: `linear-gradient(135deg, ${color}12, ${color}25)`,
            border: `2.5px solid ${color}`,
            borderRadius: 8,
            boxShadow: isSelected
              ? `0 0 0 3px ${color}40, 0 4px 20px ${color}25`
              : `0 2px 12px ${color}12`,
          }}
        />
        <div className="relative z-10 text-center px-6">
          <span className="text-[11px] font-semibold text-foreground leading-tight">
            {node.label || "Entscheidung?"}
          </span>
        </div>
      </div>
    );
  }

  if (node.type === "note") {
    return (
      <div
        className="absolute inset-0 flex flex-col p-3"
        style={{
          background: `linear-gradient(135deg, ${color}20, ${color}10)`,
          border: `1.5px solid ${color}35`,
          borderRadius: 6,
          boxShadow: isSelected
            ? `0 0 0 3px ${color}30, 3px 4px 14px ${color}15`
            : `2px 3px 10px ${color}10`,
          borderLeft: `4px solid ${color}80`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <StickyNote className="h-3 w-3 shrink-0" style={{ color: color + "aa" }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: color + "cc" }}>
            Hinweis
          </span>
        </div>
        <span className="text-[11px] text-foreground/80 leading-snug line-clamp-3">
          {node.label || "..."}
        </span>
      </div>
    );
  }

  if (node.type === "checklist") {
    const items = node.checklistItems || [];
    const done = items.filter(i => i.done).length;
    const pct = items.length > 0 ? (done / items.length) * 100 : 0;
    return (
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}10, ${color}06)`,
          border: `2px solid ${color}50`,
          borderRadius: 10,
          boxShadow: isSelected
            ? `0 0 0 3px ${color}30, 0 4px 16px ${color}15`
            : `0 2px 10px ${color}08`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: `1px solid ${color}20` }}
        >
          <CheckSquare className="h-3.5 w-3.5 shrink-0" style={{ color }} />
          <span className="text-[12px] font-semibold text-foreground flex-1 truncate">
            {node.label || "Checkliste"}
          </span>
          {items.length > 0 && (
            <span className="text-[9px] font-mono font-bold" style={{ color }}>
              {done}/{items.length}
            </span>
          )}
        </div>
        {/* Progress bar */}
        {items.length > 0 && (
          <div className="px-3 pt-1.5">
            <div className="h-1 rounded-full w-full" style={{ background: `${color}15` }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : color }} />
            </div>
          </div>
        )}
        {/* Items preview */}
        <div className="px-3 py-1.5 flex-1 overflow-hidden">
          {items.slice(0, 3).map(item => (
            <div key={item.id} className="flex items-center gap-1.5 py-0.5">
              <div
                className="h-2.5 w-2.5 rounded-sm border shrink-0 flex items-center justify-center"
                style={{ borderColor: item.done ? "#10b981" : color + "60", background: item.done ? "#10b98120" : "transparent" }}
              >
                {item.done && <span className="text-[6px]" style={{ color: "#10b981" }}>✓</span>}
              </div>
              <span className={cn("text-[9px] truncate", item.done ? "text-muted-foreground line-through" : "text-foreground/70")}>
                {item.text}
              </span>
            </div>
          ))}
          {items.length > 3 && (
            <span className="text-[8px] text-muted-foreground">+{items.length - 3} weitere</span>
          )}
        </div>
      </div>
    );
  }

  if (node.type === "parallel") {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color}10, ${color}06)`,
          border: `2px solid ${color}50`,
          borderRadius: 10,
          boxShadow: isSelected
            ? `0 0 0 3px ${color}30, 0 4px 16px ${color}15`
            : `0 2px 10px ${color}08`,
        }}
      >
        {/* Double-line indicator */}
        <div
          className="absolute left-0 top-2 bottom-2 w-1.5"
          style={{ borderLeft: `2.5px solid ${color}60`, borderRight: `2.5px solid ${color}60`, marginLeft: 6 }}
        />
        <div className="text-center px-6">
          <span className="text-[12px] font-semibold text-foreground">{node.label}</span>
          {node.description && (
            <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{node.description}</p>
          )}
        </div>
      </div>
    );
  }

  if (node.type === "text") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-foreground/60" style={{ fontSize: node.fontSize || 14 }}>
          {node.label}
        </span>
      </div>
    );
  }

  // Default: process
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-3"
      style={{
        background: `linear-gradient(180deg, ${color}12, ${color}06)`,
        border: `2px solid ${color}45`,
        borderRadius: 10,
        boxShadow: isSelected
          ? `0 0 0 3px ${color}30, 0 4px 20px ${color}18`
          : `0 2px 12px ${color}10`,
        borderTop: `3px solid ${color}90`,
      }}
    >
      <span className="text-[12px] font-semibold text-foreground text-center leading-tight">
        {node.label || "Prozess"}
      </span>
      {node.description && (
        <p className="text-[9px] text-muted-foreground mt-1 text-center line-clamp-2 leading-snug">
          {node.description}
        </p>
      )}
    </div>
  );
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
        backgroundColor: "#0f1117",
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

        {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Speichern...</span>}

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
          <div className="w-12 border-r border-border bg-card/50 flex flex-col items-center py-3 gap-1.5 shrink-0 z-10">
            {NODE_TYPES.map(s => (
              <button
                key={s.type}
                onClick={() => addNode(s.type)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                title={s.label}
              >
                <s.icon className="h-4 w-4" />
              </button>
            ))}
            <div className="h-px w-6 bg-border my-1" />
            {selectedId && (
              <button
                onClick={deleteSelected}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
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
            {swimlanes.map((lane) => {
              const laneColor = lane.color.replace(/20$/, "");
              return (
                <div
                  key={lane.id}
                  className="absolute left-0"
                  style={{
                    top: lane.y,
                    width: 4000,
                    height: lane.height,
                    backgroundColor: lane.color,
                    borderBottom: `1px dashed ${lane.color.replace("20", "40")}`,
                  }}
                >
                  {/* Swimlane label — vertical bar on left */}
                  <div
                    className="sticky left-0 z-10 flex items-start"
                    style={{ width: 150 }}
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-br-lg"
                      style={{
                        background: lane.color.replace("20", "35"),
                        borderRight: `1px solid ${lane.color.replace("20", "50")}`,
                        borderBottom: `1px solid ${lane.color.replace("20", "50")}`,
                      }}
                    >
                      <UserCircle className="h-3.5 w-3.5 shrink-0" style={{ color: lane.color.replace("20", "cc") }} />
                      {canEdit ? (
                        <input
                          className="bg-transparent text-xs font-semibold text-foreground/80 border-none outline-none w-24"
                          value={lane.label}
                          onChange={e => updateSwimlane(lane.id, { label: e.target.value })}
                        />
                      ) : (
                        <span className="text-xs font-semibold text-foreground/80">{lane.label}</span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => removeSwimlane(lane.id)}
                          className="text-muted-foreground/50 hover:text-destructive ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* SVG for connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
              <defs>
                <marker id="sop-arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--muted-foreground))" opacity="0.6" />
                </marker>
                <filter id="conn-glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
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
                      strokeWidth={2} strokeOpacity={0.4} markerEnd="url(#sop-arrowhead)"
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => canEdit && setConnections(prev => prev.filter(c => c.id !== conn.id))}
                    />
                    {conn.label && (
                      <>
                        <rect
                          x={mx - 16} y={my - 12} width={32} height={16}
                          rx={4} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1}
                        />
                        <text
                          x={mx} y={my - 1} textAnchor="middle"
                          fontSize={10} fontWeight={600} fill="hsl(var(--foreground))"
                          style={{ fontFamily: "Manrope, sans-serif" }}
                        >
                          {conn.label}
                        </text>
                      </>
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
                  "absolute select-none group/node transition-shadow",
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
                <NodeShape
                  node={node}
                  isSelected={selectedId === node.id}
                  isConnecting={connecting === node.id}
                />

                {/* Responsible badge */}
                {node.responsible && node.type !== "note" && node.type !== "text" && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap"
                      style={{
                        background: getResponsibleColor(node.responsible) + "20",
                        color: getResponsibleColor(node.responsible),
                        border: `1px solid ${getResponsibleColor(node.responsible)}30`,
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <UserCircle className="h-2.5 w-2.5" />
                      {node.responsible}
                    </div>
                  </div>
                )}

                {/* Timeframe badge */}
                {node.timeframe && node.type !== "note" && node.type !== "text" && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono whitespace-nowrap bg-card/90 border border-border/50"
                      style={{ backdropFilter: "blur(4px)" }}
                    >
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{node.timeframe}</span>
                    </div>
                  </div>
                )}

                {/* Resize handle */}
                {canEdit && selectedId === node.id && (
                  <div
                    className="absolute -right-1 -bottom-1 w-3 h-3 bg-primary rounded-sm cursor-se-resize z-20 opacity-80 hover:opacity-100"
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
              className="border-l border-border bg-card/95 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden z-10"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-sm font-semibold">Node-Details</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDetailOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Titel</label>
                  <Input
                    value={selectedNode.label}
                    onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Schritt-Titel..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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
                        <SelectItem key={r} value={r} className="text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ background: getResponsibleColor(r) }} />
                            {r}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeframe */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Zeitrahmen</label>
                  <Input
                    value={selectedNode.timeframe || ""}
                    onChange={e => updateNode(selectedNode.id, { timeframe: e.target.value || undefined })}
                    className="h-8 text-xs"
                    placeholder="z.B. innerhalb 24h, 3-4 Tage"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Farbe</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 transition-all",
                          selectedNode.color === c ? "border-foreground scale-125 shadow-lg" : "border-transparent hover:scale-110"
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
          <div className="w-52 border-l border-border bg-card/80 backdrop-blur-sm p-3 shrink-0 space-y-3 overflow-y-auto z-10">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick</h4>
              <button onClick={() => setDetailOpen(true)} className="text-primary text-[10px] hover:underline font-medium">Details →</button>
            </div>
            <Input
              value={selectedNode.label}
              onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
              className="h-7 text-xs" placeholder="Label"
            />
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={cn("w-4 h-4 rounded-full border-2 transition-all",
                    selectedNode.color === c ? "border-foreground scale-125" : "border-transparent hover:scale-110")}
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
              className="border-l border-border bg-card/90 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden z-10"
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
                        "Erstelle Swimlanes für Jonas, Maren, Moritz",
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => setChatInput(suggestion)}
                          className="block w-full text-left text-[11px] px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
                      "max-w-[85%] rounded-xl px-3 py-2 text-xs",
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
                    <div className="bg-muted rounded-xl px-3 py-2">
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
