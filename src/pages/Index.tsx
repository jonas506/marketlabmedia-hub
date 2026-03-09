import { useClients } from "@/hooks/useClients";
import ClientCard from "@/components/ClientCard";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const { data: clients, isLoading } = useClients();

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">DASHBOARD</h1>
        <p className="font-body text-sm text-muted-foreground">
          Sortiert nach Content-Runway – dringendste Kunden zuerst.
        </p>
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
