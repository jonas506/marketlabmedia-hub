import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";

interface TagInputProps {
  clientId: string;
  onSelect: (tag: string) => void;
  className?: string;
}

const TagInput: React.FC<TagInputProps> = ({ clientId, onSelect, className }) => {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: existingTags = [] } = useQuery({
    queryKey: ["content-piece-tags", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_pieces")
        .select("tag")
        .eq("client_id", clientId)
        .not("tag", "is", null);
      const tags = new Set<string>();
      data?.forEach((p) => { if (p.tag?.trim()) tags.add(p.tag.trim()); });
      return Array.from(tags).sort();
    },
  });

  const filtered = useMemo(() => {
    if (!value.trim()) return existingTags;
    const lower = value.toLowerCase();
    return existingTags.filter((t) => t.toLowerCase().includes(lower));
  }, [value, existingTags]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = (tag: string) => {
    if (tag.trim()) {
      onSelect(tag.trim());
      setValue("");
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="+ Tag"
        className={cn(
          "h-6 sm:h-7 w-20 sm:w-28 text-[10px] sm:text-xs font-mono border-0 bg-muted/60 px-2 rounded-md placeholder:text-muted-foreground/50",
          className
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit(value);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => {
            if (value.trim()) submit(value);
          }, 150);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-40 max-h-36 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map((tag) => (
            <button
              key={tag}
              type="button"
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-mono text-left hover:bg-accent/20 transition-colors"
              onMouseDown={(e) => { e.preventDefault(); submit(tag); }}
            >
              <Tag className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
