import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CRM_SOURCES } from "@/lib/crm-constants";

interface MagicInputProps {
  onLeadCreated: () => void;
}

export default function MagicInput({ onLeadCreated }: MagicInputProps) {
  const { user } = useAuth();
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState<string>("outreach");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!contactName.trim()) { toast.error("Name fehlt"); return; }
    setSaving(true);
    const { error } = await supabase.from("crm_leads").insert({
      name: companyName.trim() || contactName.trim(),
      contact_name: contactName.trim(),
      source,
      stage: "erstkontakt",
      created_by: user!.id,
    });
    setSaving(false);
    if (error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success(`${contactName.trim()} hinzugefügt`);
    setContactName("");
    setCompanyName("");
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
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_SOURCES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCreate} disabled={saving || !contactName.trim()} size="sm" className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-1">Hinzufügen</span>
        </Button>
      </div>
    </div>
  );
}
