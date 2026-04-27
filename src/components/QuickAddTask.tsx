import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

const QuickAddTask = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-names"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name");
      return data ?? [];
    },
  });

  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", roles.map(r => r.user_id));
      return profiles ?? [];
    },
  });

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await supabase.from("tasks" as any).insert({
        title: title.trim(),
        client_id: clientId || clients[0]?.id || "",
        assigned_to: assignedTo || user?.id || null,
        deadline: deadline ? format(deadline, "yyyy-MM-dd") : null,
        priority,
        status: "not_started",
        created_by: user?.id || null,
      } as any);
      toast.success("Aufgabe erstellt");
      setTitle("");
      setClientId("");
      setAssignedTo("");
      setDeadline(undefined);
      setPriority("normal");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["all-tasks-page"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch {
      toast.error("Fehler beim Erstellen");
    }
    setSaving(false);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
        title="Neue Aufgabe (Cmd+Shift+T)"
      >
        <Plus className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-24px)] rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Neue Aufgabe</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Aufgabentitel…"
              className="font-body"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && title.trim()) handleSave(); }}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="min-h-[44px] text-xs">
                  <SelectValue placeholder="Kunde…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="min-h-[44px] text-xs">
                  <SelectValue placeholder="Zuweisen…" />
                </SelectTrigger>
                <SelectContent>
                  {team.map((t: any) => (
                    <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 justify-start gap-2 text-xs sm:h-9 sm:min-h-9">
                    <CalendarIcon className="h-3 w-3" />
                    {deadline ? format(deadline, "dd. MMM", { locale: de }) : "Deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} locale={de} />
                </PopoverContent>
              </Popover>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 min-h-[44px] text-xs sm:h-9 sm:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)} className="w-full font-mono text-xs sm:w-auto">Abbrechen</Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving} className="w-full font-mono text-xs sm:w-auto">
              {saving ? "Erstelle…" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickAddTask;
