import { useClients } from "@/hooks/useClients";
import ClientCard from "@/components/ClientCard";
import AppLayout from "@/components/AppLayout";
import CreateClientDialog from "@/components/CreateClientDialog";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { data: clients, isLoading } = useClients();
  const { role } = useAuth();
  const canCreate = role === "admin" || role === "head_of_content";

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">DASHBOARD</h1>
          <p className="font-body text-sm text-muted-foreground">
            Sortiert nach Content-Runway – dringendste Kunden zuerst.
          </p>
        </div>
        {canCreate && <CreateClientDialog />}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : clients?.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="font-mono text-sm text-muted-foreground">0 KUNDEN</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients?.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Dashboard;
