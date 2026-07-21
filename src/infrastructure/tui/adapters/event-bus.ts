/**
 * A-FORGE TUI Event Bus — Simple pub/sub for SSE events
 *
 * Minimal event bus: publish → all subscribers receive.
 * Used by AgentManager to emit job lifecycle events,
 * and by the SSE /events endpoint to push to connected clients.
 *
 * Extended with WM (World Model) events for Phase 1.5 alert pipeline.
 *
 * F1 AMANAH: Read-only event stream. No mutation from subscribers.
 * F8 LAW: Events are observations of state changes, not commands.
 */

export type JobLifecycleEvent =
  | { type: "job_enqueued"; jobId: string; task: string; priority: string; timestamp: string }
  | { type: "job_started"; jobId: string; workerId: string; timestamp: string }
  | { type: "job_completed"; jobId: string; turnsUsed: number; timestamp: string }
  | { type: "job_failed"; jobId: string; error: string; timestamp: string }
  | { type: "job_cancelled"; jobId: string; timestamp: string }
  | { type: "job_hold"; jobId: string; ticketId: string; timestamp: string };

/** World Model gap alert — Phase 1.5 (L3: SURPRISE TEACHES MORE THAN ROUTINE) */
export type WmGapAlertEvent = {
  type: "wm_gap_alert";
  tool: string;
  action_hash: string;
  gap_score: number;
  confidence: number;
  severity: "CRITICAL" | "WARN" | "INFO";
  message: string;
  timestamp: string;
};

export type SseEvent =
  | JobLifecycleEvent
  | { type: "heartbeat"; timestamp: string }
  | WmGapAlertEvent;

type Subscriber = (event: SseEvent) => void;

const subscribers: Set<Subscriber> = new Set();

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

export function publish(event: SseEvent): void {
  const json = JSON.stringify(event);
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      // subscriber disconnected — skip
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size;
}
