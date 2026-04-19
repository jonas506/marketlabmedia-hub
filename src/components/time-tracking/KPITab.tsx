import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, getISOWeek, isToday, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Profile {
  user_id: string;
  name: string | null;
}

interface MeetingGoal {
  id: string;
  user_id: string;
  period_type: "day" | "week";
  period_date: string;
  title: string;
  emoji: string | null;
  is_completed: boolean;
  sort_order: number;
}

interface KPITabProps {
  profiles: Profile[];
}

const QUICK_EMOJIS = ["🎯", "🎬", "✍️", "📩", "📊", "🎨", "🚀", "💡", "📞", "📈", "✂️", "🎙️"];

export default function KPITab({ profiles }: KPITabProps) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [periodType, setPeriodType] = useState<"day" | "week">("week");
  const [refDate, setRefDate] = useState<Date>(new Date());

  const periodDate = useMemo(() => {
    if (periodType === "week") return startOfWeek(refDate, { weekStartsOn: 1 });
    const d = new Date(refDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [refDate, periodType]);

  const periodDateStr = format(periodDate, "yyyy-MM-dd");

  const { data: goals = [] } = useQuery({
    queryKey: ["meeting-goals", periodType, periodDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_goals" as any)
        .select("*")
        .eq("period_type", periodType)
        .eq("period_date", periodDateStr)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as MeetingGoal[];
    },
  });

  const goalsByUser = useMemo(() => {
    const map = new Map<string, MeetingGoal[]>();
    for (const p of profiles) map.set(p.user_id, []);
    for (const g of goals) {
      if (!map.has(g.user_id)) map.set(g.user_id, []);
      map.get(g.user_id)!.push(g);
    }
    return map;
  }, [goals, profiles]);

  const navigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) return setRefDate(new Date());
    setRefDate(periodType === "week" ? addWeeks(refDate, dir) : addDays(refDate, dir));
  };

  const periodLabel = useMemo(() => {
    if (periodType === "week") {
      const weekNo = getISOWeek(periodDate);
      const end = addDays(periodDate, 6);
      return `KW ${weekNo} · ${format(periodDate, "dd.MM.")} – ${format(end, "dd.MM.yyyy")}`;
    }
    if (isToday(periodDate)) return `Heute, ${format(periodDate, "dd.MM.yyyy")}`;
    return format(periodDate, "EEEE, dd.MM.yyyy", { locale: de });
  }, [periodType, periodDate]);

  const isCurrentPeriod = useMemo(() => {
    const today = new Date();
    if (periodType === "day") return isSameDay(periodDate, today);
    return isSameDay(periodDate, startOfWeek(today, { weekStartsOn: 1 }));
  }, [periodDate, periodType]);

  const addGoal = async (userId: string, title: string, emoji: string) => {
    if (!user) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    const sortOrder = goalsByUser.get(userId)?.length || 0;
    const { error } = await supabase.from("meeting_goals" as any).insert({
      user_id: userId,
      period_type: periodType,
      period_date: periodDateStr,
      title: trimmed,
      emoji,
      sort_order: sortOrder,
      created_by: user.id,
    } as any);
    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }
    qc.invalidateQueries({ queryKey: ["meeting-goals"] });
  };

  const toggleGoal = async (goal: MeetingGoal) => {
    const { error } = await supabase
      .from("meeting_goals" as any)
      .update({
        is_completed: !goal.is_completed,
        completed_at: !goal.is_completed ? new Date().toISOString() : null,
      } as any)
      .eq("id", goal.id);
    if (error) {
      toast.error("Fehler");
      return;
    }
    qc.invalidateQueries({ queryKey: ["meeting-goals"] });
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from("meeting_goals" as any).delete().eq("id", id);
    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }
    qc.invalidateQueries({ queryKey: ["meeting-goals"] });
  };

  const visibleProfiles = isAdmin ? profiles : profiles.filter((p) => p.user_id === user?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={periodType} onValueChange={(v) => setPeriodType(v as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Tag
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Woche
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isCurrentPeriod ? "default" : "outline"}
            size="sm"
            onClick={() => navigate(0)}
            className="h-8 min-w-[210px] justify-center text-xs"
          >
            {periodLabel}
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {visibleProfiles.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Mitarbeiter vorhanden.
        </div>
      ) : (
        <div className={cn(
          "grid gap-4",
          visibleProfiles.length === 1 && "grid-cols-1",
          visibleProfiles.length === 2 && "grid-cols-1 md:grid-cols-2",
          visibleProfiles.length >= 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        )}>
          {visibleProfiles.map((p) => (
            <MemberColumn
              key={p.user_id}
              profile={p}
              goals={goalsByUser.get(p.user_id) || []}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              onAdd={(title, emoji) => addGoal(p.user_id, title, emoji)}
              onToggle={toggleGoal}
              onDelete={deleteGoal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberColumn({
  profile,
  goals,
  isAdmin,
  currentUserId,
  onAdd,
  onToggle,
  onDelete,
}: {
  profile: Profile;
  goals: MeetingGoal[];
  isAdmin: boolean;
  currentUserId?: string;
  onAdd: (title: string, emoji: string) => void;
  onToggle: (g: MeetingGoal) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎯");

  const completed = goals.filter((g) => g.is_completed).length;
  const total = goals.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isOwn = profile.user_id === currentUserId;

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title, emoji);
    setTitle("");
  };

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {(profile.name || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold">{profile.name || "Unbekannt"}</div>
            <div className="text-[11px] text-muted-foreground">
              {total > 0 ? `${completed}/${total} erledigt` : "Keine Ziele"}
            </div>
          </div>
        </div>
        {total > 0 && <div className="text-xs font-bold text-primary">{pct}%</div>}
      </div>

      {total > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="space-y-1.5 min-h-[40px]">
        {goals.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-2 text-center">
            {isAdmin ? "Noch keine Ziele festgelegt" : "Keine Ziele für diese Periode"}
          </div>
        ) : (
          goals.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              canToggle={isAdmin || isOwn}
              canDelete={isAdmin}
              onToggle={() => onToggle(g)}
              onDelete={() => onDelete(g.id)}
            />
          ))
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1.5 pt-2 border-t">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 text-base">
                {emoji}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-6 gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "h-8 w-8 rounded text-lg hover:bg-accent",
                      emoji === e && "bg-accent ring-2 ring-primary"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Ziel hinzufügen..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="h-8 text-sm"
          />
          <Button
            size="icon"
            onClick={handleAdd}
            disabled={!title.trim()}
            className="h-8 w-8 shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function GoalRow({
  goal,
  canToggle,
  canDelete,
  onToggle,
  onDelete,
}: {
  goal: MeetingGoal;
  canToggle: boolean;
  canDelete: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-md border p-2 group transition-colors",
      goal.is_completed ? "bg-muted/40 border-muted" : "bg-background hover:bg-accent/30"
    )}>
      <Checkbox
        checked={goal.is_completed}
        onCheckedChange={onToggle}
        disabled={!canToggle}
        className="shrink-0"
      />
      <span className="text-base shrink-0">{goal.emoji || "🎯"}</span>
      <span className={cn(
        "flex-1 text-sm leading-tight break-words",
        goal.is_completed && "line-through text-muted-foreground"
      )}>
        {goal.title}
      </span>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
