import type { Editor } from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import { createShapeId, type TLShapeId } from "tldraw";

interface StrategyNode {
  id: string;
  type: "geo";
  geo: "rectangle" | "ellipse" | "diamond" | "hexagon";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fill: "solid" | "semi" | "none";
  size: "s" | "m" | "l";
  font: "sans";
  align: "middle" | "start";
  verticalAlign: "middle" | "start";
  dash: "solid";
}

interface StrategyEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  color: string;
  dash: "solid" | "dashed";
  bend?: number;
}

interface StrategyJSON {
  title: string;
  description?: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  key_insights?: string[];
  // Legacy compat
  strategy_title?: string;
  summary?: string;
  arrows?: any[];
  frames?: any[];
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function validateStrategy(strategy: StrategyJSON): StrategyJSON {
  // Minimum size
  strategy.nodes.forEach(n => {
    if (n.w < 120) n.w = 120;
    if (n.h < 60) n.h = 60;
  });

  // Force sans font and solid dash on all nodes
  strategy.nodes.forEach(n => {
    (n as any).font = "sans";
    if ((n as any).dash !== "solid") (n as any).dash = "solid";
  });

  // Filter edges to valid node references
  const nodeIds = new Set(strategy.nodes.map(n => n.id));
  strategy.edges = strategy.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

  // Force solid/dashed on edges
  strategy.edges.forEach(e => {
    if (e.dash !== "solid" && e.dash !== "dashed") {
      e.dash = "solid";
    }
  });

  // Shift to positive coordinates
  const minX = Math.min(...strategy.nodes.map(n => n.x), 0);
  const minY = Math.min(...strategy.nodes.map(n => n.y), 0);
  if (minX < 0 || minY < 0) {
    const offsetX = minX < 0 ? Math.abs(minX) + 50 : 0;
    const offsetY = minY < 0 ? Math.abs(minY) + 50 : 0;
    strategy.nodes.forEach(n => {
      n.x += offsetX;
      n.y += offsetY;
    });
  }

  return strategy;
}

export async function generateBoardFromStrategy(editor: Editor, strategy: StrategyJSON) {
  const shapeIdMap = new Map<string, TLShapeId>();

  // Handle legacy format
  const title = strategy.title || strategy.strategy_title || "Marketing-Strategie";
  const description = strategy.description || strategy.summary || "";
  
  // Handle legacy arrows format
  if (!strategy.edges && strategy.arrows) {
    strategy.edges = strategy.arrows.map((a: any, i: number) => ({
      id: `legacy_e${i}`,
      from: a.from,
      to: a.to,
      label: a.label || "",
      color: "blue",
      dash: "solid" as const,
      bend: 0,
    }));
  }
  if (!strategy.edges) strategy.edges = [];

  const validated = validateStrategy(strategy);

  // ═══════════════════════════════════
  // 1. TITLE
  // ═══════════════════════════════════
  editor.createShape({
    type: "text" as any,
    x: 0,
    y: -140,
    props: {
      richText: toRichText(title),
      size: "xl",
      font: "sans",
      autoSize: true,
    } as any,
  });
  await delay(100);

  if (description) {
    editor.createShape({
      type: "text" as any,
      x: 0,
      y: -70,
      props: {
        richText: toRichText(description),
        size: "s",
        font: "sans",
        color: "grey",
        autoSize: true,
      } as any,
    });
    await delay(80);
  }

  // ═══════════════════════════════════
  // 2. NODES — ALL as geo shapes, NEVER sticky notes
  // ═══════════════════════════════════
  for (const node of validated.nodes) {
    const shapeId = createShapeId();
    shapeIdMap.set(node.id, shapeId);

    const isSolidFill = node.fill === "solid";

    editor.createShape({
      id: shapeId,
      type: "geo" as any,
      x: node.x,
      y: node.y,
      props: {
        w: node.w,
        h: node.h,
        geo: node.geo || "rectangle",
        color: node.color || "blue",
        fill: node.fill || "solid",
        size: node.size || "m",
        richText: toRichText(node.label || ""),
        font: "sans",
        align: node.align || "middle",
        verticalAlign: node.verticalAlign || "middle",
        dash: "solid",
        labelColor: isSolidFill ? "white" : "black",
      } as any,
    });
    await delay(70);
  }

  // ═══════════════════════════════════
  // 3. EDGES — Arrows with bindings
  // ═══════════════════════════════════
  for (const edge of validated.edges) {
    const fromId = shapeIdMap.get(edge.from);
    const toId = shapeIdMap.get(edge.to);
    if (!fromId || !toId) continue;

    const arrowId = createShapeId();

    editor.createShape({
      id: arrowId,
      type: "arrow" as any,
      props: {
        color: edge.color || "blue",
        size: "m",
        dash: edge.dash === "dashed" ? "dashed" : "solid",
        richText: edge.label ? toRichText(edge.label) : toRichText(""),
        font: "sans",
        arrowheadEnd: "arrow",
        arrowheadStart: "none",
        bend: edge.bend || 0,
      } as any,
    });

    try {
      editor.createBindings([
        {
          type: "arrow",
          fromId: arrowId,
          toId: fromId,
          props: {
            terminal: "start",
            isExact: false,
            isPrecise: false,
            normalizedAnchor: { x: 0.5, y: 0.5 },
          },
        },
        {
          type: "arrow",
          fromId: arrowId,
          toId: toId,
          props: {
            terminal: "end",
            isExact: false,
            isPrecise: false,
            normalizedAnchor: { x: 0.5, y: 0.5 },
          },
        },
      ]);
    } catch (e) {
      console.warn("Could not create binding for edge:", edge.id, e);
    }

    await delay(40);
  }

  // ═══════════════════════════════════
  // 4. KEY INSIGHTS — as geo rectangles, NOT sticky notes
  // ═══════════════════════════════════
  if (validated.key_insights && validated.key_insights.length > 0) {
    const maxX = Math.max(...validated.nodes.map(n => n.x + n.w));
    const insightX = maxX + 250;

    // Header
    editor.createShape({
      type: "geo" as any,
      x: insightX,
      y: 0,
      props: {
        w: 300,
        h: 60,
        geo: "rectangle",
        color: "yellow",
        fill: "solid",
        richText: toRichText("💡 Key Insights"),
        font: "sans",
        size: "l",
        align: "start",
        verticalAlign: "middle",
        dash: "solid",
        labelColor: "black",
      } as any,
    });
    await delay(80);

    // Insight blocks as semi-transparent geo rectangles
    for (let i = 0; i < validated.key_insights.length; i++) {
      editor.createShape({
        type: "geo" as any,
        x: insightX,
        y: 90 + i * 140,
        props: {
          w: 300,
          h: 110,
          geo: "rectangle",
          color: "yellow",
          fill: "semi",
          richText: toRichText(validated.key_insights[i]),
          font: "sans",
          size: "s",
          align: "start",
          verticalAlign: "start",
          dash: "solid",
          labelColor: "black",
        } as any,
      });
      await delay(60);
    }
  }

  // ═══════════════════════════════════
  // 5. ZOOM TO FIT
  // ═══════════════════════════════════
  await delay(400);
  editor.zoomToFit({ animation: { duration: 600 } });
}
