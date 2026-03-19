import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import { Users, Contact, BarChart3 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CrmCommandSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string; lead_id: string }[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("crm_leads").select("id, name").order("name").limit(50),
      supabase.from("crm_contacts").select("id, first_name, last_name, lead_id").order("last_name").limit(50),
    ]).then(([l, c]) => {
      setLeads((l.data as any) || []);
      setContacts((c.data as any) || []);
    });
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Lead, Kontakt oder Opportunity suchen..." />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse.</CommandEmpty>
        <CommandGroup heading="Leads">
          {leads.map(l => (
            <CommandItem
              key={l.id}
              onSelect={() => { navigate(`/crm/leads/${l.id}`); onOpenChange(false); }}
            >
              <Users className="mr-2 h-4 w-4 text-crm-primary" />
              {l.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Contacts">
          {contacts.map(c => (
            <CommandItem
              key={c.id}
              onSelect={() => { navigate(`/crm/leads/${c.lead_id}`); onOpenChange(false); }}
            >
              <Contact className="mr-2 h-4 w-4 text-crm-muted" />
              {c.first_name} {c.last_name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
