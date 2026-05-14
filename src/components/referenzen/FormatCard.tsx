import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { stageMeta, type ContentFormat } from "./constants";

interface Props {
  format: ContentFormat;
  referenceCount: number;
}

const FormatCard: React.FC<Props> = ({ format, referenceCount }) => {
  const meta = stageMeta(format.funnel_stage);
  return (
    <Link
      to={`/referenzen/${format.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all p-5 min-h-[140px]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-3xl leading-none">{format.emoji || "🎬"}</div>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.chipClass}`}>
          {meta.label}
        </span>
      </div>
      <h3 className="font-display font-semibold text-base text-foreground mb-1 line-clamp-2">{format.name}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {referenceCount} {referenceCount === 1 ? "Referenz" : "Referenzen"}
      </p>
      <div className="mt-auto flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
        Öffnen <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
};

export default FormatCard;
