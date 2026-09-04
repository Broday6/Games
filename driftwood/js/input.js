// DRIFTWOOD — first-person keyboard & mouse input (pointer lock)
(function (G) {
  'use strict';
  const In = { keys: {}, mouse: { l: false, r: false }, yaw: -Math.PI / 2, pitch: 0, onAction: null, onKey: null, locked: false, ptrLocked: false, wantLock: false, sens: 0.0022, canvas: null, aim: { x: 0, y: 0 } };
  G.Input = In;
  In.init = function (canvas) {
    In.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (In.onKey && In.onKey(k, e) === true) { e.preventDefault(); return; }
      if (In.locked) return;
      if (!In.keys[k]) {
        In.keys[k] = true;
        if (k === ' ') { In.onAction && In.onAction({ a: 'jump' }); e.preventDefault(); }
        if (k === 'q') In.onAction && In.onAction({ a: 'dodge' });
        if (k >= '1' && k <= '9') In.onAction && In.onAction({ a: 'held', slot: +k - 1 });
        if (k === 'e') In.onAction && In.onAction({ a: 'interact' });
        if (k === 't') In.onAction && In.onAction({ a: 'ping' });
        if (k === 'f') In.onAction && In.onAction({ a: 'quickeat' });
      }
      if (k === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; In.keys[k] = false; });
    window.addEventListener('blur', () => { In.keys = {}; In.mouse.l = false; In.mouse.r = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!In.ptrLocked) return;
      In.yaw += e.movementX * In.sens; In.pitch = G.clamp(In.pitch - e.movementY * In.sens, -1.45, 1.45);
    });
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!In.ptrLocked) { if (In.wantLock && !In.locked) In.lock(); return; }
      if (In.locked) return;
      if (e.button === 0) { In.mouse.l = true; In.onAction && In.onAction({ a: 'click' }); }
      if (e.button === 2) In.mouse.r = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) In.mouse.l = false; if (e.button === 2) In.mouse.r = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (In.locked) return; In.onAction && In.onAction({ a: 'wheel', d: Math.sign(e.deltaY) }); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { In.ptrLocked = document.pointerLockElement === canvas; if (!In.ptrLocked) { In.mouse.l = false; In.mouse.r = false; } if (In.onLockChange) In.onLockChange(In.ptrLocked); });
  };
  const plain = () => { try { const q = In.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => { }); } catch (e) { } };
  In.lock = function () { if (!In.canvas || !In.canvas.requestPointerLock) return; try { const p = In.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch (e) { plain(); } };
  In.unlock = function () { try { document.exitPointerLock(); } catch (e) { } };
  In.forward = () => ({ x: Math.cos(In.yaw), y: Math.sin(In.yaw) });
  // movement axes in world space, relative to where the player looks
  In.packet = function (px, py) {
    const K = In.keys; let f = 0, s = 0;
    if (K.w || K.ArrowUp) f += 1; if (K.s || K.ArrowDown) f -= 1; if (K.d || K.ArrowRight) s += 1; if (K.a || K.ArrowLeft) s -= 1;
    const fx = Math.cos(In.yaw), fy = Math.sin(In.yaw), rx = -fy, ry = fx;
    let ax = fx * f + rx * s, ay = fy * f + ry * s; const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    In.aim = { x: px + fx * 3, y: py + fy * 3 };
    return { ax: +ax.toFixed(3), ay: +ay.toFixed(3), aimx: +In.aim.x.toFixed(2), aimy: +In.aim.y.toFixed(2), sprint: !!K.Shift, attack: In.mouse.l && !In.locked && In.ptrLocked, sec: In.mouse.r && !In.locked && In.ptrLocked, interact: !!K.e };
  };
})(window.G);
