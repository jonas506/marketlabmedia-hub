import React from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubtaskItemProps {
  id: string;
  title: string;
  isCompleted: boolean;
  clientId: string;
  contentPieceId: string | null;
  onComplete: (id: string) => void;
}

const SubtaskItem: React.FC<SubtaskItemProps> = ({ id, title, isCompleted, clientId, contentPieceId, onComplete }) => {
  const navigate = useNavigate();

  const openPiece = () => {
    if (!contentPieceId || !clientId) return;
    navigate(`/client/${clientId}?piece=${contentPieceId}`);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 py-2 pl-6",
        isCompleted && "opacity-60",
        contentPieceId && "cursor-pointer"
      )}
      onClick={openPiece}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => !isCompleted && onComplete(id)}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
        disabled={isCompleted}
      />
      <span className={cn(
        "flex-1 truncate text-sm font-body",
        isCompleted && "line-through text-muted-foreground/50"
      )}>
        {isCompleted ? "✅ " : ""}
        {title}
      </span>
      {contentPieceId && clientId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openPiece();
          }}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
        </button>
      )}
    </div>
  );
};

export default React.memo(SubtaskItem);
