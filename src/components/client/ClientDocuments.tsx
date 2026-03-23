import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Plus, Trash2, Globe, Loader2, Search,
  X, MessageSquare, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "gespraech", label: "Gespräch", icon: MessageSquare, color: "text-blue-400 bg-blue-500/10" },
  { value: "website", label: "Website", icon: Globe, color: "text-emerald-400 bg-emerald-500/10" },
  { value: "ads", label: "Ads", icon: FileText, color: "text-purple-400 bg-purple-500/10" },
  { value: "content", label: "Content", icon: FileText, color: "text-amber-400 bg-amber-500/10" },
  { value: "produkt", label: "Produkt", icon: FileText, color: "text-rose-400 bg-rose-500/10" },
  { value: "sonstiges", label: "Sonstiges", icon: FileText, color: "text-muted-foreground bg-muted" },
];

const getCat = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

interface Props {
  clientId: string;
  canEdit: boolean;
  websiteUrl?: string | null;
}

const ClientDocuments = ({ clientId, canEdit, websiteUrl }: Props) => {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("sonstiges");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
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

  const filtered = docs.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.title.toLowerCase().includes(s) || d.content.toLowerCase().includes(s);
  });

  const addDoc = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const autoTitle = title.trim() || content.trim().split("\n")[0].slice(0, 80) || "Dokument";
    const { error } = await supabase.from("client_knowledge").insert({
      client_id: clientId,
      title: autoTitle,
      content: content.trim(),
      category,
      source_url: sourceUrl.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Dokument hinzugefügt");
    qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
    setTitle(""); setContent(""); setCategory("sonstiges"); setSourceUrl(""); setShowAdd(false);
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    const { error } = await supabase.from("client_knowledge").delete().eq("id", id);
    if (error) { toast.error("Fehler"); return; }
    toast.success("Gelöscht");
    if (expandedId === id) setExpandedId(null);
    qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
  };

  const scrapeWebsite = async () => {
    if (!websiteUrl) { toast.error("Keine Website-URL hinterlegt"); return; }
    setScraping(true);
    try {
      const resp = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: websiteUrl, options: { formats: ["markdown"], onlyMainContent: true } },
      });
      if (resp.error) throw resp.error;
      const md = resp.data?.data?.markdown || resp.data?.data?.content || "";
      if (!md) throw new Error("Kein Content gefunden");
      await supabase.from("client_knowledge").insert({
        client_id: clientId,
        title: `Website: ${websiteUrl}`,
        content: md.slice(0, 30000),
        category: "website",
        source_url: websiteUrl,
      });
      qc.invalidateQueries({ queryKey: ["client-knowledge", clientId] });
      toast.success("Website importiert!");
    } catch (err: any) {
      toast.error("Scraping fehlgeschlagen", { description: err.message });
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
            <FileText className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold">Dokumente</h2>
            <p className="text-[11px] text-muted-foreground">{docs.length} Einträge</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {websiteUrl && canEdit && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={scrapeWebsite} disabled={scraping}>
              {scraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Website importieren
            </Button>
          )}
          {canEdit && (
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showAdd ? "Abbrechen" : "Hinzufügen"}
            </Button>
          )}
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && canEdit && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <Input
                  placeholder="Titel (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-xs flex-1"
                />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Inhalt: Notizen, Transkriptionen, Texte…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] text-xs resize-none"
                autoFocus
              />
              <Input
                placeholder="Quell-URL (optional)"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="h-9 text-xs"
              />
              <div className="flex justify-end">
                <Button size="sm" className="h-8 text-xs" onClick={addDoc} disabled={!content.trim() || saving}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Speichern
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Dokumente durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <FileText className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">
              {docs.length === 0 ? "Noch keine Dokumente. Füge Wissen über den Kunden hinzu." : "Keine Treffer."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((doc: any) => {
              const cat = getCat(doc.category);
              const Icon = cat.icon;
              const isExpanded = expandedId === doc.id;
              return (
                <div key={doc.id} className="group">
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                      isExpanded && "bg-muted/20"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                  >
                    <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg shrink-0", cat.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(doc.created_at), "dd. MMM yyyy", { locale: de })}
                        {doc.source_url && " · Quelle vorhanden"}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1.5 hover:text-destructive rounded-md hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pl-[60px]">
                          {doc.source_url && (
                            <a
                              href={doc.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mb-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {doc.source_url}
                            </a>
                          )}
                          <div className="text-xs text-foreground/80 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                            {doc.content}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDocuments;
