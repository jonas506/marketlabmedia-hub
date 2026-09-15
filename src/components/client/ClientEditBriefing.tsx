import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Check, Pencil, Eye, Printer, Loader2, Plus, X } from "lucide-react";

type Briefing = Record<string, any>;

const TEXT_FIELDS: { group: string; fields: { key: string; label: string; long?: boolean }[] }[] = [
  {
    group: "Typografie",
    fields: [
      { key: "subtitle_font", label: "Schriftart Untertitel" },
      { key: "overlay_font", label: "Schriftart Einblendungen" },
      { key: "font_size_note", label: "Größe / Gewicht" },
      { key: "text_case", label: "Groß-/Kleinschreibung" },
    ],
  },
  {
    group: "Untertitel",
    fields: [
      { key: "subtitle_style", label: "Stil" },
      { key: "subtitle_position", label: "Position" },
      { key: "subtitle_highlight_color", label: "Hervorfarbe" },
      { key: "subtitle_max_chars", label: "Max. Zeichen pro Zeile" },
      { key: "subtitle_animation", label: "Animation" },
    ],
  },
  {
    group: "Schnittstil",
    fields: [
      { key: "pacing", label: "Tempo" },
      { key: "cut_frequency", label: "Cut-Frequenz" },
      { key: "motion", label: "Zoom / Bewegung" },
      { key: "transitions", label: "Erlaubte Übergänge" },
      { key: "broll_rules", label: "B-Roll-Regeln", long: true },
    ],
  },
  {
    group: "Sound",
    fields: [
      { key: "music_style", label: "Musikrichtung" },
      { key: "music_volume", label: "Lautstärke" },
    ],
  },
  {
    group: "Intro / Outro",
    fields: [
      { key: "hook_rules", label: "Hook-Regeln", long: true },
      { key: "logo_usage", label: "Logo-Einsatz" },
      { key: "outro_cta", label: "Call-to-Action am Ende" },
    ],
  },
  {
    group: "Export",
    fields: [
      { key: "export_format", label: "Format" },
      { key: "export_resolution", label: "Auflösung" },
      { key: "export_framerate", label: "Framerate" },
      { key: "file_naming", label: "Dateibenennung" },
    ],
  },
];

const ColorChip = ({ label, value }: { label: string; value?: string | null }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-left transition-colors hover:border-primary/50"
    >
      <span
        className="h-7 w-7 shrink-0 rounded-md ring-1 ring-border"
        style={{ backgroundColor: value }}
      />
      <span className="min-w-0">
        <span className="block text-[10px] text-muted-foreground">{label}</span>
        <span className="block font-mono text-xs">{value}</span>
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
};

const ListEditor = ({
  label,
  items,
  onChange,
}: { label: string; items: string[]; onChange: (v: string[]) => void }) => (
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {items.map((item, i) => (
      <div key={i} className="flex gap-2">
        <Input
          value={item}
          onChange={(e) => {
            const next = [...items];
            next[i] = e.target.value;
            onChange(next);
          }}
          className="h-9 text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground"
          onClick={() => onChange(items.filter((_, idx) => idx !== i))}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    ))}
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onChange([...items, ""])}>
      <Plus className="h-3 w-3" /> Hinzufügen
    </Button>
  </div>
);

const ClientEditBriefing = ({ client, canEdit }: { client: any; canEdit: boolean }) => {
  const qc = useQueryClient();
  const clientId = client.id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Briefing>({});
  const [saving, setSaving] = useState(false);

  const { data: briefing, isLoading } = useQuery({
    queryKey: ["client-edit-briefing", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_edit_briefings")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setForm(briefing ?? {});
  }, [briefing]);

  const list = (key: string): string[] =>
    Array.isArray(form[key]) ? (form[key] as string[]) : [];

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    const payload: Briefing = { client_id: clientId };
    TEXT_FIELDS.forEach((g) => g.fields.forEach((f) => (payload[f.key] = form[f.key] ?? null)));
    payload.sfx_allowed = form.sfx_allowed ?? null;
    payload.notes = form.notes ?? null;
    payload.dos = list("dos").filter(Boolean);
    payload.donts = list("donts").filter(Boolean);
    payload.reference_links = list("reference_links").filter(Boolean);
    const { error } = await supabase
      .from("client_edit_briefings")
      .upsert(payload, { onConflict: "client_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Briefing gespeichert");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["client-edit-briefing", clientId] });
  };

  const filledGroups = useMemo(
    () =>
      TEXT_FIELDS.map((g) => ({
        ...g,
        fields: g.fields.filter((f) => !!briefing?.[f.key]),
      })).filter((g) => g.fields.length > 0),
    [briefing]
  );

  const dos: string[] = (briefing?.dos as string[]) ?? [];
  const donts: string[] = (briefing?.donts as string[]) ?? [];
  const refs: string[] = (briefing?.reference_links as string[]) ?? [];

  const driveLinks = [
    { label: "Branding-Ordner", url: client.drive_branding_link },
    { label: "Logos", url: client.drive_logo_link },
    { label: "Styleguide", url: client.drive_styleguide_link },
  ].filter((l) => l.url);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div>
          <h2 className="font-display text-lg font-bold">Schnitt-Briefing</h2>
          <p className="text-xs text-muted-foreground">
            Alles, was für den Schnitt von {client.name} gilt.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Drucken
          </Button>
          {canEdit && (
            <Button
              variant={editing ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing ? "Briefing ansehen" : "Bearbeiten"}
            </Button>
          )}
        </div>
      </div>

      {/* Farben */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Marke</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <ColorChip label="Primär" value={client.brand_primary} />
          <ColorChip label="Sekundär" value={client.brand_secondary} />
          <ColorChip label="Akzent" value={client.brand_accent} />
          <ColorChip label="Text hell" value={client.brand_text_light} />
          <ColorChip label="Text dunkel" value={client.brand_text_dark} />
        </div>
        {client.brand_font_style && (
          <p className="mt-3 text-xs text-muted-foreground">
            Markenschrift: <span className="text-foreground">{client.brand_font_style}</span>
          </p>
        )}
        {driveLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {driveLinks.map((l) => (
              <a
                key={l.label}
                href={l.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-primary hover:border-primary/50"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <div className="space-y-4">
          {TEXT_FIELDS.map((g) => (
            <section key={g.group} className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {g.group}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.fields.map((f) => (
                  <div key={f.key} className={f.long ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    {f.long ? (
                      <Textarea
                        value={form[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="min-h-[70px] text-sm"
                      />
                    ) : (
                      <Input
                        value={form[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="h-9 text-sm"
                      />
                    )}
                  </div>
                ))}
                {g.group === "Sound" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Soundeffekte erlaubt</Label>
                    <select
                      value={form.sfx_allowed === null || form.sfx_allowed === undefined ? "" : String(form.sfx_allowed)}
                      onChange={(e) =>
                        set("sfx_allowed", e.target.value === "" ? null : e.target.value === "true")
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">—</option>
                      <option value="true">Ja</option>
                      <option value="false">Nein</option>
                    </select>
                  </div>
                )}
              </div>
            </section>
          ))}

          <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <ListEditor label="Do's" items={list("dos")} onChange={(v) => set("dos", v)} />
            <ListEditor label="Don'ts" items={list("donts")} onChange={(v) => set("donts", v)} />
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <ListEditor
              label="Referenzen (Links)"
              items={list("reference_links")}
              onChange={(v) => set("reference_links", v)}
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zusätzliche Hinweise</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                className="min-h-[90px] text-sm"
              />
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setForm(briefing ?? {}); setEditing(false); }}>
              Abbrechen
            </Button>
            <Button size="sm" className="text-xs" onClick={save} disabled={saving}>
              {saving ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filledGroups.length === 0 &&
          !dos.length &&
          !donts.length &&
          !refs.length &&
          !briefing?.notes ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Noch kein Briefing hinterlegt.
              {canEdit && " Klicke auf „Bearbeiten“, um zu starten."}
            </div>
          ) : (
            <>
              {filledGroups.map((g) => (
                <section key={g.group} className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {g.group}
                  </h3>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {g.fields.map((f) => (
                      <div key={f.key} className={f.long ? "sm:col-span-2" : ""}>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </dt>
                        <dd className="whitespace-pre-wrap text-sm">{briefing?.[f.key]}</dd>
                      </div>
                    ))}
                    {g.group === "Sound" && briefing?.sfx_allowed !== null && briefing?.sfx_allowed !== undefined && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Soundeffekte
                        </dt>
                        <dd className="text-sm">{briefing.sfx_allowed ? "Erlaubt" : "Nicht erlaubt"}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              ))}

              {(dos.length > 0 || donts.length > 0) && (
                <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
                  {dos.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-status-done">Do's</h3>
                      <ul className="space-y-1 text-sm">
                        {dos.map((d, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-status-done">+</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {donts.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-destructive">Don'ts</h3>
                      <ul className="space-y-1 text-sm">
                        {donts.map((d, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-destructive">–</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {refs.length > 0 && (
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Referenzen
                  </h3>
                  <ul className="space-y-1">
                    {refs.map((r, i) => (
                      <li key={i}>
                        <a
                          href={r}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sm text-primary hover:underline"
                        >
                          {r}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {briefing?.notes && (
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Hinweise
                  </h3>
                  <p className="whitespace-pre-wrap text-sm">{briefing.notes}</p>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientEditBriefing;
