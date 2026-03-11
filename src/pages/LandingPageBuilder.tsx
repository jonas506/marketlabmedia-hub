import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send, Loader2, Globe, ExternalLink, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const LandingPageBuilder = () => {
  const { id: clientId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get("page");
  const qc = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [title, setTitle] = useState("Neue Landing Page");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string | null>(pageId);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load existing page data
  const { data: landingPage } = useQuery({
    queryKey: ["landing-page", currentPageId],
    queryFn: async () => {
      if (!currentPageId) return null;
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", currentPageId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentPageId,
  });

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("name").eq("id", clientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (landingPage) {
      setTitle(landingPage.title);
      setHtmlContent(landingPage.html_content || "");
      setSlug(landingPage.slug || "");
      setCustomDomain(landingPage.custom_domain || "");
      setIsPublished(landingPage.is_published);
      if (landingPage.chat_history && Array.isArray(landingPage.chat_history)) {
        setMessages(landingPage.chat_history as unknown as ChatMessage[]);
      }
    }
  }, [landingPage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update iframe whenever HTML changes
  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [htmlContent]);

  const extractHtml = (text: string): string => {
    // Try to extract HTML from the response
    const htmlMatch = text.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (htmlMatch) return htmlMatch[0];
    const htmlMatch2 = text.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch2) return htmlMatch2[0];
    // If text contains HTML tags, return as-is
    if (text.includes("<") && text.includes(">")) return text;
    return "";
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isGenerating) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsGenerating(true);

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-landing-page`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            clientId,
            landingPageId: currentPageId,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fehler" }));
        throw new Error(err.error || "Fehler bei der Generierung");
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Extract HTML from the final assistant message
      const html = extractHtml(assistantContent);
      if (html) {
        setHtmlContent(html);
      }
    } catch (e: any) {
      toast.error(e.message || "Fehler bei der Generierung");
      // Remove failed assistant message
      setMessages(newMessages);
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, messages, clientId, currentPageId]);

  const savePage = async () => {
    try {
      const payload = {
        client_id: clientId!,
        title,
        html_content: htmlContent,
        slug: slug || null,
        custom_domain: customDomain || null,
        is_published: isPublished,
        chat_history: JSON.parse(JSON.stringify(messages)),
        updated_at: new Date().toISOString(),
      };

      if (currentPageId) {
        const { error } = await supabase.from("landing_pages").update(payload).eq("id", currentPageId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("landing_pages").insert(payload).select("id").single();
        if (error) throw error;
        setCurrentPageId(data.id);
      }
      qc.invalidateQueries({ queryKey: ["landing-pages", clientId] });
      toast.success("Landing Page gespeichert!");
    } catch (e: any) {
      toast.error("Fehler beim Speichern: " + e.message);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel – Chat */}
      <div className="w-[420px] flex flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Link
            to={`/client/${clientId}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{client?.name} – Landing Page</h1>
            <p className="text-xs text-muted-foreground">KI-Builder</p>
          </div>
        </div>

        {/* Settings */}
        <div className="p-3 border-b border-border space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Seitentitel"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug (z.B. mein-angebot)"
              className="h-8 text-xs font-mono flex-1"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="Domain (z.B. angebot.firma.de)"
                className="h-8 text-xs font-mono pl-7"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1 gap-1.5" onClick={savePage}>
              <Save className="h-3 w-3" /> Speichern
            </Button>
            <Button
              size="sm"
              variant={isPublished ? "default" : "outline"}
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                setIsPublished(!isPublished);
              }}
            >
              {isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {isPublished ? "Live" : "Entwurf"}
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1">Landing Page Builder</h3>
                <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                  Beschreibe die Landing Page die du erstellen möchtest. Die KI kennt bereits alle Kundendaten.
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    "Erstelle eine moderne Landing Page für diesen Kunden",
                    "Baue eine Lead-Gen Seite mit Kontaktformular",
                    "Erstelle eine Angebotsseite mit Preisen und CTA",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="text-xs">
                      {msg.content.includes("<!DOCTYPE") || msg.content.includes("<html")
                        ? "✅ Landing Page generiert – siehe Preview rechts"
                        : msg.content.length > 500
                        ? "✅ Landing Page aktualisiert"
                        : msg.content}
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              </motion.div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generiere Landing Page...
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Beschreibe deine Landing Page..."
              className="flex-1 h-10"
              disabled={isGenerating}
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isGenerating || !input.trim()}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel – Preview */}
      <div className="flex-1 flex flex-col bg-muted/30">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-destructive/50" />
              <div className="h-3 w-3 rounded-full bg-[hsl(var(--runway-yellow))]/50" />
              <div className="h-3 w-3 rounded-full bg-[hsl(var(--runway-green))]/50" />
            </div>
            <span className="text-xs text-muted-foreground font-mono ml-2">
              {customDomain || slug ? `${customDomain || slug + ".lovable.app"}` : "Preview"}
            </span>
          </div>
          {htmlContent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                const blob = new Blob([htmlContent], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              }}
            >
              <ExternalLink className="h-3 w-3" /> Im Tab öffnen
            </Button>
          )}
        </div>
        <div className="flex-1 relative">
          {htmlContent ? (
            <iframe
              ref={iframeRef}
              className="absolute inset-0 w-full h-full bg-white"
              sandbox="allow-scripts allow-same-origin"
              title="Landing Page Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Starte den Chat, um deine Landing Page zu generieren
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPageBuilder;
