import { Queue, Worker } from "bullmq";
import { spatialGenerationService } from "@/services/spatial-generation.service";

const QUEUE_NAME = "worldlabs-jobs";

let workerStarted = false;

function getConnection() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url, maxRetriesPerRequest: null as null };
}

export function getWorldLabsQueue() {
  const connection = getConnection();
  if (!connection) return null;
  return new Queue(QUEUE_NAME, { connection });
}

export async function enqueueWorldLabsJob(jobId: string) {
  const queue = getWorldLabsQueue();
  if (queue) {
    await queue.add("process", { jobId }, { attempts: 3, backoff: { type: "exponential", delay: 30000 } });
    return "bullmq";
  }
  spatialGenerationService.processSpatialJob(jobId).catch(console.error);
  return "inline";
}

export function startWorldLabsWorker() {
  if (workerStarted || typeof window !== "undefined") return;
  const connection = getConnection();
  if (!connection) return;

  workerStarted = true;
  new Worker(
    QUEUE_NAME,
    async (job) => {
      await spatialGenerationService.processSpatialJob(job.data.jobId);
    },
    { connection },
  );
}
