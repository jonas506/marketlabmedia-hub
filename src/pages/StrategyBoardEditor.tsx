import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Tldraw, Editor, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Cloud, CloudOff, Download, Share2, Presentation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type SaveStatus = "saved" | "saving" | "unsaved";

const StrategyBoardEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<Editor | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentFrameIndex, setPresentFrameIndex] = useState(0);

  const { data: board, isLoading } = useQuery({
    queryKey: ["strategy-board", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategy_boards")
        .select("*, clients(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const saveBoard = useCallback(async (snapshot: any) => {
    if (!id) return;
    setSaveStatus("saving");
    const { error } = await supabase
      .from("strategy_boards")
      .update({ board_data: snapshot as any, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaveStatus(error ? "unsaved" : "saved");
  }, [id]);

  const debouncedSave = useCallback((snapshot: TLStoreSnapshot) => {
    setSaveStatus("unsaved");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveBoard(snapshot), 3000);
  }, [saveBoard]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Load existing board data
    if (board?.board_data && Object.keys(board.board_data).length > 0) {
      try {
        editor.store.loadSnapshot(board.board_data as TLStoreSnapshot);
      } catch (e) {
        console.warn("Could not load board data:", e);
      }
    }

    // Listen for changes
    const unsub = editor.store.listen(() => {
      const snapshot = editor.store.getSnapshot();
      debouncedSave(snapshot);
    }, { source: "user", scope: "document" });

    return () => {
      unsub();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [board?.board_data, debouncedSave]);

  const handleExport = useCallback(async (format: "png" | "svg") => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        toast.error("Keine Elemente zum Exportieren");
        return;
      }
      // Use tldraw's built-in export
      if (format === "svg") {
        const svg = await editor.getSvgString([...shapeIds]);
        if (svg) {
          const blob = new Blob([svg.svg], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${board?.title || "board"}.svg`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      toast.success(`Als ${format.toUpperCase()} exportiert`);
    } catch {
      toast.error("Export fehlgeschlagen");
    }
  }, [board?.title]);

  const handleShare = useCallback(async () => {
    if (!id) return;
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from("strategy_boards")
      .update({ share_token: token })
      .eq("id", id);
    if (error) {
      toast.error("Link konnte nicht erstellt werden");
      return;
    }
    const url = `${window.location.origin}/shared/boards/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share-Link kopiert!");
  }, [id]);

  // Presentation mode keyboard nav
  useEffect(() => {
    if (!presenting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
      if (e.key === "ArrowRight") setPresentFrameIndex((i) => i + 1);
      if (e.key === "ArrowLeft") setPresentFrameIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [presenting]);

  const startPresentation = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const frames = editor.getCurrentPageShapes().filter((s) => s.type === "frame");
    if (frames.length === 0) {
      toast.error("Erstelle Frames für den Präsentationsmodus");
      return;
    }
    setPresentFrameIndex(0);
    setPresenting(true);
    // Zoom to first frame
    const sorted = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
    editor.zoomToFit();
    if (sorted[0]) {
      editor.zoomToBounds(editor.getShapePageBounds(sorted[0])!, { animation: { duration: 400 } });
    }
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const editor = editorRef.current;
    if (!editor) return;
    const frames = editor.getCurrentPageShapes().filter((s) => s.type === "frame");
    const sorted = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
    const idx = Math.min(presentFrameIndex, sorted.length - 1);
    const frame = sorted[idx];
    if (frame) {
      const bounds = editor.getShapePageBounds(frame);
      if (bounds) editor.zoomToBounds(bounds, { animation: { duration: 400 } });
    }
  }, [presentFrameIndex, presenting]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Board nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      {!presenting && (
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-card z-50 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/strategy-boards")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-display text-sm font-semibold truncate max-w-[200px]">{board.title}</h1>
            {board.clients?.name && (
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {board.clients.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Save status */}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {saveStatus === "saved" && <><Check className="h-3 w-3 text-emerald-500" /> Gespeichert</>}
              {saveStatus === "saving" && <><Cloud className="h-3 w-3 animate-pulse" /> Speichert...</>}
              {saveStatus === "unsaved" && <><CloudOff className="h-3 w-3 text-amber-500" /> Nicht gespeichert</>}
            </span>

            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" /> Teilen
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("svg")}>Als SVG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("png")}>Als PNG</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={startPresentation}>
              <Presentation className="h-3.5 w-3.5" /> Präsentation
            </Button>
          </div>
        </div>
      )}

      {/* Presentation overlay controls */}
      {presenting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-card/90 backdrop-blur px-4 py-2 rounded-xl border border-border shadow-lg">
          <Button variant="ghost" size="sm" onClick={() => setPresentFrameIndex((i) => Math.max(0, i - 1))}>←</Button>
          <span className="text-xs font-medium min-w-[40px] text-center">{presentFrameIndex + 1}</span>
          <Button variant="ghost" size="sm" onClick={() => setPresentFrameIndex((i) => i + 1)}>→</Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPresenting(false)}>ESC</Button>
        </div>
      )}

      {/* tldraw Canvas */}
      <div className="flex-1 relative">
        <Tldraw
          onMount={handleMount}
          inferDarkMode
        />
      </div>
    </div>
  );
};

export default StrategyBoardEditor;
