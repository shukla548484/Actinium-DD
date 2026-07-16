

type MonitoringContext = {
  userId?: string;
  [key: string]: any;
};

let globalContext: MonitoringContext = {};

if (typeof window !== 'undefined') {
  globalContext.userAgent = navigator.userAgent;
}

export const setUserContext = (user: { id: string; email?: string; role?: string }) => {
  if (!user) return;
  globalContext.userId = user.id;
  globalContext.userEmail = user.email;
  globalContext.userRole = user.role;
};

export const clearUserContext = () => {
  globalContext = {};
  if (typeof window !== 'undefined') {
    globalContext.userAgent = navigator.userAgent;
  }
};

const sendLog = async (type: "error" | "performance" | "activity", data: any) => {
  // If server-side, just log to console for now to avoid fetch issues
  if (typeof window === "undefined") {
    if (type === 'error') {
        console.error(`[Server Monitor] ${data.message}`, data);
    } else if (type === 'activity') {
        console.log(`[Server Monitor] Activity: ${data.activityType} - ${data.activityDescription}`);
    } else {
        console.log(`[Server Monitor] ${data.metric}: ${data.value}ms`);
    }
    return;
  }

  try {
    const payload = {
      ...data,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: globalContext.userId,
      metadata: {
        ...data.metadata,
        ...globalContext,
      }
    };

    // Use sendBeacon for better reliability on page unload, fallback to fetch
    const body = JSON.stringify({ type, data: payload });
    
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/monitoring', blob);
    } else {
      await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch (e) {
    console.error("Failed to send monitoring log", e);
  }
};

export const monitorError = (error: any, context?: Record<string, any>) => {
  const message = error?.message ?? (typeof error === "string" ? error : "Unknown Error");
  const stack = error?.stack;
  const name = error?.name ?? "Error";
  const digest = error?.digest;

  console.error(`Monitored Error: ${name}: ${message}`, {
    name,
    message,
    digest,
    stack,
    context,
    raw: error,
  });

  sendLog("error", {
    message: `${name}: ${message}`,
    stack,
    source: "client",
    metadata: { ...context, digest, errorName: name },
  });
};

export const monitorMessage = (message: string, level: string = "info", context?: Record<string, any>) => {
  console.log(`Monitored Message [${level}]:`, message);
  if (level === 'error' || level === 'fatal' || level === 'warning') {
    sendLog("error", {
      message,
      source: "client",
      metadata: { level, ...context },
    });
  }
};

export const monitorPerformance = (metric: string, value: number, metadata?: Record<string, any>) => {
  sendLog("performance", {
    metric,
    value,
    metadata,
  });
};

export const monitorActivity = (
  activityType: string,
  activityDescription: string,
  metadata?: Record<string, any>
) => {
  // Extract module/page from window.location if available
  let module = "unknown";
  let page = "unknown";
  
  if (typeof window !== 'undefined') {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    module = pathParts[0] || "home";
    page = pathParts.length > 1 ? pathParts.slice(1).join('/') : "index";
  }

  sendLog("activity", {
    activityType,
    activityDescription,
    module,
    page,
    metadata,
  });
};

export const startTransaction = (name: string, op: string) => {
  const start = Date.now();
  return {
    finish: () => {
      const duration = Date.now() - start;
      monitorPerformance(`transaction:${name}`, duration, { op });
    },
    end: () => { // Sentry alias
      const duration = Date.now() - start;
      monitorPerformance(`transaction:${name}`, duration, { op });
    }
  };
};
