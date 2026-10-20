import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { FONT, FONT_BOLD, buildFilter, filterPath, runFfmpeg, withTempDir } from "../services/stamp.service.js";

// Photos and videos for the demo block, made with ffmpeg: a simple labelled scene
// ("DEMO · Starting pit · NH66-HDD-001") with the same location stamp real uploads get.
// They're served from /demo-media, not S3, so the demo works without storage set up.

export const DEMO_MEDIA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../demo-media");
export const DEMO_MEDIA_ROUTE = "/demo-media";

// Ground and sky colours per capture step, so the kinds look different at a glance
const SCENES = {
  SITE: ["#5b7c4a", "#a9cbe8"],
  START: ["#7a5c3e", "#b7d3ea"],
  END: ["#6f4f35", "#c4d9ec"],
  ENTRY: ["#5f6368", "#a6c4e0"],
  INFRA: ["#7d838c", "#b9d2ea"],
  RESTORATION: ["#4f7a5a", "#bcd8ee"],
};

const PHOTO = { w: 960, h: 720 };
const VIDEO = { w: 640, h: 360, sec: 3 };

const sceneFilters = async (dir, W, H, kind, title, subtitle) => {
  const [ground, sky] = SCENES[kind] || SCENES.SITE;
  const files = [];
  const textFile = async (name, text) => {
    const f = path.join(dir, name);
    await writeFile(f, text, "utf8");
    files.push(f);
    return filterPath(f);
  };
  const big = Math.round(H * 0.075);
  const small = Math.round(H * 0.04);
  return [
    `drawbox=x=0:y=0:w=iw:h=ih*0.42:color=${sky}:t=fill`,
    // a road band across the ground
    `drawbox=x=0:y=ih*0.55:w=iw:h=ih*0.08:color=#3f4347@0.85:t=fill`,
    `drawtext=fontfile=${filterPath(FONT_BOLD)}:textfile=${await textFile("t1.txt", "DEMO")}:expansion=none:fontsize=${small}:fontcolor=white@0.9:x=(w-text_w)/2:y=h*0.12`,
    `drawtext=fontfile=${filterPath(FONT_BOLD)}:textfile=${await textFile("t2.txt", title)}:expansion=none:fontsize=${big}:fontcolor=white:shadowcolor=black@0.5:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h*0.2`,
    `drawtext=fontfile=${filterPath(FONT)}:textfile=${await textFile("t3.txt", subtitle || " ")}:expansion=none:fontsize=${small}:fontcolor=white:shadowcolor=black@0.5:shadowx=1:shadowy=1:x=(w-text_w)/2:y=h*0.2+${Math.round(big * 1.35)}`,
  ].join(",");
};

const sizeOf = async (file) => (await stat(file)).size;

/** One stamped demo photo; returns { file, sizeBytes } */
export const makeDemoPhoto = async ({ name, kind, title, subtitle, meta }) =>
  withTempDir(async (dir) => {
    const scene = await sceneFilters(dir, PHOTO.w, PHOTO.h, kind, title, subtitle);
    const stamp = await buildFilter(dir, PHOTO.w, PHOTO.h, meta);
    const out = path.join(DEMO_MEDIA_DIR, `${name}.jpg`);
    await runFfmpeg(["-hide_banner", "-y", "-f", "lavfi", "-i", `color=c=${(SCENES[kind] || SCENES.SITE)[0]}:s=${PHOTO.w}x${PHOTO.h}:d=1`, "-vf", `${scene},${stamp}`, "-frames:v", "1", "-q:v", "4", out], 60000);
    return { file: `${name}.jpg`, sizeBytes: await sizeOf(out) };
  });

/** One stamped demo video plus its poster frame; returns { file, poster, sizeBytes, durationSec } */
export const makeDemoVideo = async ({ name, kind, title, subtitle, meta }) =>
  withTempDir(async (dir) => {
    const scene = await sceneFilters(dir, VIDEO.w, VIDEO.h, kind, title, subtitle);
    const stamp = await buildFilter(dir, VIDEO.w, VIDEO.h, meta);
    const out = path.join(DEMO_MEDIA_DIR, `${name}.mp4`);
    const poster = path.join(DEMO_MEDIA_DIR, `${name}-poster.jpg`);
    await runFfmpeg(
      [
        "-hide_banner", "-y",
        "-f", "lavfi", "-i", `color=c=${(SCENES[kind] || SCENES.SITE)[0]}:s=${VIDEO.w}x${VIDEO.h}:d=${VIDEO.sec}:r=24`,
        "-f", "lavfi", "-i", `sine=frequency=330:duration=${VIDEO.sec}`,
        "-vf", `${scene},${stamp}`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart", out,
      ],
      120000
    );
    await runFfmpeg(["-hide_banner", "-y", "-ss", "1", "-i", out, "-frames:v", "1", "-q:v", "5", poster], 30000);
    return { file: `${name}.mp4`, poster: `${name}-poster.jpg`, sizeBytes: await sizeOf(out), durationSec: VIDEO.sec };
  });

export const resetDemoMediaDir = async () => {
  await rm(DEMO_MEDIA_DIR, { recursive: true, force: true });
  await mkdir(DEMO_MEDIA_DIR, { recursive: true });
};

export const writeDemoFile = async (name, content) => {
  const file = path.join(DEMO_MEDIA_DIR, name);
  await writeFile(file, content, "utf8");
  return sizeOf(file);
};

// Run async jobs a few at a time
export const runPool = async (jobs, size = 4) => {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
};
