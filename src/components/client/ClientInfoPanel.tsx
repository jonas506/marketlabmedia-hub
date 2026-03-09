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
import { ChevronDown, ChevronUp, Pencil, Check, X, ExternalLink, Globe, Phone, Mail, User } from "lucide-react";

interface ClientInfoPanelProps {
  client: any;
  canEdit: boolean;
}

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ client, canEdit }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [tagInput, setTagInput] = useState("");
  const qc = useQueryClient();
  const { user } = useAuth();

  const startEdit = (section: string, fields: Record<string, any>) => {
    setEditing(section);
    setValues(fields);
  };

  const saveFields = async (fields: Record<string, any>) => {
    // Log contract changes
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

  const kontingentSummary = `${client.monthly_reels} Reels · ${client.monthly_carousels} Karussells · ${client.monthly_stories} Stories/Monat`;

  const brandingLinks = [
    { key: "drive_branding_link", label: "Branding-Ordner" },
    { key: "drive_logo_link", label: "Logo-Download" },
    { key: "drive_styleguide_link", label: "Style Guide" },
  ] as const;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* Collapsed bar */}
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors text-left">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted font-mono text-sm text-muted-foreground">
              {client.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold truncate">{client.name}</h1>
              <Badge variant={client.status === "active" ? "default" : "secondary"} className="text-xs">
                {client.status === "active" ? "AKTIV" : "PAUSIERT"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-body truncate">{kontingentSummary}</p>
          </div>
          {client.website_url && (
            <a href={client.website_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary">
              <Globe className="h-4 w-4" />
            </a>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-lg border border-border bg-card p-6 space-y-6">
          {/* Basisinfo */}
          <Section title="BASISINFO" editing={editing === "basis"} canEdit={canEdit}
            onEdit={() => startEdit("basis", {
              contact_name: client.contact_name || "", contact_phone: client.contact_phone || "",
              contact_email: client.contact_email || "", website_url: client.website_url || "", sector: client.sector || "",
            })}
            onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
            {editing === "basis" ? (
              <div className="grid grid-cols-2 gap-4">
                <InputField icon={<User className="h-4 w-4" />} label="Ansprechpartner" value={values.contact_name} onChange={(v) => setValues({ ...values, contact_name: v })} />
                <InputField icon={<Phone className="h-4 w-4" />} label="Telefon" value={values.contact_phone} onChange={(v) => setValues({ ...values, contact_phone: v })} />
                <InputField icon={<Mail className="h-4 w-4" />} label="E-Mail" value={values.contact_email} onChange={(v) => setValues({ ...values, contact_email: v })} />
                <InputField icon={<Globe className="h-4 w-4" />} label="Webseite" value={values.website_url} onChange={(v) => setValues({ ...values, website_url: v })} />
                <InputField label="Branche" value={values.sector} onChange={(v) => setValues({ ...values, sector: v })} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm font-body">
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Ansprechpartner" value={client.contact_name} />
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefon" value={client.contact_phone} />
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="E-Mail" value={client.contact_email} />
                <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Webseite" value={client.website_url} link />
                <InfoRow label="Branche" value={client.sector} />
              </div>
            )}
          </Section>

          {/* Branding */}
          <Section title="BRANDING" editing={editing === "branding"} canEdit={canEdit}
            onEdit={() => startEdit("branding", {
              drive_branding_link: client.drive_branding_link || "",
              drive_logo_link: client.drive_logo_link || "",
              drive_styleguide_link: client.drive_styleguide_link || "",
            })}
            onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
            {editing === "branding" ? (
              <div className="space-y-3">
                {brandingLinks.map((l) => (
                  <InputField key={l.key} label={l.label} value={values[l.key]} onChange={(v) => setValues({ ...values, [l.key]: v })} placeholder="https://..." />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {brandingLinks.map((l) => (
                  client[l.key] ? (
                    <a key={l.key} href={client[l.key]} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-body text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                      <ExternalLink className="h-3 w-3" />{l.label}
                    </a>
                  ) : null
                ))}
                {!brandingLinks.some((l) => client[l.key]) && (
                  <span className="text-xs text-muted-foreground font-body">Keine Links hinterlegt</span>
                )}
              </div>
            )}
          </Section>

          {/* Vertrag & Kontingent */}
          <Section title="VERTRAG & KONTINGENT" editing={editing === "contract"} canEdit={canEdit}
            onEdit={() => startEdit("contract", {
              monthly_reels: client.monthly_reels, monthly_carousels: client.monthly_carousels,
              monthly_stories: client.monthly_stories, contract_start: client.contract_start || "",
              contract_duration: client.contract_duration || "", monthly_price: client.monthly_price || "",
              additional_products: client.additional_products || [],
            })}
            onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
            {editing === "contract" ? (
              <div className="space-y-4">
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
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Zusatzprodukte</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(values.additional_products || []).map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(i)}>
                        {tag} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Neues Produkt + Enter"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} className="h-8 text-sm" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm font-body">
                  <div><span className="text-muted-foreground">Reels</span> <span className="font-semibold">{client.monthly_reels}/Monat</span></div>
                  <div><span className="text-muted-foreground">Karussells</span> <span className="font-semibold">{client.monthly_carousels}/Monat</span></div>
                  <div><span className="text-muted-foreground">Stories</span> <span className="font-semibold">{client.monthly_stories}/Monat</span></div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm font-body">
                  <InfoRow label="Vertragsbeginn" value={client.contract_start} />
                  <InfoRow label="Laufzeit" value={client.contract_duration} />
                  <InfoRow label="Preis/Monat" value={client.monthly_price ? `${client.monthly_price} €` : null} />
                </div>
                {client.additional_products?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {client.additional_products.map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Strategie */}
          <Section title="STRATEGIE & ZIEL" editing={editing === "strategy"} canEdit={canEdit}
            onEdit={() => startEdit("strategy", { strategy_text: client.strategy_text || "" })}
            onSave={() => saveFields(values)} onCancel={() => setEditing(null)}>
            {editing === "strategy" ? (
              <Textarea value={values.strategy_text} onChange={(e) => setValues({ ...values, strategy_text: e.target.value })}
                placeholder="Was machen wir für den Kunden, warum, und was ist das Ziel?" rows={4} />
            ) : (
              <p className="text-sm font-body text-muted-foreground whitespace-pre-wrap">
                {client.strategy_text || "Noch keine Strategie hinterlegt."}
              </p>
            )}
          </Section>

          {/* Status Toggle */}
          {canEdit && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-mono text-xs text-muted-foreground">STATUS</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-body text-muted-foreground">{client.status === "active" ? "Aktiv" : "Pausiert"}</span>
                <Switch checked={client.status === "active"} onCheckedChange={toggleStatus} />
              </div>
            </div>
          )}
        </div>
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
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">{title}</h3>
      {canEdit && (
        editing ? (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onSave} className="text-primary"><Check className="h-3.5 w-3.5" /></Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
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
    <label className="text-xs text-muted-foreground font-body mb-1 flex items-center gap-1">
      {icon}{label}
    </label>
    <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
  </div>
);

const InfoRow: React.FC<{ label: string; value: any; icon?: React.ReactNode; link?: boolean }> = ({ label, value, icon, link }) => (
  <div className="flex items-start gap-2">
    {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      {link && value ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">{value}</a>
      ) : (
        <span className="text-xs">{value || "–"}</span>
      )}
    </div>
  </div>
);

export default ClientInfoPanel;
