import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2 } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

interface Props {
  url: string;
  className?: string;
  onPages?: (n: number) => void;
}

/** Renders a PDF as clean page images — no browser PDF toolbar/chrome. */
export default function PdfCanvasViewer({ url, className, onPages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        onPages?.(pdf.numPages);
        const width = Math.min(containerRef.current?.clientWidth || 800, 1000);
        const out: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.9));
          if (cancelled) return;
          setPages([...out]);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (failed) {
    return (
      <iframe src={`${url}#view=FitH`} title="Dokument" className="h-[70vh] w-full bg-white" />
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {loading && pages.length === 0 && (
        <div className="flex h-64 items-center justify-center text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      <div className="flex flex-col gap-4">
        {pages.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Seite ${i + 1}`}
            className="w-full rounded-xl shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]"
          />
        ))}
      </div>
    </div>
  );
}
