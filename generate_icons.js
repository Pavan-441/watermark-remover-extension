const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateIcon(size) {
  const width = size;
  const height = size;
  const rawRows = [];

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = size * 0.46;

  for (let y = 0; y < height; y++) {
    const row = [0]; // filter byte = 0
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= rOuter) {
        const t = (x + y) / (width + height);
        let r = Math.round(99 * (1 - t) + 6 * t);
        let g = Math.round(102 * (1 - t) + 182 * t);
        let b = Math.round(241 * (1 - t) + 212 * t);
        let a = 255;

        // Draw 4-point sparkle star in the center
        const ndx = Math.abs(dx) / (size * 0.32);
        const ndy = Math.abs(dy) / (size * 0.32);
        const starShape = Math.sqrt(ndx) + Math.sqrt(ndy);

        if (starShape <= 1.0) {
          r = 255;
          g = 255;
          b = 255;
        } else if (starShape <= 1.35) {
          const glow = (1.35 - starShape) / 0.35;
          r = Math.min(255, Math.round(r + (255 - r) * glow * 0.7));
          g = Math.min(255, Math.round(g + (255 - g) * glow * 0.85));
          b = Math.min(255, Math.round(b + (255 - b) * glow * 0.95));
        }

        if (dist > rOuter - 1) {
          a = Math.max(0, Math.min(255, Math.round(255 * (rOuter - dist))));
        }

        row.push(r, g, b, a);
      } else {
        row.push(0, 0, 0, 0);
      }
    }
    rawRows.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(rawRows);
  const compressedData = zlib.deflateSync(rawData);

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, 'icons');
[16, 32, 48, 128].forEach(size => {
  const buf = generateIcon(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`Generated icon${size}.png (${buf.length} bytes)`);
});
