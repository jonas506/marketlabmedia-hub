import { useState } from "react";
import { MessageCircle, Phone, Mail, Linkedin, Instagram, Plus, X, Ban } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/crm-contacts";

export interface HeaderAction {
  href: string;
  icon: typeof Mail;
  label: string;
  enabled: boolean;
}

export function buildQuickActions(c: {
  whatsapp?: string | null; phone?: string | null; email?: string | null;
  linkedin_url?: string | null; instagram_handle?: string | null;
}): HeaderAction[] {
  const wa = waLink(c.whatsapp || c.phone);
  const ig = c.instagram_handle?.replace(/^@/, "");
  const li = c.linkedin_url ? (/^https?:/.test(c.linkedin_url) ? c.linkedin_url : `https://${c.linkedin_url}`) : null;
  return [
    { href: wa ?? "", icon: MessageCircle, label: "WhatsApp", enabled: !!wa },
    { href: c.phone ? `tel:${c.phone}` : "", icon: Phone, label: "Anrufen", enabled: !!c.phone },
    { href: c.email ? `mailto:${c.email}` : "", icon: Mail, label: "Mail", enabled: !!c.email },
    { href: li ?? "", icon: Linkedin, label: "LinkedIn", enabled: !!li },
    { href: ig ? `https://instagram.com/${ig}` : "", icon: Instagram, label: "Instagram", enabled: !!ig },
  ];
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

export default function CrmDetailHeader({
  name, subtitle, badges, tags, onTagsChange, actions, extra, doNotContact,
}: {
  name: string;
  subtitle?: string | null;
  badges?: React.ReactNode;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  actions: HeaderAction[];
  extra?: React.ReactNode;
  doNotContact?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    const t = newTag.trim();
    if (t && onTagsChange && !(tags ?? []).includes(t)) onTagsChange([...(tags ?? []), t]);
    setNewTag(""); setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4 min-w-0">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
            {name}
            {doNotContact && <Ban className="h-5 w-5 text-destructive shrink-0" />}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {badges}
            {(tags ?? []).map(t => (
              <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {t}
                {onTagsChange && (
                  <button onClick={() => onTagsChange((tags ?? []).filter(x => x !== t))} className="hover:text-foreground" aria-label={`Tag ${t} entfernen`}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {onTagsChange && (adding ? (
              <Input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                onBlur={addTag} onKeyDown={e => { if (e.key === "Enter") addTag(); if (e.key === "Escape") { setAdding(false); setNewTag(""); } }}
                className="h-6 w-28 text-xs px-2" placeholder="Tag…" />
            ) : (
              <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50">
                <Plus className="h-3 w-3" />Tag
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions.map(a => (
          <a key={a.label} href={a.enabled ? a.href : undefined} target="_blank" rel="noreferrer"
            aria-label={a.label} title={a.label}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors",
              a.enabled ? "hover:border-primary/50 hover:text-primary" : "opacity-30 pointer-events-none"
            )}>
            <a.icon className="h-4 w-4" />
          </a>
        ))}
        {extra}
      </div>
    </div>
  );
}
