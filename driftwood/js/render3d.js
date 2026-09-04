// DRIFTWOOD — low-poly first-person WebGL renderer (no external libraries)
// Sim coords (x, y) on the tile grid map to GL (x, up, z=y). Every mesh is procedural flat-shaded geometry.
(function (G) {
  'use strict';
  const T = G.T, O = G.OBJS, W = G.WORLD;
  const R = { cam: { x: 0, y: 0, z: 1, yaw: -Math.PI / 2, pitch: 0 }, shake: 0, hitstop: 0, fx: { parts: [], floats: [], booms: [], zaps: [], slashes: [], targets: [], pings: [], wobble: {} }, tellFlash: {}, W: 640, H: 360, hurt: 0 };
  G.Render = R;
  let gl, cv, ov, ox, mini, minx, miniBase = null, prog, skyProg, skyBuf;
  const CH = 16, WATER_Y = 0.0, HSCALE = 4.2, EYE = 1.0;
  const VF = 10; // floats per vertex: pos3 nrm3 col3 em1
  const chunks = {}; // key -> { vbo, n, wvbo, wn, obo, on }
  let dynBuf = null, dyn = { arr: new Float32Array(VF * 3 * 60000), n: 0 };
  let vp = new Float32Array(16), proj = new Float32Array(16), view = new Float32Array(16);
  let lights = [], fog = [0.7, 0.8, 0.9], nowT = 0, sunDir = [0, 1, 0], sunCol = [1, 1, 1], moonDir = [0, 1, 0], ambient = 1, camBasis = null;

  // ================= heights =================
  R.hAt = function (world, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= W) return -0.6;
    const h = world.height[ty * W + tx]; const t = world.tiles[ty * W + tx];
    if (t <= T.WATER) return -0.6 + Math.max(0, h + 0.3) * 0.7;
    return Math.max(0.15, (h - 0.02) * HSCALE * 0.6 + 0.15);
  };
  function cornerH(world, cx, cy) { return (R.hAt(world, cx - 1, cy - 1) + R.hAt(world, cx, cy - 1) + R.hAt(world, cx - 1, cy) + R.hAt(world, cx, cy)) / 4; }
  R.groundZ = function (world, x, y) {
    if (!world) return 0;
    const tx = Math.floor(x), ty = Math.floor(y); const fx = x - tx, fy = y - ty;
    const h00 = cornerH(world, tx, ty), h10 = cornerH(world, tx + 1, ty), h01 = cornerH(world, tx, ty + 1), h11 = cornerH(world, tx + 1, ty + 1);
    let z = (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
    const o = world.objs.get(ty * W + tx); if (o && O[o.t].floor) return Math.max(z, WATER_Y + 0.1);
    return z;
  };

  // ================= shaders =================
  const VS = `attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; attribute float aEm;
    uniform mat4 uVP; uniform float uTime; uniform float uWater; uniform vec3 uCam;
    varying vec3 vCol; varying float vFog; varying vec3 vNrm; varying vec3 vPos; varying float vEm;
    void main(){ vec3 p = aPos; vec3 n = aNrm;
      if(uWater > 0.5){ p.y += sin(p.x*1.3 + uTime*1.6)*0.05 + cos(p.z*1.1 + uTime*1.2)*0.05; n = normalize(vec3(-cos(p.x*1.3+uTime*1.6)*0.07, 1.0, sin(p.z*1.1+uTime*1.2)*0.06)); }
      gl_Position = uVP * vec4(p, 1.0); vPos = p; vNrm = n; vCol = aCol; vEm = aEm;
      float d = distance(p, uCam); vFog = clamp((d - 26.0) / 40.0, 0.0, 1.0); }`;
  const FS = `precision mediump float;
    uniform vec3 uFog; uniform float uAlpha; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uAmb; uniform vec4 uLights[16]; uniform vec3 uLightCol[16]; uniform int uNL; uniform vec3 uCam;
    varying vec3 vCol; varying float vFog; varying vec3 vNrm; varying vec3 vPos; varying float vEm;
    void main(){ vec3 n = normalize(vNrm); if(!gl_FrontFacing) n = -n;
      vec3 L = vec3(uAmb) * (0.7 + 0.3 * n.y);
      L += uSunCol * max(0.0, dot(n, uSunDir));
      for(int i=0;i<16;i++){ if(i>=uNL) break; vec3 d = uLights[i].xyz - vPos; float dist = length(d); float a = clamp(1.0 - dist/uLights[i].w, 0.0, 1.0); L += uLightCol[i] * a * a * 1.9 * max(0.3, dot(n, d/dist)); }
      vec3 c = vCol * max(L, vec3(vEm));
      c = mix(c, uFog, vFog);
      gl_FragColor = vec4(c, uAlpha); }`;
  const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.999, 1.0); }`;
  const SKY_FS = `precision mediump float; varying vec2 vP;
    uniform vec3 uRight, uUp, uFwd, uSunDir, uMoonDir; uniform float uTanH, uAspect, uDusk, uNight, uTime;
    float hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main(){ vec3 dir = normalize(uFwd + uRight*vP.x*uTanH*uAspect + uUp*vP.y*uTanH);
      float h = max(dir.y, 0.0);
      vec3 day = mix(vec3(0.78,0.87,0.96), vec3(0.28,0.52,0.9), pow(h, 0.55));
      vec3 dusk = mix(vec3(0.98,0.6,0.38), vec3(0.22,0.2,0.45), pow(h, 0.5));
      vec3 night = mix(vec3(0.05,0.06,0.14), vec3(0.01,0.012,0.045), pow(h, 0.5));
      vec3 c = mix(mix(day, dusk, uDusk), night, uNight);
      float s = dot(dir, uSunDir); float sunOn = 1.0 - uNight;
      c += vec3(1.0,0.95,0.75) * smoothstep(0.9975, 0.9992, s) * sunOn;
      c += vec3(1.0,0.72,0.42) * pow(max(s,0.0), 40.0) * 0.45 * sunOn;
      float m = dot(dir, uMoonDir); c += vec3(0.92,0.93,1.0) * smoothstep(0.9988, 0.9996, m) * uNight; c += vec3(0.5,0.55,0.8)*pow(max(m,0.0),90.0)*0.3*uNight;
      float st = hash(floor(dir*220.0)); c += vec3(1.0) * step(0.9975, st) * uNight * smoothstep(0.0, 0.15, dir.y) * (0.6 + 0.4*sin(uTime*3.0 + st*100.0));
      if(dir.y < 0.0) c = mix(c, c*0.9, clamp(-dir.y*8.0, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0); }`;
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs, fs, attrs, unis) { const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.a = {}; p.u = {}; attrs.forEach(a => p.a[a] = gl.getAttribLocation(p, a)); unis.forEach(u => p.u[u] = gl.getUniformLocation(p, u)); return p; }

  R.init = function (canvas, overlay, minimap) {
    cv = canvas; ov = overlay; ox = ov.getContext('2d'); mini = minimap; minx = mini.getContext('2d');
    gl = cv.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl');
    if (!gl) { alert('WebGL is required to play DRIFTWOOD.'); return; }
    prog = program(VS, FS, ['aPos', 'aNrm', 'aCol', 'aEm'], ['uVP', 'uTime', 'uWater', 'uCam', 'uFog', 'uAlpha', 'uSunDir', 'uSunCol', 'uAmb', 'uLights', 'uLightCol', 'uNL']);
    skyProg = program(SKY_VS, SKY_FS, ['aP'], ['uRight', 'uUp', 'uFwd', 'uSunDir', 'uMoonDir', 'uTanH', 'uAspect', 'uDusk', 'uNight', 'uTime']);
    skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    dynBuf = gl.createBuffer();
    buildPrefabs();
    R.resize(); window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    const ww = window.innerWidth, wh = window.innerHeight; const scale = ww > 1600 ? 0.6 : 0.75;
    R.W = Math.round(ww * scale); R.H = Math.round(wh * scale);
    cv.width = R.W; cv.height = R.H; ov.width = R.W; ov.height = R.H;
    for (const c of [cv, ov]) { c.style.width = ww + 'px'; c.style.height = wh + 'px'; }
    if (gl) gl.viewport(0, 0, R.W, R.H);
  };

  // ================= matrices =================
  function m4() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function mmul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function mT(x, y, z) { const m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function mS(x, y, z) { const m = m4(); m[0] = x; m[5] = y === undefined ? x : y; m[10] = z === undefined ? x : z; return m; }
  function mRY(a) { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; } // local +X -> (cos a, 0, sin a)
  function mRX(a) { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function mRZ(a) { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  const M = (...ms) => ms.reduce((a, b) => mmul(a, b));
  function xf(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
  function xfn(m, x, y, z) { const v = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function perspective(out, fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); out.fill(0); out[0] = t / asp; out[5] = t; out[10] = (f + n) / (n - f); out[11] = -1; out[14] = 2 * f * n / (n - f); }
  function lookAt(out, ex, ey, ez, fx, fy, fz) {
    let sx = -fz, sy = 0, sz = fx; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sz /= sl;
    const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
    out[0] = sx; out[4] = sy; out[8] = sz; out[12] = -(sx * ex + sy * ey + sz * ez);
    out[1] = ux; out[5] = uy; out[9] = uz; out[13] = -(ux * ex + uy * ey + uz * ez);
    out[2] = -fx; out[6] = -fy; out[10] = -fz; out[14] = (fx * ex + fy * ey + fz * ez);
    out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
    camBasis = { r: [sx, sy, sz], u: [ux, uy, uz], f: [fx, fy, fz] };
  }
  R.project = function (x, y, z) { // sim x,y + height z -> screen px
    const X = x, Y = z, Z = y;
    const cx = vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12], cy = vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13], cw = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15];
    if (cw <= 0.05) return null;
    return { x: (cx / cw * 0.5 + 0.5) * R.W, y: (1 - (cy / cw * 0.5 + 0.5)) * R.H, d: cw };
  };
  R.forward = () => ({ x: Math.cos(R.cam.yaw) * Math.cos(R.cam.pitch), z: Math.sin(R.cam.pitch), y: Math.sin(R.cam.yaw) * Math.cos(R.cam.pitch) });
  R.rayGround = function (world, maxD) {
    const f = R.forward(); let px = R.cam.x, py = R.cam.y, pz = R.cam.z;
    for (let d = 0; d < maxD; d += 0.12) { px += f.x * 0.12; py += f.y * 0.12; pz += f.z * 0.12; if (!G.inWorld(px, py)) return null; if (pz <= R.groundZ(world, px, py) + 0.02) return { x: px, y: py }; }
    return null;
  };

  // ================= mesh builder =================
  // target: { arr, n }. All primitives are local-space, transformed by matrix m.
  function grow(t, verts) { if ((t.n + verts) * VF > t.arr.length) { const na = new Float32Array(Math.max(t.arr.length * 2, (t.n + verts) * VF)); na.set(t.arr); t.arr = na; } }
  function vert(t, p, n, col, em) { const i = t.n * VF; const a = t.arr; a[i] = p[0]; a[i + 1] = p[1]; a[i + 2] = p[2]; a[i + 3] = n[0]; a[i + 4] = n[1]; a[i + 5] = n[2]; a[i + 6] = col[0]; a[i + 7] = col[1]; a[i + 8] = col[2]; a[i + 9] = em || 0; t.n++; }
  // triangle in local space; c0 = local center of the primitive used to orient the normal outward
  function tri(t, m, a, b, c, col, em, c0) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (c0) { const mx = (a[0] + b[0] + c[0]) / 3 - c0[0], my = (a[1] + b[1] + c[1]) / 3 - c0[1], mz = (a[2] + b[2] + c[2]) / 3 - c0[2]; if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; const tmp = b; b = c; c = tmp; } }
    const n = xfn(m, nx, ny, nz); grow(t, 3);
    vert(t, xf(m, a[0], a[1], a[2]), n, col, em); vert(t, xf(m, b[0], b[1], b[2]), n, col, em); vert(t, xf(m, c[0], c[1], c[2]), n, col, em);
  }
  function quad(t, m, a, b, c, d, col, em, c0) { tri(t, m, a, b, c, col, em, c0); tri(t, m, a, c, d, col, em, c0); }
  function box(t, m, sx, sy, sz, col, em, cy) { // centered at (0, cy||sy/2, 0)
    const x = sx / 2, z = sz / 2, y0 = (cy === undefined ? sy / 2 : cy) - sy / 2, y1 = y0 + sy; const c0 = [0, (y0 + y1) / 2, 0];
    const p = [[-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z], [-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]];
    quad(t, m, p[0], p[1], p[2], p[3], col, em, c0); quad(t, m, p[4], p[5], p[6], p[7], col, em, c0);
    quad(t, m, p[0], p[1], p[5], p[4], col, em, c0); quad(t, m, p[2], p[3], p[7], p[6], col, em, c0);
    quad(t, m, p[1], p[2], p[6], p[5], col, em, c0); quad(t, m, p[3], p[0], p[4], p[7], col, em, c0);
  }
  function cyl(t, m, r0, r1, h, sides, col, em, y0) { // axis Y from y0 (default 0) to y0+h
    y0 = y0 || 0; const c0 = [0, y0 + h / 2, 0];
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      const b0 = [Math.cos(a0) * r0, y0, Math.sin(a0) * r0], b1 = [Math.cos(a1) * r0, y0, Math.sin(a1) * r0], t0 = [Math.cos(a0) * r1, y0 + h, Math.sin(a0) * r1], t1 = [Math.cos(a1) * r1, y0 + h, Math.sin(a1) * r1];
      if (r1 > 0.001) quad(t, m, b0, b1, t1, t0, col, em, c0); else tri(t, m, b0, b1, [0, y0 + h, 0], col, em, c0);
      if (r0 > 0.001) tri(t, m, b0, b1, [0, y0, 0], col, em, c0);
      if (r1 > 0.001) tri(t, m, t0, t1, [0, y0 + h, 0], col, em, c0);
    }
  }
  function sph(t, m, r, lon, lat, col, em, sy) { // centered at origin, squashed vertically by sy
    sy = sy || 1; const c0 = [0, 0, 0];
    for (let j = 0; j < lat; j++) {
      const p0 = -Math.PI / 2 + j / lat * Math.PI, p1 = -Math.PI / 2 + (j + 1) / lat * Math.PI;
      for (let i = 0; i < lon; i++) {
        const a0 = i / lon * Math.PI * 2, a1 = (i + 1) / lon * Math.PI * 2;
        const P = (a, p) => [Math.cos(p) * Math.cos(a) * r, Math.sin(p) * r * sy, Math.cos(p) * Math.sin(a) * r];
        quad(t, m, P(a0, p0), P(a1, p0), P(a1, p1), P(a0, p1), col, em, c0);
      }
    }
  }
  function blade(t, m, w, h, col, em, lean) { // vertical quad (double sided via shader), base at origin
    quad(t, m, [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2 + (lean || 0), h, 0], [-w / 2 + (lean || 0), h, 0], col, em);
  }
  function inst(t, prefab, m) { // copy a prefab (local space Float32Array) transformed by m
    const n = prefab.length / VF; grow(t, n);
    for (let i = 0; i < n; i++) { const o = i * VF; const p = xf(m, prefab[o], prefab[o + 1], prefab[o + 2]); const nn = xfn(m, prefab[o + 3], prefab[o + 4], prefab[o + 5]); vert(t, p, nn, [prefab[o + 6], prefab[o + 7], prefab[o + 8]], prefab[o + 9]); }
  }
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const sh = (c, k) => c.map(v => G.clamp(v * k, 0, 1));
  const h2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

  // ================= prefabs (world objects, local space, base at y=0) =================
  const PF = {};
  function pf(name, fn) { const t = { arr: new Float32Array(VF * 3 * 400), n: 0 }; fn(t, m4()); PF[name] = t.arr.slice(0, t.n * VF); }
  function buildPrefabs() {
    const wood = hex('#7a4a22'), leaf = hex('#3f8f38'), leaf2 = hex('#2f6f2a'), stone = hex('#7d7f83'), dark = hex('#3a3040');
    pf('tree', (t, m) => { cyl(t, m, 0.16, 0.12, 1.3, 6, wood); sph(t, M(m, mT(0, 1.7, 0)), 0.75, 6, 4, leaf2, 0, 0.85); sph(t, M(m, mT(0.25, 2.2, 0.1)), 0.55, 6, 4, leaf, 0, 0.9); sph(t, M(m, mT(-0.3, 2.05, -0.2)), 0.45, 5, 3, leaf); });
    pf('birch', (t, m) => { cyl(t, m, 0.13, 0.1, 1.7, 6, hex('#e8e8e0')); box(t, M(m, mT(0.1, 0.5, 0)), 0.1, 0.08, 0.28, dark); box(t, M(m, mT(-0.08, 1.1, 0.05)), 0.1, 0.08, 0.26, dark); sph(t, M(m, mT(0, 2.15, 0)), 0.7, 6, 4, hex('#6ab04c'), 0, 0.8); sph(t, M(m, mT(0.2, 2.6, 0.15)), 0.45, 5, 3, hex('#8cd060')); });
    pf('deadtree', (t, m) => { const d = hex('#3a2a22'); cyl(t, m, 0.15, 0.09, 1.9, 5, d); box(t, M(m, mT(0.3, 1.4, 0), mRZ(-0.7)), 0.7, 0.08, 0.08, d); box(t, M(m, mT(-0.25, 1.1, 0.1), mRZ(0.8)), 0.6, 0.08, 0.08, d); box(t, M(m, mT(0.05, 1.8, -0.2), mRX(0.7)), 0.08, 0.08, 0.5, d); });
    const rock = (t, m, r, col, seedK) => { const rr = G.RNG(seedK); const tt = { arr: new Float32Array(VF * 3 * 200), n: 0 }; sph(tt, m4(), r, 6, 3, col, 0, 0.7); for (let i = 0; i < tt.n; i++) { const o = i * VF; const k = 0.8 + rr() * 0.4; tt.arr[o] *= k; tt.arr[o + 2] *= 0.8 + rr() * 0.4; if (tt.arr[o + 1] < 0) tt.arr[o + 1] *= 0.2; } inst(t, tt.arr.slice(0, tt.n * VF), M(m, mT(0, 0.05, 0))); };
    pf('rock', (t, m) => rock(t, m, 0.45, stone, 7));
    pf('coal_rock', (t, m) => { rock(t, m, 0.45, stone, 8); box(t, M(m, mT(0.2, 0.3, 0.2), mRY(0.4)), 0.16, 0.16, 0.16, hex('#1a1a1e')); box(t, M(m, mT(-0.2, 0.25, -0.1), mRY(1.1)), 0.14, 0.14, 0.14, hex('#1a1a1e')); box(t, M(m, mT(0, 0.45, -0.2)), 0.12, 0.12, 0.12, hex('#1a1a1e')); });
    pf('iron_vein', (t, m) => { rock(t, m, 0.5, sh(stone, 0.9), 9); for (let i = 0; i < 4; i++) box(t, M(m, mT(Math.cos(i * 1.7) * 0.3, 0.2 + i * 0.1, Math.sin(i * 1.7) * 0.3), mRY(i)), 0.16, 0.16, 0.16, hex('#c08060')); });
    pf('gold_vein', (t, m) => { rock(t, m, 0.5, sh(stone, 0.85), 10); for (let i = 0; i < 4; i++) box(t, M(m, mT(Math.cos(i * 1.9) * 0.3, 0.2 + i * 0.1, Math.sin(i * 1.9) * 0.3), mRY(i)), 0.15, 0.15, 0.15, hex('#ffd24a'), 0.35); });
    pf('obsidian_vein', (t, m) => { rock(t, m, 0.55, hex('#3a3048'), 11); for (let i = 0; i < 3; i++) { const g = M(m, mT(Math.cos(i * 2.1) * 0.25, 0.35 + i * 0.15, Math.sin(i * 2.1) * 0.25), mRY(i), mRZ(0.4)); cyl(t, g, 0.12, 0, 0.5, 4, hex('#8060b0'), 0.25); } });
    pf('berry_bush', (t, m) => { sph(t, M(m, mT(0, 0.35, 0)), 0.45, 6, 3, hex('#2f7a2a'), 0, 0.8); for (let i = 0; i < 6; i++) box(t, M(m, mT(Math.cos(i * 1.05) * 0.35, 0.3 + (i % 3) * 0.12, Math.sin(i * 1.05) * 0.35)), 0.09, 0.09, 0.09, hex('#e03060')); });
    pf('mushroom', (t, m) => { cyl(t, m, 0.1, 0.08, 0.35, 5, hex('#e8e0c8')); sph(t, M(m, mT(0, 0.38, 0)), 0.3, 6, 3, hex('#c04040'), 0, 0.5); box(t, M(m, mT(0.1, 0.5, 0.08)), 0.08, 0.04, 0.08, hex('#fff')); box(t, M(m, mT(-0.12, 0.47, -0.05)), 0.07, 0.04, 0.07, hex('#fff')); cyl(t, M(m, mT(0.3, 0, 0.2)), 0.06, 0.05, 0.2, 5, hex('#e8e0c8')); sph(t, M(m, mT(0.3, 0.22, 0.2)), 0.16, 5, 3, hex('#d05050'), 0, 0.5); });
    pf('wheat', (t, m) => { for (let i = 0; i < 7; i++) { const g = M(m, mT((h2(i, 1) - .5) * 0.7, 0, (h2(i, 2) - .5) * 0.7), mRY(h2(i, 3) * 6)); blade(t, g, 0.05, 0.6 + h2(i, 4) * 0.3, hex('#c8b040'), 0, 0.1); box(t, M(g, mT(0.05, 0.7 + h2(i, 4) * 0.3, 0)), 0.07, 0.22, 0.07, hex('#e0c850')); } });
    pf('cactus', (t, m) => { const c = hex('#3a9a4a'); cyl(t, m, 0.16, 0.14, 1.1, 6, c); cyl(t, M(m, mT(0.28, 0.55, 0), mRZ(-1.3)), 0.09, 0.09, 0.3, 5, c); cyl(t, M(m, mT(0.42, 0.55, 0)), 0.09, 0.08, 0.35, 5, c); cyl(t, M(m, mT(-0.25, 0.4, 0), mRZ(1.3)), 0.08, 0.08, 0.28, 5, c); cyl(t, M(m, mT(-0.4, 0.4, 0)), 0.08, 0.07, 0.3, 5, c); box(t, M(m, mT(0, 1.15, 0)), 0.12, 0.12, 0.12, hex('#e05a9a')); });
    pf('grass_tuft', (t, m) => { for (let i = 0; i < 6; i++) { const g = M(m, mT((h2(i, 5) - .5) * 0.6, 0, (h2(i, 6) - .5) * 0.6), mRY(h2(i, 7) * 6)); blade(t, g, 0.08, 0.35 + h2(i, 8) * 0.25, i % 2 ? hex('#7ab84a') : hex('#5c9a45'), 0, 0.12); } });
    pf('stub', (t, m) => { cyl(t, m, 0.14, 0.12, 0.2, 6, wood); });
    const chest = (name, col) => pf(name, (t, m) => { const c = hex(col); box(t, M(m, mT(0, 0, 0)), 0.8, 0.45, 0.55, c, 0.05); box(t, M(m, mT(0, 0.45, 0)), 0.84, 0.2, 0.6, sh(c, 1.25), 0.05); box(t, M(m, mT(0, 0.32, 0.29)), 0.12, 0.16, 0.06, hex('#ffd24a'), 0.4); for (const x of [-0.3, 0.3]) box(t, M(m, mT(x, 0.3, 0)), 0.06, 0.66, 0.6, hex('#3a3030')); });
    chest('chest_c', '#8a6a3f'); chest('chest_u', '#3a9a4a'); chest('chest_r', '#b03030'); chest('chest_l', '#d0a020');
    const altar = (name, col) => pf(name, (t, m) => { box(t, m, 1.5, 0.25, 1.5, hex('#5a5a60')); box(t, M(m, mT(0, 0.25, 0)), 1.0, 0.25, 1.0, hex('#6a6a70')); cyl(t, M(m, mT(0, 0.5, 0)), 0.22, 0.18, 1.1, 6, hex('#7a7a80')); for (let i = 0; i < 4; i++) cyl(t, M(m, mT(Math.cos(i * 1.57) * 0.6, 0.5, Math.sin(i * 1.57) * 0.6)), 0.08, 0.06, 0.5, 4, hex('#6a6a70')); const g = M(m, mT(0, 2.0, 0), mRY(0.7)); cyl(t, g, 0.28, 0, 0.4, 4, hex(col), 0.9); cyl(t, M(g, mRX(Math.PI), mT(0, 0, 0)), 0.28, 0, 0.4, 4, hex(col), 0.9); });
    altar('altar_meadow', '#30e070'); altar('altar_forest', '#3070ff'); altar('altar_volcano', '#ff3050');
    pf('boat', (t, m) => { const hull = hex('#7a4a20'); box(t, M(m, mT(0, 0.2, 0)), 3.2, 0.5, 1.3, hull); box(t, M(m, mT(1.8, 0.35, 0), mRY(0.8)), 0.9, 0.5, 0.9, hull); box(t, M(m, mT(0, 0.55, 0)), 2.9, 0.1, 1.0, hex('#9a6a30')); cyl(t, M(m, mT(-0.2, 0.6, 0)), 0.07, 0.06, 2.6, 5, hex('#5a3a20')); quad(t, M(m, mT(-0.12, 1.4, 0)), [0, 0, 0], [0, 1.6, 0], [1.3, 1.5, 0], [1.4, 0.3, 0], hex('#e8e0d0')); box(t, M(m, mT(0.9, 0.7, -0.5), mRZ(0.4)), 0.8, 0.12, 0.12, hex('#4a2a10')); });
    pf('workbench', (t, m) => { box(t, M(m, mT(0, 0.55, 0)), 1.0, 0.1, 0.6, hex('#b08040')); for (const [x, z] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) box(t, M(m, mT(x, 0, z)), 0.08, 0.55, 0.08, hex('#8a6030')); box(t, M(m, mT(-0.2, 0.6, 0)), 0.25, 0.12, 0.2, hex('#9a9ca1')); box(t, M(m, mT(0.25, 0.6, 0.1), mRY(0.5)), 0.3, 0.06, 0.06, hex('#c8c8d0')); });
    pf('furnace', (t, m) => { box(t, M(m, mT(0, 0, 0)), 0.9, 1.0, 0.9, hex('#6a6a70')); box(t, M(m, mT(0, 1.0, 0)), 0.5, 0.3, 0.5, hex('#5a5a60')); box(t, M(m, mT(0, 0.3, 0.42)), 0.45, 0.35, 0.1, hex('#ff6a1a'), 1.0); box(t, M(m, mT(0, 0.3, 0.44)), 0.25, 0.2, 0.1, hex('#ffd040'), 1.0); });
    pf('anvil', (t, m) => { box(t, M(m, mT(0, 0, 0)), 0.6, 0.15, 0.5, hex('#404048')); box(t, M(m, mT(0, 0.15, 0)), 0.3, 0.25, 0.3, hex('#505058')); box(t, M(m, mT(0, 0.4, 0)), 0.9, 0.18, 0.4, hex('#707078')); cyl(t, M(m, mT(0.55, 0.49, 0), mRZ(-1.57)), 0.12, 0.02, 0.4, 5, hex('#707078')); });
    pf('cauldron', (t, m) => { cyl(t, m, 0.3, 0.42, 0.55, 8, hex('#303840')); cyl(t, M(m, mT(0, 0.55, 0)), 0.45, 0.45, 0.08, 8, hex('#505860')); cyl(t, M(m, mT(0, 0.52, 0)), 0.36, 0.36, 0.06, 8, hex('#60c060'), 0.6); for (let i = 0; i < 3; i++) box(t, M(m, mT(Math.cos(i * 2.09) * 0.3, -0.02, Math.sin(i * 2.09) * 0.3)), 0.1, 0.12, 0.1, hex('#202020')); });
    pf('campfire', (t, m) => { for (let i = 0; i < 3; i++) box(t, M(m, mT(0, 0.08, 0), mRY(i * 1.05)), 0.9, 0.14, 0.14, hex('#5a3a20')); for (let i = 0; i < 5; i++) box(t, M(m, mT(Math.cos(i * 1.26) * 0.35, 0.02, Math.sin(i * 1.26) * 0.35)), 0.18, 0.12, 0.18, hex('#6a6a70')); cyl(t, M(m, mT(0, 0.12, 0)), 0.28, 0, 0.7, 5, hex('#ff6a1a'), 1.0); cyl(t, M(m, mT(0.05, 0.15, 0.03)), 0.16, 0, 0.5, 5, hex('#ffd040'), 1.0); });
    pf('torch', (t, m) => { cyl(t, m, 0.05, 0.04, 0.9, 5, hex('#8a5a30')); cyl(t, M(m, mT(0, 0.85, 0)), 0.1, 0, 0.3, 5, hex('#ff9a30'), 1.0); sph(t, M(m, mT(0, 0.9, 0)), 0.07, 5, 3, hex('#ffe060'), 1.0); });
    pf('wall_wood', (t, m) => { for (let i = 0; i < 3; i++) box(t, M(m, mT(0, i * 0.45, 0)), 1.0, 0.43, 0.3, i % 2 ? hex('#8a5a30') : hex('#7a4a26')); box(t, M(m, mT(-0.45, 0, 0)), 0.1, 1.4, 0.34, hex('#5a3a20')); box(t, M(m, mT(0.45, 0, 0)), 0.1, 1.4, 0.34, hex('#5a3a20')); });
    pf('wall_stone', (t, m) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) box(t, M(m, mT((i - 0.5) * 0.5 + (j % 2) * 0.25 - 0.125, j * 0.35, 0)), 0.48, 0.33, 0.3, (i + j) % 2 ? hex('#7a7c80') : hex('#6a6c70')); });
    pf('door_wood', (t, m) => { box(t, M(m, mT(0, 0, 0)), 0.9, 1.4, 0.12, hex('#c09050')); box(t, M(m, mT(0, 0, 0.07)), 0.06, 1.4, 0.02, hex('#8a5a30')); box(t, M(m, mT(0.3, 0.7, 0.08)), 0.08, 0.08, 0.06, hex('#ffd24a'), 0.3); box(t, M(m, mT(-0.48, 0, 0)), 0.08, 1.45, 0.2, hex('#5a3a20')); box(t, M(m, mT(0.48, 0, 0)), 0.08, 1.45, 0.2, hex('#5a3a20')); });
    pf('door_open', (t, m) => { box(t, M(m, mT(-0.48, 0, 0)), 0.08, 1.45, 0.2, hex('#5a3a20')); box(t, M(m, mT(0.48, 0, 0)), 0.08, 1.45, 0.2, hex('#5a3a20')); box(t, M(m, mT(-0.44, 0, -0.45), mRY(1.57)), 0.9, 1.4, 0.12, hex('#c09050')); });
    pf('floor_wood', (t, m) => { for (let i = 0; i < 4; i++) box(t, M(m, mT(0, 0, (i - 1.5) * 0.25)), 1.0, 0.1, 0.23, i % 2 ? hex('#b08858') : hex('#a07848')); });
    pf('spikes', (t, m) => { box(t, m, 1.0, 0.08, 1.0, hex('#6a5a40')); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cyl(t, M(m, mT((i - 1) * 0.3, 0.08, (j - 1) * 0.3)), 0.06, 0, 0.35, 4, hex('#c0c0c8')); });
  }

  // ================= items as meshes =================
  function itemMesh(t, m, id, small) {
    const d = G.ITEMS[id]; if (!d && id === 'coin') { cyl(t, M(m, mRX(1.57)), 0.12, 0.12, 0.04, 8, hex('#ffd24a'), 0.5); return; }
    const c = hex(d.col); const s = small ? 0.6 : 1;
    if (d.type === 'tool') { box(t, M(m, mS(s)), 0.06, 0.9, 0.06, hex('#8a5a30'), 0, 0.3); if (d.tool === 'axe') box(t, M(m, mS(s), mT(0.12, 0.7, 0)), 0.32, 0.22, 0.06, c); else box(t, M(m, mS(s), mT(0, 0.72, 0)), 0.5, 0.1, 0.07, c); }
    else if (d.type === 'weapon') { const L = id === 'spear_iron' ? 1.6 : id === 'hammer_gold' ? 0.9 : 0.85; box(t, M(m, mS(s)), 0.05, 0.25, 0.05, hex('#4a3010'), 0, 0.02); box(t, M(m, mS(s), mT(0, 0.26, 0)), 0.22, 0.05, 0.06, hex('#6a4a20')); if (id === 'hammer_gold') box(t, M(m, mS(s), mT(0, 0.9, 0)), 0.45, 0.28, 0.24, c); else if (id === 'spear_iron') { box(t, M(m, mS(s), mT(0, 0.3, 0)), 0.05, L, 0.05, hex('#8a5a30'), 0, 0.3); cyl(t, M(m, mS(s), mT(0, 0.3 + L, 0)), 0.07, 0, 0.3, 4, c); } else box(t, M(m, mS(s), mT(0, 0.3, 0)), 0.09, L, 0.03, c, id === 'blade_ember' ? 0.6 : 0, 0.42); }
    else if (d.type === 'bow') { for (let i = -2; i <= 2; i++) box(t, M(m, mS(s), mT(-Math.abs(i) * 0.06 + 0.1, i * 0.2, 0), mRZ(i * 0.35)), 0.05, 0.24, 0.05, c); box(t, M(m, mS(s), mT(-0.1, 0, 0)), 0.01, 0.9, 0.01, hex('#e0e0e0')); }
    else if (d.type === 'shield') { box(t, M(m, mS(s)), 0.7, 0.9, 0.08, c, 0, 0); box(t, M(m, mS(s), mT(0, 0, 0.05)), 0.12, 0.6, 0.04, sh(c, 1.4)); }
    else if (d.type === 'armor') { box(t, M(m, mS(s)), 0.45, 0.45, 0.35, c, 0, 0); }
    else if (d.type === 'food') { sph(t, M(m, mS(s)), 0.18, 6, 4, c); }
    else if (d.type === 'gem') { cyl(t, M(m, mS(s)), 0.2, 0, 0.3, 4, c, 0.9); cyl(t, M(m, mS(s), mRX(Math.PI)), 0.2, 0, 0.3, 4, c, 0.9); }
    else if (d.type === 'key') { box(t, M(m, mS(s)), 0.08, 0.9, 0.08, hex('#6a4a30'), 0, 0.3); box(t, M(m, mS(s), mT(0, 0.7, 0)), 0.3, 0.2, 0.2, c, 0.3); box(t, M(m, mS(s), mT(0, 0.35, 0)), 0.25, 0.15, 0.15, c, 0.3); }
    else if (d.type === 'arrow') { box(t, M(m, mS(s)), 0.03, 0.8, 0.03, hex('#d8c8a8'), 0, 0.3); cyl(t, M(m, mS(s), mT(0, 0.7, 0)), 0.05, 0, 0.12, 4, hex('#9a9ca1')); }
    else if (d.type === 'place') { const p = PF[d.obj]; if (p) inst(t, p, M(m, mS(s * (d.obj === 'torch' ? 0.8 : 0.4)))); }
    else { box(t, M(m, mS(s), mRY(0.4)), 0.25, 0.25, 0.25, c, 0, 0); }
  }

  // ================= creatures =================
  // humanoid rig facing local +X; base at y=0. o: { h (height), body, skin, legs, head, helm, chest, legcol, anim, swing, prop }
  function humanoid(t, m, o) {
    const h = o.h || 1.2; const s = h / 1.2; const ms = M(m, mS(s));
    const legSw = Math.sin(o.anim || 0) * (o.moving ? 0.6 : 0); const armSw = -legSw;
    const legC = o.legcol || hex('#3a3040'), body = o.chest || o.body, skin = o.skin || hex('#f0c8a0');
    for (const side of [-1, 1]) { box(t, M(ms, mT(0, 0.5, side * 0.11), mRZ(side * legSw)), 0.16, 0.5, 0.16, legC, 0, -0.25); }
    box(t, M(ms, mT(0, 0.5, 0)), 0.3, 0.42, 0.42, body, 0, 0.21);
    if (o.chest) box(t, M(ms, mT(0, 0.5, 0)), 0.34, 0.3, 0.46, sh(o.chest, 0.85), 0, 0.2);
    const swing = o.swing !== undefined ? o.swing : null;
    for (const side of [-1, 1]) {
      let rot = side * armSw * 0.7; if (side === 1 && swing !== null) rot = -1.6 + Math.sin(swing * Math.PI) * 1.6; if (side === -1 && o.block) rot = -1.2;
      const arm = M(ms, mT(0, 0.9, side * 0.29), mRZ(rot));
      box(t, arm, 0.14, 0.42, 0.14, side === 1 || !o.chest ? body : body, 0, -0.21);
      box(t, M(arm, mT(0, -0.42, 0)), 0.12, 0.12, 0.12, skin, 0, 0);
      if (side === 1 && o.held) itemMesh(t, M(arm, mT(0.05, -0.5, 0), mRZ(-1.4)), o.held, true);
      if (side === -1 && o.shield) box(t, M(arm, mT(0.15, -0.35, 0)), 0.08, 0.6, 0.5, hex('#6a5a40'));
    }
    box(t, M(ms, mT(0, 0.92, 0)), 0.3, 0.3, 0.3, skin, 0, 0.15);
    box(t, M(ms, mT(0.15, 1.02, -0.06)), 0.02, 0.05, 0.05, hex('#14121a'), 0, 0); box(t, M(ms, mT(0.15, 1.02, 0.06)), 0.02, 0.05, 0.05, hex('#14121a'), 0, 0);
    if (o.helm) box(t, M(ms, mT(0, 1.1, 0)), 0.34, 0.14, 0.34, o.helm, 0, 0.07); else if (o.hair) box(t, M(ms, mT(-0.02, 1.2, 0)), 0.32, 0.08, 0.32, o.hair, 0, 0);
    if (o.crown) { for (let i = 0; i < 4; i++) box(t, M(ms, mT(Math.cos(i * 1.57) * 0.12, 1.24, Math.sin(i * 1.57) * 0.12)), 0.06, 0.16, 0.06, hex('#ffd24a'), 0.4); }
    if (o.ears) { box(t, M(ms, mT(0, 0.98, -0.2)), 0.05, 0.12, 0.14, skin, 0, 0); box(t, M(ms, mT(0, 0.98, 0.2)), 0.05, 0.12, 0.14, skin, 0, 0); }
  }
  function quadruped(t, m, o) {
    const s = o.s || 1; const ms = M(m, mS(s)); const c = o.col, d = sh(o.col, 0.75); const sw = Math.sin(o.anim || 0) * (o.moving ? 0.7 : 0);
    box(t, M(ms, mT(0, 0.45, 0)), 0.8, 0.32, 0.34, c, 0, 0.16);
    box(t, M(ms, mT(0.45, 0.62, 0)), 0.34, 0.28, 0.28, c, 0, 0.14); box(t, M(ms, mT(0.64, 0.56, 0)), 0.18, 0.14, 0.2, d, 0, 0.07);
    box(t, M(ms, mT(0.5, 0.78, -0.08)), 0.08, 0.1, 0.06, d, 0, 0.05); box(t, M(ms, mT(0.5, 0.78, 0.08)), 0.08, 0.1, 0.06, d, 0, 0.05);
    box(t, M(ms, mT(0.56, 0.66, -0.07)), 0.03, 0.04, 0.04, hex('#ff4040'), 0.8, 0); box(t, M(ms, mT(0.56, 0.66, 0.07)), 0.03, 0.04, 0.04, hex('#ff4040'), 0.8, 0);
    for (const [x, z, ph] of [[0.3, -0.12, 0], [0.3, 0.12, Math.PI], [-0.3, -0.12, Math.PI], [-0.3, 0.12, 0]]) box(t, M(ms, mT(x, 0.45, z), mRZ(Math.sin((o.anim || 0) + ph) * (o.moving ? 0.6 : 0))), 0.12, 0.45, 0.12, d, 0, -0.22);
    box(t, M(ms, mT(-0.45, 0.6, 0), mRZ(0.6 + sw * 0.3)), 0.35, 0.08, 0.08, d, 0, 0);
  }
  function creature(t, m, e, V) {
    const d = G.ENEMIES[e.t]; const col = hex(d.col); const anim = nowT * 8 + e.id; const moving = e.st === 'chase' || e.st === 'charge' || e.st === 'lunge' || e.st === 'circle';
    const isWind = /wind$/.test(e.st); const wob = isWind ? 1 + Math.sin(nowT * 25) * 0.05 : 1;
    const fm = M(m, mS(wob)); const flash = e.flash ? [1, 1, 1] : null; const C = (c) => flash ? [1, 1, 1] : c;
    switch (e.t) {
      case 'slime': case 'slime_small': { const r = e.t === 'slime' ? 0.45 : 0.25; const b = Math.abs(Math.sin(nowT * 5 + e.id)); sph(t, M(fm, mT(0, r * 0.7 + b * 0.15, 0), mS(1 + b * 0.1, 0.7 + b * 0.25, 1 + b * 0.1)), r, 7, 4, C(col), e.flash ? 1 : 0.15); box(t, M(fm, mT(r * 0.7, r * 0.8, -r * 0.3)), 0.06, 0.1, 0.08, hex('#14121a'), 0, 0); box(t, M(fm, mT(r * 0.7, r * 0.8, r * 0.3)), 0.06, 0.1, 0.08, hex('#14121a'), 0, 0); break; }
      case 'goblin': humanoid(t, fm, { h: 0.95, body: C(col), skin: C(hex('#7aa040')), legcol: hex('#4a5a20'), anim, moving, ears: true, held: 'sword_wood', swing: e.st === 'wind' ? 0.2 : (e.st === 'cool' ? 0.8 : null) }); break;
      case 'goblin_archer': humanoid(t, fm, { h: 0.95, body: C(col), skin: C(hex('#7aa040')), legcol: hex('#4a5a20'), anim, moving, ears: true, hair: hex('#4a3020'), held: 'bow_wood' }); break;
      case 'skeleton': humanoid(t, fm, { h: 1.15, body: C(hex('#e8e8e0')), skin: C(hex('#f0f0e8')), legcol: hex('#d0d0c8'), anim, moving, held: 'sword_stone', shield: true, swing: e.st === 'wind' ? 0.2 : (e.st === 'cool' ? 0.8 : null) }); break;
      case 'wolf': quadruped(t, fm, { col: C(col), anim, moving }); break;
      case 'wolf_pet': quadruped(t, fm, { col: C(col), anim, moving }); box(t, M(fm, mT(0.45, 0.6, 0)), 0.36, 0.06, 0.3, hex('#ff4040'), 0, 0); break;
      case 'treant': { const arm = e.st === 'wind' ? -2.4 : 0.3; cyl(t, fm, 0.5, 0.35, 1.6, 7, C(hex('#5a3a20'))); for (const s of [-1, 1]) cyl(t, M(fm, mT(0, 1.3, s * 0.45), mRX(s * (Math.PI / 2 - arm * 0.5)), mRZ(arm)), 0.12, 0.08, 1.1, 5, C(hex('#6b4426'))); sph(t, M(fm, mT(0, 2.1, 0)), 0.85, 7, 4, C(col), 0, 0.8); sph(t, M(fm, mT(0.3, 2.5, 0.2)), 0.5, 6, 3, C(sh(col, 1.2))); box(t, M(fm, mT(0.42, 1.2, -0.15)), 0.08, 0.12, 0.1, hex('#ffe040'), 1, 0); box(t, M(fm, mT(0.42, 1.2, 0.15)), 0.08, 0.12, 0.1, hex('#ffe040'), 1, 0); for (const s of [-1, 1]) box(t, M(fm, mT(-0.1, 0, s * 0.35)), 0.5, 0.25, 0.25, C(hex('#4a2a18')), 0, 0.12); break; }
      case 'crawler': { for (let i = 0; i < 4; i++) { const ph = anim + i * 0.9; sph(t, M(fm, mT(-i * 0.3 + 0.35, 0.28 + Math.abs(Math.sin(ph)) * 0.08, Math.sin(ph) * 0.05)), 0.26 - i * 0.03, 6, 4, i % 2 ? C(col) : C(sh(col, 0.6)), e.flash ? 1 : (i % 2 ? 0.6 : 0.1)); for (const s of [-1, 1]) box(t, M(fm, mT(-i * 0.3 + 0.35, 0.15, s * 0.3), mRX(s * 0.6), mRZ(Math.sin(ph) * 0.5)), 0.06, 0.3, 0.06, C(sh(col, 0.5)), 0, -0.1); } box(t, M(fm, mT(0.55, 0.42, -0.1)), 0.06, 0.08, 0.08, hex('#ffe040'), 1, 0); box(t, M(fm, mT(0.55, 0.42, 0.1)), 0.06, 0.08, 0.08, hex('#ffe040'), 1, 0); break; }
      case 'bat': { const fl = Math.sin(nowT * 18 + e.id); const bm = M(fm, mT(0, 1.3 + Math.sin(nowT * 6 + e.id) * 0.15, 0)); box(t, bm, 0.22, 0.2, 0.18, C(col), 0, 0); for (const s of [-1, 1]) quad(t, M(bm, mT(0, 0.05, s * 0.09), mRX(s * fl * 0.9)), [-0.12, 0, 0], [0.12, 0, 0], [0.05, 0.05, s * 0.5], [-0.15, 0.05, s * 0.5], C(sh(col, 0.9)), 0); box(t, M(bm, mT(0.11, 0.05, -0.05)), 0.02, 0.04, 0.03, hex('#ff4040'), 1, 0); box(t, M(bm, mT(0.11, 0.05, 0.05)), 0.02, 0.04, 0.03, hex('#ff4040'), 1, 0); break; }
      case 'tentacle': { const sway = Math.sin(nowT * 2 + e.id) * 0.25; let mm = M(fm, mT(0, -0.3, 0)); for (let i = 0; i < 5; i++) { cyl(t, mm, 0.32 - i * 0.05, 0.28 - i * 0.05, 0.5, 6, C(i % 2 ? col : sh(col, 1.2))); mm = M(mm, mT(0, 0.5, 0), mRZ(sway * (e.st === 'wind' ? 2.5 : 1)), mRX(sway * 0.5)); for (const k of [0.3, -0.3]) box(t, M(mm, mT(k, 0.1, 0.2)), 0.08, 0.08, 0.04, hex('#80c0ff'), 0.6, 0); } break; }
      case 'gronk': humanoid(t, fm, { h: 2.6, body: C(hex('#6a8a40')), skin: C(hex('#8aa050')), legcol: hex('#4a4a30'), anim, moving, held: 'hammer_gold', swing: e.st === 'wind' ? 0.15 : (e.st === 'cool' ? 0.75 : null), ears: true }); break;
      case 'hollow': humanoid(t, fm, { h: 2.2, body: C(hex('#202048')), skin: C(hex('#e8e8e0')), legcol: hex('#101030'), anim, moving, crown: true, held: 'sword_obsidian', swing: e.st === 'wind' ? 0.15 : (e.st === 'cool' ? 0.75 : null) }); quad(t, M(fm, mT(-0.3, 1.9, 0)), [0, 0, -0.4], [0, 0, 0.4], [-0.4 + Math.sin(nowT * 3) * 0.1, -1.8, 0.5], [-0.4 + Math.sin(nowT * 3) * 0.1, -1.8, -0.5], C(hex('#2a2a60')), 0); break;
      case 'cinder': { for (let i = 0; i < 6; i++) { const ph = anim * 0.6 + i * 0.8; sph(t, M(fm, mT(-i * 0.75 + 1.5, 0.6 + Math.abs(Math.sin(ph)) * 0.25, Math.sin(ph) * 0.15)), 0.7 - i * 0.06, 7, 4, i % 2 ? C(col) : C(sh(col, 0.55)), e.flash ? 1 : (i % 2 ? 0.7 : 0.15)); } sph(t, M(fm, mT(1.9, 0.9, 0)), 0.75, 7, 4, C(sh(col, 1.1)), e.flash ? 1 : 0.5); box(t, M(fm, mT(2.5, 1.1, -0.25)), 0.15, 0.2, 0.2, hex('#ffe040'), 1, 0); box(t, M(fm, mT(2.5, 1.1, 0.25)), 0.15, 0.2, 0.2, hex('#ffe040'), 1, 0); for (let k = 0; k < 4; k++) cyl(t, M(fm, mT(2.5, 0.55, (k - 1.5) * 0.25), mRX(Math.PI)), 0.07, 0, 0.3, 4, hex('#fff')); break; }
      case 'leviathan': { const bob = Math.sin(nowT * 1.5) * 0.15; const bm = M(fm, mT(0, -1.0 + bob, 0)); sph(t, bm, 2.2, 8, 5, C(col), 0, 0.75); sph(t, M(bm, mT(0.6, 1.0, 0)), 1.5, 8, 5, C(sh(col, 1.3)), 0, 0.7); box(t, M(bm, mT(1.8, 1.4, -0.7)), 0.4, 0.5, 0.5, hex('#ffe040'), 1, 0); box(t, M(bm, mT(1.8, 1.4, 0.7)), 0.4, 0.5, 0.5, hex('#ffe040'), 1, 0); for (let k = 0; k < 7; k++) cyl(t, M(bm, mT(2.0, 0.6, (k - 3) * 0.35), mRX(Math.PI)), 0.1, 0, 0.5, 4, hex('#e0f0ff')); for (let k = 0; k < 6; k++) { const a = k * 1.05 + nowT * 0.3; let mm = M(bm, mT(Math.cos(a) * 2.0, 0.2, Math.sin(a) * 2.0)); for (let i = 0; i < 4; i++) { cyl(t, mm, 0.3 - i * 0.06, 0.25 - i * 0.06, 0.8, 5, C(sh(col, 0.9))); mm = M(mm, mT(0, 0.8, 0), mRX(Math.sin(nowT * 2 + k + i) * 0.35), mRZ(Math.cos(nowT * 1.7 + k) * 0.3)); } } break; }
      default: humanoid(t, fm, { h: 1, body: C(col), anim, moving });
    }
  }

  // ================= terrain & static object chunks =================
  function buildChunk(world, cxI, cyI) {
    const t = { arr: new Float32Array(CH * CH * 6 * VF), n: 0 }, w = { arr: new Float32Array(CH * CH * 6 * VF), n: 0 }, ob = { arr: new Float32Array(VF * 3 * 4000), n: 0 };
    const I = m4();
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const X = cxI * CH + tx, Y = cyI * CH + ty; if (X >= W || Y >= W) continue;
      const tile = world.tiles[Y * W + X]; const info = G.TILE_INFO[tile];
      const h00 = cornerH(world, X, Y), h10 = cornerH(world, X + 1, Y), h01 = cornerH(world, X, Y + 1), h11 = cornerH(world, X + 1, Y + 1);
      const r = h2(X, Y); let col = sh(hex(info.col), 0.93 + r * 0.14);
      const em = tile === T.LAVA ? 1.0 : 0;
      // GL: (x, up, z) with z = sim y. Two triangles per tile, each its own normal (flat shaded low-poly).
      const a = [X, h00, Y], b = [X + 1, h10, Y], c = [X + 1, h11, Y + 1], d = [X, h01, Y + 1];
      if ((X + Y) % 2) { tri(t, I, a, c, b, col, em, [X + .5, -100, Y + .5]); tri(t, I, a, d, c, sh(col, 0.96), em, [X + .5, -100, Y + .5]); }
      else { tri(t, I, a, d, b, col, em, [X + .5, -100, Y + .5]); tri(t, I, b, d, c, sh(col, 0.96), em, [X + .5, -100, Y + .5]); }
      // flip: terrain normals must face up
      for (let k = t.n - 6; k < t.n; k++) { const o = k * VF; if (t.arr[o + 4] < 0) { t.arr[o + 3] *= -1; t.arr[o + 4] *= -1; t.arr[o + 5] *= -1; } }
      if (tile <= T.WATER) { const wc = tile === T.DEEP ? [0.12, 0.3, 0.6] : [0.22, 0.5, 0.8]; quad(w, I, [X, WATER_Y, Y], [X, WATER_Y, Y + 1], [X + 1, WATER_Y, Y + 1], [X + 1, WATER_Y, Y], wc, 0.05, [X + .5, -100, Y + .5]); }
      // static object
      const o = world.objs.get(Y * W + X); if (o) staticObject(ob, world, o, X, Y);
    }
    const mk = (src) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, src.arr.subarray(0, src.n * VF), gl.STATIC_DRAW); return b; };
    return { vbo: mk(t), n: t.n, wvbo: mk(w), wn: w.n, obo: mk(ob), on: ob.n };
  }
  function staticObject(t, world, o, X, Y) {
    const d = O[o.t]; const gz = R.groundZ(world, X + .5, Y + .5); const rot = h2(X + 3, Y + 7) * 6.283;
    let name = o.t; if (o.stub) name = 'stub'; else if (d.door && !o.closed) name = 'door_open';
    const p = PF[name]; if (!p) return;
    const scale = d.tall ? 0.9 + h2(X, Y + 9) * 0.35 : 1;
    const m = M(mT(X + .5, gz - 0.02, Y + .5), mRY((d.built || d.altar || d.boat || d.isChest) ? 0 : rot), mS(scale));
    inst(t, p, m);
  }
  function chunk(world, cxI, cyI) { const k = cxI + ',' + cyI; return chunks[k] || (chunks[k] = buildChunk(world, cxI, cyI)); }
  function dropChunk(k) { const c = chunks[k]; if (!c) return; gl.deleteBuffer(c.vbo); gl.deleteBuffer(c.wvbo); gl.deleteBuffer(c.obo); delete chunks[k]; }
  R.dirtyTile = (i) => { const X = i % W, Y = Math.floor(i / W); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) dropChunk(Math.floor((X + ox) / CH) + ',' + Math.floor((Y + oy) / CH)); };
  R.resetWorld = () => { for (const k in chunks) dropChunk(k); miniBase = null; };
  // the client/host mutate world.objs directly; detect changes cheaply by hashing object state per chunk each frame
  const chunkSig = {};
  function checkChunkDirty(world, cxI, cyI) {
    let sig = 0; const x0 = cxI * CH, y0 = cyI * CH;
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) { const X = x0 + tx, Y = y0 + ty; if (X >= W || Y >= W) continue; const o = world.objs.get(Y * W + X); if (o) sig = (sig * 31 + (G.OBJ_IDX[o.t] + 1) * 7 + (o.stub ? 3 : 0) + (o.closed ? 5 : 0) + tx * 13 + ty * 17) | 0; }
    const k = cxI + ',' + cyI; if (chunkSig[k] !== undefined && chunkSig[k] !== sig) dropChunk(k); chunkSig[k] = sig;
  }

  function bindAttribs(p) {
    const st = VF * 4;
    gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(p.a.aNrm); gl.vertexAttribPointer(p.a.aNrm, 3, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(p.a.aCol); gl.vertexAttribPointer(p.a.aCol, 3, gl.FLOAT, false, st, 24);
    gl.enableVertexAttribArray(p.a.aEm); gl.vertexAttribPointer(p.a.aEm, 1, gl.FLOAT, false, st, 36);
  }

  // ================= events -> fx =================
  R.event = function (ev, me) {
    const F = R.fx;
    switch (ev.t) {
      case 'dmg': F.floats.push({ x: ev.x + (Math.random() - .5) * 0.4, y: ev.y + 0.6, z: 1.5, s: String(ev.v), c: ev.c, t: 0, big: ev.crit }); break;
      case 'txt': if (!ev.to || ev.to === me) F.floats.push({ x: ev.x, y: ev.y + 0.8, z: 1.6, s: ev.s, c: ev.c, t: 0, small: ev.small }); break;
      case 'hit': for (let i = 0; i < ev.n; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.8, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, vz: Math.random() * 3, c: hex(ev.c), t: 0, life: 0.4 + Math.random() * 0.3, g: 9 }); break;
      case 'die': for (let i = 0; i < 18; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.6, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: Math.random() * 5, c: i % 3 ? hex(ev.c) : [1, 1, 1], t: 0, life: 0.5 + Math.random() * 0.5, g: 10, sz: 0.14 }); break;
      case 'boom': F.booms.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, c: ev.c || '#ffb040' }); for (let i = 0; i < 16; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.5, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, vz: Math.random() * 4, c: hex(ev.c || '#ffb040'), t: 0, life: 0.45, g: 4, sz: 0.16, e: 1 }); break;
      case 'zap': F.zaps.push({ x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0 }); break;
      case 'slash': F.slashes.push({ x: ev.x, y: ev.y, a: ev.a, r: ev.r, t: 0 }); break;
      case 'target': F.targets.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, d: ev.d }); break;
      case 'ping': F.pings.push({ x: ev.x, y: ev.y, col: ev.col, name: ev.name, t: 0 }); break;
      case 'dust': for (let i = 0; i < 6; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.1, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, vz: 1, c: [0.8, 0.75, 0.6], t: 0, life: 0.35, g: 2 }); break;
      case 'fire': F.parts.push({ x: ev.x + (Math.random() - .5) * 0.4, y: ev.y + (Math.random() - .5) * 0.4, z: 0.6, vx: 0, vy: 0, vz: 1.5, c: Math.random() < 0.5 ? [1, 0.42, 0.1] : [1, 0.82, 0.25], t: 0, life: 0.4, g: -3, e: 1 }); break;
      case 'shake': if (!ev.id || ev.id === me) R.shake = Math.max(R.shake, ev.v); break;
      case 'hitstop': if (ev.to === me) R.hitstop = 0.05; break;
      case 'wobble': F.wobble[ev.i] = 0.25; break;
      case 'tell': R.tellFlash[ev.id] = 0.3; break;
    }
  };

  // ================= frame =================
  R.frame = function (V, dt, L) {
    if (!gl) return;
    const me = V.players[V.me]; const world = V.world; nowT = V.now;
    if (R.hitstop > 0) R.hitstop -= dt;
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 18);
    if (me) { R.cam.x = me.x; R.cam.y = me.y; R.cam.z = R.groundZ(world, me.x, me.y) + (me.downed ? 0.35 : EYE) + (L.jumpZ || 0) + (L.bob || 0); }
    R.cam.yaw = L.yaw; R.cam.pitch = L.pitch;
    const shx = (Math.random() - .5) * R.shake * 0.01, shy = (Math.random() - .5) * R.shake * 0.01;
    const yaw = R.cam.yaw + shx, pitch = G.clamp(R.cam.pitch + shy, -1.5, 1.5);
    const fx = Math.cos(yaw) * Math.cos(pitch), fz = Math.sin(pitch), fy = Math.sin(yaw) * Math.cos(pitch);
    const fov = (L.sprinting ? 80 : 74) * Math.PI / 180;
    perspective(proj, fov, R.W / R.H, 0.05, 80);
    lookAt(view, R.cam.x, R.cam.z, R.cam.y, fx, fz, fy);
    vp = mmul(proj, view);
    // sky state
    const darkness = G.Sim.darkness({ time: V.time }); const night = G.clamp(darkness / 0.9, 0, 1);
    const dusk = V.time > G.DUSK_AT - 25 && V.time < G.NIGHT_AT ? G.clamp(1 - Math.abs((V.time - (G.DUSK_AT + 5)) / 25), 0, 1) : (V.time < 25 ? G.clamp(1 - Math.abs((V.time - 12) / 14), 0, 1) : 0);
    const sa = Math.PI * (0.02 + (V.time / G.NIGHT_AT) * 0.96); sunDir = [Math.cos(sa) * 0.8, Math.max(0.02, Math.sin(sa)), 0.5]; { const l = Math.hypot(...sunDir); sunDir = sunDir.map(v => v / l); }
    const ma = Math.PI * (0.1 + G.clamp((V.time - G.NIGHT_AT) / (G.DAY_LEN - G.NIGHT_AT), 0, 1) * 0.8); moonDir = [-Math.cos(ma) * 0.7, Math.sin(ma), -0.6]; { const l = Math.hypot(...moonDir); moonDir = moonDir.map(v => v / l); }
    const sunStr = (1 - night) * G.clamp(sunDir[1] * 2.2, 0.15, 1) * 0.85;
    sunCol = [sunStr * (1 - dusk * 0.1), sunStr * (0.95 - dusk * 0.3), sunStr * (0.85 - dusk * 0.5)];
    ambient = G.lerp(0.55, 0.16, night) - dusk * 0.08;
    const dayFog = [0.74, 0.83, 0.93], duskFog = [0.9, 0.6, 0.45], nightFog = [0.05, 0.06, 0.13];
    fog = dayFog.map((c, i) => G.lerp(G.lerp(c, duskFog[i], dusk), nightFog[i], night));
    // lights
    lights = [];
    const cx0 = Math.floor(R.cam.x), cy0 = Math.floor(R.cam.y);
    for (let ty = cy0 - 24; ty <= cy0 + 24; ty++) for (let tx = cx0 - 24; tx <= cx0 + 24; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= W) continue; const i = ty * W + tx; const o = world.objs.get(i);
      if (o && O[o.t].light && !o.stub) lights.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + (o.t === 'torch' ? 0.9 : 0.5), r: O[o.t].light * 1.5, c: o.t === 'furnace' || o.t === 'cauldron' ? [0.9, 0.5, 0.3] : [1, 0.68, 0.32] });
      if (world.tiles[i] === T.LAVA && (tx + ty) % 3 === 0) lights.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + 0.3, r: 3, c: [1, 0.4, 0.1] });
    }
    for (const id in V.players) { const p = V.players[id]; if (p.dead) continue; const it = p.inv[p.held]; const gz = R.groundZ(world, p.x, p.y); if (it && it.id === 'torch_hand') lights.push({ x: p.x, y: p.y, z: gz + 1.1, r: 6, c: [1, 0.7, 0.35] }); else if (night > 0.3) lights.push({ x: p.x, y: p.y, z: gz + 0.9, r: 2.5, c: [0.3, 0.33, 0.45] }); }
    for (const pr of V.projs) if (pr.type === 'glob') lights.push({ x: pr.x, y: pr.y, z: 0.9, r: 2, c: [1, 0.45, 0.1] });
    for (const p of V.puddles) lights.push({ x: p.x, y: p.y, z: R.groundZ(world, p.x, p.y) + 0.2, r: 2.2, c: [1, 0.4, 0.1] });
    for (const e of V.enemies) if (e.t === 'crawler' || e.t === 'cinder') lights.push({ x: e.x, y: e.y, z: R.groundZ(world, e.x, e.y) + 0.5, r: e.t === 'cinder' ? 6 : 3, c: [1, 0.45, 0.15] });
    lights.sort((a, b) => G.dist(a.x, a.y, R.cam.x, R.cam.y) - G.dist(b.x, b.y, R.cam.x, R.cam.y)); lights = lights.slice(0, 16);
    const lp = new Float32Array(64), lc = new Float32Array(48);
    lights.forEach((l, i) => { const flick = 1 + Math.sin(nowT * 9 + l.x * 7 + l.y * 3) * 0.07; lp[i * 4] = l.x; lp[i * 4 + 1] = l.z; lp[i * 4 + 2] = l.y; lp[i * 4 + 3] = l.r * flick; lc[i * 3] = l.c[0]; lc[i * 3 + 1] = l.c[1]; lc[i * 3 + 2] = l.c[2]; });

    // ---- sky ----
    gl.clearColor(fog[0], fog[1], fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.depthMask(false); gl.useProgram(skyProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.enableVertexAttribArray(skyProg.a.aP); gl.vertexAttribPointer(skyProg.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(skyProg.u.uRight, camBasis.r); gl.uniform3fv(skyProg.u.uUp, camBasis.u); gl.uniform3fv(skyProg.u.uFwd, camBasis.f);
    gl.uniform3f(skyProg.u.uSunDir, sunDir[0], sunDir[1], sunDir[2]); gl.uniform3f(skyProg.u.uMoonDir, moonDir[0], moonDir[1], moonDir[2]);
    gl.uniform1f(skyProg.u.uTanH, Math.tan(fov / 2)); gl.uniform1f(skyProg.u.uAspect, R.W / R.H); gl.uniform1f(skyProg.u.uDusk, dusk); gl.uniform1f(skyProg.u.uNight, night); gl.uniform1f(skyProg.u.uTime, nowT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.depthMask(true);
    // ---- world ----
    gl.useProgram(prog);
    gl.uniformMatrix4fv(prog.u.uVP, false, vp); gl.uniform3f(prog.u.uCam, R.cam.x, R.cam.z, R.cam.y); gl.uniform1f(prog.u.uAmb, ambient); gl.uniform1f(prog.u.uTime, nowT); gl.uniform1f(prog.u.uWater, 0);
    gl.uniform3f(prog.u.uSunDir, sunDir[0], sunDir[1], sunDir[2]); gl.uniform3fv(prog.u.uSunCol, sunCol);
    gl.uniform4fv(prog.u.uLights, lp); gl.uniform3fv(prog.u.uLightCol, lc); gl.uniform1i(prog.u.uNL, lights.length);
    gl.uniform3fv(prog.u.uFog, fog); gl.uniform1f(prog.u.uAlpha, 1);
    gl.disable(gl.BLEND);
    const ccx = Math.floor(R.cam.x / CH), ccy = Math.floor(R.cam.y / CH); const vis = [];
    for (let cy = ccy - 3; cy <= ccy + 3; cy++) for (let cX = ccx - 3; cX <= ccx + 3; cX++) {
      if (cX < 0 || cy < 0 || cX * CH >= W || cy * CH >= W) continue;
      // frustum-ish cull: skip chunks fully behind the camera
      const dx = (cX + .5) * CH - R.cam.x, dy = (cy + .5) * CH - R.cam.y; if (dx * Math.cos(yaw) + dy * Math.sin(yaw) < -CH * 1.2) continue;
      checkChunkDirty(world, cX, cy);
      const c = chunk(world, cX, cy); vis.push(c);
      gl.bindBuffer(gl.ARRAY_BUFFER, c.vbo); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, c.n);
      if (c.on && Math.abs(cX - ccx) <= 2 && Math.abs(cy - ccy) <= 2) { gl.bindBuffer(gl.ARRAY_BUFFER, c.obo); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, c.on); }
    }
    // ---- dynamic ----
    dyn.n = 0; buildDynamic(V, me, L);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn.arr.subarray(0, dyn.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, dyn.n);
    // ---- water ----
    gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(prog.u.uWater, 1); gl.uniform1f(prog.u.uAlpha, 0.75);
    for (const c of vis) { if (!c.wn) continue; gl.bindBuffer(gl.ARRAY_BUFFER, c.wvbo); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, c.wn); }
    gl.uniform1f(prog.u.uWater, 0); gl.uniform1f(prog.u.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
    // ---- first-person arms (drawn last, depth cleared so they never clip into walls) ----
    if (me && !me.dead && !me.downed) { gl.clear(gl.DEPTH_BUFFER_BIT); dyn.n = 0; buildHands(me, L); gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn.arr.subarray(0, dyn.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); }
    drawOverlay(V, me, dt, L, darkness);
    drawMinimap(V);
  };

  function buildDynamic(V, me, L) {
    const t = dyn, world = V.world, F = R.fx;
    // drops
    for (const d of V.drops) { const gz = R.groundZ(world, d.x, d.y); const bob = Math.sin(nowT * 3 + d.id) * 0.05; itemMesh(t, M(mT(d.x, gz + 0.2 + bob, d.y), mRY(nowT * 1.5 + d.id), mRZ(0.5)), d.item, true); }
    // enemies
    for (const e of V.enemies) {
      if (e.hidden) continue; const gz = R.groundZ(world, e.x, e.y); const zoff = e.t === 'leviathan' ? -0.6 : 0;
      creature(t, M(mT(e.x, gz + zoff, e.y), mRY(e.face), mS(e.stun ? 1 : 1)), e, V);
      if (e.burn) F.parts.push({ x: e.x + (Math.random() - .5) * 0.6, y: e.y + (Math.random() - .5) * 0.6, z: gz + 0.5, vx: 0, vy: 0, vz: 1.5, c: [1, 0.42, 0.1], t: 0, life: 0.3, g: -3, e: 1 });
      if (e.st === 'charge' || e.st === 'lunge') for (let i = 0; i < 2; i++) F.parts.push({ x: e.x, y: e.y, z: gz + 0.1, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, vz: 1, c: [0.8, 0.75, 0.6], t: 0, life: 0.3, g: 0 });
    }
    // other players
    for (const id in V.players) {
      const p = V.players[id]; if (p.dead || p === me) continue; const gz = R.groundZ(world, p.x, p.y);
      const it = p.inv[p.held]; const col = hex(p.col);
      const o = { h: 1.2, body: p.flash ? [1, 1, 1] : col, skin: hex('#f0c8a0'), hair: hex('#5a3a20'), anim: p.anim * Math.PI, moving: p.moving, held: it ? it.id : null, swing: p.swing ? p.swing.t / p.swing.dur : null, block: p.blocking, chest: p.armor.chest ? hex(G.ITEMS[p.armor.chest].col) : null, helm: p.armor.head ? hex(G.ITEMS[p.armor.head].col) : null, legcol: p.armor.legs ? hex(G.ITEMS[p.armor.legs].col) : hex('#3a3040') };
      if (p.downed) humanoid(t, M(mT(p.x, gz + 0.15, p.y), mRY(p.face), mRZ(1.5)), o); else humanoid(t, M(mT(p.x, gz, p.y), mRY(p.face)), o);
    }
    // projectiles
    for (const pr of V.projs) {
      const a = pr.a !== undefined ? pr.a : Math.atan2(pr.vy, pr.vx); const z = R.groundZ(world, pr.x, pr.y) + 0.9;
      if (pr.type === 'arrow') box(t, M(mT(pr.x, z, pr.y), mRY(a)), 0.7, 0.04, 0.04, [0.85, 0.78, 0.65], 0.2, 0);
      else if (pr.type === 'glob') sph(t, M(mT(pr.x, z - 0.1, pr.y)), 0.16, 5, 3, [1, 0.45, 0.1], 1.0);
      else inst(t, PF.rock, M(mT(pr.x, z - 0.4, pr.y), mRY(nowT * 4), mS(0.8)));
    }
    // puddles
    for (const p of V.puddles) { const gz = R.groundZ(world, p.x, p.y); cyl(t, M(mT(p.x, gz + 0.03, p.y)), p.r, p.r * 0.9, 0.04, 8, [1, 0.4, 0.1], 1.0); }
    // particles
    for (const p of F.parts) { const sz = p.sz || 0.08; box(t, M(mT(p.x, p.z, p.y), mRY(p.t * 5)), sz, sz, sz, p.c, p.e ? 1 : 0.35, 0); }
    // fire particles for campfires/torches in view
    const cx0 = Math.floor(R.cam.x), cy0 = Math.floor(R.cam.y);
    for (let ty = cy0 - 14; ty <= cy0 + 14; ty++) for (let tx = cx0 - 14; tx <= cx0 + 14; tx++) { if (tx < 0 || ty < 0 || tx >= W || ty >= W) continue; const o = world.objs.get(ty * W + tx); if (!o) continue; if (o.t === 'campfire' && Math.random() < 0.3) F.parts.push({ x: tx + .5 + (Math.random() - .5) * 0.3, y: ty + .5 + (Math.random() - .5) * 0.3, z: R.groundZ(world, tx + .5, ty + .5) + 0.6, vx: 0, vy: 0, vz: 1.4, c: Math.random() < 0.5 ? [1, 0.42, 0.1] : [1, 0.82, 0.25], t: 0, life: 0.5, g: -2, e: 1, sz: 0.1 }); else if (o.t === 'torch' && Math.random() < 0.15) F.parts.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + 1.0, vx: 0, vy: 0, vz: 1.2, c: [1, 0.7, 0.2], t: 0, life: 0.35, g: -2, e: 1, sz: 0.06 }); }
    // build ghost
    if (L.ghost) { const g = L.ghost; const gz = R.groundZ(world, g.tx + .5, g.ty + .5); const col = g.ok ? [0.4, 1, 0.4] : [1, 0.35, 0.35]; box(t, M(mT(g.tx + .5, gz + 0.02, g.ty + .5)), 0.96, 0.03, 0.96, col, 1.0); const p = PF[g.obj]; if (p) { const tmp = { arr: new Float32Array(p.length), n: 0 }; inst(tmp, p, M(mT(g.tx + .5, gz, g.ty + .5))); for (let i = 0; i < tmp.n; i++) { const o = i * VF; tmp.arr[o + 6] = (tmp.arr[o + 6] + col[0]) / 2; tmp.arr[o + 7] = (tmp.arr[o + 7] + col[1]) / 2; tmp.arr[o + 8] = (tmp.arr[o + 8] + col[2]) / 2; tmp.arr[o + 9] = 0.6; } grow(t, tmp.n); t.arr.set(tmp.arr.subarray(0, tmp.n * VF), t.n * VF); t.n += tmp.n; } }
    // pings: tall beacon
    for (const p of F.pings) { const gz = R.groundZ(world, p.x, p.y); cyl(t, M(mT(p.x, gz, p.y)), 0.12, 0.05, 8, 5, hex(p.col), 1.0); }
  }

  function buildHands(me, L) {
    // camera-space rig: right = camBasis.r, up = camBasis.u, fwd = camBasis.f
    const b = camBasis; const C = m4();
    C[0] = b.r[0]; C[1] = b.r[1]; C[2] = b.r[2]; C[4] = b.u[0]; C[5] = b.u[1]; C[6] = b.u[2]; C[8] = b.f[0]; C[9] = b.f[1]; C[10] = b.f[2];
    C[12] = R.cam.x; C[13] = R.cam.z; C[14] = R.cam.y;
    const bob = (L.bob || 0) * 0.6, sway = Math.sin((L.walkT || 0) * 0.5) * 0.01;
    const it = me.inv[me.held]; const d = it ? G.ITEMS[it.id] : null;
    let swing = me.swing ? me.swing.t / me.swing.dur : 0; const sw = Math.sin(swing * Math.PI);
    // right arm: hand sits low and forward; forearm runs back toward the shoulder
    let hand = M(C, mT(0.36 + sway, -0.36 + bob, 0.82), mRX(-0.15));
    if (me.swing) hand = M(C, mT(0.36 + sway - sw * 0.3, -0.36 + bob + sw * 0.28, 0.82 + sw * 0.1), mRX(-0.15 - sw * 1.3), mRZ(sw * 0.7));
    if (me.blocking) hand = M(C, mT(0.12, -0.2 + bob, 0.7), mRX(-0.1), mRY(-0.3));
    if (d && d.type === 'bow') { const pull = me.draw ? Math.min(1, me.draw / d.draw) : 0; hand = M(C, mT(0.02, -0.22 + bob, 0.8 + pull * 0.05), mRX(-0.15), mRY(1.3), mRZ(-0.2)); }
    const skin = hex('#f0c8a0'), sleeve = hex(me.col);
    box(dyn, M(hand, mT(0.04, -0.05, -0.3), mRX(0.12), mRY(-0.15)), 0.1, 0.1, 0.6, sleeve, 0, 0);
    box(dyn, hand, 0.11, 0.11, 0.11, skin, 0, 0);
    if (it) {
      if (d.type === 'weapon' || d.type === 'tool') itemMesh(dyn, M(hand, mT(0, 0.04, 0.02), mRX(-0.75), mRZ(0.35)), it.id, false);
      else if (d.type === 'bow') itemMesh(dyn, M(hand, mT(0, 0, 0), mRY(0.2)), it.id, false);
      else if (d.type === 'shield') itemMesh(dyn, M(hand, mT(0, 0.1, 0.08), mRY(0.1)), it.id, false);
      else if (it.id === 'torch_hand') itemMesh(dyn, M(hand, mT(0, -0.08, 0.04), mRX(-0.3), mS(0.6)), it.id, false);
      else if (d.type === 'place') itemMesh(dyn, M(hand, mT(0, 0.08, 0.06), mRY(nowT * 0.6), mS(0.6)), it.id, true);
      else itemMesh(dyn, M(hand, mT(0, 0.1, 0.05), mRY(nowT * 0.5)), it.id, true);
      if (d.type === 'bow' && me.draw > 0) {
        const lh = M(C, mT(0.28 - Math.min(1, me.draw / d.draw) * 0.28, -0.22 + bob, 0.7)); box(dyn, lh, 0.11, 0.11, 0.11, skin, 0, 0); box(dyn, M(lh, mT(0, -0.05, -0.25), mRX(0.3)), 0.1, 0.1, 0.4, sleeve, 0, 0); itemMesh(dyn, M(lh, mT(0, 0.02, 0.3), mRX(1.57)), 'arrow', false);
      }
    }
    // left hand when blocking or bare-handed
    if (!it || me.blocking) { const lh = M(C, mT(-0.36 - sway, -0.38 + bob, 0.8), mRX(-0.15)); box(dyn, M(lh, mT(-0.04, -0.05, -0.3), mRX(0.12), mRY(0.15)), 0.1, 0.1, 0.6, sleeve, 0, 0); box(dyn, lh, 0.11, 0.11, 0.11, skin, 0, 0); }
  }

  // ================= 2D overlay =================
  function drawOverlay(V, me, dt, L, darkness) {
    const F = R.fx; const x = ox; x.clearRect(0, 0, R.W, R.H);
    for (let i = F.parts.length - 1; i >= 0; i--) { const p = F.parts[i]; p.t += dt; if (p.t > p.life) { F.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.g || 0) * dt; }
    for (let i = F.floats.length - 1; i >= 0; i--) { const f = F.floats[i]; f.t += dt; f.z += dt * 0.8; if (f.t > 1.1) F.floats.splice(i, 1); }
    for (const e of V.enemies) {
      if (e.hidden) continue; const d = G.ENEMIES[e.t]; const gz = R.groundZ(V.world, e.x, e.y); const top = R.project(e.x, e.y, gz + (d.boss ? e.r * 3.0 : e.r * 3.0) + 0.3); if (!top) continue;
      const sc = G.clamp(14 / top.d, 0.5, 2.2);
      if (!d.boss && e.hp < e.maxHp) { const w = 26 * sc; x.fillStyle = '#000'; x.fillRect(top.x - w / 2, top.y, w, 3 * sc); x.fillStyle = (e.pet || e.owner) ? '#60ff60' : '#e03030'; x.fillRect(top.x - w / 2, top.y, w * Math.max(0, e.hp / e.maxHp), 3 * sc); }
      if (/wind$/.test(e.st)) { x.fillStyle = Math.floor(nowT * 12) % 2 ? '#ff3030' : '#ffe040'; x.font = 'bold ' + Math.round(18 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('!', top.x, top.y - 4); }
      if (e.stun) { x.fillStyle = '#ffe040'; x.font = Math.round(10 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('* *', top.x, top.y - 4); }
    }
    for (const id in V.players) {
      const p = V.players[id]; if (p.dead || p === me) continue; const gz = R.groundZ(V.world, p.x, p.y); const pt = R.project(p.x, p.y, gz + 1.5); if (!pt) continue;
      const sc = G.clamp(14 / pt.d, 0.5, 2);
      x.font = Math.round(10 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(p.name, pt.x + 1, pt.y + 1); x.fillStyle = p.col; x.fillText(p.name, pt.x, pt.y);
      x.fillStyle = '#000'; x.fillRect(pt.x - 14 * sc, pt.y + 3, 28 * sc, 3 * sc); x.fillStyle = '#e03030'; x.fillRect(pt.x - 14 * sc, pt.y + 3, 28 * sc * Math.max(0, p.hp / p.maxHp), 3 * sc);
      if (p.downed) { x.fillStyle = Math.floor(nowT * 4) % 2 ? '#ff3030' : '#ff9090'; x.fillText('DOWN ' + p.bleed + 's', pt.x, pt.y - 10 * sc); if (p.revive > 0) { x.fillStyle = '#000'; x.fillRect(pt.x - 14 * sc, pt.y + 8, 28 * sc, 3 * sc); x.fillStyle = '#60ff60'; x.fillRect(pt.x - 14 * sc, pt.y + 8, 28 * sc * p.revive / 3, 3 * sc); } }
    }
    for (const f of F.floats) { const pt = R.project(f.x, f.y, f.z); if (!pt) continue; const sc = G.clamp(12 / pt.d, 0.6, 2); x.font = (f.big ? 'bold ' : '') + Math.round((f.big ? 17 : f.small ? 10 : 13) * sc) + 'px monospace'; x.textAlign = 'center'; x.globalAlpha = Math.min(1, 2.2 - f.t * 2); x.fillStyle = '#000'; x.fillText(f.s, pt.x + 1, pt.y + 1); x.fillStyle = f.c; x.fillText(f.s, pt.x, pt.y); }
    x.globalAlpha = 1;
    for (let i = F.booms.length - 1; i >= 0; i--) { const b = F.booms[i]; b.t += dt; if (b.t > 0.35) { F.booms.splice(i, 1); continue; } ring(V, b.x, b.y, b.r * (0.3 + b.t / 0.35 * 0.7), b.c, 1 - b.t / 0.35, 3); }
    for (let i = F.zaps.length - 1; i >= 0; i--) { const z = F.zaps[i]; z.t += dt; if (z.t > 0.15) { F.zaps.splice(i, 1); continue; } const a = R.project(z.x1, z.y1, R.groundZ(V.world, z.x1, z.y1) + 0.6), b = R.project(z.x2, z.y2, R.groundZ(V.world, z.x2, z.y2) + 0.6); if (!a || !b) continue; x.strokeStyle = '#a0d0ff'; x.lineWidth = 2; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo((a.x + b.x) / 2 + (Math.random() - .5) * 12, (a.y + b.y) / 2 + (Math.random() - .5) * 12); x.lineTo(b.x, b.y); x.stroke(); }
    for (let i = F.slashes.length - 1; i >= 0; i--) { const s = F.slashes[i]; s.t += dt; if (s.t > 0.2) { F.slashes.splice(i, 1); continue; } ring(V, s.x + Math.cos(s.a) * s.r * 0.5, s.y + Math.sin(s.a) * s.r * 0.5, s.r * 0.5, '#ff6060', 1 - s.t / 0.2, 2); }
    for (let i = F.targets.length - 1; i >= 0; i--) { const t = F.targets[i]; t.t += dt; if (t.t > t.d) { F.targets.splice(i, 1); continue; } ring(V, t.x, t.y, t.r, '#ff5050', 0.9, 2); ring(V, t.x, t.y, t.r * (t.t / t.d), '#ff5050', 0.6, 2); }
    for (let i = F.pings.length - 1; i >= 0; i--) { const p = F.pings[i]; p.t += dt; if (p.t > 5) { F.pings.splice(i, 1); continue; } const pt = R.project(p.x, p.y, R.groundZ(V.world, p.x, p.y) + 8.3); if (pt) { x.fillStyle = p.col; x.font = '12px monospace'; x.textAlign = 'center'; x.fillText(p.name + ' · ' + Math.round(G.dist(p.x, p.y, R.cam.x, R.cam.y)) + 'm', pt.x, pt.y); } }
    for (const k in F.wobble) { F.wobble[k] -= dt; if (F.wobble[k] <= 0) delete F.wobble[k]; }
    for (const k in R.tellFlash) { R.tellFlash[k] -= dt; if (R.tellFlash[k] <= 0) delete R.tellFlash[k]; }
    // crosshair
    const cx = R.W / 2, cy = R.H / 2; x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 8, cy); x.lineTo(cx - 3, cy); x.moveTo(cx + 3, cy); x.lineTo(cx + 8, cy); x.moveTo(cx, cy - 8); x.lineTo(cx, cy - 3); x.moveTo(cx, cy + 3); x.lineTo(cx, cy + 8); x.stroke();
    if (L.lookingAt) { x.fillStyle = '#fff'; x.font = '12px monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(L.lookingAt, cx + 1, cy + 25); x.fillStyle = '#fff'; x.fillText(L.lookingAt, cx, cy + 24); }
    if (me && me.inv[me.held] && G.ITEMS[me.inv[me.held].id].type === 'bow') { x.fillStyle = '#fff'; x.font = '12px monospace'; x.textAlign = 'right'; x.fillText(G.Sim.count(me, 'arrow') + ' arrows', R.W - 12, R.H - 12); }
    if (me) {
      const hpF = me.hp / me.maxHp; if (me.flash) R.hurt = 0.35; R.hurt = Math.max(0, R.hurt - dt * 1.2);
      const v = Math.max(R.hurt, hpF < 0.3 ? (0.3 - hpF) * 2 * (0.6 + Math.sin(nowT * 6) * 0.3) : 0);
      if (v > 0) { const g = x.createRadialGradient(cx, cy, R.H * 0.3, cx, cy, R.H * 0.8); g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, 'rgba(180,0,0,' + Math.min(0.8, v) + ')'); x.fillStyle = g; x.fillRect(0, 0, R.W, R.H); }
      if (me.downed) { x.fillStyle = 'rgba(60,0,0,0.45)'; x.fillRect(0, 0, R.W, R.H); x.fillStyle = '#ff6060'; x.font = 'bold 24px monospace'; x.textAlign = 'center'; x.fillText('YOU ARE DOWN — ' + me.bleed + 's', cx, cy - 30); x.font = '13px monospace'; x.fillStyle = '#fff'; x.fillText('a teammate can revive you (hold E)', cx, cy - 10); }
      if (me.dark && darkness > 0.8) { x.fillStyle = '#8080ff'; x.font = '13px monospace'; x.textAlign = 'center'; x.fillText('the dark bites… find light', cx, cy + 44); }
    }
    let by = 10;
    for (const e of V.enemies) if (G.ENEMIES[e.t].boss) { const d = G.ENEMIES[e.t]; const w = Math.min(360, R.W - 60); const x0 = (R.W - w) / 2; x.fillStyle = '#000'; x.fillRect(x0 - 2, by - 2, w + 4, 12); x.fillStyle = '#601010'; x.fillRect(x0, by, w, 8); x.fillStyle = '#e03030'; x.fillRect(x0, by, w * Math.max(0, e.hp / e.maxHp), 8); x.fillStyle = '#fff'; x.font = '11px monospace'; x.textAlign = 'center'; x.fillText(d.name, R.W / 2, by + 22); by += 28; }
  }
  function ring(V, wx, wy, r, col, alpha, lw) {
    const x = ox; x.strokeStyle = col; x.globalAlpha = alpha; x.lineWidth = lw; x.beginPath(); let first = true;
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 16) { const px = wx + Math.cos(a) * r, py = wy + Math.sin(a) * r; const pt = R.project(px, py, R.groundZ(V.world, px, py) + 0.05); if (!pt) { first = true; continue; } if (first) { x.moveTo(pt.x, pt.y); first = false; } else x.lineTo(pt.x, pt.y); }
    x.stroke(); x.globalAlpha = 1;
  }

  function drawMinimap(V) {
    const sz = mini.width;
    if (!miniBase) {
      miniBase = document.createElement('canvas'); miniBase.width = W; miniBase.height = W; const mx = miniBase.getContext('2d');
      const img = mx.createImageData(W, W);
      for (let i = 0; i < W * W; i++) { const c = G.TILE_INFO[V.world.tiles[i]].col; const n = parseInt(c.slice(1), 16); img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255; }
      mx.putImageData(img, 0, 0);
    }
    minx.clearRect(0, 0, sz, sz); minx.imageSmoothingEnabled = false;
    minx.drawImage(miniBase, 0, 0, sz, sz);
    const k = sz / W;
    for (const [i, o] of V.world.objs) { const d = O[o.t]; if (d.altar || d.boat || d.station === 'workbench' || d.chest === 3 || o.t === 'campfire') { const x = (i % W) * k, y = Math.floor(i / W) * k; minx.fillStyle = d.boat ? '#ffffff' : d.altar ? (o.t === 'altar_meadow' ? '#30e070' : o.t === 'altar_forest' ? '#3070ff' : '#ff3050') : d.chest === 3 ? '#ffd24a' : o.t === 'campfire' ? '#ff9040' : '#b08040'; minx.fillRect(x - 1, y - 1, 3, 3); } }
    for (const e of V.enemies) if (G.ENEMIES[e.t].boss) { minx.fillStyle = '#ff2020'; minx.fillRect(e.x * k - 2, e.y * k - 2, 4, 4); }
    for (const id in V.players) { const p = V.players[id]; if (p.dead) continue; minx.fillStyle = p.col; minx.fillRect(p.x * k - 1.5, p.y * k - 1.5, 3, 3); if (id === V.me) { minx.strokeStyle = '#fff'; minx.beginPath(); minx.moveTo(p.x * k, p.y * k); minx.lineTo(p.x * k + Math.cos(R.cam.yaw) * 7, p.y * k + Math.sin(R.cam.yaw) * 7); minx.stroke(); } }
    for (const p of R.fx.pings) { minx.strokeStyle = p.col; minx.beginPath(); minx.arc(p.x * k, p.y * k, 3 + (p.t % 1) * 3, 0, 7); minx.stroke(); }
  }
})(window.G);
