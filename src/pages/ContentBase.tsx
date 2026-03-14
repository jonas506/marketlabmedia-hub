import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import CanvasApp from "@/components/contentbase/CanvasApp";
import BrandManager from "@/components/contentbase/BrandManager";
import ReelIdeas from "@/components/contentbase/ReelIdeas";
import { NODE_W, NODE_H } from "@/lib/content-types";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  nodes: any[];
  connections?: any[];
}

function ProjectThumbnail({ nodes, connections }: { nodes: any[]; connections?: any[] }) {
  const geo = useMemo(() => {
    if (!nodes?.length) return null;
    const xs = nodes.map((n: any) => n.x ?? 0);
    const ys = nodes.map((n: any) => n.y ?? 0);
    const xe = nodes.map((n: any) => (n.x ?? 0) + (NODE_W[n.type] ?? 200));
    const ye = nodes.map((n: any) => (n.y ?? 0) + (NODE_H[n.type] ?? 150));
    const pad = 30;
    return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, w: Math.max(...xe) - Math.min(...xs) + pad * 2, h: Math.max(...ye) - Math.min(...ys) + pad * 2 };
  }, [nodes]);

  if (!geo) return <div className="w-full h-28 rounded-lg bg-muted/30 flex items-center justify-center"><span className="text-muted-foreground text-xs">Leer</span></div>;

  const NODE_COLORS: Record<string, string> = { idea: "hsl(var(--primary))", content: "#3b82f6", image: "#ea580c", model: "#6366f1" };

  return (
    <svg viewBox={`${geo.minX} ${geo.minY} ${geo.w} ${geo.h}`} className="w-full h-28 rounded-lg bg-muted/10 border border-border/50" preserveAspectRatio="xMidYMid meet">
      {nodes.map((n: any) => <rect key={n.id} x={n.x ?? 0} y={n.y ?? 0} width={NODE_W[n.type] ?? 200} height={NODE_H[n.type] ?? 150} rx={8} fill={NODE_COLORS[n.type] || "hsl(var(--muted))"} opacity={0.6} />)}
    </svg>
  );
}

const ContentBase = () => {
  const { user } = useAuth();
  const userId = user?.id || "";
  const userEmail = user?.email || "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"dashboard" | "canvas">("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showBrands, setShowBrands] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("cb_projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [projects, search]);

  const deleteProject = async (id: string) => {
    if (!confirm("Projekt wirklich löschen?")) return;
    await supabase.from("cb_projects").delete().eq("id", id);
    setProjects((ps) => ps.filter((p) => p.id !== id));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "gerade eben";
    if (mins < 60) return `vor ${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    return `vor ${Math.floor(hours / 24)} Tag(en)`;
  };

  if (view === "canvas") {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <CanvasApp
          userId={userId}
          userEmail={userEmail}
          projectId={activeProjectId}
          onBack={() => { setView("dashboard"); setActiveProjectId(null); load(); }}
        />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-8">
        {/* Reel Ideas */}
        <ReelIdeas userId={userId} />

        {/* Projects Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold text-foreground">Content Projekte</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBrands(true)} className="px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm font-semibold cursor-pointer hover:border-primary/40 transition-all">Marken / CI</button>
            <button onClick={() => { setActiveProjectId(null); setView("canvas"); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer border-none hover:opacity-85">+ Neues Projekt</button>
          </div>
        </div>

        {/* Search */}
        {projects.length > 0 && (
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Projekte suchen…" className="w-full max-w-sm px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-muted-foreground text-sm">Noch keine Projekte vorhanden</p>
            <button onClick={() => { setActiveProjectId(null); setView("canvas"); }} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold cursor-pointer border-none hover:opacity-85">Erstes Projekt erstellen</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group" onClick={() => { setActiveProjectId(p.id); setView("canvas"); }}>
                <ProjectThumbnail nodes={p.nodes} connections={p.connections} />
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate flex-1">{p.name}</h3>
                    <button className="text-muted-foreground hover:text-destructive text-xs opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer ml-2" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}>✕</button>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{Array.isArray(p.nodes) ? p.nodes.length : 0} Nodes</span>
                    <span>·</span>
                    <span>{timeAgo(p.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showBrands && <BrandManager userId={userId} onClose={() => setShowBrands(false)} />}
      </div>
    </AppLayout>
  );
};

export default ContentBase;
