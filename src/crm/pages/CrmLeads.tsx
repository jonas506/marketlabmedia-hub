import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CrmLeads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  const { data: statuses = [] } = useQuery({
    queryKey: ["crm-lead-statuses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_lead_statuses")
        .select("*")
        .order("sort_order");
      return data || [];
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_leads")
        .select("*, crm_lead_statuses(*), crm_contacts(id, first_name, last_name), crm_opportunities(value)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_leads").insert({
        name: newName,
        website: newWebsite || null,
        created_by: user!.id,
        status_id: statuses.find((s: any) => s.is_default)?.id || statuses[0]?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      setCreateOpen(false);
      setNewName("");
      setNewWebsite("");
      toast.success("Lead erstellt");
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      toast.success("Lead gelöscht");
    },
  });

  const filtered = leads.filter((l: any) => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && l.status_id !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border">
        <h1 className="text-xl font-bold">Leads</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-crm-primary hover:bg-crm-primary-hover text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neuer Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-crm-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Leads durchsuchen..."
            className="pl-9 bg-crm-bg border-crm-border text-crm-text placeholder:text-crm-muted"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !statusFilter ? "bg-crm-primary text-white" : "bg-crm-bg text-crm-muted hover:text-crm-text border border-crm-border"
            }`}
          >
            Alle
          </button>
          {statuses.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id === statusFilter ? null : s.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s.id
                  ? "text-white"
                  : "bg-crm-bg text-crm-muted hover:text-crm-text border border-crm-border"
              }`}
              style={statusFilter === s.id ? { backgroundColor: s.color } : {}}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-crm-surface border-b border-crm-border">
            <tr className="text-left text-xs text-crm-muted uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Kontakt</th>
              <th className="px-4 py-3 font-medium">Opportunities</th>
              <th className="px-4 py-3 font-medium">Erstellt</th>
              <th className="px-4 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead: any) => {
              const status = lead.crm_lead_statuses;
              const contact = lead.crm_contacts?.[0];
              const totalValue = (lead.crm_opportunities || []).reduce((s: number, o: any) => s + Number(o.value || 0), 0);
              return (
                <tr
                  key={lead.id}
                  className="border-b border-crm-border hover:bg-crm-bg/50 transition-colors group"
                >
                  <td className="px-6 py-3">
                    <Link to={`/crm/leads/${lead.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-crm-primary/20 text-crm-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {lead.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-crm-text hover:text-crm-primary transition-colors">
                          {lead.name}
                        </p>
                        {lead.website && (
                          <p className="text-xs text-crm-muted truncate max-w-[200px]">{lead.website}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {status && (
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: status.color + "22", color: status.color }}
                      >
                        {status.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-crm-muted">
                    {contact ? `${contact.first_name} ${contact.last_name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {totalValue > 0 ? `${totalValue.toLocaleString("de-DE")} €` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-crm-muted">
                    {format(new Date(lead.created_at), "dd.MM.yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-crm-surface border-crm-border">
                        <DropdownMenuItem
                          onClick={() => deleteLead.mutate(lead.id)}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-crm-muted">
                  Keine Leads gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-crm-surface border-crm-border text-crm-text">
          <DialogHeader>
            <DialogTitle>Neuen Lead erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-crm-muted">Firmenname *</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="z.B. RIEDEL Immobilien"
                className="mt-1 bg-crm-bg border-crm-border text-crm-text"
              />
            </div>
            <div>
              <Label className="text-crm-muted">Website</Label>
              <Input
                value={newWebsite}
                onChange={e => setNewWebsite(e.target.value)}
                placeholder="https://..."
                className="mt-1 bg-crm-bg border-crm-border text-crm-text"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-crm-muted">
              Abbrechen
            </Button>
            <Button
              onClick={() => createLead.mutate()}
              disabled={!newName.trim()}
              className="bg-crm-primary hover:bg-crm-primary-hover text-white"
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
