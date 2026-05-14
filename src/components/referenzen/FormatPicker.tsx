import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink, ArrowRight } from "lucide-react";
import { stageMeta, type ContentFormat, type FormatReference, FUNNEL_STAGES } from "./constants";
import { SourceIcon } from "./SourceIcon";

interface Props {
  value: string | null;
  onChange: (formatId: string | null) => void;
}

const FormatPicker: React.FC<Props> = ({ value, onChange }) => {
  const { data: formats = [] } = useQuery({
    queryKey: ["content_formats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_formats")
        .select("*")
        .eq("is_active", true)
        .order("funnel_stage")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as ContentFormat[];
    },
  });

  const { data: refs = [] } = useQuery({
    queryKey: ["format_references", value],
    enabled: !!value,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("format_references")
        .select("*")
        .eq("format_id", value!)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as FormatReference[];
    },
  });

  const selected = formats.find((f) => f.id === value);

  return (
    <div className="space-y-1.5">
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Kein Format" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Kein Format —</SelectItem>
          {FUNNEL_STAGES.map((s) => {
            const items = formats.filter((f) => f.funnel_stage === s.key);
            if (items.length === 0) return null;
            return (
              <SelectGroup key={s.key}>
                <SelectLabel className="text-[10px] font-mono uppercase tracking-wider">── {s.label} ──</SelectLabel>
                {items.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="mr-2">{f.emoji || "🎬"}</span>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      {selected && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pl-1">
          <span>{refs.length} {refs.length === 1 ? "Referenz" : "Referenzen"} verfügbar</span>
          <span>·</span>
          <Popover>
            <PopoverTrigger className="inline-flex items-center gap-1 text-primary hover:underline">
              Referenzen ansehen <ArrowRight className="h-3 w-3" />
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2 max-h-80 overflow-y-auto">
              <div className="px-2 py-1.5 mb-1 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold">{selected.emoji} {selected.name}</span>
                <Link to={`/referenzen/${selected.id}`} className="text-[10px] text-primary hover:underline">Alle →</Link>
              </div>
              {refs.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">Keine Referenzen.</p>}
              <div className="space-y-1">
                {refs.slice(0, 10).map((r) => (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted text-xs"
                  >
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt="" className="h-10 w-10 rounded-md object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <SourceIcon type={r.source_type} className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="flex-1 line-clamp-2">{r.title || r.url}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};

export default FormatPicker;
