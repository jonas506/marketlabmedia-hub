import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import {
  Inbox, BarChart3, Users, Contact, Activity, MessageSquare,
  Workflow, PieChart, Filter, ChevronLeft, ChevronRight, Search,
  LogOut, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CrmCommandSearch from "./CrmCommandSearch";

const mainNav = [
  { to: "/crm", label: "Inbox", icon: Inbox, badge: true, end: true },
  { to: "/crm/opportunities", label: "Opportunities", icon: BarChart3 },
  { to: "/crm/leads", label: "Leads", icon: Users },
  { to: "/crm/contacts", label: "Contacts", icon: Contact },
  { to: "/crm/activities", label: "Activities", icon: Activity },
  { to: "/crm/conversations", label: "Conversations", icon: MessageSquare },
];

const secondaryNav = [
  { to: "/crm/workflows", label: "Workflows", icon: Workflow, comingSoon: true },
  { to: "/crm/reports", label: "Reports", icon: PieChart, comingSoon: true },
];

export default function CrmLayout() {
  const { user, role, profile, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const initials = profile?.name
    ? profile.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "ML";

  return (
    <div className="flex h-screen bg-crm-bg text-crm-text font-[Manrope]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-crm-border bg-crm-surface transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-4 border-b border-crm-border">
          <div className="w-8 h-8 rounded-full bg-crm-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{profile?.name || "Admin"}</p>
              <p className="text-xs text-crm-muted truncate">Marketlab Media</p>
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <button
            onClick={() => setSearchOpen(true)}
            className="mx-3 mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-crm-bg/50 border border-crm-border text-crm-muted text-sm hover:border-crm-primary/50 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Suche...</span>
            <kbd className="text-[10px] bg-crm-bg px-1.5 py-0.5 rounded border border-crm-border">⌘K</kbd>
          </button>
        )}

        {/* Main Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {mainNav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive(item.to, item.end)
                  ? "bg-crm-primary/15 text-crm-primary font-medium"
                  : "text-crm-muted hover:text-crm-text hover:bg-crm-bg/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}

          <div className="h-px bg-crm-border my-3 mx-2" />

          {secondaryNav.map(item => (
            <div
              key={item.to}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-crm-muted/50 cursor-not-allowed"
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-crm-border text-crm-muted/50">Soon</Badge>
                </>
              )}
            </div>
          ))}

          <div className="h-px bg-crm-border my-3 mx-2" />

          {/* Smart Views */}
          <Link
            to="/crm/smart-views"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive("/crm/smart-views")
                ? "bg-crm-primary/15 text-crm-primary font-medium"
                : "text-crm-muted hover:text-crm-text hover:bg-crm-bg/50"
            )}
          >
            <Filter className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Smart Views</span>}
          </Link>
        </nav>

        {/* Footer */}
        <div className="border-t border-crm-border p-2 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-crm-muted hover:text-crm-text hover:bg-crm-bg/50 transition-colors"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Zurück zum Hub</span>}
          </Link>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-crm-muted hover:text-crm-text hover:bg-crm-bg/50 w-full transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Einklappen</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>

      {/* Global Search */}
      <CrmCommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
