import type { JobStatus } from "./types";

/**
 * backend/src/controllers/jobsController.ts:VALID_TRANSITIONS ile birebir —
 * iki tarafta da aynı tablo tutulur ki UI'da sunulan seçenekler backend'in
 * kabul edeceği geçişlerle her zaman örtüşsün (mobile/lib/models/job.dart'ta
 * da aynı tablo kullanılır).
 */
export const VALID_JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ["PENDING", "SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["SCHEDULED", "PENDING", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

export function getValidNextStatuses(current: JobStatus): JobStatus[] {
  return VALID_JOB_STATUS_TRANSITIONS[current];
}

/** URL parametresi gibi dış kaynaklardan gelen durum dizesini doğrulamak için. */
export const JOB_STATUS_VALUES = Object.keys(VALID_JOB_STATUS_TRANSITIONS) as JobStatus[];
