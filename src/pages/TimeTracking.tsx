import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import TimeEntryForm from "@/components/time-tracking/TimeEntryForm";
import WeeklyView from "@/components/time-tracking/WeeklyView";
import MonthlyStats from "@/components/time-tracking/MonthlyStats";
import VacationTab from "@/components/time-tracking/VacationTab";
import TravelExpensesTab from "@/components/time-tracking/TravelExpensesTab";
import SickDayQuickButton from "@/components/time-tracking/SickDayQuickButton";

export default function TimeTracking() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [memberFilter, setMemberFilter] = useState<string>("__all__");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const { data: entries = [], refetch: refetchEntries } = useQuery({
    queryKey: ["time-entries", user?.id, isAdmin, memberFilter],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from("time_entries").select("*, clients(name)").order("date", { ascending: false });
      if (!isAdmin) {
        q = q.eq("user_id", user.id);
      } else if (memberFilter !== "__all__") {
        q = q.eq("user_id", memberFilter);
      }
      const { data } = await q.limit(500);
      return data || [];
    },
    enabled: !!user,
  });

  // Approved absences (vacation / sick / holiday) — credited as virtual time entries (8h/day)
  const { data: absences = [] } = useQuery({
    queryKey: ["absences-approved", user?.id, isAdmin, memberFilter],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from("vacation_requests").select("*").eq("status", "approved");
      if (!isAdmin) {
        q = q.eq("user_id", user.id);
      } else if (memberFilter !== "__all__") {
        q = q.eq("user_id", memberFilter);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: !!user,
  });

  const filteredEntries = useMemo(() => {
    const ABSENCE_HOURS = 8;
    const ABSENCE_LABEL: Record<string, string> = {
      vacation: "Urlaub",
      sick: "Krank",
      holiday: "Feiertag",
      personal: "Persönlich",
    };
    const virtualEntries: any[] = [];
    for (const a of absences as any[]) {
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(); // skip weekends
        if (dow === 0 || dow === 6) continue;
        const dateStr = d.toISOString().slice(0, 10);
        virtualEntries.push({
          id: `abs-${a.id}-${dateStr}`,
          user_id: a.user_id,
          date: dateStr,
          hours: ABSENCE_HOURS,
          activity_type: "other",
          note: ABSENCE_LABEL[a.type] || a.type,
          client_id: null,
          clients: { name: ABSENCE_LABEL[a.type] || a.type },
          is_absence: true,
          absence_type: a.type,
        });
      }
    }
    return [...(entries as any[]), ...virtualEntries];
  }, [entries, absences]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Crew</h1>
          </div>
        </div>

        <Tabs defaultValue="zeiten">
          <TabsList>
            <TabsTrigger value="zeiten">Zeiten</TabsTrigger>
            <TabsTrigger value="urlaub">Urlaub</TabsTrigger>
            <TabsTrigger value="reisekosten">Reisekosten</TabsTrigger>
          </TabsList>

          <TabsContent value="zeiten" className="space-y-6 mt-4">
            {/* Admin filter */}
            {isAdmin && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">Team-Mitglied:</label>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Alle</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quick entry */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Schnelleingabe</h3>
                <SickDayQuickButton />
              </div>
              <TimeEntryForm clients={clients} onEntryAdded={() => refetchEntries()} />
            </div>

            {/* Weekly view */}
            <WeeklyView entries={filteredEntries} onRefresh={() => refetchEntries()} />

            {/* Monthly stats */}
            <MonthlyStats entries={filteredEntries} isAdmin={isAdmin} profiles={profiles} />
          </TabsContent>

          <TabsContent value="urlaub" className="mt-4">
            <VacationTab />
          </TabsContent>

          <TabsContent value="reisekosten" className="mt-4">
            <TravelExpensesTab isAdmin={isAdmin} profiles={profiles} memberFilter={memberFilter} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
