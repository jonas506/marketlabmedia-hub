import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
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
  return (
    <div className={cn(
      "flex items-center gap-2.5 py-2 pl-6 group",
      isCompleted && "opacity-60"
    )}>
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => !isCompleted && onComplete(id)}
        className="shrink-0"
        disabled={isCompleted}
      />
      <span className={cn(
        "text-sm font-body flex-1 truncate",
        isCompleted && "line-through text-muted-foreground/50"
      )}>
        {isCompleted ? "✅ " : ""}
        {title}
      </span>
      {contentPieceId && clientId && (
        <Link
          to={`/client/${clientId}`}
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
        </Link>
      )}
    </div>
  );
};

export default React.memo(SubtaskItem);
