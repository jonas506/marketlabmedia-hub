import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Plus, Loader2, ExternalLink, Trash2, Star, Clock,
  ChevronDown, ChevronUp, BarChart3, X, Link as LinkIcon, StickyNote,
  ArrowRightLeft,
} from "lucide-react";

interface Inspiration {
  id: string;
  client_id: string;
  url: string | null;
  title: string;
  notes: string;
  screenshot_url: string | null;
  ai_analysis: string | null;
  category: string;
  week_number: number | null;
  month: number | null;
  year: number | null;
  tags: string[];
  created_at: string;
}

interface Props {
  clientId: string;
  clientName: string;
  clientIndustry?: string | null;
  canEdit: boolean;
}

const getWeekNumber = (d: Date): number => {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
};

export default function InspirationBoard({ clientId, clientName, clientIndustry, canEdit }: Props) {
  const qc = useQueryClient();
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addCategory, setAddCategory] = useState<"weekly" | "evergreen">("weekly");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingMonthly, setGeneratingMonthly] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState<string | null>(null);

  const { data: inspirations = [], isLoading } = useQuery({
    queryKey: ["client-inspirations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inspirations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Inspiration[];
    },
  });

  const weeklyItems = useMemo(
    () => inspirations.filter((i) => i.category === "weekly"),
    [inspirations]
  );

  const evergreenItems = useMemo(
    () => inspirations.filter((i) => i.category === "evergreen"),
    [inspirations]
  );

  // Group weekly by week
  const weeklyGrouped = useMemo(() => {
    const groups: Record<string, Inspiration[]> = {};
    weeklyItems.forEach((item) => {
      const key = `KW ${item.week_number || "?"} / ${item.year || "?"}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [weeklyItems]);

  const handleAdd = async () => {
    if (!addUrl.trim() && !addNotes.trim()) return;
    setSaving(true);

    try {
      let title = addUrl || "Notiz";
      let screenshot: string | null = null;
      let analysis: string | null = null;

      // If URL provided, analyze it
      if (addUrl.trim()) {
        toast.info("Analysiere URL…");
        const { data: result, error } = await supabase.functions.invoke("analyze-inspiration", {
          body: { url: addUrl.trim(), client_name: clientName, client_industry: clientIndustry },
        });
        if (!error && result?.success) {
          title = result.title || addUrl;
          screenshot = result.screenshot || null;
          analysis = result.analysis || null;
        }
      }

      const { error } = await supabase.from("client_inspirations").insert({
        client_id: clientId,
        url: addUrl.trim() || null,
        title,
        notes: addNotes.trim(),
        screenshot_url: screenshot,
        ai_analysis: analysis,
        category: addCategory,
        week_number: addCategory === "weekly" ? currentWeek : null,
        month: currentMonth,
        year: currentYear,
        tags: [],
      } as any);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["client-inspirations", clientId] });
      setAddUrl("");
      setAddNotes("");
      setShowAdd(false);
      toast.success("Inspiration gespeichert");
    } catch (err: any) {
      toast.error(err.message || "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_inspirations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["client-inspirations", clientId] });
  };

  const handleToggleCategory = async (item: Inspiration) => {
    const newCat = item.category === "weekly" ? "evergreen" : "weekly";
    await supabase.from("client_inspirations").update({ category: newCat } as any).eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["client-inspirations", clientId] });
    toast.success(newCat === "evergreen" ? "→ Evergreen verschoben" : "→ Wöchentlich verschoben");
  };

  const generateMonthlyReport = async () => {
    setGeneratingMonthly(true);
    setMonthlyReport(null);

    try {
      const monthItems = inspirations.filter(
        (i) => i.month === currentMonth && i.year === currentYear
      );

      if (monthItems.length === 0) {
        toast.error("Keine Inspirationen in diesem Monat");
        return;
      }

      const summaryInput = monthItems
        .map((i) => `- ${i.title}: ${i.notes || ""} ${i.ai_analysis || ""}`.slice(0, 300))
        .join("\n");

      const { data, error } = await supabase.functions.invoke("client-ai-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Du bist ein Social-Media-Stratege. Erstelle eine kompakte Monatsauswertung der gesammelten Inspirationen für den Kunden "${clientName}".

Inspirationen dieses Monats:
${summaryInput}

Erstelle eine Auswertung mit:
1. **Top 3 Muster/Trends** die sich durch die Inspirationen ziehen
2. **Konkrete Empfehlungen** für den nächsten Monat (3-5 actionable Punkte)
3. **Best Practice des Monats**: Die wertvollste Inspiration und warum

Halte es kurz (max 250 Wörter), deutsch, actionable.`,
            },
          ],
          clientId,
          mode: "general",
        },
      });

      if (error) throw error;
      setMonthlyReport(typeof data === "string" ? data : data?.content || data?.message || JSON.stringify(data));
    } catch (err: any) {
      toast.error(err.message || "Fehler bei Auswertung");
    } finally {
      setGeneratingMonthly(false);
    }
  };

  const InspoCard = ({ item }: { item: Inspiration }) => {
    const isExpanded = expandedId === item.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div
          className="flex gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : item.id)}
        >
          {/* Screenshot thumbnail */}
          {item.screenshot_url ? (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted shrink-0">
              <img src={item.screenshot_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-muted/50 shrink-0 flex items-center justify-center">
              {item.url ? <LinkIcon className="h-5 w-5 text-muted-foreground/40" /> : <StickyNote className="h-5 w-5 text-muted-foreground/40" />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground truncate">{item.title || "Ohne Titel"}</h4>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.notes}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {item.ai_analysis && (
                <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                  <Sparkles className="h-3 w-3" /> KI-Analyse
                </span>
              )}
              {item.url && (
                <a
                  href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Link
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Expanded view */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border p-3 space-y-3">
                {/* Screenshot full */}
                {item.screenshot_url && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={item.screenshot_url} alt="" className="w-full max-h-64 object-cover" />
                  </div>
                )}

                {/* AI Analysis */}
                {item.ai_analysis && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">KI-Analyse</span>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert text-xs leading-relaxed">
                      <ReactMarkdown>{item.ai_analysis}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground"
                      onClick={() => handleToggleCategory(item)}
                    >
                      <ArrowRightLeft className="h-3 w-3" />
                      {item.category === "weekly" ? "→ Evergreen" : "→ Wöchentlich"}
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-destructive/70 hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3 w-3" /> Löschen
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Inspirationen & Research
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Wöchentlich sammeln, Evergreen bewahren, monatlich auswerten
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? "Schließen" : "Hinzufügen"}
          </Button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setAddCategory("weekly")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    addCategory === "weekly"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Clock className="h-3 w-3 inline mr-1" />
                  Wöchentlich
                </button>
                <button
                  onClick={() => setAddCategory("evergreen")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    addCategory === "evergreen"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Star className="h-3 w-3 inline mr-1" />
                  Evergreen
                </button>
              </div>
              <Input
                placeholder="URL (z.B. Instagram-Profil, Webseite)…"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                className="text-sm"
              />
              <Textarea
                placeholder="Notizen – was genau ist hier gut? Was können wir übernehmen?"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={saving || (!addUrl.trim() && !addNotes.trim())}
                  className="h-8 text-xs gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {saving ? "Analysiere…" : "Speichern & Analysieren"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content tabs */}
      <Tabs defaultValue="weekly">
        <TabsList className="bg-card border border-border h-auto p-0.5 gap-0">
          <TabsTrigger value="weekly" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md">
            <Clock className="h-3.5 w-3.5" />
            Wöchentlich
            {weeklyItems.length > 0 && <span className="text-[10px] opacity-60">({weeklyItems.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="evergreen" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-md">
            <Star className="h-3.5 w-3.5" />
            Evergreen
            {evergreenItems.length > 0 && <span className="text-[10px] opacity-60">({evergreenItems.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs h-8 gap-1.5 px-3 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 rounded-md">
            <BarChart3 className="h-3.5 w-3.5" />
            Auswertung
          </TabsTrigger>
        </TabsList>

        {/* Weekly tab */}
        <TabsContent value="weekly" className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : weeklyGrouped.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Noch keine wöchentlichen Inspirationen. Füge oben die erste hinzu!
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyGrouped.map(([week, items]) => (
                <div key={week}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {week}
                  </h4>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <InspoCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Evergreen tab */}
        <TabsContent value="evergreen" className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : evergreenItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Keine Evergreen-Inspirationen. Verschiebe bewährte Inspos hierher!
            </div>
          ) : (
            <div className="space-y-2">
              {evergreenItems.map((item) => (
                <InspoCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Monthly report tab */}
        <TabsContent value="monthly" className="mt-3">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                KI-Auswertung aller Inspirationen des aktuellen Monats
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={generateMonthlyReport}
                disabled={generatingMonthly}
                className="h-8 text-xs gap-1.5"
              >
                {generatingMonthly ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                {generatingMonthly ? "Erstelle Auswertung…" : "Monatsauswertung generieren"}
              </Button>
            </div>

            {monthlyReport && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <BarChart3 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    Monatsauswertung
                  </span>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                  <ReactMarkdown>{monthlyReport}</ReactMarkdown>
                </div>
              </motion.div>
            )}

            {!monthlyReport && !generatingMonthly && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Klicke auf "Monatsauswertung generieren" für eine KI-Zusammenfassung
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
