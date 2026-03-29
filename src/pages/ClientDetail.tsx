import { useState, useRef, useEffect, useCallback } from "react";
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
import OnboardingBanner from "@/components/OnboardingBanner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, CalendarDays, Link as LinkIcon, Copy, Check, ClipboardList, TrendingUp, Globe, FileText, Sparkles, Presentation, Upload, Loader2, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
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

        const { data: { publicUrl } } = supabaseClient.storage
          .from("client-documents")
          .getPublicUrl(filePath);

        await supabase.from("client_knowledge").insert({
          client_id: id,
          title: file.name.replace(/\.pdf$/i, ""),
          content: `PDF-Dokument: ${file.name}`,
          category: "sonstiges",
          source_url: publicUrl,
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

  useEffect(() => {
    if (!focusPieceId || !contentPieces) return;
    const targetPiece = contentPieces.find((piece: any) => piece.id === focusPieceId);
    if (!targetPiece) return;
    if (targetPiece.target_month !== selectedMonth) setSelectedMonth(targetPiece.target_month);
    if (targetPiece.target_year !== selectedYear) setSelectedYear(targetPiece.target_year);
  }, [focusPieceId, contentPieces, selectedMonth, selectedYear]);

    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 6 + i);
    return {
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: format(d, "MMMM yyyy", { locale: de }),
      value: `${d.getMonth() + 1}-${d.getFullYear()}`,
    };
  });

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="max-w-[1200px] mx-auto">
        {/* Top bar: Back + Approval link */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body transition-colors group">
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            </Link>
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-8 w-8 rounded-lg object-contain bg-white p-1 ring-1 ring-border" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
                {client.name.charAt(0)}
              </div>
            )}
            <h1 className="font-display text-lg font-bold tracking-tight truncate">{client.name}</h1>
          </div>
           <div className="flex items-center gap-1.5">
            {client.website_url && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground" asChild>
                <a href={client.website_url} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3 w-3" />
                  Website
                </a>
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground">
                  <FileText className="h-3 w-3" />
                  Dokumente
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
               <SheetHeader>
                  <SheetTitle className="flex items-center justify-between pr-4">
                    Dokumente
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
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7"
                          disabled={uploading}
                          onClick={() => pdfInputRef.current?.click()}
                        >
                          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          PDF hochladen
                        </Button>
                      </>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <ClientDocuments clientId={client.id} canEdit={canEdit} websiteUrl={client.website_url} />
                </div>
              </SheetContent>
            </Sheet>
            {canEdit && (client as any).approval_token && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => {
                    const url = `${window.location.origin}/approve/${(client as any).approval_token}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Freigabe öffnen
                </Button>
                <Button
                  variant={copied ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 w-7 p-0 transition-all ${copied ? "bg-[hsl(var(--runway-green))] text-white hover:bg-[hsl(var(--runway-green))]/90" : ""}`}
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

        {/* Client Info Panel – directly visible */}
        <div className="mt-4">
          <ClientInfoPanel client={client} canEdit={canEdit} />
        </div>

        {/* Onboarding Banner */}
        <OnboardingBanner clientId={client.id} />

        {/* Month selector – compact inline */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-5 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold tracking-tight">Monatszyklus</h2>
          </div>
          <Select value={`${selectedMonth}-${selectedYear}`} onValueChange={(v) => {
            const [m, y] = v.split("-").map(Number);
            setSelectedMonth(m);
            setSelectedYear(y);
          }}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ErrorBoundary level="section">
          <div className="space-y-4">
            <KontingentTracker client={client} contentPieces={contentPieces ?? []} month={now.getMonth() + 1} year={now.getFullYear()} canEdit={canEdit} />
            <TaskList clientId={client.id} canEdit={canEdit} />
            <MonthlyPipeline clientId={client.id} contentPieces={contentPieces ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} focusPieceId={focusPieceId} onFocusPieceHandled={clearFocusedPiece} />
          </div>
        </ErrorBoundary>

        {/* Tabbed secondary sections */}
        <Tabs defaultValue="stories" className="mt-6">
          <TabsList className="bg-card border border-border h-auto p-0.5 gap-0 flex flex-wrap">
            <TabsTrigger value="stories" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              📱
              <span className="hidden sm:inline">Stories</span>
            </TabsTrigger>
            <TabsTrigger value="shootdays" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Drehtage</span>
            </TabsTrigger>
            <TabsTrigger value="checklists" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Checklisten</span>
            </TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Presentation className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Strategie</span>
            </TabsTrigger>
            <TabsTrigger value="inspo" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inspirationen</span>
            </TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Marketing</span>
            </TabsTrigger>
            <TabsTrigger value="landing" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Landing Pages</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Verlauf</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stories" className="mt-4">
            <ErrorBoundary level="section"><StorySequences clientId={client.id} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="shootdays" className="mt-4">
            <ErrorBoundary level="section"><MonthlyShootDays clientId={client.id} shootDays={shootDays ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="checklists" className="mt-4">
            <ErrorBoundary level="section"><ClientChecklists clientId={client.id} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="inspo" className="mt-4">
            <ErrorBoundary level="section"><InspirationBoard clientId={client.id} clientName={client.name} clientIndustry={client.industry} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="marketing" className="mt-4">
            <ErrorBoundary level="section"><MarketingTracking clientId={client.id} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="landing" className="mt-4">
            <ErrorBoundary level="section"><LandingPagesList clientId={client.id} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="strategy" className="mt-4">
            <ErrorBoundary level="section"><ClientStrategyBoards clientId={client.id} canEdit={canEdit} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ErrorBoundary level="section"><ClientActivityTimeline clientId={client.id} /></ErrorBoundary>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default ClientDetail;
