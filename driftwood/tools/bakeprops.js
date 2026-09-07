#!/usr/bin/env node
// Bakes small glTF props (KayKit hexagon pack etc.) into flat-coloured triangle lists for the chunk renderer:
// vertex colours are sampled from the texture at each vertex UV, so no textures are needed at runtime.
// usage: node tools/bakeprops.js out.js name=path/to/file.gltf[,scaleY] ...
const fs = require('fs'), path = require('path'), zlib = require('zlib');
function decodePNG(buf) {
  let off = 8; const chunks = []; while (off < buf.length) { const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8); chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) }); off += 12 + len; }
  const ihdr = chunks.find(c => c.type === 'IHDR').data; const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), depth = ihdr[8], ctype = ihdr[9], interlace = ihdr[12];
  if (depth !== 8 || interlace) throw new Error('unsupported PNG (need 8-bit non-interlaced)');
  const plte = chunks.find(c => c.type === 'PLTE'); const idat = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype]; const stride = w * bpp; const out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) { const f = idat[p++]; const row = out.subarray(y * stride, (y + 1) * stride); const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? row[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0; let v = idat[p++];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255; } }
  return { w, h, get: (u, v) => { const x = Math.min(w - 1, Math.max(0, Math.floor(u * w))), y = Math.min(h - 1, Math.max(0, Math.floor(v * h))); const i = (y * w + x) * bpp;
    if (ctype === 3) { const k = out[i] * 3; return [plte.data[k] / 255, plte.data[k + 1] / 255, plte.data[k + 2] / 255]; }
    if (ctype === 0 || ctype === 4) return [out[i] / 255, out[i] / 255, out[i] / 255];
    return [out[i] / 255, out[i + 1] / 255, out[i + 2] / 255]; } };
}
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function mat(n) { const t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1]; const [x, y, z, w] = r; const m = [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; return m; }
function mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[i * 4 + j] += a[k * 4 + j] * b[i * 4 + k]; return o; }
function bake(file) {
  const dir = path.dirname(file); const json = JSON.parse(fs.readFileSync(file, 'utf8')); const bin = fs.readFileSync(path.join(dir, json.buffers[0].uri));
  const acc = (i) => { const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = COMP[a.componentType], n = NUM[a.type]; return { d: new T(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * n), n }; };
  const tex = json.images && json.images[0] ? decodePNG(fs.readFileSync(path.join(dir, json.images[0].uri))) : null;
  const out = []; const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const rec = (ni, pm) => { const n = json.nodes[ni]; const m = mul(pm, mat(n)); if (n.mesh !== undefined) for (const pr of json.meshes[n.mesh].primitives) { const P = acc(pr.attributes.POSITION).d, N = pr.attributes.NORMAL !== undefined ? acc(pr.attributes.NORMAL).d : null, UV = pr.attributes.TEXCOORD_0 !== undefined ? acc(pr.attributes.TEXCOORD_0).d : null, IX = pr.indices !== undefined ? acc(pr.indices).d : null; const mtl = json.materials && pr.material !== undefined ? json.materials[pr.material] : null; const base = mtl && mtl.pbrMetallicRoughness && mtl.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1]; const hasTex = mtl && mtl.pbrMetallicRoughness && mtl.pbrMetallicRoughness.baseColorTexture && tex;
      const cnt = IX ? IX.length : P.length / 3; for (let k = 0; k < cnt; k++) { const v = IX ? IX[k] : k; const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        let nx = 0, ny = 1, nz = 0; if (N) { const a = N[v * 3], b = N[v * 3 + 1], c = N[v * 3 + 2]; nx = m[0] * a + m[4] * b + m[8] * c; ny = m[1] * a + m[5] * b + m[9] * c; nz = m[2] * a + m[6] * b + m[10] * c; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
        let col = [base[0], base[1], base[2]]; if (hasTex && UV) { const c = tex.get(UV[v * 2], UV[v * 2 + 1]); col = [c[0] * base[0], c[1] * base[1], c[2] * base[2]]; }
        out.push(+wx.toFixed(3), +wy.toFixed(3), +wz.toFixed(3), +nx.toFixed(2), +ny.toFixed(2), +nz.toFixed(2), +col[0].toFixed(3), +col[1].toFixed(3), +col[2].toFixed(3)); } }
    for (const c of n.children || []) rec(c, m); };
  for (const r of json.scenes[json.scene || 0].nodes) rec(r, I);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < out.length; i += 9) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], out[i + k]); mx[k] = Math.max(mx[k], out[i + k]); }
  return { v: out, min: mn, max: mx, tris: out.length / 27 };
}
const [outFile, ...specs] = process.argv.slice(2); const props = {};
for (const sp of specs) { const [name, file] = sp.split('='); const b = bake(file); props[name] = b; console.log(name, 'tris', b.tris, 'bounds', b.min.map(v => v.toFixed(2)).join(','), '..', b.max.map(v => v.toFixed(2)).join(',')); }
fs.writeFileSync(outFile, '// Baked low-poly props (KayKit Medieval Hexagon Pack, CC0) — generated by tools/bakeprops.js. Vertex format: x y z nx ny nz r g b, 3 per triangle.\nwindow.G.PROPS = ' + JSON.stringify(props) + ';\n');
console.log('wrote', outFile, (fs.statSync(outFile).size / 1024).toFixed(0) + ' KB');
