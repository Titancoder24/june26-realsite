export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
      await import("../sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
      await import("../sentry.edge.config");
    }
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { startWorldLabsWorker } = await import("./lib/queue/worldlabs-queue");
      startWorldLabsWorker();
    }
  } catch (err) {
    // Never let optional startup wiring (Sentry, background worker) crash the app.
    console.error("[instrumentation] register() failed:", err);
  }
}
