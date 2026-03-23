import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Pencil, Check, X, ExternalLink, Globe, Phone, Mail, User, Folder, Image, BookOpen, Bell, Plus, Trash2, Link as LinkIcon, Copy, Upload, Download, Loader2, FileImage } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface CIAsset {
  name: string;
  url: string;
  path: string;
  type: string;
}

interface ClientInfoPanelProps {
  client: any;
  canEdit: boolean;
}

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ client, canEdit }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [tagInput, setTagInput] = useState("");
  const [notifyInput, setNotifyInput] = useState("");
  const [ciAssets, setCiAssets] = useState<CIAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    loadCIAssets();
  }, [client.id]);

  const loadCIAssets = async () => {
    setLoadingAssets(true);
    try {
      const { data } = await supabase.storage.from("landing-page-assets").list(`${client.id}/ci`, { limit: 100 });
      const assets: CIAsset[] = (data || [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((file) => {
          const path = `${client.id}/ci/${file.name}`;
          const { data: urlData } = supabase.storage.from("landing-page-assets").getPublicUrl(path);
          return { name: file.name, url: urlData.publicUrl, path, type: file.metadata?.mimetype?.startsWith("image/") ? "image" : "file" };
        });
      setCiAssets(assets);
    } catch { setCiAssets([]); }
    finally { setLoadingAssets(false); }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    let uploaded = 0;
    for (const file of Array.from(files)) {
      const path = `${client.id}/ci/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("landing-page-assets").upload(path, file);
      if (!error) uploaded++;
    }
    if (uploaded > 0) { toast.success(`${uploaded} Datei(en) hochgeladen`); await loadCIAssets(); }
    setIsUploading(false);
  };

  const deleteAsset = async (asset: CIAsset) => {
    await supabase.storage.from("landing-page-assets").remove([asset.path]);
    setCiAssets((prev) => prev.filter((a) => a.path !== asset.path));
    toast.success("Datei gelöscht");
  };

  const downloadFile = async (url: string, filename: string) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const startEdit = (section: string, fields: Record<string, any>) => {
    setEditing(section);
    setValues(fields);
  };

  const saveFields = async (fields: Record<string, any>) => {
    for (const [key, val] of Object.entries(fields)) {
      const oldVal = client[key];
      if (String(oldVal ?? "") !== String(val ?? "")) {
        await supabase.from("contract_changes").insert({
          client_id: client.id, field_changed: key,
          old_value: String(oldVal ?? ""), new_value: String(val ?? ""),
          changed_by: user?.id,
        });
      }
    }
    await supabase.from("clients").update(fields).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
    setEditing(null);
  };

  const toggleStatus = async () => {
    const newStatus = client.status === "active" ? "paused" : "active";
    await supabase.from("clients").update({ status: newStatus }).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setValues({ ...values, additional_products: [...(values.additional_products || []), tagInput.trim()] });
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    const current = [...(values.additional_products || [])];
    current.splice(idx, 1);
    setValues({ ...values, additional_products: current });
  };

  const kontingentSummary = [
    client.monthly_reels > 0 && `${client.monthly_reels} Reels`,
    client.monthly_carousels > 0 && `${client.monthly_carousels} Karussells`,
  ].filter(Boolean).join(" · ") || "Kein Kontingent";

  const brandingLinks = [
    { key: "drive_branding_link", label: "Branding", icon: Folder },
    { key: "drive_logo_link", label: "Logo", icon: Image },
    { key: "drive_styleguide_link", label: "Style Guide", icon: BookOpen },
  ] as const;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <input ref={fileInputRef} type="file" className="hidden" multiple
        accept="image/*,.svg,.pdf,.ai,.eps,.ttf,.otf,.woff,.woff2"
        onChange={(e) => handleUpload(e.target.files)} />

      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/20 transition-all text-left group">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-lg object-contain bg-white p-1 ring-1 ring-border" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 font-display text-base font-bold text-primary">
              {client.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-display font-bold tracking-tight truncate">{client.name}</h1>
              <Badge
                variant={client.status === "active" ? "default" : "secondary"}
                className={`text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 ${
                  client.status === "active"
                    ? "bg-runway-green/10 text-runway-green border-runway-green/20 hover:bg-runway-green/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {client.status === "active" ? "AKTIV" : "PAUSIERT"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-body">{kontingentSummary}</p>
          </div>
          {client.website_url && (
            <a href={client.website_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
          <div className={`flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 rounded-xl border border-border bg-card p-5 space-y-6"
          >
            {/* Basisinfo */}
            <Section title="Kontakt" editing={editing === "basis"} canEdit={canEdit}
              onEdit={() => startEdit("basis", {
                contact_name: client.contact_name || "", contact_phone: client.contact_phone || "",
                contact_email: client.contact_email || "", website_url: client.website_url || "", sector: client.sector || "",
              })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
              {editing === "basis" ? (
                <div className="grid grid-cols-2 gap-4">
                  <InputField icon={<User className="h-3.5 w-3.5" />} label="Ansprechpartner" value={values.contact_name} onChange={(v) => setValues({ ...values, contact_name: v })} />
                  <InputField icon={<Phone className="h-3.5 w-3.5" />} label="Telefon" value={values.contact_phone} onChange={(v) => setValues({ ...values, contact_phone: v })} />
                  <InputField icon={<Mail className="h-3.5 w-3.5" />} label="E-Mail" value={values.contact_email} onChange={(v) => setValues({ ...values, contact_email: v })} />
                  <InputField icon={<Globe className="h-3.5 w-3.5" />} label="Webseite" value={values.website_url} onChange={(v) => setValues({ ...values, website_url: v })} />
                  <InputField label="Branche" value={values.sector} onChange={(v) => setValues({ ...values, sector: v })} />
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Ansprechpartner" value={client.contact_name} />
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefon" value={client.contact_phone} />
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="E-Mail" value={client.contact_email} />
                  <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Webseite" value={client.website_url} link />
                  <InfoRow label="Branche" value={client.sector} />
                </div>
              )}
            </Section>

            {/* Branding & CI – compact */}
            <Section title="Branding & CI" editing={editing === "branding"} canEdit={canEdit}
              onEdit={() => startEdit("branding", {
                drive_branding_link: client.drive_branding_link || "",
                drive_logo_link: client.drive_logo_link || "",
                drive_styleguide_link: client.drive_styleguide_link || "",
              })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}
              extra={canEdit && !editing ? (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  disabled={isUploading}>
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </Button>
              ) : undefined}>
              {editing === "branding" ? (
                <div className="grid grid-cols-3 gap-3">
                  {brandingLinks.map((l) => (
                    <InputField key={l.key} label={l.label} value={values[l.key]} onChange={(v) => setValues({ ...values, [l.key]: v })} placeholder="https://..." />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Quick links */}
                  <div className="flex flex-wrap gap-1.5">
                    {brandingLinks.map((l) => {
                      const Icon = l.icon;
                      return client[l.key] ? (
                        <a key={l.key} href={client[l.key]} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-body text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                          <Icon className="h-3 w-3" />{l.label}<ExternalLink className="h-2.5 w-2.5 opacity-40" />
                        </a>
                      ) : null;
                    })}
                    {!brandingLinks.some((l) => client[l.key]) && ciAssets.length === 0 && (
                      <span className="text-xs text-muted-foreground">Keine Branding-Links oder CI-Dateien</span>
                    )}
                  </div>
                  {/* CI Assets – compact grid */}
                  {ciAssets.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ciAssets.map((asset) => (
                        <div key={asset.path}
                          className="group relative flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 hover:border-primary/30 transition-all cursor-pointer"
                          onClick={() => downloadFile(asset.url, asset.name.replace(/^\d+-/, ""))}>
                          {asset.type === "image" ? (
                            <img src={asset.url} alt={asset.name} className="h-7 w-7 rounded object-contain bg-muted" />
                          ) : (
                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                              <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-[11px] truncate max-w-[100px]">{asset.name.replace(/^\d+-/, "")}</span>
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteAsset(asset); }}
                              className="h-5 w-5 rounded bg-destructive/10 items-center justify-center hover:bg-destructive/20 hidden group-hover:flex absolute -top-1.5 -right-1.5">
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Vertrag & Kontingent */}
            <Section title="Vertrag & Kontingent" editing={editing === "contract"} canEdit={canEdit}
              onEdit={() => startEdit("contract", {
                monthly_reels: client.monthly_reels, monthly_carousels: client.monthly_carousels,
                monthly_stories: client.monthly_stories, contract_start: client.contract_start || "",
                contract_end: (client as any).contract_end || "", monthly_price: client.monthly_price || "",
                additional_products: client.additional_products || [],
                contract_duration: client.contract_duration || "",
              })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
              {editing === "contract" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Reels/Monat" type="number" value={values.monthly_reels} onChange={(v) => setValues({ ...values, monthly_reels: Number(v) })} />
                    <InputField label="Karussells/Monat" type="number" value={values.monthly_carousels} onChange={(v) => setValues({ ...values, monthly_carousels: Number(v) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <InputField label="Vertragsbeginn" type="date" value={values.contract_start} onChange={(v) => setValues({ ...values, contract_start: v })} />
                    <InputField label="Vertragsende" type="date" value={values.contract_end} onChange={(v) => setValues({ ...values, contract_end: v })} />
                    <InputField label="Preis/Monat (€)" type="number" value={values.monthly_price} onChange={(v) => setValues({ ...values, monthly_price: Number(v) })} />
                  </div>
                  {(client as any).contract_end && values.contract_end && values.contract_end !== (client as any).contract_end && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                      <span className="text-xs text-primary font-medium">📅 Vertragsverlängerung: {(client as any).contract_end} → {values.contract_end}</span>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-muted-foreground font-body mb-1.5 block uppercase tracking-wider">Zusatzprodukte</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(values.additional_products || []).map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="gap-1 cursor-pointer px-2 py-0.5 text-xs hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => removeTag(i)}>
                          {tag} <X className="h-2.5 w-2.5" />
                        </Badge>
                      ))}
                    </div>
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Neues Produkt + Enter"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} className="h-8 text-xs" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      { label: "Reels", value: client.monthly_reels },
                      { label: "Karussells", value: client.monthly_carousels },
                      { label: "Beginn", value: client.contract_start ? new Date(client.contract_start).toLocaleDateString("de-DE") : "–" },
                      { label: "Ende", value: (client as any).contract_end ? new Date((client as any).contract_end).toLocaleDateString("de-DE") : "–" },
                      { label: "Preis", value: client.monthly_price ? `${client.monthly_price} €` : "–" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-md bg-muted/30 px-2.5 py-2">
                        <span className="text-[10px] text-muted-foreground font-body block">{item.label}</span>
                        <span className="text-sm font-display font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {client.additional_products?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {client.additional_products.map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Strategie */}
            <Section title="Strategie & Ziel" editing={editing === "strategy"} canEdit={canEdit}
              onEdit={() => startEdit("strategy", { strategy_text: client.strategy_text || "" })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
              {editing === "strategy" ? (
                <Textarea value={values.strategy_text} onChange={(e) => setValues({ ...values, strategy_text: e.target.value })}
                  placeholder="Was machen wir für den Kunden, warum, und was ist das Ziel?" rows={4} className="text-sm" />
              ) : (
                <p className="text-xs font-body text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {client.strategy_text || "Noch keine Strategie hinterlegt."}
                </p>
              )}
            </Section>

            {/* Freigabe-Benachrichtigungen */}
            {canEdit && (
              <Section title="Benachrichtigungen" editing={editing === "notify"} canEdit={canEdit}
                onEdit={() => startEdit("notify", { review_notify_emails: client.review_notify_emails || [] })}
                onSave={() => saveFields({ review_notify_emails: values.review_notify_emails || [] })}
                onCancel={() => setEditing(null)}>
                {editing === "notify" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(values.review_notify_emails || []).map((email: string, i: number) => (
                        <Badge key={i} variant="secondary" className="gap-1 cursor-pointer px-2 py-0.5 text-xs hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => {
                            const updated = [...(values.review_notify_emails || [])];
                            updated.splice(i, 1);
                            setValues({ ...values, review_notify_emails: updated });
                          }}>
                          <Mail className="h-2.5 w-2.5" />{email}<X className="h-2.5 w-2.5" />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <Input type="email" value={notifyInput} onChange={(e) => setNotifyInput(e.target.value)}
                        placeholder="E-Mail hinzufügen" className="h-8 text-xs flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && notifyInput.includes("@")) {
                            e.preventDefault();
                            setValues({ ...values, review_notify_emails: [...(values.review_notify_emails || []), notifyInput.trim()] });
                            setNotifyInput("");
                          }
                        }} />
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => {
                        if (notifyInput.includes("@")) {
                          setValues({ ...values, review_notify_emails: [...(values.review_notify_emails || []), notifyInput.trim()] });
                          setNotifyInput("");
                        }
                      }}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(client.review_notify_emails || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {client.review_notify_emails.map((email: string, i: number) => (
                          <Badge key={i} variant="outline" className="gap-1 px-2 py-0.5 text-[11px]">
                            <Mail className="h-2.5 w-2.5" />{email}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5" /> Keine E-Mails konfiguriert
                      </p>
                    )}

                    {client.approval_token && (
                      <div className="rounded-md bg-muted/30 p-2.5 flex items-center gap-2">
                        <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                        <code className="text-[10px] text-muted-foreground truncate flex-1">
                          {`${window.location.origin}/approve/${client.approval_token}`}
                        </code>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 shrink-0" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/approve/${client.approval_token}`);
                          toast.success("Link kopiert");
                        }}><Copy className="h-3 w-3" /></Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-muted-foreground">Marketing-Tracking im Freigabelink</span>
                      <Switch
                        checked={!!client.show_marketing_approval}
                        onCheckedChange={async (checked) => {
                          await supabase.from("clients").update({ show_marketing_approval: checked } as any).eq("id", client.id);
                          queryClient.invalidateQueries({ queryKey: ["client", client.id] });
                          toast.success(checked ? "Marketing-Tracking aktiviert" : "Marketing-Tracking deaktiviert");
                        }}
                      />
                    </div>
                  </div>
                )}
              </Section>
            )}

            {canEdit && (
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">{client.status === "active" ? "Aktiv" : "Pausiert"}</span>
                <Switch checked={client.status === "active"} onCheckedChange={toggleStatus} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Helper components
const Section: React.FC<{
  title: string; editing: boolean; canEdit: boolean; children: React.ReactNode;
  onEdit: () => void; onSave: () => void; onCancel: () => void; extra?: React.ReactNode;
}> = ({ title, editing, canEdit, children, onEdit, onSave, onCancel, extra }) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-xs font-semibold tracking-tight text-foreground uppercase">{title}</h3>
      <div className="flex items-center gap-1">
        {extra}
        {canEdit && (
          editing ? (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 w-6 p-0 rounded hover:bg-destructive/10 hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onSave} className="h-6 w-6 p-0 rounded text-primary hover:bg-primary/10">
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={onEdit} className="h-6 w-6 p-0 rounded hover:bg-muted">
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          )
        )}
      </div>
    </div>
    {children}
  </div>
);

const InputField: React.FC<{
  label: string; value: any; onChange: (v: string) => void;
  icon?: React.ReactNode; type?: string; placeholder?: string;
}> = ({ label, value, onChange, icon, type = "text", placeholder }) => (
  <div>
    <label className="text-[10px] text-muted-foreground font-body mb-1 flex items-center gap-1 uppercase tracking-wider">
      {icon}{label}
    </label>
    <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-xs bg-muted/30 border-border" />
  </div>
);

const InfoRow: React.FC<{ label: string; value: any; icon?: React.ReactNode; link?: boolean }> = ({ label, value, icon, link }) => (
  <div className="flex items-start gap-2">
    {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
    <div>
      <span className="text-[10px] text-muted-foreground font-body block">{label}</span>
      {link && value ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 text-xs transition-colors truncate block max-w-[200px]">{value}</a>
      ) : (
        <span className="text-xs font-body">{value || "–"}</span>
      )}
    </div>
  </div>
);

export default ClientInfoPanel;
