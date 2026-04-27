/**
 * Builds public/debate-room-welcome-mark.png from public/welcome-source-full.* (PNG or JPEG).
 * Tight-crops to visible mark, knocks out edge-connected black matte, exports a larger PNG for
 * sharp browser downscaling.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const DARK = 40;
const LUM_SUM = 80;

function isDark(r, g, b) {
  return r < DARK && g < DARK && b < DARK;
}

function knockoutDarkMatte(buf, w, h) {
  const stride = 4;
  let bx0 = w;
  let by0 = h;
  let bx1 = 0;
  let by1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * stride;
      if (!isDark(buf[i], buf[i + 1], buf[i + 2])) continue;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  if (bx0 > bx1) return buf;

  const seen = new Uint8Array(w * h);
  const q = [];

  function trySeed(x, y) {
    if (x < bx0 || x > bx1 || y < by0 || y > by1) return;
    const k = y * w + x;
    if (seen[k]) return;
    const i = k * stride;
    if (!isDark(buf[i], buf[i + 1], buf[i + 2])) return;
    seen[k] = 1;
    q.push(k);
  }

  for (let x = bx0; x <= bx1; x++) {
    trySeed(x, by0);
    trySeed(x, by1);
  }
  for (let y = by0; y <= by1; y++) {
    trySeed(bx0, y);
    trySeed(bx1, y);
  }

  while (q.length) {
    const k = q.pop();
    const x = k % w;
    const y = (k / w) | 0;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < bx0 || nx > bx1 || ny < by0 || ny > by1) continue;
      const nk = ny * w + nx;
      if (seen[nk]) continue;
      const ni = nk * stride;
      if (!isDark(buf[ni], buf[ni + 1], buf[ni + 2])) continue;
      seen[nk] = 1;
      q.push(nk);
    }
  }

  for (let k = 0; k < w * h; k++) {
    if (!seen[k]) continue;
    buf[k * stride + 3] = 0;
  }
  return buf;
}

/** TV screen fill, knobs, and any leftover matte — true black / near-black → transparent. */
function removeNearBlackTransparent(buf, w, h) {
  const stride = 4;
  const cap = 38;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * stride;
      const r = buf[i];
      const g = buf[i + 1];
      const b = buf[i + 2];
      if (r >= cap || g >= cap || b >= cap) continue;
      buf[i + 3] = 0;
    }
  }
  return buf;
}

function findSourcePath() {
  const pub = path.join(root, "public");
  for (const name of ["welcome-source-full.jpg", "welcome-source-full.jpeg", "welcome-source-full.png"]) {
    const p = path.join(pub, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Add public/welcome-source-full.jpg or .png (your full logo export).");
}

function contentBBox(data, w, h, stride) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * stride;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r + g + b <= LUM_SUM) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (minX > maxX) throw new Error("No bright pixels found in source.");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  const src = findSourcePath();
  const out = path.join(root, "public", "debate-room-welcome-mark.png");

  const meta = await sharp(src).metadata();
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w0 = info.width;
  const h0 = info.height;
  const stride = 4;
  const { left, top, width: cw, height: ch } = contentBBox(data, w0, h0, stride);

  const { data: crop, info: cinfo } = await sharp(src)
    .ensureAlpha()
    .extract({ left, top, width: cw, height: ch })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let w = cinfo.width;
  let h = cinfo.height;
  let buf = Buffer.from(crop);
  buf = knockoutDarkMatte(buf, w, h);
  buf = removeNearBlackTransparent(buf, w, h);

  const TARGET = 880;
  const scale = TARGET / Math.max(w, h);
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);

  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .resize(tw, th, { kernel: sharp.kernel.lanczos3, fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);

  const om = await sharp(out).metadata();
  console.log("Source", path.basename(src), `${meta.width}×${meta.height}`);
  console.log("Crop", left, top, cw, ch);
  console.log("Wrote", out, `${om.width}×${om.height}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
