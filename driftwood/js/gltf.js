// DRIFTWOOD — minimal glTF 2.0 (GLB) loader with node animation, crossfading and CPU skinning.
// Enough for rigged low-poly characters: TRS node hierarchies, LINEAR/STEP keyframes, skins, base-colour materials, one texture.
(function (G) {
  'use strict';
  const GL = {}; G.GLTF = GL;
  const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

  GL.parse = function (buf) {
    const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
    const len = dv.getUint32(8, true); let off = 12; let json = null, bin = null;
    while (off < len) { const cl = dv.getUint32(off, true), ct = dv.getUint32(off + 4, true); const chunk = buf.slice(off + 8, off + 8 + cl); if (ct === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk)); else if (ct === 0x004E4942) bin = chunk; off += 8 + cl; }
    const acc = (i) => { const a = json.accessors[i]; const bv = json.bufferViews[a.bufferView]; const T = COMP[a.componentType]; const n = NUM[a.type]; const stride = bv.byteStride || 0; const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
      if (!stride || stride === n * T.BYTES_PER_ELEMENT) return { data: new T(bin, start, a.count * n), n, count: a.count, norm: !!a.normalized };
      const out = new T(a.count * n); const src = new DataView(bin); for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const p = start + k * stride + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? src.getFloat32(p, true) : T === Uint16Array ? src.getUint16(p, true) : T === Uint8Array ? src.getUint8(p) : T === Uint32Array ? src.getUint32(p, true) : T === Int16Array ? src.getInt16(p, true) : src.getInt8(p); }
      return { data: out, n, count: a.count, norm: !!a.normalized }; };
    const model = { json, nodes: [], meshes: [], skins: [], anims: {}, materials: [], textures: [], roots: (json.scenes && json.scenes[json.scene || 0].nodes) || [0] };
    model.materials = (json.materials || []).map(m => ({ name: m.name || '', color: (m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor) || [1, 1, 1, 1], tex: m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture ? m.pbrMetallicRoughness.baseColorTexture.index : -1 }));
    model.images = (json.images || []).map(im => { if (im.bufferView === undefined) return null; const bv = json.bufferViews[im.bufferView]; const bytes = new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength); let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return 'data:' + (im.mimeType || 'image/png') + ';base64,' + btoa(s); });
    model.textures = (json.textures || []).map(t => ({ image: model.images[t.source] || null, gl: null }));
    model.meshes = (json.meshes || []).map(m => ({ name: m.name, prims: m.primitives.map(p => {
      const pos = acc(p.attributes.POSITION), nrm = p.attributes.NORMAL !== undefined ? acc(p.attributes.NORMAL) : null, uv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null;
      const jn = p.attributes.JOINTS_0 !== undefined ? acc(p.attributes.JOINTS_0) : null, wt = p.attributes.WEIGHTS_0 !== undefined ? acc(p.attributes.WEIGHTS_0) : null;
      const idx = p.indices !== undefined ? acc(p.indices) : null;
      let weights = wt ? (wt.norm ? Float32Array.from(wt.data, v => v / (wt.data instanceof Uint8Array ? 255 : 65535)) : Float32Array.from(wt.data)) : null;
      if (weights) for (let v = 0; v < pos.count; v++) { const s = weights[v * 4] + weights[v * 4 + 1] + weights[v * 4 + 2] + weights[v * 4 + 3]; if (s > 1e-6 && Math.abs(s - 1) > 1e-4) for (let k = 0; k < 4; k++) weights[v * 4 + k] /= s; } // some exporters leave weights unnormalised, which scales the joint translation
      let nrmData = nrm ? nrm.data : null;
      if (!nrmData) { nrmData = new Float32Array(pos.count * 3); const P = pos.data; const ix = idx ? idx.data : null; const tri = ix ? ix.length / 3 : pos.count / 3;
        for (let t = 0; t < tri; t++) { const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2; const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const v of [a, b, c]) { nrmData[v * 3] += nx; nrmData[v * 3 + 1] += ny; nrmData[v * 3 + 2] += nz; } }
        for (let v = 0; v < pos.count; v++) { const l = Math.hypot(nrmData[v * 3], nrmData[v * 3 + 1], nrmData[v * 3 + 2]) || 1; nrmData[v * 3] /= l; nrmData[v * 3 + 1] /= l; nrmData[v * 3 + 2] /= l; } }
      return { pos: pos.data, nrm: nrmData, uv: uv ? uv.data : null, joints: jn ? jn.data : null, weights, idx: idx ? idx.data : null, count: pos.count, mat: p.material !== undefined ? p.material : -1 }; }) }));
    model.nodes = (json.nodes || []).map((n, i) => ({ i, name: n.name || ('node' + i), children: n.children || [], parent: -1, mesh: n.mesh !== undefined ? n.mesh : -1, skin: n.skin !== undefined ? n.skin : -1, t: n.translation ? n.translation.slice() : [0, 0, 0], r: n.rotation ? n.rotation.slice() : [0, 0, 0, 1], s: n.scale ? n.scale.slice() : [1, 1, 1], matrix: n.matrix ? Float32Array.from(n.matrix) : null, world: new Float32Array(16) }));
    model.nodes.forEach(n => n.children.forEach(c => model.nodes[c].parent = n.i));
    model.skins = (json.skins || []).map(s => ({ joints: s.joints, ibm: acc(s.inverseBindMatrices).data }));
    for (const a of (json.animations || [])) {
      const clip = { name: a.name, dur: 0, ch: [] };
      for (const c of a.channels) { const sm = a.samplers[c.sampler]; const inp = acc(sm.input).data, out = acc(sm.output).data; const path = c.target.path; if (path === 'weights') continue; const n = path === 'rotation' ? 4 : 3; const cubic = sm.interpolation === 'CUBICSPLINE'; clip.ch.push({ node: c.target.node, path, times: inp, vals: out, n, step: sm.interpolation === 'STEP', cubic }); clip.dur = Math.max(clip.dur, inp[inp.length - 1]); }
      model.anims[a.name] = clip;
    }
    model.byName = {}; model.nodes.forEach(n => { if (!(n.name in model.byName)) model.byName[n.name] = n.i; });
    return model;
  };

  // ---- math ----
  function quatSlerp(a, b, t, o) { let ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3]; let cos = ax * bx + ay * by + az * bz + aw * bw; if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; } let s0, s1; if (1 - cos > 1e-4) { const om = Math.acos(cos), so = Math.sin(om); s0 = Math.sin((1 - t) * om) / so; s1 = Math.sin(t * om) / so; } else { s0 = 1 - t; s1 = t; } o[0] = s0 * ax + s1 * bx; o[1] = s0 * ay + s1 * by; o[2] = s0 * az + s1 * bz; o[3] = s0 * aw + s1 * bw; }
  function trsToMat(t, r, s, m) { const x = r[0], y = r[1], z = r[2], w = r[3]; const x2 = x + x, y2 = y + y, z2 = z + z; const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    m[0] = (1 - (yy + zz)) * s[0]; m[1] = (xy + wz) * s[0]; m[2] = (xz - wy) * s[0]; m[3] = 0; m[4] = (xy - wz) * s[1]; m[5] = (1 - (xx + zz)) * s[1]; m[6] = (yz + wx) * s[1]; m[7] = 0; m[8] = (xz + wy) * s[2]; m[9] = (yz - wx) * s[2]; m[10] = (1 - (xx + yy)) * s[2]; m[11] = 0; m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1; return m; }
  function mul(o, a, b) { const r = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } o.set(r); return o; }
  GL.mul = mul;

  // ---- animation: sample a clip into a pose (per-node TRS) ----
  function sample(ch, t, out) {
    const T = ch.times, n = T.length; let i = 0;
    if (t <= T[0]) i = 0; else if (t >= T[n - 1]) i = n - 1; else { let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; } i = lo; }
    const st = ch.cubic ? 3 : 1, c = ch.n; const a = (i * st + (ch.cubic ? 1 : 0)) * c;
    if (i >= n - 1 || ch.step) { for (let k = 0; k < c; k++) out[k] = ch.vals[a + k]; return; }
    const b = ((i + 1) * st + (ch.cubic ? 1 : 0)) * c; const f = (t - T[i]) / Math.max(1e-6, T[i + 1] - T[i]);
    if (ch.path === 'rotation') { quatSlerp(ch.vals.subarray(a, a + 4), ch.vals.subarray(b, b + 4), f, out); }
    else for (let k = 0; k < c; k++) out[k] = ch.vals[a + k] + (ch.vals[b + k] - ch.vals[a + k]) * f;
  }
  // pose: { t: Float32Array(n*3), r: Float32Array(n*4), s: Float32Array(n*3) } initialised from rest
  GL.restPose = function (model) { const n = model.nodes.length; const p = { t: new Float32Array(n * 3), r: new Float32Array(n * 4), s: new Float32Array(n * 3) }; model.nodes.forEach((nd, i) => { p.t.set(nd.t, i * 3); p.r.set(nd.r, i * 4); p.s.set(nd.s, i * 3); }); return p; };
  GL.applyClip = function (model, pose, clipName, time, weight) { // weight 1 = overwrite, <1 = blend toward clip
    const clip = model.anims[clipName]; if (!clip) return; const t = clip.dur > 0 ? time % clip.dur : 0; const tmp = new Float32Array(4);
    for (const ch of clip.ch) { sample(ch, t, tmp); const i = ch.node;
      if (ch.path === 'translation') { for (let k = 0; k < 3; k++) pose.t[i * 3 + k] += (tmp[k] - pose.t[i * 3 + k]) * weight; }
      else if (ch.path === 'scale') { for (let k = 0; k < 3; k++) pose.s[i * 3 + k] += (tmp[k] - pose.s[i * 3 + k]) * weight; }
      else { if (weight >= 1) pose.r.set(tmp, i * 4); else { const cur = pose.r.subarray(i * 4, i * 4 + 4); const o = new Float32Array(4); quatSlerp(cur, tmp, weight, o); pose.r.set(o, i * 4); } } }
  };
  GL.applyClipClamped = function (model, pose, clipName, time, weight) { const clip = model.anims[clipName]; if (!clip) return; GL.applyClip(model, pose, clipName, Math.min(time, clip.dur - 0.001), weight); };
  GL.computeWorld = function (model, pose, rootMat) {
    const tmp = new Float32Array(16);
    const rec = (i, parentM) => { const nd = model.nodes[i]; const local = nd.matrix ? nd.matrix : trsToMat(pose.t.subarray(i * 3, i * 3 + 3), pose.r.subarray(i * 4, i * 4 + 4), pose.s.subarray(i * 3, i * 3 + 3), tmp); mul(nd.world, parentM, local); for (const c of nd.children) rec(c, nd.world); };
    for (const r of model.roots) rec(r, rootMat);
  };
  // CPU skin a primitive into out arrays (positions & normals in world space of rootMat)
  GL.skinPrim = function (model, skin, prim, outPos, outNrm) {
    const J = skin.joints.length; const jm = GL._jm && GL._jm.length >= J * 16 ? GL._jm : (GL._jm = new Float32Array(Math.max(J, 64) * 16));
    for (let j = 0; j < J; j++) mul(jm.subarray(j * 16, j * 16 + 16), model.nodes[skin.joints[j]].world, skin.ibm.subarray(j * 16, j * 16 + 16));
    const P = prim.pos, N = prim.nrm, JN = prim.joints, W = prim.weights;
    for (let v = 0; v < prim.count; v++) {
      const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], nx = N ? N[v * 3] : 0, ny = N ? N[v * 3 + 1] : 1, nz = N ? N[v * 3 + 2] : 0;
      let ox = 0, oy = 0, oz = 0, qx = 0, qy = 0, qz = 0;
      for (let k = 0; k < 4; k++) { const w = W[v * 4 + k]; if (!w) continue; const m = jm.subarray(JN[v * 4 + k] * 16, JN[v * 4 + k] * 16 + 16);
        ox += w * (m[0] * px + m[4] * py + m[8] * pz + m[12]); oy += w * (m[1] * px + m[5] * py + m[9] * pz + m[13]); oz += w * (m[2] * px + m[6] * py + m[10] * pz + m[14]);
        qx += w * (m[0] * nx + m[4] * ny + m[8] * nz); qy += w * (m[1] * nx + m[5] * ny + m[9] * nz); qz += w * (m[2] * nx + m[6] * ny + m[10] * nz); }
      outPos[v * 3] = ox; outPos[v * 3 + 1] = oy; outPos[v * 3 + 2] = oz; const l = Math.hypot(qx, qy, qz) || 1; outNrm[v * 3] = qx / l; outNrm[v * 3 + 1] = qy / l; outNrm[v * 3 + 2] = qz / l;
    }
  };
  // bounds of the rest pose (world space, identity root)
  GL.bounds = function (model, clipName) {
    const pose = GL.restPose(model); if (clipName && model.anims[clipName]) GL.applyClip(model, pose, clipName, 0, 1); const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); GL.computeWorld(model, pose, I);
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; const tmpP = new Float32Array(3 * 20000), tmpN = new Float32Array(3 * 20000);
    for (const nd of model.nodes) { if (nd.mesh < 0) continue; for (const pr of model.meshes[nd.mesh].prims) { let P = pr.pos; let m = nd.world; if (nd.skin >= 0) { GL.skinPrim(model, model.skins[nd.skin], pr, tmpP, tmpN); P = tmpP; m = I; } for (let v = 0; v < pr.count; v++) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]; const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14]; if (wx < mn[0]) mn[0] = wx; if (wy < mn[1]) mn[1] = wy; if (wz < mn[2]) mn[2] = wz; if (wx > mx[0]) mx[0] = wx; if (wy > mx[1]) mx[1] = wy; if (wz > mx[2]) mx[2] = wz; } } }
    return { min: mn, max: mx };
  };

  // ---- asset loading (fetch, or embedded base64 in single-file builds) ----
  G.Assets = { models: {}, manifest: null, ready: false };
  G.Assets.load = async function () {
    try {
      let manifest = null;
      if (window.__ASSETS && window.__ASSETS.manifest) manifest = window.__ASSETS.manifest;
      else { const r = await fetch('assets/models.json'); manifest = await r.json(); }
      G.Assets.manifest = manifest;
      const b64buf = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
      for (const role in manifest) {
        const spec = manifest[role]; if (!spec || !spec.file) continue;
        try {
          let buf; if (window.__ASSETS && window.__ASSETS.files && window.__ASSETS.files[spec.file]) buf = b64buf(window.__ASSETS.files[spec.file]); else { const r = await fetch('assets/' + spec.file); if (!r.ok) throw new Error(r.status); buf = await r.arrayBuffer(); }
          const model = GL.parse(buf); const idle = spec.clips && spec.clips.idle; const b = GL.bounds(model, idle); model.height = b.max[1] - b.min[1]; model.base = b.min[1]; model.center = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
          model.spec = spec; model.scale = (spec.height || 1.2) / Math.max(1e-6, model.height);
          G.Assets.models[role] = model;
        } catch (e) { console.warn('asset ' + role + ' failed', e); }
      }
      G.Assets.ready = true;
    } catch (e) { console.warn('assets unavailable, using procedural characters', e); }
  };
})(window.G);
