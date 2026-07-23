/**
 * App-wide activity notifications.
 * Use after an action completes: save, submit, approve, fail, etc.
 */

export type NotifyType =
  | "success"
  | "error"
  | "failure"
  | "warning"
  | "info"
  | "alert"
  | "approval"
  | "notification";

export type NotifyAction = {
  label: string;
  onClick?: () => void;
  /** Closes the toast after click (default true). */
  dismiss?: boolean;
};

export type NotifyInput = {
  /** Short headline. If omitted, `message` is used as the body. */
  title?: string;
  /** Main text (or pass a string to notify.* helpers). */
  message?: string;
  description?: string;
  /**
   * Auto-dismiss in ms.
   * `null` / `0` / `false` = stays until dismissed (approval/alert default).
   */
  duration?: number | null | false;
  action?: NotifyAction;
  secondaryAction?: NotifyAction;
};

export type AppNotification = {
  id: string;
  type: NotifyType;
  title: string;
  description?: string;
  duration: number | null;
  createdAt: number;
  action?: NotifyAction;
  secondaryAction?: NotifyAction;
};

export type NotifyEvent =
  | { kind: "push"; notification: AppNotification }
  | { kind: "dismiss"; id: string }
  | { kind: "clear" };

type Listener = (event: NotifyEvent) => void;

const listeners = new Set<Listener>();

export function subscribeNotify(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: NotifyEvent) {
  for (const listener of listeners) listener(event);
}

function uid() {
  return `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Default auto-dismiss durations (ms). null = sticky. */
export const NOTIFY_DEFAULT_DURATION: Record<NotifyType, number | null> = {
  notification: 2500,
  success: 4000,
  info: 4000,
  warning: 5500,
  error: 6500,
  failure: 6500,
  alert: null,
  approval: null,
};

function normalize(
  type: NotifyType,
  messageOrInput: string | NotifyInput,
  maybeInput?: NotifyInput,
): AppNotification {
  const input: NotifyInput =
    typeof messageOrInput === "string"
      ? { message: messageOrInput, ...(maybeInput ?? {}) }
      : messageOrInput;

  const title = input.title?.trim() || input.message?.trim() || defaultTitle(type);
  const description =
    input.description?.trim() ||
    (input.title && input.message ? input.message.trim() : undefined) ||
    undefined;

  const durationOpt = input.duration;
  const duration =
    durationOpt === false || durationOpt === null || durationOpt === 0
      ? null
      : typeof durationOpt === "number"
        ? durationOpt
        : NOTIFY_DEFAULT_DURATION[type];

  return {
    id: uid(),
    type,
    title,
    description,
    duration,
    createdAt: Date.now(),
    action: input.action,
    secondaryAction: input.secondaryAction,
  };
}

function defaultTitle(type: NotifyType): string {
  switch (type) {
    case "success":
      return "Success";
    case "error":
      return "Error";
    case "failure":
      return "Failed";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
    case "alert":
      return "Alert";
    case "approval":
      return "Approval required";
    case "notification":
      return "Notification";
  }
}

function push(type: NotifyType, messageOrInput: string | NotifyInput, maybeInput?: NotifyInput) {
  const notification = normalize(type, messageOrInput, maybeInput);
  emit({ kind: "push", notification });
  return notification.id;
}

/** Imperative API — call after an activity completes. */
export const notify = {
  /** Brief self-dismissing toast. */
  short(message: string, input?: NotifyInput) {
    return push("notification", message, input);
  },
  notification(message: string | NotifyInput, input?: NotifyInput) {
    return push("notification", message, input);
  },
  success(message: string | NotifyInput, input?: NotifyInput) {
    return push("success", message, input);
  },
  error(message: string | NotifyInput, input?: NotifyInput) {
    return push("error", message, input);
  },
  failure(message: string | NotifyInput, input?: NotifyInput) {
    return push("failure", message, input);
  },
  warning(message: string | NotifyInput, input?: NotifyInput) {
    return push("warning", message, input);
  },
  info(message: string | NotifyInput, input?: NotifyInput) {
    return push("info", message, input);
  },
  /** Sticky / longer attention alert. */
  alert(message: string | NotifyInput, input?: NotifyInput) {
    return push("alert", message, input);
  },
  /** Sticky approval-style message with Confirm / Dismiss actions. */
  approval(message: string | NotifyInput, input?: NotifyInput) {
    const base = typeof message === "string" ? { message } : message;
    return push("approval", {
      ...base,
      ...input,
      action: input?.action ?? base.action ?? { label: "Confirm" },
      secondaryAction: input?.secondaryAction ?? base.secondaryAction ?? { label: "Dismiss" },
    });
  },
  dismiss(id: string) {
    emit({ kind: "dismiss", id });
  },
  clear() {
    emit({ kind: "clear" });
  },
};
