import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Film, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null | undefined;
  canEdit: boolean;
  onChange: (value: string | null) => void;
}

const RawFootageLink: React.FC<Props> = ({ value, canEdit, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const has = !!value;

  // Quick open if value exists and not editing
  const trigger = (
    <button
      type="button"
      disabled={!canEdit && !has}
      className={cn(
        "inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 rounded-md border transition-colors",
        has
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
          : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
      title={has ? "Rohaufnahme öffnen / bearbeiten" : "Rohaufnahme-Link hinzufügen"}
    >
      <Film className="h-3 w-3 shrink-0" />
      {has ? "Footage" : "Footage +"}
      {has && <ExternalLink className="h-3 w-3 opacity-60" />}
    </button>
  );

  const save = () => {
    const v = draft.trim();
    onChange(v || null);
    setOpen(false);
  };

  // If user can't edit, just direct-open
  if (!canEdit) {
    if (!has) return null;
    return (
      <a
        href={value!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 rounded-md border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
        title="Rohaufnahme öffnen"
      >
        <Film className="h-3 w-3" />
        Footage
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(value ?? ""); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Rohaufnahme-Link</div>
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="h-8 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <Button size="sm" className="h-8 px-2" onClick={save}>
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
        {has && (
          <div className="flex items-center justify-between mt-2">
            <a
              href={value!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Öffnen
            </a>
            <button
              onClick={() => { onChange(null); setDraft(""); setOpen(false); }}
              className="text-[11px] text-muted-foreground hover:text-destructive"
            >
              ✕ Entfernen
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default RawFootageLink;
