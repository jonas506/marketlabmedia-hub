import { Bell, BellOff, Check, CheckCheck, Scissors, Eye, ClipboardList, Clock, AlertTriangle, MessageSquare, ListTodo, ChevronRight } from "lucide-react";
import { useNotifications, Notification } from "@/contexts/NotificationContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { de } from "date-fns/locale";

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function getNotifIcon(type: string) {
  switch (type) {
    case "piece_assigned": return <ClipboardList className="h-3.5 w-3.5" />;
    case "review_ready": return <Eye className="h-3.5 w-3.5" />;
    case "piece_status": return <Scissors className="h-3.5 w-3.5" />;
    case "task_assigned": return <ClipboardList className="h-3.5 w-3.5" />;
    case "task_completed": return <Check className="h-3.5 w-3.5" />;
    case "deadline_warning": return <Clock className="h-3.5 w-3.5" />;
    case "comment": return <MessageSquare className="h-3.5 w-3.5" />;
    default: return <Bell className="h-3.5 w-3.5" />;
  }
}

function NotificationItem({ notif, onClick }: { notif: Notification; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      onClick={onClick}
      className={[
        "w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 rounded-md",
        !notif.is_read ? "bg-primary/5" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mt-0.5 shrink-0">
        <div className={[
          "h-1.5 w-1.5 rounded-full shrink-0",
          !notif.is_read ? "bg-primary" : "bg-transparent",
        ].join(" ")} />
        <div className="text-muted-foreground">{getNotifIcon(notif.type)}</div>
      </div>
      <div className="min-w-0 flex-1 pr-1">
        <p className="font-body text-sm leading-snug break-words">{notif.title}</p>
        {notif.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{notif.body}</p>}
      </div>
      <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">
        {getRelativeTime(notif.created_at)}
      </span>
    </motion.button>
  );
}

function formatDeadline(deadline: string): { label: string; urgent: boolean } {
  const d = new Date(deadline + "T00:00:00");
  if (isPast(d) && !isToday(d)) return { label: "Überfällig", urgent: true };
  if (isToday(d)) return { label: "Heute", urgent: true };
  if (isTomorrow(d)) return { label: "Morgen", urgent: false };
  return { label: format(d, "EEE, d. MMM", { locale: de }), urgent: false };
}

function TasksSummary({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["bell-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("tasks")
        .select("id, title, deadline, priority, client_id, is_completed, clients(name)")
        .eq("assigned_to", user.id)
        .eq("is_completed", false)
        .is("parent_id", null)
        .order("deadline", { ascending: true, nullsFirst: false })
        .limit(10);
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const urgentCount = tasks.filter(
    (t: any) => t.deadline && (isPast(new Date(t.deadline + "T00:00:00")) || isToday(new Date(t.deadline + "T00:00:00")))
  ).length;

  return (
    <div className="flex flex-col">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Check className="mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Keine offenen Aufgaben</p>
        </div>
      ) : (
        <div className="space-y-0.5 p-1.5">
          {urgentCount > 0 && (
            <div className="mb-1 flex items-center gap-2 px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">
                {urgentCount} {urgentCount === 1 ? "Aufgabe" : "Aufgaben"} fällig
              </span>
            </div>
          )}
          {tasks.map((task: any) => {
            const dl = task.deadline ? formatDeadline(task.deadline) : null;
            return (
              <button
                key={task.id}
                onClick={() => {
                  navigate("/tasks");
                  onClose();
                }}
                className="flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
              >
                <div className="mt-0.5 flex shrink-0 items-center gap-2">
                  <div className={[
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    task.priority === "urgent"
                      ? "bg-destructive"
                      : task.priority === "high"
                        ? "bg-[hsl(var(--status-review))]"
                        : "bg-primary/40",
                  ].join(" ")} />
                  <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm leading-snug">{task.title}</p>
                  {task.clients?.name && <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.clients.name}</p>}
                </div>
                {dl && (
                  <span className={[
                    "mt-0.5 shrink-0 font-mono text-[10px]",
                    dl.urgent ? "font-semibold text-destructive" : "text-muted-foreground",
                  ].join(" ")}>
                    {dl.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => {
          navigate("/tasks");
          onClose();
        }}
        className="flex items-center justify-center gap-1 border-t border-border py-2.5 text-xs text-primary transition-colors hover:text-primary/80"
      >
        Alle Aufgaben anzeigen <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function NotificationList() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, setPanelOpen } = useNotifications();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"notifs" | "tasks">("notifs");

  const handleClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
    setPanelOpen(false);
  };

  return (
    <div className="flex h-full max-h-[70vh] min-h-0 flex-col">
      <div className="border-b border-border px-2 py-2">
        <div className="flex items-center gap-1.5">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
            <button
              onClick={() => setTab("notifs")}
              className={[
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                tab === "notifs"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              ].join(" ")}
            >
              <Bell className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Benachrichtigungen</span>
              {unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[9px] text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("tasks")}
              className={[
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                tab === "tasks"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              ].join(" ")}
            >
              <ListTodo className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Aufgaben</span>
            </button>
          </div>
          {tab === "notifs" && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2 text-[11px]"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Alle gelesen</span>
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {tab === "notifs" ? (
          <div className="p-1.5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BellOff className="mb-2 h-8 w-8 opacity-30" />
                <p className="text-sm">Keine Benachrichtigungen</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {notifications.map((notif) => (
                  <NotificationItem key={notif.id} notif={notif} onClick={() => handleClick(notif)} />
                ))}
              </AnimatePresence>
            )}
            {notifications.length >= 50 && (
              <p className="pb-3 text-center text-[10px] text-muted-foreground">
                Ältere Benachrichtigungen werden automatisch gelöscht
              </p>
            )}
          </div>
        ) : (
          <TasksSummary onClose={() => setPanelOpen(false)} />
        )}
      </ScrollArea>
    </div>
  );
}

export default function NotificationBell() {
  const { unreadCount, panelOpen, setPanelOpen } = useNotifications();
  const isMobile = useIsMobile();

  const bellIcon = (
    <>
      <Bell className="h-[17px] w-[17px]" />
      {unreadCount > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-0.5 font-mono text-[8px] font-bold text-primary-foreground ring-2 ring-sidebar">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setPanelOpen(true)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
          title="Benachrichtigungen"
        >
          {bellIcon}
        </button>
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl p-0">
            <VisuallyHidden.Root><SheetTitle>Benachrichtigungen</SheetTitle></VisuallyHidden.Root>
            <NotificationList />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={panelOpen} onOpenChange={setPanelOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
          title="Benachrichtigungen"
        >
          {bellIcon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        collisionPadding={16}
        avoidCollisions
        className="z-50 max-h-[70vh] w-[min(420px,calc(100vw-96px))] overflow-hidden p-0"
      >
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
