// DRIFTWOOD — low-poly first-person WebGL renderer (no external libraries)
// Sim coords (x, y) on the tile grid map to GL (x, up, z=y). Every mesh is procedural flat-shaded geometry.
(function (G) {
  'use strict';
  const T = G.T, O = G.OBJS, W = G.WORLD;
  const R = { cam: { x: 0, y: 0, z: 1, yaw: -Math.PI / 2, pitch: 0 }, shake: 0, hitstop: 0, fx: { parts: [], floats: [], booms: [], zaps: [], slashes: [], targets: [], pings: [], wobble: {}, corpses: [] }, banner: null, kick: 0, roll: 0, tellFlash: {}, W: 640, H: 360, hurt: 0 };
  G.Render = R;
  let gl, cv, ov, ox, mini, minx, miniBase = null, prog, skyProg, skyBuf;
  const CH = 16, WATER_Y = 0.0, HSCALE = 6.5, EYE = 1.0;
  const VF = 10; // floats per vertex: pos3 nrm3 col3 em1
  const chunks = {}; // key -> { vbo, n, wvbo, wn, obo, on }
  let dynBuf = null, dyn = { arr: new Float32Array(VF * 3 * 60000), n: 0 };
  let vp = new Float32Array(16), proj = new Float32Array(16), view = new Float32Array(16);
  const lightPacked = { lp: new Float32Array(64), lc: new Float32Array(48) };
  let lights = [], fog = [0.7, 0.8, 0.9], nowT = 0, sunDir = [0, 1, 0], sunCol = [1, 1, 1], moonDir = [0, 1, 0], ambient = 1, camBasis = null;

  // ================= heights =================
  R.hAt = function (world, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= W) return -0.6;
    const i = ty * W + tx; const h = world.height[i]; const t = world.tiles[i];
    if (t <= T.WATER) return -0.6 + Math.max(0, h + 0.3) * 0.7;
    const r = world.relief ? world.relief[i] : h; return Math.max(0.15, (r - 0.02) * HSCALE * 0.6 + 0.15);
  };
  // smooth terrain normal at a tile corner from the surrounding corner heights (central differences)
  function cornerN(world, cx, cy) { const dx = (cornerH(world, cx + 1, cy) - cornerH(world, cx - 1, cy)) * 0.5, dy = (cornerH(world, cx, cy + 1) - cornerH(world, cx, cy - 1)) * 0.5; const l = Math.hypot(dx, 1, dy); return [-dx / l, 1 / l, -dy / l]; }
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
    uniform mat4 uVP; uniform float uTime; uniform float uWater; uniform vec3 uCam; uniform float uFogNear;
    varying vec3 vCol; varying float vFog; varying vec3 vNrm; varying vec3 vPos; varying float vEm;
    void main(){ vec3 p = aPos; vec3 n = aNrm;
      if(uWater > 0.5){ p.y += sin(p.x*1.3 + uTime*1.6)*0.05 + cos(p.z*1.1 + uTime*1.2)*0.05; n = normalize(vec3(-cos(p.x*1.3+uTime*1.6)*0.07, 1.0, sin(p.z*1.1+uTime*1.2)*0.06)); }
      gl_Position = uVP * vec4(p, 1.0); vPos = p; vNrm = n; vCol = aCol; vEm = aEm;
      float d = distance(p, uCam); vFog = clamp((d - uFogNear) / (uFogNear < 10.0 ? 12.0 : 40.0), 0.0, 1.0); }`;
  const FS = `precision mediump float;
    uniform vec3 uFog; uniform float uAlpha; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec4 uLights[16]; uniform vec3 uLightCol[16]; uniform int uNL; uniform highp vec3 uCam; uniform highp float uWater;
    varying vec3 vCol; varying float vFog; varying vec3 vNrm; varying vec3 vPos; varying float vEm;
    void main(){ vec3 n = normalize(vNrm); if(!gl_FrontFacing) n = -n;
      vec3 L = uAmb * (0.7 + 0.3 * n.y);
      float nd = max(0.0, dot(n, uSunDir)); float band = smoothstep(0.02, 0.34, nd) * 0.5 + smoothstep(0.42, 0.78, nd) * 0.5; L += uSunCol * band;
      for(int i=0;i<10;i++){ if(i>=uNL) break; vec3 d = uLights[i].xyz - vPos; float dist = length(d); float a = clamp(1.0 - dist/uLights[i].w, 0.0, 1.0); float att = floor(a * a * 6.0 + 0.5) / 6.0; L += uLightCol[i] * att * 1.9 * max(0.3, dot(n, d/dist)); }
      L = min(L, vec3(1.55));
      vec3 vd = normalize(uCam - vPos); float rim = pow(1.0 - max(dot(n, vd), 0.0), 3.0) * 0.09;
      vec3 c = vCol * max(L, vec3(vEm)) + vCol * rim * (uSunCol * 0.5 + uAmb * 0.5);
      if(uWater > 0.5){ vec3 v = normalize(uCam - vPos); vec3 h = normalize(v + uSunDir); float sp = pow(max(dot(n, h), 0.0), 90.0); c += uSunCol * sp * 1.2; c += vec3(0.08,0.1,0.14) * pow(1.0 - max(dot(n, v), 0.0), 2.0); }
      c = mix(c, uFog, vFog);
      gl_FragColor = vec4(c, vEm < -0.5 ? 0.0 : uAlpha); }`; // alpha 0 marks 'no outline' surfaces (grass) for the post pass
  // model program: rigid glTF meshes (uModel) with optional texture; skinned parts are CPU-skinned and drawn with identity
  let MAXJ = 24; // joint palette size per skinned primitive (set from MAX_VERTEX_UNIFORM_VECTORS at init)
  const MVS_SRC = (maxj) => `attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUV; attribute vec4 aJ; attribute vec4 aW;
    uniform mat4 uVP; uniform mat4 uModel; uniform vec3 uCam; uniform float uFogNear; uniform float uSkin; uniform mat4 uJoints[${maxj}];
    varying vec3 vNrm; varying vec3 vPos; varying vec2 vUV; varying float vFog;
    void main(){ vec4 lp = vec4(aPos, 1.0); vec3 ln = aNrm;
      if(uSkin > 0.5){ mat4 sk = aW.x * uJoints[int(aJ.x)] + aW.y * uJoints[int(aJ.y)] + aW.z * uJoints[int(aJ.z)] + aW.w * uJoints[int(aJ.w)]; lp = sk * lp; ln = mat3(sk) * ln; }
      vec4 wp = uModel * lp; vPos = wp.xyz; vNrm = normalize(mat3(uModel) * ln); vUV = aUV; gl_Position = uVP * wp;
      float d = distance(wp.xyz, uCam); vFog = clamp((d - uFogNear) / (uFogNear < 10.0 ? 12.0 : 40.0), 0.0, 1.0); }`;
  const MFS = `precision mediump float;
    uniform vec3 uFog; uniform float uAlpha; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec4 uLights[16]; uniform vec3 uLightCol[16]; uniform int uNL; uniform highp vec3 uCam;
    uniform vec4 uColor; uniform sampler2D uTex; uniform float uHasTex; uniform float uEm;
    varying vec3 vNrm; varying vec3 vPos; varying vec2 vUV; varying float vFog;
    void main(){ vec3 n = normalize(vNrm); if(!gl_FrontFacing) n = -n;
      vec3 L = uAmb * (0.7 + 0.3 * n.y); float nd = max(0.0, dot(n, uSunDir)); float band = smoothstep(0.02, 0.34, nd) * 0.5 + smoothstep(0.42, 0.78, nd) * 0.5; L += uSunCol * band;
      for(int i=0;i<10;i++){ if(i>=uNL) break; vec3 d = uLights[i].xyz - vPos; float dist = length(d); float a = clamp(1.0 - dist/uLights[i].w, 0.0, 1.0); float att = floor(a * a * 6.0 + 0.5) / 6.0; L += uLightCol[i] * att * 1.9 * max(0.3, dot(n, d/dist)); }
      L = min(L, vec3(1.55));
      vec3 base = uColor.rgb; if(uHasTex > 0.5) base *= texture2D(uTex, vUV).rgb;
      vec3 vd = normalize(uCam - vPos); float rim = pow(1.0 - max(dot(n, vd), 0.0), 3.0) * 0.09;
      vec3 c = base * max(L, vec3(uEm)) + base * rim * (uSunCol * 0.5 + uAmb * 0.5); c = mix(c, uFog, vFog); gl_FragColor = vec4(c, uAlpha); }`;
  let mprog = null; const modelReqs = []; const animStates = {};
  // post pass: the scene is drawn to an offscreen colour+depth target, then outlined (depth discontinuities) and graded — the toon look
  let post = null, postProg = null;
  const POST_FS = `precision mediump float; varying vec2 vP; uniform sampler2D uCol; uniform sampler2D uDepth; uniform vec2 uInvRes; uniform float uNear; uniform float uFar; uniform float uOutline; uniform float uSat; uniform float uDebug; uniform float uHurt;
    float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
    void main(){ vec2 uv = vP * 0.5 + 0.5; vec3 c = texture2D(uCol, uv).rgb;
      if(uOutline > 0.5){ float d0 = lin(texture2D(uDepth, uv).r); vec2 o = uInvRes * uOutline;
        float e = max(max(lin(texture2D(uDepth, uv + vec2(o.x, 0.0)).r) - d0, lin(texture2D(uDepth, uv - vec2(o.x, 0.0)).r) - d0), max(lin(texture2D(uDepth, uv + vec2(0.0, o.y)).r) - d0, lin(texture2D(uDepth, uv - vec2(0.0, o.y)).r) - d0));
        float thr = 0.06 + d0 * 0.05; float edge = smoothstep(thr, thr * 2.0, e) * (1.0 - smoothstep(9.0, 26.0, d0)) * texture2D(uCol, uv).a; // grass opts out via alpha so blades stay green instead of inking over // outlines fade out with distance so thin far geometry (grass) never turns into black spikes
        c = mix(c, c * 0.32, edge * 0.8); if(uDebug > 0.5) c = vec3(edge, d0 / 40.0, 0.0); }
      // FXAA-lite: blend towards the 4 diagonal neighbours where local luma contrast is high (softens polygon edges the FBO lost MSAA on)
      { vec2 o = uInvRes * 0.6; vec3 c1 = texture2D(uCol, uv + vec2(-o.x, -o.y)).rgb, c2 = texture2D(uCol, uv + vec2(o.x, -o.y)).rgb, c3 = texture2D(uCol, uv + vec2(-o.x, o.y)).rgb, c4 = texture2D(uCol, uv + vec2(o.x, o.y)).rgb;
        vec3 lw = vec3(0.299, 0.587, 0.114); float l0 = dot(c, lw), l1 = dot(c1, lw), l2 = dot(c2, lw), l3 = dot(c3, lw), l4 = dot(c4, lw); float lmin = min(l0, min(min(l1, l2), min(l3, l4))), lmax = max(l0, max(max(l1, l2), max(l3, l4)));
        float k = smoothstep(0.1, 0.32, lmax - lmin); c = mix(c, (c + c1 + c2 + c3 + c4) * 0.2, k * 0.6); }
      float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat); c = (c - 0.5) * 1.06 + 0.5;
      float vig = smoothstep(0.55, 1.15, length((uv - 0.5) * vec2(1.25, 1.0)) * 1.6); c *= 1.0 - 0.38 * vig;
      if(uHurt > 0.001) c = mix(c, vec3(0.62, 0.02, 0.02), uHurt * smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.25, 1.0)) * 1.6));
      gl_FragColor = vec4(c, 1.0); }`;
  function setupPost() {
    post = null; const ext = gl.getExtension('WEBGL_depth_texture') || gl.getExtension('WEBKIT_WEBGL_depth_texture'); if (!ext) { document.body.classList.add('nopost'); return; }
    try { postProg = postProg || program(SKY_VS, POST_FS, ['aP'], ['uCol', 'uDepth', 'uInvRes', 'uNear', 'uFar', 'uOutline', 'uSat', 'uDebug', 'uHurt']); } catch (e) { console.warn('post shader failed', e); document.body.classList.add('nopost'); return; }
    const mk = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const col = mk(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, R.W, R.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const dep = mk(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, R.W, R.H, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dep, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { console.warn('post framebuffer incomplete'); document.body.classList.add('nopost'); return; }
    document.body.classList.remove('nopost'); post = { fbo, col, dep };
  }
  function drawPost() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.useProgram(postProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.col); gl.uniform1i(postProg.u.uCol, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, post.dep); gl.uniform1i(postProg.u.uDepth, 1); gl.activeTexture(gl.TEXTURE0);
    const S = G.Input && G.Input.settings ? G.Input.settings : {}; gl.uniform2f(postProg.u.uInvRes, 1 / R.W, 1 / R.H); gl.uniform1f(postProg.u.uNear, 0.05); gl.uniform1f(postProg.u.uFar, 80); gl.uniform1f(postProg.u.uOutline, S.toon === false ? 0 : (R.W > 2200 ? 1.8 : R.W > 1400 ? 1.3 : 1.0)); gl.uniform1f(postProg.u.uSat, 1.1); gl.uniform1f(postProg.u.uDebug, R.debugEdges ? 1 : 0); gl.uniform1f(postProg.u.uHurt, Math.min(0.8, R.hurtV || 0));
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.enableVertexAttribArray(postProg.a.aP); gl.vertexAttribPointer(postProg.a.aP, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // unbind the target textures or next frame's draws into the FBO would form a feedback loop and be dropped
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.enable(gl.DEPTH_TEST);
  }
  const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.999, 1.0); }`;
  const SKY_FS = `precision mediump float; varying vec2 vP;
    uniform vec3 uRight, uUp, uFwd, uSunDir, uMoonDir; uniform float uTanH, uAspect, uDusk, uNight, uTime;
    float hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ return 0.5*vnoise(p) + 0.25*vnoise(p*2.03) + 0.125*vnoise(p*4.11) + 0.0625*vnoise(p*8.3); }
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
      if(dir.y > 0.02){ vec2 cp = dir.xz / (dir.y + 0.15) * 1.6 + vec2(uTime*0.012, uTime*0.004); float cl = fbm(cp); float cov = smoothstep(0.52, 0.72, cl); float shade = 0.75 + 0.25*smoothstep(0.55, 0.9, cl); vec3 cc = mix(vec3(0.95,0.96,1.0)*shade, vec3(0.9,0.6,0.5)*shade, uDusk); cc = mix(cc, vec3(0.12,0.13,0.2)*shade, uNight); c = mix(c, cc, cov * smoothstep(0.02, 0.12, dir.y) * 0.95); }
      if(dir.y < 0.0) c = mix(c, c*0.9, clamp(-dir.y*8.0, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0); }`;
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs, fs, attrs, unis) { const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.a = {}; p.u = {}; attrs.forEach(a => p.a[a] = gl.getAttribLocation(p, a)); unis.forEach(u => p.u[u] = gl.getUniformLocation(p, u)); return p; }

  R.init = function (canvas, overlay, minimap) {
    cv = canvas; ov = overlay; ox = ov.getContext('2d'); mini = minimap; minx = mini.getContext('2d');
    gl = cv.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl');
    if (!gl) { alert('WebGL is required to play DRIFTWOOD.'); return; }
    prog = program(VS, FS, ['aPos', 'aNrm', 'aCol', 'aEm'], ['uVP', 'uTime', 'uWater', 'uCam', 'uFog', 'uAlpha', 'uSunDir', 'uSunCol', 'uAmb', 'uLights', 'uLightCol', 'uNL', 'uFogNear']);
    skyProg = program(SKY_VS, SKY_FS, ['aP'], ['uRight', 'uUp', 'uFwd', 'uSunDir', 'uMoonDir', 'uTanH', 'uAspect', 'uDusk', 'uNight', 'uTime']);
    try { const mv = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 128; MAXJ = mv >= 512 ? 48 : mv >= 256 ? 32 : 16; mprog = program(MVS_SRC(MAXJ), MFS, ['aPos', 'aNrm', 'aUV', 'aJ', 'aW'], ['uVP', 'uModel', 'uCam', 'uFogNear', 'uFog', 'uAlpha', 'uSunDir', 'uSunCol', 'uAmb', 'uLights', 'uLightCol', 'uNL', 'uColor', 'uTex', 'uHasTex', 'uEm', 'uSkin', 'uJoints']); } catch (e) { console.warn('model shader failed', e); mprog = null; }
    skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    dynBuf = gl.createBuffer();
    buildPrefabs();
    R.resize(); window.addEventListener('resize', R.resize);
  };
  R.reinitPost = () => { if (gl) setupPost(); };
  // adaptive quality: qScale drifts down when frames are slow and back up when there is headroom (settings.quality is the base)
  R.qScale = 1; let ftAvg = 16, ftT = 0;
  R.autoQuality = function (dtMs) {
    const S = G.Input && G.Input.settings; if (!S || S.autoq === false) return; ftAvg += (Math.min(100, dtMs) - ftAvg) * 0.03; ftT += dtMs;
    if (ftT < 6000) return; ftT = 0; // slow, hysteretic: only step when clearly over/under budget so the resolution never visibly pumps
    if (ftAvg > 28 && R.qScale > 0.6) { R.qScale = Math.max(0.6, R.qScale - (ftAvg > 45 ? 0.2 : 0.1)); R.resize(); }
    else if (ftAvg < 10 && R.qScale < 1.34) { R.qScale = Math.min(1.34, R.qScale + 0.05); R.resize(); }
  };
  R.resize = function () {
    const ww = window.innerWidth, wh = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // the 3D target renders at device pixels (no more blur from upscaling a 75% CSS-pixel buffer); capped near 2.6 Mpx so 4K/high-DPR screens stay playable, auto quality takes it from there
    let scale = G.clamp((G.Input && G.Input.settings ? G.Input.settings.quality : 1) * R.qScale, 0.5, 1) * dpr; const px = ww * wh * scale * scale; if (px > 2.6e6) scale *= Math.sqrt(2.6e6 / px);
    R.W = Math.round(ww * scale); R.H = Math.round(wh * scale); R.VW = ww; R.VH = wh; R.DPR = dpr;
    cv.width = R.W; cv.height = R.H; ov.width = Math.round(ww * dpr); ov.height = Math.round(wh * dpr); // the HUD overlay is always crisp: CSS-pixel coordinates drawn at full device resolution
    for (const c of [cv, ov]) { c.style.width = ww + 'px'; c.style.height = wh + 'px'; }
    if (gl) { gl.viewport(0, 0, R.W, R.H); setupPost(); }
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
    return { x: (cx / cw * 0.5 + 0.5) * R.VW, y: (1 - (cy / cw * 0.5 + 0.5)) * R.VH, d: cw };
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
  function tri3(t, m, a, b, c, ca, cb, cc, em) { // flat normal (forced upward), per-vertex colours
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const n = xfn(m, nx, ny, nz); grow(t, 3); vert(t, xf(m, a[0], a[1], a[2]), n, ca, em); vert(t, xf(m, b[0], b[1], b[2]), n, cb, em); vert(t, xf(m, c[0], c[1], c[2]), n, cc, em);
  }
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
  // smooth-shaded sphere / cylinder / capsule: analytic per-vertex normals for a soft, rounded look
  function sphS(t, m, r, lon, lat, col, em, sy) {
    sy = sy || 1; grow(t, lon * lat * 6);
    const P = (a, p) => [Math.cos(p) * Math.cos(a) * r, Math.sin(p) * r * sy, Math.cos(p) * Math.sin(a) * r];
    const N = (a, p) => xfn(m, Math.cos(p) * Math.cos(a) / r, Math.sin(p) / (r * sy), Math.cos(p) * Math.sin(a) / r);
    const V = (a, p) => vert(t, xf(m, ...P(a, p)), N(a, p), col, em || 0);
    for (let j = 0; j < lat; j++) { const p0 = -Math.PI / 2 + j / lat * Math.PI, p1 = -Math.PI / 2 + (j + 1) / lat * Math.PI; for (let i = 0; i < lon; i++) { const a0 = i / lon * Math.PI * 2, a1 = (i + 1) / lon * Math.PI * 2; V(a0, p0); V(a1, p0); V(a1, p1); V(a0, p0); V(a1, p1); V(a0, p1); } }
  }
  function cylS(t, m, r0, r1, h, sides, col, em, y0) {
    y0 = y0 || 0; grow(t, sides * 6);
    for (let i = 0; i < sides; i++) { const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2; const n0 = xfn(m, Math.cos(a0), (r0 - r1) / h, Math.sin(a0)), n1 = xfn(m, Math.cos(a1), (r0 - r1) / h, Math.sin(a1));
      const b0 = xf(m, Math.cos(a0) * r0, y0, Math.sin(a0) * r0), b1 = xf(m, Math.cos(a1) * r0, y0, Math.sin(a1) * r0), t0 = xf(m, Math.cos(a0) * r1, y0 + h, Math.sin(a0) * r1), t1 = xf(m, Math.cos(a1) * r1, y0 + h, Math.sin(a1) * r1);
      vert(t, b0, n0, col, em || 0); vert(t, b1, n1, col, em || 0); vert(t, t1, n1, col, em || 0); vert(t, b0, n0, col, em || 0); vert(t, t1, n1, col, em || 0); vert(t, t0, n0, col, em || 0); }
    cyl(t, M(m, mT(0, y0, 0)), r0, r0, 0.0001, sides, col, em); cyl(t, M(m, mT(0, y0 + h - 0.0001, 0)), r1, r1, 0.0001, sides, col, em);
  }
  function capsuleS(t, m, r, h, segs, col, em) { cylS(t, m, r, r, h, segs, col, em); sphS(t, M(m, mT(0, h, 0)), r, segs, 4, col, em); sphS(t, m, r, segs, 4, col, em); }
  function blade(t, m, w, h, col, em, lean) { // vertical quad (double sided via shader), base at origin
    quad(t, m, [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2 + (lean || 0), h, 0], [-w / 2 + (lean || 0), h, 0], col, em);
  }
  function blade2(t, m, w, h, cb, ct, em, lean) { // tapered vertical blade, dark base to bright tip
    const l = lean || 0, n = xfn(m, 0, 1, 0); grow(t, 6); // lit with an up normal so blades match the ground instead of going black on their shadow side
    const a = xf(m, -w / 2, 0, 0), b = xf(m, w / 2, 0, 0), c = xf(m, l + w / 6, h, 0), d = xf(m, l - w / 6, h, 0);
    vert(t, a, n, cb, em); vert(t, b, n, cb, em); vert(t, c, n, ct, em); vert(t, a, n, cb, em); vert(t, c, n, ct, em); vert(t, d, n, ct, em);
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
  // baked glTF props (js/props.js): flat-coloured triangle lists, optionally tinted
  function propMesh(t, m, name, tint) { const P = G.PROPS && G.PROPS[name]; if (!P) return false; const v = P.v; grow(t, v.length / 9); for (let i = 0; i < v.length; i += 9) { const c = tint ? [v[i + 6] * tint[0], v[i + 7] * tint[1], v[i + 8] * tint[2]] : [v[i + 6], v[i + 7], v[i + 8]]; vert(t, xf(m, v[i], v[i + 1], v[i + 2]), xfn(m, v[i + 3], v[i + 4], v[i + 5]), c, 0); } return true; }
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
    pf('grass_tuft', (t, m) => { const base = hex('#4f9a3c'), tip = hex('#a6e05a'); for (let i = 0; i < 7; i++) { const g = M(m, mT((h2(i, 5) - .5) * 0.7, 0, (h2(i, 6) - .5) * 0.7), mRY(h2(i, 7) * 6)); blade2(t, g, 0.1, 0.3 + h2(i, 8) * 0.3, base, i % 2 ? tip : sh(tip, 0.88), -1, 0.1 + h2(i, 9) * 0.08); } }); // bright tapered clump, lit like the ground
    pf('stub', (t, m) => { cyl(t, m, 0.14, 0.12, 0.2, 6, wood); });
    if (G.PROPS && G.PROPS.tree_a) { // KayKit nature props replace the procedural trees and rocks when baked
      const ore = (t, m, col, em, n, seedK) => { const collar = hex('#26222c'); for (let i = 0; i < n; i++) { const a = seedK + i * 1.9, r = 0.2 + (i % 3) * 0.09, h = 0.42 + (i % 3) * 0.14; const C = M(m, mT(Math.cos(a) * r, 0.12 + (i % 2) * 0.12, Math.sin(a) * r), mRY(a), mRX(0.3 + (i % 2) * 0.3)); cyl(t, C, 0.13 + (i % 2) * 0.03, 0.0, h, 5, col, em); cyl(t, M(C, mT(0, 0, 0)), 0.15 + (i % 2) * 0.03, 0.12, 0.08, 5, collar, 0); cyl(t, M(C, mT(0.1, 0.02, 0.07), mRZ(0.45)), 0.075, 0.0, h * 0.55, 5, sh(col, 1.2), em); cyl(t, M(C, mT(-0.08, 0.0, -0.06), mRZ(-0.4), mRX(0.2)), 0.06, 0.0, h * 0.42, 4, sh(col, 0.85), em); } };
      pf('tree', (t, m) => propMesh(t, M(m, mS(2.35)), 'tree_a', [0.7, 0.78, 0.78])); pf('tree2', (t, m) => propMesh(t, M(m, mRY(2.1), mS(2.25)), 'tree_b', [0.7, 0.78, 0.78]));
      pf('birch', (t, m) => propMesh(t, M(m, mRY(0.8), mS(2.4)), 'tree_b', [0.8, 0.86, 0.84]));
      pf('rock', (t, m) => propMesh(t, M(m, mS(2.9, 3.4, 2.9)), 'rock_c')); pf('stub', (t, m) => propMesh(t, M(m, mS(2.35)), 'stump_a'));
      pf('coal_rock', (t, m) => { propMesh(t, M(m, mS(3.1, 3.6, 3.1)), 'rock_b', [0.8, 0.8, 0.82]); ore(t, m, hex('#2a2a32'), 0.08, 5, 0.4); });
      pf('iron_vein', (t, m) => { propMesh(t, M(m, mS(3.2, 3.8, 3.2)), 'rock_d', [0.95, 0.88, 0.85]); ore(t, m, hex('#d8865a'), 0.15, 5, 1.1); });
      pf('gold_vein', (t, m) => { propMesh(t, M(m, mS(2.7, 3.6, 2.7)), 'rock_e', [1, 0.96, 0.8]); ore(t, m, hex('#ffd24a'), 0.7, 6, 0.2); });
      pf('obsidian_vein', (t, m) => { propMesh(t, M(m, mS(3.0, 3.8, 3.0)), 'rock_c', [0.45, 0.4, 0.6]); ore(t, m, hex('#b080ff'), 0.95, 5, 2.0); });
    }
    const chest = (name, col) => pf(name, (t, m) => { const c = hex(col); box(t, M(m, mT(0, 0, 0)), 0.8, 0.45, 0.55, c, 0.05); box(t, M(m, mT(0, 0.45, 0)), 0.84, 0.2, 0.6, sh(c, 1.25), 0.05); box(t, M(m, mT(0, 0.32, 0.29)), 0.12, 0.16, 0.06, hex('#ffd24a'), 0.4); for (const x of [-0.3, 0.3]) box(t, M(m, mT(x, 0.3, 0)), 0.06, 0.66, 0.6, hex('#3a3030')); });
    chest('chest_c', '#8a6a3f'); chest('chest_u', '#3a9a4a'); chest('chest_r', '#b03030'); chest('chest_l', '#d0a020');
    const altar = (name, col) => pf(name, (t, m) => { box(t, m, 1.5, 0.25, 1.5, hex('#5a5a60')); box(t, M(m, mT(0, 0.25, 0)), 1.0, 0.25, 1.0, hex('#6a6a70')); cyl(t, M(m, mT(0, 0.5, 0)), 0.22, 0.18, 1.1, 6, hex('#7a7a80')); for (let i = 0; i < 4; i++) cyl(t, M(m, mT(Math.cos(i * 1.57) * 0.6, 0.5, Math.sin(i * 1.57) * 0.6)), 0.08, 0.06, 0.5, 4, hex('#6a6a70')); const g = M(m, mT(0, 2.0, 0), mRY(0.7)); cyl(t, g, 0.28, 0, 0.4, 4, hex(col), 0.9); cyl(t, M(g, mRX(Math.PI), mT(0, 0, 0)), 0.28, 0, 0.4, 4, hex(col), 0.9); });
    altar('altar_meadow', '#30e070'); altar('altar_forest', '#3070ff'); altar('altar_volcano', '#ff3050');
    pf('boat', (t, m) => { const hull = hex('#7a4a20'); box(t, M(m, mT(0, 0.2, 0)), 3.2, 0.5, 1.3, hull); box(t, M(m, mT(1.8, 0.35, 0), mRY(0.8)), 0.9, 0.5, 0.9, hull); box(t, M(m, mT(0, 0.55, 0)), 2.9, 0.1, 1.0, hex('#9a6a30')); cyl(t, M(m, mT(-0.2, 0.6, 0)), 0.07, 0.06, 2.6, 5, hex('#5a3a20')); quad(t, M(m, mT(-0.12, 1.4, 0)), [0, 0, 0], [0, 1.6, 0], [1.3, 1.5, 0], [1.4, 0.3, 0], hex('#e8e0d0')); box(t, M(m, mT(0.9, 0.7, -0.5), mRZ(0.4)), 0.8, 0.12, 0.12, hex('#4a2a10')); });
    pf('workbench', (t, m) => { box(t, M(m, mT(0, 0.55, 0)), 1.0, 0.1, 0.6, hex('#b08040')); for (const [x, z] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) box(t, M(m, mT(x, 0, z)), 0.08, 0.55, 0.08, hex('#8a6030')); box(t, M(m, mT(-0.2, 0.6, 0)), 0.25, 0.12, 0.2, hex('#9a9ca1')); box(t, M(m, mT(0.25, 0.6, 0.1), mRY(0.5)), 0.3, 0.06, 0.06, hex('#c8c8d0')); });
    pf('casino', (t, m) => { const body = hex('#2a1040'), pink = hex('#ff4fd8'), cyan = hex('#40f0ff'), gold = hex('#ffd24a');
      box(t, M(m, mT(0, 0, 0)), 0.8, 1.5, 0.55, body); box(t, M(m, mT(0, 1.5, 0)), 0.9, 0.12, 0.62, hex('#1a0a2a')); box(t, M(m, mT(0, 1.62, 0)), 0.92, 0.24, 0.24, pink, 1.0); box(t, M(m, mT(0, 1.66, 0.13)), 0.7, 0.1, 0.02, hex('#ffffff'), 1.0);
      box(t, M(m, mT(0, 1.0, 0.27)), 0.64, 0.4, 0.04, hex('#0a0614')); for (let i = 0; i < 3; i++) box(t, M(m, mT((i - 1) * 0.2, 1.0, 0.3)), 0.16, 0.28, 0.02, [hex('#ff4060'), hex('#ffd24a'), hex('#40c0ff')][i], 0.9);
      box(t, M(m, mT(0, 0.55, 0.3)), 0.6, 0.12, 0.06, gold, 0.35); for (let i = 0; i < 4; i++) cyl(t, M(m, mT(-0.18 + i * 0.12, 0.61, 0.3)), 0.05, 0.05, 0.03 + (i % 2) * 0.03, 8, [hex('#ff4060'), hex('#40c0ff'), hex('#5aff8a'), hex('#ffffff')][i], 0.3);
      cyl(t, M(m, mT(0.46, 0.9, 0), mRZ(-0.3)), 0.03, 0.03, 0.4, 6, hex('#c0c0d0')); sph(t, M(m, mT(0.58, 1.28, 0)), 0.08, 7, 4, hex('#ff3040'), 0.4);
      for (const x of [-0.41, 0.41]) box(t, M(m, mT(x, 0.1, 0.28)), 0.03, 1.3, 0.03, cyan, 1.0); box(t, M(m, mT(0, 0.02, 0)), 0.9, 0.06, 0.65, hex('#101018'));
      for (let i = 0; i < 6; i++) box(t, M(m, mT(-0.3 + i * 0.12, 0.22, 0.29)), 0.06, 0.06, 0.02, i % 2 ? pink : cyan, 0.8); });
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
  const RAR = (q) => hex(G.RARITY_COL[q || 0]);
  function itemMesh(t, m, id, small, inst_) {
    const d = G.ITEMS[id]; if (!d && id === 'coin') { cyl(t, M(m, mRX(1.57)), 0.12, 0.12, 0.04, 8, hex('#ffd24a'), 0.5); return; }
    if (!d) return;
    const c = hex(d.col); const s = small ? 0.6 : 1; const ms = M(m, mS(s)); const dark = hex('#3a2a20'), grip = hex('#4a3010'), steel = sh(c, 1.15);
    const glow = inst_ && inst_.aff && inst_.aff.length ? RAR(inst_.q) : null;
    const gripBox = (h) => { box(t, ms, 0.06, h, 0.06, grip, 0, h / 2); if (glow) box(t, M(ms, mT(0, h * 0.5, 0)), 0.075, h * 0.35, 0.075, glow, 0.9, 0); };
    if (d.type === 'tool') {
      const wood = hex('#8a5a30'), wrap = hex('#4a3010'); cyl(t, ms, 0.04, 0.046, 0.92, 6, wood); cyl(t, M(ms, mT(0, 0.08, 0)), 0.05, 0.05, 0.22, 6, wrap); cyl(t, M(ms, mT(0, -0.03, 0)), 0.055, 0.05, 0.06, 6, wrap); if (glow) box(t, M(ms, mT(0, 0.45, 0)), 0.07, 0.25, 0.07, glow, 0.9, 0);
      if (d.tool === 'axe') { // bevelled head with a bright edge and a collar around the haft
        box(t, M(ms, mT(0, 0.8, 0)), 0.12, 0.2, 0.09, sh(c, 0.8), 0, 0); box(t, M(ms, mT(0.13, 0.8, 0)), 0.16, 0.3, 0.06, c, 0, 0);
        quad(t, ms, [0.21, 0.62, -0.03], [0.21, 0.98, -0.03], [0.34, 1.02, -0.012], [0.34, 0.58, -0.012], c, 0); quad(t, ms, [0.21, 0.62, 0.03], [0.34, 0.58, 0.012], [0.34, 1.02, 0.012], [0.21, 0.98, 0.03], c, 0);
        box(t, M(ms, mT(0.345, 0.8, 0)), 0.02, 0.46, 0.024, steel, 0.08, 0); box(t, M(ms, mT(-0.08, 0.8, 0)), 0.06, 0.12, 0.09, sh(c, 0.7), 0, 0);
      } else { // two-pronged pick: chunky centre block, tapering prongs, hardened tips
        box(t, M(ms, mT(0, 0.86, 0)), 0.14, 0.14, 0.11, sh(c, 0.8), 0, 0);
        box(t, M(ms, mT(0.2, 0.87, 0)), 0.28, 0.09, 0.07, c, 0, 0); box(t, M(ms, mT(-0.2, 0.87, 0)), 0.28, 0.09, 0.07, c, 0, 0);
        cyl(t, M(ms, mT(0.34, 0.86, 0), mRZ(-1.57)), 0.045, 0.0, 0.18, 4, steel, 0.08); cyl(t, M(ms, mT(-0.34, 0.86, 0), mRZ(1.57)), 0.045, 0.0, 0.18, 4, steel, 0.08);
      }
    }
    else if (d.type === 'weapon') {
      const kind = /dagger|fang/.test(id) ? 'dagger' : /greatsword|bonecleaver/.test(id) ? 'great' : /hammer|maul/.test(id) ? 'hammer' : /spear/.test(id) ? 'spear' : /fist/.test(id) ? 'fist' : 'sword';
      const em = d.burn || d.special ? 0.35 : 0;
      if (kind === 'sword' || kind === 'dagger' || kind === 'great') {
        const L = kind === 'dagger' ? 0.55 : kind === 'great' ? 1.4 : 0.9, w = kind === 'great' ? 0.16 : kind === 'dagger' ? 0.07 : 0.1;
        const gh = kind === 'great' ? 0.45 : 0.28, guard = hex('#7a6a38'), guardHi = hex('#a08a48');
        cyl(t, ms, 0.032, 0.036, gh, 6, grip); for (let k = 1; k < 4; k++) cyl(t, M(ms, mT(0, gh * k / 4 - 0.02, 0)), 0.04, 0.04, 0.025, 6, sh(grip, 0.7)); if (glow) box(t, M(ms, mT(0, gh * 0.5, 0)), 0.075, gh * 0.35, 0.075, glow, 0.9, 0);
        const gw = kind === 'great' ? 0.44 : kind === 'dagger' ? 0.2 : 0.32; cyl(t, M(ms, mT(gw / 2, gh, 0), mRZ(1.57)), 0.035, 0.035, gw, 6, guard); // crossguard bar
        sph(t, M(ms, mT(gw / 2, gh, 0)), 0.045, 5, 3, guardHi); sph(t, M(ms, mT(-gw / 2, gh, 0)), 0.045, 5, 3, guardHi); // knobs
        sph(t, M(ms, mT(0, -0.03, 0)), 0.055, 6, 4, guardHi); // pommel
        const y0 = gh + 0.04;
        box(t, M(ms, mT(0, y0, 0)), w, L, 0.03, c, em, L / 2);
        box(t, M(ms, mT(0, y0 + 0.05, 0)), w * 0.3, L * 0.7, 0.036, sh(c, 0.72), em, L * 0.35); // fuller groove
        box(t, M(ms, mT(w * 0.5, y0, 0)), 0.012, L, 0.02, steel, em, L / 2); box(t, M(ms, mT(-w * 0.5, y0, 0)), 0.012, L, 0.02, steel, em, L / 2); // edges
        cyl(t, M(ms, mT(0, y0 + L, 0), mS(w / 0.1, 1, 0.3)), 0.1, 0, 0.22, 4, c, em); // tip
        if (id === 'hollow_blade') box(t, M(ms, mT(0, y0 + L * 0.5, 0)), w * 1.6, L * 0.9, 0.005, hex('#8090ff'), 1.0, 0);
      } else if (kind === 'hammer') {
        box(t, ms, 0.07, 1.0, 0.07, hex('#6a4a20'), 0, 0.5); if (glow) box(t, M(ms, mT(0, 0.3, 0)), 0.09, 0.3, 0.09, glow, 0.9, 0);
        box(t, M(ms, mT(0, 1.0, 0)), 0.5, 0.32, 0.32, c, em, 0); box(t, M(ms, mT(0.28, 1.0, 0)), 0.08, 0.36, 0.36, steel, em, 0); box(t, M(ms, mT(-0.28, 1.0, 0)), 0.08, 0.36, 0.36, steel, em, 0);
        if (id === 'gronk_hammer') for (let k = 0; k < 4; k++) cyl(t, M(ms, mT((k - 1.5) * 0.12, 1.16, 0)), 0.05, 0, 0.14, 4, hex('#eae6d6'));
        if (id === 'frost_maul') for (let k = 0; k < 3; k++) cyl(t, M(ms, mT((k - 1) * 0.15, 1.16, 0)), 0.06, 0, 0.22, 4, hex('#e0f8ff'), 0.9);
      } else if (kind === 'spear') { box(t, ms, 0.05, 1.7, 0.05, hex('#8a5a30'), 0, 0.85); if (glow) box(t, M(ms, mT(0, 0.5, 0)), 0.07, 0.3, 0.07, glow, 0.9, 0); cyl(t, M(ms, mT(0, 1.7, 0), mS(1, 1, 0.35)), 0.1, 0, 0.45, 4, c, em); }
      else if (kind === 'fist') { box(t, ms, 0.3, 0.3, 0.3, c, 0.3, 0.15); box(t, M(ms, mT(0, 0.3, 0)), 0.36, 0.2, 0.36, steel, 0.4, 0); for (let k = 0; k < 3; k++) box(t, M(ms, mT((k - 1) * 0.11, 0.45, 0.1)), 0.09, 0.14, 0.09, steel, 0.4, 0); }
    }
    else if (d.type === 'bow') { const cross = /crossbow/.test(id); if (cross) { box(t, ms, 0.06, 0.9, 0.06, hex('#6a4a20'), 0, 0.45); box(t, M(ms, mT(0, 0.75, 0)), 0.8, 0.05, 0.05, c, 0, 0); box(t, M(ms, mT(0, 0.55, 0)), 0.01, 0.4, 0.01, hex('#e0e0e0')); } else { for (let i = -2; i <= 2; i++) box(t, M(ms, mT(-Math.abs(i) * 0.06 + 0.1, i * 0.2, 0), mRZ(i * 0.35)), 0.05, 0.24, 0.05, c, id === 'venom_bow' ? 0.4 : 0); box(t, M(ms, mT(-0.1, 0, 0)), 0.012, 0.95, 0.012, hex('#e0e0e0')); if (glow) box(t, M(ms, mT(0.1, 0, 0)), 0.08, 0.14, 0.08, glow, 0.9, 0); } }
    else if (d.type === 'staff') { box(t, ms, 0.06, 1.3, 0.06, hex('#5a3a20'), 0, 0.65); for (let k = 0; k < 3; k++) box(t, M(ms, mT(0, 1.3, 0), mRY(k * 2.09), mT(0.08, 0, 0), mRZ(-0.5)), 0.04, 0.25, 0.04, hex('#5a3a20')); sph(t, M(ms, mT(0, 1.45, 0)), 0.13, 6, 4, c, 1.0); if (glow) box(t, M(ms, mT(0, 0.5, 0)), 0.08, 0.3, 0.08, glow, 0.9, 0); }
    else if (d.type === 'shield') { const big = id === 'warden_shield'; box(t, ms, big ? 0.8 : 0.65, big ? 1.1 : 0.85, 0.07, c, 0, 0); box(t, M(ms, mT(0, 0, 0.05)), 0.1, big ? 0.9 : 0.6, 0.04, steel, big ? 0.4 : 0); box(t, M(ms, mT(0, 0, 0.05)), big ? 0.6 : 0.45, 0.08, 0.04, steel, 0); for (const [x, y] of [[-0.25, 0.3], [0.25, 0.3], [-0.25, -0.3], [0.25, -0.3]]) sph(t, M(ms, mT(x, y, 0.05)), 0.03, 4, 2, hex('#3a3030')); }
    else if (d.type === 'armor') { if (d.slot === 'head') { sph(t, M(ms, mT(0, 0.2, 0)), 0.24, 7, 4, c, d.unique ? 0.3 : 0, 0.8); box(t, M(ms, mT(0.16, 0.12, 0)), 0.14, 0.08, 0.3, hex('#14121a'), 0, 0); } else if (d.slot === 'chest') { box(t, ms, 0.5, 0.55, 0.32, c, d.unique ? 0.3 : 0, 0.27); box(t, M(ms, mT(0, 0.42, 0)), 0.62, 0.12, 0.36, sh(c, 0.85), 0, 0); } else if (d.slot === 'legs') { box(t, M(ms, mT(0, 0, -0.1)), 0.18, 0.5, 0.16, c, d.unique ? 0.3 : 0, 0.25); box(t, M(ms, mT(0, 0, 0.1)), 0.18, 0.5, 0.16, c, d.unique ? 0.3 : 0, 0.25); box(t, M(ms, mT(0, 0.5, 0)), 0.42, 0.14, 0.4, sh(c, 0.85), 0, 0); } else { cyl(t, M(ms, mT(0, 0.25, 0)), 0.22, 0.22, 0.03, 10, hex('#8a7a50')); sph(t, M(ms, mT(0, 0.1, 0)), 0.1, 6, 4, c, 0.8); } }
    else if (d.type === 'food') { sph(t, ms, 0.18, 6, 4, c); }
    else if (d.type === 'gem') { cyl(t, ms, 0.2, 0, 0.3, 4, c, 0.9); cyl(t, M(ms, mRX(Math.PI)), 0.2, 0, 0.3, 4, c, 0.9); }
    else if (d.type === 'key') { box(t, ms, 0.08, 0.9, 0.08, hex('#6a4a30'), 0, 0.45); box(t, M(ms, mT(0, 0.7, 0)), 0.3, 0.2, 0.2, c, 0.3, 0); box(t, M(ms, mT(0, 0.35, 0)), 0.25, 0.15, 0.15, c, 0.3, 0); }
    else if (d.type === 'arrow') { box(t, ms, 0.03, 0.8, 0.03, hex('#d8c8a8'), 0, 0.4); cyl(t, M(ms, mT(0, 0.8, 0)), 0.05, 0, 0.12, 4, hex('#9a9ca1')); box(t, M(ms, mT(0, 0.05, 0)), 0.02, 0.12, 0.1, hex('#e05050'), 0, 0); }
    else if (d.type === 'place') { const pf_ = PF[d.obj]; if (pf_) inst(t, pf_, M(m, mS(s * (d.obj === 'torch' ? 0.8 : 0.4)))); }
    else { box(t, M(ms, mRY(0.4)), 0.25, 0.25, 0.25, c, 0, 0.12); }
  }

  // ================= creatures (capsule rigs) =================
  function capsule(t, m, r, h, segs, col, em) { cyl(t, m, r, r, h, segs, col, em); sph(t, M(m, mT(0, h, 0)), r, segs, 3, col, em, 0.7); sph(t, m, r, segs, 3, col, em, 0.7); }
  // blob character facing local +X, base at y=0: an egg body that is also the head, big cartoon eyes,
  // stubby arms with mitten hands, little feet, hats instead of helmets. o: h (height), body, skin, ...
  function humanoid(t, m, o) {
    const h = o.h || 1.2; const s = h / 1.2; const sq = o.hit ? 0.92 : 1; const ms = M(m, mS(s * (2 - sq), s * sq, s * (2 - sq)));
    const ph = o.anim || 0, mv = o.moving ? 1 : 0; const bob = Math.abs(Math.sin(ph)) * 0.06 * mv, lean = mv * 0.1, wob = Math.sin(ph) * 0.06 * mv;
    const body = o.body, skin = o.skin || o.body, FL = o.flash ? [1, 1, 1] : null; const C = (c) => FL || c;
    const R0 = 0.34, BY = 0.58; // body radius & centre height (body height ~0.98)
    const root = M(ms, mT(0, bob, 0), mRZ(-lean), mRX(wob));
    // feet
    for (const side of [-1, 1]) sphS(t, M(root, mT(0.04 + Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 0.12 * mv, 0.07, side * 0.16)), 0.11, 8, 4, C(o.legcol || sh(body, 0.6)), 0, 0.6);
    // body (egg) + belly/vest band for armour
    sphS(t, M(root, mT(0, BY, 0)), R0, 12, 8, C(body), 0, 1.4);
    if (o.chest) sphS(t, M(root, mT(0, BY - 0.12, 0)), R0 * 1.04, 12, 6, C(o.chest), o.uniqueChest ? 0.25 : 0, 0.55);
    // eyes: big white spheres with pupils looking forward
    for (const side of [-1, 1]) { const ex = M(root, mT(R0 * 0.82, BY + 0.2, side * 0.13)); sphS(t, ex, 0.095, 8, 5, [1, 1, 1]); sphS(t, M(ex, mT(0.06, 0.0, side * -0.005)), 0.05, 6, 4, hex('#14121a')); if (o.wind || o.hit) sphS(t, M(ex, mT(0.02, 0.09, 0)), 0.1, 6, 3, C(body), 0, 0.3); }
    // brows / angry look for hostile
    if (o.angry) for (const side of [-1, 1]) box(t, M(root, mT(R0 * 0.8, BY + 0.33, side * 0.13), mRX(side * 0.4)), 0.04, 0.03, 0.14, hex('#14121a'), 0, 0);
    // arms
    const swing = o.swing; const wind = o.wind ? 1 : 0;
    for (const side of [-1, 1]) {
      let rot = Math.sin(ph) * 0.5 * mv * side; let rx = side * 0.55;
      if (side === 1) { if (swing !== null && swing !== undefined) rot = -2.2 + Math.sin(Math.min(1, swing) * Math.PI) * 2.4; else if (wind) rot = -2.2 + Math.sin(nowT * 20) * 0.08; else if (o.held) rot = -0.7; }
      if (side === -1 && (o.block || o.shield)) { rot = -1.2; rx = -0.2; }
      if (o.bow) { rot = -1.5; rx = side * 0.15; }
      const arm = M(root, mT(0.05, BY + 0.02, side * (R0 - 0.02)), mRX(rx), mRZ(rot));
      capsuleS(t, M(arm, mT(0, -0.26, 0)), 0.065, 0.22, 7, C(body));
      sphS(t, M(arm, mT(0, -0.3, 0)), 0.095, 7, 4, C(skin));
      if (side === 1 && o.held) itemMesh(t, M(arm, mT(0.06, -0.34, 0), mRZ(-1.5)), o.held, true, o.heldInst);
      if (side === -1 && o.shield) itemMesh(t, M(arm, mT(0.12, -0.25, 0), mRY(1.57)), o.shieldId || 'shield_wood', true);
    }
    // headwear: helmets become hats, hair a cap, crown, ears
    const top = M(root, mT(-0.02, BY + R0 * 1.4 - 0.05, 0));
    if (o.helm) { if (/crown/.test(o.helmId || '')) for (let i = 0; i < 6; i++) box(t, M(top, mT(Math.cos(i * 1.05) * 0.16, 0.1, Math.sin(i * 1.05) * 0.16)), 0.05, 0.16, 0.05, hex('#ffd24a'), 0.5); else { cylS(t, M(top, mT(0, -0.02, 0)), 0.42, 0.42, 0.04, 12, C(sh(o.helm, 0.8)), o.uniqueHelm ? 0.2 : 0); cylS(t, M(top, mT(0, 0.02, 0)), 0.26, 0.23, 0.28, 12, C(o.helm), o.uniqueHelm ? 0.25 : 0); } }
    else if (o.hair) sphS(t, M(top, mT(-0.05, -0.06, 0)), R0 * 0.72, 10, 4, C(o.hair), 0, 0.5);
    if (o.crown) for (let i = 0; i < 6; i++) box(t, M(top, mT(Math.cos(i * 1.05) * 0.16, 0.1, Math.sin(i * 1.05) * 0.16)), 0.05, 0.16, 0.05, hex('#ffd24a'), 0.4);
    if (o.ears) for (const side of [-1, 1]) sphS(t, M(root, mT(-0.02, BY + 0.25, side * (R0 + 0.06)), mRX(side * 0.6)), 0.1, 6, 4, C(skin), 0, 1.8);
    if (o.fez) cylS(t, M(top, mT(0, -0.02, 0)), 0.22, 0.18, 0.26, 10, hex('#c02030'));
  }
  function quadruped(t, m, o) {
    const s = o.s || 1; const ms = M(m, mS(s)); const c = o.col, d = sh(o.col, 0.75), FL = o.flash ? [1, 1, 1] : null; const C = (x) => FL || x;
    const ph = o.anim || 0, mv = o.moving ? 1 : 0; const bob = Math.abs(Math.sin(ph)) * 0.06 * mv;
    const root = M(ms, mT(0, bob, 0));
    capsuleS(t, M(root, mT(-0.4, 0.5, 0), mRZ(-1.57)), 0.21, 0.75, 10, C(c)); // body along +X
    sphS(t, M(root, mT(0.5, 0.62, 0)), 0.23, 10, 6, C(c)); sphS(t, M(root, mT(0.7, 0.56, 0)), 0.11, 8, 4, C(d), 0, 0.8);
    for (const z of [-0.1, 0.1]) { sphS(t, M(root, mT(0.45, 0.82, z * 1.4), mRX(z * 4)), 0.07, 6, 4, C(d), 0, 1.6); const ey = M(root, mT(0.66, 0.68, z)); sphS(t, ey, 0.06, 7, 4, [1, 1, 1]); sphS(t, M(ey, mT(0.04, 0, 0)), 0.03, 5, 3, hex('#14121a')); }
    for (const [x, z, p2] of [[0.3, -0.12, 0], [0.3, 0.12, Math.PI], [-0.3, -0.12, Math.PI], [-0.3, 0.12, 0]]) capsuleS(t, M(root, mT(x, 0.45, z), mRZ(Math.sin(ph + p2) * 0.7 * mv), mT(0, -0.42, 0)), 0.065, 0.36, 6, C(d));
    capsuleS(t, M(root, mT(-0.8, 0.6, 0), mRZ(1.0 + Math.sin(ph * 0.5) * 0.3)), 0.045, 0.32, 5, C(d));
  }
  function spider(t, m, o) {
    const s = o.s || 1; const ms = M(m, mS(s)); const c = o.col, FL = o.flash ? [1, 1, 1] : null; const C = (x) => FL || x; const ph = o.anim || 0;
    sph(t, M(ms, mT(-0.3, 0.55, 0)), 0.5, 8, 5, C(c), 0, 0.8); sph(t, M(ms, mT(0.35, 0.5, 0)), 0.3, 7, 4, C(sh(c, 1.2)));
    for (const z of [-0.12, 0.12, -0.05, 0.05]) sph(t, M(ms, mT(0.6, 0.6 + (Math.abs(z) < 0.1 ? 0.06 : 0), z)), Math.abs(z) < 0.1 ? 0.045 : 0.06, 5, 3, [1, 0.2, 0.2], 0.9);
    for (let i = 0; i < 4; i++) for (const side of [-1, 1]) { const a = (i - 1.5) * 0.5; const lift = Math.sin(ph * 2 + i * 1.6 + (side > 0 ? 0 : Math.PI)) * 0.2 * (o.moving ? 1 : 0.1); const hip = M(ms, mT(-0.3 + Math.cos(a) * 0.3, 0.6, side * 0.35), mRY(side * (0.9 - i * 0.6)), mRX(side * (-0.8 + lift))); capsule(t, hip, 0.045, 0.6, 4, C(sh(c, 0.7))); capsule(t, M(hip, mT(0, 0.6, 0), mRX(side * 1.9)), 0.035, 0.7, 4, C(sh(c, 0.6))); }
    cyl(t, M(ms, mT(0.6, 0.42, -0.08), mRX(Math.PI)), 0.04, 0, 0.18, 4, hex('#eae6d6')); cyl(t, M(ms, mT(0.6, 0.42, 0.08), mRX(Math.PI)), 0.04, 0, 0.18, 4, hex('#eae6d6'));
  }
  function creature(t, m, e, V, corpse) {
    if (enemyModel(e, m, V, R.dt || 0.016, corpse)) return;
    const d = G.ENEMIES[e.t]; const col = hex(d.col); const anim = nowT * 8 + e.id; const moving = /chase|charge|lunge|circle|pounce/.test(e.st);
    const isWind = /wind$/.test(e.st); const wob = isWind ? 1 + Math.sin(nowT * 25) * 0.05 : 1;
    const fm = M(m, mS(wob * (d.boss ? 0.85 : 0.78))); const FL = !!e.flash; const C = (c) => FL ? [1, 1, 1] : c;
    const striking = e.st === 'cool' && (e.tm || 0) > 0.6; const sw = isWind ? null : (striking ? 0.5 : null);
    switch (e.t) {
      case 'slime': case 'slime_small': { const r = e.t === 'slime' ? 0.45 : 0.25; const b = Math.abs(Math.sin(nowT * 5 + e.id)); sphS(t, M(fm, mT(0, r * 0.7 + b * 0.15, 0), mS(1 + b * 0.1, 0.7 + b * 0.25, 1 + b * 0.1)), r, 12, 7, C(col), FL ? 1 : 0.15); for (const z of [-0.3, 0.3]) { sphS(t, M(fm, mT(r * 0.75, r * 0.85, z * r)), r * 0.2, 7, 4, [1, 1, 1]); sphS(t, M(fm, mT(r * 0.9, r * 0.85, z * r)), r * 0.1, 5, 3, hex('#14121a')); } break; }
      case 'goblin': humanoid(t, fm, { h: 0.9, body: hex('#7aa040'), skin: hex('#8ab850'), legcol: hex('#4a5a20'), anim, moving, ears: true, angry: true, held: 'sword_wood', swing: sw, wind: isWind, flash: FL }); break;
      case 'goblin_archer': humanoid(t, fm, { h: 0.9, body: hex('#8aa848'), skin: hex('#8ab850'), legcol: hex('#4a5a20'), anim, moving, ears: true, angry: true, hair: hex('#4a3020'), held: 'bow_wood', bow: true, flash: FL }); break;
      case 'skeleton': humanoid(t, fm, { h: 1.1, body: hex('#e8e8e0'), skin: hex('#f0f0e8'), legcol: hex('#d0d0c8'), anim, moving, angry: true, held: 'sword_stone', shield: true, swing: sw, wind: isWind, flash: FL }); break;
      case 'spiderling': spider(t, fm, { s: 0.35, col, anim, moving, flash: FL }); break;
      case 'wolf': quadruped(t, fm, { col, anim, moving, flash: FL }); break;
      case 'wolf_pet': quadruped(t, fm, { col, anim, moving, flash: FL }); box(t, M(fm, mT(0.5, 0.62, 0)), 0.3, 0.06, 0.44, hex('#ff4040'), 0, 0); break;
      case 'treant': { const arm = isWind ? -2.4 : 0.3; cyl(t, fm, 0.5, 0.35, 1.6, 7, C(hex('#5a3a20'))); for (const s2 of [-1, 1]) cyl(t, M(fm, mT(0, 1.3, s2 * 0.45), mRX(s2 * (Math.PI / 2 - arm * 0.5)), mRZ(arm)), 0.12, 0.08, 1.1, 5, C(hex('#6b4426'))); sph(t, M(fm, mT(0, 2.1, 0)), 0.85, 7, 4, C(col), 0, 0.8); sph(t, M(fm, mT(0.3, 2.5, 0.2)), 0.5, 6, 3, C(sh(col, 1.2))); for (const z of [-0.15, 0.15]) sph(t, M(fm, mT(0.45, 1.2, z)), 0.07, 5, 3, [1, 0.9, 0.25], 1); for (const s2 of [-1, 1]) box(t, M(fm, mT(-0.1, 0, s2 * 0.35)), 0.5, 0.25, 0.25, C(hex('#4a2a18')), 0, 0.12); break; }
      case 'crawler': { for (let i = 0; i < 4; i++) { const ph = anim + i * 0.9; sph(t, M(fm, mT(-i * 0.3 + 0.35, 0.28 + Math.abs(Math.sin(ph)) * 0.08, Math.sin(ph) * 0.05)), 0.26 - i * 0.03, 7, 4, i % 2 ? C(col) : C(sh(col, 0.6)), FL ? 1 : (i % 2 ? 0.6 : 0.1)); for (const s2 of [-1, 1]) capsule(t, M(fm, mT(-i * 0.3 + 0.35, 0.2, s2 * 0.25), mRX(s2 * 1.2), mRZ(Math.sin(ph) * 0.5)), 0.035, 0.3, 4, C(sh(col, 0.5))); } for (const z of [-0.1, 0.1]) sph(t, M(fm, mT(0.55, 0.42, z)), 0.05, 5, 3, [1, 0.9, 0.25], 1); break; }
      case 'bat': { const fl = Math.sin(nowT * 18 + e.id); const bm = M(fm, mT(0, 1.3 + Math.sin(nowT * 6 + e.id) * 0.15, 0)); sph(t, bm, 0.13, 6, 4, C(col)); for (const s2 of [-1, 1]) quad(t, M(bm, mT(0, 0.05, s2 * 0.09), mRX(s2 * fl * 0.9)), [-0.12, 0, 0], [0.12, 0, 0], [0.05, 0.05, s2 * 0.5], [-0.15, 0.05, s2 * 0.5], C(sh(col, 0.9)), 0); for (const z of [-0.05, 0.05]) sph(t, M(bm, mT(0.11, 0.03, z)), 0.02, 4, 2, [1, 0.25, 0.25], 1); break; }
      case 'tentacle': { const sway = Math.sin(nowT * 2 + e.id) * 0.25; let mm = M(fm, mT(0, -0.3, 0)); for (let i = 0; i < 5; i++) { cyl(t, mm, 0.32 - i * 0.05, 0.28 - i * 0.05, 0.5, 7, C(i % 2 ? col : sh(col, 1.2))); mm = M(mm, mT(0, 0.5, 0), mRZ(sway * (isWind ? 2.5 : 1)), mRX(sway * 0.5)); for (const k of [0.3, -0.3]) sph(t, M(mm, mT(k, 0.1, 0.2)), 0.05, 5, 3, hex('#80c0ff'), 0.6); } break; }
      // ---- bosses ----
      case 'gronk': humanoid(t, fm, { h: 2.7, body: hex('#6a8a40'), skin: hex('#8aa050'), legcol: hex('#4a4a30'), anim, moving, held: 'gronk_hammer', swing: sw, wind: isWind, ears: true, angry: true, flash: FL }); break;
      case 'hollow': humanoid(t, fm, { h: 2.3, body: hex('#202048'), skin: hex('#e8e8e0'), legcol: hex('#101030'), anim, moving, crown: true, angry: true, held: 'hollow_blade', swing: sw, wind: isWind, flash: FL }); quad(t, M(fm, mT(-0.3, 2.0, 0)), [0, 0, -0.45], [0, 0, 0.45], [-0.45 + Math.sin(nowT * 3) * 0.1, -1.9, 0.55], [-0.45 + Math.sin(nowT * 3) * 0.1, -1.9, -0.55], C(hex('#2a2a60')), 0); break;
      case 'bonecrusher': humanoid(t, fm, { h: 2.6, body: hex('#e0e0d0'), skin: hex('#eae6d6'), legcol: hex('#c8c8c0'), anim, moving, angry: true, held: 'bonecleaver', swing: sw, wind: isWind, flash: FL }); for (let i = 0; i < 3; i++) box(t, M(fm, mT(0.36, 1.2 + i * 0.25, 0)), 0.04, 0.06, 0.7, C(hex('#c0c0b8')), 0, 0); break;
      case 'warden': humanoid(t, fm, { h: 2.2, body: hex('#8090b0'), skin: hex('#606880'), legcol: hex('#505870'), anim, moving, angry: true, helm: hex('#8090b0'), chest: hex('#9aa8c8'), held: 'greatsword_iron', shield: true, shieldId: 'warden_shield', swing: sw, wind: isWind, block: true, flash: FL }); break;
      case 'matriarch': spider(t, fm, { s: 1.9, col, anim, moving, flash: FL }); break;
      case 'frostmaw': quadruped(t, fm, { s: 2.2, col, anim, moving, flash: FL }); for (let k = 0; k < 4; k++) cyl(t, M(fm, mT(-0.3 + k * 0.3, 1.55, 0)), 0.08, 0, 0.35, 4, hex('#e0f8ff'), 0.7); break;
      case 'lich': humanoid(t, fm, { h: 2.1, body: hex('#6040c0'), skin: hex('#c0c0e0'), legcol: hex('#30206a'), anim, moving, angry: true, held: 'lich_staff', crown: true, wind: isWind, flash: FL }); sph(t, M(fm, mT(0, 2.3, 0)), 0.55, 8, 4, C(hex('#40308a')), 0.15, 0.4); break;
      case 'titan': humanoid(t, fm, { h: 3.6, body: hex('#7080a0'), skin: hex('#8898b8'), legcol: hex('#505868'), anim: anim * 0.6, moving, angry: true, held: null, swing: sw, wind: isWind, flash: FL }); for (let i = 0; i < 4; i++) box(t, M(fm, mT(-0.2, 2.3 + (i % 2) * 0.5, (i - 1.5) * 0.4), mRY(i)), 0.4, 0.4, 0.4, C(hex('#606878')), 0, 0); sph(t, M(fm, mT(0.35, 2.55, 0)), 0.16, 6, 4, [1, 0.6, 0.2], 1.0); break;
      case 'cinder': { for (let i = 0; i < 6; i++) { const ph = anim * 0.6 + i * 0.8; sph(t, M(fm, mT(-i * 0.75 + 1.5, 0.6 + Math.abs(Math.sin(ph)) * 0.25, Math.sin(ph) * 0.15)), 0.7 - i * 0.06, 8, 5, i % 2 ? C(col) : C(sh(col, 0.55)), FL ? 1 : (i % 2 ? 0.7 : 0.15)); } sph(t, M(fm, mT(1.9, 0.9, 0)), 0.75, 8, 5, C(sh(col, 1.1)), FL ? 1 : 0.5); for (const z of [-0.25, 0.25]) sph(t, M(fm, mT(2.5, 1.1, z)), 0.12, 6, 4, [1, 0.9, 0.25], 1); for (let k = 0; k < 4; k++) cyl(t, M(fm, mT(2.5, 0.55, (k - 1.5) * 0.25), mRX(Math.PI)), 0.07, 0, 0.3, 4, hex('#fff')); break; }
      case 'leviathan': { const bob = Math.sin(nowT * 1.5) * 0.15; const bm = M(fm, mT(0, -1.0 + bob, 0)); sph(t, bm, 2.2, 10, 6, C(col), 0, 0.75); sph(t, M(bm, mT(0.6, 1.0, 0)), 1.5, 9, 5, C(sh(col, 1.3)), 0, 0.7); for (const z of [-0.7, 0.7]) { sph(t, M(bm, mT(1.8, 1.4, z)), 0.3, 7, 4, [1, 0.9, 0.25], 1); sph(t, M(bm, mT(2.05, 1.4, z)), 0.12, 5, 3, hex('#14121a')); } for (let k = 0; k < 7; k++) cyl(t, M(bm, mT(2.0, 0.6, (k - 3) * 0.35), mRX(Math.PI)), 0.1, 0, 0.5, 4, hex('#e0f0ff')); for (let k = 0; k < 6; k++) { const a = k * 1.05 + nowT * 0.3; let mm = M(bm, mT(Math.cos(a) * 2.0, 0.2, Math.sin(a) * 2.0)); for (let i = 0; i < 4; i++) { cyl(t, mm, 0.3 - i * 0.06, 0.25 - i * 0.06, 0.8, 6, C(sh(col, 0.9))); mm = M(mm, mT(0, 0.8, 0), mRX(Math.sin(nowT * 2 + k + i) * 0.35), mRZ(Math.cos(nowT * 1.7 + k) * 0.3)); } } break; }
      default: humanoid(t, fm, { h: 1, body: col, anim, moving, flash: FL });
    }
    if (e.elite) { cyl(t, M(m, mT(0, 0.02, 0)), e.r * 1.5, e.r * 1.5, 0.03, 12, hex('#c060ff'), 1.0); for (let k = 0; k < 3; k++) { const a = nowT * 2 + k * 2.09; sph(t, M(m, mT(Math.cos(a) * e.r * 1.4, 0.6 + Math.sin(nowT * 4 + k) * 0.2, Math.sin(a) * e.r * 1.4)), 0.07, 5, 3, hex('#c060ff'), 1.0); } }
  }

  // ================= terrain & static object chunks =================
  // colour of a tile with its per-tile variation; corners blend the four surrounding tiles for a painterly, non-gridded ground
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };
  function tileCol(world, X, Y) { if (X < 0 || Y < 0 || X >= W || Y >= W) return [0.1, 0.25, 0.5]; const tile = world.tiles[Y * W + X]; const r = h2(X, Y); let c = hex(G.TILE_INFO[tile].col);
    if (tile === T.GRASS || tile === T.DARKGRASS) { // meadows are patchy: warm sunlit swathes and cooler dips instead of one flat green
      const n = vn(X / 6.5 + 7, Y / 6.5 + 3), n2 = vn(X / 17 + 40, Y / 17); const warm = tile === T.GRASS ? [0.64, 0.8, 0.3] : [0.3, 0.52, 0.26]; const k = G.clamp((n - 0.5) * 1.6 + 0.5, 0, 1) * 0.55;
      c = [c[0] + (warm[0] - c[0]) * k, c[1] + (warm[1] - c[1]) * k, c[2] + (warm[2] - c[2]) * k]; return sh(c, 0.9 + r * 0.08 + (n2 - 0.5) * 0.2); }
    return sh(c, 0.92 + r * 0.16); }
  function cornerCol(world, X, Y) { const a = tileCol(world, X - 1, Y - 1), b = tileCol(world, X, Y - 1), c = tileCol(world, X - 1, Y), d = tileCol(world, X, Y); return [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4]; }
  function buildChunk(world, cxI, cyI) {
    const t = { arr: new Float32Array(CH * CH * 6 * VF), n: 0 }, w = { arr: new Float32Array(CH * CH * 6 * VF), n: 0 }, ob = { arr: new Float32Array(VF * 3 * 6000), n: 0 }, sb = { arr: new Float32Array(VF * 3 * 1200), n: 0 };
    const I = m4();
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const X = cxI * CH + tx, Y = cyI * CH + ty; if (X >= W || Y >= W) continue;
      const tile = world.tiles[Y * W + X];
      const h00 = cornerH(world, X, Y), h10 = cornerH(world, X + 1, Y), h01 = cornerH(world, X, Y + 1), h11 = cornerH(world, X + 1, Y + 1);
      const em = tile === T.LAVA ? 1.0 : 0;
      const own = tileCol(world, X, Y);
      // corners blend neighbours, but keep hard edges against water/lava/sand so beaches and shores stay crisp
      const blend = (cc) => tile <= T.SAND || tile === T.LAVA ? own : [own[0] * 0.45 + cc[0] * 0.55, own[1] * 0.45 + cc[1] * 0.55, own[2] * 0.45 + cc[2] * 0.55];
      const c00 = blend(cornerCol(world, X, Y)), c10 = blend(cornerCol(world, X + 1, Y)), c01 = blend(cornerCol(world, X, Y + 1)), c11 = blend(cornerCol(world, X + 1, Y + 1));
      const a = [X, h00, Y], b = [X + 1, h10, Y], c = [X + 1, h11, Y + 1], d = [X, h01, Y + 1];
      const n00 = cornerN(world, X, Y), n10 = cornerN(world, X + 1, Y), n01 = cornerN(world, X, Y + 1), n11 = cornerN(world, X + 1, Y + 1);
      const smooth = tile > T.SAND && tile !== T.LAVA; // beaches and lava keep crisp facets, grass and rock roll smoothly over hills
      const put = (p, n, col) => vert(t, p, n, col, em);
      if (!smooth) { if ((X + Y) % 2) { tri3(t, I, a, c, b, c00, c11, c10, em); tri3(t, I, a, d, c, sh(c00, 0.97), sh(c01, 0.97), sh(c11, 0.97), em); } else { tri3(t, I, a, d, b, c00, c01, c10, em); tri3(t, I, b, d, c, sh(c10, 0.97), sh(c01, 0.97), sh(c11, 0.97), em); } }
      else { grow(t, 6); if ((X + Y) % 2) { put(a, n00, c00); put(c, n11, c11); put(b, n10, c10); put(a, n00, c00); put(d, n01, c01); put(c, n11, c11); } else { put(a, n00, c00); put(d, n01, c01); put(b, n10, c10); put(b, n10, c10); put(d, n01, c01); put(c, n11, c11); } }
      if (tile <= T.WATER) { const wc = tile === T.DEEP ? [0.12, 0.3, 0.6] : [0.22, 0.5, 0.8]; quad(w, I, [X, WATER_Y, Y], [X, WATER_Y, Y + 1], [X + 1, WATER_Y, Y + 1], [X + 1, WATER_Y, Y], wc, 0.05, [X + .5, -100, Y + .5]); }
      const o = world.objs.get(Y * W + X);
      if (o) { staticObject(ob, world, o, X, Y); const d2 = O[o.t]; if (d2.solid && !d2.wall && !d2.floor) { const gz = R.groundZ(world, X + .5, Y + .5); cyl(sb, M(mT(X + .5, gz + 0.012, Y + .5)), d2.tall ? 0.75 : (d2.isChest ? 0.5 : 0.55), d2.tall ? 0.75 : 0.5, 0.005, 8, [0, 0, 0], 0); } }
      // grass tufts on open grass: cheap blades that make the ground read as lush instead of flat
      if ((tile === T.GRASS || tile === T.DARKGRASS) && !o) { const n = tile === T.GRASS ? 2 : 3; for (let k = 0; k < n; k++) { const gx = X + 0.12 + h2(X * 3 + k, Y) * 0.76, gy = Y + 0.12 + h2(X, Y * 5 + k) * 0.76; const gz = R.groundZ(world, gx, gy); const g = M(mT(gx, gz, gy), mRY(h2(X + k, Y + 11) * 6.28)); const hv = h2(X, Y + k); const base = sh(own, 0.82), tip = sh(own, 1.28 + (k % 2) * 0.12 + hv * 0.1); blade2(ob, g, 0.1, 0.22 + hv * 0.3, base, tip, -1, 0.08 + hv * 0.06); blade2(ob, M(g, mRY(1.3), mT(0.04, 0, 0)), 0.08, 0.16 + h2(X + 1, Y + k) * 0.2, base, sh(tip, 0.92), -1, -0.07); } }
      if ((tile === T.GRASS || tile === T.DARKGRASS) && !o) { const dh = h2(X * 7 + 3, Y * 11 + 5); // flowers and pebbles dress the meadow (no collision, baked into the chunk)
        if (dh < 0.07) { const fx = X + 0.2 + h2(X, Y + 21) * 0.6, fy = Y + 0.2 + h2(X + 21, Y) * 0.6, fz = R.groundZ(world, fx, fy); const fc = [hex('#ff5a7a'), hex('#ffd24a'), hex('#f4f4ff'), hex('#b07aff')][Math.floor(h2(X + 2, Y + 2) * 4)]; const g = M(mT(fx, fz, fy)); blade(ob, g, 0.04, 0.24, sh(own, 0.8), 0, 0.02); box(ob, M(g, mT(0.02, 0.26, 0)), 0.11, 0.05, 0.11, fc, 0.15, 0); box(ob, M(g, mT(0.02, 0.26, 0), mRY(0.78)), 0.11, 0.045, 0.11, sh(fc, 1.1), 0.15, 0); box(ob, M(g, mT(0.02, 0.29, 0)), 0.04, 0.03, 0.04, hex('#ffe680'), 0.3, 0); }
        else if (dh > 0.955) { const px = X + 0.2 + h2(X, Y + 31) * 0.6, py = Y + 0.2 + h2(X + 31, Y) * 0.6, pz = R.groundZ(world, px, py); box(ob, M(mT(px, pz, py), mRY(h2(X, Y + 41) * 3)), 0.16, 0.08, 0.12, hex('#8a8e96'), 0, 0.03); box(ob, M(mT(px + 0.12, pz, py + 0.08), mRY(h2(X, Y + 43) * 3)), 0.09, 0.05, 0.08, hex('#a0a4ac'), 0, 0.02); } }
    }
    const mk = (src) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, src.arr.subarray(0, src.n * VF), gl.STATIC_DRAW); return b; };
    return { vbo: mk(t), n: t.n, wvbo: mk(w), wn: w.n, obo: mk(ob), on: ob.n, sbo: mk(sb), sn: sb.n };
  }
  function staticObject(t, world, o, X, Y) {
    const d = O[o.t]; const gz = R.groundZ(world, X + .5, Y + .5); const rot = h2(X + 3, Y + 7) * 6.283;
    let name = o.t; if (o.stub) name = 'stub'; else if (d.door && !o.closed) name = 'door_open'; else if (name === 'tree' && PF.tree2 && h2(X + 5, Y + 1) > 0.5) name = 'tree2';
    const p = PF[name]; if (!p) return;
    const scale = d.tall ? 0.9 + h2(X, Y + 9) * 0.35 : 1;
    const m = M(mT(X + .5, gz - 0.02, Y + .5), mRY((d.built || d.altar || d.boat || d.isChest) ? 0 : rot), mS(scale));
    const n0 = t.n; inst(t, p, m);
    if (d.tall || name === 'berry_bush') { // no two trees the same green: tint the foliage per instance, leave the trunk alone
      const k = 0.86 + h2(X + 13, Y + 17) * 0.26, kb = 0.92 + h2(X + 19, Y + 23) * 0.16; for (let i = n0; i < t.n; i++) { const o = i * VF; if (t.arr[o + 7] > t.arr[o + 6] * 1.2) { t.arr[o + 6] *= k * kb; t.arr[o + 7] *= k; t.arr[o + 8] *= k * (2 - kb); } } }
  }
  function chunk(world, cxI, cyI) { const k = cxI + ',' + cyI; return chunks[k] || (chunks[k] = buildChunk(world, cxI, cyI)); }
  function dropChunk(k) { const c = chunks[k]; if (!c) return; gl.deleteBuffer(c.vbo); gl.deleteBuffer(c.wvbo); gl.deleteBuffer(c.obo); gl.deleteBuffer(c.sbo); delete chunks[k]; }
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
      case 'die': if (ev.k) F.corpses.push({ k: ev.k, x: ev.x, y: ev.y, face: ev.f || 0, r: ev.r, el: ev.el, id: Math.random() * 1000 | 0, age: 0 }); for (let i = 0; i < 18; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.6, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: Math.random() * 5, c: i % 3 ? hex(ev.c) : [1, 1, 1], t: 0, life: 0.5 + Math.random() * 0.5, g: 10, sz: 0.14 }); break;
      case 'boom': F.booms.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, c: ev.c || '#ffb040' }); for (let i = 0; i < 16; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.5, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, vz: Math.random() * 4, c: hex(ev.c || '#ffb040'), t: 0, life: 0.45, g: 4, sz: 0.16, e: 1 }); break;
      case 'zap': F.zaps.push({ x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0 }); break;
      case 'slash': F.slashes.push({ x: ev.x, y: ev.y, a: ev.a, r: ev.r, t: 0 }); break;
      case 'target': F.targets.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, d: ev.d }); break;
      case 'ping': F.pings.push({ x: ev.x, y: ev.y, col: ev.col, name: ev.name, t: 0 }); break;
      case 'dust': for (let i = 0; i < 6; i++) F.parts.push({ x: ev.x, y: ev.y, z: 0.1, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, vz: 1, c: [0.8, 0.75, 0.6], t: 0, life: 0.35, g: 2 }); break;
      case 'fire': F.parts.push({ x: ev.x + (Math.random() - .5) * 0.4, y: ev.y + (Math.random() - .5) * 0.4, z: 0.6, vx: 0, vy: 0, vz: 1.5, c: Math.random() < 0.5 ? [1, 0.42, 0.1] : [1, 0.82, 0.25], t: 0, life: 0.4, g: -3, e: 1 }); break;
      case 'shake': if ((!ev.id || ev.id === me) && (!G.Input.settings || G.Input.settings.shake)) R.shake = Math.max(R.shake, ev.v); break;
      case 'hitstop': if (ev.to === me) { R.hitstop = 0.06; R.dip = 0.012; } break;
      case 'wobble': F.wobble[ev.i] = 0.25; break;
      case 'tell': R.tellFlash[ev.id] = 0.3; break;
      case 'bossin': R.banner = { txt: G.ENEMIES[ev.k].name, sub: 'NIGHT BOSS', t: 0 }; break;
      case 'nev': { const e = G.NIGHT_EVENTS.find(x => x.id === ev.id); if (e && ev.id !== 'clear') R.banner = { txt: e.name, sub: e.desc, t: 0, col: '#ffd24a' }; break; }
    }
  };

  // ================= frame =================
  R.frame = function (V, dt, L) {
    R.dt = dt;
    if (!gl) return; L.dt = dt;
    const me = V.players[V.me]; const world = V.world; nowT = V.now;
    if (R.hitstop > 0) R.hitstop -= dt;
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 18);
    if (me) { R.cam.x = me.x; R.cam.y = me.y; R.cam.z = R.groundZ(world, me.x, me.y) + (me.downed ? 0.35 : EYE) + (L.jumpZ || 0) + (L.bob || 0) - (L.land || 0); }
    R.cam.yaw = L.yaw; R.cam.pitch = L.pitch;
    if (me && me.flash && R.kick < 0.02) R.kick = 0.035; R.kick = Math.max(0, R.kick - dt * 0.4);
    R.roll = 0; // dodging keeps the camera upright (no roll)
    const shx = (Math.random() - .5) * R.shake * 0.01, shy = (Math.random() - .5) * R.shake * 0.01;
    R.dip = Math.max(0, (R.dip || 0) - dt * 0.09); const yaw = R.cam.yaw + shx, pitch = G.clamp(R.cam.pitch + shy - R.kick - R.dip, -1.5, 1.5);
    const fx = Math.cos(yaw) * Math.cos(pitch), fz = Math.sin(pitch), fy = Math.sin(yaw) * Math.cos(pitch);
    const baseFov = (G.Input && G.Input.settings ? G.Input.settings.fov : 80); R.fovCur = G.lerp(R.fovCur || baseFov, baseFov + (L.sprinting ? 1.5 : 0), Math.min(1, dt * 8)); const fov = R.fovCur * Math.PI / 180;
    perspective(proj, fov, R.W / R.H, 0.05, 80);
    lookAt(view, R.cam.x, R.cam.z, R.cam.y, fx, fz, fy);
    if (Math.abs(R.roll) > 0.001) { const rz = mRZ(R.roll); view = mmul(rz, view); const b2 = camBasis; const r = b2.r, u = b2.u; const c = Math.cos(R.roll), sn = Math.sin(R.roll); camBasis = { r: [r[0] * c + u[0] * sn, r[1] * c + u[1] * sn, r[2] * c + u[2] * sn], u: [u[0] * c - r[0] * sn, u[1] * c - r[1] * sn, u[2] * c - r[2] * sn], f: b2.f }; }
    vp = mmul(proj, view);
    // sky state
    const darkness = G.Sim.darkness({ time: V.time }); const night = G.clamp(darkness / 0.9, 0, 1);
    const dusk = V.time > G.DUSK_AT - 25 && V.time < G.NIGHT_AT ? G.clamp(1 - Math.abs((V.time - (G.DUSK_AT + 5)) / 25), 0, 1) : (V.time < 25 ? G.clamp(1 - Math.abs((V.time - 12) / 14), 0, 1) : 0);
    const sa = Math.PI * (0.02 + (V.time / G.NIGHT_AT) * 0.96); sunDir = [Math.cos(sa) * 0.8, Math.max(0.02, Math.sin(sa)), 0.5]; { const l = Math.hypot(...sunDir); sunDir = sunDir.map(v => v / l); }
    const ma = Math.PI * (0.1 + G.clamp((V.time - G.NIGHT_AT) / (G.DAY_LEN - G.NIGHT_AT), 0, 1) * 0.8); moonDir = [-Math.cos(ma) * 0.7, Math.sin(ma), -0.6]; { const l = Math.hypot(...moonDir); moonDir = moonDir.map(v => v / l); }
    const sunStr = (1 - night) * G.clamp(sunDir[1] * 2.2, 0.15, 1) * 0.85;
    sunCol = [sunStr * (1 - dusk * 0.1), sunStr * (0.95 - dusk * 0.3), sunStr * (0.85 - dusk * 0.5)];
    { const amb = G.lerp(0.58, 0.17, night) - dusk * 0.06; const dayA = [1.02, 1.0, 1.0], duskA = [1.15, 0.85, 1.05], nightA = [0.75, 0.8, 1.45]; ambient = dayA.map((c, i) => amb * G.lerp(G.lerp(c, duskA[i], dusk), nightA[i], night)); }
    const dayFog = [0.74, 0.83, 0.93], duskFog = [0.9, 0.6, 0.45], nightFog = V.nev === 'fog' ? [0.12, 0.13, 0.17] : (V.nev === 'bloodmoon' ? [0.12, 0.04, 0.06] : [0.05, 0.06, 0.13]);
    fog = dayFog.map((c, i) => G.lerp(G.lerp(c, duskFog[i], dusk), nightFog[i], night));
    R.fogNear = V.nev === 'fog' && night > 0.5 ? 6 : 26;
    // lights
    lights = [];
    const cx0 = Math.floor(R.cam.x), cy0 = Math.floor(R.cam.y);
    for (let ty = cy0 - 24; ty <= cy0 + 24; ty++) for (let tx = cx0 - 24; tx <= cx0 + 24; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= W) continue; const i = ty * W + tx; const o = world.objs.get(i);
      if (o && O[o.t].light && !o.stub) lights.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + (o.t === 'torch' ? 0.9 : 0.5), r: O[o.t].light * 1.5, c: o.t === 'casino' ? [1, 0.35 + Math.sin(nowT * 3) * 0.15, 0.9] : o.t === 'furnace' || o.t === 'cauldron' ? [0.9, 0.5, 0.3] : [1, 0.68, 0.32] });
      if (world.tiles[i] === T.LAVA && (tx + ty) % 3 === 0) lights.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + 0.3, r: 3, c: [1, 0.4, 0.1] });
    }
    for (const id in V.players) { const p = V.players[id]; if (p.dead) continue; const it = p.inv[p.held]; const gz = R.groundZ(world, p.x, p.y); if (it && it.id === 'torch_hand') lights.push({ x: p.x, y: p.y, z: gz + 1.1, r: 6, c: [1, 0.7, 0.35] }); else if (night > 0.3) lights.push({ x: p.x, y: p.y, z: gz + 0.9, r: 2.5, c: [0.3, 0.33, 0.45] }); }
    for (const pr of V.projs) if (pr.type === 'glob') lights.push({ x: pr.x, y: pr.y, z: 0.9, r: 2, c: [1, 0.45, 0.1] });
    for (const p of V.puddles) lights.push({ x: p.x, y: p.y, z: R.groundZ(world, p.x, p.y) + 0.2, r: 2.2, c: [1, 0.4, 0.1] });
    for (const e of V.enemies) if (e.t === 'crawler' || e.t === 'cinder') lights.push({ x: e.x, y: e.y, z: R.groundZ(world, e.x, e.y) + 0.5, r: e.t === 'cinder' ? 6 : 3, c: [1, 0.45, 0.15] });
    lights.sort((a, b) => G.dist(a.x, a.y, R.cam.x, R.cam.y) - G.dist(b.x, b.y, R.cam.x, R.cam.y)); lights = lights.slice(0, 10);
    const lp = new Float32Array(64), lc = new Float32Array(48); lightPacked.lp = lp; lightPacked.lc = lc;
    lights.forEach((l, i) => { const flick = 1 + Math.sin(nowT * 9 + l.x * 7 + l.y * 3) * 0.07; lp[i * 4] = l.x; lp[i * 4 + 1] = l.z; lp[i * 4 + 2] = l.y; lp[i * 4 + 3] = l.r * flick; lc[i * 3] = l.c[0]; lc[i * 3 + 1] = l.c[1]; lc[i * 3 + 2] = l.c[2]; });

    // ---- sky ----
    if (post) gl.bindFramebuffer(gl.FRAMEBUFFER, post.fbo);
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
    gl.uniformMatrix4fv(prog.u.uVP, false, vp); gl.uniform3f(prog.u.uCam, R.cam.x, R.cam.z, R.cam.y); gl.uniform3fv(prog.u.uAmb, ambient); gl.uniform1f(prog.u.uTime, nowT); gl.uniform1f(prog.u.uWater, 0); gl.uniform1f(prog.u.uFogNear, R.fogNear || 26);
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
    // ---- glTF character models ----
    drawModels(); gl.useProgram(prog);
    // ---- water ----
    gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(prog.u.uWater, 1); gl.uniform1f(prog.u.uAlpha, 0.75);
    for (const c of vis) { if (!c.wn) continue; gl.bindBuffer(gl.ARRAY_BUFFER, c.wvbo); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, c.wn); }
    gl.uniform1f(prog.u.uWater, 0);
    // blob shadows (static per chunk + dynamic entities)
    gl.uniform1f(prog.u.uAlpha, 0.38);
    for (const c of vis) { if (!c.sn) continue; gl.bindBuffer(gl.ARRAY_BUFFER, c.sbo); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, c.sn); }
    if (shad.n) { if (!shadBuf) shadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, shadBuf); gl.bufferData(gl.ARRAY_BUFFER, shad.arr.subarray(0, shad.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, shad.n); }
    if (trail.n) { gl.uniform1f(prog.u.uAlpha, 0.45); if (!trailBuf) trailBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, trailBuf); gl.bufferData(gl.ARRAY_BUFFER, trail.arr.subarray(0, trail.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, trail.n); }
    // additive light glows
    if (glow.n) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.uniform1f(prog.u.uAlpha, 0.22); if (!glowBuf) glowBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, glowBuf); gl.bufferData(gl.ARRAY_BUFFER, glow.arr.subarray(0, glow.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, glow.n); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    gl.uniform1f(prog.u.uWater, 0); gl.uniform1f(prog.u.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
    // ---- first-person arms (drawn last, depth cleared so they never clip into walls) ----
    // first-person hands: squeezed into the nearest depth slice so they draw over the world without clearing the scene depth the outline pass needs
    if (me && !me.dead && !me.downed) { gl.depthRange(0, 0.04); dyn.n = 0; buildHands(me, L); gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn.arr.subarray(0, dyn.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); gl.depthRange(0, 1); }
    if (post) drawPost();
    drawOverlay(V, me, dt, L, darkness);
    drawMinimap(V);
  };

  let trail = { arr: new Float32Array(VF * 3 * 4000), n: 0 }, trailBuf = null;
  let shad = { arr: new Float32Array(VF * 3 * 3000), n: 0 }, shadBuf = null, glow = { arr: new Float32Array(VF * 3 * 1000), n: 0 }, glowBuf = null;
  function shadowDisc(x, y, gz, r) { cyl(shad, M(mT(x, gz + 0.02, y)), r, r, 0.004, 8, [0, 0, 0], 0); }
  function glowQuad(x, y, z, r, col) { // soft radial glow: fan with bright centre and black rim (additive blend makes the rim vanish)
    const b = camBasis; if (!b) return; const n = [-b.f[0], -b.f[1], -b.f[2]]; const N = 12; grow(glow, N * 3);
    const P = (sx, sy) => [x + (b.r[0] * sx + b.u[0] * sy) * r, z + (b.r[1] * sx + b.u[1] * sy) * r, y + (b.r[2] * sx + b.u[2] * sy) * r];
    const c0 = [x, z, y], black = [0, 0, 0];
    for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832; vert(glow, c0, n, col, 1.0); vert(glow, P(Math.cos(a0), Math.sin(a0)), n, black, 1.0); vert(glow, P(Math.cos(a1), Math.sin(a1)), n, black, 1.0); }
  }
  function swingTrail(px, py, gz, sw, col) { // fan of translucent quads along the arc travelled so far
    const prog = Math.min(1, sw.t / sw.dur); if (prog < 0.2 || prog > 0.85) return;
    const a0 = sw.ang - sw.arc / 2, a1 = a0 + sw.arc * Math.min(1, (prog - 0.2) / 0.5); const steps = 8; const rIn = 0.5, rOut = sw.reach + 0.2, z = gz + (sw.anim === 'slam' ? 1.2 : sw.anim === 'chop' ? 1.0 : 0.95);
    for (let i = 0; i < steps; i++) { const t0 = a0 + (a1 - a0) * i / steps, t1 = a0 + (a1 - a0) * (i + 1) / steps; const dz = sw.anim === 'slam' ? -0.6 * (i / steps) : sw.anim === 'chop' ? -0.5 * (i / steps) : 0; const I = m4(); quad(trail, I, [px + Math.cos(t0) * rIn, z + dz, py + Math.sin(t0) * rIn], [px + Math.cos(t0) * rOut, z + dz, py + Math.sin(t0) * rOut], [px + Math.cos(t1) * rOut, z + dz, py + Math.sin(t1) * rOut], [px + Math.cos(t1) * rIn, z + dz, py + Math.sin(t1) * rIn], col, 1.0); }
  }
  function buildDynamic(V, me, L) {
    const t = dyn, world = V.world, F = R.fx; trail.n = 0; shad.n = 0; glow.n = 0;
    // glows for the lights we gathered (night only so the day stays clean)
    const darkG = G.clamp(G.Sim.darkness({ time: V.time }) / 0.9, 0, 1); if (darkG > 0.2) for (const l of lights) { if (l.c[0] < 0.5) continue; const gz0 = l.z; glowQuad(l.x, l.y, gz0, l.r * 0.3, l.c.map(c => c * darkG * 0.9)); glowQuad(l.x, l.y, gz0, l.r * 0.1, [1, 0.95, 0.8].map(c => c * darkG)); }
    // drops
    for (const d of V.drops) { const gz = R.groundZ(world, d.x, d.y); const bob = Math.sin(nowT * 3 + d.id) * 0.05; shadowDisc(d.x, d.y, gz, 0.18); itemMesh(t, M(mT(d.x, gz + 0.25 + bob, d.y), mRY(nowT * 1.5 + d.id), mRZ(0.5)), d.item, true, d); if (d.aff || d.q >= 3) { const c = hex(G.RARITY_COL[d.q || 0]); cyl(t, M(mT(d.x, gz + 0.02, d.y)), 0.3, 0.3, 0.02, 10, c, 1.0); cyl(t, M(mT(d.x, gz, d.y)), 0.025, 0.005, 1.6 + (d.q || 0) * 0.4, 4, c, 0.9); } }
    // enemies
    for (const e of V.enemies) {
      if (e.hidden) continue; const gz = R.groundZ(world, e.x, e.y); const zoff = e.t === 'leviathan' ? -0.6 : 0;
      if (e.t !== 'leviathan' && e.t !== 'tentacle') shadowDisc(e.x, e.y, gz, e.r * (e.t === 'bat' ? 0.6 : 1.1));
      creature(t, M(mT(e.x, gz + zoff, e.y), mRY(e.face)), e, V);
      if (e.burn) F.parts.push({ x: e.x + (Math.random() - .5) * 0.6, y: e.y + (Math.random() - .5) * 0.6, z: gz + 0.5, vx: 0, vy: 0, vz: 1.5, c: [1, 0.42, 0.1], t: 0, life: 0.3, g: -3, e: 1 });
      if (/charge|lunge|pounce/.test(e.st)) for (let i = 0; i < 2; i++) F.parts.push({ x: e.x, y: e.y, z: gz + 0.1, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, vz: 1, c: [0.8, 0.75, 0.6], t: 0, life: 0.3, g: 0 });
    }
    // corpses (death tumble)
    for (let i = F.corpses.length - 1; i >= 0; i--) { const c = F.corpses[i]; c.age += L.dt; if (c.age > 1.6) { F.corpses.splice(i, 1); continue; } const gz = R.groundZ(world, c.x, c.y); const k = Math.min(1, c.age * 2.2); const sink = c.age > 0.9 ? (c.age - 0.9) * 1.4 : 0; creature(t, M(mT(c.x, gz - sink, c.y), mRY(c.face), mRX(k * 1.5), mS(1, 1 - k * 0.15, 1)), { t: c.k, id: c.id, x: c.x, y: c.y, st: 'idle', face: c.face, flash: c.age < 0.1, r: c.r, elite: c.el, tm: 0 }, V, { gz, sink, k }); }
    // other players
    for (const id in V.players) {
      const p = V.players[id]; if (p.dead || p === me) continue; const gz = R.groundZ(world, p.x, p.y);
      const it = p.inv[p.held]; const col = hex(p.col); const d = it ? G.ITEMS[it.id] : null;
      const o = { h: 1.2, body: col, skin: hex('#f0c8a0'), hair: hex('#5a3a20'), anim: p.anim * Math.PI, moving: p.moving, held: it && d.type !== 'shield' ? it.id : null, heldInst: it, swing: p.swing ? p.swing.t / p.swing.dur : null, wind: p.charge > 0, block: p.blocking, shield: d && d.type === 'shield', shieldId: d && d.type === 'shield' ? it.id : null, bow: d && (d.type === 'bow' || d.type === 'staff'), chest: p.armor.chest ? hex(G.ITEMS[p.armor.chest].col) : null, uniqueChest: p.armor.chest && G.ITEMS[p.armor.chest].unique, helm: p.armor.head ? hex(G.ITEMS[p.armor.head].col) : null, uniqueHelm: p.armor.head && G.ITEMS[p.armor.head].unique, helmId: p.armor.head, legcol: p.armor.legs ? hex(G.ITEMS[p.armor.legs].col) : hex('#3a3040'), flash: !!p.flash, hit: !!p.flash };
      shadowDisc(p.x, p.y, gz, 0.38);
      if (R.hasPlayerModel()) { playerModel(p, gz, L.dt, false); if (p.swing) swingTrail(p.x, p.y, gz, p.swing, it && it.aff ? hex(G.RARITY_COL[it.q || 0]) : [1, 1, 0.9]); }
      else if (p.downed) humanoid(t, M(mT(p.x, gz + 0.15, p.y), mRY(p.face), mRZ(1.5)), o); else { humanoid(t, M(mT(p.x, gz, p.y), mRY(p.face), mRZ(p.dodgeT ? 0.5 : 0)), o); if (p.swing) swingTrail(p.x, p.y, gz, p.swing, it && it.aff ? hex(G.RARITY_COL[it.q || 0]) : [1, 1, 0.9]); }
      if (p.slow) F.parts.push({ x: p.x + (Math.random() - .5) * 0.6, y: p.y + (Math.random() - .5) * 0.6, z: gz + 0.3, vx: 0, vy: 0, vz: 0.5, c: [0.7, 0.9, 1], t: 0, life: 0.5, g: 0, e: 1 });
    }
    // my own swing trail
    if (me && !me.dead && me.swing) { const it = me.inv[me.held]; swingTrail(me.x, me.y, R.groundZ(world, me.x, me.y), me.swing, it && it.aff ? hex(G.RARITY_COL[it.q || 0]) : (it && G.ITEMS[it.id].burn ? [1, 0.6, 0.2] : [1, 1, 0.9])); }
    // projectiles
    for (const pr of V.projs) {
      const a = pr.a !== undefined ? pr.a : Math.atan2(pr.vy, pr.vx); const z = R.groundZ(world, pr.x, pr.y) + 0.9;
      if (pr.type === 'arrow') { box(t, M(mT(pr.x, z, pr.y), mRY(a)), 0.7, 0.04, 0.04, [0.85, 0.78, 0.65], 0.2, 0); cyl(t, M(mT(pr.x, z, pr.y), mRY(a), mT(0.35, 0, 0), mRZ(-1.57)), 0.05, 0, 0.12, 4, [0.6, 0.6, 0.65]); }
      else if (pr.type === 'glob') sph(t, M(mT(pr.x, z - 0.1, pr.y)), 0.16, 5, 3, [1, 0.45, 0.1], 1.0);
      else if (pr.type === 'fire') { sph(t, M(mT(pr.x, z - 0.1, pr.y), mS(1 + Math.sin(nowT * 30) * 0.15)), 0.22, 6, 4, [1, 0.5, 0.1], 1.0); F.parts.push({ x: pr.x, y: pr.y, z: z - 0.1, vx: (Math.random() - .5), vy: (Math.random() - .5), vz: 1, c: [1, 0.7, 0.2], t: 0, life: 0.3, g: 0, e: 1 }); }
      else if (pr.type === 'ice') { cyl(t, M(mT(pr.x, z - 0.1, pr.y), mRY(nowT * 6)), 0.2, 0, 0.3, 4, [0.7, 0.9, 1], 1.0); cyl(t, M(mT(pr.x, z - 0.1, pr.y), mRY(nowT * 6), mRX(Math.PI)), 0.2, 0, 0.3, 4, [0.7, 0.9, 1], 1.0); }
      else if (pr.type === 'shadow') sph(t, M(mT(pr.x, z - 0.1, pr.y)), 0.18, 6, 4, [0.4, 0.3, 0.9], 1.0);
      else if (pr.type === 'lich') { sph(t, M(mT(pr.x, z - 0.1, pr.y)), 0.2, 6, 4, [0.6, 0.4, 1], 1.0); F.parts.push({ x: pr.x, y: pr.y, z: z, vx: 0, vy: 0, vz: 0.5, c: [0.6, 0.4, 1], t: 0, life: 0.3, g: 0, e: 1 }); }
      else if (pr.type === 'web') { for (let k = 0; k < 4; k++) box(t, M(mT(pr.x, z - 0.1, pr.y), mRY(k * 0.78 + nowT * 5)), 0.5, 0.02, 0.02, [0.9, 0.9, 1], 0.7, 0); }
      else inst(t, PF.rock, M(mT(pr.x, z - 0.4, pr.y), mRY(nowT * 4), mS(0.8)));
    }
    for (const p of V.puddles) { const gz = R.groundZ(world, p.x, p.y); cyl(t, M(mT(p.x, gz + 0.03, p.y)), p.r, p.r * 0.9, 0.04, 8, [1, 0.4, 0.1], 1.0); }
    for (const p of F.parts) { const sz = p.sz || 0.08; box(t, M(mT(p.x, p.z, p.y), mRY(p.t * 5)), sz, sz, sz, p.c, p.e ? 1 : 0.35, 0); }
    const cx0 = Math.floor(R.cam.x), cy0 = Math.floor(R.cam.y);
    for (let ty = cy0 - 14; ty <= cy0 + 14; ty++) for (let tx = cx0 - 14; tx <= cx0 + 14; tx++) { if (tx < 0 || ty < 0 || tx >= W || ty >= W) continue; const o = world.objs.get(ty * W + tx); if (!o) continue; if (o.t === 'campfire' && Math.random() < 0.3) F.parts.push({ x: tx + .5 + (Math.random() - .5) * 0.3, y: ty + .5 + (Math.random() - .5) * 0.3, z: R.groundZ(world, tx + .5, ty + .5) + 0.6, vx: 0, vy: 0, vz: 1.4, c: Math.random() < 0.5 ? [1, 0.42, 0.1] : [1, 0.82, 0.25], t: 0, life: 0.5, g: -2, e: 1, sz: 0.1 }); else if (o.t === 'torch' && Math.random() < 0.15) F.parts.push({ x: tx + .5, y: ty + .5, z: R.groundZ(world, tx + .5, ty + .5) + 1.0, vx: 0, vy: 0, vz: 1.2, c: [1, 0.7, 0.2], t: 0, life: 0.35, g: -2, e: 1, sz: 0.06 }); }
    if (L.ghost) { const g = L.ghost; const gz = R.groundZ(world, g.tx + .5, g.ty + .5); const col = g.ok ? [0.4, 1, 0.4] : [1, 0.35, 0.35]; box(t, M(mT(g.tx + .5, gz + 0.02, g.ty + .5)), 0.96, 0.03, 0.96, col, 1.0); const p = PF[g.obj]; if (p) { const tmp = { arr: new Float32Array(p.length), n: 0 }; inst(tmp, p, M(mT(g.tx + .5, gz, g.ty + .5))); for (let i = 0; i < tmp.n; i++) { const o = i * VF; tmp.arr[o + 6] = (tmp.arr[o + 6] + col[0]) / 2; tmp.arr[o + 7] = (tmp.arr[o + 7] + col[1]) / 2; tmp.arr[o + 8] = (tmp.arr[o + 8] + col[2]) / 2; tmp.arr[o + 9] = 0.6; } grow(t, tmp.n); t.arr.set(tmp.arr.subarray(0, tmp.n * VF), t.n * VF); t.n += tmp.n; } }
    for (const p of F.pings) { const gz = R.groundZ(world, p.x, p.y); cyl(t, M(mT(p.x, gz, p.y)), 0.12, 0.05, 8, 5, hex(p.col), 1.0); }
  }

  function buildHands(me, L) {
    const b = camBasis; const C = m4();
    C[0] = b.r[0]; C[1] = b.r[1]; C[2] = b.r[2]; C[4] = b.u[0]; C[5] = b.u[1]; C[6] = b.u[2]; C[8] = b.f[0]; C[9] = b.f[1]; C[10] = b.f[2];
    C[12] = R.cam.x; C[13] = R.cam.z; C[14] = R.cam.y;
    const bob = (L.bob || 0) * 0.5, sway = Math.sin((L.walkT || 0) * 0.5) * 0.006, idle = Math.sin(nowT * 1.5) * 0.004;
    const it = me.inv[me.held]; const d = it ? G.ITEMS[it.id] : null;
    let prog = me.swing ? Math.min(1, me.swing.t / me.swing.dur) : 0; if (me.swing && R.hitstop > 0 && R.frozenProg != null) prog = R.frozenProg; else R.frozenProg = me.swing ? prog : null; // hitstop: the hand freezes on the frame of impact
    const sw = Math.sin(prog * Math.PI); const anim = me.swing ? (me.swing.anim || 'slash') : null; const combo = me.swing ? (me.swing.combo || 0) : 0;
    // first-person hands match the chosen character: gauntlets for the knight, bare arms for the barbarian, sleeves for the rest; a robot look if the robot rig is in use
    const big = d && d.big; const robot = false; const pc = hex(me.col);
    const skin = sh(pc, 1.08), sleeve = sh(pc, 0.72), wrist = sh(pc, 0.55);
    // rest pose
    let hand = M(C, mT(0.36 + sway, -0.36 + bob + idle, 0.82), mRX(-0.15));
    if (me.charge > 0) { const c = me.charge; hand = M(C, mT(0.34 + sway, -0.22 + bob + c * 0.15 + Math.sin(nowT * 40) * 0.006 * c, 0.72), mRX(-0.15 - c * 1.2), mRZ(-0.25 * c)); }
    // swing animations: every attack has a wind-up, a snappy strike that lands where the sim registers the hit (30% of the swing) and an eased recovery
    const ss = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }, outq = (x) => 1 - (1 - x) * (1 - x);
    const rest = { x: 0.34 + sway, y: -0.36 + bob + idle, z: 0.78 };
    let punchL = 0; // left-hand punch amount (fists alternate)
    if (me.swing) {
      const kind = (!it || !(d.type === 'weapon' || d.type === 'tool' || d.type === 'staff')) ? 'punch' : (anim === 'chop' || anim === 'slam' || d.type === 'tool') ? 'chop' : anim;
      if (kind === 'slash') {
        // u: -0.3 wound back, 0 rest, 1 end of the sweep, back to 0
        const u = prog < 0.18 ? -0.3 * ss(0, 0.18, prog) : prog < 0.42 ? -0.3 + 1.3 * outq((prog - 0.18) / 0.24) : 1 - ss(0.42, 1, prog);
        if (combo === 1) { // rising backhand: low-left to high-right
          hand = M(C, mT(rest.x - 0.25 + u * 0.28, rest.y - 0.12 + u * 0.3, rest.z + 0.06 - u * 0.1), mRX(0.05 - u * 0.5), mRY(0.5 - u * 1.0), mRZ(-0.7 + u * 1.4));
        } else if (combo === 2) { // overhead diagonal finisher
          hand = M(C, mT(rest.x + 0.1 - u * 0.36, rest.y + 0.3 - u * 0.5, rest.z - 0.1 + u * 0.16), mRX(-0.9 + u * 1.6), mRY(-u * 0.5), mRZ(0.3 - u * 0.4));
        } else { // horizontal sweep right to left
          hand = M(C, mT(rest.x + 0.1 - u * 0.5, rest.y + 0.02 - u * 0.05, rest.z - 0.06 + u * 0.12), mRX(0.05 + Math.sin(Math.max(0, u) * Math.PI) * 0.25), mRY(0.35 - u * 1.25), mRZ(-0.25 + u * 0.95));
        }
      } else if (kind === 'chop') {
        // raise over the shoulder, drive down fast, hold the bite for a beat, then ease back
        // raise (0-0.14), a beat of anticipation at the top, slam (0.18-0.3, impact exactly at the sim's hit), recoil bounce, ease back
        let u; if (prog < 0.14) u = -ss(0, 0.14, prog); else if (prog < 0.18) u = -1 - Math.sin((prog - 0.14) / 0.04 * Math.PI) * 0.06; else if (prog < 0.3) u = -1 + 2 * outq((prog - 0.18) / 0.12); else if (prog < 0.5) u = 1 - Math.sin((prog - 0.3) / 0.2 * Math.PI) * 0.22; else u = 1 - ss(0.5, 1, prog);
        if (u < 0) { const k = -u; hand = M(C, mT(rest.x - 0.02 * k, rest.y + 0.32 * k, rest.z - 0.22 * k), mRX(-0.15 - 0.95 * k), mRY(0.2 * k), mRZ(-0.12 * k)); }
        else hand = M(C, mT(rest.x - 0.14 * u, rest.y + 0.01 * u, rest.z + 0.1 * u), mRX(-0.15 + 0.85 * u), mRY(-0.22 * u), mRZ(0.12 * u));
      } else if (kind === 'thrust') {
        const u = prog < 0.15 ? -0.35 * ss(0, 0.15, prog) : prog < 0.34 ? -0.35 + 1.35 * outq((prog - 0.15) / 0.19) : 1 - ss(0.34, 1, prog);
        hand = M(C, mT(rest.x - 0.16 * Math.max(0, u), rest.y - 0.02 * u, rest.z + u * 0.36), mRX(-0.15 - Math.max(0, u) * 0.15), mRY(-0.15 - u * 0.15));
      } else { // punch: fists alternate hands
        // pull back, drive the fist at the crosshair (impact at 0.3), snap back
        const u = prog < 0.1 ? -0.3 * ss(0, 0.1, prog) : prog < 0.3 ? -0.3 + 1.3 * outq((prog - 0.1) / 0.2) : 1 - ss(0.3, 0.8, prog); const uf = Math.max(0, u);
        if (combo % 2 === 1) punchL = u; else hand = M(C, mT(rest.x - 0.24 * uf + 0.06 * Math.min(0, u), rest.y + 0.14 * uf, rest.z + u * 0.5), mRX(-0.15 - uf * 0.4), mRY(-u * 0.5), mRZ(uf * 0.3));
      }
    }
    if (me.blocking) hand = M(C, mT(0.12, -0.2 + bob, 0.7), mRX(-0.1), mRY(-0.3));
    if (d && (d.type === 'bow' || d.type === 'staff')) { const pull = me.draw ? Math.min(1, me.draw / d.draw) : 0; hand = d.type === 'bow' ? M(C, mT(0.02, -0.22 + bob, 0.8 + pull * 0.05), mRX(-0.15), mRY(1.3), mRZ(-0.2)) : M(C, mT(0.3 + sway, -0.4 + bob + pull * 0.15, 0.75), mRX(-0.5 - pull * 0.5), mRZ(0.2)); }
    capsuleS(dyn, M(hand, mT(0.03, -0.04, -0.34), mRX(1.47), mRY(-0.12)), 0.05, 0.3, 9, sleeve);
    if (robot) { cyl(dyn, M(hand, mT(0.01, -0.02, -0.12), mRX(1.47)), 0.075, 0.075, 0.06, 9, wrist); sphS(dyn, M(hand, mS(1.15, 0.9, 1.05)), 0.085, 9, 6, skin); box(dyn, M(hand, mT(0, 0.055, 0.02)), 0.1, 0.035, 0.09, hex('#2a2a30'), 0, 0); }
    else { cylS(dyn, M(hand, mT(0.01, -0.03, -0.14), mRX(1.47)), 0.075, 0.068, 0.06, 9, wrist); sphS(dyn, M(hand, mS(1.15, 0.9, 1.2)), 0.09, 9, 6, skin); capsuleS(dyn, M(hand, mT(0.075, 0.01, 0.03), mRZ(-1.0), mRX(0.4)), 0.032, 0.08, 6, skin); }
    if (it) {
      if (d.type === 'tool') itemMesh(dyn, M(hand, mT(0.01, 0.0, 0.03), mRX(0.45), mRY(-2.3), mRZ(0.25), mS(0.72)), it.id, false, it); // head turned inward so its flat face reads, shaft leaning toward the crosshair
      else if (d.type === 'weapon') itemMesh(dyn, M(hand, mT(0, 0.02, 0.03), mRX(anim === 'thrust' ? 1.45 : anim === 'slam' ? 0.6 : (big ? 0.8 : 0.7)), mRY(anim === 'thrust' ? 0 : -0.35), mRZ(-0.15), mS(big ? 0.6 : 0.8)), it.id, false, it);
      else if (d.type === 'bow') itemMesh(dyn, M(hand, mT(0, 0, 0), mRY(0.2)), it.id, false, it);
      else if (d.type === 'staff') itemMesh(dyn, M(hand, mT(0, -0.35, 0.05), mRX(0.2), mS(0.8)), it.id, false, it);
      else if (d.type === 'shield') itemMesh(dyn, M(hand, mT(0, 0.1, 0.08), mRY(0.1)), it.id, false, it);
      else if (it.id === 'torch_hand') itemMesh(dyn, M(hand, mT(0, -0.06, 0.04), mRX(0.35), mRZ(-0.1), mS(0.62)), it.id, false);
      else if (d.type === 'place') itemMesh(dyn, M(hand, mT(0, 0.06, 0.08), mRY(nowT * 0.6), mS(0.3)), it.id, true);
      else itemMesh(dyn, M(hand, mT(0, 0.1, 0.05), mRY(nowT * 0.5)), it.id, true, it);
      if (d.type === 'bow' && me.draw > 0) { const lh = M(C, mT(0.28 - Math.min(1, me.draw / d.draw) * 0.28, -0.22 + bob, 0.7)); sph(dyn, lh, 0.07, 6, 4, skin); box(dyn, M(lh, mT(0, -0.04, -0.15), mRX(0.2)), 0.09, 0.09, 0.3, sleeve, 0, 0); itemMesh(dyn, M(lh, mT(0, 0.02, 0.3), mRX(1.57)), 'arrow', false); }
      if (big && !me.blocking) { const lh = M(hand, mT(-0.06, 0.16, -0.02)); sph(dyn, lh, 0.07, 7, 4, skin); capsule(dyn, M(lh, mT(-0.3, -0.1, -0.22), mRX(1.2), mRY(0.9)), 0.05, 0.3, 7, sleeve); }
    }
    if (!it || me.blocking) { const pl = Math.max(0, punchL); const lh = M(C, mT(-0.36 - sway + 0.24 * pl - 0.06 * Math.min(0, punchL), -0.38 + bob + idle + 0.14 * pl, 0.8 + punchL * 0.5), mRX(-0.15 - pl * 0.4), mRY(punchL * 0.5), mRZ(-pl * 0.3)); capsuleS(dyn, M(lh, mT(-0.03, -0.04, -0.34), mRX(1.47), mRY(0.12)), 0.05, 0.3, 9, sleeve); if (robot) { cyl(dyn, M(lh, mT(-0.01, -0.02, -0.12), mRX(1.47)), 0.075, 0.075, 0.06, 9, wrist); sphS(dyn, M(lh, mS(1.15, 0.9, 1.05)), 0.085, 9, 6, skin); box(dyn, M(lh, mT(0, 0.055, 0.02)), 0.1, 0.035, 0.09, hex('#2a2a30'), 0, 0); } else { cylS(dyn, M(lh, mT(-0.01, -0.03, -0.14), mRX(1.47)), 0.075, 0.068, 0.06, 9, wrist); sphS(dyn, M(lh, mS(1.15, 0.9, 1.2)), 0.09, 9, 6, skin); capsuleS(dyn, M(lh, mT(-0.075, 0.01, 0.03), mRZ(1.0), mRX(0.4)), 0.032, 0.08, 6, skin); } if (!it && me.swing) { /* punch: left/right alternate handled by hand pose above */ } }
  }

  // ================= glTF character models =================
  function primBuffers(pr) {
    if (pr.gl) return pr.gl; const b = { pos: gl.createBuffer(), nrm: gl.createBuffer(), uv: null, idx: null, n: pr.idx ? pr.idx.length : pr.count, idxType: 0 };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, pr.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm); gl.bufferData(gl.ARRAY_BUFFER, pr.nrm || new Float32Array(pr.count * 3).fill(0.577), gl.STATIC_DRAW);
    if (pr.uv) { b.uv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.uv); gl.bufferData(gl.ARRAY_BUFFER, pr.uv, gl.STATIC_DRAW); }
    if (pr.idx) { b.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); const i32 = pr.idx instanceof Uint32Array; gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, i32 ? new Uint16Array(pr.idx) : pr.idx, gl.STATIC_DRAW); b.idxType = gl.UNSIGNED_SHORT; if (pr.idx instanceof Uint8Array) b.idxType = gl.UNSIGNED_BYTE; }
    if (pr.joints) {
      // compact joint palette: most low-poly parts touch only a handful of joints, so they fit the uniform budget and skin on the GPU
      const map = new Map(); const jr = new Float32Array(pr.count * 4);
      for (let v = 0; v < pr.count * 4; v++) { const w = pr.weights[v]; const j = pr.joints[v]; if (w > 0) { if (!map.has(j)) map.set(j, map.size); jr[v] = map.get(j); } else jr[v] = 0; }
      if (map.size <= MAXJ) { b.jmap = [...map.keys()]; b.jbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.jbuf); gl.bufferData(gl.ARRAY_BUFFER, jr, gl.STATIC_DRAW); b.wbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.wbuf); gl.bufferData(gl.ARRAY_BUFFER, pr.weights instanceof Float32Array ? pr.weights : Float32Array.from(pr.weights), gl.STATIC_DRAW); b.pal = new Float32Array(MAXJ * 16); }
      else { b.skinPos = gl.createBuffer(); b.skinNrm = gl.createBuffer(); b.sp = new Float32Array(pr.count * 3); b.sn = new Float32Array(pr.count * 3); }
    }
    pr.gl = b; return b;
  }
  function modelTexture(model, ti) {
    const t = model.textures[ti]; if (!t || !t.image) return null; if (t.gl) return t.gl; if (t.loading) return null; t.loading = true;
    const img = new Image(); img.onload = () => { const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); t.gl = tex; }; img.src = t.image; return null;
  }
  // animation state per entity: crossfade between clips
  function animPose(model, key, want, dt, timeOverride, clips) {
    const spec = model.spec; clips = clips || spec.clips; const st = animStates[key] || (animStates[key] = { clip: want, t: 0, prev: null, pt: 0, fade: 1 });
    if (st.clip !== want) { st.prev = st.clip; st.pt = st.t; st.clip = want; st.t = 0; st.fade = 0; }
    st.t += dt; st.pt += dt; st.fade = Math.min(1, st.fade + dt / 0.15); st.age = 0;
    const pose = G.GLTF.restPose(model); const nm = (k) => clips[k] || k;
    if (st.prev && st.fade < 1) { const prevClamp = st.prev === 'death' || st.prev === 'down'; (prevClamp ? G.GLTF.applyClipClamped : G.GLTF.applyClip)(model, pose, nm(st.prev), st.pt, 1); }
    const clamp = want === 'death' || want === 'down'; const t = timeOverride !== undefined ? timeOverride : st.t;
    (clamp ? G.GLTF.applyClipClamped : G.GLTF.applyClip)(model, pose, nm(want), t, st.fade);
    return pose;
  }
  const playerModelFor = (p) => { const M0 = G.Assets && G.Assets.models; if (!M0) return null; return M0['player_' + (p && p.skin)] || M0.player || M0[Object.keys(M0).find(k => k.startsWith('player_'))] || null; };
  R.hasPlayerModel = () => true;
  // queue a model draw; returns node world matrices so items can be attached
  function queueModel(model, x, y, z, face, tint, pose) {
    const spec = model.spec; const sc = model.scale; const root = M(mT(x, z - model.base * sc, y), mRY((spec.yaw || 0) - face), mS(sc));
    G.GLTF.computeWorld(model, pose, root);
    const req = { model, tint, worlds: model.nodes.map(n => new Float32Array(n.world)) };
    modelReqs.push(req); return req;
  }
  function drawModels() {
    if (!mprog || !modelReqs.length) return;
    gl.useProgram(mprog);
    gl.uniformMatrix4fv(mprog.u.uVP, false, vp); gl.uniform3f(mprog.u.uCam, R.cam.x, R.cam.z, R.cam.y); gl.uniform1f(mprog.u.uFogNear, R.fogNear || 26);
    gl.uniform3fv(mprog.u.uFog, fog); gl.uniform1f(mprog.u.uAlpha, 1); gl.uniform3f(mprog.u.uSunDir, sunDir[0], sunDir[1], sunDir[2]); gl.uniform3fv(mprog.u.uSunCol, sunCol); gl.uniform3fv(mprog.u.uAmb, ambient);
    gl.uniform4fv(mprog.u.uLights, lightPacked.lp); gl.uniform3fv(mprog.u.uLightCol, lightPacked.lc); gl.uniform1i(mprog.u.uNL, lights.length); gl.uniform1i(mprog.u.uTex, 0); gl.uniform1f(mprog.u.uEm, 0);
    const I = m4(); const jmTmp = new Float32Array(16); const skinJM = new Map(); // per (request, skin): joint matrices world*ibm
    const disableSkin = () => { gl.uniform1f(mprog.u.uSkin, 0); if (mprog.a.aJ >= 0) { gl.disableVertexAttribArray(mprog.a.aJ); gl.vertexAttrib4f(mprog.a.aJ, 0, 0, 0, 0); } if (mprog.a.aW >= 0) { gl.disableVertexAttribArray(mprog.a.aW); gl.vertexAttrib4f(mprog.a.aW, 1, 0, 0, 0); } };
    disableSkin();
    for (const rq of modelReqs) {
      const model = rq.model; const spec = model.spec; skinJM.clear();
      for (const nd of model.nodes) {
        if (nd.mesh < 0 || nd.hidden || (rq.hide && rq.hide.has(nd.name))) continue; const mesh = model.meshes[nd.mesh];
        const flatNode = rq.tint && spec.tintNodes && spec.tintNodes.includes(nd.name);
        for (const pr of mesh.prims) {
          const b = primBuffers(pr); const mat = model.materials[pr.mat] || { color: [0.8, 0.8, 0.8, 1], tex: -1, name: '' };
          const tinted = rq.tint && ((spec.tint && mat.name === spec.tint) || spec.tint === '*' || flatNode); const tk = spec.tintMode === 'mul' && !flatNode ? 1.6 : 1;
          const col = tinted ? [rq.tint[0] * tk, rq.tint[1] * tk, rq.tint[2] * tk, 1] : mat.color;
          gl.uniform4fv(mprog.u.uColor, rq.flash ? [1, 1, 1, 1] : col);
          const tex = mat.tex >= 0 && !spec.flat && !flatNode ? modelTexture(model, mat.tex) : null; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1f(mprog.u.uHasTex, tex ? 1 : 0);
          if (nd.skin >= 0 && pr.joints && b.jmap) { // GPU skin: palette of world*ibm for the joints this part uses
            const skin = model.skins[nd.skin]; let jm = skinJM.get(nd.skin); if (!jm) { jm = new Float32Array(skin.joints.length * 16); for (let j = 0; j < skin.joints.length; j++) { G.GLTF.mul(jmTmp, rq.worlds[skin.joints[j]], skin.ibm.subarray(j * 16, j * 16 + 16)); jm.set(jmTmp, j * 16); } skinJM.set(nd.skin, jm); }
            for (let k = 0; k < b.jmap.length; k++) b.pal.set(jm.subarray(b.jmap[k] * 16, b.jmap[k] * 16 + 16), k * 16);
            gl.uniformMatrix4fv(mprog.u.uJoints, false, b.pal.subarray(0, b.jmap.length * 16)); gl.uniform1f(mprog.u.uSkin, 1);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(mprog.a.aPos); gl.vertexAttribPointer(mprog.a.aPos, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm); gl.enableVertexAttribArray(mprog.a.aNrm); gl.vertexAttribPointer(mprog.a.aNrm, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.jbuf); gl.enableVertexAttribArray(mprog.a.aJ); gl.vertexAttribPointer(mprog.a.aJ, 4, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.wbuf); gl.enableVertexAttribArray(mprog.a.aW); gl.vertexAttribPointer(mprog.a.aW, 4, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(mprog.u.uModel, false, I);
          } else if (nd.skin >= 0 && pr.joints) { // CPU skin fallback for parts that touch more joints than the palette holds
            disableSkin(); const skin = model.skins[nd.skin]; model.nodes.forEach((n2, i) => n2.world.set(rq.worlds[i])); G.GLTF.skinPrim(model, skin, pr, b.sp, b.sn);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.skinPos); gl.bufferData(gl.ARRAY_BUFFER, b.sp, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(mprog.a.aPos); gl.vertexAttribPointer(mprog.a.aPos, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.skinNrm); gl.bufferData(gl.ARRAY_BUFFER, b.sn, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(mprog.a.aNrm); gl.vertexAttribPointer(mprog.a.aNrm, 3, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(mprog.u.uModel, false, I);
          } else {
            disableSkin();
            gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(mprog.a.aPos); gl.vertexAttribPointer(mprog.a.aPos, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm); gl.enableVertexAttribArray(mprog.a.aNrm); gl.vertexAttribPointer(mprog.a.aNrm, 3, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(mprog.u.uModel, false, rq.worlds[nd.i]);
          }
          if (b.uv && mprog.a.aUV >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, b.uv); gl.enableVertexAttribArray(mprog.a.aUV); gl.vertexAttribPointer(mprog.a.aUV, 2, gl.FLOAT, false, 0, 0); } else if (mprog.a.aUV >= 0) { gl.disableVertexAttribArray(mprog.a.aUV); gl.vertexAttrib2f(mprog.a.aUV, 0, 0); }
          if (b.idx) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.drawElements(gl.TRIANGLES, b.n, b.idxType, 0); } else gl.drawArrays(gl.TRIANGLES, 0, b.n);
        }
      }
    }
    if (mprog.a.aUV >= 0) gl.disableVertexAttribArray(mprog.a.aUV); disableSkin();
    modelReqs.length = 0;
  }
  // ---- hats (cosmetics) — drawn in world units for a head of radius r, base at y=0, forward is +Z ----
  function hatMesh(t, m, id, r, col) {
    const black = hex('#1a1a22'), gold = hex('#ffd24a'), brown = hex('#8a5a30'), white = hex('#f4f0e8');
    switch (id) {
      case 'cap': sphS(t, M(m, mT(0, -r * 0.15, 0)), r * 0.95, 10, 5, col, 0, 0.62); box(t, M(m, mT(0, 0.02, r * 0.75)), r * 0.9, 0.05, r * 0.8, col); sph(t, M(m, mT(0, r * 0.42, 0)), 0.05, 5, 3, black); break;
      case 'beanie': sphS(t, M(m, mT(0, -r * 0.2, 0)), r * 1.0, 10, 5, col, 0, 0.72); cylS(t, M(m, mT(0, -r * 0.2, 0)), r * 1.03, r * 1.03, r * 0.28, 12, sh(col, 0.7)); sph(t, M(m, mT(0, r * 0.55, 0)), r * 0.22, 6, 4, white); break;
      case 'tophat': cyl(t, m, r * 1.35, r * 1.35, 0.05, 14, black); cyl(t, M(m, mT(0, 0.05, 0)), r * 0.85, r * 0.8, r * 1.5, 14, black); cyl(t, M(m, mT(0, 0.08, 0)), r * 0.87, r * 0.87, r * 0.22, 14, col, 0.2); break;
      case 'cowboy': cyl(t, M(m, mT(0, 0, 0)), r * 1.55, r * 1.45, 0.06, 14, brown); for (const x of [-1, 1]) box(t, M(m, mT(x * r * 1.3, 0.12, 0), mRZ(x * 0.5)), r * 0.5, 0.05, r * 1.2, brown); sphS(t, M(m, mT(0, -r * 0.1, 0)), r * 0.85, 10, 5, sh(brown, 1.1), 0, 0.85); box(t, M(m, mT(0, r * 0.62, 0)), r * 0.5, 0.08, r * 1.0, brown); cyl(t, M(m, mT(0, 0.06, 0)), r * 0.87, r * 0.87, 0.1, 12, col); break;
      case 'visor': cylS(t, M(m, mT(0, 0, 0)), r * 1.02, r * 1.02, 0.14, 14, hex('#1a4a2a')); box(t, M(m, mT(0, 0.02, r * 0.85)), r * 1.3, 0.04, r * 0.9, hex('#40e070'), 0.5); break;
      case 'crown': cyl(t, m, r * 0.9, r * 0.85, r * 0.35, 8, gold, 0.4); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cyl(t, M(m, mT(Math.cos(a) * r * 0.85, r * 0.35, Math.sin(a) * r * 0.85)), 0.06, 0, r * 0.35, 4, gold, 0.4); } for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; sph(t, M(m, mT(Math.cos(a) * r * 0.9, r * 0.18, Math.sin(a) * r * 0.9)), 0.05, 5, 3, [hex('#ff4060'), hex('#40c0ff'), hex('#5aff8a'), hex('#d05aff')][i], 0.9); } break;
      case 'halo': for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14; sph(t, M(m, mT(Math.cos(a) * r * 0.8, r * 0.9 + Math.sin(nowT * 2) * 0.03, Math.sin(a) * r * 0.8)), 0.045, 5, 3, gold, 1.0); } break;
      case 'pirate': cyl(t, m, r * 1.35, r * 1.3, 0.06, 12, black); for (const x of [-1, 1]) box(t, M(m, mT(x * r * 1.05, r * 0.35, 0), mRZ(x * 1.1)), r * 0.7, 0.06, r * 1.3, black); box(t, M(m, mT(0, r * 0.35, r * 1.05), mRX(-1.1)), r * 1.6, 0.06, r * 0.7, black); sphS(t, M(m, mT(0, -r * 0.1, 0)), r * 0.85, 10, 5, black, 0, 0.7); box(t, M(m, mT(0, r * 0.3, r * 1.0)), r * 0.28, r * 0.28, 0.03, white, 0.3); break;
      case 'chef': cyl(t, M(m, mT(0, 0, 0)), r * 0.85, r * 0.85, r * 0.9, 12, white); sphS(t, M(m, mT(0, r * 0.95, 0)), r * 1.05, 10, 5, white, 0, 0.7); for (let i = 0; i < 5; i++) { const a = i * 1.26; sph(t, M(m, mT(Math.cos(a) * r * 0.6, r * 1.15, Math.sin(a) * r * 0.6)), r * 0.42, 6, 4, white); } break;
      case 'horns': for (const x of [-1, 1]) cyl(t, M(m, mT(x * r * 0.7, -r * 0.1, 0), mRZ(x * -0.5)), r * 0.16, 0, r * 0.7, 6, hex('#d02030'), 0.2); break;
    }
  }
  // ---- generic animated character from a glTF model (players, humanoid enemies, bosses, beasts) ----
  // st: { downed, swing:{t,dur}, moving, sprinting, wind, windF (0..1), strikeF (0..1), flash, held (item inst), rootM (override root transform), key }
  // which clip set a character uses depends on what it holds: unarmed / one-handed / two-handed / bow / staff
  function heldKind(it) { if (!it) return 'unarmed'; const d = G.ITEMS[it.id]; if (!d) return 'unarmed'; if (d.type === 'bow') return 'bow'; if (d.type === 'staff') return 'staff'; if (d.type === 'shield') return 'shield'; if (d.type === 'weapon' || d.type === 'tool') return d.big ? '2h' : '1h'; return '1h'; }
  function charModel(model, key, x, y, gz, face, tint, st, dt) {
    const spec = model.spec; let want = 'idle', tOverride;
    const clips = spec.sets && spec.sets[st.kind || heldKind(st.held)] ? Object.assign({}, spec.clips, spec.sets[st.kind || heldKind(st.held)]) : spec.clips;
    const pickAttack = () => { const a = st.swing && st.swing.anim; const alt = st.swing && (st.swing.combo || 0) % 2 === 1; if (a === 'chop' && clips.chop) return 'chop'; if (a === 'thrust' && clips.stab) return 'stab'; if (a === 'slam' && clips.slam) return 'slam'; if (alt && clips.attackAlt) return 'attackAlt'; return 'attack'; };
    if (st.downed) want = 'death';
    else if (st.swing) { want = pickAttack(); const atk = model.anims[clips[want]]; if (atk) tOverride = Math.min(atk.dur - 0.001, (st.swing.t / st.swing.dur) * atk.dur); }
    else if (st.wind) { want = clips.wind ? 'wind' : 'attack'; const atk = model.anims[clips[want]]; if (atk && !clips.wind) tOverride = Math.min(atk.dur - 0.001, (st.windF || 0) * 0.4 * atk.dur); }
    else if (st.strikeF !== undefined) { want = 'attack'; const atk = model.anims[clips.attack]; if (atk) tOverride = Math.min(atk.dur - 0.001, (0.4 + 0.6 * st.strikeF) * atk.dur); }
    else if (st.emote && clips.cheer) want = 'cheer';
    else if (st.hit && clips.hit) want = 'hit';
    else if (st.block && clips.block) want = 'block';
    else if (st.dodge && clips.dodge) want = 'dodge';
    else if (st.sitting && clips.sit) want = 'sit';
    else if (st.moving) want = st.sprinting && clips.run ? 'run' : 'walk';
    if (!clips[want]) want = clips.walk && st.moving ? 'walk' : 'idle';
    const pose = animPose(model, key, want, dt, tOverride, clips);
    const sc = model.scale * (st.scale || 1); const hover = spec.hover ? spec.hover + Math.sin(nowT * 3 + (st.seed || 0)) * 0.12 : 0;
    const root = st.rootM ? M(st.rootM, mT(0, -model.base * sc + hover, 0), mS(sc)) : M(mT(x, gz - model.base * sc + hover, y), mRY((spec.yaw || 0) - face), mS(sc));
    G.GLTF.computeWorld(model, pose, root);
    const rq = { model, tint, worlds: model.nodes.map(n => new Float32Array(n.world)), flash: !!st.flash }; modelReqs.push(rq);
    if (st.hat && st.hat !== 'none' && spec.headgear) rq.hide = new Set(spec.headgear); // our hat replaces the pack's own helmet/hat
    const it = st.held; const hn = spec.hand !== undefined ? model.byName[spec.hand] : undefined;
    if (it && hn !== undefined && G.ITEMS[it.id]) { const hw = rq.worlds[hn]; const ho = spec.handOffset || [0, 0, 0]; const hr = spec.handRot || [0, 0, 0];
      // bone matrix without its scale (armatures often carry a large internal scale)
      const n = m4(); for (let c = 0; c < 3; c++) { const l = Math.hypot(hw[c * 4], hw[c * 4 + 1], hw[c * 4 + 2]) || 1; n[c * 4] = hw[c * 4] / l; n[c * 4 + 1] = hw[c * 4 + 1] / l; n[c * 4 + 2] = hw[c * 4 + 2] / l; } n[12] = hw[12]; n[13] = hw[13]; n[14] = hw[14];
      const d = G.ITEMS[it.id]; const isc = (spec.itemScale || 1) * (st.scale || 1) * (d.big ? 1.15 : 1);
      const im = M(n, mT(ho[0] * sc, ho[1] * sc, ho[2] * sc), mRX(hr[0]), mRY(hr[1]), mRZ(hr[2]), mS(isc)); itemMesh(dyn, im, it.id, false, it); }
    if (st.hat && st.hat !== 'none' && spec.head) { const hi = model.byName[spec.head]; if (hi !== undefined) { const hw = rq.worlds[hi]; const n = m4(); for (let c = 0; c < 3; c++) { const l = Math.hypot(hw[c * 4], hw[c * 4 + 1], hw[c * 4 + 2]) || 1; n[c * 4] = hw[c * 4] / l; n[c * 4 + 1] = hw[c * 4 + 1] / l; n[c * 4 + 2] = hw[c * 4 + 2] / l; } n[12] = hw[12]; n[13] = hw[13]; n[14] = hw[14];
      const ht = spec.headTop || 1.4, hr2 = (spec.headR || 1.3) * sc; hatMesh(dyn, M(n, mT(0, ht * sc, 0)), st.hat, hr2, tint || [1, 1, 1]); } }
    return rq;
  }
  // ================= castaway blobs (players) =================
  // Non-human avatars in the spirit of casino/climbing party games: a paint-coloured capsule body, big googly eyes, a mouth and brows
  // that react, stubby waddling legs and mitten arms. Everything is procedural so faces, colours and hats combine freely.
  const FACES = { happy: { eye: 0.11, pupil: 0.05, brow: 0.0, mouth: 'smile' }, sleepy: { eye: 0.1, pupil: 0.045, brow: 0.15, mouth: 'flat', lid: 0.45 }, wide: { eye: 0.13, pupil: 0.045, brow: -0.2, mouth: 'o' }, grumpy: { eye: 0.1, pupil: 0.05, brow: 0.55, mouth: 'frown' }, derp: { eye: 0.12, pupil: 0.055, brow: -0.1, mouth: 'tongue', odd: true } };
  const blobState = {};
  function drawBlob(t, key, x, y, gz, face, col, st, dt) {
    const F = FACES[st.face] || FACES.happy; const bs = blobState[key] || (blobState[key] = { seed: Math.random() * 100, blink: 0, hitT: 0 });
    bs.blink -= dt; if (bs.blink < -0.13) bs.blink = 3 + Math.random() * 3; const blink = bs.blink < 0; if (st.hit) bs.hitT = 0.25; bs.hitT = Math.max(0, bs.hitT - dt);
    const dark = hex('#1c1a22'), white = hex('#fbfbff'), shoe = sh(col, 0.45), mouthC = hex('#3a1020');
    const prog = st.swing ? Math.min(1, st.swing.t / st.swing.dur) : 0; const sw = Math.sin(prog * Math.PI); const ph = st.anim || 0; const mv = !!st.moving; const T = nowT + bs.seed;
    let root = M(mT(x, gz, y), mRY(-face));
    if (st.downed) root = M(root, mT(0, 0.3, 0), mRZ(1.45), mT(0, -0.05, 0));
    // body motion: bob + roll when walking, lean into attacks/sprint, squash on hits, hop for the emote, sit lower
    const bob = mv ? Math.abs(Math.sin(ph)) * 0.05 : Math.sin(T * 2) * 0.012; const roll = mv ? Math.sin(ph) * 0.08 : 0; const hop = st.emote ? Math.abs(Math.sin(T * 7)) * 0.16 : 0;
    const lean = (st.swing ? 0.3 * sw : 0) + (st.sprinting && mv ? 0.14 : 0) + (st.charge ? -0.15 * st.charge : 0) + (st.dodge ? 0.35 : 0);
    const sq = bs.hitT > 0 ? 0.82 + 0.18 * (1 - bs.hitT / 0.25) : (st.sitting ? 0.9 : 1 + (mv ? Math.sin(ph * 2) * 0.03 : Math.sin(T * 2) * 0.02));
    const B = M(root, mT(0, bob + hop + (st.sitting ? -0.17 : 0), 0), mRX(roll), mRZ(-lean), mS(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)));
    // legs + shoes (waddle)
    for (const sd of [-1, 1]) { const a = st.sitting ? -1.4 : (mv ? Math.sin(ph + (sd > 0 ? 0 : Math.PI)) * 0.55 : 0) + (hop ? 0.3 : 0); const L = M(root, mT(0, 0.22 + hop * 0.5, sd * 0.13), mRZ(-a), mT(0, -0.2, 0)); capsuleS(t, L, 0.07, 0.16, 8, sh(col, 0.85)); sphS(t, M(L, mT(0.03, 0.0, 0)), 0.1, 9, 5, shoe, 0, 0.6); }
    // body
    sphS(t, M(B, mT(0, 0.64, 0)), 0.36, 16, 10, col, 0, 1.32);
    sphS(t, M(B, mT(0.06, 0.5, 0)), 0.3, 12, 7, sh(col, 1.08), 0, 1.0); // lighter belly
    // arms with mitten hands; right arm is the weapon arm
    const kind = heldKind(st.held); const ranged = kind === 'bow' || kind === 'staff';
    for (const sd of [-1, 1]) {
      let ang = (mv ? Math.sin(ph + (sd > 0 ? Math.PI : 0)) * 0.45 : Math.sin(T * 1.7) * 0.06) + 0.25; let out = 0.55; // hang down and a bit out
      const right = sd < 0;
      if (st.emote) { ang = -2.6 + Math.sin(T * 7 + sd) * 0.3; out = 0.9; }
      else if (st.block || (ranged && (st.charge > 0 || right))) { ang = -1.5; out = 0.2; }
      else if (right && st.charge > 0) { ang = 1.1 * st.charge; out = 0.5; }
      else if (right && st.swing) { const an = st.swing.anim; ang = an === 'thrust' ? -1.55 : an === 'chop' || an === 'slam' ? (-2.6 + prog * 2.2) : (-1.4 - Math.cos(prog * Math.PI) * 0.9); out = an === 'slash' ? 0.2 + sw * 0.6 : 0.3; }
      else if (right && st.held) { ang = -0.35; out = 0.45; }
      const A = M(B, mT(0, 0.74, sd * 0.3), mRX(-sd * out), mRZ(-ang));
      capsuleS(t, M(A, mT(0, -0.27, 0)), 0.065, 0.24, 8, sh(col, 0.92)); sphS(t, M(A, mT(0, -0.3, 0)), 0.1, 10, 6, sh(col, 1.05), 0, 0.9);
      if (right && st.held && G.ITEMS[st.held.id]) { const d = G.ITEMS[st.held.id]; const H = M(A, mT(0.02, -0.32, 0)); const tilt = st.swing ? 0.2 : ranged ? 0.0 : 0.9; itemMesh(t, M(H, mRZ(Math.PI + tilt), mRY(ranged ? 1.57 : 0), mS(d.big ? 0.62 : 0.55)), st.held.id, false, st.held); }
    }
    // face: eyes (blink, look at the camera), brows (mood), mouth
    const angry = !!(st.swing || st.charge > 0), hurt = bs.hitT > 0 || st.downed, happy = !!st.emote;
    let lookZ = 0, lookY = 0; { const dx = R.cam.x - x, dy = R.cam.y - y; const a = Math.atan2(dy, dx) - face; lookZ = G.clamp(Math.sin(a) * 0.035, -0.035, 0.035); lookY = G.clamp((R.cam.z - gz - 0.85) * 0.03, -0.03, 0.03); }
    for (const sd of [-1, 1]) {
      const er = F.eye * (F.odd && sd > 0 ? 0.78 : 1); const E = M(B, mT(0.29, 0.84 + (F.odd && sd > 0 ? 0.03 : 0), sd * 0.13));
      const shut = blink || st.downed; sphS(t, E, er, 12, 8, white, 0, shut ? 0.12 : 1);
      if (!shut) { sphS(t, M(E, mT(er * 0.72, lookY, lookZ * (F.odd && sd > 0 ? -1 : 1))), F.pupil, 10, 6, dark); sphS(t, M(E, mT(er * 0.88, F.pupil * 0.5, lookZ + sd * 0.012)), F.pupil * 0.3, 6, 4, white, 0.4); if (F.lid) box(t, M(E, mT(0.02, er * 0.62, 0)), er * 1.1, er * 0.5, er * 2.1, col, 0, 0); }
      const bt = (F.brow + (angry ? 0.7 : 0) - (hurt || happy ? 0.45 : 0)) * -sd; box(t, M(B, mT(0.3, 0.98 + (hurt || happy ? 0.03 : 0), sd * 0.13), mRX(bt)), 0.03, 0.025, 0.11, dark, 0, 0);
    }
    { const my = 0.66; if (hurt || F.mouth === 'o' && !happy) sphS(t, M(B, mT(0.33, my, 0)), 0.045, 8, 5, mouthC, 0, 1.25);
      else if (happy || angry) { box(t, M(B, mT(0.33, my - 0.01, 0)), 0.03, 0.06, 0.16, mouthC, 0, 0); box(t, M(B, mT(0.335, my + 0.015, 0)), 0.02, 0.02, 0.13, white, 0, 0); }
      else if (F.mouth === 'frown') { for (const k of [-1, 0, 1]) sphS(t, M(B, mT(0.33, my - 0.02 + Math.abs(k) * 0.03, k * 0.05)), 0.018, 6, 4, mouthC); }
      else if (F.mouth === 'flat') box(t, M(B, mT(0.33, my, 0)), 0.02, 0.018, 0.12, mouthC, 0, 0);
      else if (F.mouth === 'tongue') { for (const k of [-1, 0, 1]) sphS(t, M(B, mT(0.33, my + 0.02 - Math.abs(k) * 0.03, k * 0.05)), 0.018, 6, 4, mouthC); sphS(t, M(B, mT(0.34, my - 0.03, 0.02)), 0.035, 8, 5, hex('#ff7090'), 0, 0.6); }
      else for (const k of [-1, 0, 1]) sphS(t, M(B, mT(0.33, my + 0.02 - Math.abs(k) * 0.03, k * 0.05)), 0.02, 6, 4, mouthC); }
    // hat on the crown
    if (st.hat && st.hat !== 'none') hatMesh(t, M(B, mT(0, 1.07, 0), mRY(1.5708)), st.hat, 0.31, col);
  }
  // draws a player with the glTF model; returns true if handled
  function playerModel(p, gz, dt, isMe) {
    if (p.dead) return true; const it0 = p.inv[p.held];
    drawBlob(dyn, 'pl:' + p.id, p.x, p.y, gz, p.face, hex(p.col), { face: p.skin, anim: p.anim, moving: p.moving, sprinting: p.sprinting, swing: p.swing, charge: p.charge, block: p.blocking, dodge: p.dodgeT > 0, downed: p.downed, sitting: p.sitting, emote: p.emote > 0, hit: !!p.flash, held: it0, hat: p.hat }, dt);
    return true;
    const model = playerModelFor(p); if (!model || !mprog) return false;
    const it = p.inv[p.held];
    charModel(model, 'pl:' + p.id, p.x, p.y, gz, p.face, hex(p.col), { downed: p.downed, swing: p.swing, moving: p.moving, sprinting: p.sprinting, wind: p.charge > 0, windF: p.charge, flash: p.flash, held: it, hat: p.hat, block: p.blocking, dodge: p.dodgeT > 0, sitting: p.sitting, emote: p.emote > 0, hit: !!p.flash }, dt);
    return true;
  }
  R.playerTop = () => 1.55;
  // enemy drawn with a glTF model when assets/models.json has an entry for its type; returns true if handled
  function enemyModel(e, m, V, dt, corpse) {
    const model = mprog && G.Assets.models[e.t]; if (!model) return false; const d = G.ENEMIES[e.t]; const spec = model.spec;
    const isWind = /wind$/.test(e.st); const moving = /chase|charge|lunge|circle|pounce|flee|retreat/.test(e.st); const striking = e.st === 'cool' && (e.tm || 0) > 0.6;
    const st = { moving, sprinting: /charge|lunge|pounce/.test(e.st), wind: isWind, windF: isWind ? 1 - G.clamp((e.tm || 0) / (d.windup || 0.6), 0, 1) : 0, flash: !!e.flash, hit: !!e.flash && !isWind, seed: e.id, held: spec.held ? { id: spec.held, n: 1 } : null, kind: spec.kind };
    if (striking) st.strikeF = G.clamp((1.5 - e.tm) / 0.4, 0, 1);
    let gz = m[13]; if (corpse) { if (spec.clips.death) { st.downed = true; gz = corpse.gz - corpse.sink * 0.6; } else st.rootM = M(mT(e.x, corpse.gz - corpse.sink, e.y), mRY((spec.yaw || 0) - e.face), mRX(corpse.k * 1.5), mS(1, 1 - corpse.k * 0.15, 1)); }
    charModel(model, 'en:' + e.id, e.x, e.y, gz, e.face, spec.noTint ? null : hex(d.col), st, dt);
    if (e.elite) { cyl(dyn, M(m, mT(0, 0.02, 0)), e.r * 1.5, e.r * 1.5, 0.03, 12, hex('#c060ff'), 1.0); for (let k = 0; k < 3; k++) { const a = nowT * 2 + k * 2.09; sph(dyn, M(m, mT(Math.cos(a) * e.r * 1.4, 0.6 + Math.sin(nowT * 4 + k) * 0.2, Math.sin(a) * e.r * 1.4)), 0.07, 5, 3, hex('#c060ff'), 1.0); } }
    return true;
  }
  // ================= lobby preview =================
  R.preview = function (o, dt) {
    if (!gl || !mprog) return; nowT += dt; R.dt = dt;
    const ang = nowT * 0.3; const ex = Math.cos(ang) * 3.6, ey = Math.sin(ang) * 3.6, ez = 1.3; const tz = 0.85;
    // aim a little left of the character so it sits in the free space right of the lobby panel
    const rx = -Math.sin(ang), ry = Math.cos(ang); const tx = rx * 0.95, ty = ry * 0.95;
    let fx = tx - ex, fy = ty - ey, fz = tz - ez; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    R.cam.x = ex; R.cam.y = ey; R.cam.z = ez; R.cam.yaw = Math.atan2(fy, fx); R.cam.pitch = Math.asin(fz);
    const fov = 48 * Math.PI / 180; perspective(proj, fov, R.W / R.H, 0.05, 80); lookAt(view, ex, ez, ey, fx, fz, fy); vp = mmul(proj, view);
    sunDir = [0.45, 0.55, 0.7]; { const l = Math.hypot(...sunDir); sunDir = sunDir.map(v => v / l); } moonDir = [0, 1, 0]; sunCol = [0.9, 0.84, 0.72]; ambient = [0.6, 0.6, 0.63]; fog = [0.74, 0.83, 0.93]; R.fogNear = 40;
    lights = [{ x: 1.6, y: -1.2, z: 0.9, r: 4, c: [1, 0.5, 0.9] }]; const lp = new Float32Array(64), lc = new Float32Array(48); lp.set([1.6, 0.9, -1.2, 4]); lc.set([1, 0.5, 0.9]); lightPacked.lp = lp; lightPacked.lc = lc;
    if (post) gl.bindFramebuffer(gl.FRAMEBUFFER, post.fbo);
    gl.clearColor(fog[0], fog[1], fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.depthMask(false); gl.useProgram(skyProg); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.enableVertexAttribArray(skyProg.a.aP); gl.vertexAttribPointer(skyProg.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(skyProg.u.uRight, camBasis.r); gl.uniform3fv(skyProg.u.uUp, camBasis.u); gl.uniform3fv(skyProg.u.uFwd, camBasis.f); gl.uniform3f(skyProg.u.uSunDir, sunDir[0], sunDir[1], sunDir[2]); gl.uniform3f(skyProg.u.uMoonDir, 0, 1, 0);
    gl.uniform1f(skyProg.u.uTanH, Math.tan(fov / 2)); gl.uniform1f(skyProg.u.uAspect, R.W / R.H); gl.uniform1f(skyProg.u.uDusk, 0.2); gl.uniform1f(skyProg.u.uNight, 0); gl.uniform1f(skyProg.u.uTime, nowT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.depthMask(true);
    gl.useProgram(prog); gl.uniformMatrix4fv(prog.u.uVP, false, vp); gl.uniform3f(prog.u.uCam, ex, ez, ey); gl.uniform3fv(prog.u.uAmb, ambient); gl.uniform1f(prog.u.uTime, nowT); gl.uniform1f(prog.u.uWater, 0); gl.uniform1f(prog.u.uFogNear, 40);
    gl.uniform3f(prog.u.uSunDir, sunDir[0], sunDir[1], sunDir[2]); gl.uniform3fv(prog.u.uSunCol, sunCol); gl.uniform4fv(prog.u.uLights, lp); gl.uniform3fv(prog.u.uLightCol, lc); gl.uniform1i(prog.u.uNL, 1); gl.uniform3fv(prog.u.uFog, fog); gl.uniform1f(prog.u.uAlpha, 1); gl.disable(gl.BLEND);
    dyn.n = 0; shad.n = 0; glow.n = 0; trail.n = 0;
    cyl(dyn, mT(0, -0.05, 0), 6.2, 6.6, 0.06, 28, hex('#e6d39c')); cyl(dyn, mT(0, -0.2, 0), 14, 14, 0.16, 28, hex('#3a86c8')); cyl(dyn, mT(0, -0.06, 0), 6.6, 7.4, 0.02, 28, hex('#5fb0e8')); cyl(dyn, mT(0, -0.04, 0), 2.2, 2.4, 0.03, 24, hex('#7fc850'));
    if (G.PROPS) { propMesh(dyn, M(mT(-4.6, 0, 2.6), mRY(0.5), mS(2.3)), 'tree_a'); propMesh(dyn, M(mT(4.4, 0, 3.8), mRY(2.5), mS(2.2)), 'tree_b'); propMesh(dyn, M(mT(3.2, 0, -4.2), mRY(1.1), mS(2.3)), 'tree_a'); propMesh(dyn, M(mT(4.6, 0, -1.6), mS(2.8, 3.2, 2.8)), 'rock_c'); propMesh(dyn, M(mT(-4.3, 0, -1.9), mRY(1.2), mS(2.2)), 'barrel'); propMesh(dyn, M(mT(-4.8, 0, -0.9), mRY(0.3), mS(2.2)), 'crate'); propMesh(dyn, M(mT(-4.2, 0, -3.6), mRY(0.9), mS(2.4)), 'tent'); propMesh(dyn, M(mT(0.6, 0, 5.4), mRY(0.2), mS(2.2)), 'lumber'); }
    else { sph(dyn, M(mT(-1.8, 1.4, 1.2)), 0.8, 7, 4, hex('#3e8e2e'), 0, 0.85); cyl(dyn, mT(-1.8, 0, 1.2), 0.16, 0.12, 1.4, 6, hex('#7a4a20')); }
    inst(dyn, PF.casino, M(mT(5.2, 0, -1.2), mRY(-2.0)));
    const C = G.CLASSES.find(c => c.id === o.cls); const held = C && C.items && C.items.length ? { id: C.items[0][0], n: 1 } : null;
    drawBlob(dyn, 'preview', 0, 0, 0, ang, hex(o.col), { face: o.skin, held, hat: o.hat, emote: (nowT % 9) < 2.2, moving: false, anim: 0 }, dt);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn.arr.subarray(0, dyn.n * VF), gl.DYNAMIC_DRAW); bindAttribs(prog); gl.drawArrays(gl.TRIANGLES, 0, dyn.n);
    drawModels(); gl.useProgram(prog);
    if (post) drawPost();
    if (ox) { ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, ov.width, ov.height); }
  };
  // ================= 2D overlay =================
  function drawOverlay(V, me, dt, L, darkness) {
    const F = R.fx; const x = ox; x.setTransform(R.DPR || 1, 0, 0, R.DPR || 1, 0, 0); x.clearRect(0, 0, R.VW, R.VH);
    for (let i = F.parts.length - 1; i >= 0; i--) { const p = F.parts[i]; p.t += dt; if (p.t > p.life) { F.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.g || 0) * dt; }
    for (let i = F.floats.length - 1; i >= 0; i--) { const f = F.floats[i]; f.t += dt; f.z += dt * 0.8; if (f.t > 1.1) F.floats.splice(i, 1); }
    for (const e of V.enemies) {
      if (e.hidden) continue; const d = G.ENEMIES[e.t]; const gz = R.groundZ(V.world, e.x, e.y); const top = R.project(e.x, e.y, gz + (d.boss ? e.r * 3.0 : e.r * 3.0) + 0.3); if (!top) continue;
      if (top.x < -20 || top.x > R.VW + 20 || top.y < -20 || top.y > R.VH + 20) continue;
      const sc = G.clamp(14 / top.d, 0.5, 2.2);
      if (e.elite) { x.fillStyle = '#c060ff'; x.font = Math.round(9 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('ELITE', top.x, top.y - 14 * sc); }
      if (!d.boss && e.hp < e.maxHp) { const w = 26 * sc; x.fillStyle = '#000'; x.fillRect(top.x - w / 2, top.y, w, 3 * sc); x.fillStyle = (e.pet || e.owner) ? '#60ff60' : '#e03030'; x.fillRect(top.x - w / 2, top.y, w * Math.max(0, e.hp / e.maxHp), 3 * sc); }
      if (/wind$/.test(e.st)) { x.fillStyle = Math.floor(nowT * 12) % 2 ? '#ff3030' : '#ffe040'; x.font = 'bold ' + Math.round(18 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('!', top.x, top.y - 4); }
      if (e.stun) { x.fillStyle = '#ffe040'; x.font = Math.round(10 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillText('* *', top.x, top.y - 4); }
    }
    for (const id in V.players) {
      const p = V.players[id]; if (p.dead || p === me) continue; const gz = R.groundZ(V.world, p.x, p.y); const pt = R.project(p.x, p.y, gz + R.playerTop()); if (!pt) continue;
      const sc = G.clamp(14 / pt.d, 0.5, 2);
      x.font = Math.round(10 * sc) + 'px monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(p.name, pt.x + 1, pt.y + 1); x.fillStyle = p.col; x.fillText(p.name, pt.x, pt.y);
      x.fillStyle = '#000'; x.fillRect(pt.x - 14 * sc, pt.y + 3, 28 * sc, 3 * sc); x.fillStyle = '#e03030'; x.fillRect(pt.x - 14 * sc, pt.y + 3, 28 * sc * Math.max(0, p.hp / p.maxHp), 3 * sc);
      if (p.downed) { x.fillStyle = Math.floor(nowT * 4) % 2 ? '#ff3030' : '#ff9090'; x.fillText('DOWN ' + Math.ceil(p.bleed) + 's', pt.x, pt.y - 10 * sc); if (p.revive > 0) { x.fillStyle = '#000'; x.fillRect(pt.x - 14 * sc, pt.y + 8, 28 * sc, 3 * sc); x.fillStyle = '#60ff60'; x.fillRect(pt.x - 14 * sc, pt.y + 8, 28 * sc * p.revive / 3, 3 * sc); } }
    }
    for (const f of F.floats) { const pt = R.project(f.x, f.y, f.z); if (!pt) continue; const sc = G.clamp(12 / pt.d, 0.6, 2); x.font = (f.big ? 'bold ' : '') + Math.round((f.big ? 17 : f.small ? 10 : 13) * sc) + 'px monospace'; x.textAlign = 'center'; x.globalAlpha = Math.min(1, 2.2 - f.t * 2); x.fillStyle = '#000'; x.fillText(f.s, pt.x + 1, pt.y + 1); x.fillStyle = f.c; x.fillText(f.s, pt.x, pt.y); }
    x.globalAlpha = 1;
    for (let i = F.booms.length - 1; i >= 0; i--) { const b = F.booms[i]; b.t += dt; if (b.t > 0.35) { F.booms.splice(i, 1); continue; } ring(V, b.x, b.y, b.r * (0.3 + b.t / 0.35 * 0.7), b.c, 1 - b.t / 0.35, 3); }
    for (let i = F.zaps.length - 1; i >= 0; i--) { const z = F.zaps[i]; z.t += dt; if (z.t > 0.15) { F.zaps.splice(i, 1); continue; } const a = R.project(z.x1, z.y1, R.groundZ(V.world, z.x1, z.y1) + 0.6), b = R.project(z.x2, z.y2, R.groundZ(V.world, z.x2, z.y2) + 0.6); if (!a || !b) continue; x.strokeStyle = '#a0d0ff'; x.lineWidth = 2; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo((a.x + b.x) / 2 + (Math.random() - .5) * 12, (a.y + b.y) / 2 + (Math.random() - .5) * 12); x.lineTo(b.x, b.y); x.stroke(); }
    for (let i = F.slashes.length - 1; i >= 0; i--) { const s = F.slashes[i]; s.t += dt; if (s.t > 0.2) { F.slashes.splice(i, 1); continue; } ring(V, s.x + Math.cos(s.a) * s.r * 0.5, s.y + Math.sin(s.a) * s.r * 0.5, s.r * 0.5, '#ff6060', 1 - s.t / 0.2, 2); }
    for (let i = F.targets.length - 1; i >= 0; i--) { const t = F.targets[i]; t.t += dt; if (t.t > t.d) { F.targets.splice(i, 1); continue; } ring(V, t.x, t.y, t.r, '#ff5050', 0.9, 2); ring(V, t.x, t.y, t.r * (t.t / t.d), '#ff5050', 0.6, 2); }
    for (let i = F.pings.length - 1; i >= 0; i--) { const p = F.pings[i]; p.t += dt; if (p.t > 5) { F.pings.splice(i, 1); continue; } const pt = R.project(p.x, p.y, R.groundZ(V.world, p.x, p.y) + 8.3); if (pt) { x.fillStyle = p.col; x.font = '12px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText(p.name + ' · ' + Math.round(G.dist(p.x, p.y, R.cam.x, R.cam.y)) + 'm', pt.x, pt.y); } }
    for (const k in F.wobble) { F.wobble[k] -= dt; if (F.wobble[k] <= 0) delete F.wobble[k]; }
    for (const k in R.tellFlash) { R.tellFlash[k] -= dt; if (R.tellFlash[k] <= 0) delete R.tellFlash[k]; }
    // soft vignette
    if (!post) { if (!R.vigG || R.vigK !== R.VW * 7919 + R.VH) { R.vigK = R.VW * 7919 + R.VH; const g = x.createRadialGradient(R.VW / 2, R.VH / 2, R.VH * 0.45, R.VW / 2, R.VH / 2, R.VH * 1.0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); R.vigG = g; R.hurtG = null; } x.fillStyle = R.vigG; x.fillRect(0, 0, R.VW, R.VH); }
    // crosshair
    const cx = R.VW / 2, cy = R.VH / 2; x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 8, cy); x.lineTo(cx - 3, cy); x.moveTo(cx + 3, cy); x.lineTo(cx + 8, cy); x.moveTo(cx, cy - 8); x.lineTo(cx, cy - 3); x.moveTo(cx, cy + 3); x.lineTo(cx, cy + 8); x.stroke();
    if (L.lookingAt) { x.fillStyle = '#fff'; x.font = 'bold 14px system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(L.lookingAt, cx + 1, cy + 25); x.fillStyle = '#fff'; x.fillText(L.lookingAt, cx, cy + 24); }
    if (me && me.inv[me.held] && G.ITEMS[me.inv[me.held].id].type === 'bow') { x.fillStyle = '#fff'; x.font = '12px system-ui, sans-serif'; x.textAlign = 'right'; x.fillText(G.Sim.count(me, 'arrow') + ' arrows', R.VW - 12, R.VH - 12); }
    if (!me) R.hurtV = 0;
    if (me) {
      const hpF = me.hp / me.maxHp; if (me.flash) R.hurt = 0.35; R.hurt = Math.max(0, R.hurt - dt * 1.2);
      const v = Math.max(R.hurt, hpF < 0.3 ? (0.3 - hpF) * 2 * (0.6 + Math.sin(nowT * 6) * 0.3) : 0);
      R.hurtV = v;
      if (v > 0 && !post) { if (!R.hurtG) { const g = x.createRadialGradient(cx, cy, R.VH * 0.3, cx, cy, R.VH * 0.8); g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, 'rgba(180,0,0,1)'); R.hurtG = g; } x.globalAlpha = Math.min(0.8, v); x.fillStyle = R.hurtG; x.fillRect(0, 0, R.VW, R.VH); x.globalAlpha = 1; }
      if (me.downed) { x.fillStyle = 'rgba(60,0,0,0.45)'; x.fillRect(0, 0, R.VW, R.VH); x.fillStyle = '#ff6060'; x.font = 'bold 24px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('YOU ARE DOWN — ' + me.bleed + 's', cx, cy - 30); x.font = '13px system-ui, sans-serif'; x.fillStyle = '#fff'; x.fillText('a teammate can revive you (hold E)', cx, cy - 10); }
      if (me.dark && darkness > 0.8) { x.fillStyle = '#8080ff'; x.font = '13px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('the dark bites… find light', cx, cy + 44); }
    }
    if (R.banner) { R.banner.t += dt; const bt = R.banner.t; if (bt > 4) R.banner = null; else { const a = Math.min(1, bt * 3) * Math.min(1, (4 - bt)); x.globalAlpha = a; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, R.VH * 0.28, R.VW, 62); x.font = 'bold 30px system-ui, sans-serif'; x.fillStyle = R.banner.col || '#ff5050'; x.fillText(R.banner.txt, cx, R.VH * 0.28 + 36); x.font = '12px system-ui, sans-serif'; x.fillStyle = '#fff'; x.fillText(R.banner.sub, cx, R.VH * 0.28 + 54); x.globalAlpha = 1; } }
    let by = 10;
    for (const e of V.enemies) if (G.ENEMIES[e.t].boss) { const d = G.ENEMIES[e.t]; const w = Math.min(360, R.VW - 60); const x0 = (R.VW - w) / 2; x.fillStyle = '#000'; x.fillRect(x0 - 2, by - 2, w + 4, 12); x.fillStyle = '#601010'; x.fillRect(x0, by, w, 8); x.fillStyle = '#e03030'; x.fillRect(x0, by, w * Math.max(0, e.hp / e.maxHp), 8); x.fillStyle = '#fff'; x.font = '11px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText(d.name, R.VW / 2, by + 22); by += 28; }
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
