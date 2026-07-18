/**
 * PipelineForge — Background Worker
 *
 * Polls for pipeline runs in 'running' status and executes stages.
 * For M1, this is a stub. Full implementation in M4.
 *
 * Architecture: Simple polling loop every 5 seconds.
 * State machine defined in ARCHITECTURE.md Section 6.
 */

const POLL_INTERVAL_MS = 5000;

async function workerLoop() {
  console.log("[worker] PipelineForge worker started (stub)");
  console.log("[worker] Polling interval:", POLL_INTERVAL_MS, "ms");
  console.log("[worker] Full pipeline execution engine coming in M4.");

  let iteration = 0;

  setInterval(() => {
    iteration++;
    if (iteration % 12 === 0) {
      // Log every minute
      console.log(`[worker] Heartbeat — iteration ${iteration}`);
    }
  }, POLL_INTERVAL_MS);
}

// Start the worker if run directly
workerLoop().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
