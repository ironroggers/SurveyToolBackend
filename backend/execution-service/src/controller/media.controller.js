import path from "node:path";
import SubSection from "../models/subSection.model.js";
import Trenching from "../models/trenching.model.js";
import InfraCapture from "../models/infraCapture.model.js";
import Restoration from "../models/restoration.model.js";
import { badRequest, conflict, notFound, sendError } from "../utils/httpError.js";
import { getObjectStream, keyFromUrl } from "../utils/s3.js";
import { collectMedia, ensureStamped, queueStamps } from "../services/stampQueue.service.js";

// The MediaFile with this URL, wherever the execution flow stored it
const findMediaByUrl = async (url) => {
  const docs = await Promise.all([
    Trenching.findOne({ "mediaFiles.url": url }).lean(),
    SubSection.findOne({
      $or: ["initialCondition.photos", "initialCondition.video", "start.photos", "start.video", "end.photos", "end.video"].map((p) => ({ [`${p}.url`]: url })),
    }).lean(),
    InfraCapture.findOne({ "photos.media.url": url }).lean(),
    Restoration.findOne({ $or: [{ "items.photos.url": url }, { "items.video.url": url }] }).lean(),
  ]);
  for (const doc of docs) {
    const media = doc && collectMedia(doc).find((m) => m.url === url);
    if (media) return media;
  }
  return null;
};

const safeName = (name, fallback) =>
  String(name || fallback)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || fallback;

// GET /api/media/download?url=&name=   (viewExecution)
// The file with its location stamp, as an attachment. A file whose stamp is still
// queued is stamped first; media saved before stamping existed is stamped on first download.
export const downloadMedia = async (req, res) => {
  try {
    const url = String(req.query.url || "");
    const key = keyFromUrl(url);
    if (!key) throw badRequest("Only files stored by this service can be downloaded here");

    let job = await ensureStamped(key);
    if (!job) {
      const media = await findMediaByUrl(url);
      if (!media) throw notFound("File not found");
      if (media.s3Key) {
        await queueStamps([media]);
        job = await ensureStamped(key);
      }
    }
    if (job?.status === "PROCESSING") throw conflict("Still adding the location stamp. Try again in a minute.", "STAMPING");

    const object = await getObjectStream(key);
    const isVideo = String(object.ContentType || "").startsWith("video/") || job?.fileType === "VIDEO";
    const ext = job?.status === "DONE" ? (isVideo ? ".mp4" : ".jpg") : path.extname(key) || (isVideo ? ".mp4" : ".jpg");
    const base = safeName(req.query.name, `locus-${isVideo ? "video" : "photo"}-${Date.now()}`).replace(/\.[A-Za-z0-9]+$/, "");
    res.setHeader("Content-Type", object.ContentType || (isVideo ? "video/mp4" : "image/jpeg"));
    if (object.ContentLength) res.setHeader("Content-Length", String(object.ContentLength));
    res.setHeader("Content-Disposition", `attachment; filename="${base}${ext}"`);
    res.setHeader("Cache-Control", "no-store");
    // Lets the web portal read the file name when it downloads with fetch
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    object.Body.on("error", () => res.destroy());
    object.Body.pipe(res);
  } catch (error) {
    if (error?.name === "NoSuchKey") return sendError(res, notFound("File not found in storage"));
    sendError(res, error);
  }
};
