import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, Kanban, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import AppLayout from "@/components/AppLayout";

const crmNav = [
  { to: "/crm", label: "Kunden", icon: Users, exact: true },
  { to: "/crm/pipelines", label: "Pipelines", icon: Kanban },
];

const CRMLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <AppLayout>
      <div className="flex gap-0 -m-6 min-h-[calc(100vh-0px)]">
        {/* CRM Sidebar */}
        <aside className="w-52 shrink-0 border-r border-[#3A3A44] bg-[#2A2A32] p-3 flex flex-col gap-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zum Dashboard
          </Link>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">CRM</p>
          {crmNav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                  active
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-[#FAFBFF]/60 hover:bg-[#3A3A44]/50 hover:text-[#FAFBFF]"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto bg-[#1E1E24]">
          {children}
        </main>
      </div>
    </AppLayout>
  );
};

export default CRMLayout;
