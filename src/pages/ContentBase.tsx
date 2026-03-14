import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const CATEGORIES = [
  { value: "all", label: "Alle" },
  { value: "tonality", label: "Tonalität", color: "bg-blue-500/15 text-blue-400" },
  { value: "zielgruppe", label: "Zielgruppe", color: "bg-green-500/15 text-green-400" },
  { value: "wettbewerb", label: "Wettbewerb", color: "bg-orange-500/15 text-orange-400" },
  { value: "strategie", label: "Strategie", color: "bg-purple-500/15 text-purple-400" },
  { value: "produkt", label: "Produkt", color: "bg-pink-500/15 text-pink-400" },
  { value: "sonstiges", label: "Sonstiges", color: "bg-muted text-muted-foreground" },
];

const getCategoryConfig = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];

const ContentBase = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["content-base-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_knowledge")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return entries.filter((e: any) => {
      const matchSearch =
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.content.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "all" || e.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [entries, search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; clientId: string; items: any[] }>();
    for (const e of filtered) {
      const clientId = e.client_id;
      const clientName = (e as any).clients?.name ?? "Unbekannt";
      if (!map.has(clientId)) map.set(clientId, { name: clientName, clientId, items: [] });
      map.get(clientId)!.items.push(e);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const toggleClient = (id: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Content Base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zentrale Wissensdatenbank aller Kunden – {entries.length} Einträge
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche in allen Einträgen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-surface-elevated border-border/50"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Keine Einträge gefunden.
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.map((group) => {
              const isOpen = expandedClients.has(group.clientId);
              return (
                <div key={group.clientId} className="rounded-lg border border-border/50 bg-card overflow-hidden">
                  <button
                    onClick={() => toggleClient(group.clientId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-semibold text-foreground">{group.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {group.items.length}
                    </Badge>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/30">
                          {group.items.map((item: any) => {
                            const catConfig = getCategoryConfig(item.category);
                            return (
                              <div
                                key={item.id}
                                className="px-4 py-3 border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm text-foreground truncate">
                                        {item.title}
                                      </span>
                                      <Badge className={`text-[10px] px-1.5 py-0 ${catConfig.color} border-0`}>
                                        {catConfig.label}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {item.content}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-muted-foreground/60">
                                      {format(new Date(item.created_at), "dd. MMM yy", { locale: de })}
                                    </span>
                                    <Link
                                      to={`/client/${group.clientId}`}
                                      className="text-muted-foreground/40 hover:text-primary transition-colors"
                                      title="Zum Kunden"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
    </AppLayout>
  );
};

export default ContentBase;
