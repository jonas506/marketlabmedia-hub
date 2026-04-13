import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2, Tag, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MagicInputProps {
  onLeadCreated: () => void;
}

export default function MagicInput({ onLeadCreated }: MagicInputProps) {
  const { user } = useAuth();
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);

  // Fetch all unique source values from existing leads
  const { data: existingSources = [] } = useQuery({
    queryKey: ["crm-source-tags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_leads")
        .select("source")
        .not("source", "is", null);
      const tags = new Set<string>();
      data?.forEach((l) => { if (l.source?.trim()) tags.add(l.source.trim()); });
      return Array.from(tags).sort();
    },
  });

  const filteredSources = useMemo(() => {
    if (!source.trim()) return existingSources;
    const q = source.toLowerCase();
    return existingSources.filter(s => s.toLowerCase().includes(q));
  }, [source, existingSources]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) {
        setSourceOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    if (!contactName.trim()) { toast.error("Name fehlt"); return; }
    setSaving(true);
    const { error } = await supabase.from("crm_leads").insert({
      name: companyName.trim() || contactName.trim(),
      contact_name: contactName.trim(),
      source: source.trim() || null,
      stage: "erstkontakt",
      created_by: user!.id,
    });
    setSaving(false);
    if (error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success(`${contactName.trim()} hinzugefügt`);
    setContactName("");
    setCompanyName("");
    setSource("");
    onLeadCreated();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCreate(); }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Neuen Lead erfassen</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Name *"
          value={contactName}
          onChange={e => setContactName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Input
          placeholder="Firma (optional)"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <div ref={sourceRef} className="relative">
          <div className="relative">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Quelle (z.B. LinkedIn)"
              value={source}
              onChange={e => { setSource(e.target.value); setSourceOpen(true); }}
              onFocus={() => setSourceOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setSourceOpen(false); handleCreate(); }
                if (e.key === "Escape") setSourceOpen(false);
              }}
              className="w-[180px] pl-8"
            />
          </div>
          {sourceOpen && filteredSources.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {filteredSources.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-left hover:bg-accent/20 transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); setSource(tag); setSourceOpen(false); }}
                >
                  <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={handleCreate} disabled={saving || !contactName.trim()} size="sm" className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-1">Hinzufügen</span>
        </Button>
      </div>
    </div>
  );
}
