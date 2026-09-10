/* eslint-disable no-bitwise */
/**
 * Generates the app's PNG assets with zero dependencies (pure Node + zlib):
 *
 *   assets/icon.png            1024x1024  emerald square, gold crescent + star
 *   assets/adaptive-icon.png   1024x1024  transparent, gold crescent + star (Android)
 *   assets/splash.png          1284x1284  emerald, centered crescent + star
 *   assets/favicon.png         48x48      emerald, crescent
 *
 * Run:  node scripts/generate-assets.js   (or  npm run assets)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const EMERALD = [14, 124, 97, 255];
const GOLD = [216, 182, 94, 255];
const TRANSPARENT = [0, 0, 0, 0];

/* ---------- PNG encoding ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None) for each scanline
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- tiny raster helpers ---------- */

function makeCanvas(w, h, [r, g, b, a]) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = a;
  }
  return buf;
}

function blendPixel(buf, w, h, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  const src = a / 255;
  const dst = 1 - src;
  buf[i] = Math.round(r * src + buf[i] * dst);
  buf[i + 1] = Math.round(g * src + buf[i + 1] * dst);
  buf[i + 2] = Math.round(b * src + buf[i + 2] * dst);
  buf[i + 3] = Math.max(buf[i + 3], Math.round(a));
}

function fillCircle(buf, w, h, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y += 1) {
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x += 1) {
      const edge = radius - Math.hypot(x - cx, y - cy);
      if (edge > 0) {
        const aa = Math.min(1, edge);
        blendPixel(buf, w, h, x, y, [color[0], color[1], color[2], color[3] * aa]);
      }
    }
  }
}

/** Crescent = large disc minus an offset disc; works on any background. */
function drawCrescent(buf, w, h, cx, cy, radius, color) {
  const ox = cx + radius * 0.42;
  const oy = cy - radius * 0.06;
  const oradius = radius * 0.96;
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y += 1) {
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x += 1) {
      const inMain = radius - Math.hypot(x - cx, y - cy);
      const outCut = Math.hypot(x - ox, y - oy) - oradius;
      if (inMain > 0 && outCut > 0) {
        const aa = Math.min(1, inMain) * Math.min(1, outCut);
        blendPixel(buf, w, h, x, y, [color[0], color[1], color[2], color[3] * aa]);
      }
    }
  }
}

function drawMark(w, h, options) {
  const { background, scale } = options;
  const canvas = makeCanvas(w, h, background);
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * scale;

  drawCrescent(canvas, w, h, cx - radius * 0.12, cy, radius, GOLD);
  if (options.star !== false) {
    fillCircle(canvas, w, h, cx + radius * 0.78, cy - radius * 0.62, radius * 0.16, GOLD);
  }
  return canvas;
}

/* ---------- build ---------- */

function write(name, width, height, canvas) {
  const file = path.join(ASSETS_DIR, name);
  fs.writeFileSync(file, encodePNG(width, height, canvas));
  console.log(`  wrote assets/${name}  (${width}x${height})`);
}

function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  console.log('Generating Yalla Salah assets...');
  write('icon.png', 1024, 1024, drawMark(1024, 1024, { background: EMERALD, scale: 0.3 }));
  write(
    'adaptive-icon.png',
    1024,
    1024,
    drawMark(1024, 1024, { background: TRANSPARENT, scale: 0.24 }),
  );
  write('splash.png', 1284, 1284, drawMark(1284, 1284, { background: EMERALD, scale: 0.18 }));
  write('favicon.png', 48, 48, drawMark(48, 48, { background: EMERALD, scale: 0.34, star: false }));
  console.log('Done.');
}

main();
