import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Trash2, Globe, Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "gespraech", label: "Gespräch", color: "bg-blue-500/15 text-blue-500" },
  { value: "website", label: "Website", color: "bg-emerald-500/15 text-emerald-500" },
  { value: "ads", label: "Ads", color: "bg-purple-500/15 text-purple-400" },
  { value: "content", label: "Content", color: "bg-amber-500/15 text-amber-400" },
  { value: "produkt", label: "Produkt/Service", color: "bg-rose-500/15 text-rose-400" },
  { value: "markt", label: "Markt/Wettbewerb", color: "bg-cyan-500/15 text-cyan-400" },
  { value: "sonstiges", label: "Sonstiges", color: "bg-muted text-muted-foreground" },
];

const getCategoryConfig = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

interface KnowledgeBaseProps {
  clientId: string;
  canEdit: boolean;
  websiteUrl?: string | null;
}

const KnowledgeBase = ({ clientId, canEdit, websiteUrl }: KnowledgeBaseProps) => {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["client-knowledge", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_knowledge")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = entries.filter((e: any) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addEntry = async () => {
    if (!content.trim()) return;
    setSaving(true);
    // Auto-generate title from first line or first 50 chars
    const autoTitle = content.trim().split("\n")[0].slice(0, 80) || "Eintrag";
    const { error } = await supabase.from("client_knowledge").insert({
      client_id: clientId,
      title: autoTitle,
      content: content.trim(),
      category: "sonstiges",
      source_url: null,
    });
    setSaving(false);
    if (error) toast.error("Fehler beim Speichern");
    else {
      toast.success("Eintrag hinzugefügt");
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
      setContent("");
      setShowAdd(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return;
    const { error } = await supabase.from("client_knowledge").delete().eq("id", id);
    if (error) toast.error("Fehler");
    else {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
    }
  };

  const scrapeWebsite = async () => {
    const url = websiteUrl;
    if (!url) { toast.error("Keine Website-URL beim Kunden hinterlegt"); return; }
    setScraping(true);
    try {
      const resp = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url, options: { formats: ["markdown"], onlyMainContent: true } },
      });
      if (resp.error) throw resp.error;
      const md = resp.data?.data?.markdown || resp.data?.data?.content || "";
      if (!md) throw new Error("Kein Content gefunden");

      await supabase.from("client_knowledge").insert({
        client_id: clientId,
        title: `Website: ${url}`,
        content: md.slice(0, 30000),
        category: "website",
        source_url: url,
      });
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
      toast.success("Website importiert!");
    } catch (err: any) {
      toast.error("Scraping fehlgeschlagen", { description: err.message });
    } finally {
      setScraping(false);
    }
  };

  const resetForm = () => {
    setShowAdd(false);
    setContent("");
  };

  const usedCategories = [...new Set(entries.map((e: any) => e.category))];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={categoryFilter === null ? "default" : "outline"}
            className="h-7 text-[10px] px-2"
            onClick={() => setCategoryFilter(null)}
          >
            Alle ({entries.length})
          </Button>
          {usedCategories.map((cat) => {
            const cfg = getCategoryConfig(cat);
            return (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? "default" : "outline"}
                className="h-7 text-[10px] px-2"
                onClick={() => setCategoryFilter(cat)}
              >
                {cfg.label}
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {websiteUrl && canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] gap-1"
              onClick={scrapeWebsite}
              disabled={scraping}
            >
              {scraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Website importieren
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setShowAdd(true)}>
              <Plus className="h-3 w-3" /> Eintrag
            </Button>
          )}
        </div>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {entries.length === 0 ? "Noch keine Einträge. Füge Wissen über deinen Kunden hinzu." : "Keine Einträge gefunden"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {filtered.map((entry: any) => {
              const cfg = getCategoryConfig(entry.category);
              const isExpanded = expandedId === entry.id;
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "rounded-lg border transition-colors",
                    isExpanded ? "border-primary/20 bg-card" : "border-border bg-card/60"
                  )}
                >
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <Badge variant="secondary" className={cn("text-[9px] font-mono px-1.5 py-0 h-[18px] rounded border-0 shrink-0", cfg.color)}>
                      {cfg.label}
                    </Badge>
                    <span className="text-sm font-medium truncate flex-1">{entry.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {format(new Date(entry.created_at), "dd. MMM", { locale: de })}
                    </span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-border/50 pt-2">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                            {entry.content}
                          </p>
                          {entry.source_url && (
                            <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-2 block">
                              {entry.source_url}
                            </a>
                          )}
                          {canEdit && (
                            <div className="flex justify-end mt-2">
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => deleteEntry(entry.id)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Löschen
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Wissen hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Titel</Label>
              <Input placeholder="z.B. Call-Notizen 15.03." value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Inhalt</Label>
              <Textarea
                placeholder="Alle relevanten Informationen hier einfügen..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quelle (optional)</Label>
              <Input placeholder="URL oder Referenz" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Abbrechen</Button>
            <Button onClick={addEntry} disabled={!title.trim() || !content.trim() || saving}>
              {saving ? "Speichern…" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBase;
