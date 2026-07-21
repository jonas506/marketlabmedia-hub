import { Link, useLocation } from "react-router-dom";
import { ClipboardList, BookOpen, MessageCircleHeart } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/checklists", label: "Checklisten", icon: ClipboardList },
  { to: "/sops", label: "SOPs", icon: BookOpen },
  { to: "/checkins", label: "Check-ins", icon: MessageCircleHeart },
];

export default function ProzesseTabs() {
  const { pathname } = useLocation();
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-border">
      {tabs.map(t => {
        const active = pathname.startsWith(t.to);
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
