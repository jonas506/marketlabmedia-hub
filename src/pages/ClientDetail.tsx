import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import ClientInfoPanel from "@/components/client/ClientInfoPanel";
import KontingentTracker from "@/components/client/KontingentTracker";
import MonthlyShootDays from "@/components/client/MonthlyShootDays";
import MonthlyPipeline from "@/components/client/MonthlyPipeline";
import LandingPagesList from "@/components/client/LandingPagesList";
import ClientNotebook from "@/components/client/ClientNotebook";
import MarketingTracking from "@/components/client/MarketingTracking";
import TaskList from "@/components/client/TaskList";
import InspirationBoard from "@/components/client/InspirationBoard";
import ClientStrategyBoards from "@/components/client/ClientStrategyBoards";
import StorySequences from "@/components/client/StorySequences";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, CalendarDays, Link as LinkIcon, Copy, Check, ClipboardList, TrendingUp, Globe, BookOpen, Sparkles, Presentation, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [copied, setCopied] = useState(false);

  const canEdit = role === "admin" || role === "head_of_content" || role === "cutter";

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

  if (isLoading || !client) {
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
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body transition-colors group">
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </Link>
          {canEdit && (client as any).approval_token && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const url = `${window.location.origin}/approve/${(client as any).approval_token}`;
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-3 w-3 text-[hsl(var(--runway-green))]" /> : <LinkIcon className="h-3 w-3" />}
              {copied ? "Kopiert" : "Freigabe-Link"}
            </Button>
          )}
        </div>

        {/* Client header (collapsible info) */}
        <ClientInfoPanel client={client} canEdit={canEdit} />

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

        {/* Core workflow: Kontingent → Shoot Days → Pipeline */}
        <div className="space-y-4">
          <KontingentTracker client={client} contentPieces={contentPieces ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
          <MonthlyShootDays clientId={client.id} shootDays={shootDays ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
          <MonthlyPipeline clientId={client.id} contentPieces={contentPieces ?? []} month={selectedMonth} year={selectedYear} canEdit={canEdit} />
        </div>

        {/* Tabbed secondary sections */}
        <Tabs defaultValue="tasks" className="mt-6">
          <TabsList className="bg-card border border-border h-auto p-0.5 gap-0 flex flex-wrap">
            <TabsTrigger value="tasks" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aufgaben</span>
            </TabsTrigger>
            <TabsTrigger value="inspo" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Inspirationen</span>
            </TabsTrigger>
            <TabsTrigger value="stories" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Film className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stories</span>
            </TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Marketing</span>
            </TabsTrigger>
            <TabsTrigger value="landing" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Landing Pages</span>
            </TabsTrigger>
            <TabsTrigger value="notebook" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Notebook</span>
            </TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
              <Presentation className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Strategie</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <TaskList clientId={client.id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="inspo" className="mt-4">
            <InspirationBoard clientId={client.id} clientName={client.name} clientIndustry={client.industry} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="stories" className="mt-4">
            <StorySequences clientId={client.id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="marketing" className="mt-4">
            <MarketingTracking clientId={client.id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="landing" className="mt-4">
            <LandingPagesList clientId={client.id} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="notebook" className="mt-4">
            <ClientNotebook clientId={client.id} canEdit={canEdit} websiteUrl={client.website_url} />
          </TabsContent>
          <TabsContent value="strategy" className="mt-4">
            <ClientStrategyBoards clientId={client.id} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default ClientDetail;
