import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Briefcase, Search, ArrowUpDown } from "lucide-react";
import PipelineBoard from "@/components/crm/PipelineBoard";
import MagicInput from "@/components/crm/MagicInput";
import CRMCampaigns from "@/pages/crm/CRMCampaigns";
import { getSourceInfo } from "@/lib/crm-constants";
import { useCrmStages, getStageLabel as dynGetStageLabel, getStageColor as dynGetStageColor } from "@/hooks/useCrmStages";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Lead = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: string;
  source: string | null;
  deal_value: number;
  next_step: string | null;
  next_step_date: string | null;
  last_activity_at: string | null;
  created_at: string;
  profile_image_url: string | null;
  instagram_handle: string | null;
};

export default function CRMHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam === "kampagnen" ? "kampagnen" : tabParam === "leads" ? "leads" : "pipeline";
  const [tab, setTab] = useState(defaultTab);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: stages = [] } = useCrmStages();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof Lead>("last_activity_at");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, name, contact_name, contact_email, contact_phone, stage, source, deal_value, next_step, next_step_date, last_activity_at, created_at, profile_image_url, instagram_handle")
      .order("last_activity_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleTabChange = (v: string) => {
    setTab(v);
    setSearchParams(v === "pipeline" ? {} : { tab: v });
  };

  // Leads table
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.contact_name?.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal), "de");
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [leads, search, sortField, sortAsc]);

  const toggleSort = (field: keyof Lead) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortHeader = ({ field, children }: { field: keyof Lead; children: React.ReactNode }) => (
    <th
      className="text-left text-xs font-medium text-muted-foreground px-3 py-2 cursor-pointer hover:text-foreground select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">CRM</h1>
        </div>

        <MagicInput onLeadCreated={fetchLeads} />

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="leads">Alle Leads</TabsTrigger>
            <TabsTrigger value="kampagnen">Kampagnen</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <PipelineBoard leads={leads} onRefresh={fetchLeads} />
            )}
          </TabsContent>

          <TabsContent value="leads">
            <div className="mb-4 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Lead suchen…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="border border-border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <SortHeader field="name">Firma</SortHeader>
                    <SortHeader field="contact_name">Ansprechpartner</SortHeader>
                    <SortHeader field="stage">Stage</SortHeader>
                    <SortHeader field="source">Quelle</SortHeader>
                    <SortHeader field="deal_value">Deal-Wert</SortHeader>
                    <SortHeader field="next_step">Nächster Schritt</SortHeader>
                    <SortHeader field="last_activity_at">Letzte Aktivität</SortHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map(lead => {
                    const sourceInfo = getSourceInfo(lead.source);
                    return (
                      <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5">
                          <Link to={`/crm/lead/${lead.id}`} className="font-medium hover:text-primary transition-colors">
                            {lead.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{lead.contact_name || "—"}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: dynGetStageColor(stages, lead.stage) + "22", color: dynGetStageColor(stages, lead.stage) }}
                          >
                            {dynGetStageLabel(stages, lead.stage)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {sourceInfo ? (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sourceInfo.color}`}
                              style={sourceInfo.style}
                            >
                              {sourceInfo.label}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {Number(lead.deal_value) > 0 ? `${Number(lead.deal_value).toLocaleString("de-DE")} €` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">
                          {lead.next_step || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {lead.last_activity_at
                            ? formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true, locale: de })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Keine Leads gefunden</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="kampagnen">
            <CRMCampaigns />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
