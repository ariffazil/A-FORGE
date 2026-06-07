/**
 * ID generation helper — uses Node's built-in crypto.randomUUID().
 *
 * No external `ulid` dep needed (Node 22+ has crypto.randomUUID() built in).
 * IDs are prefixed with a type tag for human-readability:
 *   - plan_<uuid>
 *   - mission_<uuid>
 *   - outcomespec_<uuid>
 *   - veto_<uuid>
 *   - task_<uuid>
 */

import { randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function newPlanId(): string {
  return newId("plan");
}

export function newMissionId(): string {
  return newId("mission");
}

export function newOutcomeSpecId(): string {
  return newId("outcomespec");
}

export function newVetoId(): string {
  return newId("veto");
}

export function newTaskId(): string {
  return newId("task");
}
