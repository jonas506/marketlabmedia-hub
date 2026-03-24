import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Plus, Search, Presentation, MoreHorizontal, Pencil, Copy, Trash2, LayoutDashboard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const TEMPLATE_CATEGORIES = [
  { value: "blank", label: "Leer" },
  { value: "funnel", label: "Funnel" },
  { value: "journey", label: "Customer Journey" },
  { value: "content", label: "Content Plan" },
  { value: "strategy", label: "Strategie" },
];

const StrategyBoards = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("Neues Board");
  const [newClientId, setNewClientId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  const canEdit = role === "admin" || role === "head_of_content";

  const { data: boards, isLoading } = useQuery({
    queryKey: ["strategy-boards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategy_boards")
        .select("*, clients(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createBoard = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("strategy_boards")
        .insert({
          title: newTitle,
          client_id: newClientId,
          created_by: user!.id,
          template_type: selectedTemplate,
          board_data: {},
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["strategy-boards"] });
      setCreateOpen(false);
      navigate(`/strategy-boards/${data.id}`);
    },
    onError: () => toast.error("Board konnte nicht erstellt werden"),
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("strategy_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategy-boards"] });
      toast.success("Board gelöscht");
    },
  });

  const duplicateBoard = useMutation({
    mutationFn: async (board: any) => {
      const { error } = await supabase.from("strategy_boards").insert({
        title: `${board.title} (Kopie)`,
        client_id: board.client_id,
        created_by: user!.id,
        board_data: board.board_data,
        template_type: board.template_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategy-boards"] });
      toast.success("Board dupliziert");
    },
  });

  const filtered = (boards ?? []).filter((b) => {
    if (clientFilter !== "all" && b.client_id !== clientFilter) return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <ErrorBoundary level="section">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold tracking-tight">Strategy Boards</h1>
          </div>
          {canEdit && (
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Neues Board
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Board suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
              <SelectValue placeholder="Alle Kunden" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kunden</SelectItem>
              {(clients ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Board Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutDashboard className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Noch keine Boards vorhanden</p>
            {canEdit && (
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Board erstellen
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((board, i) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  className="group relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-border/50"
                  onClick={() => navigate(`/strategy-boards/${board.id}`)}
                >
                  <div className="h-32 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                    {board.thumbnail ? (
                      <img src={board.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Presentation className="h-8 w-8 text-primary/30" />
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-display text-sm font-semibold truncate">{board.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {board.clients?.name ?? "Kein Kunde"} · {format(new Date(board.updated_at), "dd.MM.yy", { locale: de })}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => duplicateBoard.mutate(board)}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplizieren
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteBoard.mutate(board.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neues Strategy Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium mb-1.5 block">Board-Titel</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Kunde</label>
                <Select value={newClientId} onValueChange={setNewClientId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Kunde wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_CATEGORIES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setSelectedTemplate(t.value)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        selectedTemplate === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                size="sm"
                disabled={!newClientId || !newTitle || createBoard.isPending}
                onClick={() => createBoard.mutate()}
              >
                {createBoard.isPending ? "Erstelle..." : "Board erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
};

export default StrategyBoards;
