import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { Editor } from "tldraw";
import { toRichText } from "@tldraw/tlschema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  boardActions?: any[];
}

interface Props {
  boardId: string;
  editorRef: React.RefObject<Editor | null>;
  chatHistory: ChatMessage[];
  onChatUpdate: (messages: ChatMessage[]) => void;
}

const QUICK_PROMPTS = [
  "Retargeting-Schleife hinzufügen",
  "KPI-Ziele ergänzen",
  "Content-Formate vorschlagen",
  "Funnel-Stufe vertiefen",
  "Konkurrenz-Abgrenzung",
  "Budget-Aufteilung",
];

const BoardAIChat = ({ boardId, editorRef, chatHistory, onChatUpdate }: Props) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, open]);

  const getCurrentShapes = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return [];
    return editor.getCurrentPageShapes().map(s => ({
      id: s.id,
      type: s.type,
      x: Math.round(s.x),
      y: Math.round(s.y),
      props: s.props,
    }));
  }, [editorRef]);

  const executeBoardActions = useCallback((actions: any[]) => {
    const editor = editorRef.current;
    if (!editor || !actions) return;

    for (const action of actions) {
      try {
        if (action.action === "add" && action.shape) {
          const { type, x, y, props } = action.shape;
          const shapeProps: any = { ...props };
          // Convert text to richText for tldraw v4
          if (shapeProps.text) {
            shapeProps.richText = toRichText(shapeProps.text);
            delete shapeProps.text;
          }
          editor.createShape({
            type: type || "note",
            x: x || 0,
            y: y || 0,
            props: shapeProps,
          } as any);
        }
      } catch (e) {
        console.warn("Failed to execute board action:", e);
      }
    }

    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 400 } });
    }, 300);
  }, [editorRef]);

  const handleSend = useCallback(async (text?: string) => {
    const message = text || input.trim();
    if (!message) return;
    setInput("");
    setSending(true);

    const newMsg: ChatMessage = { role: "user", content: message, timestamp: new Date().toISOString() };
    const updated = [...chatHistory, newMsg];
    onChatUpdate(updated);

    try {
      const shapes = getCurrentShapes();
      const { data, error } = await supabase.functions.invoke("board-chat", {
        body: {
          message,
          boardShapes: shapes,
          chatHistory: chatHistory.map(m => ({ role: m.role, content: m.content })),
          boardId,
        },
      });

      if (error || !data?.success) throw new Error(data?.error || "Chat fehlgeschlagen");

      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
        boardActions: data.board_actions,
      };

      onChatUpdate([...updated, aiMsg]);

      if (data.board_actions && data.board_actions.length > 0) {
        executeBoardActions(data.board_actions);
        toast.success("Board aktualisiert", { duration: 2000 });
      }
    } catch {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.",
        timestamp: new Date().toISOString(),
      };
      onChatUpdate([...updated, errorMsg]);
      toast.error("Chat-Anfrage fehlgeschlagen");
    } finally {
      setSending(false);
    }
  }, [input, chatHistory, boardId, getCurrentShapes, executeBoardActions, onChatUpdate]);

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-[200]"
          >
            <Button
              onClick={() => setOpen(true)}
              className="h-14 w-14 rounded-full shadow-lg gap-0"
              size="icon"
            >
              <div className="flex flex-col items-center">
                <MessageCircle className="h-5 w-5" />
                <span className="text-[8px] font-bold mt-0.5">AI</span>
              </div>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 250 }}
            className="fixed bottom-6 right-6 w-[360px] h-[480px] bg-card border border-border rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Board-Assistent</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatHistory.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-8">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Frag die AI etwas über deine Strategie oder lass neue Elemente hinzufügen.</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-xs dark:prose-invert max-w-none [&>p]:mb-1 [&>ul]:mt-0.5 [&>p]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                    {msg.boardActions && msg.boardActions.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-border/30 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span>✅ Board aktualisiert ({msg.boardActions.length} Änderung{msg.boardActions.length > 1 ? "en" : ""})</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts */}
            <div className="px-3 py-1.5 border-t border-border/50 overflow-x-auto shrink-0">
              <div className="flex gap-1.5 w-max">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSend(p)}
                    disabled={sending}
                    className="text-[10px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 p-3 border-t border-border shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Frag die AI..."
                className="h-9 text-xs"
                disabled={sending}
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => handleSend()} disabled={!input.trim() || sending}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BoardAIChat;
