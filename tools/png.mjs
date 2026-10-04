// Minimal PNG writer (dev tool only) so sprites can be inspected as images without a browser.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Save a Pixmap upscaled by an integer factor on a solid background. */
export function savePixmap(file, pm, scale = 1, bg = null) {
  const W = pm.w * scale, H = pm.h * scale;
  const out = new Uint32Array(W * H);
  const bgc = bg === null ? 0 : bg;
  for (let y = 0; y < pm.h; y++) {
    for (let x = 0; x < pm.w; x++) {
      let c = pm.d[y * pm.w + x];
      if ((c >>> 24) === 0) c = bgc;
      else if ((c >>> 24) < 255 && bgc) {
        const a = (c >>> 24) / 255;
        const r = Math.round((c & 255) * a + (bgc & 255) * (1 - a));
        const g = Math.round(((c >>> 8) & 255) * a + ((bgc >>> 8) & 255) * (1 - a));
        const b = Math.round(((c >>> 16) & 255) * a + ((bgc >>> 16) & 255) * (1 - a));
        c = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      }
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) out[(y * scale + sy) * W + x * scale + sx] = c;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(W, H, new Uint8Array(out.buffer)));
}
