// Generates icon.png (256px), icon.ico (PNG-in-ICO) and icon.icns (PNG-in-ICNS) with no image libraries: a robot castaway on a raft.
const fs = require('fs'), zlib = require('zlib');
const S = 256; const px = new Uint8Array(S * S * 4);
const set = (x, y, r, g, b, a = 255) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, ...c); };
const disc = (cx, cy, r, c) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, ...c); };
const rrect = (x0, y0, w, h, rad, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const dx = Math.max(x0 + rad - x, 0, x - (x0 + w - 1 - rad)), dy = Math.max(y0 + rad - y, 0, y - (y0 + h - 1 - rad)); if (dx * dx + dy * dy <= rad * rad) set(x, y, ...c); } };
// sky gradient + sea
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const t = y / S; if (y < 150) set(x, y, Math.round(20 + 60 * t), Math.round(40 + 120 * t), Math.round(90 + 140 * t)); else set(x, y, 30, 90 + ((x + y) % 17 < 3 ? 40 : 0), 170 + ((x * 3 + y) % 23 < 2 ? 40 : 0)); }
rrect(0, 0, S, S, 48, [0, 0, 0, 0]); // will re-fill below; keep corners transparent via mask later
// rebuild with rounded mask
const mask = new Uint8Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const rad = 48; const dx = Math.max(rad - x, 0, x - (S - 1 - rad)), dy = Math.max(rad - y, 0, y - (S - 1 - rad)); mask[y * S + x] = dx * dx + dy * dy <= rad * rad ? 1 : 0; }
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const t = y / S; if (y < 150) set(x, y, Math.round(20 + 60 * t), Math.round(40 + 120 * t), Math.round(90 + 140 * t)); else set(x, y, 30, 90 + ((x + y) % 17 < 3 ? 40 : 0), 170 + ((x * 3 + y) % 23 < 2 ? 40 : 0)); }
disc(200, 52, 26, [255, 225, 120]); // sun
rect(40, 150, 176, 22, [122, 74, 32]); for (let i = 0; i < 6; i++) rect(44 + i * 29, 150, 4, 22, [90, 52, 20]); // raft
rect(124, 70, 8, 82, [90, 58, 30]); // mast
for (let y = 0; y < 60; y++) rect(132, 74 + y, Math.round(64 * (1 - y / 60)), 1, [235, 228, 210]); // sail
// robot: body + head + eyes (player-blue tint)
rrect(70, 108, 40, 44, 10, [70, 140, 240]); rrect(62, 82, 56, 34, 14, [70, 140, 240]); rect(62, 96, 56, 6, [40, 40, 48]);
disc(80, 96, 9, [20, 20, 26]); disc(100, 96, 9, [20, 20, 26]); disc(82, 94, 3, [255, 255, 255]); disc(102, 94, 3, [255, 255, 255]);
rrect(58, 112, 12, 30, 5, [60, 120, 210]); rrect(110, 112, 12, 30, 5, [60, 120, 210]);
rect(112, 100, 6, 46, [200, 200, 210]); rect(104, 96, 22, 8, [230, 230, 235]); // sword
for (let i = 0; i < S * S; i++) if (!mask[i]) px[i * 4 + 3] = 0;
// PNG encode
const crcT = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c; }
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((S * 4 + 1) * S); for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync('icon.png', png);
// ICO with one PNG entry
const ico = Buffer.alloc(6 + 16); ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = 0; ico[7] = 0; ico[8] = 0; ico[9] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync('icon.ico', Buffer.concat([ico, png]));
// ICNS with ic08 (256x256 PNG)
const ent = Buffer.alloc(8); ent.write('ic08', 0); ent.writeUInt32BE(8 + png.length, 4); const hdr = Buffer.alloc(8); hdr.write('icns', 0); hdr.writeUInt32BE(16 + png.length, 4);
fs.writeFileSync('icon.icns', Buffer.concat([hdr, ent, png]));
console.log('icons written', png.length, 'bytes png');
