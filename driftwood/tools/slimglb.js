#!/usr/bin/env node
// Slim a GLB: keep only the listed animations, drop named mesh nodes (e.g. a pack's built-in weapons), and rebuild the binary
// buffer with only the accessors that are still referenced. Usage:
//   node tools/slimglb.js in.glb out.glb --anims Idle,Walking_A --drop 1H_Sword,2H_Sword
const fs = require('fs');
const [inF, outF, ...rest] = process.argv.slice(2); const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const keepAnims = opt.anims ? new Set(opt.anims.split(',')) : null; const drop = new Set((opt.drop || '').split(',').filter(Boolean));
const buf = fs.readFileSync(inF); const len = buf.readUInt32LE(8); let off = 12, json = null, bin = null;
while (off < len) { const cl = buf.readUInt32LE(off), ct = buf.readUInt32LE(off + 4); const chunk = buf.subarray(off + 8, off + 8 + cl); if (ct === 0x4E4F534A) json = JSON.parse(chunk.toString()); else if (ct === 0x004E4942) bin = chunk; off += 8 + cl; }
// 1. drop mesh nodes by name: detach their mesh (node stays so hierarchy/animation indices are untouched)
let dropped = 0; for (const n of json.nodes) if (drop.has(n.name) && n.mesh !== undefined) { delete n.mesh; delete n.skin; dropped++; }
const usedMeshes = new Set(json.nodes.map(n => n.mesh).filter(m => m !== undefined));
json.meshes = json.meshes.map((m, i) => usedMeshes.has(i) ? m : null); // keep indices stable, null out unused
// 2. filter animations; drop channels that target nodes no skin uses and no mesh hangs from; resample dense keyframes to --fps
if (keepAnims) json.animations = (json.animations || []).filter(a => keepAnims.has(a.name));
const jointSet = new Set(); for (const s of json.skins || []) for (const j of s.joints) jointSet.add(j);
const parentOf = new Map(); json.nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));
const needed = new Set(jointSet); json.nodes.forEach((n, i) => { if (n.mesh !== undefined) { let k = i; while (k !== undefined) { needed.add(k); k = parentOf.get(k); } } });
for (const j of [...jointSet]) { let k = parentOf.get(j); while (k !== undefined) { needed.add(k); k = parentOf.get(k); } }
const fps = opt.fps ? +opt.fps : 0; const COMPn = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, NUMn = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const readAcc = (ai) => { const a = json.accessors[ai]; const bv = json.bufferViews[a.bufferView]; const n = NUMn[a.type]; const start = (bv.byteOffset || 0) + (a.byteOffset || 0); const out = new Float32Array(a.count * n); const stride = bv.byteStride || COMPn[a.componentType] * n; for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const p = start + k * stride + c * COMPn[a.componentType]; out[k * n + c] = a.componentType === 5126 ? bin.readFloatLE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) / (a.normalized ? 65535 : 1) : a.componentType === 5121 ? bin.readUInt8(p) / (a.normalized ? 255 : 1) : a.componentType === 5122 ? bin.readInt16LE(p) / (a.normalized ? 32767 : 1) : bin.readInt8(p) / (a.normalized ? 127 : 1); } return { data: out, n, count: a.count }; };
const extraAcc = []; // synthesized accessors appended to the binary later
const addAcc = (data, n, type) => { const idx = json.accessors.length; let min, max; if (type === 'SCALAR') { min = [data[0]]; max = [data[data.length - 1]]; } json.accessors.push({ __data: data, componentType: 5126, count: data.length / n, type, min, max }); return idx; };
const near = (a, b) => Math.abs(a - b) < 1e-4;
for (const a of json.animations || []) {
  a.channels = a.channels.filter(ch => needed.has(ch.target.node) || ch.target.path === 'weights');
  // drop channels that never move away from the node's rest pose (most bones never translate or scale); collapse constant channels to one key
  a.channels = a.channels.filter(ch => { const sm = a.samplers[ch.sampler]; const out = readAcc(sm.output); const n = out.n; if (ch.target.path === 'weights') return true;
    let constant = true; for (let k = 1; k < out.count && constant; k++) for (let c = 0; c < n; c++) if (!near(out.data[c], out.data[k * n + c])) { constant = false; break; }
    if (!constant) return true;
    const node = json.nodes[ch.target.node]; const rest = ch.target.path === 'translation' ? (node.translation || [0, 0, 0]) : ch.target.path === 'scale' ? (node.scale || [1, 1, 1]) : (node.rotation || [0, 0, 0, 1]);
    let atRest = true; for (let c = 0; c < n; c++) if (!near(out.data[c], rest[c])) atRest = false; if (ch.target.path === 'rotation' && !atRest) { atRest = true; for (let c = 0; c < 4; c++) if (!near(-out.data[c], rest[c])) atRest = false; }
    if (atRest) return false;
    sm.input = addAcc(new Float32Array([readAcc(sm.input).data[0]]), 1, 'SCALAR'); sm.output = addAcc(out.data.slice(0, n), n, n === 4 ? 'VEC4' : n === 3 ? 'VEC3' : 'SCALAR'); return true; });
  const usedS = new Set(a.channels.map(ch => ch.sampler)); const smap = new Map(); a.samplers = a.samplers.filter((sm, i) => { if (usedS.has(i)) { smap.set(i, smap.size); return true; } return false; }); a.channels.forEach(ch => ch.sampler = smap.get(ch.sampler));
}
if (fps > 0) for (const a of json.animations || []) {
  const used = new Set(a.channels.map(ch => ch.sampler));
  a.samplers.forEach((sm, si) => { if (!used.has(si)) return; if (json.accessors[sm.input].__data) return; const inp = readAcc(sm.input), out = readAcc(sm.output); const n = out.n; if (sm.interpolation === 'CUBICSPLINE' || inp.count < 3) return;
    const t0 = inp.data[0], t1 = inp.data[inp.count - 1]; const steps = Math.max(1, Math.round((t1 - t0) * fps)); if (steps + 1 >= inp.count) return;
    const T = new Float32Array(steps + 1), V = new Float32Array((steps + 1) * n);
    for (let k = 0; k <= steps; k++) { const t = t0 + (t1 - t0) * k / steps; T[k] = t; let i = 0; while (i < inp.count - 2 && inp.data[i + 1] < t) i++; const f = Math.max(0, Math.min(1, (t - inp.data[i]) / Math.max(1e-6, inp.data[i + 1] - inp.data[i])));
      if (n === 4 && sm.interpolation !== 'STEP') { let ax = out.data[i * 4], ay = out.data[i * 4 + 1], az = out.data[i * 4 + 2], aw = out.data[i * 4 + 3], bx = out.data[(i + 1) * 4], by = out.data[(i + 1) * 4 + 1], bz = out.data[(i + 1) * 4 + 2], bw = out.data[(i + 1) * 4 + 3]; let cos = ax * bx + ay * by + az * bz + aw * bw; if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; } let s0, s1; if (1 - cos > 1e-4) { const om = Math.acos(cos), so = Math.sin(om); s0 = Math.sin((1 - f) * om) / so; s1 = Math.sin(f * om) / so; } else { s0 = 1 - f; s1 = f; } V[k * 4] = s0 * ax + s1 * bx; V[k * 4 + 1] = s0 * ay + s1 * by; V[k * 4 + 2] = s0 * az + s1 * bz; V[k * 4 + 3] = s0 * aw + s1 * bw; }
      else for (let c = 0; c < n; c++) V[k * n + c] = sm.interpolation === 'STEP' ? out.data[i * n + c] : out.data[i * n + c] + (out.data[(i + 1) * n + c] - out.data[i * n + c]) * f; }
    sm.input = addAcc(T, 1, 'SCALAR'); sm.output = addAcc(V, n, n === 4 ? 'VEC4' : n === 3 ? 'VEC3' : 'SCALAR'); sm.interpolation = 'LINEAR'; });
}
// 3. collect referenced accessors
const accs = new Set();
for (const m of json.meshes) if (m) for (const p of m.primitives) { for (const k in p.attributes) accs.add(p.attributes[k]); if (p.indices !== undefined) accs.add(p.indices); if (p.targets) for (const t of p.targets) for (const k in t) accs.add(t[k]); }
for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) accs.add(s.inverseBindMatrices);
for (const a of json.animations || []) for (const s of a.samplers) { accs.add(s.input); accs.add(s.output); }
// 4. rebuild buffer views: one view per kept accessor (simple, slightly larger than shared views but always valid)
const parts = []; let total = 0; const newAccs = []; const accMap = new Map();
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const newViews = [];
for (const ai of [...accs].sort((a, b) => a - b)) {
  const a = json.accessors[ai]; let data;
  if (a.__data) { data = Buffer.from(a.__data.buffer, a.__data.byteOffset, a.__data.byteLength); delete a.__data; } else { const bv = json.bufferViews[a.bufferView]; const esz = COMP[a.componentType] * NUM[a.type]; const stride = bv.byteStride || esz; const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  if (stride === esz) data = bin.subarray(start, start + a.count * esz); else { data = Buffer.alloc(a.count * esz); for (let k = 0; k < a.count; k++) bin.copy(data, k * esz, start + k * stride, start + k * stride + esz); } }
  while (total % 4) { parts.push(Buffer.alloc(1)); total++; }
  const view = { buffer: 0, byteOffset: total, byteLength: data.length }; const bv0 = a.bufferView !== undefined ? json.bufferViews[a.bufferView] : null; if (bv0 && bv0.target) view.target = bv0.target; newViews.push(view); parts.push(data); total += data.length;
  const na = Object.assign({}, a, { bufferView: newViews.length - 1 }); delete na.byteOffset; accMap.set(ai, newAccs.length); newAccs.push(na);
}
// images that live in buffer views
for (const im of json.images || []) if (im.bufferView !== undefined) { const bv = json.bufferViews[im.bufferView]; const data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); while (total % 4) { parts.push(Buffer.alloc(1)); total++; } newViews.push({ buffer: 0, byteOffset: total, byteLength: data.length }); parts.push(data); total += data.length; im.bufferView = newViews.length - 1; }
const remap = (i) => accMap.get(i);
for (const m of json.meshes) if (m) for (const p of m.primitives) { for (const k in p.attributes) p.attributes[k] = remap(p.attributes[k]); if (p.indices !== undefined) p.indices = remap(p.indices); if (p.targets) for (const t of p.targets) for (const k in t) t[k] = remap(t[k]); }
for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = remap(s.inverseBindMatrices);
for (const a of json.animations || []) for (const s of a.samplers) { s.input = remap(s.input); s.output = remap(s.output); }
// meshes: replace nulls with a tiny placeholder-free compaction (renumber node.mesh)
const meshIdx = new Map(); const compactMeshes = []; json.meshes.forEach((m, i) => { if (m) { meshIdx.set(i, compactMeshes.length); compactMeshes.push(m); } }); json.meshes = compactMeshes; for (const n of json.nodes) if (n.mesh !== undefined) n.mesh = meshIdx.get(n.mesh);
json.accessors = newAccs; json.bufferViews = newViews; json.buffers = [{ byteLength: total }];
while (total % 4) { parts.push(Buffer.alloc(1)); total++; }
const binOut = Buffer.concat(parts); let js = Buffer.from(JSON.stringify(json)); while (js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
const out = Buffer.alloc(12 + 8 + js.length + 8 + binOut.length); out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(js.length, 12); out.writeUInt32LE(0x4E4F534A, 16); js.copy(out, 20); out.writeUInt32LE(binOut.length, 20 + js.length); out.writeUInt32LE(0x004E4942, 24 + js.length); binOut.copy(out, 28 + js.length);
fs.writeFileSync(outF, out);
console.log(outF, (buf.length / 1024).toFixed(0) + 'KB ->', (out.length / 1024).toFixed(0) + 'KB', 'anims', (json.animations || []).length, 'dropped meshes', dropped);
