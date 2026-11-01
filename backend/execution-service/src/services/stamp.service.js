import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

// Burns the location stamp into a photo or video: a dark band at the bottom with the place,
// the full address, Lat, Long, the IST date and time, and accuracy / device. Same look for
// both, and for every client. The stamp is drawn with sharp and laid over the frame, because
// the Linux ffmpeg-static build has no drawtext filter. sharp also shapes Indian scripts,
// which the Dockerfile's Noto fonts cover. The GPS position also goes in the file's metadata.

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

// ---- the stamp as a transparent image the size of the frame

const escapeMarkup = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const textImage = async (value, size, bold, maxWidth) => {
  const png = await sharp({
    text: {
      text: `<span foreground="white">${escapeMarkup(value)}</span>`,
      font: `DejaVu Sans${bold ? " Bold" : ""} ${size}`,
      fontfile: bold ? FONT_BOLD : FONT,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();
  const { width, height } = await sharp(png).metadata();
  if (width <= maxWidth) return { input: png, width, height };
  return { input: await sharp(png).extract({ left: 0, top: 0, width: maxWidth, height }).png().toBuffer(), width: maxWidth, height };
};

const panel = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.55 } } }).png().toBuffer();

export const stampOverlay = async (W, H, meta) => {
  const fs = Math.max(12, Math.round(Math.min(W, H) * 0.03));
  const margin = Math.round(Math.min(W, H) * 0.02);
  const pad = Math.round(fs * 0.7);
  const boxW = W - margin * 2;
  // DejaVu Sans averages about 0.55 em per character
  const maxChars = Math.max(16, Math.floor((boxW - pad * 2) / (fs * 0.56)));
  const lines = stampLines(meta, maxChars);
  const heights = lines.map((l) => Math.round(fs * (l.scale || 1) * 1.38));
  const boxH = Math.min(H, pad * 2 + heights.reduce((a, b) => a + b, 0));
  const boxY = Math.max(0, H - margin - boxH);
  const layers = [{ input: await panel(boxW, boxH), left: margin, top: boxY }];

  let y = boxY + pad;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (y >= H) break;
    const line = await textImage(l.text, Math.round(fs * (l.scale || 1)), l.bold, boxW - pad * 2);
    const room = H - y;
    const input = line.height > room ? await sharp(line.input).extract({ left: 0, top: 0, width: line.width, height: room }).png().toBuffer() : line.input;
    layers.push({ input, left: margin + pad, top: y });
    y += heights[i];
  }

  // App badge at the top right of the band, like a camera app's watermark
  const badgeSize = Math.round(fs * 0.85);
  const badgePad = Math.round(badgeSize * 0.45);
  const badge = await textImage(BADGE, badgeSize, true, boxW - badgePad * 2);
  const badgeW = badge.width + badgePad * 2;
  const badgeH = badge.height + badgePad * 2;
  const badgeY = boxY - badgeH - Math.round(margin / 2);
  if (badgeY >= 0) {
    const badgeX = W - margin - badgeW;
    layers.push({ input: await panel(badgeW, badgeH), left: badgeX, top: badgeY });
    layers.push({ input: badge.input, left: badgeX + badgePad, top: badgeY + badgePad });
  }

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
};

// ---- the GPS position in the file's metadata

const hasPosition = (meta) => Number.isFinite(Number(meta.latitude)) && Number.isFinite(Number(meta.longitude));

// 9.981634 -> "9/1 58/1 5382/100"
const exifCoord = (value) => {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60 * 100);
  return `${degrees}/1 ${minutes}/1 ${seconds}/100`;
};

const gpsExif = (meta) => {
  const lat = Number(meta.latitude);
  const lng = Number(meta.longitude);
  return {
    IFD3: {
      GPSLatitudeRef: lat < 0 ? "S" : "N",
      GPSLatitude: exifCoord(lat),
      GPSLongitudeRef: lng < 0 ? "W" : "E",
      GPSLongitude: exifCoord(lng),
    },
  };
};

// ISO 6709, as phones write it: "+09.981634+076.299900/"
const iso6709 = (meta) => {
  const part = (value, width) => {
    const n = Number(value);
    return `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(6).padStart(width, "0")}`;
  };
  return `${part(meta.latitude, 9)}${part(meta.longitude, 10)}/`;
};

// ---- geometry: the ffmpeg filter graph for the demo block's generated media

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
    const overlay = path.join(dir, "stamp.png");
    await writeFile(overlay, await stampOverlay(W, H, meta));
    const output = path.join(dir, "stamped.mp4");
    const position = hasPosition(meta) ? ["-metadata", `com.apple.quicktime.location.ISO6709=${iso6709(meta)}`] : [];
    await runFfmpeg(
      ["-hide_banner", "-y", "-i", input, "-i", overlay, "-filter_complex", "[0:v][1:v]overlay=0:0[v]", "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", ...position, "-movflags", "+faststart+use_metadata_tags", output],
      10 * 60 * 1000
    );
    return { output, contentType: "video/mp4" };
  }
  // Apply EXIF orientation first so the band ends up at the bottom of the picture as seen
  const oriented = await sharp(input).rotate().png().toBuffer();
  const { width, height } = await sharp(oriented).metadata();
  const output = path.join(dir, "stamped.jpg");
  const stamped = sharp(oriented).composite([{ input: await stampOverlay(width, height, meta) }]).jpeg({ quality: 88 });
  await (hasPosition(meta) ? stamped.withExif(gpsExif(meta)) : stamped).toFile(output);
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

/**
 * A stamped photo under maxBytes: steps quality down, then size, so the stamp stays readable
 * for as long as possible. Returns the path of the file to keep.
 */
export const shrinkImage = async (input, maxBytes, dir) => {
  if ((await stat(input)).size <= maxBytes) return input;
  const steps = [
    [1280, 75],
    [1280, 65],
    [1280, 55],
    [1024, 60],
    [1024, 50],
    [800, 50],
    [640, 45],
  ];
  const source = await sharp(input).toBuffer();
  const output = path.join(dir, "under-limit.jpg");
  for (const [width, quality] of steps) {
    const { size } = await sharp(source).resize({ width, withoutEnlargement: true }).jpeg({ quality }).withMetadata().toFile(output);
    if (size <= maxBytes) break;
  }
  return output;
};
