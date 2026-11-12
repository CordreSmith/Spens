// Draws the app icon (a white shopping bag with a tick on green) and writes the PNGs
// that the web app manifest needs. No image libraries: shapes are signed distance
// functions, and the PNG is encoded with node:zlib. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = [31, 122, 77];
const WHITE = [255, 255, 255];
const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

writeIcon('icon-192.png', 192, { maskable: false });
writeIcon('icon-512.png', 512, { maskable: false });
writeIcon('icon-maskable-512.png', 512, { maskable: true });

function writeIcon(fileName, size, { maskable }) {
  // Maskable icons get a full-bleed background and keep the art inside the 80% safe zone.
  const artScale = maskable ? 0.78 : 0.92;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const bg = maskable ? 1 : coverage(roundedBox(u - 0.5, v - 0.5, 0.5, 0.5, 0.2), size);
      // Art coordinates, scaled around the centre.
      const ax = (u - 0.5) / artScale + 0.5;
      const ay = (v - 0.5) / artScale + 0.5;
      const bag = Math.min(
        roundedBox(ax - 0.5, ay - 0.6, 0.27, 0.22, 0.06),
        Math.max(Math.abs(Math.hypot(ax - 0.5, ay - 0.38) - 0.12) - 0.035, ay - 0.42),
      );
      const tick = Math.min(segment(ax, ay, 0.39, 0.6, 0.47, 0.68), segment(ax, ay, 0.47, 0.68, 0.62, 0.52)) - 0.032;
      const white = coverage(bag, size) * (1 - coverage(tick, size));
      const color = GREEN.map((g, i) => Math.round(g + (WHITE[i] - g) * white));
      const o = (y * size + x) * 4;
      pixels[o] = color[0];
      pixels[o + 1] = color[1];
      pixels[o + 2] = color[2];
      pixels[o + 3] = Math.round(255 * bg);
    }
  }
  writeFileSync(new URL(fileName, outDir), encodePng(size, size, pixels));
  console.log(`wrote public/icons/${fileName}`);

  function coverage(distance, px) {
    return Math.min(1, Math.max(0, 0.5 - distance * px));
  }
  function roundedBox(px, py, hx, hy, r) {
    const qx = Math.abs(px) - hx + r;
    const qy = Math.abs(py) - hy + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function segment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  }
  function crc32(buffer) {
    let c = ~0;
    for (const byte of buffer) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
}
