import { useClients } from "@/hooks/useClients";
import ClientCard from "@/components/ClientCard";
import AppLayout from "@/components/AppLayout";
import CreateClientDialog from "@/components/CreateClientDialog";
import MyTasks from "@/components/MyTasks";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";

const Dashboard = () => {
  const { data: clients, isLoading } = useClients();
  const { role } = useAuth();
  const canCreate = role === "admin" || role === "head_of_content";

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
              <p className="font-body text-sm text-muted-foreground mt-0.5">
                Sortiert nach Content-Runway – dringendste Kunden zuerst
              </p>
            </div>
          </div>
          {canCreate && <CreateClientDialog />}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-card border border-border" />
            ))}
          </div>
        ) : clients?.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-sm text-muted-foreground font-body">Noch keine Kunden angelegt</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {clients?.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <ClientCard client={client} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
