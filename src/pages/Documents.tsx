import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Bell,
  CheckCircle2,
  Copy,
  Eye,
  FileSignature,
  FileText,
  Loader2,
  Plus,
  Ban,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CreateDocumentDialog from "@/components/documents/CreateDocumentDialog";

interface Doc {
  id: string;
  title: string;
  file_path: string;
  file_name: string | null;
  file_hash: string | null;
  recipient_name: string | null;
  recipient_email: string;
  subject: string;
  token: string;
  status: string;
  expires_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

interface Acceptance {
  typed_name: string;
  consent_text: string;
  ip_address: string | null;
  user_agent: string | null;
  file_hash: string | null;
  accepted_at: string;
}

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Entwurf", className: "bg-muted text-muted-foreground" },
  sent: { label: "Gesendet", className: "bg-primary/15 text-primary" },
  viewed: { label: "Angesehen", className: "bg-amber-500/15 text-amber-500" },
  accepted: { label: "Angenommen", className: "bg-emerald-500/15 text-emerald-500" },
  revoked: { label: "Zurückgezogen", className: "bg-destructive/15 text-destructive" },
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fmtFull = (d?: string | null) =>
  d ? new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "—";

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("signature_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Dokumente & Freigaben — Marketlab Hub";
    load();
  }, []);

  const openDetail = async (doc: Doc) => {
    setSelected(doc);
    setAcceptance(null);
    setPdfUrl(null);
    const [{ data: acc }, { data: signed }] = await Promise.all([
      supabase
        .from("signature_acceptances")
        .select("typed_name, consent_text, ip_address, user_agent, file_hash, accepted_at")
        .eq("document_id", doc.id)
        .maybeSingle(),
      supabase.storage.from("documents").createSignedUrl(doc.file_path, 3600),
    ]);
    setAcceptance((acc as Acceptance) ?? null);
    setPdfUrl(signed?.signedUrl ?? null);
  };

  // Preview-Domains erfordern einen Lovable-Login -> öffentlicher Link immer über die Live-Domain
  const PUBLIC_BASE = /lovable\.(app|dev)$/.test(window.location.hostname)
    ? "https://hub.marketlab-media.de"
    : window.location.origin;
  const linkFor = (doc: Doc) => `${PUBLIC_BASE}/dokument/${doc.token}`;

  const copyLink = (doc: Doc) => {
    navigator.clipboard.writeText(linkFor(doc));
    toast({ title: "Link kopiert" });
  };

  const send = async (doc: Doc, reminder: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("document-send", {
        body: { documentId: doc.id, appUrl: window.location.origin, reminder },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast({ title: reminder ? "Erinnerung gesendet" : "Dokument gesendet" });
      await load();
      setSelected(null);
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (doc: Doc) => {
    const { error } = await supabase
      .from("signature_documents")
      .update({ status: "revoked" })
      .eq("id", doc.id);
    if (error) return toast({ title: "Fehler", description: error.message, variant: "destructive" });
    toast({ title: "Dokument zurückgezogen" });
    await load();
    setSelected(null);
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <FileSignature className="h-6 w-6 text-primary" />
              Dokumente &amp; Freigaben
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF verschicken — Empfänger nimmt per Klick rechtsverbindlich an.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neues Dokument
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Noch keine Dokumente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lade dein erstes PDF hoch und verschicke es zur Annahme.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => {
              const st = STATUS[doc.status] ?? STATUS.draft;
              return (
                <button
                  key={doc.id}
                  onClick={() => openDetail(doc)}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-surface-elevated p-4 text-left transition-colors hover:border-primary/40"
                >
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{doc.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {doc.recipient_name ? `${doc.recipient_name} · ` : ""}
                      {doc.recipient_email}
                    </div>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    {fmt(doc.sent_at ?? doc.created_at)}
                  </div>
                  <Badge className={`${st.className} shrink-0 border-0`}>{st.label}</Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">{selected.title}</SheetTitle>
                <SheetDescription>
                  {selected.recipient_name ? `${selected.recipient_name} · ` : ""}
                  {selected.recipient_email}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <Badge className={`${(STATUS[selected.status] ?? STATUS.draft).className} border-0`}>
                  {(STATUS[selected.status] ?? STATUS.draft).label}
                </Badge>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Gesendet" value={fmt(selected.sent_at)} />
                  <Info label="Angesehen" value={fmt(selected.viewed_at)} />
                  <Info label="Angenommen" value={fmt(selected.accepted_at)} />
                  <Info label="Gültig bis" value={fmt(selected.expires_at)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyLink(selected)}>
                    <Copy className="h-3.5 w-3.5" /> Link kopieren
                  </Button>
                  {pdfUrl && (
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                      <a href={pdfUrl} target="_blank" rel="noreferrer">
                        <Eye className="h-3.5 w-3.5" /> PDF öffnen
                      </a>
                    </Button>
                  )}
                  {selected.status === "draft" && (
                    <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => send(selected, false)}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Jetzt senden
                    </Button>
                  )}
                  {(selected.status === "sent" || selected.status === "viewed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => send(selected, true)}
                    >
                      <Bell className="h-3.5 w-3.5" /> Erinnerung senden
                    </Button>
                  )}
                  {selected.status !== "accepted" && selected.status !== "revoked" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-destructive">
                          <Ban className="h-3.5 w-3.5" /> Zurückziehen
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Dokument zurückziehen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Der Link wird sofort ungültig. Der Empfänger kann nicht mehr annehmen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revoke(selected)}>Zurückziehen</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {acceptance && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" /> Annahme-Protokoll
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <Row label="Name" value={acceptance.typed_name} />
                      <Row label="Zeitpunkt" value={fmtFull(acceptance.accepted_at)} />
                      <Row label="IP-Adresse" value={acceptance.ip_address ?? "—"} />
                      <Row label="Gerät" value={acceptance.user_agent ?? "—"} />
                      <Row label="Prüfsumme" value={acceptance.file_hash ?? "—"} />
                      <Row label="Zustimmung" value={acceptance.consent_text} />
                    </dl>
                  </div>
                )}

                {selected.file_hash && !acceptance && (
                  <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">Datei-Prüfsumme (SHA-256)</div>
                    <div className="mt-1 break-all font-mono">{selected.file_hash}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-0.5 font-medium">{value}</div>
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-3">
    <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 flex-1 break-all">{value}</dd>
  </div>
);
