import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Film, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null | undefined;
  canEdit: boolean;
  onChange: (value: string | null) => void;
}

const RawFootageLink: React.FC<Props> = ({ value, canEdit, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const has = !!value && value.trim().length > 0;

  const preview = has ? value!.trim().split("\n")[0].slice(0, 24) : "";

  const trigger = (
    <button
      type="button"
      disabled={!canEdit && !has}
      className={cn(
        "inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 rounded-md border transition-colors max-w-[180px]",
        has
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
          : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
      title={has ? value! : "Footage-Notiz hinzufügen"}
    >
      <Film className="h-3 w-3 shrink-0" />
      <span className="truncate">{has ? preview : "Footage +"}</span>
    </button>
  );

  const save = () => {
    const v = draft.trim();
    onChange(v || null);
    setOpen(false);
  };

  if (!canEdit) {
    if (!has) return null;
    return (
      <span
        className="inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 rounded-md border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 max-w-[180px]"
        title={value!}
      >
        <Film className="h-3 w-3 shrink-0" />
        <span className="truncate">{preview}</span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(value ?? ""); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Footage-Notiz</div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z.B. Karte 2, Clip 003–012"
          className="text-xs min-h-[80px]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <div className="flex items-center justify-between mt-2">
          {has ? (
            <button
              onClick={() => { onChange(null); setDraft(""); setOpen(false); }}
              className="text-[11px] text-muted-foreground hover:text-destructive"
            >
              ✕ Entfernen
            </button>
          ) : <span />}
          <Button size="sm" className="h-7 px-3 text-xs gap-1" onClick={save}>
            <Check className="h-3.5 w-3.5" /> Speichern
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RawFootageLink;
