import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Search, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function CrmContacts() {
  const [search, setSearch] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-all-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("*, crm_leads(id, name)")
        .order("last_name");
      return data || [];
    },
  });

  const filtered = contacts.filter((c: any) => {
    const q = search.toLowerCase();
    return !q || `${c.first_name} ${c.last_name} ${c.email || ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-crm-border">
        <h1 className="text-xl font-bold">Contacts</h1>
      </div>
      <div className="px-6 py-3 border-b border-crm-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crm-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Kontakte suchen..."
            className="pl-9 bg-crm-bg border-crm-border text-crm-text placeholder:text-crm-muted"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-crm-surface border-b border-crm-border">
            <tr className="text-left text-xs text-crm-muted uppercase tracking-wider">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Telefon</th>
              <th className="px-4 py-3 font-medium">Lead</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} className="border-b border-crm-border hover:bg-crm-bg/50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-crm-border flex items-center justify-center text-xs font-medium">
                      {(c.first_name[0] || "") + (c.last_name[0] || "")}
                    </div>
                    <span className="text-sm font-medium">{c.first_name} {c.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-crm-muted">{c.position || "—"}</td>
                <td className="px-4 py-3 text-sm">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-crm-primary hover:underline flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {c.email}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-crm-muted">{c.phone || "—"}</td>
                <td className="px-4 py-3">
                  {c.crm_leads && (
                    <Link to={`/crm/leads/${c.crm_leads.id}`} className="text-sm text-crm-primary hover:underline">
                      {c.crm_leads.name}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
