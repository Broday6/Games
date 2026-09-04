// DRIFTWOOD — first-person WebGL renderer (no external libraries)
// World coords: sim (x, y) on the tile grid -> GL (x, up, y). Heights come from the island heightmap.
(function (G) {
  'use strict';
  const T = G.T, O = G.OBJS, Sp = G.Sprites, W = G.WORLD;
  const R = { cam: { x: 0, y: 0, z: 1, yaw: -Math.PI / 2, pitch: 0 }, shake: 0, hitstop: 0, fx: { parts: [], floats: [], booms: [], zaps: [], slashes: [], targets: [], pings: [], wobble: {} }, tellFlash: {}, W: 640, H: 360, hurt: 0 };
  G.Render = R;
  let gl, cv, ov, ox, mini, minx, miniBase = null, prog, atlasTex, atlas, atlasCtx, atlasDirty = false;
  const CH = 16, WATER_Z = 0.0, HSCALE = 3.2;
  const chunks = {}; // key -> { vbo, n, wvbo, wn }
  const slots = {}; let nextSlot = 1; const CELL_W = 32, CELL_H = 64, COLS = 64, ROWS = 32;
  const FOG_DAY = [0.55, 0.72, 0.9], FOG_NIGHT = [0.03, 0.035, 0.09];
  let dynBuf = null, dynArr = new Float32Array(9 * 6 * 4096), dynN = 0; // pos3 uv2 col4
  let waterArr = new Float32Array(9 * 6 * 4096), waterN = 0;
  let vp = new Float32Array(16), proj = new Float32Array(16), view = new Float32Array(16);
  let lights = [], ambient = 1, fog = FOG_DAY, nowT = 0;

  // ---------- heights ----------
  R.hAt = function (world, tx, ty) { // corner height helper (tile-center height)
    if (tx < 0 || ty < 0 || tx >= W || ty >= W) return -0.3;
    const h = world.height[ty * W + tx]; const t = world.tiles[ty * W + tx];
    if (t <= T.WATER) return -0.35 + Math.max(0, h + 0.3) * 0.4; // seabed
    return Math.max(0.12, (h - 0.02) * HSCALE * 0.55 + 0.12);
  };
  function cornerH(world, cx, cy) { // height at grid corner (cx, cy) = avg of 4 tiles around
    let s = 0, n = 0;
    for (let oy = -1; oy <= 0; oy++) for (let ox = -1; ox <= 0; ox++) { s += R.hAt(world, cx + ox, cy + oy); n++; }
    return s / n;
  }
  R.groundZ = function (world, x, y) {
    if (!world) return 0;
    const tx = Math.floor(x), ty = Math.floor(y); const fx = x - tx, fy = y - ty;
    const h00 = cornerH(world, tx, ty), h10 = cornerH(world, tx + 1, ty), h01 = cornerH(world, tx, ty + 1), h11 = cornerH(world, tx + 1, ty + 1);
    const z = (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
    const o = world.objs.get(ty * W + tx); if (o && O[o.t].floor) return Math.max(z, WATER_Z + 0.08);
    return Math.max(z, world.tiles[ty * W + tx] <= T.WATER ? WATER_Z - 0.25 : z);
  };

  // ---------- GL setup ----------
  const VS = `attribute vec3 aPos; attribute vec2 aUV; attribute vec4 aCol;
    uniform mat4 uVP; uniform vec3 uCam; uniform float uAmb; uniform vec4 uLights[16]; uniform vec3 uLightCol[16]; uniform int uNL;
    varying vec2 vUV; varying vec4 vCol; varying float vFog; varying vec3 vLight;
    void main(){ vec4 wp = vec4(aPos,1.0); gl_Position = uVP*wp; vUV = aUV; vCol = aCol;
      float d = distance(aPos, uCam); vFog = clamp((d-22.0)/38.0, 0.0, 1.0);
      vec3 L = vec3(uAmb);
      for(int i=0;i<16;i++){ if(i>=uNL) break; float dl = distance(aPos, uLights[i].xyz); float a = clamp(1.0 - dl/uLights[i].w, 0.0, 1.0); L += uLightCol[i]*a*a*1.6; }
      vLight = max(L, vec3(aCol.a)); }`;
  const FS = `precision mediump float; uniform sampler2D uTex; uniform vec3 uFog; uniform float uAlpha;
    varying vec2 vUV; varying vec4 vCol; varying float vFog; varying vec3 vLight;
    void main(){ vec4 t = texture2D(uTex, vUV); if(t.a < 0.5) discard; vec3 c = t.rgb*vCol.rgb*vLight; c = mix(c, uFog, vFog); gl_FragColor = vec4(c, uAlpha*t.a); }`;
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

  R.init = function (canvas, overlay, minimap) {
    cv = canvas; ov = overlay; ox = ov.getContext('2d'); mini = minimap; minx = mini.getContext('2d');
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl');
    if (!gl) { alert('WebGL is required to play DRIFTWOOD.'); return; }
    prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    prog.a = { pos: gl.getAttribLocation(prog, 'aPos'), uv: gl.getAttribLocation(prog, 'aUV'), col: gl.getAttribLocation(prog, 'aCol') };
    prog.u = {}; ['uVP', 'uCam', 'uAmb', 'uLights', 'uLightCol', 'uNL', 'uTex', 'uFog', 'uAlpha'].forEach(n => prog.u[n] = gl.getUniformLocation(prog, n));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // atlas
    atlas = document.createElement('canvas'); atlas.width = CELL_W * COLS; atlas.height = CELL_H * ROWS; atlasCtx = atlas.getContext('2d'); atlasCtx.imageSmoothingEnabled = false;
    atlasCtx.fillStyle = '#fff'; atlasCtx.fillRect(0, 0, CELL_W, CELL_H); // slot 0 = white
    atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    dynBuf = gl.createBuffer();
    R.resize(); window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    const ww = window.innerWidth, wh = window.innerHeight; const scale = ww > 1400 ? 0.5 : 0.6;
    R.W = Math.round(ww * scale); R.H = Math.round(wh * scale);
    cv.width = R.W; cv.height = R.H; ov.width = R.W; ov.height = R.H;
    for (const c of [cv, ov]) { c.style.width = ww + 'px'; c.style.height = wh + 'px'; }
    if (gl) gl.viewport(0, 0, R.W, R.H);
  };

  // ---------- atlas slots ----------
  const WHITE = { u0: 0.5 / atlasW(), v0: 0.5 / atlasH(), u1: 1 / atlasW(), v1: 1 / atlasH() };
  function atlasW() { return CELL_W * COLS; } function atlasH() { return CELL_H * ROWS; }
  function slotFor(key, canvas) {
    let s = slots[key]; if (s) return s;
    const i = nextSlot++; if (i >= COLS * ROWS) return WHITE;
    const cx = (i % COLS) * CELL_W, cy = Math.floor(i / COLS) * CELL_H;
    const sw = canvas.width, sh = canvas.height; const sc = Math.min(CELL_W / sw, CELL_H / sh); const dw = Math.floor(sw * sc), dh = Math.floor(sh * sc);
    atlasCtx.clearRect(cx, cy, CELL_W, CELL_H); atlasCtx.drawImage(canvas, cx, cy, dw, dh);
    s = { u0: cx / atlasW(), v0: cy / atlasH(), u1: (cx + dw) / atlasW(), v1: (cy + dh) / atlasH(), asp: sw / sh };
    slots[key] = s; atlasDirty = true; return s;
  }
  function uploadAtlas() { if (!atlasDirty) return; atlasDirty = false; gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas); }

  // ---------- matrices ----------
  function perspective(out, fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); out.fill(0); out[0] = t / asp; out[5] = t; out[10] = (f + n) / (n - f); out[11] = -1; out[14] = 2 * f * n / (n - f); }
  function lookAt(out, ex, ey, ez, fx, fy, fz) { // f = forward dir (normalized), up = +Y
    let sx = -fz, sy = 0, sz = fx; let sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sz /= sl; // s = f x up
    const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx; // u = s x f
    out[0] = sx; out[4] = sy; out[8] = sz; out[12] = -(sx * ex + sy * ey + sz * ez);
    out[1] = ux; out[5] = uy; out[9] = uz; out[13] = -(ux * ex + uy * ey + uz * ez);
    out[2] = -fx; out[6] = -fy; out[10] = -fz; out[14] = (fx * ex + fy * ey + fz * ez);
    out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  }
  function mul(out, a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } out.set(o); }
  R.project = function (x, y, z) { // sim x,y + height z -> screen px or null
    const X = x, Y = z, Z = y;
    const cx = vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12], cy = vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13], cw = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15];
    if (cw <= 0.05) return null;
    return { x: (cx / cw * 0.5 + 0.5) * R.W, y: (1 - (cy / cw * 0.5 + 0.5)) * R.H, d: cw };
  };
  R.forward = () => ({ x: Math.cos(R.cam.yaw) * Math.cos(R.cam.pitch), z: Math.sin(R.cam.pitch), y: Math.sin(R.cam.yaw) * Math.cos(R.cam.pitch) });
  R.rayGround = function (world, maxD) { // march the view ray to the terrain; returns {x,y} sim coords or null
    const f = R.forward(); let px = R.cam.x, py = R.cam.y, pz = R.cam.z;
    for (let d = 0; d < maxD; d += 0.15) { px += f.x * 0.15; py += f.y * 0.15; pz += f.z * 0.15; if (!G.inWorld(px, py)) return null; if (pz <= R.groundZ(world, px, py) + 0.02) return { x: px, y: py }; }
    return null;
  };

  // ---------- geometry helpers ----------
  function push(arr, n, x, y, z, u, v, r, g, b, e) { const i = n * 9; arr[i] = x; arr[i + 1] = z; arr[i + 2] = y; arr[i + 3] = u; arr[i + 4] = v; arr[i + 5] = r; arr[i + 6] = g; arr[i + 7] = b; arr[i + 8] = e; return n + 1; }
  function quad(arr, n, p, s, col, e, flip) { // p: 4 corners [x,y,z] in sim coords (x,y horizontal, z up); s: uv slot
    const u0 = flip ? s.u1 : s.u0, u1 = flip ? s.u0 : s.u1; const [r, g, b] = col;
    n = push(arr, n, p[0][0], p[0][1], p[0][2], u0, s.v1, r, g, b, e); n = push(arr, n, p[1][0], p[1][1], p[1][2], u1, s.v1, r, g, b, e); n = push(arr, n, p[2][0], p[2][1], p[2][2], u1, s.v0, r, g, b, e);
    n = push(arr, n, p[0][0], p[0][1], p[0][2], u0, s.v1, r, g, b, e); n = push(arr, n, p[2][0], p[2][1], p[2][2], u1, s.v0, r, g, b, e); n = push(arr, n, p[3][0], p[3][1], p[3][2], u0, s.v0, r, g, b, e);
    return n;
  }
  function ensureDyn(need) { if ((dynN + need) * 9 > dynArr.length) { const na = new Float32Array(dynArr.length * 2); na.set(dynArr); dynArr = na; } }
  // camera-facing billboard, anchored at bottom center (x,y,z), size w x h
  function billboard(x, y, z, w, h, s, col, e, flip) {
    ensureDyn(6);
    const a = R.cam.yaw; const rx = -Math.sin(a) * w / 2, ry = Math.cos(a) * w / 2;
    dynN = quad(dynArr, dynN, [[x - rx, y - ry, z], [x + rx, y + ry, z], [x + rx, y + ry, z + h], [x - rx, y - ry, z + h]], s, col, e, flip);
  }
  function crossQuads(x, y, z, w, h, s, col, e) { // two quads in an X (trees)
    ensureDyn(12);
    for (const a of [0.785, 2.356]) { const rx = Math.cos(a) * w / 2, ry = Math.sin(a) * w / 2; dynN = quad(dynArr, dynN, [[x - rx, y - ry, z], [x + rx, y + ry, z], [x + rx, y + ry, z + h], [x - rx, y - ry, z + h]], s, col, e); }
  }
  function box(x0, y0, z0, x1, y1, z1, s, col, e, top) { // axis-aligned box with the same texture on the 4 sides (+ top)
    ensureDyn(30);
    dynN = quad(dynArr, dynN, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], s, col, e);
    dynN = quad(dynArr, dynN, [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], s, col, e);
    dynN = quad(dynArr, dynN, [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], s, col, e);
    dynN = quad(dynArr, dynN, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], s, col, e);
    dynN = quad(dynArr, dynN, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top || s, col.map(c => c * 0.8), e);
  }
  function groundQuad(world, x0, y0, x1, y1, lift, s, col, e) {
    ensureDyn(6); const z = (a, b) => R.groundZ(world, a, b) + lift;
    dynN = quad(dynArr, dynN, [[x0, y1, z(x0, y1)], [x1, y1, z(x1, y1)], [x1, y0, z(x1, y0)], [x0, y0, z(x0, y0)]], s, col, e);
  }
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const h2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

  // ---------- terrain chunks ----------
  function buildChunk(world, cxI, cyI) {
    const arr = new Float32Array(CH * CH * 6 * 9), warr = new Float32Array(CH * CH * 6 * 9); let n = 0, wn = 0;
    const sun = [0.5, 0.75, 0.45];
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const X = cxI * CH + tx, Y = cyI * CH + ty; if (X >= W || Y >= W) continue;
      const t = world.tiles[Y * W + X]; const info = G.TILE_INFO[t];
      const h00 = cornerH(world, X, Y), h10 = cornerH(world, X + 1, Y), h01 = cornerH(world, X, Y + 1), h11 = cornerH(world, X + 1, Y + 1);
      const r = h2(X, Y); let col = hex(info.col); const v = 0.92 + r * 0.16; col = col.map(c => Math.min(1, c * v));
      // lambert with a fixed sun from normal of the tile
      const nx = (h00 + h01 - h10 - h11) * 0.5, ny = (h00 + h10 - h01 - h11) * 0.5; const nl = Math.hypot(nx, ny, 1);
      const lam = 0.55 + 0.45 * Math.max(0, (nx / nl) * sun[0] + (1 / nl) * sun[1] + (ny / nl) * sun[2]);
      col = col.map(c => c * lam);
      const em = t === T.LAVA ? 1.0 : 0;
      n = quad(arr, n, [[X, Y + 1, h01], [X + 1, Y + 1, h11], [X + 1, Y, h10], [X, Y, h00]], WHITE, col, em);
      if (t <= T.WATER) { const wc = t === T.DEEP ? [0.12, 0.28, 0.55] : [0.2, 0.45, 0.75]; wn = quad(warr, wn, [[X, Y + 1, WATER_Z], [X + 1, Y + 1, WATER_Z], [X + 1, Y, WATER_Z], [X, Y, WATER_Z]], WHITE, wc, 0); }
    }
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, arr.subarray(0, n * 9), gl.STATIC_DRAW);
    const wvbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, wvbo); gl.bufferData(gl.ARRAY_BUFFER, warr.subarray(0, wn * 9), gl.STATIC_DRAW);
    return { vbo, n, wvbo, wn };
  }
  function chunk(world, cxI, cyI) { const k = cxI + ',' + cyI; return chunks[k] || (chunks[k] = buildChunk(world, cxI, cyI)); }
  R.dirtyTile = (i) => { const X = i % W, Y = Math.floor(i / W); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) delete chunks[Math.floor((X + ox) / CH) + ',' + Math.floor((Y + oy) / CH)]; };
  R.resetWorld = () => { for (const k in chunks) { gl.deleteBuffer(chunks[k].vbo); gl.deleteBuffer(chunks[k].wvbo); delete chunks[k]; } miniBase = null; };

  function bindAttribs() {
    const st = 9 * 4;
    gl.enableVertexAttribArray(prog.a.pos); gl.vertexAttribPointer(prog.a.pos, 3, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(prog.a.uv); gl.vertexAttribPointer(prog.a.uv, 2, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(prog.a.col); gl.vertexAttribPointer(prog.a.col, 4, gl.FLOAT, false, st, 20);
  }

  // ---------- events -> fx ----------
  R.event = function (ev, me) {
    const F = R.fx;
    switch (ev.t) {
      case 'dmg': F.floats.push({ x: ev.x + (Math.random() - .5) * 0.4, y: ev.y + 0.6, z: 1.4, s: String(ev.v), c: ev.c, t: 0, big: ev.crit }); break;
      case 'txt': if (!ev.to || ev.to === me) F.floats.push({ x: ev.x, y: ev.y + 0.8, z: 1.5, s: ev.s, c: ev.c, t: 0, small: ev.small }); break;
      case 'hit': for (let i = 0; i < ev.n; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.8, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, vz: Math.random() * 3, c: hex(ev.c), t: 0, life: 0.4 + Math.random() * 0.3, g: 9 }); break;
      case 'die': for (let i = 0; i < 16; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.6, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: Math.random() * 5, c: i % 3 ? hex(ev.c) : [1, 1, 1], t: 0, life: 0.5 + Math.random() * 0.5, g: 10, sz: 0.12 }); break;
      case 'boom': F.booms.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, c: ev.c || '#ffb040' }); for (let i = 0; i < 14; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.5, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, vz: Math.random() * 4, c: hex(ev.c || '#ffb040'), t: 0, life: 0.45, g: 4, sz: 0.14, e: 1 }); break;
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
      case 'sfx': if (ev.n === 'hurt' && ev.x !== undefined) { /* handled by main via player hp */ } break;
    }
  };

  // ---------- frame ----------
  R.frame = function (V, dt, L) {
    if (!gl) return;
    const me = V.players[V.me]; const world = V.world; nowT = V.now;
    if (R.hitstop > 0) { R.hitstop -= dt; }
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 18);
    // camera
    if (me) { R.cam.x = me.x; R.cam.y = me.y; R.cam.z = R.groundZ(world, me.x, me.y) + (me.downed ? 0.35 : 0.9) + (L.jumpZ || 0) + (L.bob || 0); }
    R.cam.yaw = L.yaw; R.cam.pitch = L.pitch;
    const shx = (Math.random() - .5) * R.shake * 0.01, shy = (Math.random() - .5) * R.shake * 0.01;
    const yaw = R.cam.yaw + shx, pitch = G.clamp(R.cam.pitch + shy, -1.5, 1.5);
    const fx = Math.cos(yaw) * Math.cos(pitch), fz = Math.sin(pitch), fy = Math.sin(yaw) * Math.cos(pitch);
    const fov = (L.sprinting ? 80 : 74) * Math.PI / 180;
    perspective(proj, fov, R.W / R.H, 0.05, 70);
    lookAt(view, R.cam.x, R.cam.z, R.cam.y, fx, fz, fy);
    mul(vp, proj, view);
    // sky / fog / ambient
    const darkness = G.Sim.darkness({ time: V.time });
    fog = FOG_DAY.map((c, i) => G.lerp(c, FOG_NIGHT[i], darkness / 0.9));
    ambient = G.lerp(1.0, 0.16, darkness / 0.9);
    // lights: nearest 16
    lights = [];
    const cx0 = Math.floor(R.cam.x), cy0 = Math.floor(R.cam.y);
    for (let ty = cy0 - 22; ty <= cy0 + 22; ty++) for (let tx = cx0 - 22; tx <= cx0 + 22; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= W) continue; const i = ty * W + tx; const o = world.objs.get(i);
      if (o && O[o.t].light && !o.stub) lights.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + (o.t === 'torch' ? 0.9 : 0.4), r: O[o.t].light * 1.4, c: o.t === 'furnace' || o.t === 'cauldron' ? [0.9, 0.5, 0.3] : [1, 0.68, 0.32] });
      if (world.tiles[i] === T.LAVA && (tx + ty) % 2 === 0) lights.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + 0.3, r: 2.5, c: [1, 0.4, 0.1] });
    }
    for (const id in V.players) { const p = V.players[id]; if (p.dead) continue; const it = p.inv[p.held]; const gz = R.groundZ(world, p.x, p.y); if (it && it.id === 'torch_hand') lights.push({ x: p.x, y: p.y, z: gz + 1.0, r: 5.5, c: [1, 0.7, 0.35] }); else if (darkness > 0.3) lights.push({ x: p.x, y: p.y, z: gz + 0.8, r: 2.2, c: [0.35, 0.38, 0.5] }); }
    for (const pr of V.projs) if (pr.type === 'glob') lights.push({ x: pr.x, y: pr.y, z: 0.9, r: 1.8, c: [1, 0.45, 0.1] });
    for (const p of V.puddles) lights.push({ x: p.x, y: p.y, z: R.groundZ(world, p.x, p.y) + 0.2, r: 2, c: [1, 0.4, 0.1] });
    for (const e of V.enemies) if (e.t === 'crawler' || e.t === 'cinder') lights.push({ x: e.x, y: e.y, z: R.groundZ(world, e.x, e.y) + 0.5, r: 3, c: [1, 0.45, 0.15] });
    lights.sort((a, b) => G.dist(a.x, a.y, R.cam.x, R.cam.y) - G.dist(b.x, b.y, R.cam.x, R.cam.y)); lights = lights.slice(0, 16);
    const lp = new Float32Array(64), lc = new Float32Array(48);
    lights.forEach((l, i) => { const flick = 1 + Math.sin(nowT * 9 + l.x * 7 + l.y * 3) * 0.07; lp[i * 4] = l.x; lp[i * 4 + 1] = l.z; lp[i * 4 + 2] = l.y; lp[i * 4 + 3] = l.r * flick; lc[i * 3] = l.c[0]; lc[i * 3 + 1] = l.c[1]; lc[i * 3 + 2] = l.c[2]; });

    gl.clearColor(fog[0], fog[1], fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(prog.u.uVP, false, vp); gl.uniform3f(prog.u.uCam, R.cam.x, R.cam.z, R.cam.y); gl.uniform1f(prog.u.uAmb, ambient);
    gl.uniform4fv(prog.u.uLights, lp); gl.uniform3fv(prog.u.uLightCol, lc); gl.uniform1i(prog.u.uNL, lights.length);
    gl.uniform3fv(prog.u.uFog, fog); gl.uniform1f(prog.u.uAlpha, 1); gl.uniform1i(prog.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.disable(gl.BLEND); gl.depthMask(true);
    // terrain
    const RAD = 3; const ccx = Math.floor(R.cam.x / CH), ccy = Math.floor(R.cam.y / CH); const vis = [];
    for (let cy = ccy - RAD; cy <= ccy + RAD; cy++) for (let cX = ccx - RAD; cX <= ccx + RAD; cX++) { if (cX < 0 || cy < 0 || cX * CH >= W || cy * CH >= W) continue; const c = chunk(world, cX, cy); vis.push(c); gl.bindBuffer(gl.ARRAY_BUFFER, c.vbo); bindAttribs(); gl.drawArrays(gl.TRIANGLES, 0, c.n); }
    // dynamic geometry
    dynN = 0; waterN = 0;
    buildScene(V, me, L);
    uploadAtlas();
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dynArr.subarray(0, dynN * 9), gl.DYNAMIC_DRAW); bindAttribs(); gl.drawArrays(gl.TRIANGLES, 0, dynN);
    // water (blended)
    gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(prog.u.uAlpha, 0.72 + Math.sin(nowT * 1.3) * 0.04);
    for (const c of vis) { if (!c.wn) continue; gl.bindBuffer(gl.ARRAY_BUFFER, c.wvbo); bindAttribs(); gl.drawArrays(gl.TRIANGLES, 0, c.wn); }
    gl.uniform1f(prog.u.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
    drawOverlay(V, me, dt, L, darkness);
    drawMinimap(V);
  };

  function buildScene(V, me, L) {
    const world = V.world; const F = R.fx;
    const cx0 = Math.floor(R.cam.x), cy0 = Math.floor(R.cam.y), VR = 30;
    const white = [1, 1, 1];
    for (let ty = cy0 - VR; ty <= cy0 + VR; ty++) for (let tx = cx0 - VR; tx <= cx0 + VR; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= W) continue; const i = ty * W + tx; const o = world.objs.get(i); if (!o) continue;
      // frustum-ish cull: behind camera
      const dx = tx + .5 - R.cam.x, dy = ty + .5 - R.cam.y; if (dx * Math.cos(R.cam.yaw) + dy * Math.sin(R.cam.yaw) < -2 && Math.hypot(dx, dy) > 3) continue;
      const d = O[o.t]; const gz = R.groundZ(world, tx + .5, ty + .5);
      let wob = 0; const wb = F.wobble[i]; if (wb) wob = Math.sin(wb * 60) * 0.06;
      const cxp = tx + .5 + wob, cyp = ty + .5;
      if (o.stub) { billboard(cxp, cyp, gz, 0.5, 0.3, slotFor('o:' + o.t + ':stub', Sp.obj(o.t, 'stub')), white, 0); continue; }
      if (d.wall && !d.door) { const s = slotFor('o:' + o.t, Sp.obj(o.t)); const hp = o.hp / d.hp; const c = hp < 0.5 ? [1, 0.75, 0.75] : white; box(tx, ty, gz - 0.2, tx + 1, ty + 1, gz + 1.3, s, c, 0); continue; }
      if (d.door) { const s = slotFor('o:' + o.t, Sp.obj(o.t)); if (o.closed) box(tx + 0.35, ty, gz - 0.2, tx + 0.65, ty + 1, gz + 1.3, s, white, 0); else { box(tx + 0.35, ty, gz - 0.2, tx + 0.65, ty + 0.15, gz + 1.3, s, white, 0); box(tx + 0.35, ty + 0.85, gz - 0.2, tx + 0.65, ty + 1, gz + 1.3, s, white, 0); } continue; }
      if (d.floor) { groundQuad(world, tx, ty, tx + 1, ty + 1, 0.01, slotFor('o:' + o.t, Sp.obj(o.t)), white, 0); continue; }
      if (d.trap) { groundQuad(world, tx, ty, tx + 1, ty + 1, 0.02, slotFor('o:' + o.t, Sp.obj(o.t)), white, 0); continue; }
      const s = slotFor('o:' + o.t, Sp.obj(o.t));
      if (d.tall) { crossQuads(cxp, cyp, gz - 0.05, 1.4, 2.8, s, white, 0); continue; }
      if (d.boat) { billboard(cxp, cyp, gz - 0.1, 3.2, 3.2, s, white, 0); continue; }
      if (d.altar) { billboard(cxp, cyp, gz, 1.6, 1.6, s, white, 0.35); continue; }
      if (o.t === 'campfire') { billboard(cxp, cyp, gz, 0.9, 0.9, s, white, 1.0); if (Math.random() < 0.35) F.parts.push({ x: cxp + (Math.random() - .5) * 0.3, y: cyp + (Math.random() - .5) * 0.3, z: gz + 0.5, vx: 0, vy: 0, vz: 1.4, c: Math.random() < 0.5 ? [1, 0.42, 0.1] : [1, 0.82, 0.25], t: 0, life: 0.5, g: -2, e: 1 }); continue; }
      if (o.t === 'torch') { billboard(cxp, cyp, gz, 0.5, 1.1, s, white, 1.0); if (Math.random() < 0.2) F.parts.push({ x: cxp, y: cyp, z: gz + 1.0, vx: 0, vy: 0, vz: 1.2, c: [1, 0.7, 0.2], t: 0, life: 0.35, g: -2, e: 1 }); continue; }
      if (o.t === 'furnace') { billboard(cxp, cyp, gz, 1.0, 1.0, s, white, 0.5); continue; }
      const sz = d.station ? 1.0 : (d.isChest ? 0.8 : (d.solid ? 0.95 : 0.7));
      billboard(cxp, cyp, gz, sz, sz, s, white, d.isChest ? 0.25 : 0);
    }
    // sun & moon: far billboards that arc across the sky with the clock
    { const tday = V.time / G.DAY_LEN; const sa = Math.PI * (0.05 + (V.time / G.NIGHT_AT) * 0.9); const ma = Math.PI * (0.1 + ((V.time - G.NIGHT_AT) / (G.DAY_LEN - G.NIGHT_AT)) * 0.8);
      const sky = (ang, col, sz, e) => { const dx = Math.cos(ang), dz = Math.sin(ang); const x = R.cam.x + dx * 55, y = R.cam.y - 20, z = R.cam.z + dz * 55; if (z < R.cam.z - 2) return; billboard(x, y, z - sz / 2, sz, sz, WHITE, col, e); };
      if (V.time < G.NIGHT_AT) sky(sa, [1, 0.95, 0.7], 5, 1.0); else sky(ma, [0.85, 0.9, 1], 3.5, 1.0);
      if (V.time >= G.DUSK_AT + 10) for (let i = 0; i < 40; i++) { const a = (i * 2.399) % 6.283, el = 0.15 + ((i * 0.618) % 1) * 1.2; const d = 60; billboard(R.cam.x + Math.cos(a) * Math.cos(el) * d, R.cam.y + Math.sin(a) * Math.cos(el) * d, R.cam.z + Math.sin(el) * d, 0.35, 0.35, WHITE, [1, 1, 1], 0.9 * Math.min(1, (V.time - G.DUSK_AT - 10) / 20)); } }
    // puddles
    for (const p of V.puddles) groundQuad(world, p.x - p.r, p.y - p.r * 0.8, p.x + p.r, p.y + p.r * 0.8, 0.03, WHITE, [1, 0.4, 0.1], 1.0);
    // drops
    for (const d of V.drops) { const gz = R.groundZ(world, d.x, d.y); const bob = Math.sin(nowT * 4 + d.id) * 0.06; billboard(d.x, d.y, gz + 0.15 + bob, 0.35, 0.35, slotFor('i:' + d.item, Sp.item(d.item)), white, d.item === 'coin' ? 0.6 : 0.2); }
    // enemies
    for (const e of V.enemies) {
      if (e.hidden) continue; const d = G.ENEMIES[e.t]; const gz = R.groundZ(world, e.x, e.y);
      const frame = Math.floor(nowT * 6 + e.id) % 2; const s = slotFor('e:' + e.t + ':' + frame + ':' + (e.flash ? 1 : 0), Sp.enemy(e.t, frame, e.flash));
      const rel = G.angDiff(R.cam.yaw, e.face); const flip = Math.sin(rel) < 0; // facing right relative to camera -> flip
      let w = e.r * 2.4, h = e.r * 2.6; if (d.boss) { w = e.r * 3.0; h = e.r * 3.2; } if (e.t === 'bat') { h = 0.5; w = 0.8; }
      if (e.t === 'leviathan') { w = 6; h = 5; }
      const isWind = /wind$/.test(e.st); const sc = isWind ? 1 + Math.sin(nowT * 25) * 0.05 : 1;
      const zoff = e.t === 'bat' ? 1.2 + Math.sin(nowT * 8 + e.id) * 0.2 : (e.t === 'leviathan' ? -1.2 : 0);
      billboard(e.x, e.y, gz + zoff, w * sc, h * sc, s, e.stun ? [0.8, 0.8, 1] : white, e.burn ? 0.6 : 0, flip);
      if (e.burn) F.parts.push({ x: e.x + (Math.random() - .5) * 0.6, y: e.y + (Math.random() - .5) * 0.6, z: gz + 0.5, vx: 0, vy: 0, vz: 1.5, c: [1, 0.42, 0.1], t: 0, life: 0.3, g: -3, e: 1 });
      if (e.st === 'charge' || e.st === 'lunge') for (let i = 0; i < 2; i++) F.parts.push({ x: e.x, y: e.y, z: gz + 0.1, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, vz: 1, c: [0.8, 0.75, 0.6], t: 0, life: 0.3, g: 0 });
    }
    // players (not me)
    for (const id in V.players) {
      const p = V.players[id]; if (p.dead || p === me) continue; const gz = R.groundZ(world, p.x, p.y);
      const frame = p.moving ? Math.floor(p.anim) % 2 : 0;
      const armor = (p.armor.head ? G.ITEMS[p.armor.head].col : '') + ',' + (p.armor.chest ? G.ITEMS[p.armor.chest].col : '') + ',' + (p.armor.legs ? G.ITEMS[p.armor.legs].col : '');
      const s = slotFor('pl:' + p.col + ':' + frame + ':' + (p.flash ? 1 : 0) + ':' + armor, Sp.player(p.col, frame, p.flash, armor));
      const rel = G.angDiff(R.cam.yaw, p.face); const flip = Math.sin(rel) < 0;
      if (p.downed) groundQuad(world, p.x - 0.6, p.y - 0.45, p.x + 0.6, p.y + 0.45, 0.05, s, white, 0);
      else { billboard(p.x, p.y, gz + (p.moving ? Math.abs(Math.sin(p.anim * Math.PI)) * 0.05 : 0), 0.9, 1.2, s, white, 0, flip);
        const it = p.inv[p.held]; if (it) { const a = p.swing ? p.swing.ang - p.swing.arc / 2 + p.swing.arc * (p.swing.t / p.swing.dur) : p.face; billboard(p.x + Math.cos(a) * 0.5, p.y + Math.sin(a) * 0.5, gz + 0.5, 0.4, 0.4, slotFor('i:' + it.id, Sp.item(it.id)), white, it.id === 'torch_hand' ? 1 : 0); } }
    }
    // projectiles
    for (const pr of V.projs) {
      const a = pr.a !== undefined ? pr.a : Math.atan2(pr.vy, pr.vx); const z = R.groundZ(world, pr.x, pr.y) + 0.9;
      if (pr.type === 'arrow') { ensureDyn(6); const ex = Math.cos(a) * 0.35, ey = Math.sin(a) * 0.35; dynN = quad(dynArr, dynN, [[pr.x - ex, pr.y - ey, z - 0.03], [pr.x + ex, pr.y + ey, z - 0.03], [pr.x + ex, pr.y + ey, z + 0.03], [pr.x - ex, pr.y - ey, z + 0.03]], WHITE, [0.85, 0.78, 0.65], 0.2); ensureDyn(6); dynN = quad(dynArr, dynN, [[pr.x - ex - Math.sin(a) * 0.03, pr.y - ey + Math.cos(a) * 0.03, z], [pr.x + ex - Math.sin(a) * 0.03, pr.y + ey + Math.cos(a) * 0.03, z], [pr.x + ex + Math.sin(a) * 0.03, pr.y + ey - Math.cos(a) * 0.03, z], [pr.x - ex + Math.sin(a) * 0.03, pr.y - ey - Math.cos(a) * 0.03, z]], WHITE, [0.85, 0.78, 0.65], 0.2); }
      else if (pr.type === 'glob') billboard(pr.x, pr.y, z - 0.15, 0.35, 0.35, WHITE, [1, 0.45, 0.1], 1.0);
      else billboard(pr.x, pr.y, z - 0.3, 0.7, 0.7, slotFor('o:rock', Sp.obj('rock')), white, 0);
    }
    // particles (3D)
    for (const p of F.parts) { const sz = p.sz || 0.07; billboard(p.x, p.y, p.z, sz, sz, WHITE, p.c, p.e ? 1 : 0.3); }
    // build ghost
    if (L.ghost) { const g = L.ghost; groundQuad(world, g.tx + 0.05, g.ty + 0.05, g.tx + 0.95, g.ty + 0.95, 0.04, WHITE, g.ok ? [0.3, 1, 0.3] : [1, 0.3, 0.3], 1.0); const od = O[g.obj]; if (od.wall || od.door) { box(g.tx + 0.1, g.ty + 0.1, R.groundZ(world, g.tx + .5, g.ty + .5), g.tx + 0.9, g.ty + 0.9, R.groundZ(world, g.tx + .5, g.ty + .5) + 1.2, slotFor('o:' + g.obj, Sp.obj(g.obj)), g.ok ? [0.6, 1, 0.6] : [1, 0.6, 0.6], 0.5); } else billboard(g.tx + .5, g.ty + .5, R.groundZ(world, g.tx + .5, g.ty + .5), 0.9, od.tall ? 1.8 : 0.9, slotFor('o:' + g.obj, Sp.obj(g.obj)), g.ok ? [0.6, 1, 0.6] : [1, 0.6, 0.6], 0.5); }
    // pings
    for (const p of F.pings) { const gz = R.groundZ(world, p.x, p.y); billboard(p.x, p.y, gz, 0.15, 6, WHITE, hex(p.col), 1.0); }
  }

  // ---------- 2D overlay ----------
  function drawOverlay(V, me, dt, L, darkness) {
    const F = R.fx; const x = ox; x.clearRect(0, 0, R.W, R.H);
    x.imageSmoothingEnabled = false;
    // particles/floats update
    for (let i = F.parts.length - 1; i >= 0; i--) { const p = F.parts[i]; p.t += dt; if (p.t > p.life) { F.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.g || 0) * dt; }
    for (let i = F.floats.length - 1; i >= 0; i--) { const f = F.floats[i]; f.t += dt; f.z += dt * 0.8; if (f.t > 1.1) F.floats.splice(i, 1); }
    // enemy overlays
    for (const e of V.enemies) {
      if (e.hidden) continue; const d = G.ENEMIES[e.t]; const gz = R.groundZ(V.world, e.x, e.y); const top = R.project(e.x, e.y, gz + (d.boss ? e.r * 3.3 : e.r * 2.8) + 0.2); if (!top) continue;
      const sc = G.clamp(14 / top.d, 0.5, 2.2);
      if (!d.boss && e.hp < e.maxHp) { const w = 26 * sc; x.fillStyle = '#000'; x.fillRect(top.x - w / 2, top.y, w, 3 * sc); x.fillStyle = (e.pet || e.owner) ? '#60ff60' : '#e03030'; x.fillRect(top.x - w / 2, top.y, w * Math.max(0, e.hp / e.maxHp), 3 * sc); }
      if (/wind$/.test(e.st)) { x.fillStyle = Math.floor(nowT * 12) % 2 ? '#ff3030' : '#ffe040'; x.font = 'bold ' + Math.round(16 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('!', top.x, top.y - 4); }
      if (e.stun) { x.fillStyle = '#ffe040'; x.font = Math.round(10 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('* *', top.x, top.y - 4); }
    }
    // other players
    for (const id in V.players) {
      const p = V.players[id]; if (p.dead || p === me) continue; const gz = R.groundZ(V.world, p.x, p.y); const pt = R.project(p.x, p.y, gz + 1.45); if (!pt) continue;
      const sc = G.clamp(14 / pt.d, 0.5, 2);
      x.font = Math.round(9 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(p.name, pt.x + 1, pt.y + 1); x.fillStyle = p.col; x.fillText(p.name, pt.x, pt.y);
      x.fillStyle = '#000'; x.fillRect(pt.x - 14 * sc, pt.y + 3, 28 * sc, 3 * sc); x.fillStyle = '#e03030'; x.fillRect(pt.x - 14 * sc, pt.y + 3, 28 * sc * Math.max(0, p.hp / p.maxHp), 3 * sc);
      if (p.downed) { x.fillStyle = Math.floor(nowT * 4) % 2 ? '#ff3030' : '#ff9090'; x.fillText('DOWN ' + p.bleed + 's', pt.x, pt.y - 10 * sc); if (p.revive > 0) { x.fillStyle = '#000'; x.fillRect(pt.x - 14 * sc, pt.y + 8, 28 * sc, 3 * sc); x.fillStyle = '#60ff60'; x.fillRect(pt.x - 14 * sc, pt.y + 8, 28 * sc * p.revive / 3, 3 * sc); } }
    }
    // floats
    for (const f of F.floats) { const pt = R.project(f.x, f.y, f.z); if (!pt) continue; const sc = G.clamp(12 / pt.d, 0.6, 2); x.font = (f.big ? 'bold ' : '') + Math.round((f.big ? 16 : f.small ? 9 : 12) * sc) + 'px monospace'; x.textAlign = 'center'; x.globalAlpha = Math.min(1, 2.2 - f.t * 2); x.fillStyle = '#000'; x.fillText(f.s, pt.x + 1, pt.y + 1); x.fillStyle = f.c; x.fillText(f.s, pt.x, pt.y); }
    x.globalAlpha = 1;
    // booms, zaps, slashes, targets, pings (projected)
    for (let i = F.booms.length - 1; i >= 0; i--) { const b = F.booms[i]; b.t += dt; if (b.t > 0.35) { F.booms.splice(i, 1); continue; } ring(V, b.x, b.y, b.r * (0.3 + b.t / 0.35 * 0.7), b.c, 1 - b.t / 0.35, 3); }
    for (let i = F.zaps.length - 1; i >= 0; i--) { const z = F.zaps[i]; z.t += dt; if (z.t > 0.15) { F.zaps.splice(i, 1); continue; } const a = R.project(z.x1, z.y1, R.groundZ(V.world, z.x1, z.y1) + 0.6), b = R.project(z.x2, z.y2, R.groundZ(V.world, z.x2, z.y2) + 0.6); if (!a || !b) continue; x.strokeStyle = '#a0d0ff'; x.lineWidth = 2; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo((a.x + b.x) / 2 + (Math.random() - .5) * 12, (a.y + b.y) / 2 + (Math.random() - .5) * 12); x.lineTo(b.x, b.y); x.stroke(); }
    for (let i = F.slashes.length - 1; i >= 0; i--) { const s = F.slashes[i]; s.t += dt; if (s.t > 0.2) { F.slashes.splice(i, 1); continue; } ring(V, s.x + Math.cos(s.a) * s.r * 0.5, s.y + Math.sin(s.a) * s.r * 0.5, s.r * 0.5, '#ff6060', 1 - s.t / 0.2, 2); }
    for (let i = F.targets.length - 1; i >= 0; i--) { const t = F.targets[i]; t.t += dt; if (t.t > t.d) { F.targets.splice(i, 1); continue; } ring(V, t.x, t.y, t.r, '#ff5050', 0.9, 2); ring(V, t.x, t.y, t.r * (t.t / t.d), '#ff5050', 0.6, 2); }
    for (let i = F.pings.length - 1; i >= 0; i--) { const p = F.pings[i]; p.t += dt; if (p.t > 5) { F.pings.splice(i, 1); continue; } const pt = R.project(p.x, p.y, R.groundZ(V.world, p.x, p.y) + 3.5); if (pt) { x.fillStyle = p.col; x.font = '11px monospace'; x.textAlign = 'center'; x.fillText(p.name + ' ▼ ' + Math.round(G.dist(p.x, p.y, R.cam.x, R.cam.y)) + 'm', pt.x, pt.y); } }
    for (const k in F.wobble) { F.wobble[k] -= dt; if (F.wobble[k] <= 0) delete F.wobble[k]; }
    for (const k in R.tellFlash) { R.tellFlash[k] -= dt; if (R.tellFlash[k] <= 0) delete R.tellFlash[k]; }
    // hands / held item
    if (me && !me.dead && !me.downed) drawHands(me, L);
    // crosshair
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1.5; const cx = R.W / 2, cy = R.H / 2; x.beginPath(); x.moveTo(cx - 7, cy); x.lineTo(cx - 3, cy); x.moveTo(cx + 3, cy); x.lineTo(cx + 7, cy); x.moveTo(cx, cy - 7); x.lineTo(cx, cy - 3); x.moveTo(cx, cy + 3); x.lineTo(cx, cy + 7); x.stroke();
    if (L.lookingAt) { x.fillStyle = '#fff'; x.font = '10px monospace'; x.textAlign = 'center'; x.fillText(L.lookingAt, cx, cy + 22); }
    // hurt vignette & dark vignette
    if (me) { const hpF = me.hp / me.maxHp; if (me.flash) R.hurt = 0.35; R.hurt = Math.max(0, R.hurt - dt * 1.2); const v = Math.max(R.hurt, hpF < 0.3 ? (0.3 - hpF) * 2 * (0.6 + Math.sin(nowT * 6) * 0.3) : 0); if (v > 0) { const g = x.createRadialGradient(cx, cy, R.H * 0.3, cx, cy, R.H * 0.8); g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, 'rgba(180,0,0,' + Math.min(0.8, v) + ')'); x.fillStyle = g; x.fillRect(0, 0, R.W, R.H); } if (me.downed) { x.fillStyle = 'rgba(60,0,0,0.45)'; x.fillRect(0, 0, R.W, R.H); x.fillStyle = '#ff6060'; x.font = 'bold 22px monospace'; x.textAlign = 'center'; x.fillText('YOU ARE DOWN — ' + me.bleed + 's', cx, cy - 30); x.font = '12px monospace'; x.fillStyle = '#fff'; x.fillText('a teammate can revive you (hold E)', cx, cy - 10); } if (me.dark && darkness > 0.8) { x.fillStyle = '#8080ff'; x.font = '12px monospace'; x.textAlign = 'center'; x.fillText('the dark bites… find light', cx, cy + 40); } }
    // boss bars
    let by = 10;
    for (const e of V.enemies) if (G.ENEMIES[e.t].boss) { const d = G.ENEMIES[e.t]; const w = Math.min(320, R.W - 60); const x0 = (R.W - w) / 2; x.fillStyle = '#000'; x.fillRect(x0 - 2, by - 2, w + 4, 12); x.fillStyle = '#601010'; x.fillRect(x0, by, w, 8); x.fillStyle = '#e03030'; x.fillRect(x0, by, w * Math.max(0, e.hp / e.maxHp), 8); x.fillStyle = '#fff'; x.font = '10px monospace'; x.textAlign = 'center'; x.fillText(d.name, R.W / 2, by + 20); by += 26; }
  }
  function ring(V, wx, wy, r, col, alpha, lw) {
    const x = ox; x.strokeStyle = col; x.globalAlpha = alpha; x.lineWidth = lw; x.beginPath(); let first = true;
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 16) { const px = wx + Math.cos(a) * r, py = wy + Math.sin(a) * r; const pt = R.project(px, py, R.groundZ(V.world, px, py) + 0.05); if (!pt) { first = true; continue; } if (first) { x.moveTo(pt.x, pt.y); first = false; } else x.lineTo(pt.x, pt.y); }
    x.stroke(); x.globalAlpha = 1;
  }
  function drawHands(me, L) {
    const x = ox; const it = me.inv[me.held]; const scale = R.H / 360;
    const bob = (L.bob || 0) * 40 * scale; const bx = R.W - 150 * scale + Math.sin((L.walkT || 0) * 0.5) * 6 * scale, byy = R.H - 90 * scale + bob;
    x.save(); x.translate(bx, byy);
    let rot = 0, lift = 0;
    if (me.swing) { const pr = me.swing.t / me.swing.dur; rot = -Math.sin(pr * Math.PI) * 1.4; lift = -Math.sin(pr * Math.PI) * 40 * scale; }
    if (me.blocking) { lift = -30 * scale; }
    x.translate(0, lift); x.rotate(rot);
    if (it) {
      const d = G.ITEMS[it.id]; const img = Sp.item(it.id); const sz = 120 * scale;
      if (d.type === 'bow') { const pull = me.draw ? Math.min(1, me.draw / d.draw) : 0; x.translate(-40 * scale, -pull * 20 * scale); x.rotate(-0.4 + pull * 0.1); x.drawImage(img, -sz / 2, -sz / 2, sz, sz); if (pull > 0) { x.fillStyle = '#fff'; x.fillRect(-sz * 0.05 - pull * 10 * scale, -sz / 2 + 10, 3, sz - 20); } }
      else if (d.type === 'shield') { x.drawImage(img, -sz * 0.7, -sz * 0.7, sz * 1.4, sz * 1.4); }
      else if (d.type === 'weapon' || d.type === 'tool') { x.rotate(0.6); x.drawImage(img, -sz / 2, -sz * 0.9, sz, sz); }
      else { x.drawImage(img, -sz / 2, -sz / 2, sz * 0.8, sz * 0.8); }
    } else { // fist + forearm
      x.rotate(0.5); x.fillStyle = me.col; x.strokeStyle = '#14121a'; x.lineWidth = 3 * scale; x.beginPath(); x.rect(-16 * scale, 10 * scale, 32 * scale, 90 * scale); x.fill(); x.stroke();
      x.fillStyle = '#f0c8a0'; x.beginPath(); x.roundRect ? x.roundRect(-20 * scale, -18 * scale, 40 * scale, 34 * scale, 9 * scale) : x.rect(-20 * scale, -18 * scale, 40 * scale, 34 * scale); x.fill(); x.stroke();
      x.strokeStyle = '#c09070'; x.lineWidth = 2 * scale; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo((-12 + i * 10) * scale, -18 * scale); x.lineTo((-12 + i * 10) * scale, -4 * scale); x.stroke(); } }
    x.restore();
    if (it && G.ITEMS[it.id].type === 'bow') { x.fillStyle = '#fff'; x.font = Math.round(11 * scale) + 'px monospace'; x.textAlign = 'right'; x.fillText(G.Sim.count(me, 'arrow') + ' arrows', R.W - 12, R.H - 12); }
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
