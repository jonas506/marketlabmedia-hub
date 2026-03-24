import React from "react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import TagInput from "../TagInput";
import { TAG_COLORS, hashTag } from "./constants";

interface PieceTagsRowProps {
  pieceId: string;
  tag: string | null | undefined;
  clientId: string;
  canEdit: boolean;
  onUpdatePiece: (pieceId: string, updates: Record<string, any>) => void;
}

const PieceTagsRow: React.FC<PieceTagsRowProps> = React.memo(({
  pieceId,
  tag,
  clientId,
  canEdit,
  onUpdatePiece,
}) => {
  const tags = tag ? tag.split(",").map(t => t.trim()).filter(Boolean) : [];

  return (
    <>
      {tags.map((t) => (
        <span
          key={t}
          className={cn(
            "inline-flex items-center gap-1 h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 rounded-md transition-colors",
            TAG_COLORS[hashTag(t.toLowerCase())],
            canEdit && "cursor-pointer hover:bg-destructive/10 hover:text-destructive"
          )}
          onClick={() => {
            if (!canEdit) return;
            const remaining = tags.filter(x => x !== t);
            onUpdatePiece(pieceId, { tag: remaining.length ? remaining.join(", ") : null });
          }}
          title={canEdit ? "Klicken zum Entfernen" : undefined}
        >
          <Tag className="h-3 w-3 shrink-0" />
          {t}
          {canEdit && <span className="text-[10px] ml-0.5">✕</span>}
        </span>
      ))}
      {canEdit && (
        <TagInput
          clientId={clientId}
          onSelect={(newTag) => {
            if (tags.includes(newTag)) return;
            const updated = [...tags, newTag].join(", ");
            onUpdatePiece(pieceId, { tag: updated });
          }}
        />
      )}
    </>
  );
});

PieceTagsRow.displayName = "PieceTagsRow";

export default PieceTagsRow;
