import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Presentation, MoreHorizontal, Copy, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";

interface Props {
  clientId: string;
  canEdit: boolean;
}

const ClientStrategyBoards = ({ clientId, canEdit }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("Neues Board");

  const { data: boards, isLoading } = useQuery({
    queryKey: ["strategy-boards", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategy_boards")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
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
          client_id: clientId,
          created_by: user!.id,
          board_data: {},
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["strategy-boards", clientId] });
      setCreateOpen(false);
      navigate(`/strategy-boards/${data.id}`);
    },
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("strategy_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategy-boards", clientId] });
      toast.success("Board gelöscht");
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold">Strategy Boards</h3>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3" /> Board erstellen
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (boards ?? []).length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <Presentation className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          Noch keine Strategy Boards
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(boards ?? []).map((board, i) => (
            <motion.div key={board.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
              <Card
                className="group relative overflow-hidden cursor-pointer hover:shadow-md transition-all border-border/50"
                onClick={() => navigate(`/strategy-boards/${board.id}`)}
              >
                <div className="h-24 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                  <Presentation className="h-6 w-6 text-primary/30" />
                </div>
                <div className="p-2.5">
                  <h4 className="text-xs font-semibold truncate">{board.title}</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(board.updated_at), "dd.MM.yy HH:mm", { locale: de })}
                  </p>
                </div>
                {canEdit && (
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 bg-background/80 backdrop-blur">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem className="text-destructive text-xs" onClick={() => deleteBoard.mutate(board.id)}>
                          <Trash2 className="h-3 w-3 mr-2" /> Löschen
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Neues Strategy Board</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Board-Titel" className="h-9 text-sm" />
          </div>
          <DialogFooter>
            <Button size="sm" disabled={!newTitle || createBoard.isPending} onClick={() => createBoard.mutate()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientStrategyBoards;
