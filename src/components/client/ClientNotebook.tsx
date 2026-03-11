import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Plus, Trash2, Globe, Loader2, Search,
  Bot, Send, User, FileText, X, GripVertical,
  MessageSquare, ChevronRight, Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Sources config ───
const SOURCE_TYPES = [
  { value: "gespraech", label: "Gespräch", icon: MessageSquare, color: "text-blue-400 bg-blue-500/10" },
  { value: "website", label: "Website", icon: Globe, color: "text-emerald-400 bg-emerald-500/10" },
  { value: "ads", label: "Ads", icon: FileText, color: "text-purple-400 bg-purple-500/10" },
  { value: "content", label: "Content", icon: FileText, color: "text-amber-400 bg-amber-500/10" },
  { value: "produkt", label: "Produkt", icon: FileText, color: "text-rose-400 bg-rose-500/10" },
  { value: "sonstiges", label: "Sonstiges", icon: FileText, color: "text-muted-foreground bg-muted" },
];

const getSourceType = (cat: string) =>
  SOURCE_TYPES.find((s) => s.value === cat) || SOURCE_TYPES[SOURCE_TYPES.length - 1];

// ─── Chat modes ───
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

interface ClientNotebookProps {
  clientId: string;
  canEdit: boolean;
  websiteUrl?: string | null;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-ai-chat`;

const ClientNotebook = ({ clientId, canEdit, websiteUrl }: ClientNotebookProps) => {
  const qc = useQueryClient();

  // ─── Sources state ───
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceContent, setSourceContent] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [searchSources, setSearchSources] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // ─── Chat state ───
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("general");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Data loading ───
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["client-knowledge", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_knowledge")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const filteredSources = sources.filter((e: any) => {
    if (!searchSources) return true;
    return e.title.toLowerCase().includes(searchSources.toLowerCase()) ||
      e.content.toLowerCase().includes(searchSources.toLowerCase());
  });

  // ─── Source actions ───
  const addSource = async () => {
    if (!sourceContent.trim()) return;
    setSavingSource(true);
    const autoTitle = sourceContent.trim().split("\n")[0].slice(0, 80) || "Eintrag";
    const { error } = await supabase.from("client_knowledge").insert({
      client_id: clientId,
      title: autoTitle,
      content: sourceContent.trim(),
      category: "sonstiges",
      source_url: null,
    });
    setSavingSource(false);
    if (error) toast.error("Fehler beim Speichern");
    else {
      toast.success("Quelle hinzugefügt");
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
      setSourceContent("");
      setShowAddSource(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm("Quelle wirklich löschen?")) return;
    const { error } = await supabase.from("client_knowledge").delete().eq("id", id);
    if (error) toast.error("Fehler");
    else {
      toast.success("Gelöscht");
      if (selectedSourceId === id) setSelectedSourceId(null);
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
    }
  };

  const scrapeWebsite = async () => {
    if (!websiteUrl) { toast.error("Keine Website-URL hinterlegt"); return; }
    setScraping(true);
    try {
      const resp = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: websiteUrl, options: { formats: ["markdown"], onlyMainContent: true } },
      });
      if (resp.error) throw resp.error;
      const md = resp.data?.data?.markdown || resp.data?.data?.content || "";
      if (!md) throw new Error("Kein Content gefunden");
      await supabase.from("client_knowledge").insert({
        client_id: clientId,
        title: `Website: ${websiteUrl}`,
        content: md.slice(0, 30000),
        category: "website",
        source_url: websiteUrl,
      });
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
      toast.success("Website importiert!");
    } catch (err: any) {
      toast.error("Scraping fehlgeschlagen", { description: err.message });
    } finally {
      setScraping(false);
    }
  };

  // ─── Chat actions ───
  const saveMessage = async (role: string, content: string) => {
    await supabase.from("client_ai_messages").insert({ client_id: clientId, role, content, mode });
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
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

      if (assistantContent) await saveMessage("assistant", assistantContent);
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

  const selectedSource = selectedSourceId ? sources.find((s: any) => s.id === selectedSourceId) : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
            <BookOpen className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold">Kunden-Notebook</h2>
            <p className="text-[11px] text-muted-foreground">{sources.length} Quellen geladen</p>
          </div>
        </div>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-9 text-xs w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body: Sources | Chat */}
      <div className="flex h-[640px]">
        {/* ─── LEFT: Sources panel ─── */}
        <div className={cn(
          "border-r border-border flex flex-col bg-background/50 transition-all",
          selectedSource ? "w-[320px]" : "w-[280px]"
        )}>
          {/* Source header */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quellen</span>
              <div className="flex gap-1">
                {websiteUrl && canEdit && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={scrapeWebsite} disabled={scraping} title="Website importieren">
                    {scraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowAddSource(!showAddSource)} title="Quelle hinzufügen">
                    {showAddSource ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Quellen durchsuchen…"
                value={searchSources}
                onChange={(e) => setSearchSources(e.target.value)}
                className="h-7 pl-7 text-[11px] bg-card border-border"
              />
            </div>
          </div>

          {/* Add source inline */}
          <AnimatePresence>
            {showAddSource && canEdit && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-border"
              >
                <div className="p-3 space-y-2">
                  <Textarea
                    placeholder="Text, Notizen, Transkriptionen hier reinpasten…"
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    className="min-h-[80px] text-xs resize-none bg-card"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setShowAddSource(false); setSourceContent(""); }}>
                      Abbrechen
                    </Button>
                    <Button size="sm" className="h-6 text-[10px]" onClick={addSource} disabled={!sourceContent.trim() || savingSource}>
                      {savingSource && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Hinzufügen
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Source list */}
          <div className="flex-1 overflow-y-auto">
            {sourcesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <BookOpen className="h-6 w-6 text-muted-foreground/15 mb-2" />
                <p className="text-[11px] text-muted-foreground/50">
                  {sources.length === 0 ? "Keine Quellen. Füge Wissen hinzu." : "Keine Treffer."}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {filteredSources.map((source: any) => {
                  const st = getSourceType(source.category);
                  const Icon = st.icon;
                  const isSelected = selectedSourceId === source.id;
                  return (
                    <button
                      key={source.id}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50 group",
                        isSelected && "bg-primary/5 border-l-2 border-primary"
                      )}
                      onClick={() => setSelectedSourceId(isSelected ? null : source.id)}
                    >
                      <div className={cn("flex items-center justify-center h-7 w-7 rounded-md shrink-0", st.color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{source.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {source.content.slice(0, 60)}…
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteSource(source.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected source preview */}
          <AnimatePresence>
            {selectedSource && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                exit={{ height: 0 }}
                className="overflow-hidden border-t border-border"
              >
                <div className="p-3 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold truncate flex-1">{(selectedSource as any).title}</span>
                    <button onClick={() => setSelectedSourceId(null)} className="shrink-0 p-0.5">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {(selectedSource as any).content}
                    </p>
                  </div>
                  {(selectedSource as any).source_url && (
                    <a
                      href={(selectedSource as any).source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline mt-1 flex items-center gap-1"
                    >
                      <LinkIcon className="h-2.5 w-2.5" />
                      {(selectedSource as any).source_url}
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── RIGHT: Chat panel ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">KI-Assistent</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {messages.length} Nachrichten
              </span>
            </div>
            {messages.length > 0 && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={clearChat}>
                <Trash2 className="h-3 w-3" /> Leeren
              </Button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-primary/30" />
                </div>
                <p className="text-sm text-muted-foreground/60 mb-1">
                  Frag die KI über deinen Kunden
                </p>
                <p className="text-[10px] text-muted-foreground/40 max-w-[280px]">
                  Die KI nutzt alle Quellen links als Kontext. Wähle oben einen Modus für spezialisierte Outputs.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="shrink-0 mt-0.5">
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
                        : "bg-muted/60 text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs"
                    )}
                  >
                    {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 mt-0.5">
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
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nachricht eingeben…"
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
      </div>
    </div>
  );
};

export default ClientNotebook;
