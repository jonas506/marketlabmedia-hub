import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DetailField {
  key: string;
  label: string;
  value: string | null;
  type?: "text" | "date" | "select" | "link" | "email" | "tel";
  options?: { value: string; label: string }[];
  href?: string | null;
}

export interface DetailGroup {
  title: string;
  fields: DetailField[];
}

function FieldRow({ f, onSave }: { f: DetailField; onSave: (key: string, value: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v !== (f.value ?? "")) onSave(f.key, v || null);
  };

  return (
    <div className="flex items-baseline gap-3 py-1 group">
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground/70">{f.label}</span>
      {f.type === "select" && f.options ? (
        <Select value={f.value ?? ""} onValueChange={v => onSave(f.key, v || null)}>
          <SelectTrigger className="h-7 border-none bg-transparent px-1 text-sm shadow-none focus:ring-0 w-auto gap-1.5">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : editing ? (
        <Input autoFocus type={f.type === "date" ? "date" : "text"} defaultValue={f.value ?? ""}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 flex-1 text-sm px-1" />
      ) : (
        <button onClick={() => { setDraft(f.value ?? ""); setEditing(true); }}
          className="flex-1 min-w-0 text-left text-sm rounded px-1 -mx-1 hover:bg-muted/40 transition-colors truncate">
          {f.value ? (
            f.href ? (
              <a href={f.href} target={f.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                onClick={e => e.stopPropagation()} className="text-primary hover:underline">{f.value}</a>
            ) : <span>{f.value}</span>
          ) : (
            <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70">—</span>
          )}
        </button>
      )}
    </div>
  );
}

export default function DetailsPanel({ groups, onSave }: { groups: DetailGroup[]; onSave: (key: string, value: string | null) => void }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const visible = groups.map(g => ({
    ...g,
    fields: showEmpty ? g.fields : g.fields.filter(f => f.value),
  })).filter(g => g.fields.length > 0);
  const hiddenCount = groups.reduce((n, g) => n + g.fields.filter(f => !f.value).length, 0);

  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</h2>
      <div className="space-y-4">
        {visible.map(g => (
          <div key={g.title}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1">{g.title}</p>
            <div className="divide-y divide-border/40">
              {g.fields.map(f => <FieldRow key={f.key} f={f} onSave={onSave} />)}
            </div>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button onClick={() => setShowEmpty(!showEmpty)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {showEmpty ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {showEmpty ? "Leere Felder ausblenden" : `Leere Felder anzeigen (${hiddenCount})`}
        </button>
      )}
    </section>
  );
}

export const linkHref = (kind: "email" | "tel" | "link", value?: string | null) => {
  if (!value) return null;
  if (kind === "email") return `mailto:${value}`;
  if (kind === "tel") return `tel:${value}`;
  return /^https?:/.test(value) ? value : `https://${value}`;
};
