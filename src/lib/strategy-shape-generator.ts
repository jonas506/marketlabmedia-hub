import type { Editor } from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import { createShapeId, type TLShapeId } from "tldraw";

interface StrategyNode {
  id: string;
  shape: "ellipse" | "diamond" | "rectangle" | "note" | "hexagon";
  label: string;
  color?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

interface StrategyArrow {
  from: string;
  to: string;
  label?: string;
}

interface StrategyFrame {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StrategyJSON {
  strategy_title: string;
  summary?: string;
  nodes: StrategyNode[];
  arrows: StrategyArrow[];
  frames?: StrategyFrame[];
  key_insights?: string[];
  // Legacy support
  sections?: any[];
}

const COLOR_MAP: Record<string, string> = {
  orange: "orange",
  yellow: "yellow",
  violet: "violet",
  green: "green",
  red: "red",
  "light-red": "light-red",
  "light-blue": "light-blue",
  "light-yellow": "yellow",
  blue: "blue",
  white: "white",
  purple: "violet",
};

const GEO_MAP: Record<string, string> = {
  ellipse: "ellipse",
  diamond: "diamond",
  rectangle: "rectangle",
  hexagon: "hexagon",
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function generateBoardFromStrategy(editor: Editor, strategy: StrategyJSON) {
  // Map from AI node IDs to tldraw shape IDs
  const nodeIdMap = new Map<string, string>();

  // 1. Title
  editor.createShape({
    type: "text" as any,
    x: (strategy.nodes?.[0]?.x ?? 400) - 200,
    y: (strategy.frames?.[0]?.y ?? strategy.nodes?.[0]?.y ?? 0) - 120,
    props: {
      richText: toRichText(strategy.strategy_title || "Marketing-Strategie"),
      size: "xl",
      font: "sans",
      autoSize: true,
    } as any,
  });
  await delay(120);

  // 2. Summary
  if (strategy.summary) {
    editor.createShape({
      type: "text" as any,
      x: (strategy.nodes?.[0]?.x ?? 400) - 200,
      y: (strategy.frames?.[0]?.y ?? strategy.nodes?.[0]?.y ?? 0) - 60,
      props: {
        richText: toRichText(strategy.summary),
        size: "s",
        font: "sans",
        autoSize: true,
      } as any,
    });
    await delay(80);
  }

  // 3. Frames (create first so nodes appear inside)
  if (strategy.frames) {
    for (const frame of strategy.frames) {
      editor.createShape({
        type: "frame" as any,
        x: frame.x,
        y: frame.y,
        props: {
          w: frame.w || 900,
          h: frame.h || 500,
          name: frame.title || "Phase",
        } as any,
      });
      await delay(100);
    }
  }

  // 4. Nodes — geo shapes and notes
  if (strategy.nodes) {
    for (const node of strategy.nodes) {
      const tldrawId = createShapeId();
      nodeIdMap.set(node.id, tldrawId);
      const color = COLOR_MAP[node.color || "violet"] || "violet";

      if (node.shape === "note") {
        editor.createShape({
          id: tldrawId,
          type: "note" as any,
          x: node.x,
          y: node.y,
          props: {
            richText: toRichText(node.label || ""),
            color,
            size: "m",
          } as any,
        });
      } else {
        const geo = GEO_MAP[node.shape] || "rectangle";
        const w = node.w || (node.shape === "diamond" ? 140 : node.shape === "ellipse" ? 180 : 200);
        const h = node.h || (node.shape === "diamond" ? 140 : 80);

        editor.createShape({
          id: tldrawId,
          type: "geo" as any,
          x: node.x,
          y: node.y,
          props: {
            geo,
            w,
            h,
            richText: toRichText(node.label || ""),
            color,
            fill: "solid",
            size: "m",
            font: "sans",
          } as any,
        });
      }
      await delay(50);
    }
  }

  // 5. Arrows — connect nodes
  if (strategy.arrows) {
    for (const arrow of strategy.arrows) {
      const fromId = nodeIdMap.get(arrow.from);
      const toId = nodeIdMap.get(arrow.to);
      if (!fromId || !toId) continue;

      try {
        const arrowProps: any = {
          type: "arrow" as any,
          props: {
            color: "black",
            size: "m",
            arrowheadEnd: "arrow",
            arrowheadStart: "none",
          } as any,
        };

        if (arrow.label) {
          arrowProps.props.richText = toRichText(arrow.label);
        }

        const arrowId = createShapeId();
        editor.createShape({
          id: arrowId,
          ...arrowProps,
        });

        // Bind arrow terminals to shapes
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
        console.warn("Arrow creation error:", e);
      }
      await delay(30);
    }
  }

  // 6. Key Insights
  if (strategy.key_insights && strategy.key_insights.length > 0) {
    const allShapes = editor.getCurrentPageShapes();
    let maxX = 0;
    for (const shape of allShapes) {
      const bounds = editor.getShapePageBounds(shape);
      if (bounds && bounds.maxX > maxX) maxX = bounds.maxX;
    }

    const insightX = maxX + 150;
    editor.createShape({
      type: "text" as any,
      x: insightX,
      y: strategy.frames?.[0]?.y ?? 0,
      props: {
        richText: toRichText("💡 Key Insights"),
        size: "l",
        font: "sans",
        autoSize: true,
      } as any,
    });
    await delay(80);

    for (let i = 0; i < strategy.key_insights.length; i++) {
      editor.createShape({
        type: "geo" as any,
        x: insightX,
        y: (strategy.frames?.[0]?.y ?? 0) + 60 + i * 100,
        props: {
          geo: "rectangle",
          w: 300,
          h: 70,
          richText: toRichText(`💡 ${strategy.key_insights[i]}`),
          color: "yellow",
          fill: "solid",
          size: "s",
          font: "sans",
        } as any,
      });
      await delay(50);
    }
  }

  // 7. Zoom to fit
  await delay(300);
  editor.zoomToFit({ animation: { duration: 500 } });
}
