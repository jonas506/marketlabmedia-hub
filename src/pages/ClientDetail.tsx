import { useState, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import ClientInfoPanel from "@/components/client/ClientInfoPanel";
import KontingentTracker from "@/components/client/KontingentTracker";
import MonthlyShootDays from "@/components/client/MonthlyShootDays";
import MonthlyPipeline from "@/components/client/MonthlyPipeline";
import LandingPagesList from "@/components/client/LandingPagesList";
import ClientDocuments from "@/components/client/ClientDocuments";
import MarketingTracking from "@/components/client/MarketingTracking";
import TaskList from "@/components/client/TaskList";
import InspirationBoard from "@/components/client/InspirationBoard";
import ClientStrategyBoards from "@/components/client/ClientStrategyBoards";
import StorySequences from "@/components/client/StorySequences";
import ClientActivityTimeline from "@/components/client/ClientActivityTimeline";
import ClientChecklists from "@/components/client/ClientChecklists";
import ClientDashboard from "@/components/client/ClientDashboard";
import OnboardingBanner from "@/components/OnboardingBanner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowLeft, Globe, FileText, Copy, Check, ExternalLink,
  Upload, Loader2, LayoutDashboard, Clapperboard, ListChecks,
  CalendarDays, Smartphone, ClipboardList, Presentation, Sparkles,
  TrendingUp, Clock, Info, Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

const MODULE_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", icon: Clapperboard },
  { key: "tasks", label: "Aufgaben", icon: ListChecks },
  { key: "stories", label: "Stories", icon: Smartphone },
  { key: "shootdays", label: "Drehtage", icon: CalendarDays },
  { key: "checklists", label: "Checklisten", icon: ClipboardList },
  { key: "strategy", label: "Strategie", icon: Presentation },
  { key: "inspo", label: "Inspirationen", icon: Sparkles },
  { key: "marketing", label: "Marketing", icon: TrendingUp },
  { key: "landing", label: "Landing Pages", icon: Globe },
  { key: "activity", label: "Verlauf", icon: Clock },
  { key: "info", label: "Info", icon: Info },
];

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const now = new Date();
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const canEdit = role === "admin" || role === "head_of_content" || role === "cutter";

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== "application/pdf") {
          toast.error(`${file.name} ist keine PDF-Datei`);
          continue;
        }
        const filePath = `${id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabaseClient.storage
          .from("client-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: signedData } = await supabaseClient.storage
          .from("client-documents")
          .createSignedUrl(filePath, 31536000); // 1 year expiry
        const documentUrl = signedData?.signedUrl || filePath;

        await supabase.from("client_knowledge").insert({
          client_id: id,
          title: file.name.replace(/\.pdf$/i, ""),
          content: `PDF-Dokument: ${file.name}`,
          category: "sonstiges",
          source_url: documentUrl,
        });
      }
      toast.success("PDF(s) hochgeladen");
    } catch (err: any) {
      toast.error(err.message || "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contentPieces } = useQuery({
    queryKey: ["content-pieces", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pieces")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shootDays } = useQuery({
    queryKey: ["shoot-days", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoot_days")
        .select("*")
        .eq("client_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const focusPieceId = searchParams.get("piece");

  const clearFocusedPiece = useCallback(() => {
    if (!focusPieceId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("piece");
    setSearchParams(next, { replace: true });
  }, [focusPieceId, searchParams, setSearchParams]);

  const handleNavigate = useCallback((module: string) => {
    setActiveModule(module);
    setMobileNavOpen(false);
  }, []);

  if (isLoading || !client) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return (
          <ErrorBoundary level="section">
            <ClientDashboard client={client} contentPieces={contentPieces ?? []} canEdit={canEdit} onNavigate={handleNavigate} />
          </ErrorBoundary>
        );
      case "pipeline":
        return (
          <ErrorBoundary level="section">
            <MonthlyPipeline clientId={client.id} contentPieces={contentPieces ?? []} canEdit={canEdit} focusPieceId={focusPieceId} onFocusPieceHandled={clearFocusedPiece} />
          </ErrorBoundary>
        );
      case "tasks":
        return (
          <ErrorBoundary level="section">
            <TaskList clientId={client.id} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "stories":
        return (
          <ErrorBoundary level="section">
            <StorySequences clientId={client.id} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "shootdays":
        return (
          <ErrorBoundary level="section">
            <MonthlyShootDays clientId={client.id} shootDays={shootDays ?? []} month={now.getMonth() + 1} year={now.getFullYear()} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "checklists":
        return (
          <ErrorBoundary level="section">
            <ClientChecklists clientId={client.id} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "strategy":
        return (
          <ErrorBoundary level="section">
            <ClientStrategyBoards clientId={client.id} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "inspo":
        return (
          <ErrorBoundary level="section">
            <InspirationBoard clientId={client.id} clientName={client.name} clientIndustry={client.industry} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "marketing":
        return (
          <ErrorBoundary level="section">
            <MarketingTracking clientId={client.id} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "landing":
        return (
          <ErrorBoundary level="section">
            <LandingPagesList clientId={client.id} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "activity":
        return (
          <ErrorBoundary level="section">
            <ClientActivityTimeline clientId={client.id} />
          </ErrorBoundary>
        );
      case "info":
        return (
          <ErrorBoundary level="section">
            <ClientInfoPanel client={client} canEdit={canEdit} />
          </ErrorBoundary>
        );
      case "documents":
        return (
          <ErrorBoundary level="section">
            <ClientDocuments clientId={client.id} canEdit={canEdit} websiteUrl={client.website_url} />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-7 w-7 rounded-lg object-contain bg-white p-0.5 ring-1 ring-border" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                {client.name.charAt(0)}
              </div>
            )}
            <h1 className="text-sm font-semibold truncate">{client.name}</h1>
            {/* Mobile nav toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-7 w-7 p-0 text-muted-foreground"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            {client.website_url && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground" asChild>
                <a href={client.website_url} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3 w-3" />
                  <span className="hidden sm:inline">Website</span>
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={() => handleNavigate("documents")}
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Dokumente</span>
            </Button>
            {canEdit && (
              <>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  disabled={uploading}
                  onClick={() => pdfInputRef.current?.click()}
                  title="PDF hochladen"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                </Button>
              </>
            )}
            {canEdit && (client as any).approval_token && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const url = `${window.location.origin}/approve/${(client as any).approval_token}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">Freigabe</span>
                </Button>
                <Button
                  variant={copied ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-7 w-7 p-0 transition-all", copied && "bg-primary text-primary-foreground")}
                  onClick={() => {
                    const url = `${window.location.origin}/approve/${(client as any).approval_token}`;
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Onboarding Banner */}
        <OnboardingBanner clientId={client.id} />

        {/* Main layout: Sidebar + Content */}
        <div className="flex min-h-[calc(100vh-120px)]">
          {/* Module Sidebar - desktop */}
          <nav className="hidden lg:flex flex-col w-[200px] shrink-0 border-r border-border bg-card/30 py-2">
            {MODULE_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavigate(item.key)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2 text-xs transition-colors text-left",
                    isActive
                      ? "text-primary bg-primary/8 border-r-2 border-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Module Sidebar - mobile (collapsible) */}
          {mobileNavOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden absolute left-0 right-0 z-30 bg-card border-b border-border shadow-lg"
            >
              <div className="grid grid-cols-3 gap-1 p-2">
                {MODULE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavigate(item.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg py-2.5 px-1 text-[10px] transition-colors",
                        isActive
                          ? "text-primary bg-primary/10 font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </motion.nav>
          )}

          {/* Content area */}
          <main className="flex-1 min-w-0 p-4 lg:p-6">
            {renderModule()}
          </main>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default ClientDetail;