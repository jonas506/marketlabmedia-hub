import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Send, Loader2, Globe, ExternalLink, Save, Eye, EyeOff,
  Monitor, Tablet, Smartphone, Upload, Image, X, Code, Sparkles,
  PanelLeftClose, PanelLeft, FileImage, Paperclip, ChevronDown, BookmarkPlus,
  Link2, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaveTemplateDialog from "@/components/client/SaveTemplateDialog";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; url: string; type: string }[];
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORTS: Record<ViewportSize, { width: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: "100%", label: "Desktop", icon: Monitor },
  tablet: { width: "768px", label: "Tablet", icon: Tablet },
  mobile: { width: "375px", label: "Mobile", icon: Smartphone },
};

const LandingPageBuilder = () => {
  const { id: clientId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get("page");
  const templateId = searchParams.get("template");
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
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [showCode, setShowCode] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; type: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [showCloneInput, setShowCloneInput] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Auto-load CI assets from client branding storage
  const { data: ciAssets } = useQuery({
    queryKey: ["ci-assets", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("landing-page-assets")
        .list(`${clientId}/ci`, { limit: 100 });
      if (error || !data) return [];
      return data
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((file) => {
          const path = `${clientId}/ci/${file.name}`;
          const { data: urlData } = supabase.storage.from("landing-page-assets").getPublicUrl(path);
          return {
            name: file.name.replace(/^\d+-/, ""),
            url: urlData.publicUrl,
            type: file.metadata?.mimetype?.startsWith("image/") ? "image" : "file",
          };
        });
    },
    enabled: !!clientId,
  });

  // Load template HTML if templateId is provided
  useEffect(() => {
    if (templateId && !pageId) {
      (async () => {
        const { data, error } = await supabase
          .from("landing_page_templates" as any)
          .select("*")
          .eq("id", templateId)
          .single();
        if (data && !error) {
          setHtmlContent((data as any).html_content || "");
          setTitle(`${(data as any).name} – Kopie`);
          setMessages([{
            role: "assistant",
            content: `Vorlage "${(data as any).name}" geladen. Du kannst jetzt Anpassungen beschreiben.`,
          }]);
        }
      })();
    }
  }, [templateId, pageId]);

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
    const htmlMatch = text.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (htmlMatch) return htmlMatch[0];
    const htmlMatch2 = text.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch2) return htmlMatch2[0];
    if (text.includes("<") && text.includes(">")) return text;
    return "";
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const newFiles: typeof uploadedFiles = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${Date.now()}-${file.name}`;

      const { error } = await supabase.storage.from("landing-page-assets").upload(path, file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("landing-page-assets").getPublicUrl(path);
      newFiles.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type.startsWith("image/") ? "image" : "file",
      });
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    if (newFiles.length > 0) toast.success(`${newFiles.length} Datei(en) hochgeladen`);
    setIsUploading(false);
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const cloneFromUrl = useCallback(async () => {
    if (!cloneUrl.trim() || isCloning) return;
    setIsCloning(true);
    setShowCloneInput(false);

    const scrapingMsg: ChatMessage = {
      role: "user",
      content: `Baue diese Seite 1:1 nach: ${cloneUrl.trim()}`,
    };
    const newMessages = [...messages, scrapingMsg];
    setMessages(newMessages);

    try {
      // Step 1: Scrape the URL
      toast.info("Seite wird gescraped...");
      const scrapeResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            url: cloneUrl.trim(),
            options: { formats: ["html", "markdown"], onlyMainContent: false, waitFor: 3000 },
          }),
        }
      );

      if (!scrapeResp.ok) {
        const err = await scrapeResp.json().catch(() => ({}));
        throw new Error(err.error || "Scraping fehlgeschlagen");
      }

      const scrapeData = await scrapeResp.json();
      const scrapedHtml = scrapeData?.data?.html || "";
      const scrapedMarkdown = scrapeData?.data?.markdown || "";

      if (!scrapedHtml && !scrapedMarkdown) {
        throw new Error("Keine Inhalte auf der Seite gefunden");
      }

      // Step 2: Send scraped content to AI to recreate
      toast.info("KI erstellt die Seite nach...");

      // Truncate HTML if too long, use markdown as fallback context
      const htmlSnippet = scrapedHtml.length > 80000 ? scrapedHtml.slice(0, 80000) + "\n<!-- truncated -->" : scrapedHtml;

      const clonePrompt = `Hier ist der HTML-Quellcode einer bestehenden Seite. Baue sie EXAKT 1:1 nach – gleiches Layout, gleiche Farben, gleiche Struktur, gleiche Abstände. Verwende die gleichen Bilder (URLs beibehalten). Mache sie vollständig responsive.\n\n--- ORIGINAL HTML ---\n${htmlSnippet}\n--- ENDE ---`;

      const apiMessages = [
        ...newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: clonePrompt },
      ];

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

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-landing-page`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages, clientId, landingPageId: currentPageId }),
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

      const html = extractHtml(assistantContent);
      if (html) {
        setHtmlContent(html);
        toast.success("Seite erfolgreich nachgebaut!");
      }
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Klonen");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Fehler: ${e.message}` },
      ]);
    } finally {
      setIsCloning(false);
      setIsGenerating(false);
      setCloneUrl("");
    }
  }, [cloneUrl, isCloning, messages, clientId, currentPageId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    // Include CI assets from branding + any manually uploaded files
    const allAssets = [
      ...(ciAssets || []).map((a) => ({ name: a.name, url: a.url, type: a.type })),
      ...uploadedFiles,
    ];

    const attachmentContext = allAssets.length > 0
      ? `\n\n[Hochgeladene CI-Dateien - bitte in der Landing Page verwenden:\n${allAssets.map((f) => `- ${f.name}: ${f.url}`).join("\n")}\n]`
      : "";

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim() + attachmentContext,
      attachments: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setUploadedFiles([]);
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
      // Strip attachments from messages sent to AI (keep just text)
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-landing-page`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages, clientId, landingPageId: currentPageId }),
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

      const html = extractHtml(assistantContent);
      if (html) setHtmlContent(html);
    } catch (e: any) {
      toast.error(e.message || "Fehler bei der Generierung");
      setMessages(newMessages);
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, messages, clientId, currentPageId, uploadedFiles]);

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

  const chatPanelWidth = chatCollapsed ? "0px" : "420px";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.svg,.pdf"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Left Panel – Chat */}
      <AnimatePresence>
        {!chatCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-r border-border bg-card overflow-hidden shrink-0"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <Link
                to={`/client/${clientId}`}
                className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent/20 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-semibold truncate">{client?.name}</h1>
                <p className="text-[11px] text-muted-foreground">Landing Page Builder</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatCollapsed(true)}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>

            {/* Page settings */}
            <div className="px-3 py-2 border-b border-border space-y-1.5 shrink-0">
              <div className="flex gap-1.5">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Seitentitel"
                  className="h-7 text-xs"
                />
              </div>

              <Popover open={showSettings} onOpenChange={setShowSettings}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="h-3 w-3" />
                    {customDomain || slug || "Domain & Slug konfigurieren"}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3 space-y-2" align="start">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Slug</label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="z.B. mein-angebot"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Custom Domain</label>
                    <Input
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="z.B. angebot.firma.de"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1" onClick={savePage}>
                  <Save className="h-3 w-3" /> Speichern
                </Button>
                {htmlContent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => setShowSaveTemplate(true)}
                    title="Als Vorlage speichern"
                  >
                    <BookmarkPlus className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isPublished ? "default" : "outline"}
                  className="h-7 text-[11px] gap-1"
                  onClick={() => setIsPublished(!isPublished)}
                >
                  {isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {isPublished ? "Live" : "Entwurf"}
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">KI Landing Page Builder</h3>
                    <p className="text-xs text-muted-foreground max-w-[280px] mx-auto mb-3">
                      Beschreibe die Seite, die du bauen willst. Die KI nutzt automatisch die CI-Assets des Kunden.
                    </p>
                    {ciAssets && ciAssets.length > 0 && (
                      <div className="mb-4 p-2.5 rounded-lg bg-muted/50 border border-border text-left">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">CI-Assets geladen:</p>
                        <div className="flex flex-wrap gap-1">
                          {ciAssets.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-background rounded px-1.5 py-0.5 border border-border">
                              <FileImage className="h-2.5 w-2.5" />
                              {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setShowCloneInput(true)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-primary" />
                          URL einfügen & Seite 1:1 nachbauen
                        </span>
                      </button>
                      {[
                        "Erstelle eine moderne Landing Page für diesen Kunden",
                        "Baue eine Lead-Gen Seite mit Kontaktformular",
                        "Erstelle eine Immobilien-Angebotsseite mit CTA",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setInput(suggestion)}
                          className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent/20 hover:border-primary/30 transition-all"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>

                    {/* Clone URL input */}
                    <AnimatePresence>
                      {showCloneInput && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium">
                              <Link2 className="h-3.5 w-3.5 text-primary" />
                              Seite nachbauen
                            </div>
                            <Input
                              value={cloneUrl}
                              onChange={(e) => setCloneUrl(e.target.value)}
                              placeholder="https://www.beispiel.de"
                              className="h-8 text-xs font-mono"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  cloneFromUrl();
                                }
                              }}
                              disabled={isCloning}
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 text-[11px] flex-1 gap-1"
                                onClick={cloneFromUrl}
                                disabled={!cloneUrl.trim() || isCloning}
                              >
                                {isCloning ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                {isCloning ? "Wird nachgebaut..." : "Nachbauen"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px]"
                                onClick={() => { setShowCloneInput(false); setCloneUrl(""); }}
                              >
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted/60 border border-border rounded-bl-md"
                      }`}
                    >
                      {/* Show attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((att, j) => (
                            <div key={j} className="flex items-center gap-1 text-[10px] bg-background/30 rounded px-1.5 py-0.5">
                              <FileImage className="h-3 w-3" />
                              {att.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.role === "assistant" ? (
                        <div className="text-xs">
                          {msg.content.includes("<!DOCTYPE") || msg.content.includes("<html")
                            ? (
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded-full bg-[hsl(var(--runway-green))]/20 flex items-center justify-center">
                                  <Sparkles className="h-3 w-3 text-[hsl(var(--runway-green))]" />
                                </div>
                                Landing Page generiert – Preview rechts
                              </div>
                            )
                            : msg.content.length > 500
                            ? (
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded-full bg-[hsl(var(--runway-green))]/20 flex items-center justify-center">
                                  <Sparkles className="h-3 w-3 text-[hsl(var(--runway-green))]" />
                                </div>
                                Landing Page aktualisiert
                              </div>
                            )
                            : msg.content}
                        </div>
                      ) : (
                        <span>
                          {/* Show user message without the attachment context */}
                          {msg.content.split("\n\n[Hochgeladene CI-Dateien")[0]}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isGenerating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-muted/60 border border-border rounded-2xl rounded-bl-md px-3.5 py-2.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generiere Landing Page...
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Uploaded files preview */}
            <AnimatePresence>
              {uploadedFiles.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 border-t border-border overflow-hidden"
                >
                  <div className="py-2 flex flex-wrap gap-1.5">
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg pl-2 pr-1 py-1 text-[11px]">
                        {file.type === "image" ? (
                          <img src={file.url} className="h-5 w-5 rounded object-cover" alt="" />
                        ) : (
                          <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="max-w-[100px] truncate">{file.name}</span>
                        <button onClick={() => removeUploadedFile(i)} className="h-4 w-4 flex items-center justify-center rounded hover:bg-background/50">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="p-3 border-t border-border shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="relative"
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Beschreibe deine Landing Page oder lade CI-Assets hoch..."
                  className="min-h-[80px] max-h-[160px] resize-none pr-24 text-sm rounded-xl border-border bg-muted/30"
                  disabled={isGenerating}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setShowCloneInput((v) => !v)}
                    title="URL nachbauen"
                  >
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    disabled={isGenerating || (!input.trim() && uploadedFiles.length === 0)}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Panel – Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            {chatCollapsed && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatCollapsed(false)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}

            {/* Browser dots */}
            <div className="flex gap-1.5 mr-2">
              <div className="h-3 w-3 rounded-full bg-destructive/40" />
              <div className="h-3 w-3 rounded-full bg-[hsl(var(--runway-yellow))]/40" />
              <div className="h-3 w-3 rounded-full bg-[hsl(var(--runway-green))]/40" />
            </div>

            {/* URL bar */}
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5 min-w-[200px] max-w-[400px]">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                {customDomain || (slug ? `${slug}.lovable.app` : "preview")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Viewport toggle */}
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
              {(Object.entries(VIEWPORTS) as [ViewportSize, typeof VIEWPORTS["desktop"]][]).map(([key, vp]) => {
                const Icon = vp.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setViewport(key)}
                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
                      viewport === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={vp.label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>

            {/* Code toggle */}
            <Button
              variant={showCode ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowCode(!showCode)}
              title="Code anzeigen"
            >
              <Code className="h-3.5 w-3.5" />
            </Button>

            {/* Open in new tab */}
            {htmlContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1 ml-1"
                onClick={() => {
                  const blob = new Blob([htmlContent], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
              >
                <ExternalLink className="h-3 w-3" /> Öffnen
              </Button>
            )}
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 relative bg-[hsl(230,15%,8%)] overflow-hidden">
          {showCode ? (
            <ScrollArea className="h-full">
              <pre className="p-4 text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
                {htmlContent || "// Noch kein HTML generiert"}
              </pre>
            </ScrollArea>
          ) : htmlContent ? (
            <div className="flex items-start justify-center h-full p-4 overflow-auto">
              <motion.div
                layout
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{
                  width: VIEWPORTS[viewport].width,
                  maxWidth: "100%",
                }}
                className="h-full bg-white rounded-lg overflow-hidden shadow-2xl shadow-black/30"
              >
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="Landing Page Preview"
                />
              </motion.div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center mx-auto mb-5">
                  <Globe className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Keine Vorschau verfügbar</p>
                <p className="text-xs text-muted-foreground/60">
                  Starte den Chat, um deine Landing Page zu generieren
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveTemplateDialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
        htmlContent={htmlContent}
      />
    </div>
  );
};

export default LandingPageBuilder;
