import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, ClipboardList, BookOpen, BookmarkIcon, Database, Sun, Moon, BarChart3, Menu, X, Briefcase, Presentation, CalendarRange, CheckSquare, Activity, Search, Settings, ListTodo, Clock } from "lucide-react";
import marketlabLogo from "@/assets/marketlab-logo.jpg";
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
  { to: "/clients", label: "Kunden", icon: Users },
  { to: "/my-todos", label: "Meine To-Dos", icon: ListTodo },
  { to: "/tasks", label: "Aufgaben", icon: CheckSquare },
  { to: "/checklists", label: "Checklisten", icon: ClipboardList, roles: ["admin", "head_of_content"] },
  { to: "/sops", label: "SOPs", icon: BookOpen, roles: ["admin", "head_of_content"] },
  { to: "/prompts", label: "Prompts", icon: BookmarkIcon, roles: ["admin", "head_of_content"] },
  { to: "/content-base", label: "Content Base", icon: Database },
  { to: "/time-tracking", label: "Zeiterfassung", icon: Clock },
  { to: "/crm", label: "CRM", icon: Briefcase, roles: ["admin"] },
  { to: "/team", label: "Einstellungen", icon: Settings, roles: ["admin"] },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isClientRoute = location.pathname.startsWith("/client/");
  const collapsed = isClientRoute && !isMobile;

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const filteredNav = navItems.filter(item => !item.roles || (role && item.roles.includes(role)));

  const isNavActive = (to: string) => {
    if (to === "/clients") return location.pathname.startsWith("/client/");
    if (to === "/") return location.pathname === "/";
    return location.pathname === to || location.pathname.startsWith(to);
  };

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden">
              <img src={marketlabLogo} alt="Marketlab" className="h-8 w-8 object-cover" />
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
                  const active = isNavActive(to);
                  const linkTo = to === "/clients" ? "/" : to;
                  return (
                    <Link
                      key={to}
                      to={linkTo}
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
        <GlobalSearch />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo & brand */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src={marketlabLogo} alt="Marketlab" className="h-8 w-8 object-cover" />
          </div>
          <span className="font-display text-sm font-semibold text-sidebar-foreground tracking-tight">Marketlab</span>
        </div>

        {/* Search */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="flex items-center gap-2.5 w-full h-9 px-3 rounded-lg bg-surface-hover/50 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-surface-hover transition-all text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Suchen…</span>
            <kbd className="ml-auto text-[10px] font-mono bg-sidebar-border/50 px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {filteredNav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-primary/12 text-primary font-semibold"
                    : "text-sidebar-foreground/60 hover:bg-surface-hover hover:text-sidebar-foreground"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-white flex-shrink-0"
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">{profile?.name}</p>
              <p className="text-[10px] text-sidebar-foreground/40">{role === "admin" ? "Admin" : role === "head_of_content" ? "Head of Content" : "Mitglied"}</p>
            </div>
            <NotificationBell />
          </div>
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-surface-hover transition-all"
              title={theme === "dark" ? "Heller Modus" : "Dunkler Modus"}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={signOut}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-surface-hover transition-all"
              title="Abmelden"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
      <main className="ml-[220px] flex-1 p-6">
        {children}
      </main>
      <QuickAddTask />
      <GlobalSearch />
    </div>
  );
};

export default AppLayout;
