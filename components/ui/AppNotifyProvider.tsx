"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleAlert,
  Info,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  notify,
  subscribeNotify,
  type AppNotification,
  type NotifyType,
} from "@/lib/notify";
import { cn } from "@/lib/utils";

type AppNotifyContextValue = {
  notify: typeof notify;
  dismiss: (id: string) => void;
  clear: () => void;
};

const AppNotifyContext = createContext<AppNotifyContextValue | null>(null);

const TYPE_META: Record<
  NotifyType,
  {
    label: string;
    icon: typeof CheckCircle2;
    frame: string;
    iconClass: string;
    badge: string;
  }
> = {
  success: {
    label: "Success",
    icon: CheckCircle2,
    frame: "border-emerald-200/90 bg-emerald-50/95 text-emerald-950",
    iconClass: "text-emerald-600",
    badge: "bg-emerald-600/10 text-emerald-800",
  },
  error: {
    label: "Error",
    icon: XCircle,
    frame: "border-red-200/90 bg-red-50/95 text-red-950",
    iconClass: "text-red-600",
    badge: "bg-red-600/10 text-red-800",
  },
  failure: {
    label: "Failure",
    icon: CircleAlert,
    frame: "border-rose-200/90 bg-rose-50/95 text-rose-950",
    iconClass: "text-rose-600",
    badge: "bg-rose-600/10 text-rose-800",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    frame: "border-amber-200/90 bg-amber-50/95 text-amber-950",
    iconClass: "text-amber-600",
    badge: "bg-amber-600/10 text-amber-900",
  },
  info: {
    label: "Info",
    icon: Info,
    frame: "border-sky-200/90 bg-sky-50/95 text-sky-950",
    iconClass: "text-sky-600",
    badge: "bg-sky-600/10 text-sky-800",
  },
  alert: {
    label: "Alert",
    icon: Bell,
    frame: "border-orange-200/90 bg-orange-50/95 text-orange-950",
    iconClass: "text-orange-600",
    badge: "bg-orange-600/10 text-orange-900",
  },
  approval: {
    label: "Approval",
    icon: ShieldCheck,
    frame: "border-slate-200/90 bg-white/95 text-slate-950",
    iconClass: "text-[color:var(--dd-brand-rose,#e11d48)]",
    badge: "bg-slate-900/5 text-slate-800",
  },
  notification: {
    label: "Notice",
    icon: Bell,
    frame: "border-border bg-card/95 text-card-foreground",
    iconClass: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

function NotificationCard({
  item,
  onDismiss,
}: {
  item: AppNotification;
  onDismiss: (id: string) => void;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  useEffect(() => {
    if (item.duration == null) return;
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration, item.id, onDismiss]);

  return (
    <div
      role={item.type === "approval" || item.type === "alert" ? "alertdialog" : "status"}
      aria-live={item.type === "error" || item.type === "failure" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm",
        "animate-in slide-in-from-right-4 fade-in duration-200",
        meta.frame,
      )}
    >
      <div className="flex gap-3 p-3.5">
        <div className={cn("mt-0.5 shrink-0", meta.iconClass)}>
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {meta.label}
              </p>
              <p className="text-sm font-semibold leading-snug">{item.title}</p>
              {item.description ? (
                <p className="text-sm leading-relaxed opacity-80">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
              onClick={() => onDismiss(item.id)}
            >
              <X className="size-4" />
            </button>
          </div>

          {item.action || item.secondaryAction ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {item.action ? (
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    item.action?.onClick?.();
                    if (item.action?.dismiss !== false) onDismiss(item.id);
                  }}
                >
                  {item.action.label}
                </Button>
              ) : null}
              {item.secondaryAction ? (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    item.secondaryAction?.onClick?.();
                    if (item.secondaryAction?.dismiss !== false) onDismiss(item.id);
                  }}
                >
                  {item.secondaryAction.label}
                </Button>
              ) : null}
            </div>
          ) : null}

          {item.duration != null ? (
            <div className="pt-1">
              <div className="h-0.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full origin-left rounded-full bg-current/35"
                  style={{
                    animation: `app-notify-shrink ${item.duration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[11px] opacity-55">Stays until dismissed</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppNotifyProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  useEffect(() => {
    return subscribeNotify((event) => {
      if (event.kind === "push") {
        setItems((prev) => [event.notification, ...prev].slice(0, 6));
        return;
      }
      if (event.kind === "dismiss") {
        setItems((prev) => prev.filter((n) => n.id !== event.id));
        return;
      }
      setItems([]);
    });
  }, []);

  const value = useMemo(
    () => ({
      notify,
      dismiss,
      clear,
    }),
    [clear, dismiss],
  );

  return (
    <AppNotifyContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-3 right-3 z-[100] flex max-h-[calc(100dvh-1.5rem)] w-[min(100vw-1.5rem,24rem)] flex-col gap-2 overflow-y-auto"
        aria-label="Notifications"
      >
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </AppNotifyContext.Provider>
  );
}

export function useAppNotify() {
  const ctx = useContext(AppNotifyContext);
  if (!ctx) {
    // Allow imperative notify.* even if hook used outside provider (events no-op until mounted).
    return {
      notify,
      dismiss: notify.dismiss,
      clear: notify.clear,
    };
  }
  return ctx;
}

export { notify };
