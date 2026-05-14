import { ExternalLink, Pencil, Trash2, Star, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormatReference } from "./constants";
import { SourceIcon, SOURCE_LABEL } from "./SourceIcon";

interface Props {
  reference: FormatReference;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}

const ReferenceCard: React.FC<Props> = ({ reference, isAdmin, onEdit, onDelete, draggable, onDragStart, onDragOver, onDrop }) => {
  return (
    <div
      draggable={draggable && isAdmin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex flex-col rounded-xl border bg-card overflow-hidden transition-all ${
        reference.is_own ? "border-primary/50 ring-1 ring-primary/20" : "border-border hover:border-border/80"
      }`}
    >
      <a href={reference.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/5] bg-muted overflow-hidden">
        {reference.thumbnail_url ? (
          <img src={reference.thumbnail_url} alt={reference.title || ""} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-background text-muted-foreground/40">
            <SourceIcon type={reference.source_type} className="h-10 w-10" />
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur text-[10px] font-mono uppercase tracking-wider">
          <SourceIcon type={reference.source_type} className="h-3 w-3" />
          {SOURCE_LABEL[reference.source_type]}
        </div>
        {reference.is_own && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold">
            <Star className="h-3 w-3 fill-current" /> Eigene
          </div>
        )}
        {isAdmin && draggable && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur rounded-md p-1 cursor-grab">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </a>
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium line-clamp-2 min-h-[40px]">
          {reference.title || reference.url}
        </p>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1">
            <a href={reference.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> Öffnen
            </a>
          </Button>
          {isAdmin && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferenceCard;
