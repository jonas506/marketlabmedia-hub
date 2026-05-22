import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Trash2, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TeamMember } from "./types";

interface Comment {
  id: string;
  author_id: string;
  body: string;
  mentioned_user_ids: string[];
  created_at: string;
}

interface Props {
  pieceId: string;
  clientId: string;
  team: TeamMember[];
}

const PieceInternalComments: React.FC<Props> = ({ pieceId, clientId, team }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const profileMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    team.forEach((t) => { m[t.user_id] = t.name || t.email || "?"; });
    return m;
  }, [team]);

  const load = async () => {
    const { data } = await supabase
      .from("piece_internal_comments")
      .select("id, author_id, body, mentioned_user_ids, created_at")
      .eq("content_piece_id", pieceId)
      .order("created_at", { ascending: true });
    setComments((data as Comment[]) || []);
  };

  useEffect(() => { if (open) load(); }, [open, pieceId]);

  const handleChange = (v: string) => {
    setBody(v);
    const caret = textRef.current?.selectionStart ?? v.length;
    const upto = v.slice(0, caret);
    const m = upto.match(/@(\w*)$/);
    if (m) {
      setMentionQuery(m[1].toLowerCase());
      setShowMention(true);
    } else {
      setShowMention(false);
    }
  };

  const insertMention = (member: TeamMember) => {
    const caret = textRef.current?.selectionStart ?? body.length;
    const upto = body.slice(0, caret).replace(/@\w*$/, `@${(member.name || member.email || "").split(" ")[0]} `);
    const after = body.slice(caret);
    setBody(upto + after);
    setShowMention(false);
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const extractMentions = (text: string): string[] => {
    const ids = new Set<string>();
    team.forEach((t) => {
      const first = (t.name || t.email || "").split(" ")[0];
      if (!first) return;
      const re = new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) ids.add(t.user_id);
    });
    return Array.from(ids);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || !user) return;
    setLoading(true);
    const mentioned = extractMentions(text);
    const { error } = await supabase.from("piece_internal_comments").insert({
      content_piece_id: pieceId,
      client_id: clientId,
      author_id: user.id,
      body: text,
      mentioned_user_ids: mentioned,
    });
    setLoading(false);
    if (error) { toast.error("Konnte Kommentar nicht speichern"); return; }
    setBody("");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("piece_internal_comments").delete().eq("id", id);
    setComments((c) => c.filter((x) => x.id !== id));
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((p, i) =>
      p.startsWith("@")
        ? <span key={i} className="text-primary font-semibold bg-primary/10 rounded px-1">{p}</span>
        : <span key={i}>{p}</span>
    );
  };

  const filteredTeam = team.filter((t) => {
    const n = (t.name || t.email || "").toLowerCase();
    return n.includes(mentionQuery);
  }).slice(0, 6);

  return (
    <div className="pl-7 sm:pl-9">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="h-3 w-3" />
        Interne Kommentare
        {comments.length > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{comments.length}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
          {comments.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 italic px-1">Noch keine Kommentare</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="group flex items-start gap-2 rounded bg-background/60 p-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold">{profileMap[c.author_id] || "Unbekannt"}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: de })}
                  </span>
                </div>
                <div className="text-xs whitespace-pre-wrap break-words">{renderBody(c.body)}</div>
              </div>
              {c.author_id === user?.id && (
                <button
                  type="button"
                  onClick={() => del(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          <div className="relative">
            <textarea
              ref={textRef}
              value={body}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
              }}
              placeholder="Anweisung schreiben… nutze @ um Teammitglieder zu erwähnen"
              rows={2}
              className="w-full text-xs bg-background border border-border/60 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
            {showMention && filteredTeam.length > 0 && (
              <div className="absolute z-20 left-2 bottom-full mb-1 w-56 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-lg">
                {filteredTeam.map((t) => (
                  <button
                    key={t.user_id}
                    type="button"
                    onClick={() => insertMention(t)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <AtSign className="h-3 w-3 text-primary" />
                    {t.name || t.email}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-muted-foreground/60">⌘+Enter zum Senden</span>
              <Button size="sm" onClick={submit} disabled={loading || !body.trim()} className={cn("h-7 text-xs gap-1")}>
                <Send className="h-3 w-3" /> Senden
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PieceInternalComments;
