import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Merge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCrmContacts } from "@/hooks/useCrmContacts";
import { findDuplicateGroups } from "@/lib/crm-contacts";

export default function DuplicateFinder({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: contacts = [] } = useCrmContacts();
  const [busy, setBusy] = useState<string | null>(null);
  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads-dupcheck"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("crm_leads").select("id, name, contact_name, contact_email, linkedin_url, created_at").order("created_at");
      return data ?? [];
    },
  });

  const contactGroups = useMemo(() => findDuplicateGroups(contacts), [contacts]);
  const leadGroups = useMemo(() => findDuplicateGroups(leads.map(l => ({
    id: l.id, full_name: l.contact_name || l.name, email: l.contact_email, linkedin_url: l.linkedin_url, label: l.name,
  }))), [leads]);

  const merge = async (keep: string, drops: string[], key: string) => {
    setBusy(key);
    for (const d of drops) {
      const { error } = await supabase.rpc("crm_merge_contacts", { _keep: keep, _drop: d });
      if (error) { toast.error("Zusammenführen fehlgeschlagen"); setBusy(null); return; }
    }
    toast.success("Kontakte zusammengeführt");
    ["crm-contacts", "crm-event-guests", "crm-contact-leads"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    setBusy(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dubletten-Finder</DialogTitle></DialogHeader>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Kontakte ({contactGroups.length})</h3>
          {contactGroups.length === 0 && <p className="text-xs text-muted-foreground">Keine möglichen Dubletten.</p>}
          {contactGroups.map(g => {
            const key = g.reason + g.key;
            const [keep, ...rest] = [...g.items].sort((a, b) => a.created_at.localeCompare(b.created_at));
            return (
              <div key={key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{g.reason}: <span className="text-foreground">{g.key}</span></span>
                  <Button size="sm" variant="outline" disabled={busy === key} onClick={() => merge(keep.id, rest.map(r => r.id), key)}>
                    {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5 mr-1" />}Zusammenführen
                  </Button>
                </div>
                {g.items.map(c => (
                  <Link key={c.id} to={`/crm/kontakt/${c.id}`} className="flex justify-between text-sm hover:text-primary">
                    <span>{c.full_name}{c.company ? ` · ${c.company}` : ""}{c.id === keep.id ? " (bleibt)" : ""}</span>
                    <span className="text-xs text-muted-foreground">{c.email || c.linkedin_url || ""}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </section>
        <section className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold">Leads ({leadGroups.length})</h3>
          {leadGroups.length === 0 && <p className="text-xs text-muted-foreground">Keine doppelten Leads.</p>}
          {leadGroups.map(g => (
            <div key={g.reason + g.key} className="rounded-lg border border-border bg-card p-3 space-y-1">
              <span className="text-xs text-muted-foreground">{g.reason}: <span className="text-foreground">{g.key}</span></span>
              {g.items.map(l => (
                <Link key={l.id} to={`/crm/lead/${l.id}`} className="block text-sm hover:text-primary">{l.label}{l.full_name !== l.label ? ` · ${l.full_name}` : ""}</Link>
              ))}
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
