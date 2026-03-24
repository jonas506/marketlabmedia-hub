import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, ClipboardList, BookOpen, BookmarkIcon, Database, Sun, Moon, BarChart3, Menu, X, Briefcase, Presentation, CalendarRange, CheckSquare, Activity, Search } from "lucide-react";
import logoLight from "@/assets/logo-light.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import QuickAddTask from "@/components/QuickAddTask";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";

// roles: which roles can see this nav item (undefined = all)
const navItems: { to: string; label: string; icon: React.ComponentType<any>; roles?: string[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Aufgaben", icon: CheckSquare },
  { to: "/activity", label: "Aktivität", icon: Activity, roles: ["admin", "head_of_content"] },
  { to: "/checklists", label: "Checklisten", icon: ClipboardList, roles: ["admin", "head_of_content"] },
  { to: "/sops", label: "SOPs", icon: BookOpen, roles: ["admin", "head_of_content"] },
  { to: "/prompts", label: "Prompts", icon: BookmarkIcon, roles: ["admin", "head_of_content"] },
  { to: "/content-base", label: "Content Base", icon: Database },
  { to: "/strategy-boards", label: "Strategy Boards", icon: Presentation, roles: ["admin", "head_of_content"] },
  { to: "/marketing", label: "Marketing", icon: BarChart3, roles: ["admin", "head_of_content"] },
  { to: "/crm", label: "CRM", icon: Briefcase, roles: ["admin"] },
  { to: "/contracts", label: "Verträge", icon: CalendarRange, roles: ["admin"] },
  { to: "/team", label: "Team", icon: Users, roles: ["admin"] },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const filteredNav = navItems.filter(item => !item.roles || (role && item.roles.includes(role)));

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary">
              <img src={logoLight} alt="Marketlab" className="h-3.5 w-auto brightness-200" />
            </div>
            <span className="font-display text-sm font-semibold text-sidebar-foreground">Marketlab</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-all"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-all"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground transition-all"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Mobile menu sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="right" className="w-64 p-0">
            <VisuallyHidden.Root><SheetTitle>Menü</SheetTitle></VisuallyHidden.Root>
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary text-[11px] font-bold text-white">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{profile?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{role === "admin" ? "Admin" : role === "head_of_content" ? "Head of Content" : "Cutter"}</p>
                </div>
              </div>
              <nav className="flex-1 p-2 space-y-0.5">
                {filteredNav.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        active
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-foreground/70 hover:bg-surface-elevated hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border">
                <button
                  onClick={() => { signOut(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Abmelden
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 p-4">
          {children}
        </main>
        <QuickAddTask />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[58px] flex-col items-center bg-sidebar border-r border-sidebar-border py-4 gap-2">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary mb-4">
          <img src={logoLight} alt="Marketlab" className="h-4 w-auto brightness-200" />
        </div>
        <nav className="flex-1 flex flex-col items-center gap-1 pt-2">
          {filteredNav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-all duration-200 group ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground/50 hover:bg-surface-elevated hover:text-sidebar-foreground"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[3px] w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="h-[18px] w-[18px]" />
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col items-center gap-2 pb-2">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-surface-elevated transition-all"
            title="Suche (⌘K)"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-surface-elevated transition-all"
            title={theme === "dark" ? "Heller Modus" : "Dunkler Modus"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div
            className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary text-[11px] font-bold text-white cursor-default"
            title={`${profile?.name} · ${role === "admin" ? "Admin" : role === "head_of_content" ? "HoC" : "Cutter"}`}
          >
            {initials}
          </div>
          <button
            onClick={signOut}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-sidebar-foreground/30 hover:text-sidebar-foreground/60 hover:bg-surface-elevated transition-all"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
      <main className="ml-[58px] flex-1 p-6">
        {children}
      </main>
      <QuickAddTask />
      <GlobalSearch />
    </div>
  );
};

export default AppLayout;
