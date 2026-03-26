import { Bell, BellOff, Check, CheckCheck, Scissors, Eye, Send, ClipboardList, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { useNotifications, Notification } from "@/contexts/NotificationContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

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
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 rounded-md ${
        !notif.is_read ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center gap-2 mt-0.5 shrink-0">
        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${!notif.is_read ? "bg-primary" : "bg-transparent"}`} />
        <div className="text-muted-foreground">{getNotifIcon(notif.type)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm leading-snug">{notif.title}</p>
        {notif.body && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.body}</p>
        )}
      </div>
      <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
        {getRelativeTime(notif.created_at)}
      </span>
    </motion.button>
  );
}

function NotificationList() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, setPanelOpen } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
    setPanelOpen(false);
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <span className="font-mono text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={markAllAsRead}>
            <CheckCheck className="h-3 w-3" /> Alle gelesen
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BellOff className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Keine Benachrichtigungen</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {notifications.map((notif) => (
                <NotificationItem key={notif.id} notif={notif} onClick={() => handleClick(notif)} />
              ))}
            </AnimatePresence>
          )}
        </div>
        {notifications.length >= 50 && (
          <p className="text-[10px] text-muted-foreground text-center pb-3">
            Ältere Benachrichtigungen werden automatisch gelöscht
          </p>
        )}
      </ScrollArea>
    </div>
  );
}

export default function NotificationBell() {
  const { unreadCount, panelOpen, setPanelOpen } = useNotifications();
  const isMobile = useIsMobile();

  const bellButton = (
    <button
      onClick={() => setPanelOpen(!panelOpen)}
      className="relative flex items-center justify-center h-10 w-10 rounded-lg text-sidebar-foreground/50 hover:bg-surface-elevated hover:text-sidebar-foreground transition-all"
      title="Benachrichtigungen"
    >
      <Bell className="h-[18px] w-[18px]" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground font-mono text-[9px] font-bold">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {bellButton}
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent side="bottom" className="h-[75vh] p-0 rounded-t-2xl">
            <VisuallyHidden.Root><SheetTitle>Benachrichtigungen</SheetTitle></VisuallyHidden.Root>
            <NotificationList />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={panelOpen} onOpenChange={setPanelOpen}>
      <PopoverTrigger asChild>{bellButton}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        collisionPadding={16}
        avoidCollisions
        className="w-[380px] p-0 max-h-[70vh] z-50"
      >
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
