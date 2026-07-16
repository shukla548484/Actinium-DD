/**
 * Notifies shell UI (header task badge, daily approvals list, notifications)
 * to refetch pending task counts after queue mutations (submit, approve, etc.).
 */

export const PENDING_TASKS_CHANGED_EVENT = "act-pending-tasks-changed";

const BROADCAST_CHANNEL = "act-pending-tasks";

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  try {
    if (!broadcastChannel) {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
    }
    return broadcastChannel;
  } catch {
    return null;
  }
}

/** Call after any mutation that adds or removes Master daily-approval / task queue items. */
export function signalPendingTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PENDING_TASKS_CHANGED_EVENT, { detail: { at: Date.now() } })
  );
  try {
    getBroadcastChannel()?.postMessage({ at: Date.now() });
  } catch {
    /* BroadcastChannel unavailable */
  }
}

export function subscribePendingTasksChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(PENDING_TASKS_CHANGED_EVENT, listener);
  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = listener;
  }
  return () => {
    window.removeEventListener(PENDING_TASKS_CHANGED_EVENT, listener);
    if (channel) channel.onmessage = null;
  };
}
