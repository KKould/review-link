// Minimal PNG reader for checks: size, color type, and the bounding box of non-transparent pixels.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export function readPng(path) {
  const data = readFileSync(path);
  if (data.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${path}: not a PNG`);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("latin1", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
    } else if (type === "IDAT") {
      idat.push(body);
    }
    offset += 12 + length;
  }
  return { width, height, bitDepth, colorType, alphaBox: colorType === 6 && bitDepth === 8 ? alphaBox() : null };

  function alphaBox() {
    const raw = inflateSync(Buffer.concat(idat));
    const bpp = 4;
    const stride = width * bpp;
    let prev = Buffer.alloc(stride);
    let box = null;
    for (let y = 0, o = 0; y < height; y += 1) {
      const filter = raw[o];
      o += 1;
      const line = Buffer.from(raw.subarray(o, o + stride));
      o += stride;
      for (let x = 0; x < stride; x += 1) {
        const a = x >= bpp ? line[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        if (filter === 1) line[x] = (line[x] + a) & 255;
        else if (filter === 2) line[x] = (line[x] + b) & 255;
        else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
        }
      }
      for (let x = 0; x < width; x += 1) {
        if (line[x * bpp + 3] > 0) {
          box = box
            ? { left: Math.min(box.left, x), top: box.top, right: Math.max(box.right, x), bottom: y }
            : { left: x, top: y, right: x, bottom: y };
        }
      }
      prev = line;
    }
    return box;
  }
}
