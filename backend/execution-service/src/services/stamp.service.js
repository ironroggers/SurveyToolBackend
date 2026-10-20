import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

// Burns the location stamp into a photo or video with ffmpeg: a dark band at the bottom
// with the place, the full address, Lat, Long, the IST date and time, and accuracy /
// device. Same look for both, and for every client.

const require = createRequire(import.meta.url);
export const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
export const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");
const BADGE = "Locus GPS Camera";

export const runFfmpeg = (args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = String(stderr || "").slice(-2000);
        reject(error);
      } else resolve(String(stderr || ""));
    });
  });

// Paths inside a filter graph: escape the characters the parser treats specially
export const filterPath = (p) => p.replace(/\\/g, "/").replace(/([:'\[\],;])/g, "\\$1");

// ---- text

const IST = "Asia/Kolkata";
// "18/09/24 01:05 PM GMT +05:30"
export const stampTime = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: IST, day: "2-digit", month: "2-digit", year: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: true }).format(d);
  return `${date} ${time} GMT +05:30`;
};

// "B4, Block A, Qutab Institutional Area, New Delhi, Delhi 110016, India" -> "New Delhi, Delhi, India"
export const placeTitle = (place) => {
  const parts = String(place || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return parts.join(", ");
  const country = parts[parts.length - 1];
  const state = parts[parts.length - 2].replace(/\b\d{5,6}\b/g, "").trim();
  const city = parts[parts.length - 3];
  return [city, state, country].filter(Boolean).join(", ");
};

const coord = (v) => (Number.isFinite(Number(v)) ? `${Number(v).toFixed(6)}°` : "—");

// Greedy word wrap to `max` characters, at most `lines` lines (the last one cut with …)
const wrap = (text, max, lines) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if ((line + " " + word).length <= max) line += " " + word;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = `${kept[lines - 1].slice(0, Math.max(0, max - 1))}…`;
    return kept;
  }
  return out.map((l) => (l.length > max ? `${l.slice(0, max - 1)}…` : l));
};

/** The stamp's lines: [{ text, bold, scale }] */
export const stampLines = (meta, maxChars) => {
  const title = placeTitle(meta.place) || "Location";
  const lines = [{ text: wrap(title, Math.floor(maxChars / 1.15), 1)[0] || title, bold: true, scale: 1.15 }];
  if (meta.place) wrap(meta.place, maxChars, 2).forEach((text) => lines.push({ text }));
  lines.push({ text: `Lat ${coord(meta.latitude)}` });
  lines.push({ text: `Long ${coord(meta.longitude)}` });
  const time = stampTime(meta.capturedAt);
  if (time) lines.push({ text: time });
  const extra = [
    Number.isFinite(Number(meta.accuracy)) && meta.accuracy !== null && meta.accuracy !== "" ? `±${Number(meta.accuracy).toFixed(1)} m` : "",
    meta.locationSource === "MANUAL" ? "Location typed" : "",
    meta.source === "UPLOAD" ? "Uploaded" : "",
    meta.deviceName,
  ].filter(Boolean);
  if (extra.length) lines.push({ text: wrap(extra.join(" · "), Math.floor(maxChars / 0.8), 1)[0], scale: 0.8 });
  return lines;
};

// ---- geometry: the filter graph for a frame of width W and height H

export const buildFilter = async (dir, W, H, meta) => {
  const fs = Math.max(12, Math.round(Math.min(W, H) * 0.03));
  const margin = Math.round(Math.min(W, H) * 0.02);
  const pad = Math.round(fs * 0.7);
  const boxW = W - margin * 2;
  // DejaVu Sans averages about 0.55 em per character
  const maxChars = Math.max(16, Math.floor((boxW - pad * 2) / (fs * 0.56)));
  const lines = stampLines(meta, maxChars);
  const heights = lines.map((l) => Math.round(fs * (l.scale || 1) * 1.38));
  const boxH = pad * 2 + heights.reduce((a, b) => a + b, 0);
  const boxY = H - margin - boxH;

  const filters = [`drawbox=x=${margin}:y=${boxY}:w=${boxW}:h=${boxH}:color=black@0.55:t=fill`];
  const text = async (i, value, opts) => {
    const file = path.join(dir, `line${i}.txt`);
    await writeFile(file, value, "utf8");
    return [
      `drawtext=fontfile=${filterPath(opts.bold ? FONT_BOLD : FONT)}`,
      `textfile=${filterPath(file)}`,
      "expansion=none",
      `fontsize=${opts.size}`,
      `fontcolor=${opts.color || "white"}`,
      "shadowcolor=black@0.6:shadowx=1:shadowy=1",
      `x=${opts.x}`,
      `y=${opts.y}`,
    ].join(":");
  };

  let y = boxY + pad;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    filters.push(await text(i, l.text, { bold: l.bold, size: Math.round(fs * (l.scale || 1)), x: margin + pad, y }));
    y += heights[i];
  }

  // App badge at the top right of the band, like a camera app's watermark
  const badgeSize = Math.round(fs * 0.85);
  const badgePad = Math.round(badgeSize * 0.45);
  const badgeH = badgeSize + badgePad * 2;
  const badgeW = Math.round(BADGE.length * badgeSize * 0.62) + badgePad * 2;
  const badgeX = W - margin - badgeW;
  const badgeY = boxY - badgeH - Math.round(margin / 2);
  filters.push(`drawbox=x=${badgeX}:y=${badgeY}:w=${badgeW}:h=${badgeH}:color=black@0.55:t=fill`);
  filters.push(await text(lines.length, BADGE, { bold: true, size: badgeSize, x: `${badgeX}+(${badgeW}-text_w)/2`, y: badgeY + badgePad }));

  return filters.join(",");
};

// Width, height and rotation from ffmpeg's probe output
const probe = async (file) => {
  let out = "";
  try {
    out = await runFfmpeg(["-hide_banner", "-i", file], 30000);
  } catch (error) {
    // `ffmpeg -i` without an output always exits with an error; the info is in stderr
    out = error.stderr || "";
  }
  const size = out.match(/Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  const rotation = Number((out.match(/rotation of (-?[\d.]+) degrees/) || out.match(/rotate\s*:\s*(-?\d+)/) || [])[1] || 0);
  const duration = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!size) throw new Error("Couldn't read the media dimensions");
  let [W, H] = [Number(size[1]), Number(size[2])];
  if (Math.abs(rotation) % 180 === 90) [W, H] = [H, W];
  return { W, H, durationSec: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null };
};

/**
 * Stamps `input` (a local file) and returns the stamped output path inside `dir`.
 * Photos come out as JPEG, videos as H.264/AAC MP4.
 */
export const stampFile = async ({ input, fileType, meta, dir }) => {
  if (fileType === "VIDEO") {
    const { W, H } = await probe(input);
    const filter = await buildFilter(dir, W, H, meta);
    const output = path.join(dir, "stamped.mp4");
    await runFfmpeg(
      ["-hide_banner", "-y", "-i", input, "-vf", filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output],
      10 * 60 * 1000
    );
    return { output, contentType: "video/mp4" };
  }
  // Apply EXIF orientation first so the band ends up at the bottom of the picture as seen
  const oriented = path.join(dir, "oriented.png");
  const info = await sharp(input).rotate().png().toFile(oriented);
  const filter = await buildFilter(dir, info.width, info.height, meta);
  const output = path.join(dir, "stamped.jpg");
  await runFfmpeg(["-hide_banner", "-y", "-i", oriented, "-vf", filter, "-q:v", "3", output], 2 * 60 * 1000);
  return { output, contentType: "image/jpeg" };
};

// A temp directory removed after `fn`, whatever happens
export const withTempDir = async (fn) => {
  const dir = await mkdtemp(path.join(tmpdir(), "stamp-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
