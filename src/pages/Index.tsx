import { useClients } from "@/hooks/useClients";
import ClientCard from "@/components/ClientCard";
import AppLayout from "@/components/AppLayout";
import CreateClientDialog from "@/components/CreateClientDialog";
import MyTasks from "@/components/MyTasks";
import WeeklyKPIs from "@/components/WeeklyKPIs";
import PostingCalendar from "@/components/PostingCalendar";
import Greeting from "@/components/Greeting";
import TeamWorkloadWidget from "@/components/TeamWorkloadWidget";
import BottleneckAlert from "@/components/BottleneckAlert";
import ReviewQueue from "@/components/ReviewQueue";
import CutterFocusBoard from "@/components/CutterFocusBoard";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { useMonthlyChecklistTrigger } from "@/hooks/useChecklistTriggers";
import OnboardingOverview from "@/components/OnboardingOverview";

const Dashboard = () => {
  const { data: clients, isLoading } = useClients();
  const { role, profile, user } = useAuth();
  const canCreate = role === "admin" || role === "head_of_content";
  useMonthlyChecklistTrigger();

  const isCutter = role === "cutter";

  const clientGrid = (compact = false) => (
    <>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold tracking-tight">Kunden</h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            {compact ? "Deine Kunden im Überblick" : "Sortiert nach Content-Runway — dringendste Kunden zuerst"}
          </p>
        </div>
        {canCreate && <CreateClientDialog />}
      </div>
      {isLoading ? (
        <div className={`grid grid-cols-1 gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
          {[...Array(compact ? 4 : 8)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-card border border-border" />
          ))}
        </div>
      ) : clients?.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card">
          <p className="text-sm text-muted-foreground font-body">Noch keine Kunden angelegt</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
          {clients?.map((client, i) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
            >
              <ClientCard client={client} compact={compact} />
            </motion.div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <Greeting name={profile?.name} />

        {role === "admin" && (
          <>
            <WeeklyKPIs />
            <TeamWorkloadWidget />
            <BottleneckAlert />
            {clientGrid()}
            <div className="mt-6">
              <PostingCalendar />
            </div>
            <div className="mt-6">
              <MyTasks />
            </div>
          </>
        )}

        {role === "head_of_content" && (
          <>
            <WeeklyKPIs />
            <ReviewQueue />
            <TeamWorkloadWidget />
            {clientGrid()}
            <div className="mt-6">
              <PostingCalendar />
            </div>
            <div className="mt-6">
              <MyTasks />
            </div>
          </>
        )}

        {role === "cutter" && (
          <>
            <CutterFocusBoard />
            <PostingCalendar filterUserId={user?.id} />
            <div className="mt-6">
              {clientGrid(true)}
            </div>
          </>
        )}

        {/* Fallback for unknown roles */}
        {!role && !isCutter && role !== "admin" && role !== "head_of_content" && (
          <>
            {clientGrid()}
            <div className="mt-6">
              <PostingCalendar />
            </div>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
