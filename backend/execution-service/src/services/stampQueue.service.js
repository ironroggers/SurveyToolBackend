import path from "node:path";
import MediaStamp from "../models/mediaStamp.model.js";
import { downloadToFile, getS3Bucket, keyFromUrl, uploadFromFile } from "../utils/s3.js";
import { stampFile, withTempDir } from "./stamp.service.js";

// Every photo and video saved through the execution flow gets the location stamp burned
// in on the server, after upload: one job per file, worked one at a time in the
// background. The stamped file replaces the original at the same S3 key.
//
// Only media uploaded through the presign flow (with an s3Key) is queued. Older media
// has no s3Key; the old app already burned its own stamp into those photos.

const MAX_ATTEMPTS = 3;
const POLL_MS = 3000;
const STUCK_MS = 15 * 60 * 1000;

const isMedia = (v) => v && typeof v === "object" && typeof v.url === "string" && (v.fileType === "IMAGE" || v.fileType === "VIDEO");

// Every MediaFile inside a document (subsection, entry, infra capture, restoration item)
export const collectMedia = (doc) => {
  const found = [];
  const seen = new Set();
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 8 || seen.has(v)) return;
    seen.add(v);
    if (isMedia(v)) {
      found.push(v);
      return;
    }
    if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
    else Object.keys(v).forEach((k) => walk(v[k], depth + 1));
  };
  walk(typeof doc?.toObject === "function" ? doc.toObject() : doc, 0);
  return found;
};

const metaOf = (m) => ({
  latitude: Number(m.latitude),
  longitude: Number(m.longitude),
  accuracy: m.accuracy ?? undefined,
  place: m.place,
  capturedAt: m.capturedAt || m.uploadedAt,
  deviceName: m.deviceName,
  source: m.source,
  locationSource: m.locationSource,
});

/** Queue a stamp for each new media file; files already queued or stamped are left alone */
export const queueStamps = async (media) => {
  if (!getS3Bucket()) return;
  const ops = media
    .filter((m) => m.s3Key && keyFromUrl(m.url) === m.s3Key)
    .map((m) => ({
      updateOne: {
        filter: { s3Key: m.s3Key },
        update: { $setOnInsert: { s3Key: m.s3Key, url: m.url, fileType: m.fileType, meta: metaOf(m), status: "PENDING" } },
        upsert: true,
      },
    }));
  if (!ops.length) return;
  try {
    await MediaStamp.bulkWrite(ops, { ordered: false });
    kick();
  } catch (error) {
    console.error("[stamp] queue error:", error.message);
  }
};

// Called after a save; never fails the request
export const queueStampsFor = (...docs) => {
  queueStamps(docs.flatMap(collectMedia)).catch(() => null);
};

// ---- worker

const stampJob = async (job) => {
  await withTempDir(async (dir) => {
    const ext = path.extname(job.s3Key) || (job.fileType === "VIDEO" ? ".mp4" : ".jpg");
    const input = path.join(dir, `original${ext}`);
    await downloadToFile(job.s3Key, input);
    const { output, contentType } = await stampFile({ input, fileType: job.fileType, meta: job.meta, dir });
    const sizeBytes = await uploadFromFile(job.s3Key, output, contentType);
    await MediaStamp.updateOne({ _id: job._id }, { $set: { status: "DONE", doneAt: new Date(), sizeBytes, error: null } });
  });
};

// Claim and stamp one job; false when there was nothing to do
const runOne = async (filter = { status: "PENDING" }) => {
  const job = await MediaStamp.findOneAndUpdate(
    { ...filter, attempts: { $lt: MAX_ATTEMPTS } },
    { $set: { status: "PROCESSING", startedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, new: true }
  );
  if (!job) return false;
  try {
    await stampJob(job);
    console.log(`[stamp] done ${job.s3Key}`);
  } catch (error) {
    const failed = job.attempts >= MAX_ATTEMPTS;
    console.error(`[stamp] ${failed ? "failed" : "will retry"} ${job.s3Key}:`, error.message, error.stderr || "");
    await MediaStamp.updateOne({ _id: job._id }, { $set: { status: failed ? "FAILED" : "PENDING", error: error.message } });
  }
  return true;
};

let running = false;
let timer = null;

const loop = async () => {
  if (running) return;
  running = true;
  try {
    while (await runOne()) {
      // keep going until the queue is empty
    }
  } catch (error) {
    console.error("[stamp] worker error:", error.message);
  } finally {
    running = false;
  }
};

const kick = () => setImmediate(loop);

/** Start the background worker (after the DB connects). Jobs left PROCESSING by a crash are retried. */
export const startStampWorker = async () => {
  if (timer) return;
  if (!getS3Bucket()) {
    console.warn("[stamp] S3 isn't configured; uploaded media won't be stamped");
    return;
  }
  await MediaStamp.updateMany({ status: "PROCESSING", startedAt: { $lt: new Date(Date.now() - 1000) } }, { $set: { status: "PENDING" } });
  timer = setInterval(() => {
    // A job stuck in PROCESSING for long (killed ffmpeg) goes back to the queue
    MediaStamp.updateMany({ status: "PROCESSING", startedAt: { $lt: new Date(Date.now() - STUCK_MS) } }, { $set: { status: "PENDING" } }).catch(() => null);
    loop();
  }, POLL_MS);
  timer.unref?.();
  kick();
};

/**
 * Make sure a file is stamped before it's downloaded: stamps it now when its job is
 * still waiting. Returns the job (or null for media this service doesn't stamp).
 */
export const ensureStamped = async (s3Key, { waitMs = 120000 } = {}) => {
  const started = Date.now();
  for (;;) {
    const job = await MediaStamp.findOne({ s3Key });
    if (!job || job.status === "DONE" || job.status === "FAILED") return job;
    if (job.status === "PENDING") {
      await runOne({ _id: job._id, status: "PENDING" });
      continue;
    }
    // PROCESSING in the background worker: wait for it
    if (Date.now() - started > waitMs) return job;
    await new Promise((r) => setTimeout(r, 1000));
  }
};
