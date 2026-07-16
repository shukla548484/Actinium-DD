import { mapAllSettledWithConcurrency } from "@/lib/promise-batches";

/** Per-email processing ceiling (matches Prisma staging transaction budget). */
export const QUOTE_EMAIL_PROCESS_TIMEOUT_MS = 60_000;

const DEFAULT_PARALLEL = 4;
const DEFAULT_RETRY_CHUNK = 1;

export type QuoteEmailProcessOutcome = {
  success: boolean;
  skipped?: boolean;
  error?: string;
  quoteId?: string;
};

export type QuoteEmailBatchResult = {
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{ emailId: string; error: string }>;
};

export function getQuoteEmailParallelConcurrency(): number {
  const raw = process.env.QUOTE_EMAIL_PARALLEL_CONCURRENCY;
  const n = raw ? parseInt(raw, 10) : DEFAULT_PARALLEL;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PARALLEL;
  return Math.min(n, 10);
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const size = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function withProcessingTimeout<T>(
  promise: Promise<T>,
  ms: number = QUOTE_EMAIL_PROCESS_TIMEOUT_MS,
  label?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Quote email processing timed out after ${ms}ms${label ? ` (${label})` : ""}`
        )
      );
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function tallyOutcome(
  emailId: string,
  outcome: QuoteEmailProcessOutcome,
  results: QuoteEmailBatchResult
): void {
  if (outcome.success) {
    if (outcome.skipped) {
      results.skipped++;
    } else {
      results.processed++;
    }
    return;
  }
  results.failed++;
  results.errors.push({
    emailId,
    error: outcome.error || "Unknown error",
  });
}

async function runOneWithTimeout(
  emailId: string,
  processOne: (emailId: string) => Promise<QuoteEmailProcessOutcome>,
  timeoutMs: number
): Promise<QuoteEmailProcessOutcome> {
  try {
    return await withProcessingTimeout(
      processOne(emailId),
      timeoutMs,
      `email ${emailId}`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Phase 1: process emails in parallel (capped concurrency, 60s each).
 * Phase 2: retry failures alone, one chunk at a time (same timeout).
 */
export async function processQuoteEmailsInBatch(
  emailIds: string[],
  processOne: (emailId: string) => Promise<QuoteEmailProcessOutcome>,
  options?: {
    concurrency?: number;
    timeoutMs?: number;
    retryChunkSize?: number;
  }
): Promise<QuoteEmailBatchResult> {
  const results: QuoteEmailBatchResult = {
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (emailIds.length === 0) {
    return results;
  }

  const concurrency = options?.concurrency ?? getQuoteEmailParallelConcurrency();
  const timeoutMs = options?.timeoutMs ?? QUOTE_EMAIL_PROCESS_TIMEOUT_MS;
  const retryChunkSize = options?.retryChunkSize ?? DEFAULT_RETRY_CHUNK;

  const uniqueIds = [...new Set(emailIds)];

  console.log(
    `🔄 Quote batch: ${uniqueIds.length} email(s), parallel=${concurrency}, timeout=${timeoutMs}ms`
  );

  const parallelTasks = uniqueIds.map(
    (emailId) => () => runOneWithTimeout(emailId, processOne, timeoutMs)
  );

  const settled = await mapAllSettledWithConcurrency(parallelTasks, concurrency);

  const failedIds: string[] = [];

  settled.forEach((entry, index) => {
    const emailId = uniqueIds[index];
    if (entry.status === "rejected") {
      failedIds.push(emailId);
      results.failed++;
      results.errors.push({
        emailId,
        error:
          entry.reason instanceof Error
            ? entry.reason.message
            : String(entry.reason),
      });
      return;
    }
    const outcome = entry.value;
    if (!outcome.success) {
      failedIds.push(emailId);
    }
    tallyOutcome(emailId, outcome, results);
  });

  if (failedIds.length === 0) {
    console.log(
      `📊 Quote batch complete: ${results.processed} processed, ${results.skipped} skipped, ${results.failed} failed`
    );
    return results;
  }

  // Adjust tallies — failures will be retried individually; remove duplicate error rows first pass
  for (const emailId of failedIds) {
    const idx = results.errors.findIndex((e) => e.emailId === emailId);
    if (idx >= 0) {
      results.errors.splice(idx, 1);
      results.failed--;
    }
  }

  console.log(
    `🔁 Quote batch retry: ${failedIds.length} failed email(s) in chunks of ${retryChunkSize}`
  );

  const retryChunks = chunkArray(failedIds, retryChunkSize);

  for (const chunk of retryChunks) {
    for (const emailId of chunk) {
      console.log(`🔁 Retrying quote email ${emailId} (solo)`);
      const outcome = await runOneWithTimeout(emailId, processOne, timeoutMs);
      tallyOutcome(emailId, outcome, results);
      if (outcome.success && !outcome.skipped) {
        console.log(`✅ Retry succeeded for email ${emailId}`);
      } else if (!outcome.success) {
        console.error(`❌ Retry failed for email ${emailId}: ${outcome.error}`);
      }
    }
  }

  console.log(
    `📊 Quote batch complete: ${results.processed} processed, ${results.skipped} skipped, ${results.failed} failed`
  );

  return results;
}
