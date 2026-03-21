import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Tldraw, Editor, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { Presentation, Loader2 } from "lucide-react";

const SharedBoard = () => {
  const { token } = useParams<{ token: string }>();

  const { data: board, isLoading } = useQuery({
    queryKey: ["shared-board", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategy_boards")
        .select("*, clients(name)")
        .eq("share_token", token!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });

  const handleMount = useCallback((editor: Editor) => {
    if (board?.board_data && Object.keys(board.board_data).length > 0) {
      try {
        editor.store.loadSnapshot(board.board_data as TLStoreSnapshot);
      } catch (e) {
        console.warn("Could not load shared board data:", e);
      }
    }
    editor.updateInstanceState({ isReadonly: true });
  }, [board?.board_data]);

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
        <p className="text-muted-foreground">Board nicht gefunden oder Link abgelaufen</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-card z-50 shrink-0">
        <div className="flex items-center gap-3">
          <Presentation className="h-4 w-4 text-primary" />
          <h1 className="font-display text-sm font-semibold truncate">{board.title}</h1>
          {board.clients?.name && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {board.clients.name}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">Nur Ansicht</span>
      </div>
      <div className="flex-1 relative">
        <Tldraw onMount={handleMount} inferDarkMode />
      </div>
    </div>
  );
};

export default SharedBoard;
