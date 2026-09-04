// DRIFTWOOD — keyboard & mouse input
(function (G) {
  'use strict';
  const In = { keys: {}, mouse: { x: 0, y: 0, l: false, r: false }, onAction: null, onKey: null, locked: false, aim: { x: 0, y: 0 } };
  G.Input = In;
  In.init = function (canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (In.onKey && In.onKey(k, e) === true) { e.preventDefault(); return; }
      if (In.locked) return;
      if (!In.keys[k]) {
        In.keys[k] = true;
        if (k === ' ') { In.onAction && In.onAction({ a: 'dodge' }); e.preventDefault(); }
        if (k >= '1' && k <= '9') In.onAction && In.onAction({ a: 'held', slot: +k - 1 });
        if (k === 'e') In.onAction && In.onAction({ a: 'interact' });
        if (k === 't') In.onAction && In.onAction({ a: 'ping', x: In.aim.x, y: In.aim.y });
        if (k === 'q') In.onAction && In.onAction({ a: 'quickeat' });
      }
      if (k === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; In.keys[k] = false; });
    window.addEventListener('blur', () => { In.keys = {}; In.mouse.l = false; In.mouse.r = false; });
    canvas.addEventListener('mousemove', (e) => { In.mouse.x = e.clientX; In.mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', (e) => { if (In.locked) return; if (e.button === 0) { In.mouse.l = true; In.onAction && In.onAction({ a: 'click', x: In.aim.x, y: In.aim.y }); } if (e.button === 2) In.mouse.r = true; e.preventDefault(); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) In.mouse.l = false; if (e.button === 2) In.mouse.r = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (In.locked) return; In.onAction && In.onAction({ a: 'wheel', d: Math.sign(e.deltaY) }); e.preventDefault(); }, { passive: false });
  };
  In.packet = function () {
    const K = In.keys; let ax = 0, ay = 0;
    if (K.w || K.ArrowUp) ay -= 1; if (K.s || K.ArrowDown) ay += 1; if (K.a || K.ArrowLeft) ax -= 1; if (K.d || K.ArrowRight) ax += 1;
    const w = G.Render.screenToWorld(In.mouse.x, In.mouse.y); In.aim = w;
    return { ax, ay, aimx: +w.x.toFixed(2), aimy: +w.y.toFixed(2), sprint: !!K.Shift, attack: In.mouse.l && !In.locked, sec: In.mouse.r && !In.locked, interact: !!K.e };
  };
})(window.G);
