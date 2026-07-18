/**
 * PipelineForge — Background Worker
 *
 * Polls for pipeline runs in 'running' status and executes stages.
 * State machine defined in ARCHITECTURE.md Section 6.
 *
 * Architecture: Simple polling loop every 5 seconds.
 * For beta, uses DB polling instead of a message queue.
 */

import { processRunningRuns } from "../../src/backend/src/services/pipeline-executor";

// Ensure the DB is initialized and migrations run
import "../../src/backend/src/db/migrate";

const POLL_INTERVAL_MS = 5000;

async function workerLoop() {
  console.log("[worker] PipelineForge worker started");
  console.log("[worker] Polling interval:", POLL_INTERVAL_MS, "ms");
  console.log("[worker] Executing pipeline stages...");

  let iteration = 0;
  let totalProcessed = 0;

  async function poll() {
    iteration++;
    try {
      const processed = await processRunningRuns();
      totalProcessed += processed;

      if (processed > 0) {
        console.log(`[worker] Iteration ${iteration}: processed ${processed} stage(s) (total: ${totalProcessed})`);
      } else if (iteration % 12 === 0) {
        // Heartbeat every minute
        console.log(`[worker] Heartbeat — iteration ${iteration}, total processed: ${totalProcessed}`);
      }
    } catch (err) {
      console.error("[worker] Error processing runs:", err);
    }
  }

  // Initial poll
  await poll();

  // Poll on interval
  setInterval(poll, POLL_INTERVAL_MS);
}

// Start the worker if run directly
workerLoop().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
