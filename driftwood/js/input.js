// DRIFTWOOD — first-person keyboard & mouse input (pointer lock) with rebindable keys and settings
(function (G) {
  'use strict';
  const DEFAULT_BINDS = { forward: 'w', back: 's', left: 'a', right: 'd', sprint: 'Shift', jump: ' ', dodge: 'q', interact: 'e', eat: 'f', drop: 'x', ping: 't', emote: 'g', inventory: 'Tab', chat: 'Enter', mute: 'm', menu: 'Escape' };
  const BIND_NAMES = { forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', sprint: 'Sprint', jump: 'Jump', dodge: 'Dodge roll', interact: 'Interact / revive', eat: 'Quick eat', drop: 'Drop one (Shift: whole stack)', emote: 'Emote (cheer)', ping: 'Ping', inventory: 'Inventory & crafting', chat: 'Chat', mute: 'Mute', menu: 'Menu' };
  const DEFAULT_SETTINGS = { sens: 1.0, fov: 80, invertY: false, quality: 1, shake: true, bob: false, toon: true, sprintToggle: false, v: 2, volume: 0.5, fps: false, uiScale: 'auto', reduceMotion: false };
  const In = { keys: {}, mouse: { l: false, r: false }, yaw: -Math.PI / 2, pitch: 0, onAction: null, onKey: null, locked: false, ptrLocked: false, wantLock: false, canvas: null, aim: { x: 0, y: 0 }, binds: null, settings: null, BIND_NAMES, DEFAULT_BINDS, capture: null };
  G.Input = In;
  const load = (k, def) => { try { return Object.assign({}, def, JSON.parse(localStorage.getItem(k) || '{}')); } catch (e) { return Object.assign({}, def); } };
  In.binds = load('driftwood_binds', DEFAULT_BINDS); In.settings = load('driftwood_settings', DEFAULT_SETTINGS); if (!In.settings.v || In.settings.v < 2) { In.settings.quality = 1; In.settings.v = 2; } // older saves had a 75% render scale baked in
  In.saveBinds = () => { try { localStorage.setItem('driftwood_binds', JSON.stringify(In.binds)); } catch (e) { } };
  In.saveSettings = () => { try { localStorage.setItem('driftwood_settings', JSON.stringify(In.settings)); } catch (e) { } if (G.Render && G.Render.resize) G.Render.resize(); };
  In.resetBinds = () => { In.binds = Object.assign({}, DEFAULT_BINDS); In.saveBinds(); };
  In.keyName = (k) => k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k;
  const norm = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;
  In.actionsFor = (k) => Object.keys(In.binds).filter(a => In.binds[a] === k);
  In.is = (action) => !!In.keys[In.binds[action]];
  In.keyMatches = (e, action) => norm(e) === In.binds[action];

  In.init = function (canvas) {
    In.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (In.settings.sprintToggle && !In.locked && !e.repeat && In.keyMatches(e, 'sprint')) In.sprintLatch = !In.sprintLatch;
      const k = norm(e);
      if (In.capture) { e.preventDefault(); if (k !== 'Escape') { In.binds[In.capture] = k; In.saveBinds(); } const cb = In.onCaptured; In.capture = null; if (cb) cb(); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (In.onKey && In.onKey(k, e) === true) { e.preventDefault(); return; }
      if (In.locked) return;
      if (!In.keys[k]) {
        In.keys[k] = true;
        for (const a of In.actionsFor(k)) {
          if (a === 'jump') { In.onAction && In.onAction({ a: 'jump' }); e.preventDefault(); }
          else if (a === 'dodge') In.onAction && In.onAction({ a: 'dodge' });
          else if (a === 'interact') In.onAction && In.onAction({ a: 'interact' });
          else if (a === 'ping') In.onAction && In.onAction({ a: 'ping' });
          else if (a === 'eat') In.onAction && In.onAction({ a: 'quickeat' });
        }
        if (k >= '1' && k <= '9' && !e.altKey) In.onAction && In.onAction({ a: 'held', slot: +k - 1 });
      }
      if (k === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { In.keys[norm(e)] = false; });
    window.addEventListener('blur', () => { In.keys = {}; In.mouse.l = false; In.mouse.r = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!In.ptrLocked) return; const s = 0.0022 * (In.settings.sens || 1) * (Math.tan((In.settings.fov || 80) * Math.PI / 360) / Math.tan(40 * Math.PI / 180)); // same on-screen aim speed at any FOV
      In.yaw += e.movementX * s; In.pitch = G.clamp(In.pitch - e.movementY * s * (In.settings.invertY ? -1 : 1), -1.45, 1.45);
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
  In.packet = function (px, py) {
    let f = 0, s = 0;
    if (In.is('forward') || In.keys.ArrowUp) f += 1; if (In.is('back') || In.keys.ArrowDown) f -= 1; if (In.is('right') || In.keys.ArrowRight) s += 1; if (In.is('left') || In.keys.ArrowLeft) s -= 1;
    const fx = Math.cos(In.yaw), fy = Math.sin(In.yaw), rx = -fy, ry = fx;
    let ax = fx * f + rx * s, ay = fy * f + ry * s; const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    if (!f && !s && In.wasMoving) In.sprintLatch = false; In.wasMoving = !!(f || s); // sprint toggle releases once you stop moving
    In.aim = { x: px + fx * 3, y: py + fy * 3 };
    return { ax: +ax.toFixed(3), ay: +ay.toFixed(3), aimx: +In.aim.x.toFixed(2), aimy: +In.aim.y.toFixed(2), sprint: In.settings.sprintToggle ? !!In.sprintLatch : In.is('sprint'), attack: In.mouse.l && !In.locked && In.ptrLocked, sec: In.mouse.r && !In.locked && In.ptrLocked, interact: In.is('interact') };
  };
})(window.G);
