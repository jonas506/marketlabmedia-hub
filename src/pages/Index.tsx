import { useClients } from "@/hooks/useClients";
import ClientCard from "@/components/ClientCard";
import AppLayout from "@/components/AppLayout";
import CreateClientDialog from "@/components/CreateClientDialog";
import MyTasks from "@/components/MyTasks";
import WeeklyKPIs from "@/components/WeeklyKPIs";
import PostingCalendar from "@/components/PostingCalendar";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { useMonthlyChecklistTrigger } from "@/hooks/useChecklistTriggers";

const Dashboard = () => {
  const { data: clients, isLoading } = useClients();
  const { role } = useAuth();
  const canCreate = role === "admin" || role === "head_of_content";
  useMonthlyChecklistTrigger();

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {/* KPIs for Admin */}
        <WeeklyKPIs />

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight">Dashboard</h1>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Sortiert nach Content-Runway — dringendste Kunden zuerst
            </p>
          </div>
          {canCreate && <CreateClientDialog />}
        </div>
        {/* Client grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-lg bg-card border border-border" />
            ))}
          </div>
        ) : clients?.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card">
            <p className="text-sm text-muted-foreground font-body">Noch keine Kunden angelegt</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {clients?.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
              >
                <ClientCard client={client} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Posting Calendar */}
        <div className="mt-6">
          <PostingCalendar />
        </div>

        {/* My Tasks */}
        <div className="mt-6">
          <MyTasks />
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
