import { useState, useMemo, useCallback, useEffect } from "react";
import { format, eachDayOfInterval, isWeekend, startOfMonth, endOfMonth, addMonths, subMonths, getDay } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Check, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { VACATION_TYPES, VACATION_STATUS_COLORS, VACATION_STATUS_LABELS } from "@/lib/time-tracking-constants";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function countWorkdays(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
}

export default function VacationTab() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const currentYear = new Date().getFullYear();

  // Form state
  const [vacType, setVacType] = useState("vacation");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [halfDay, setHalfDay] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [startCalOpen, setStartCalOpen] = useState(false);
  const [endCalOpen, setEndCalOpen] = useState(false);

  const isSingleDay = startDate && endDate && format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");
  const computedDays = startDate && endDate ? (halfDay && isSingleDay ? 0.5 : countWorkdays(startDate, endDate)) : 0;

  // Queries
  const { data: budget } = useQuery({
    queryKey: ["vacation-budget", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("vacation_budgets").select("*").eq("user_id", user.id).eq("year", currentYear).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["vacation-requests", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("vacation_requests").select("*").eq("user_id", user.id).order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ["vacation-requests-all"],
    queryFn: async () => {
      const { data } = await supabase.from("vacation_requests").select("*").order("start_date", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allBudgets = [] } = useQuery({
    queryKey: ["vacation-budgets-all", currentYear],
    queryFn: async () => {
      const { data } = await supabase.from("vacation_budgets").select("*").eq("year", currentYear);
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const approvedDays = useMemo(() =>
    myRequests.filter(r => r.status === "approved" && r.type === "vacation" && new Date(r.start_date).getFullYear() === currentYear)
      .reduce((s, r) => s + Number(r.days), 0),
    [myRequests, currentYear]
  );

  const pendingDays = useMemo(() =>
    myRequests.filter(r => r.status === "pending" && r.type === "vacation")
      .reduce((s, r) => s + Number(r.days), 0),
    [myRequests]
  );

  const totalBudget = budget ? Number(budget.total_days) + Number(budget.carry_over_days) : 0;
  const remainingDays = totalBudget - approvedDays;

  const pendingRequests = useMemo(() =>
    allRequests.filter(r => r.status === "pending"),
    [allRequests]
  );

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.name || "Unbekannt";

  const submitRequest = async () => {
    if (!user || !startDate || !endDate || computedDays <= 0) {
      toast.error("Bitte Zeitraum auswählen");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("vacation_requests").insert({
      user_id: user.id,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      days: computedDays,
      type: vacType,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Fehler beim Einreichen"); return; }
    toast.success("Antrag eingereicht");
    setStartDate(undefined);
    setEndDate(undefined);
    setNote("");
    setHalfDay(false);
    qc.invalidateQueries({ queryKey: ["vacation-requests"] });

    // Notify admins
    try {
      const { data: adminUsers } = await supabase.rpc("get_user_role", { _user_id: user.id }) as any;
      // Use profiles to find admins - simplified approach
      const { data: allProfiles } = await supabase.from("profiles").select("user_id");
      if (allProfiles) {
        for (const p of allProfiles) {
          if (p.user_id !== user.id) {
            await supabase.from("notifications").insert({
              user_id: p.user_id,
              type: "vacation_request",
              title: `🏖️ Neuer Urlaubsantrag von ${getName(user.id)}`,
              body: `${format(startDate, "dd.MM.")} – ${format(endDate, "dd.MM.yyyy")} (${computedDays} Tage)`,
              link: "/time-tracking",
            });
          }
        }
      }
    } catch { /* silent */ }
  };

  const reviewRequest = async (id: string, action: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase.from("vacation_requests").update({
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    } as any).eq("id", id);
    if (error) { toast.error("Fehler"); return; }

    const req = allRequests.find(r => r.id === id);
    if (req) {
      await supabase.from("notifications").insert({
        user_id: req.user_id,
        type: "vacation_reviewed",
        title: action === "approved"
          ? `✅ Dein Urlaubsantrag wurde genehmigt`
          : `❌ Dein Urlaubsantrag wurde abgelehnt`,
        body: `${format(new Date(req.start_date), "dd.MM.")} – ${format(new Date(req.end_date), "dd.MM.yyyy")}`,
        link: "/time-tracking",
      });
    }

    toast.success(action === "approved" ? "Genehmigt" : "Abgelehnt");
    qc.invalidateQueries({ queryKey: ["vacation-requests"] });
  };

  // Team Calendar
  const [calMonth, setCalMonth] = useState(new Date());
  const calStart = startOfMonth(calMonth);
  const calEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const firstDayOffset = (getDay(calStart) + 6) % 7; // Monday-based

  const approvedRequests = useMemo(() =>
    allRequests.filter(r => r.status === "approved"),
    [allRequests]
  );

  const uniqueMembers = useMemo(() => {
    const ids = [...new Set(approvedRequests.map(r => r.user_id))];
    return ids.map(id => ({ id, name: getName(id) }));
  }, [approvedRequests, profiles]);

  const getAbsence = (userId: string, day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return approvedRequests.find(r => r.user_id === userId && r.start_date <= dayStr && r.end_date >= dayStr);
  };

  const typeColor = (type: string) => {
    if (type === "vacation") return "bg-green-500";
    if (type === "sick") return "bg-red-500";
    return "bg-gray-400";
  };

  // Budget management
  const [budgetOpen, setBudgetOpen] = useState(false);

  const updateBudget = async (budgetId: string, field: string, value: number) => {
    await supabase.from("vacation_budgets").update({ [field]: value } as any).eq("id", budgetId);
    qc.invalidateQueries({ queryKey: ["vacation-budgets-all"] });
  };

  return (
    <div className="space-y-8">
      {/* Admin: Pending Requests */}
      {isAdmin && pendingRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Offene Anträge ({pendingRequests.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{getName(req.user_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(req.start_date), "dd.MM.")} – {format(new Date(req.end_date), "dd.MM.yyyy")} · {Number(req.days)} Tage · {VACATION_TYPES.find(t => t.value === req.type)?.label}
                  </p>
                  {req.note && <p className="text-xs text-muted-foreground italic">{req.note}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-200" onClick={() => reviewRequest(req.id, "approved")}>
                    <Check className="h-3.5 w-3.5" /> Genehmigen
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-200" onClick={() => reviewRequest(req.id, "rejected")}>
                    <X className="h-3.5 w-3.5" /> Ablehnen
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Personal Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mein Urlaubskonto {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {budget ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-muted-foreground">Gesamt</p><p className="text-lg font-bold">{totalBudget} Tage</p></div>
                <div><p className="text-xs text-muted-foreground">Genommen</p><p className="text-lg font-bold">{approvedDays} Tage</p></div>
                <div><p className="text-xs text-muted-foreground">Verfügbar</p><p className="text-lg font-bold text-primary">{remainingDays} Tage</p></div>
                <div><p className="text-xs text-muted-foreground">Beantragt</p><p className="text-lg font-bold text-yellow-600">{pendingDays} Tage</p></div>
              </div>
              <Progress value={totalBudget > 0 ? (approvedDays / totalBudget) * 100 : 0} className="h-2" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Kein Urlaubskontingent hinterlegt. Bitte Admin kontaktieren.</p>
          )}
        </CardContent>
      </Card>

      {/* Request Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Neuen Antrag stellen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Art</label>
              <Select value={vacType} onValueChange={setVacType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VACATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Von</label>
              <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd.MM.yyyy") : "Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d || undefined); if (!endDate && d) setEndDate(d); setStartCalOpen(false); }} locale={de} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bis</label>
              <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd.MM.yyyy") : "Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d || undefined); setEndCalOpen(false); }} locale={de} disabled={startDate ? { before: startDate } : undefined} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {computedDays > 0 ? `${computedDays} Arbeitstage` : "Tage"}
              </label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz (optional)" />
            </div>
            <div className="space-y-2">
              {isSingleDay && (
                <div className="flex items-center gap-2">
                  <Checkbox id="half-day" checked={halfDay} onCheckedChange={(v) => setHalfDay(v === true)} />
                  <label htmlFor="half-day" className="text-xs text-muted-foreground">Halber Tag</label>
                </div>
              )}
              <Button onClick={submitRequest} disabled={saving || !startDate || !endDate} className="w-full">
                {saving ? "…" : "Antrag stellen"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Requests */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Meine Anträge</h3>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Tage</TableHead>
                <TableHead>Art</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRequests.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Anträge</TableCell></TableRow>
              )}
              {myRequests.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{format(new Date(r.start_date), "dd.MM.")} – {format(new Date(r.end_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="text-sm">{Number(r.days)}</TableCell>
                  <TableCell className="text-sm">{VACATION_TYPES.find(t => t.value === r.type)?.label}</TableCell>
                  <TableCell><Badge className={cn("text-xs", VACATION_STATUS_COLORS[r.status])}>{VACATION_STATUS_LABELS[r.status]}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Admin: Team Calendar */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Team-Kalender</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium w-28 text-center">{format(calMonth, "MMMM yyyy", { locale: de })}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Day headers */}
              <div className="grid grid-cols-[120px_repeat(7,1fr)] text-xs font-medium text-muted-foreground mb-1">
                <div></div>
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => <div key={d} className="text-center">{d}</div>)}
              </div>
              {/* Calendar grid per member */}
              {profiles.map(member => {
                const weeks: (Date | null)[][] = [];
                let currentWeek: (Date | null)[] = Array(firstDayOffset).fill(null);
                calDays.forEach(day => {
                  currentWeek.push(day);
                  if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
                });
                if (currentWeek.length > 0) {
                  while (currentWeek.length < 7) currentWeek.push(null);
                  weeks.push(currentWeek);
                }
                return (
                  <div key={member.user_id} className="mb-1">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-[120px_repeat(7,1fr)] h-6">
                        {wi === 0 && <div className="text-xs font-medium truncate pr-2 flex items-center">{member.name}</div>}
                        {wi !== 0 && <div></div>}
                        {week.map((day, di) => {
                          if (!day) return <div key={di} className="border-b border-r border-border/30" />;
                          const absence = getAbsence(member.user_id, day);
                          const weekend = isWeekend(day);
                          return (
                            <div
                              key={di}
                              className={cn(
                                "border-b border-r border-border/30 flex items-center justify-center text-[9px]",
                                weekend && "bg-muted/50",
                                absence && typeColor(absence.type) + " text-white"
                              )}
                              title={absence ? `${VACATION_TYPES.find(t => t.value === absence.type)?.label}` : format(day, "dd.MM.")}
                            >
                              {day.getDate()}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin: Budget Management */}
      {isAdmin && (
        <Collapsible open={budgetOpen} onOpenChange={setBudgetOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 text-sm font-semibold px-0 hover:bg-transparent">
              {budgetOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Urlaubskontingente verwalten
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead className="text-right">Jahresurlaub</TableHead>
                    <TableHead className="text-right">Resturlaub</TableHead>
                    <TableHead className="text-right">Gesamt</TableHead>
                    <TableHead className="text-right">Genommen</TableHead>
                    <TableHead className="text-right">Offen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBudgets.map(b => {
                    const taken = allRequests
                      .filter(r => r.user_id === b.user_id && r.status === "approved" && r.type === "vacation" && new Date(r.start_date).getFullYear() === currentYear)
                      .reduce((s, r) => s + Number(r.days), 0);
                    const total = Number(b.total_days) + Number(b.carry_over_days);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm font-medium">{getName(b.user_id)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs inline-block text-right"
                            defaultValue={Number(b.total_days)}
                            onBlur={e => updateBudget(b.id, "total_days", parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs inline-block text-right"
                            defaultValue={Number(b.carry_over_days)}
                            onBlur={e => updateBudget(b.id, "carry_over_days", parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{total}</TableCell>
                        <TableCell className="text-right text-sm">{taken}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">{total - taken}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
