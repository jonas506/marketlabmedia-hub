import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import RunwayBadge from "@/components/RunwayBadge";
import BrandingSection from "@/components/client/BrandingSection";
import KontingentSection from "@/components/client/KontingentSection";
import ShootDaySection from "@/components/client/ShootDaySection";
import MaterialPipeline from "@/components/client/MaterialPipeline";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clips } = useQuery({
    queryKey: ["clips", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clips")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shootDays } = useQuery({
    queryKey: ["shoot-days", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoot_days")
        .select("*")
        .eq("client_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading || !client) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const totalMonthly = client.monthly_reels + client.monthly_carousels + client.monthly_stories;
  const dailyFreq = totalMonthly / 30;
  const doneClips = clips?.filter((c) => c.phase === "done" || c.phase === "scheduled").length ?? 0;
  const runway = dailyFreq > 0 ? Math.round(doneClips / dailyFreq) : 999;
  const canEdit = role === "admin" || role === "head_of_content";

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-body mb-4">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-12 w-12 rounded object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-muted font-mono text-lg text-muted-foreground">
                {client.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <span className={`font-mono text-xs uppercase ${client.status === "active" ? "text-runway-green" : "text-muted-foreground"}`}>
                {client.status === "active" ? "AKTIV" : "PAUSIERT"}
              </span>
            </div>
          </div>
          <RunwayBadge days={runway} size="lg" />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        <BrandingSection client={client} canEdit={canEdit} />
        <KontingentSection client={client} clips={clips ?? []} canEdit={canEdit} />
        <ShootDaySection clientId={client.id} shootDays={shootDays ?? []} canEdit={canEdit} />
        <MaterialPipeline clientId={client.id} clips={clips ?? []} canEdit={canEdit} />
      </div>
    </AppLayout>
  );
};

export default ClientDetail;
