import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { TeamMember, getInitials } from "./constants";

interface Comment {
  id: string; task_id: string; user_id: string;
  content: string; created_at: string;
}

interface Props {
  taskId: string;
  teamMap: Record<string, TeamMember>;
}

const TaskComments: React.FC<Props> = ({ taskId, teamMap }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data } = await supabase.from("task_comments" as any)
        .select("*").eq("task_id", taskId).order("created_at", { ascending: true });
      return (data ?? []) as Comment[];
    },
  });

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("task_comments" as any).insert({
      task_id: taskId, user_id: user.id, content: text.trim(),
    });
    setSending(false);
    if (error) { toast.error("Fehler beim Senden"); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  const del = async (id: string) => {
    await supabase.from("task_comments" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-mono text-muted-foreground uppercase block">
        Kommentare {comments.length > 0 && `(${comments.length})`}
      </label>

      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">Noch keine Kommentare.</p>
        ) : comments.map(c => {
          const author = teamMap[c.user_id];
          const isMine = c.user_id === user?.id;
          return (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-mono">
                  {getInitials(author?.name || author?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{author?.name || author?.email || "Unbekannt"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: de })}
                  </span>
                  {isMine && (
                    <button onClick={() => del(c.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">{c.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Kommentar hinzufügen…"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          className="min-h-[52px] text-sm resize-none" />
        <Button size="sm" onClick={send} disabled={!text.trim() || sending} className="gap-1">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default TaskComments;
