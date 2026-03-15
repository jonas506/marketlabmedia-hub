import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp, Pencil, Check, X, ExternalLink, Globe, Phone, Mail, User, Folder, Image, BookOpen, Bell, Plus, Trash2, Link as LinkIcon, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ClientInfoPanelProps {
  client: any;
  canEdit: boolean;
}

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ client, canEdit }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [tagInput, setTagInput] = useState("");
  const [notifyInput, setNotifyInput] = useState("");
  const qc = useQueryClient();
  const { user } = useAuth();

  const startEdit = (section: string, fields: Record<string, any>) => {
    setEditing(section);
    setValues(fields);
  };

  const saveFields = async (fields: Record<string, any>) => {
    for (const [key, val] of Object.entries(fields)) {
      const oldVal = client[key];
      if (String(oldVal ?? "") !== String(val ?? "")) {
        await supabase.from("contract_changes").insert({
          client_id: client.id,
          field_changed: key,
          old_value: String(oldVal ?? ""),
          new_value: String(val ?? ""),
          changed_by: user?.id,
        });
      }
    }
    await supabase.from("clients").update(fields).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    setEditing(null);
  };

  const toggleStatus = async () => {
    const newStatus = client.status === "active" ? "paused" : "active";
    await supabase.from("clients").update({ status: newStatus }).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const current = values.additional_products || [];
    setValues({ ...values, additional_products: [...current, tagInput.trim()] });
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    const current = [...(values.additional_products || [])];
    current.splice(idx, 1);
    setValues({ ...values, additional_products: current });
  };

  const kontingentSummary = `${client.monthly_reels} Reels · ${client.monthly_carousels} Karussells · ${client.monthly_stories} Stories`;

  const brandingLinks = [
    { key: "drive_branding_link", label: "Branding", icon: Folder },
    { key: "drive_logo_link", label: "Logo", icon: Image },
    { key: "drive_styleguide_link", label: "Style Guide", icon: BookOpen },
  ] as const;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-5 rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-all duration-300 text-left group">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-12 w-12 rounded-xl object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 font-display text-lg font-bold text-primary">
              {client.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-0.5">
              <h1 className="text-xl font-display font-bold tracking-tight truncate">{client.name}</h1>
              <Badge
                variant={client.status === "active" ? "default" : "secondary"}
                className={`text-[10px] font-mono tracking-wider uppercase px-2.5 ${
                  client.status === "active"
                    ? "bg-runway-green/10 text-runway-green border-runway-green/20 hover:bg-runway-green/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {client.status === "active" ? "AKTIV" : "PAUSIERT"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-body">{kontingentSummary}</p>
          </div>
          {client.website_url && (
            <a href={client.website_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
              <Globe className="h-4 w-4" />
            </a>
          )}
          <div className={`flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 text-muted-foreground transition-all ${open ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-2 rounded-xl border border-border bg-card p-7 space-y-8"
          >
            {/* Basisinfo */}
            <Section title="Basisinfo" editing={editing === "basis"} canEdit={canEdit}
              onEdit={() => startEdit("basis", {
                contact_name: client.contact_name || "", contact_phone: client.contact_phone || "",
                contact_email: client.contact_email || "", website_url: client.website_url || "", sector: client.sector || "",
              })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
              {editing === "basis" ? (
                <div className="grid grid-cols-2 gap-5">
                  <InputField icon={<User className="h-4 w-4" />} label="Ansprechpartner" value={values.contact_name} onChange={(v) => setValues({ ...values, contact_name: v })} />
                  <InputField icon={<Phone className="h-4 w-4" />} label="Telefon" value={values.contact_phone} onChange={(v) => setValues({ ...values, contact_phone: v })} />
                  <InputField icon={<Mail className="h-4 w-4" />} label="E-Mail" value={values.contact_email} onChange={(v) => setValues({ ...values, contact_email: v })} />
                  <InputField icon={<Globe className="h-4 w-4" />} label="Webseite" value={values.website_url} onChange={(v) => setValues({ ...values, website_url: v })} />
                  <InputField label="Branche" value={values.sector} onChange={(v) => setValues({ ...values, sector: v })} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow icon={<User className="h-4 w-4" />} label="Ansprechpartner" value={client.contact_name} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefon" value={client.contact_phone} />
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="E-Mail" value={client.contact_email} />
                  <InfoRow icon={<Globe className="h-4 w-4" />} label="Webseite" value={client.website_url} link />
                  <InfoRow label="Branche" value={client.sector} />
                </div>
              )}
            </Section>

            {/* Branding */}
            <Section title="Branding" editing={editing === "branding"} canEdit={canEdit}
              onEdit={() => startEdit("branding", {
                drive_branding_link: client.drive_branding_link || "",
                drive_logo_link: client.drive_logo_link || "",
                drive_styleguide_link: client.drive_styleguide_link || "",
              })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
              {editing === "branding" ? (
                <div className="space-y-4">
                  {brandingLinks.map((l) => (
                    <InputField key={l.key} label={l.label} value={values[l.key]} onChange={(v) => setValues({ ...values, [l.key]: v })} placeholder="https://..." />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {brandingLinks.map((l) => {
                    const Icon = l.icon;
                    return client[l.key] ? (
                      <a key={l.key} href={client[l.key]} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-body text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-200">
                        <Icon className="h-4 w-4" />
                        {l.label}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    ) : null;
                  })}
                  {!brandingLinks.some((l) => client[l.key]) && (
                    <span className="text-sm text-muted-foreground font-body">Keine Links hinterlegt</span>
                  )}
                </div>
              )}
            </Section>

            {/* Vertrag & Kontingent */}
            <Section title="Vertrag & Kontingent" editing={editing === "contract"} canEdit={canEdit}
              onEdit={() => startEdit("contract", {
                monthly_reels: client.monthly_reels, monthly_carousels: client.monthly_carousels,
                monthly_stories: client.monthly_stories, contract_start: client.contract_start || "",
                contract_duration: client.contract_duration || "", monthly_price: client.monthly_price || "",
                additional_products: client.additional_products || [],
              })}
              onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
              {editing === "contract" ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <InputField label="Reels/Monat" type="number" value={values.monthly_reels} onChange={(v) => setValues({ ...values, monthly_reels: Number(v) })} />
                    <InputField label="Karussells/Monat" type="number" value={values.monthly_carousels} onChange={(v) => setValues({ ...values, monthly_carousels: Number(v) })} />
                    <InputField label="Stories/Monat" type="number" value={values.monthly_stories} onChange={(v) => setValues({ ...values, monthly_stories: Number(v) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <InputField label="Vertragsbeginn" type="date" value={values.contract_start} onChange={(v) => setValues({ ...values, contract_start: v })} />
                    <InputField label="Laufzeit" value={values.contract_duration} onChange={(v) => setValues({ ...values, contract_duration: v })} placeholder="z.B. 12 Monate" />
                    <InputField label="Preis/Monat (€)" type="number" value={values.monthly_price} onChange={(v) => setValues({ ...values, monthly_price: Number(v) })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-body mb-2 block uppercase tracking-wider">Zusatzprodukte</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(values.additional_products || []).map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="gap-1.5 cursor-pointer px-3 py-1 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => removeTag(i)}>
                          {tag} <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Neues Produkt + Enter"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} className="h-10" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Reels", value: client.monthly_reels, suffix: "/Monat" },
                      { label: "Karussells", value: client.monthly_carousels, suffix: "/Monat" },
                      { label: "Stories", value: client.monthly_stories, suffix: "/Monat" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-muted/30 p-3.5">
                        <span className="text-xs text-muted-foreground font-body block mb-1">{item.label}</span>
                        <span className="text-lg font-display font-bold">{item.value}</span>
                        <span className="text-xs text-muted-foreground ml-1">{item.suffix}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <InfoRow label="Vertragsbeginn" value={client.contract_start} />
                    <InfoRow label="Laufzeit" value={client.contract_duration} />
                    <InfoRow label="Preis/Monat" value={client.monthly_price ? `${client.monthly_price} €` : null} />
                  </div>
                  {client.additional_products?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {client.additional_products.map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs px-2.5 py-1">{t}</Badge>
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
                  placeholder="Was machen wir für den Kunden, warum, und was ist das Ziel?" rows={5} className="text-sm" />
              ) : (
                <p className="text-sm font-body text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {client.strategy_text || "Noch keine Strategie hinterlegt."}
                </p>
              )}
            </Section>

            {/* Freigabe-Benachrichtigungen */}
            {canEdit && (
              <Section title="Freigabe-Benachrichtigungen" editing={editing === "notify"} canEdit={canEdit}
                onEdit={() => startEdit("notify", { review_notify_emails: client.review_notify_emails || [] })}
                onSave={() => saveFields({ review_notify_emails: values.review_notify_emails || [] })}
                onCancel={() => setEditing(null)}>
                {editing === "notify" ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-body">
                      Diese E-Mail-Adressen werden benachrichtigt, wenn Content zur Freigabe bereitsteht (alle 3 Stunden gesammelt).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(values.review_notify_emails || []).map((email: string, i: number) => (
                        <Badge key={i} variant="secondary" className="gap-1.5 cursor-pointer px-3 py-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => {
                            const updated = [...(values.review_notify_emails || [])];
                            updated.splice(i, 1);
                            setValues({ ...values, review_notify_emails: updated });
                          }}>
                          <Mail className="h-3 w-3" />
                          {email}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={notifyInput}
                        onChange={(e) => setNotifyInput(e.target.value)}
                        placeholder="E-Mail-Adresse hinzufügen"
                        className="h-10 text-sm bg-muted/30 border-border flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (notifyInput.trim() && notifyInput.includes("@")) {
                              setValues({ ...values, review_notify_emails: [...(values.review_notify_emails || []), notifyInput.trim()] });
                              setNotifyInput("");
                            }
                          }
                        }}
                      />
                      <Button size="sm" variant="outline" className="h-10 px-3" onClick={() => {
                        if (notifyInput.trim() && notifyInput.includes("@")) {
                          setValues({ ...values, review_notify_emails: [...(values.review_notify_emails || []), notifyInput.trim()] });
                          setNotifyInput("");
                        }
                      }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(client.review_notify_emails || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {client.review_notify_emails.map((email: string, i: number) => (
                          <Badge key={i} variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
                            <Mail className="h-3 w-3" />
                            {email}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground font-body flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Keine Benachrichtigungs-Adressen konfiguriert.
                      </p>
                    )}
                  </div>
                )}
              </Section>
            )}

            {canEdit && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <span className="text-sm font-display font-semibold block">Status</span>
                  <span className="text-xs text-muted-foreground font-body">{client.status === "active" ? "Kunde ist aktiv" : "Kunde ist pausiert"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-body ${client.status === "active" ? "text-runway-green" : "text-muted-foreground"}`}>
                    {client.status === "active" ? "Aktiv" : "Pausiert"}
                  </span>
                  <Switch checked={client.status === "active"} onCheckedChange={toggleStatus} />
                </div>
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
  onEdit: () => void; onSave: () => void; onCancel: () => void;
}> = ({ title, editing, canEdit, children, onEdit, onSave, onCancel }) => (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {canEdit && (
        editing ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive">
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onSave} className="h-8 w-8 p-0 rounded-lg text-primary hover:bg-primary/10">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 w-8 p-0 rounded-lg hover:bg-muted">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )
      )}
    </div>
    {children}
  </div>
);

const InputField: React.FC<{
  label: string; value: any; onChange: (v: string) => void;
  icon?: React.ReactNode; type?: string; placeholder?: string;
}> = ({ label, value, onChange, icon, type = "text", placeholder }) => (
  <div>
    <label className="text-xs text-muted-foreground font-body mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
      {icon}{label}
    </label>
    <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 text-sm bg-muted/30 border-border" />
  </div>
);

const InfoRow: React.FC<{ label: string; value: any; icon?: React.ReactNode; link?: boolean }> = ({ label, value, icon, link }) => (
  <div className="flex items-start gap-2.5">
    {icon && <span className="mt-1 text-muted-foreground">{icon}</span>}
    <div>
      <span className="text-xs text-muted-foreground font-body block mb-0.5">{label}</span>
      {link && value ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 text-sm transition-colors">{value}</a>
      ) : (
        <span className="text-sm font-body">{value || "–"}</span>
      )}
    </div>
  </div>
);

export default ClientInfoPanel;
