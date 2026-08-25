import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Copy, Check, ExternalLink, ImagePlus, Trash2, Loader2, GripVertical,
  Mic, Video as VideoIcon, Image as ImageIcon, Plus, Link2,
} from "lucide-react";
import { toast } from "sonner";
import ReferralResultsChat from "./ReferralResultsChat";

interface Props {
  clientId: string;
  clientName: string;
  canEdit: boolean;
}

interface Stat { label: string; value: string }

interface MediaRow {
  id: string;
  type: string;
  url: string;
  caption: string | null;
  sort_order: number;
}

const PUBLIC_BASE = "https://hub.marketlab-media.de/ref/";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const guessType = (file: File) =>
  file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";

const ReferralPageEditor = ({ clientId, clientName, canEdit }: Props) => {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  const [form, setForm] = useState({
    is_active: true,
    headline_name: "",
    role_title: "",
    intro_text: "",
    results_text: "",
    quote: "",
    phone: "",
    cal_link: "",
    photo_url: "",
  });
  const [stats, setStats] = useState<Stat[]>([]);

  const { data: page, isLoading } = useQuery({
    queryKey: ["referral-page", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_referral_pages")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: media } = useQuery({
    queryKey: ["referral-media", page?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_referral_media")
        .select("*")
        .eq("page_id", page!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as MediaRow[];
    },
    enabled: !!page?.id,
  });

  useEffect(() => {
    if (!page) return;
    setForm({
      is_active: page.is_active,
      headline_name: page.headline_name || clientName,
      role_title: page.role_title || "",
      intro_text: page.intro_text || "",
      results_text: page.results_text || "",
      quote: page.quote || "",
      phone: page.phone || "",
      cal_link: page.cal_link || "",
      photo_url: page.photo_url || "",
    });
    setStats(Array.isArray(page.stats) ? (page.stats as unknown as Stat[]) : []);
  }, [page, clientName]);

  const sign = async (path?: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("referral-assets").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  useEffect(() => {
    sign(form.photo_url).then(setPhotoPreview);
  }, [form.photo_url]);

  useEffect(() => {
    const run = async () => {
      if (!media?.length) return setSigned({});
      const entries = await Promise.all(media.map(async (m) => [m.id, (await sign(m.url)) || ""] as const));
      setSigned(Object.fromEntries(entries));
    };
    run();
  }, [media]);

  const createPage = async () => {
    setSaving(true);
    const base = slugify(clientName) || "kunde";
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await supabase.from("client_referral_pages").insert({
      client_id: clientId,
      slug,
      headline_name: clientName,
    });
    setSaving(false);
    if (error) return toast.error("Fehler beim Anlegen");
    qc.invalidateQueries({ queryKey: ["referral-page", clientId] });
    toast.success("Empfehlungsseite erstellt");
  };

  const save = async (patch?: Partial<typeof form> & { stats?: Stat[] }) => {
    if (!page) return;
    setSaving(true);
    const { error } = await supabase
      .from("client_referral_pages")
      .update({ ...form, stats: stats as any, ...(patch as any) })
      .eq("id", page.id);
    setSaving(false);
    if (error) return toast.error("Speichern fehlgeschlagen");
    qc.invalidateQueries({ queryKey: ["referral-page", clientId] });
    toast.success("Gespeichert");
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const path = `${clientId}/photo-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("referral-assets").upload(path, file);
    setUploading(false);
    if (error) return toast.error("Upload fehlgeschlagen");
    setForm((f) => ({ ...f, photo_url: path }));
    await save({ photo_url: path });
  };

  const uploadMedia = async (files: FileList) => {
    if (!page) return;
    setUploading(true);
    const start = (media?.length ?? 0);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${clientId}/feedback-${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("referral-assets").upload(path, file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${file.name}`);
        continue;
      }
      await supabase.from("client_referral_media").insert({
        page_id: page.id,
        type: guessType(file),
        url: path,
        sort_order: start + i,
      });
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["referral-media", page.id] });
    toast.success("Medien hochgeladen");
  };

  const updateMedia = async (id: string, patch: Partial<MediaRow>) => {
    await supabase.from("client_referral_media").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["referral-media", page?.id] });
  };

  const deleteMedia = async (m: MediaRow) => {
    await supabase.storage.from("referral-assets").remove([m.url]);
    await supabase.from("client_referral_media").delete().eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["referral-media", page?.id] });
  };

  const reorder = async (targetId: string) => {
    if (!media || !dragId.current || dragId.current === targetId) return;
    const list = [...media];
    const from = list.findIndex((m) => m.id === dragId.current);
    const to = list.findIndex((m) => m.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    dragId.current = null;
    await Promise.all(
      list.map((m, i) => supabase.from("client_referral_media").update({ sort_order: i }).eq("id", m.id)),
    );
    qc.invalidateQueries({ queryKey: ["referral-media", page?.id] });
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Link2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <h2 className="font-display text-base font-semibold">Noch keine Empfehlungsseite</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Erstelle eine öffentliche Seite, die {clientName} an Bekannte weiterschicken kann.
        </p>
        {canEdit && (
          <Button className="mt-4" onClick={createPage} disabled={saving}>
            <Plus className="mr-1.5 h-4 w-4" /> Empfehlungsseite erstellen
          </Button>
        )}
      </div>
    );
  }

  const url = `${PUBLIC_BASE}${page.slug}`;

  return (
    <div className="space-y-4">
      {/* Link + Status */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Öffentlicher Link</p>
            <p className="truncate font-mono text-sm">{url}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            Kopieren
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/ref/${page.slug}`, "_blank")}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Vorschau
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_active}
              disabled={!canEdit}
              onCheckedChange={(v) => {
                setForm((f) => ({ ...f, is_active: v }));
                save({ is_active: v });
              }}
            />
            <span className="text-xs text-muted-foreground">{form.is_active ? "Aktiv" : "Inaktiv"}</span>
          </div>
        </div>
      </div>

      {/* Inhalte */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-display text-base font-semibold">Inhalte</h2>

        <div className="flex items-start gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            {photoPreview ? (
              <img src={photoPreview} alt="Kundenfoto" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Foto des Kunden</Label>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
            <Button variant="outline" size="sm" disabled={!canEdit || uploading} onClick={() => photoInput.current?.click()}>
              {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />}
              Foto hochladen
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Anzeigename in der Überschrift</Label>
            <Input
              value={form.headline_name}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, headline_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Position / Firma</Label>
            <Input
              value={form.role_title}
              disabled={!canEdit}
              placeholder="Geschäftsführer, Muster GmbH"
              onChange={(e) => setForm((f) => ({ ...f, role_title: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Einleitung (Hero)</Label>
          <Textarea
            rows={3}
            disabled={!canEdit}
            value={form.intro_text}
            placeholder="Kurzer Satz, warum der Kunde uns empfiehlt."
            onChange={(e) => setForm((f) => ({ ...f, intro_text: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Was wir gemacht haben / Ergebnisse</Label>
          <Textarea
            rows={5}
            disabled={!canEdit}
            value={form.results_text}
            placeholder="Strategie, Dreh, Schnitt, Posting … und was dabei rausgekommen ist."
            onChange={(e) => setForm((f) => ({ ...f, results_text: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Kennzahlen (max. 4)</Label>
            {canEdit && stats.length < 4 && (
              <Button variant="ghost" size="sm" onClick={() => setStats([...stats, { value: "", label: "" }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Kennzahl
              </Button>
            )}
          </div>
          {stats.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="w-40"
                placeholder="+38.000"
                value={s.value}
                disabled={!canEdit}
                onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              />
              <Input
                placeholder="neue Follower"
                value={s.label}
                disabled={!canEdit}
                onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => setStats(stats.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Zitat des Kunden (optional)</Label>
          <Textarea
            rows={3}
            disabled={!canEdit}
            value={form.quote}
            onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Telefonnummer</Label>
            <Input
              value={form.phone}
              disabled={!canEdit}
              placeholder="+49 151 12345678"
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Cal.com-Link</Label>
            <Input
              value={form.cal_link}
              disabled={!canEdit}
              placeholder="https://cal.com/marketlab-media/erstgespraech"
              onChange={(e) => setForm((f) => ({ ...f, cal_link: e.target.value }))}
            />
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={() => save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Speichern
            </Button>
          </div>
        )}
      </div>

      {/* Feedback-Medien */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Feedback-Medien</h2>
          {canEdit && (
            <>
              <input
                ref={mediaInput}
                type="file"
                multiple
                accept="image/*,audio/*,video/*"
                hidden
                onChange={(e) => e.target.files?.length && uploadMedia(e.target.files)}
              />
              <Button variant="outline" size="sm" disabled={uploading} onClick={() => mediaInput.current?.click()}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />}
                Bild / Voice / Video
              </Button>
            </>
          )}
        </div>

        {!media?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Feedback-Medien hochgeladen.</p>
        ) : (
          <div className="space-y-2">
            {media.map((m) => (
              <div
                key={m.id}
                draggable={canEdit}
                onDragStart={() => (dragId.current = m.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => reorder(m.id)}
                className="flex items-center gap-3 rounded-lg border border-border p-2"
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {m.type === "image" && signed[m.id] ? (
                    <img src={signed[m.id]} alt={m.caption || "Feedback"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      {m.type === "audio" ? <Mic className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Bildunterschrift (optional)"
                    defaultValue={m.caption || ""}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value !== (m.caption || "") && updateMedia(m.id, { caption: e.target.value })}
                  />
                  {m.type === "audio" && signed[m.id] && <audio src={signed[m.id]} controls className="h-8 w-full" />}
                </div>
                {canEdit && (
                  <Button variant="ghost" size="icon" onClick={() => deleteMedia(m)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralPageEditor;
