import type { Editor } from "tldraw";
import { toRichText } from "@tldraw/tlschema";

interface StrategyElement {
  type: string;
  content?: string;
  color?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  fontSize?: string;
}

interface StrategySection {
  type: string;
  title: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  elements: StrategyElement[];
}

interface StrategyJSON {
  strategy_title: string;
  summary: string;
  sections: StrategySection[];
  key_insights: string[];
}

const COLOR_MAP: Record<string, string> = {
  blue: "blue",
  yellow: "yellow",
  red: "red",
  green: "green",
  orange: "orange",
  violet: "violet",
  purple: "violet",
  white: "white",
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function generateBoardFromStrategy(editor: Editor, strategy: StrategyJSON) {
  // 1. Title
  editor.createShape({
    type: "text" as any,
    x: 0,
    y: -150,
    props: {
      richText: toRichText(strategy.strategy_title || "Marketing-Strategie"),
      size: "xl",
      font: "sans",
      autoSize: true,
    } as any,
  });
  await delay(150);

  // 2. Summary
  if (strategy.summary) {
    editor.createShape({
      type: "text" as any,
      x: 0,
      y: -80,
      props: {
        richText: toRichText(strategy.summary),
        size: "m",
        font: "sans",
        autoSize: true,
      } as any,
    });
    await delay(100);
  }

  // 3. Sections
  for (const section of strategy.sections) {
    const sx = section.position?.x || 0;
    const sy = section.position?.y || 0;
    const sw = section.width || 800;
    const sh = section.height || 600;

    editor.createShape({
      type: "frame" as any,
      x: sx,
      y: sy,
      props: { w: sw, h: sh, name: section.title || "Section" } as any,
    });
    await delay(200);

    if (section.elements) {
      for (const element of section.elements) {
        const ex = sx + (element.position?.x || 20);
        const ey = sy + (element.position?.y || 60);
        const color = COLOR_MAP[element.color || "yellow"] || "yellow";

        try {
          if (element.type === "sticky" || element.type === "note") {
            editor.createShape({
              type: "note" as any,
              x: ex,
              y: ey,
              props: {
                richText: toRichText(element.content || ""),
                color,
                size: element.fontSize || "m",
              } as any,
            });
          } else if (element.type === "text") {
            editor.createShape({
              type: "text" as any,
              x: ex,
              y: ey,
              props: {
                richText: toRichText(element.content || ""),
                size: element.fontSize || "m",
                font: "sans",
                autoSize: true,
              } as any,
            });
          }
        } catch (e) {
          console.warn("Shape creation error:", e);
        }

        await delay(60);
      }
    }

    await delay(250);
  }

  // 4. Key Insights
  if (strategy.key_insights && strategy.key_insights.length > 0) {
    const allShapes = editor.getCurrentPageShapes();
    let maxX = 0;
    for (const shape of allShapes) {
      const bounds = editor.getShapePageBounds(shape);
      if (bounds && bounds.maxX > maxX) maxX = bounds.maxX;
    }

    const insightX = maxX + 200;

    editor.createShape({
      type: "text" as any,
      x: insightX,
      y: 0,
      props: {
        richText: toRichText("💡 Key Insights"),
        size: "l",
        font: "sans",
        autoSize: true,
      } as any,
    });
    await delay(100);

    for (let i = 0; i < strategy.key_insights.length; i++) {
      editor.createShape({
        type: "note" as any,
        x: insightX,
        y: 60 + i * 220,
        props: {
          richText: toRichText(`💡 ${strategy.key_insights[i]}`),
          color: "yellow",
          size: "m",
        } as any,
      });
      await delay(80);
    }
  }

  // 5. Zoom to fit
  await delay(300);
  editor.zoomToFit({ animation: { duration: 500 } });
}
