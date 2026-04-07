import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { differenceInDays, parseISO, format, addMonths } from "date-fns";
import { de } from "date-fns/locale";
import { Link } from "react-router-dom";
import { CalendarRange, AlertTriangle, ChevronRight, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ContractRunwayWidget() {
  const { data: clients } = useClients();
  const queryClient = useQueryClient();
  const now = new Date();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const urgent = (clients ?? [])
    .filter((c) => c.contract_start)
    .map((c) => {
      let end: Date;
      if ((c as any).contract_end) {
        end = parseISO((c as any).contract_end);
      } else if (c.contract_duration) {
        const months = parseInt(c.contract_duration) || 12;
        end = new Date(parseISO(c.contract_start!));
        end.setMonth(end.getMonth() + months);
      } else {
        end = new Date(parseISO(c.contract_start!));
        end.setMonth(end.getMonth() + 12);
      }
      const remainingDays = differenceInDays(end, now);
      const start = parseISO(c.contract_start!);
      const totalDays = differenceInDays(end, start);
      const progress = totalDays > 0 ? Math.min(Math.max(differenceInDays(now, start) / totalDays, 0), 1) : 0;
      const endDate = end;
      return { ...c, remainingDays, progress, endDate };
    })
    .filter((c) => c.remainingDays <= 90)
    .sort((a, b) => a.remainingDays - b.remainingDays);

  if (urgent.length === 0) return null;

  const nextEnd = urgent[0];

  const getColor = (d: number) => {
    if (d <= 0) return "bg-destructive";
    if (d <= 30) return "bg-orange-500";
    return "bg-yellow-500";
  };

  const startEdit = (clientId: string, currentEnd: Date) => {
    setEditingId(clientId);
    setEditValue(format(currentEnd, "yyyy-MM-dd"));
  };

  const saveEdit = async (clientId: string) => {
    if (!editValue) return;
    const { error } = await supabase
      .from("clients")
      .update({ contract_end: editValue })
      .eq("id", clientId);
    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Vertragsdatum aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-dashboard"] });
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Vertragslaufzeiten</h3>
          {urgent.some((c) => c.remainingDays <= 30) && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            Nächstes Ende: <span className="font-medium text-foreground">{nextEnd.name}</span> am{" "}
            <span className={`font-medium ${nextEnd.remainingDays <= 30 ? "text-orange-500" : "text-foreground"}`}>
              {format(nextEnd.endDate, "dd. MMM yyyy", { locale: de })}
            </span>
          </span>
          <Link
            to="/contracts"
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Alle <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="space-y-2">
        {urgent.slice(0, 5).map((client) => (
          <div key={client.id} className="flex items-center gap-3 group">
            <Link to={`/clients/${client.id}`} className="w-24 truncate text-xs font-medium hover:text-primary transition-colors">
              {client.name}
            </Link>
            <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={`h-full rounded-full ${getColor(client.remainingDays)} transition-all`}
                style={{ width: `${Math.max(client.progress * 100, 4)}%`, opacity: 0.8 }}
              />
            </div>
            <AnimatePresence mode="wait">
              {editingId === client.id ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-1"
                >
                  <Input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-6 text-[10px] w-28 px-1"
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveEdit(client.id)}>
                    <Check className="h-3 w-3 text-green-500" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={cancelEdit}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="display" className="flex items-center gap-1">
                  <span className={`text-[11px] tabular-nums text-right ${
                    client.remainingDays <= 0 ? "text-destructive font-semibold" :
                    client.remainingDays <= 30 ? "text-orange-500" : "text-muted-foreground"
                  }`}>
                    {format(client.endDate, "dd.MM.yy")}
                  </span>
                  <button
                    onClick={() => startEdit(client.id, client.endDate)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                  >
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
