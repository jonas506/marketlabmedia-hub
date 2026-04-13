import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2, Tag, X, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface MagicInputProps {
  onLeadCreated: () => void;
}

const TAG_COLORS = [
  "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

export default function MagicInput({ onLeadCreated }: MagicInputProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);

  const { data: sourceTags = [] } = useQuery({
    queryKey: ["crm-source-tags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_source_tags")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) {
        setSourceOpen(false);
        setAddingTag(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const color = TAG_COLORS[sourceTags.length % TAG_COLORS.length];
    const { error } = await supabase.from("crm_source_tags").insert({
      name: newTagName.trim(),
      color,
      created_by: user!.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("Quelle existiert bereits");
      else toast.error("Fehler beim Erstellen");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["crm-source-tags"] });
    setSelectedSource(newTagName.trim());
    setNewTagName("");
    setAddingTag(false);
    toast.success(`Quelle „${newTagName.trim()}" erstellt`);
  };

  const handleCreate = async () => {
    if (!contactName.trim()) { toast.error("Name fehlt"); return; }
    setSaving(true);
    const { error } = await supabase.from("crm_leads").insert({
      name: companyName.trim() || contactName.trim(),
      contact_name: contactName.trim(),
      source: selectedSource || null,
      stage: "erstkontakt",
      created_by: user!.id,
    });
    setSaving(false);
    if (error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success(`${contactName.trim()} hinzugefügt`);
    setContactName("");
    setCompanyName("");
    setSelectedSource(null);
    onLeadCreated();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCreate(); }
  };

  const selectedTag = sourceTags.find(t => t.name === selectedSource);

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Neuen Lead erfassen</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 items-start">
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

        {/* Source tag picker */}
        <div ref={sourceRef} className="relative">
          <button
            type="button"
            onClick={() => setSourceOpen(!sourceOpen)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent/10 transition-colors min-w-[150px]"
          >
            <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {selectedTag ? (
              <span className="flex items-center gap-1.5 flex-1">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: selectedTag.color }} />
                <span className="truncate">{selectedTag.name}</span>
                <X
                  className="h-3 w-3 ml-auto text-muted-foreground hover:text-foreground shrink-0"
                  onClick={(e) => { e.stopPropagation(); setSelectedSource(null); }}
                />
              </span>
            ) : (
              <span className="text-muted-foreground">Quelle</span>
            )}
          </button>

          {sourceOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 w-52 rounded-md border border-border bg-popover shadow-lg">
              <div className="max-h-48 overflow-y-auto p-1">
                {sourceTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-accent/20 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedSource(tag.name);
                      setSourceOpen(false);
                    }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                    {tag.name}
                    {selectedSource === tag.name && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                ))}
                {sourceTags.length === 0 && !addingTag && (
                  <p className="text-xs text-muted-foreground px-2.5 py-2">Noch keine Quellen</p>
                )}
              </div>

              <div className="border-t border-border p-1">
                {addingTag ? (
                  <div className="flex items-center gap-1 px-1">
                    <Input
                      autoFocus
                      placeholder="Neue Quelle…"
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); }
                        if (e.key === "Escape") { setAddingTag(false); setNewTagName(""); }
                      }}
                      className="h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-primary hover:bg-accent/20 rounded transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); setAddingTag(true); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Neue Quelle erstellen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleCreate} disabled={saving || !contactName.trim()} size="sm" className="shrink-0 h-9">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-1">Hinzufügen</span>
        </Button>
      </div>
    </div>
  );
}
