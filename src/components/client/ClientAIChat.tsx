import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Send, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "general", label: "💬 Allgemein" },
  { value: "reel_scripts", label: "🎬 Reel-Skripte" },
  { value: "ad_scripts", label: "📢 Ad-Skripte" },
  { value: "carousel", label: "📸 Karussell" },
  { value: "captions", label: "✍️ Captions" },
  { value: "content_ideas", label: "💡 Content-Ideen" },
  { value: "landing_pages", label: "🌐 Landing Pages" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ClientAIChatProps {
  clientId: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-ai-chat`;

const ClientAIChat = ({ clientId }: ClientAIChatProps) => {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("general");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved messages
  const { data: savedMessages } = useQuery({
    queryKey: ["client-ai-messages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_ai_messages")
        .select("role, content, mode")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (savedMessages?.length && messages.length === 0) {
      setMessages(savedMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [savedMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveMessage = async (role: string, content: string) => {
    await supabase.from("client_ai_messages").insert({
      client_id: clientId,
      role,
      content,
      mode,
    });
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Save user message
    await saveMessage("user", text);

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          clientId,
          mode,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fehler" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const updateAssistant = (content: string) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateAssistant(assistantContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await saveMessage("assistant", assistantContent);
      }
    } catch (err: any) {
      toast.error("KI-Fehler", { description: err.message });
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Fehler: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, mode, clientId, isStreaming]);

  const clearChat = async () => {
    if (!confirm("Chat-Verlauf löschen?")) return;
    await supabase.from("client_ai_messages").delete().eq("client_id", clientId);
    setMessages([]);
    qc.invalidateQueries({ queryKey: ["client-ai-messages", clientId] });
    toast.success("Chat gelöscht");
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Mode selector + clear */}
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground font-mono flex-1">
          {messages.length} Nachrichten
        </span>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-muted-foreground" onClick={clearChat}>
            <Trash2 className="h-3 w-3" /> Leeren
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground/60">
              Wähle einen Modus und starte die Konversation.
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              Die KI kennt alle Kunden-Infos und Wissensbasis-Einträge.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2.5",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex items-start shrink-0 mt-0.5">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl px-3.5 py-2.5 text-sm max-w-[85%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-muted/60 text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic"
                )}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex items-start shrink-0 mt-0.5">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2.5">
            <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-xl px-3.5 py-2.5 bg-muted/60">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border pt-3">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`z.B. "Schreibe 3 Reel-Skripte zum Thema Immobilienbewertung"…`}
            className="min-h-[42px] max-h-[120px] text-sm resize-none flex-1"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            size="icon"
            className="h-[42px] w-[42px] shrink-0"
            disabled={!input.trim() || isStreaming}
            onClick={sendMessage}
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientAIChat;
