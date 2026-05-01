/**
 * In-memory registry mapping jobId → spawned ChildProcess.
 *
 * Allows the cancel endpoint to send SIGTERM to an in-flight Python detector
 * process without storing the PID in the database.
 *
 * NOTE: This only works when the API runs as a long-lived Node process
 * (local dev, self-hosted).  On stateless serverless platforms (Vercel
 * serverless functions) each request runs in an isolated instance so the
 * cancel endpoint may not find the process — in that case the DB row is still
 * marked "cancelled" and the frontend stops polling regardless.
 */
import type { ChildProcess } from "child_process";

const registry = new Map<string, ChildProcess>();

export function registerProcess(jobId: string, proc: ChildProcess): void {
  registry.set(jobId, proc);
}

export function killProcess(jobId: string): boolean {
  const proc = registry.get(jobId);
  if (!proc) return false;
  try {
    proc.kill("SIGTERM");
  } catch {
    // Process may have already exited — ignore.
  }
  registry.delete(jobId);
  return true;
}

export function unregisterProcess(jobId: string): void {
  registry.delete(jobId);
}
