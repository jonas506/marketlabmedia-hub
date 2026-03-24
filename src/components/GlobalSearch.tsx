import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, ClipboardList, BookOpen, BookmarkIcon, Database,
  BarChart3, Briefcase, Presentation, CalendarRange, CheckSquare, Activity,
  Building2, Film, Images, Megaphone, Youtube, Search, Loader2, Plus, Zap,
} from "lucide-react";

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

const NAV_ITEMS = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Aufgaben", to: "/tasks", icon: CheckSquare },
  { label: "Aktivität", to: "/activity", icon: Activity, roles: ["admin", "head_of_content"] },
  { label: "Checklisten", to: "/checklists", icon: ClipboardList, roles: ["admin", "head_of_content"] },
  { label: "SOPs", to: "/sops", icon: BookOpen, roles: ["admin", "head_of_content"] },
  { label: "Prompts", to: "/prompts", icon: BookmarkIcon, roles: ["admin", "head_of_content"] },
  { label: "Content Base", to: "/content-base", icon: Database },
  { label: "Strategy Boards", to: "/strategy-boards", icon: Presentation, roles: ["admin", "head_of_content"] },
  { label: "Marketing", to: "/marketing", icon: BarChart3, roles: ["admin", "head_of_content"] },
  { label: "CRM", to: "/crm", icon: Briefcase, roles: ["admin"] },
  { label: "Verträge", to: "/contracts", icon: CalendarRange, roles: ["admin"] },
  { label: "Team", to: "/team", icon: Users, roles: ["admin"] },
];

const PIECE_ICONS: Record<string, React.ComponentType<any>> = {
  reel: Film, carousel: Images, ad: Megaphone, youtube_longform: Youtube,
};

const PIECE_LABELS: Record<string, string> = {
  reel: "Reel", carousel: "Karussell", ad: "Ad", youtube_longform: "YouTube",
};

const PHASE_LABELS: Record<string, string> = {
  script: "Skript", filmed: "Gedreht", editing: "Schnitt", review: "Freigabe",
  feedback: "Feedback", approved: "Freigegeben", handed_over: "Übergeben",
};

function getRecentClients(): { id: string; name: string }[] {
  try {
    return JSON.parse(localStorage.getItem("mlm_recent_clients") || "[]");
  } catch { return []; }
}

function saveRecentClient(id: string, name: string) {
  const recent = getRecentClients().filter(c => c.id !== id);
  recent.unshift({ id, name });
  localStorage.setItem("mlm_recent_clients", JSON.stringify(recent.slice(0, 5)));
}

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const navigate = useNavigate();
  const { role } = useAuth();
  const searching = debouncedQuery.length >= 2;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((to: string, clientInfo?: { id: string; name: string }) => {
    setOpen(false);
    setQuery("");
    if (clientInfo) saveRecentClient(clientInfo.id, clientInfo.name);
    navigate(to);
  }, [navigate]);

  const filteredNav = NAV_ITEMS.filter(i => !i.roles || (role && i.roles.includes(role)));

  // --- Queries ---
  const { data: clientResults = [], isFetching: f1 } = useQuery({
    queryKey: ["search-clients", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, industry, logo_url, status")
        .or(`name.ilike.%${debouncedQuery}%,contact_name.ilike.%${debouncedQuery}%,industry.ilike.%${debouncedQuery}%`)
        .limit(5);
      return data ?? [];
    },
    enabled: searching,
  });

  const { data: pieceResults = [], isFetching: f2 } = useQuery({
    queryKey: ["search-pieces", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("content_pieces").select("id, title, type, phase, client_id")
        .or(`title.ilike.%${debouncedQuery}%,tag.ilike.%${debouncedQuery}%`)
        .not("phase", "eq", "handed_over").limit(8);
      if (!data?.length) return [];
      const ids = [...new Set(data.map(p => p.client_id))];
      const { data: cl } = await supabase.from("clients").select("id, name").in("id", ids);
      const m = Object.fromEntries((cl ?? []).map(c => [c.id, c.name]));
      return data.map(p => ({ ...p, client_name: m[p.client_id] || "—" }));
    },
    enabled: searching,
  });

  const { data: taskResults = [], isFetching: f3 } = useQuery({
    queryKey: ["search-tasks", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id, title, client_id, status")
        .ilike("title", `%${debouncedQuery}%`).eq("is_completed", false).limit(5);
      if (!data?.length) return [];
      const ids = [...new Set(data.map(t => t.client_id))];
      const { data: cl } = await supabase.from("clients").select("id, name").in("id", ids);
      const m = Object.fromEntries((cl ?? []).map(c => [c.id, c.name]));
      return data.map(t => ({ ...t, client_name: m[t.client_id] || "—" }));
    },
    enabled: searching,
  });

  const { data: sopResults = [], isFetching: f4 } = useQuery({
    queryKey: ["search-sops", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("sop_templates").select("id, name, category")
        .or(`name.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%`).limit(5);
      return data ?? [];
    },
    enabled: searching,
  });

  const { data: promptResults = [], isFetching: f5 } = useQuery({
    queryKey: ["search-prompts", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("saved_prompts").select("id, name, category")
        .or(`name.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%`).limit(5);
      return data ?? [];
    },
    enabled: searching,
  });

  const { data: boardResults = [], isFetching: f6 } = useQuery({
    queryKey: ["search-boards", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("strategy_boards").select("id, title, client_id")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%`).limit(5);
      if (!data?.length) return [];
      const ids = [...new Set(data.map(b => b.client_id))];
      const { data: cl } = await supabase.from("clients").select("id, name").in("id", ids);
      const m = Object.fromEntries((cl ?? []).map(c => [c.id, c.name]));
      return data.map(b => ({ ...b, client_name: m[b.client_id] || "—" }));
    },
    enabled: searching,
  });

  const { data: knowledgeResults = [], isFetching: f7 } = useQuery({
    queryKey: ["search-knowledge", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase.from("client_knowledge").select("id, title, category, client_id")
        .or(`title.ilike.%${debouncedQuery}%,content.ilike.%${debouncedQuery}%`).limit(5);
      if (!data?.length) return [];
      const ids = [...new Set(data.map(k => k.client_id))];
      const { data: cl } = await supabase.from("clients").select("id, name").in("id", ids);
      const m = Object.fromEntries((cl ?? []).map(c => [c.id, c.name]));
      return data.map(k => ({ ...k, client_name: m[k.client_id] || "—" }));
    },
    enabled: searching,
  });

  // Recent clients for empty state
  const { data: recentOrDefaultClients = [] } = useQuery({
    queryKey: ["search-recent-clients"],
    queryFn: async () => {
      const recent = getRecentClients();
      if (recent.length > 0) return recent;
      const { data } = await supabase.from("clients").select("id, name").order("name").limit(5);
      return (data ?? []).map(c => ({ id: c.id, name: c.name }));
    },
    enabled: open,
  });

  const isSearching = searching && (f1 || f2 || f3 || f4 || f5 || f6 || f7);
  const hasResults = searching && (clientResults.length + pieceResults.length + taskResults.length + sopResults.length + promptResults.length + boardResults.length + knowledgeResults.length) > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Suchen… (⌘K)"
        value={query}
        onValueChange={setQuery}
        className="font-body"
      />
      <CommandList className="max-h-[400px]">
        {searching && !isSearching && !hasResults && (
          <CommandEmpty className="py-8 text-center">
            <span className="text-muted-foreground font-body text-sm">
              Keine Ergebnisse für „{query}"
            </span>
          </CommandEmpty>
        )}

        {isSearching && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground font-mono">Suche…</span>
          </div>
        )}

        {/* Search results */}
        {searching && clientResults.length > 0 && (
          <CommandGroup heading="Kunden">
            {clientResults.map(c => (
              <CommandItem key={c.id} onSelect={() => handleSelect(`/client/${c.id}`, { id: c.id, name: c.name })}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-body text-sm truncate block">{c.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{c.industry || "Kunde"} · {c.status === "active" ? "aktiv" : c.status}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searching && pieceResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Content Pieces">
              {pieceResults.map(p => {
                const Icon = PIECE_ICONS[p.type] || Film;
                return (
                  <CommandItem key={p.id} onSelect={() => handleSelect(`/client/${p.client_id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-body text-sm truncate block">{p.title || "Ohne Titel"} — {p.client_name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{PIECE_LABELS[p.type] || p.type} · {PHASE_LABELS[p.phase] || p.phase}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {searching && taskResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Aufgaben">
              {taskResults.map(t => (
                <CommandItem key={t.id} onSelect={() => handleSelect(`/client/${t.client_id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-body text-sm truncate block">{t.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.client_name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {searching && sopResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="SOPs">
              {sopResults.map(s => (
                <CommandItem key={s.id} onSelect={() => handleSelect("/sops")}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-body text-sm truncate block">{s.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{s.category || "SOP"}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {searching && promptResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Prompts">
              {promptResults.map(p => (
                <CommandItem key={p.id} onSelect={() => handleSelect("/prompts")}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <BookmarkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-body text-sm truncate block">{p.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.category || "Prompt"}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {searching && boardResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Strategy Boards">
              {boardResults.map(b => (
                <CommandItem key={b.id} onSelect={() => handleSelect(`/strategy-boards/${b.id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <Presentation className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-body text-sm truncate block">{b.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{b.client_name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {searching && knowledgeResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Knowledge Base">
              {knowledgeResults.map(k => (
                <CommandItem key={k.id} onSelect={() => handleSelect(`/client/${k.client_id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-body text-sm truncate block">{k.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{k.client_name} · {k.category}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Empty state: navigation, recent clients, quick actions */}
        {!searching && (
          <>
            <CommandGroup heading="Schnellaktionen">
              {(role === "admin" || role === "head_of_content") && (
                <CommandItem onSelect={() => handleSelect("/tasks")} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-body text-sm">Neue Aufgabe erstellen</span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
            {recentOrDefaultClients.length > 0 && (
              <>
                <CommandGroup heading="Letzte Kunden">
                  {recentOrDefaultClients.map(c => (
                    <CommandItem key={c.id} onSelect={() => handleSelect(`/client/${c.id}`, c)}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-body text-sm">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading="Seiten">
              {filteredNav.map(item => (
                <CommandItem key={item.to} onSelect={() => handleSelect(item.to)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-body text-sm">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
