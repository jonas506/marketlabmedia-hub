import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { ShieldCheck, ExternalLink, Clock, Film, LayoutGrid, Megaphone, Youtube, Image as ImageIcon, Send, Loader2, CheckSquare, Square, ChevronLeft, ChevronRight, PlayCircle, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PieceDetailDialog from "@/components/client/PieceDetailDialog";
import { toast } from "sonner";

const TYPE_META: Record<string, { label: string; icon: any }> = {
  reel: { label: "Reel", icon: Film },
  carousel: { label: "Karussell", icon: LayoutGrid },
  ad: { label: "Ad", icon: Megaphone },
  youtube_longform: { label: "YouTube", icon: Youtube },
  story: { label: "Story", icon: ImageIcon },
};

export default function InternalReview() {
  const [openPiece, setOpenPiece] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: pieces = [], isLoading } = useQuery({
    queryKey: ["internal-review-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pieces")
        .select("id, title, type, phase, preview_link, internal_note, updated_at, client_id, clients(id, name, logo_url)")
        .eq("phase", "internal_review")
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { client: any; items: any[] }>();
    for (const p of pieces) {
      const c = (p as any).clients;
      const key = c?.id ?? "unknown";
      if (!map.has(key)) map.set(key, { client: c, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? ""));
  }, [pieces]);

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("content_pieces")
        .update({ phase: "review", phase_changed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} ${count === 1 ? "Piece" : "Pieces"} an Kunde gesendet`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["internal-review-list"] });
      qc.invalidateQueries({ queryKey: ["internal-review-count"] });
      qc.invalidateQueries({ queryKey: ["content_pieces"] });
    },
    onError: (err: any) => toast.error("Freigabe fehlgeschlagen", { description: err.message }),
  });

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleGroup = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Interne Freigabe</h1>
              <p className="text-sm text-muted-foreground">
                Alle Pieces aller Kunden, die intern geprüft werden müssen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pieces.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setOpenPiece(pieces[0])}
              >
                <PlayCircle className="h-4 w-4" />
                Alle durchgehen
              </Button>
            )}
            {pieces.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold">
                {pieces.length}
              </span>
            )}
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Lade…</div>
        ) : pieces.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h2 className="font-display text-lg font-semibold">Alles erledigt</h2>
            <p className="mt-1 text-sm text-muted-foreground">Keine offenen internen Freigaben.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ client, items }) => {
              const ids = items.map((i: any) => i.id);
              const allSelected = ids.every((id) => selected.has(id));
              const someSelected = ids.some((id) => selected.has(id));
              const selectedInGroup = ids.filter((id) => selected.has(id));
              return (
                <section key={client?.id ?? "unknown"} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-surface-elevated/40">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleGroup(ids)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={allSelected ? "Alle abwählen" : "Alle auswählen"}
                      >
                        {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      {client?.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-muted" />
                      )}
                      <Link to={`/client/${client?.id}`} className="font-semibold hover:text-primary transition-colors">
                        {client?.name ?? "Unbekannt"}
                      </Link>
                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        {items.length} offen
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const target = someSelected ? selectedInGroup : ids;
                        if (!confirm(`${target.length} ${target.length === 1 ? "Piece" : "Pieces"} an ${client?.name ?? "Kunde"} senden?`)) return;
                        bulkApprove.mutate(target);
                      }}
                      disabled={bulkApprove.isPending}
                      className="gap-1.5 bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] border-0"
                    >
                      {bulkApprove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {someSelected ? `${selectedInGroup.length} senden` : "Alle an Kunde senden"}
                    </Button>
                  </div>
                  <ul className="divide-y divide-border">
                    {items.map((p: any) => {
                      const meta = TYPE_META[p.type] ?? { label: p.type, icon: Film };
                      const Icon = meta.icon;
                      const isSel = selected.has(p.id);
                      return (
                        <li key={p.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-surface-hover/40 transition-colors ${isSel ? "bg-primary/5" : ""}`}>
                          <Checkbox checked={isSel} onCheckedChange={() => toggle(p.id)} />
                          <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <button
                            onClick={() => setOpenPiece(p)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-sm font-medium truncate">{p.title || "Ohne Titel"}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{meta.label}</span>
                              <span>·</span>
                              <Clock className="h-3 w-3" />
                              <span>seit {formatDistanceToNow(new Date(p.updated_at), { locale: de, addSuffix: false })}</span>
                              {p.internal_note && (
                                <>
                                  <span>·</span>
                                  <span className="truncate italic">„{p.internal_note}"</span>
                                </>
                              )}
                            </div>
                          </button>
                          {p.preview_link && (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="flex-shrink-0"
                            >
                              <a href={p.preview_link.split("\n")[0]} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Preview
                              </a>
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-xl">
          <span className="text-sm font-medium">{selected.size} ausgewählt</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Abwählen</Button>
          <Button
            size="sm"
            onClick={() => {
              if (!confirm(`${selected.size} Pieces an die jeweiligen Kunden senden?`)) return;
              bulkApprove.mutate(Array.from(selected));
            }}
            disabled={bulkApprove.isPending}
            className="gap-1.5 bg-gradient-to-r from-primary to-[hsl(var(--runway-green))] border-0"
          >
            {bulkApprove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            An Kunden senden
          </Button>
        </div>
      )}

      <PieceDetailDialog
        open={!!openPiece}
        onOpenChange={(o) => !o && setOpenPiece(null)}
        piece={openPiece}
        clientId={openPiece?.client_id ?? ""}
      />
    </AppLayout>
  );
}
