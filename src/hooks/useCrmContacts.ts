import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CrmContact = Database["public"]["Tables"]["crm_contacts"]["Row"];
export type CrmEvent = Database["public"]["Tables"]["crm_events"]["Row"];
export type CrmEventGuest = Database["public"]["Tables"]["crm_event_guests"]["Row"];

export function useCrmContacts() {
  return useQuery({
    queryKey: ["crm-contacts"],
    queryFn: async () => {
      const all: CrmContact[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("crm_contacts").select("*").order("full_name").range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
    staleTime: 30_000,
  });
}

export function useCrmEvents() {
  return useQuery({
    queryKey: ["crm-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_events").select("*").order("date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCrmEventGuests() {
  return useQuery({
    queryKey: ["crm-event-guests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_event_guests").select("*");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useContactLeads() {
  return useQuery({
    queryKey: ["crm-contact-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_leads").select("id, name, contact_id, stage, deal_value");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export const isOpenLeadStage = (s: string) => !/^(gewonnen|verloren)/.test(s);
