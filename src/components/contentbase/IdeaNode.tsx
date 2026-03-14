import { MouseEvent, useRef } from "react";
import { CanvasNode } from "@/lib/content-types";
import { supabase } from "@/integrations/supabase/client";
import NodeWrapper, { BrandOption } from "./NodeWrapper";

interface Props {
  node: CanvasNode;
  onUpdate: (u: Record<string, unknown>) => void;
  onDrag: (e: MouseEvent) => void;
  onPort: (e: MouseEvent, id: string, side: string) => void;
  onDuplicate?: () => void;
  isSelected?: boolean;
  userId: string;
  conns: { out: boolean; in: boolean };
  brands?: BrandOption[];
}

export default function IdeaNode({ node, onUpdate, onDrag, onPort, onDuplicate, isSelected, userId, conns, brands }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const images = node.referenceImages || [];

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}/${node.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("reference-images").upload(path, file);
    if (error) { console.error("Upload error:", error); return; }
    const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
    onUpdate({ referenceImages: [...images, data.publicUrl] });
  };

  const removeImage = (idx: number) => {
    onUpdate({ referenceImages: images.filter((_, i) => i !== idx) });
  };

  return (
    <NodeWrapper node={node} onDrag={onDrag} onUpdate={onUpdate} onDuplicate={onDuplicate} isSelected={isSelected} defaultMinW={220} defaultMinH={140} brands={brands}>
      <div
        className="bg-card border border-border rounded-lg overflow-hidden shadow-sm"
        style={{ minWidth: node.width ? undefined : 260, maxWidth: node.width ? undefined : 320, height: node.height ? `${node.height}px` : undefined }}
      >
        <div className="bg-primary text-primary-foreground px-3.5 py-2.5 flex items-center justify-between rounded-t-lg">
          <span className="text-xs font-semibold">✦ Idee / Prompt</span>
          <button
            className="text-[10px] opacity-70 hover:opacity-100 transition-opacity bg-transparent border-none text-primary-foreground cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            title="Referenzbild hochladen"
          >+</button>
        </div>
        <div className="p-3.5 flex flex-col gap-2" style={{ height: node.height ? `calc(100% - 42px)` : undefined }}>
          <textarea
            className="w-full border border-border rounded-sm px-3 py-2.5 text-[13px] text-foreground bg-background resize-none outline-none transition-colors focus:border-primary flex-1"
            style={{ minHeight: node.height ? undefined : 80 }}
            placeholder="Beschreibe deine Idee…"
            value={node.idea || ""}
            rows={3}
            onChange={(e) => onUpdate({ idea: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          />
          {images.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {images.map((url, i) => (
                <div key={i} className="relative group/img w-12 h-12 rounded-sm overflow-hidden border border-border flex-shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    className="absolute inset-0 bg-black/50 text-white text-[10px] opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer border-none flex items-center justify-center"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                  >✕</button>
                </div>
              ))}
              <button
                className="w-12 h-12 rounded-sm border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer bg-transparent text-lg"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              >+</button>
            </div>
          )}
          {images.length === 0 && (
            <div
              className="border border-dashed border-border rounded-sm py-1.5 text-center text-[10px] text-muted-foreground cursor-pointer hover:border-primary hover:text-foreground transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            >Referenzbild hinzufügen</div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach(uploadImage); e.target.value = ""; }} />
          <button
            className="w-full py-2.5 bg-primary text-primary-foreground border-none rounded-sm text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!node.idea?.trim()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onUpdate({ _gen: true }); }}
          >▶ Verbundene Nodes generieren</button>
        </div>
      </div>
      <div className={`cb-port out${conns?.out ? " hit" : ""}`} onMouseDown={(e) => { e.stopPropagation(); onPort(e, node.id, "out"); }} />
    </NodeWrapper>
  );
}
