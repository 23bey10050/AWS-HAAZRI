import { get, set, del, keys } from "idb-keyval";
import { postAttendance } from "../api/client";

const QUEUE_PREFIX = "haazri-pending:";

export async function enqueue(record) {
  const id = `${QUEUE_PREFIX}${record.record_date}-${Date.now()}`;
  await set(id, record);
  return id;
}

export async function removeFromQueue(id) {
  await del(id);
}

export async function drainQueue() {
  if (!navigator.onLine) return;
  const allKeys = (await keys()).filter((k) => k.toString().startsWith(QUEUE_PREFIX));
  for (const key of allKeys) {
    const record = await get(key);
    try {
      await postAttendance(record); // idempotent server-side — safe to retry
      await del(key);
    } catch {
      // leave it queued; next interval retries. No backoff needed at this call volume.
    }
  }
}

export function startBackgroundSync(intervalMs = 30000) {
  const id = setInterval(drainQueue, intervalMs);
  window.addEventListener("online", drainQueue);
  drainQueue(); // attempt immediately on load too
  return () => {
    clearInterval(id);
    window.removeEventListener("online", drainQueue);
  };
}
