import { useState, useRef, useCallback, useEffect, MouseEvent } from "react";
import {
  CanvasNode,
  Connection,
  CTYPES,
  NODE_W,
  NODE_H,
  genId,
} from "@/lib/content-types";
import { supabase } from "@/integrations/supabase/client";
import IdeaNode from "./IdeaNode";
import ContentNode from "./ContentNode";
import ImageNode from "./ImageNode";
import ModelNode from "./ModelNode";
import TextNode from "./TextNode";
import StickyNode from "./StickyNode";
import ZoneNode from "./ZoneNode";
import HtmlImageNode from "./HtmlImageNode";
import type { BrandOption } from "./NodeWrapper";

interface Props {
  userId: string;
  userEmail: string;
  projectId?: string | null;
  onBack?: () => void;
}

export default function CanvasApp({ userId, userEmail, projectId: initialProjectId, onBack }: Props) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [projectName, setProjectName] = useState("Neues Projekt");
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: "i1", type: "idea", x: 160, y: 180, idea: "" },
    { id: "m1", type: "model", x: 420, y: 200, model: "claude" },
  ]);
  const [conns, setConns] = useState<Connection[]>([]);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [drawing, setDrawing] = useState<{ from: string; side: string; mx: number; my: number } | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 100, y: 60 });
  const [zoom, setZoom] = useState(1);
  const [panState, setPanState] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const cvRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const connsRef = useRef(conns);
  connsRef.current = conns;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast2 = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const upd = (id: string, u: Record<string, unknown>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...u } as CanvasNode : n)));

  const duplicate = (id: string) => {
    const n = nodesRef.current.find((x) => x.id === id);
    if (!n) return;
    setNodes((ns) => [...ns, { ...n, id: genId(), x: n.x + 30, y: n.y + 30, loading: false }]);
    toast2("Node dupliziert");
  };

  const del = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setConns((cs) => cs.filter((c) => c.f !== id && c.t !== id));
  };

  useEffect(() => {
    const loadProject = async () => {
      if (!initialProjectId) return;
      const { data } = await supabase.from("cb_projects").select("*").eq("user_id", userId).eq("id", initialProjectId).limit(1);
      if (data && data.length > 0) {
        const p = data[0] as any;
        setProjectId(p.id);
        setProjectName(p.name);
        const loadedNodes = (p.nodes as any[]) || [];
        const loadedConns = (p.connections as any[]) || [];
        if (loadedNodes.length > 0) {
          setNodes(loadedNodes as CanvasNode[]);
          setConns(loadedConns as Connection[]);
        }
      }
    };
    loadProject();
  }, [userId, initialProjectId]);

  useEffect(() => {
    const loadBrands = async () => {
      const { data } = await supabase.from("cb_brands").select("id, name, logos").eq("user_id", userId);
      if (data) setBrands(data.map((b: any) => ({ id: b.id, name: b.name, logos: b.logos || [] })));
    };
    loadBrands();
  }, [userId]);

  const saveProject = useCallback(async (ns: CanvasNode[], cs: Connection[]) => {
    setSaving(true);
    try {
      const cleanNodes = ns.map(n => ({ ...n, loading: false }));
      if (projectId) {
        await supabase.from("cb_projects").update({ nodes: cleanNodes as any, connections: cs as any, name: projectName }).eq("id", projectId);
      } else {
        const { data } = await supabase.from("cb_projects").insert({ user_id: userId, nodes: cleanNodes as any, connections: cs as any, name: projectName }).select("id").single();
        if (data) setProjectId(data.id);
      }
    } catch (e) { console.error("Save error:", e); }
    setSaving(false);
  }, [projectId, userId, projectName]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProject(nodes, conns), 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [nodes, conns, saveProject]);

  const generate = useCallback(async (ideaId: string) => {
    const currentNodes = nodesRef.current;
    const currentConns = connsRef.current;
    const iNode = currentNodes.find((n) => n.id === ideaId);
    if (!iNode?.idea?.trim()) { toast2("Gib zuerst eine Idee ein!"); return; }
    const idea = iNode.idea;
    const directTargets = currentConns.filter((c) => c.f === ideaId).map((c) => c.t);
    if (!directTargets.length) { toast2("Verbinde zuerst Nodes mit der Idee!"); return; }

    const genTargets: { nodeId: string; model: string }[] = [];
    for (const tid of directTargets) {
      const tn = currentNodes.find((n) => n.id === tid);
      if (!tn) continue;
      if (tn.type === "model") {
        const modelTargets = currentConns.filter((c) => c.f === tn.id).map((c) => c.t);
        for (const mtid of modelTargets) genTargets.push({ nodeId: mtid, model: tn.model || "claude" });
      } else if (tn.type === "content" || tn.type === "image" || tn.type === "htmlimage") {
        genTargets.push({ nodeId: tn.id, model: "claude" });
      }
    }
    if (!genTargets.length) { toast2("Verbinde Content-Nodes mit einem Model-Node!"); return; }
    const referenceImages = iNode.referenceImages || [];

    const promises = genTargets.map(async ({ nodeId, model }) => {
      const targetNode = currentNodes.find((n) => n.id === nodeId);
      if (!targetNode) return;
      if (targetNode.type === "content") {
        upd(nodeId, { loading: true, content: "" });
        try {
          const resp = await supabase.functions.invoke("cb-generate", { body: { type: "content", ctype: targetNode.ctype || "linkedin", idea, model, referenceImages } });
          if (resp.error) throw new Error(resp.error.message);
          upd(nodeId, { loading: false, content: resp.data?.content || "Keine Antwort." });
        } catch (e: any) { upd(nodeId, { loading: false, content: `Fehler: ${e.message}` }); }
      }
      if (targetNode.type === "image") {
        upd(nodeId, { loading: true, imageUrl: null });
        try {
          const resp = await supabase.functions.invoke("cb-generate", { body: { type: "image", idea, model, referenceImages } });
          if (resp.error) throw new Error(resp.error.message);
          upd(nodeId, { loading: false, imageUrl: resp.data?.imageUrl || null, prompt: idea });
        } catch (e: any) { upd(nodeId, { loading: false, prompt: `Fehler: ${e.message}` }); }
      }
      if (targetNode.type === "htmlimage") {
        upd(nodeId, { loading: true, content: "" });
        try {
          const resp = await supabase.functions.invoke("cb-generate", { body: { type: "htmlimage", idea, model, referenceImages, format: targetNode.format || "instagram-post" } });
          if (resp.error) throw new Error(resp.error.message);
          upd(nodeId, { loading: false, content: resp.data?.content || "Kein HTML." });
        } catch (e: any) { upd(nodeId, { loading: false, content: `<div style="padding:20px;color:red;">Fehler: ${e.message}</div>` }); }
      }
    });
    await Promise.all(promises);
  }, []);

  const handleUpdate = (id: string, u: Record<string, unknown>) => {
    if (u._gen) { const { _gen, ...rest } = u; if (Object.keys(rest).length) upd(id, rest); generate(id); } else upd(id, u);
  };

  const startDrag = (e: MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    if (e.shiftKey) { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); return; }
    if (!selected.has(id)) setSelected(new Set([id]));
    setDrag({ id, ox: e.clientX - n.x * zoom, oy: e.clientY - n.y * zoom });
  };

  const onPort = (e: MouseEvent, nid: string, side: string) => {
    e.stopPropagation();
    const rect = cvRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawing({ from: nid, side, mx: (e.clientX - rect.left - pan.x) / zoom, my: (e.clientY - rect.top - pan.y) / zoom });
  };

  const dragStartPos = useRef<{ nodePositions: Record<string, { x: number; y: number }>; startX: number; startY: number } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const rect = cvRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left - pan.x) / zoom;
    const cy = (e.clientY - rect.top - pan.y) / zoom;
    setMouse({ x: cx, y: cy });
    if (drag) {
      const newX = (e.clientX - drag.ox) / zoom;
      const newY = (e.clientY - drag.oy) / zoom;
      const dragNode = nodesRef.current.find((n) => n.id === drag.id);
      if (dragNode && selected.size > 1 && selected.has(drag.id)) {
        if (!dragStartPos.current) {
          const positions: Record<string, { x: number; y: number }> = {};
          nodesRef.current.filter((n) => selected.has(n.id)).forEach((n) => { positions[n.id] = { x: n.x, y: n.y }; });
          dragStartPos.current = { nodePositions: positions, startX: dragNode.x, startY: dragNode.y };
        }
        const dx = newX - dragStartPos.current.startX;
        const dy = newY - dragStartPos.current.startY;
        setNodes((ns) => ns.map((n) => { if (!selected.has(n.id)) return n; const orig = dragStartPos.current!.nodePositions[n.id]; if (!orig) return n; return { ...n, x: orig.x + dx, y: orig.y + dy }; }));
      } else upd(drag.id, { x: newX, y: newY });
    }
    if (marquee) setMarquee((m) => m ? { ...m, ex: cx, ey: cy } : null);
    if (panState) setPan({ x: e.clientX - panState.x, y: e.clientY - panState.y });
  }, [drag, panState, pan, zoom, selected, marquee]);

  useEffect(() => {
    if (!drawing) return;
    const handleMove = (e: globalThis.MouseEvent) => {
      const rect = cvRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMouse({ x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom });
    };
    const handleUp = (e: globalThis.MouseEvent) => {
      const rect = cvRef.current?.getBoundingClientRect();
      if (!rect) { setDrawing(null); return; }
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      const currentNodes = nodesRef.current;
      let bestId: string | null = null; let bestSide: string | null = null; let bestDist = 40;
      for (const n of currentNodes) {
        if (n.id === drawing.from) continue;
        const el = document.querySelector(`[data-node-id="${n.id}"]`) as HTMLElement | null;
        const nw = el ? el.offsetWidth : (NODE_W[n.type] || 260);
        const nh = el ? el.offsetHeight : (NODE_H[n.type] || 160);
        const dIn = Math.hypot(mx - n.x, my - (n.y + nh / 2));
        if (dIn < bestDist) { bestDist = dIn; bestId = n.id; bestSide = "in"; }
        const dOut = Math.hypot(mx - (n.x + nw), my - (n.y + nh / 2));
        if (dOut < bestDist) { bestDist = dOut; bestId = n.id; bestSide = "out"; }
      }
      if (bestId && bestSide) {
        const f = drawing.side === "out" ? drawing.from : bestId;
        const t = drawing.side === "out" ? bestId : drawing.from;
        setConns((cs) => { if (cs.find((c) => c.f === f && c.t === t)) return cs; const nc = [...cs, { id: genId(), f, t }]; connsRef.current = nc; return nc; });
      }
      setDrawing(null);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => { document.removeEventListener("mousemove", handleMove); document.removeEventListener("mouseup", handleUp); };
  }, [drawing, pan, zoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") { if (selected.size > 0) { e.preventDefault(); deleteSelected(); } }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); selectAll(); }
      if (e.key === "Escape") setSelected(new Set());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, nodes]);

  const onMouseUp = useCallback(() => {
    setDrag(null); setPanState(null); dragStartPos.current = null;
    if (marquee) {
      const x1 = Math.min(marquee.sx, marquee.ex); const y1 = Math.min(marquee.sy, marquee.ey);
      const x2 = Math.max(marquee.sx, marquee.ex); const y2 = Math.max(marquee.sy, marquee.ey);
      const sel = new Set<string>();
      for (const n of nodesRef.current) {
        const el = document.querySelector(`[data-node-id="${n.id}"]`) as HTMLElement | null;
        const nw = el ? el.offsetWidth : (NODE_W[n.type] || 260); const nh = el ? el.offsetHeight : (NODE_H[n.type] || 160);
        if (n.x + nw > x1 && n.x < x2 && n.y + nh > y1 && n.y < y2) sel.add(n.id);
      }
      setSelected(sel); setMarquee(null);
    }
  }, [marquee]);

  const onWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setZoom((z) => Math.max(0.3, Math.min(2, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }, []);

  const onCvDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { e.preventDefault(); setPanState({ x: e.clientX - pan.x, y: e.clientY - pan.y }); return; }
    if (e.button === 0 && !e.altKey) {
      const rect = cvRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = (e.clientX - rect.left - pan.x) / zoom; const cy = (e.clientY - rect.top - pan.y) / zoom;
      setMarquee({ sx: cx, sy: cy, ex: cx, ey: cy });
      if (!e.shiftKey) setSelected(new Set());
    }
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    setNodes((ns) => ns.filter((n) => !selected.has(n.id)));
    setConns((cs) => cs.filter((c) => !selected.has(c.f) && !selected.has(c.t)));
    setSelected(new Set());
    toast2(`${selected.size} Node(s) gelöscht`);
  };

  const selectAll = () => setSelected(new Set(nodes.map((n) => n.id)));

  const addNode = (type: string, ctid?: string) => {
    const id = genId();
    const base = { x: 500 + Math.random() * 250, y: 120 + Math.random() * 280 };
    const autoConnect = (ns: CanvasNode[]) => {
      const ideaNodes = ns.filter((n) => n.type === "idea");
      let nearest: CanvasNode | null = null; let minDist = Infinity;
      for (const idea of ideaNodes) { const d = Math.hypot(idea.x - base.x, idea.y - base.y); if (d < minDist) { minDist = d; nearest = idea; } }
      if (nearest) setConns((cs) => { if (cs.find((c) => c.f === nearest!.id && c.t === id)) return cs; return [...cs, { id: genId(), f: nearest!.id, t: id }]; });
    };
    if (type === "content") setNodes((ns) => { autoConnect(ns); return [...ns, { id, type: "content", ctype: ctid, ...base, content: "", loading: false }]; });
    else if (type === "image") setNodes((ns) => { autoConnect(ns); return [...ns, { id, type: "image", ...base }]; });
    else if (type === "htmlimage") setNodes((ns) => { autoConnect(ns); return [...ns, { id, type: "htmlimage", ...base, content: "", width: 300, height: 340 }]; });
    else if (type === "idea") setNodes((ns) => [...ns, { id, type: "idea", ...base, idea: "" }]);
    else if (type === "model") setNodes((ns) => [...ns, { id, type: "model", ...base, model: "claude" }]);
    else if (type === "text") setNodes((ns) => [...ns, { id, type: "text", ...base, text: "", width: 200 }]);
    else if (type === "sticky") setNodes((ns) => [...ns, { id, type: "sticky", ...base, text: "", stickyColor: "yellow", width: 160, height: 140 }]);
    else if (type === "zone") setNodes((ns) => [...ns, { id, type: "zone", x: base.x, y: base.y - 100, width: 280, height: 600, zoneLabel: ctid || "Zone" }]);
  };

  const addQuarterZones = () => {
    const colors = ["#3b82f6", "#22c55e", "#f97316", "#ef4444"];
    const labels = ["Q1 – Jan–Mar", "Q2 – Apr–Jun", "Q3 – Jul–Sep", "Q4 – Okt–Dez"];
    const newNodes: CanvasNode[] = labels.map((label, i) => ({ id: genId(), type: "zone" as const, x: 100 + i * 350, y: 50, width: 320, height: 700, zoneLabel: label, color: colors[i] }));
    setNodes((ns) => [...ns, ...newNodes]);
    toast2("4 Quartal-Spalten erstellt");
  };

  const getPortXY = (nodeId: string, side: "out" | "in") => {
    const el = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    const n = nodes.find((nd) => nd.id === nodeId);
    if (!n) return { x: 0, y: 0 };
    if (el) { const w = el.offsetWidth; const h = el.offsetHeight; return side === "out" ? { x: n.x + w, y: n.y + h / 2 } : { x: n.x, y: n.y + h / 2 }; }
    const fw = NODE_W[n.type] || 260; const fh = NODE_H[n.type] || 160;
    return side === "out" ? { x: n.x + fw, y: n.y + fh / 2 } : { x: n.x, y: n.y + fh / 2 };
  };

  const cpath = (f: string, t: string) => {
    const p1 = getPortXY(f, "out"); const p2 = getPortXY(t, "in");
    const dx = Math.abs(p2.x - p1.x) * 0.55;
    return `M${p1.x} ${p1.y} C${p1.x + dx} ${p1.y},${p2.x - dx} ${p2.y},${p2.x} ${p2.y}`;
  };

  const drawPath = () => {
    if (!drawing) return "";
    const p = getPortXY(drawing.from, drawing.side as "out" | "in");
    const dx = Math.abs(mouse.x - p.x) * 0.55; const sign = drawing.side === "out" ? 1 : -1;
    return `M${p.x} ${p.y} C${p.x + sign * dx} ${p.y},${mouse.x - sign * dx} ${mouse.y},${mouse.x} ${mouse.y}`;
  };

  const connSet = (id: string) => ({ out: conns.some((c) => c.f === id), in: conns.some((c) => c.t === id) });

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Topbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm min-w-[300px]">
        <span className="text-[13px] font-bold">CB</span>
        <div className="w-px h-4 bg-border" />
        {onBack && <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none" onClick={onBack}>← Projekte</button>}
        {onBack && <div className="w-px h-4 bg-border" />}
        <input className="text-[13px] text-muted-foreground bg-transparent border-none outline-none w-32 hover:text-foreground focus:text-foreground" value={projectName} onChange={(e) => setProjectName(e.target.value)} onMouseDown={(e) => e.stopPropagation()} />
        <div className="flex items-center gap-2 ml-auto">
          {saving && <span className="text-[10px] text-muted-foreground">Speichern…</span>}
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">✓ AI aktiv</span>
        </div>
      </div>

      {/* Canvas */}
      <div className={`cb-canvas-area cb-dot-grid${drawing ? " cb-drawing" : ""}`} ref={cvRef} onMouseDown={onCvDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onWheel={onWheel}>
        <div className="cb-canvas-inner" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
          <svg className="cb-canvas-svg" width="10000" height="10000" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            {conns.map((c) => (
              <g key={c.id} style={{ cursor: 'pointer', pointerEvents: 'all' }} onClick={() => { setConns((prev) => prev.filter((cc) => cc.id !== c.id)); connsRef.current = connsRef.current.filter((cc) => cc.id !== c.id); }}>
                <path d={cpath(c.f, c.t)} stroke="transparent" strokeWidth="16" fill="none" />
                <path className="cb-conn-path" d={cpath(c.f, c.t)} />
              </g>
            ))}
            {drawing && <path className="cb-conn-path cb-dashed" d={drawPath()} style={{ pointerEvents: 'none' }} />}
            {marquee && <rect x={Math.min(marquee.sx, marquee.ex)} y={Math.min(marquee.sy, marquee.ey)} width={Math.abs(marquee.ex - marquee.sx)} height={Math.abs(marquee.ey - marquee.sy)} fill="hsla(var(--primary) / 0.08)" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />}
          </svg>
          {nodes.filter(n => n.type === "zone").map((n) => <ZoneNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onUpdate={(u) => upd(n.id, u)} isSelected={selected.has(n.id)} />)}
          {nodes.filter(n => n.type !== "zone").map((n) => {
            const cs = connSet(n.id); const isSel = selected.has(n.id);
            if (n.type === "idea") return <IdeaNode key={n.id} node={n} onUpdate={(u) => handleUpdate(n.id, u)} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onDuplicate={() => duplicate(n.id)} isSelected={isSel} userId={userId} conns={cs} brands={brands} />;
            if (n.type === "content") return <ContentNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onDel={() => del(n.id)} onUpdate={(u) => upd(n.id, u)} onDuplicate={() => duplicate(n.id)} isSelected={isSel} conns={cs} brands={brands} />;
            if (n.type === "image") return <ImageNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onDel={() => del(n.id)} onUpdate={(u) => upd(n.id, u)} onDuplicate={() => duplicate(n.id)} isSelected={isSel} conns={cs} brands={brands} />;
            if (n.type === "model") return <ModelNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onUpdate={(u) => upd(n.id, u)} onDuplicate={() => duplicate(n.id)} isSelected={isSel} conns={cs} brands={brands} />;
            if (n.type === "text") return <TextNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onUpdate={(u) => upd(n.id, u)} onDuplicate={() => duplicate(n.id)} isSelected={isSel} conns={cs} brands={brands} />;
            if (n.type === "sticky") return <StickyNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onUpdate={(u) => upd(n.id, u)} onDuplicate={() => duplicate(n.id)} isSelected={isSel} conns={cs} brands={brands} />;
            if (n.type === "htmlimage") return <HtmlImageNode key={n.id} node={n} onDrag={(e) => startDrag(e, n.id)} onPort={onPort} onDel={() => del(n.id)} onUpdate={(u) => upd(n.id, u)} onDuplicate={() => duplicate(n.id)} isSelected={isSel} conns={cs} brands={brands} />;
            return null;
          })}
        </div>
      </div>

      {/* Selection toolbar */}
      {selected.size > 1 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[200] bg-card border border-primary/30 rounded-lg px-3 py-2 flex items-center gap-2 shadow-md">
          <span className="text-[11px] font-semibold text-foreground">{selected.size} ausgewählt</span>
          <button className="px-2.5 py-1 rounded-sm text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer" onClick={deleteSelected}>Löschen</button>
          <button className="px-2.5 py-1 rounded-sm text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 cursor-pointer" onClick={() => { setSelected(new Set()); toast2("Auswahl aufgehoben"); }}>✕ Aufheben</button>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-1.5 shadow-sm flex-nowrap">
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium text-muted-foreground cursor-pointer whitespace-nowrap hover:bg-background hover:text-foreground" onClick={() => addNode("idea")}>✦ Idee</button>
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium cursor-pointer whitespace-nowrap hover:bg-background hover:text-foreground" style={{ color: "#2563eb" }} onClick={() => addNode("model")}>✦ Model</button>
        <div className="w-px h-5 bg-border" />
        {CTYPES.filter((c) => !c.isImage).map((ct) => (
          <button key={ct.id} className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium cursor-pointer whitespace-nowrap hover:bg-background" style={{ color: ct.color }} onClick={() => addNode("content", ct.id)}>{ct.icon} {ct.label}</button>
        ))}
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium cursor-pointer whitespace-nowrap hover:bg-background" style={{ color: "#ea580c" }} onClick={() => addNode("image")}>KI-Bild</button>
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium cursor-pointer whitespace-nowrap hover:bg-background" style={{ color: "#16a34a" }} onClick={() => addNode("htmlimage")}>HTML-Bild</button>
        <div className="w-px h-5 bg-border" />
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium text-muted-foreground cursor-pointer whitespace-nowrap hover:bg-background hover:text-foreground" onClick={() => addNode("text")}>T Text</button>
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium cursor-pointer whitespace-nowrap hover:bg-background" style={{ color: "#eab308" }} onClick={() => addNode("sticky")}>Sticky</button>
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium cursor-pointer whitespace-nowrap hover:bg-background" style={{ color: "#6366f1" }} onClick={() => addQuarterZones()}>Quartale</button>
        <div className="w-px h-5 bg-border" />
        <button className="px-3 py-1.5 rounded-sm border border-border bg-transparent text-xs font-medium text-muted-foreground cursor-pointer whitespace-nowrap hover:bg-background hover:text-foreground" onClick={() => { setZoom(1); setPan({ x: 100, y: 60 }); }}>⌖</button>
        <button className="px-3 py-1.5 rounded-sm border-none bg-primary text-primary-foreground text-xs font-semibold cursor-pointer whitespace-nowrap hover:opacity-85" onClick={() => nodes.filter((n) => n.type === "idea").forEach((n) => generate(n.id))}>▶ Alle generieren</button>
      </div>

      {toast && <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-xs font-medium z-[300] pointer-events-none">{toast}</div>}
    </div>
  );
}
