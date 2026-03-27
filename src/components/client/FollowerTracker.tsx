import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Instagram, Youtube, Plus } from "lucide-react";
import { format, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";

interface Props {
  clientId: string;
  canEdit: boolean;
}

const PLATFORMS = [
  { key: "instagram", label: "Instagram", color: "hsl(var(--primary))", icon: Instagram },
  { key: "youtube", label: "YouTube", color: "#FF0000", icon: Youtube },
  { key: "tiktok", label: "TikTok", color: "#00F2EA", icon: () => <span className="text-xs font-bold">TT</span> },
] as const;

export default function FollowerTracker({ clientId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [manualPlatform, setManualPlatform] = useState<string>("instagram");
  const [manualCount, setManualCount] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Fetch client social handles
  const { data: client } = useQuery({
    queryKey: ["client-social", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("instagram_handle, youtube_channel_id, tiktok_handle")
        .eq("id", clientId)
        .single();
      return data;
    },
  });

  // Fetch snapshots (last 90 days)
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["follower-snapshots", clientId],
    queryFn: async () => {
      const since = format(subDays(new Date(), 90), "yyyy-MM-dd");
      const { data } = await supabase
        .from("follower_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .gte("snapshot_date", since)
        .order("snapshot_date", { ascending: true });
      return data || [];
    },
  });

  // Save social handles
  const saveHandles = useMutation({
    mutationFn: async (handles: { instagram_handle?: string; youtube_channel_id?: string; tiktok_handle?: string }) => {
      const { error } = await supabase.from("clients").update(handles).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-social", clientId] });
      toast.success("Social-Profile gespeichert");
    },
  });

  // Manual snapshot
  const addManual = useMutation({
    mutationFn: async () => {
      const count = parseInt(manualCount);
      if (isNaN(count) || count < 0) throw new Error("Ungültige Zahl");
      const today = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("follower_snapshots").upsert(
        { client_id: clientId, platform: manualPlatform, follower_count: count, snapshot_date: today },
        { onConflict: "client_id,platform,snapshot_date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follower-snapshots", clientId] });
      setManualCount("");
      setShowManualAdd(false);
      toast.success("Follower-Zahl eingetragen");
    },
    onError: (e) => toast.error(e.message),
  });

  // Trigger auto-fetch
  const autoFetch = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("track-followers", {
        body: { client_id: clientId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["follower-snapshots", clientId] });
      const results = data?.results || [];
      const errors = results.filter((r: any) => r.error);
      if (errors.length > 0) {
        toast.warning(`${results.length - errors.length} aktualisiert, ${errors.length} fehlgeschlagen`);
      } else if (results.length > 0) {
        toast.success(`${results.length} Plattform(en) aktualisiert`);
      } else {
        toast.info("Keine Social-Profile konfiguriert");
      }
    },
    onError: (e) => toast.error("Fehler beim Abrufen: " + e.message),
  });

  // Build chart data
  const chartData = (() => {
    const dateMap = new Map<string, Record<string, number>>();
    snapshots.forEach((s: any) => {
      const existing = dateMap.get(s.snapshot_date) || {};
      existing[s.platform] = s.follower_count;
      dateMap.set(s.snapshot_date, existing);
    });
    return Array.from(dateMap.entries())
      .map(([date, platforms]) => ({
        date,
        label: format(new Date(date + "T00:00:00"), "dd. MMM", { locale: de }),
        ...platforms,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  // Latest counts per platform
  const latestCounts = PLATFORMS.map((p) => {
    const filtered = snapshots.filter((s: any) => s.platform === p.key).sort((a: any, b: any) => b.snapshot_date.localeCompare(a.snapshot_date));
    const latest = filtered[0];
    const previous = filtered[1];
    const diff = latest && previous ? latest.follower_count - previous.follower_count : null;
    return { ...p, count: latest?.follower_count ?? null, diff, date: latest?.snapshot_date };
  }).filter((p) => p.count !== null);

  const [igHandle, setIgHandle] = useState(client?.instagram_handle || "");
  const [ytChannel, setYtChannel] = useState(client?.youtube_channel_id || "");
  const [ttHandle, setTtHandle] = useState(client?.tiktok_handle || "");

  // Sync state when client loads
  const handlesSynced = client?.instagram_handle === igHandle && client?.youtube_channel_id === ytChannel && client?.tiktok_handle === ttHandle;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-display font-semibold">Follower Tracking</h3>
          <p className="text-[11px] text-muted-foreground">Automatische & manuelle Follower-Erfassung</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualAdd(!showManualAdd)}
              className="text-xs h-7 gap-1"
            >
              <Plus className="h-3 w-3" /> Manuell
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoFetch.mutate()}
            disabled={autoFetch.isPending}
            className="text-xs h-7 gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${autoFetch.isPending ? "animate-spin" : ""}`} />
            Abrufen
          </Button>
        </div>
      </div>

      {/* Social handles config */}
      {canEdit && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Instagram className="h-3 w-3" /> Instagram
            </label>
            <Input
              value={igHandle || client?.instagram_handle || ""}
              onChange={(e) => setIgHandle(e.target.value)}
              placeholder="@username"
              className="h-7 text-xs"
              onBlur={() => {
                if (igHandle !== client?.instagram_handle) {
                  saveHandles.mutate({ instagram_handle: igHandle || null });
                }
              }}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Youtube className="h-3 w-3" /> YouTube
            </label>
            <Input
              value={ytChannel || client?.youtube_channel_id || ""}
              onChange={(e) => setYtChannel(e.target.value)}
              placeholder="Channel ID oder @handle"
              className="h-7 text-xs"
              onBlur={() => {
                if (ytChannel !== client?.youtube_channel_id) {
                  saveHandles.mutate({ youtube_channel_id: ytChannel || null });
                }
              }}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <span className="text-[9px] font-bold">TT</span> TikTok
            </label>
            <Input
              value={ttHandle || client?.tiktok_handle || ""}
              onChange={(e) => setTtHandle(e.target.value)}
              placeholder="@username"
              className="h-7 text-xs"
              onBlur={() => {
                if (ttHandle !== client?.tiktok_handle) {
                  saveHandles.mutate({ tiktok_handle: ttHandle || null });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Manual add */}
      {showManualAdd && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="flex items-end gap-2 p-2 rounded-lg border border-border bg-card">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">Plattform</label>
            <select
              value={manualPlatform}
              onChange={(e) => setManualPlatform(e.target.value)}
              className="h-7 w-full text-xs rounded-md border border-input bg-background px-2"
            >
              {PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">Follower-Zahl</label>
            <Input
              type="number"
              value={manualCount}
              onChange={(e) => setManualCount(e.target.value)}
              placeholder="z.B. 15420"
              className="h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={() => addManual.mutate()}
            disabled={!manualCount || addManual.isPending}
            className="h-7 text-xs"
          >
            Speichern
          </Button>
        </motion.div>
      )}

      {/* Stats cards */}
      {latestCounts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {latestCounts.map((p) => (
            <div key={p.key} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <p.icon className="h-3.5 w-3.5" style={{ color: p.color }} />
                <span className="text-[10px] text-muted-foreground">{p.label}</span>
              </div>
              <p className="text-lg font-bold tabular-nums">
                {p.count!.toLocaleString("de-DE")}
              </p>
              {p.diff !== null && (
                <div className={`flex items-center gap-0.5 text-[10px] mt-0.5 ${
                  p.diff > 0 ? "text-green-500" : p.diff < 0 ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {p.diff > 0 ? <TrendingUp className="h-3 w-3" /> : p.diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {p.diff > 0 ? "+" : ""}{p.diff.toLocaleString("de-DE")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 ? (
        <div className="h-52 rounded-lg border border-border bg-card p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString("de-DE"),
                  PLATFORMS.find((p) => p.key === name)?.label || name,
                ]}
              />
              <Legend
                formatter={(value) => PLATFORMS.find((p) => p.key === value)?.label || value}
                wrapperStyle={{ fontSize: "11px" }}
              />
              {PLATFORMS.map((p) =>
                chartData.some((d) => d[p.key as keyof typeof d] !== undefined) ? (
                  <Line
                    key={p.key}
                    type="monotone"
                    dataKey={p.key}
                    stroke={p.color}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : chartData.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-border bg-card">
          <p className="text-xs text-muted-foreground">
            Noch keine Follower-Daten. Trage Profile ein und klicke "Abrufen".
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
