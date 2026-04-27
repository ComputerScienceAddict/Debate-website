/**
 * Remove outer black matte around the mark: flood-fill black from the perimeter of the
 * tight bounding box of dark pixels. Interior black (TV screen) is ringed by orange and
 * not reachable, so it stays opaque.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DARK = 40;

function isDark(r, g, b) {
  return r < DARK && g < DARK && b < DARK;
}

async function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const src = path.join(root, "public", "debate-room-welcome-logo.png");
  const tmp = path.join(root, "public", "debate-room-welcome-logo.tmp.png");

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const stride = 4;
  const buf = Buffer.from(data);

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

  if (bx0 > bx1) {
    console.error("No dark pixels found.");
    process.exit(1);
  }

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
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
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
    const i = k * stride;
    buf[i + 3] = 0;
  }

  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(tmp);

  fs.renameSync(tmp, src);
  console.log("Wrote", src, `dark bbox (${bx0},${by0})–(${bx1},${by1}), cleared ${seen.reduce((a, b) => a + b, 0)} px`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
