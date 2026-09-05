// DRIFTWOOD — enemy AI, spawning, bosses
(function (G) {
  'use strict';
  const Sim = G.Sim, T = G.T, O = G.OBJS, EN = G.ENEMIES;
  const Enemies = {}; G.Enemies = Enemies;

  const alivePlayers = (S) => Object.values(S.players).filter(p => !p.dead && !p.downed);
  function nearestPlayer(S, e, maxD) {
    let best = null, bd = maxD || 40;
    for (const p of alivePlayers(S)) { const d = G.dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function nearestEnemy(S, e, maxD) {
    let best = null, bd = maxD || 8;
    for (const o of S.enemies) { if (o === e || o.dead || o.hidden || o.owner) continue; const d = G.dist(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  // move toward a point; if blocked by a built structure, attack it
  function moveToward(S, e, tx, ty, dt, spdMul) {
    let a = G.angleTo(e.x, e.y, tx, ty);
    let mul = spdMul || 1; let ang = a; if (mul < 0) { mul = -mul; ang = a + Math.PI; }
    const spd = e.spd * mul * (e.slow > 0 ? 0.7 : 1) * G.tileSpeed(S.world, e.x, e.y);
    e.face = a; a = ang;
    const dx = Math.cos(a) * spd * dt, dy = Math.sin(a) * spd * dt;
    const ox = e.x, oy = e.y;
    const ok = G.moveCircle(S.world, e, dx, dy, Math.min(e.r, 0.45), true);
    if (!ok) {
      // find blocking object ahead
      const bx = e.x + Math.cos(a) * (e.r + 0.4), by = e.y + Math.sin(a) * (e.r + 0.4);
      const i = G.idx(bx, by); const o = S.world.objs.get(i);
      if (o && O[o.t].built && O[o.t].solid !== false) {
        e.wallT = (e.wallT || 0) + dt;
        if (e.wallT > 0.8) { e.wallT = 0; o.hp -= e.dmg * 0.8; Sim.ev(S, { t: 'sfx', n: 'thud', x: bx, y: by }); Sim.ev(S, { t: 'hit', x: (i % G.WORLD) + .5, y: Math.floor(i / G.WORLD) + .5, c: '#a0702e', n: 4 }); Sim.ev(S, { t: 'wobble', i }); if (o.hp <= 0) { G.setObj(S.world, i, null); Sim.ev(S, { t: 'sfx', n: 'break', x: bx, y: by }); Sim.rebuildLights(S); } else G.setObj(S.world, i, o); }
        return false;
      }
      // slide along: try perpendicular
      const side = (e.sideT = (e.sideT || 0) + dt) % 3 < 1.5 ? 1 : -1;
      const pa = a + side * Math.PI / 2;
      G.moveCircle(S.world, e, Math.cos(pa) * spd * dt, Math.sin(pa) * spd * dt, Math.min(e.r, 0.45), true);
    }
    return G.dist(ox, oy, e.x, e.y) > 0.001;
  }

  function strike(S, e, p, mul) {
    const d = EN[e.t]; const reach = d.reach * 1.25 + e.r;
    if (G.dist(e.x, e.y, p.x, p.y) <= reach + 0.35) Sim.damagePlayer(S, p, e.dmg * (mul || 1), e);
    Sim.ev(S, { t: 'slash', x: e.x, y: e.y, a: e.face, r: reach, c: '#ff6060' });
  }
  function aoe(S, e, r, mul) {
    Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r, c: '#ff8040' }); Sim.ev(S, { t: 'shake', v: 6 }); Sim.ev(S, { t: 'sfx', n: 'slam', x: e.x, y: e.y });
    for (const p of alivePlayers(S)) if (G.dist(p.x, p.y, e.x, e.y) < r + 0.35) Sim.damagePlayer(S, p, e.dmg * (mul || 1), e);
  }
  function shoot(S, e, p, type, spd, dmgMul, spread) {
    const a = G.angleTo(e.x, e.y, p.x, p.y) + (spread || 0);
    S.projs.push({ id: G.uid(), x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: e.dmg * (dmgMul || 1), owner: null, src: e, type, life: 3, r: type === 'rock' ? 0.35 : 0.2 });
    Sim.ev(S, { t: 'sfx', n: type === 'rock' ? 'throw' : 'bow', x: e.x, y: e.y });
  }

  // basic melee behaviour used by most enemies: chase -> wind -> strike -> cool
  function meleeAI(S, e, dt, opts) {
    opts = opts || {};
    const d = EN[e.t];
    const p = e.tgtP = nearestPlayer(S, e, 60);
    if (!p) { wander(S, e, dt); return; }
    const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = (opts.cool || 1.1) + Math.random() * 0.4; strike(S, e, p); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; if (opts.backoff) moveToward(S, e, e.x * 2 - p.x, e.y * 2 - p.y, dt, 0.6); return; }
    if (dist <= d.reach) { e.st = 'wind'; e.tm = d.windup; e.face = G.angleTo(e.x, e.y, p.x, p.y); Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  }
  function wander(S, e, dt) {
    e.wt = (e.wt || 0) - dt;
    if (e.wt <= 0) { e.wt = 1 + Math.random() * 2; const a = Math.random() * Math.PI * 2; e.wx = Math.cos(a); e.wy = Math.sin(a); if (Math.random() < 0.4) { e.wx = 0; e.wy = 0; } }
    if (e.wx || e.wy) moveToward(S, e, e.x + e.wx, e.y + e.wy, dt, 0.4);
    e.st = 'idle';
  }

  const AI = {};
  AI.chase = (S, e, dt) => meleeAI(S, e, dt);
  AI.skeleton = (S, e, dt) => meleeAI(S, e, dt, { cool: 0.9 });
  AI.bat = (S, e, dt) => {
    const p = nearestPlayer(S, e, 30); if (!p) return wander(S, e, dt);
    e.jt = (e.jt || 0) - dt; if (e.jt <= 0) { e.jt = 0.3 + Math.random() * 0.4; e.jx = (Math.random() - .5) * 3; e.jy = (Math.random() - .5) * 3; }
    const dist = G.dist(e.x, e.y, p.x, p.y);
    if (dist < 0.7 && e.atkCd <= 0) { e.atkCd = 1.2; Sim.damagePlayer(S, p, e.dmg, e); }
    moveToward(S, e, p.x + e.jx, p.y + e.jy, dt, 1); e.st = 'chase';
  };
  AI.archer = (S, e, dt) => {
    const p = nearestPlayer(S, e, 40); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y);
    if (e.st === 'wind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.6; shoot(S, e, p, 'arrow', 11, 1); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; }
    if (dist < 4) moveToward(S, e, e.x * 2 - p.x, e.y * 2 - p.y, dt, 0.8);
    else if (dist > 7) moveToward(S, e, p.x, p.y, dt, 1);
    else if (e.st !== 'cool') { e.st = 'wind'; e.tm = EN.goblin_archer.windup; Sim.ev(S, { t: 'tell', id: e.id }); }
  };
  AI.wolf = (S, e, dt) => {
    const p = nearestPlayer(S, e, 40); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y);
    if (e.st === 'lunge') { e.tm -= dt; const ok = moveToward(S, e, e.x + Math.cos(e.la), e.y + Math.sin(e.la), dt, 2.6); if (dist < e.r + 0.6 && !e.hitDone) { e.hitDone = true; strike(S, e, p, 1.2); } if (e.tm <= 0 || !ok) { e.st = 'cool'; e.tm = 1.0; } return; }
    if (e.st === 'wind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'lunge'; e.tm = 0.45; e.la = e.face; e.hitDone = false; Sim.ev(S, { t: 'sfx', n: 'growl', x: e.x, y: e.y }); } return; }
    if (e.st === 'cool') { e.tm -= dt; moveToward(S, e, e.x * 2 - p.x, e.y * 2 - p.y, dt, 0.7); if (e.tm <= 0) e.st = 'circle'; return; }
    if (dist < 3.2) { e.ct = (e.ct || 0) + dt; const ca = G.angleTo(p.x, p.y, e.x, e.y) + 1.2; moveToward(S, e, p.x + Math.cos(ca) * 3, p.y + Math.sin(ca) * 3, dt, 0.9); e.st = 'circle'; if (e.ct > 1.2) { e.ct = 0; e.st = 'wind'; e.tm = EN.wolf.windup; Sim.ev(S, { t: 'tell', id: e.id }); } }
    else { moveToward(S, e, p.x, p.y, dt, 1); e.st = 'chase'; }
  };
  AI.treant = (S, e, dt) => {
    const p = nearestPlayer(S, e, 40); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.4; aoe(S, e, 2.6, 1); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (dist <= 1.8) { e.st = 'wind'; e.tm = 1.0; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.crawler = (S, e, dt) => {
    const p = nearestPlayer(S, e, 30); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y);
    if (e.st === 'wind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 2.2; shoot(S, e, p, 'glob', 7, 0.8); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 0.6); return; }
    if (dist < 6 && dist > 2) { e.st = 'wind'; e.tm = EN.crawler.windup; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist <= 2) return meleeAI(S, e, dt);
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.pet = (S, e, dt) => {
    const owner = S.players[e.owner]; if (!owner || owner.dead) { e.dead = true; return; }
    const tgt = nearestEnemy(S, e, 7);
    if (tgt && G.dist(owner.x, owner.y, e.x, e.y) < 12) {
      const dist = G.dist(e.x, e.y, tgt.x, tgt.y) - tgt.r;
      if (dist < 0.9) { if (e.atkCd <= 0) { e.atkCd = 0.8; Sim.hitEnemy(S, tgt, e.dmg, null, { kb: 2 }); e.face = G.angleTo(e.x, e.y, tgt.x, tgt.y); } e.st = 'wind'; }
      else { moveToward(S, e, tgt.x, tgt.y, dt, 1); e.st = 'chase'; }
    } else { const d = G.dist(owner.x, owner.y, e.x, e.y); if (d > 2) { moveToward(S, e, owner.x, owner.y, dt, d > 8 ? 1.4 : 1); e.st = 'chase'; } else e.st = 'idle'; }
    e.hp = Math.min(e.maxHp, e.hp + dt * 2);
  };
  AI.tentacle = (S, e, dt) => {
    e.life = (e.life || 25) - dt; if (e.life <= 0) { e.dead = true; return; }
    const p = nearestPlayer(S, e, 40); if (!p) return;
    const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.5; e.face = G.angleTo(e.x, e.y, p.x, p.y); strike(S, e, p, 1); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'idle'; return; }
    if (dist <= EN.tentacle.reach) { e.st = 'wind'; e.tm = EN.tentacle.windup; Sim.ev(S, { t: 'tell', id: e.id }); } else e.st = 'idle';
  };

  // ---------- bosses ----------
  function bossCd(e, k, dt) { e.cd[k] = Math.max(0, (e.cd[k] || 0) - dt); return e.cd[k] <= 0; }
  AI.gronk = (S, e, dt) => {
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['throw', 'charge'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.2; aoe(S, e, 2.9, 1.1); } return; }
    if (e.st === 'throwwind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.0; shoot(S, e, p, 'rock', 9, 0.9); e.cd.throw = 5; } return; }
    if (e.st === 'chargewind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'charge'; e.tm = 2.2; e.la = e.face; e.hitDone = false; Sim.ev(S, { t: 'sfx', n: 'roar', x: e.x, y: e.y }); } return; }
    if (e.st === 'charge') { e.tm -= dt; const ok = moveToward(S, e, e.x + Math.cos(e.la) * 2, e.y + Math.sin(e.la) * 2, dt, 3.6); for (const q of alivePlayers(S)) if (!e.hitDone && G.dist(q.x, q.y, e.x, e.y) < e.r + 0.5) { e.hitDone = true; Sim.damagePlayer(S, q, e.dmg * 1.3, e); } if (e.tm <= 0 || !ok) { e.st = 'cool'; e.tm = 1.5; e.cd.charge = 9; Sim.ev(S, { t: 'shake', v: 5 }); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (dist <= 2.0) { e.st = 'wind'; e.tm = 1.0; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist > 5 && e.cd.throw <= 0) { e.st = 'throwwind'; e.tm = 0.8; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist > 3.5 && e.cd.charge <= 0) { e.st = 'chargewind'; e.tm = 0.7; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.hollow = (S, e, dt) => {
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['summon', 'tele', 'volley'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.0; aoe(S, e, 3.4, 1.0); } return; }
    if (e.st === 'volleywind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.2; for (let k = -2; k <= 2; k++) shoot(S, e, p, 'arrow', 12, 0.7, k * 0.16); e.cd.volley = 4; } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (e.cd.summon <= 0) { const n = S.enemies.filter(x => !x.dead && x.t === 'skeleton' && x.summoned).length; if (n < 5) { for (let k = 0; k < 2; k++) { const a = Math.random() * 6.28; const s = Sim.makeEnemy(S, 'skeleton', e.x + Math.cos(a) * 2, e.y + Math.sin(a) * 2, Sim.difficulty(S) * 0.8); s.summoned = true; S.enemies.push(s); Sim.ev(S, { t: 'boom', x: s.x, y: s.y, r: 0.7, c: '#6060ff' }); } Sim.ev(S, { t: 'sfx', n: 'summon', x: e.x, y: e.y }); } e.cd.summon = 12; }
    if (dist < 1.8 && e.cd.tele <= 0) { const a = Math.random() * 6.28; const nx = e.x + Math.cos(a) * 6, ny = e.y + Math.sin(a) * 6; if (!G.blocked(S.world, nx, ny, true)) { Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 1, c: '#6060ff' }); e.x = nx; e.y = ny; Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 1, c: '#6060ff' }); Sim.ev(S, { t: 'sfx', n: 'tele', x: e.x, y: e.y }); e.cd.tele = 6; return; } }
    if (dist <= 2.6 && Math.random() < 0.5) { e.st = 'wind'; e.tm = 0.9; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist > 3 && e.cd.volley <= 0) { e.st = 'volleywind'; e.tm = 0.7; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, dist > 8 ? 1.4 : 0.9);
  };
  AI.cinder = (S, e, dt) => {
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt);
    const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['burrow', 'breath', 'spawn'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'burrow') { e.tm -= dt; e.hidden = true; if (e.tm <= 0) { e.hidden = false; e.x = p.x + (Math.random() - .5) * 2; e.y = p.y + (Math.random() - .5) * 2; e.st = 'cool'; e.tm = 1.2; aoe(S, e, 2.6, 1.2); for (let k = 0; k < 4; k++) S.puddles.push({ x: e.x + (Math.random() - .5) * 4, y: e.y + (Math.random() - .5) * 4, r: 0.9, t: 6 }); e.cd.burrow = 11; } return; }
    if (e.st === 'breathwind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.4; for (let k = -2; k <= 2; k++) shoot(S, e, p, 'glob', 8, 0.6, k * 0.22); e.cd.breath = 6; Sim.ev(S, { t: 'sfx', n: 'roar', x: e.x, y: e.y }); } return; }
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 0.9; strike(S, e, p, 1.1); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (e.cd.spawn <= 0) { const n = S.enemies.filter(x => !x.dead && x.t === 'crawler').length; if (n < 4) { const c = Sim.makeEnemy(S, 'crawler', e.x + 1, e.y + 1, Sim.difficulty(S) * 0.8); S.enemies.push(c); } e.cd.spawn = 10; }
    if (e.cd.burrow <= 0 && dist > 2) { e.st = 'burrow'; e.tm = 1.8; Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 1.4, c: '#ff6a1a' }); Sim.ev(S, { t: 'sfx', n: 'slam', x: e.x, y: e.y }); return; }
    if (dist > 3 && e.cd.breath <= 0) { e.st = 'breathwind'; e.tm = 0.9; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist <= 2.3) { e.st = 'wind'; e.tm = 0.8; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.leviathan = (S, e, dt) => {
    const p = nearestPlayer(S, e, 60); if (!p) return;
    ['tent', 'spit', 'slam'].forEach(k => bossCd(e, k, dt));
    e.face = G.angleTo(e.x, e.y, p.x, p.y);
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.2; Sim.ev(S, { t: 'boom', x: e.sx, y: e.sy, r: 2.4, c: '#4090ff' }); Sim.ev(S, { t: 'sfx', n: 'slam', x: e.sx, y: e.sy }); Sim.ev(S, { t: 'shake', v: 7 }); for (const q of alivePlayers(S)) if (G.dist(q.x, q.y, e.sx, e.sy) < 2.6) Sim.damagePlayer(S, q, e.dmg, e); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'idle'; return; }
    if (e.cd.tent <= 0) { const n = S.enemies.filter(x => !x.dead && x.t === 'tentacle').length; if (n < 4) { const q = alivePlayers(S)[Math.floor(Math.random() * alivePlayers(S).length)]; const a = Math.random() * 6.28; const tx = q.x + Math.cos(a) * 2.5, ty = q.y + Math.sin(a) * 2.5; if (!G.blocked(S.world, tx, ty, false) || G.tileAt(S.world, tx, ty) <= T.WATER) { const tn = Sim.makeEnemy(S, 'tentacle', tx, ty, Sim.difficulty(S)); S.enemies.push(tn); Sim.ev(S, { t: 'boom', x: tx, y: ty, r: 1, c: '#4090ff' }); Sim.ev(S, { t: 'sfx', n: 'splash', x: tx, y: ty }); } } e.cd.tent = 7; }
    if (e.cd.spit <= 0) { shoot(S, e, p, 'glob', 9, 0.7); e.cd.spit = 2.5; }
    if (e.cd.slam <= 0) { e.st = 'wind'; e.tm = 1.2; e.sx = p.x; e.sy = p.y; Sim.ev(S, { t: 'target', x: p.x, y: p.y, r: 2.4, d: 1.2 }); e.cd.slam = 6; return; }
    e.st = 'idle';
  };

  // ---------- spawning ----------
  function pickType(S, night, biome) {
    const pool = [];
    for (const k in EN) { const d = EN[k]; if (d.minNight > night || d.boss || d.always) continue; if (d.biome !== undefined && d.biome !== biome) continue; pool.push(k); }
    if (!pool.length) return 'slime';
    // weight: newer enemies a bit rarer
    const weights = pool.map(k => EN[k].minNight === night ? 1.5 : (k === 'bat' ? 0.6 : 1));
    let s = weights.reduce((a, b) => a + b, 0), r = Math.random() * s;
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function spawnNear(S, p, type, minD, maxD, lvl) {
    if (S.nev === 'fog') { minD = Math.max(5, minD - 3); maxD = Math.max(minD + 2, maxD - 4); }
    const eliteP = (G.ENEMIES[type].boss || type === 'bat' || type === 'slime_small' || S.day < 2) ? 0 : (S.nev === 'elite' ? 0.3 : Math.min(0.2, 0.03 + 0.02 * (S.day - 2)));
    for (let t = 0; t < 12; t++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!G.inWorld(x, y) || G.blocked(S.world, x, y, true) || G.tileAt(S.world, x, y) <= T.WATER) continue;
      if (Sim.claimed(S, x, y)) continue;
      const e = Sim.makeEnemy(S, type, x, y, lvl, Math.random() < eliteP); S.enemies.push(e); return e;
    }
    return null;
  }
  Enemies.spawnNightBoss = function (S, players, night) {
    const idx = night - 1; const type = idx < G.NIGHT_BOSSES.length ? G.NIGHT_BOSSES[idx] : G.NIGHT_BOSSES[Math.floor(Math.random() * G.NIGHT_BOSSES.length)];
    const p = players[Math.floor(Math.random() * players.length)];
    const lvl = Sim.difficulty(S) * 0.7 * Math.min(1, 0.55 + 0.1 * idx);
    const e = spawnNear(S, p, type, 11, 15, lvl) || (() => { const e2 = Sim.makeEnemy(S, type, p.x + 10, p.y, lvl); S.enemies.push(e2); return e2; })();
    e.elite = false; e.nightBoss = true; e.dmg *= 0.85; if (idx >= G.NIGHT_BOSSES.length) { e.hp = Math.round(e.hp * 1.4); e.maxHp = e.hp; e.dmg *= 1.15; }
    S.bosses[type] = 'alive';
    Sim.ev(S, { t: 'chat', sys: true, msg: '☠ ' + G.ENEMIES[type].name + ' has come for you.' }); Sim.ev(S, { t: 'sfx', n: 'roar', x: e.x, y: e.y }); Sim.ev(S, { t: 'shake', v: 9 });
    Sim.ev(S, { t: 'bossin', k: type });
  };
  function slowPlayers(S, x, y, r, secs) { for (const p of alivePlayers(S)) if (G.dist(p.x, p.y, x, y) < r) p.slow = Math.max(p.slow, secs); }
  // ---- night boss AIs ----
  AI.bonecrusher = (S, e, dt) => { // huge skeleton: club slam + bone toss + summons small skeletons
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt); const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['toss', 'summon'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.1; aoe(S, e, 2.6, 1.0); } return; }
    if (e.st === 'tosswind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 0.9; for (let k = -1; k <= 1; k++) shoot(S, e, p, 'rock', 9, 0.6, k * 0.25); e.cd.toss = 5; } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (e.cd.summon <= 0) { e.cd.summon = 14; const n = S.enemies.filter(x => !x.dead && x.t === 'skeleton' && x.summoned).length; if (n < 4) for (let k = 0; k < 2; k++) { const s = Sim.makeEnemy(S, 'skeleton', e.x + (Math.random() - .5) * 3, e.y + (Math.random() - .5) * 3, Sim.difficulty(S) * 0.7); s.summoned = true; S.enemies.push(s); Sim.ev(S, { t: 'boom', x: s.x, y: s.y, r: 0.6, c: '#e0e0d0' }); } Sim.ev(S, { t: 'sfx', n: 'summon', x: e.x, y: e.y }); }
    if (dist <= 2.0) { e.st = 'wind'; e.tm = 0.9; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist > 4 && e.cd.toss <= 0) { e.st = 'tosswind'; e.tm = 0.7; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.warden = (S, e, dt) => { // armoured knight: blocks frontal hits, shield charge, sweeping strikes
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt); const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['charge'].forEach(k => bossCd(e, k, dt)); e.ai2 = 'skeleton'; // frontal block handled in hitEnemy via e.ai === 'skeleton' check below
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 0.8; strike(S, e, p, 1.2); for (const q of alivePlayers(S)) if (q !== p && G.dist(q.x, q.y, e.x, e.y) < 2.4 + e.r) Sim.damagePlayer(S, q, e.dmg, e); } return; }
    if (e.st === 'chargewind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'charge'; e.tm = 1.6; e.la = e.face; e.hitDone = false; Sim.ev(S, { t: 'sfx', n: 'roar', x: e.x, y: e.y }); } return; }
    if (e.st === 'charge') { e.tm -= dt; const ok = moveToward(S, e, e.x + Math.cos(e.la) * 2, e.y + Math.sin(e.la) * 2, dt, 3.4); for (const q of alivePlayers(S)) if (!e.hitDone && G.dist(q.x, q.y, e.x, e.y) < e.r + 0.5) { e.hitDone = true; Sim.damagePlayer(S, q, e.dmg * 1.5, e); q.slow = 1.5; } if (e.tm <= 0 || !ok) { e.st = 'cool'; e.tm = 1.4; e.cd.charge = 8; Sim.ev(S, { t: 'shake', v: 5 }); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (dist <= 1.9) { e.st = 'wind'; e.tm = 0.8; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist > 4 && e.cd.charge <= 0) { e.st = 'chargewind'; e.tm = 0.8; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.matriarch = (S, e, dt) => { // giant spider: web shots (slow), spiderling swarms, pounce
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt); const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['web', 'spawn', 'pounce'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'webwind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.0; for (let k = -1; k <= 1; k++) shoot(S, e, p, 'web', 9, 0.4, k * 0.2); e.cd.web = 6; } return; }
    if (e.st === 'pouncewind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'pounce'; e.tm = 0.5; e.la = e.face; e.hitDone = false; } return; }
    if (e.st === 'pounce') { e.tm -= dt; moveToward(S, e, e.x + Math.cos(e.la) * 2, e.y + Math.sin(e.la) * 2, dt, 4.5); if (dist < e.r + 0.8 && !e.hitDone) { e.hitDone = true; strike(S, e, p, 1.4); } if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.2; e.cd.pounce = 7; } return; }
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 0.9; strike(S, e, p, 1); } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (e.cd.spawn <= 0) { e.cd.spawn = 10; const n = S.enemies.filter(x => !x.dead && x.t === 'spiderling').length; if (n < 8) for (let k = 0; k < 4; k++) S.enemies.push(Sim.makeEnemy(S, 'spiderling', e.x + (Math.random() - .5) * 2, e.y + (Math.random() - .5) * 2, Sim.difficulty(S))); Sim.ev(S, { t: 'sfx', n: 'summon', x: e.x, y: e.y }); }
    if (dist > 3 && e.cd.web <= 0) { e.st = 'webwind'; e.tm = 0.7; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist > 2.5 && dist < 7 && e.cd.pounce <= 0) { e.st = 'pouncewind'; e.tm = 0.6; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist <= 2.2) { e.st = 'wind'; e.tm = 0.7; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.frostmaw = (S, e, dt) => { // ice wolf: lunges, frost breath cone, howl summons wolves
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt); const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['breath', 'howl'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'breathwind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.2; Sim.ev(S, { t: 'boom', x: e.x + Math.cos(e.face) * 2, y: e.y + Math.sin(e.face) * 2, r: 2.5, c: '#a0e0ff' }); for (const q of alivePlayers(S)) { const a = G.angleTo(e.x, e.y, q.x, q.y); if (G.dist(e.x, e.y, q.x, q.y) < 5 && Math.abs(G.angDiff(e.face, a)) < 0.7) { Sim.damagePlayer(S, q, e.dmg * 0.9, e, { ranged: true }); q.slow = 3; } } e.cd.breath = 7; } return; }
    if (e.st === 'lunge') { e.tm -= dt; const ok = moveToward(S, e, e.x + Math.cos(e.la), e.y + Math.sin(e.la), dt, 2.8); if (dist < e.r + 0.7 && !e.hitDone) { e.hitDone = true; strike(S, e, p, 1.3); } if (e.tm <= 0 || !ok) { e.st = 'cool'; e.tm = 0.9; } return; }
    if (e.st === 'wind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'lunge'; e.tm = 0.5; e.la = e.face; e.hitDone = false; Sim.ev(S, { t: 'sfx', n: 'growl', x: e.x, y: e.y }); } return; }
    if (e.st === 'cool') { e.tm -= dt; moveToward(S, e, e.x * 2 - p.x, e.y * 2 - p.y, dt, 0.6); if (e.tm <= 0) e.st = 'chase'; return; }
    if (e.cd.howl <= 0) { e.cd.howl = 16; const n = S.enemies.filter(x => !x.dead && x.t === 'wolf').length; if (n < 4) for (let k = 0; k < 2; k++) spawnNear(S, p, 'wolf', 6, 10); Sim.ev(S, { t: 'sfx', n: 'roar', x: e.x, y: e.y }); Sim.ev(S, { t: 'chat', sys: true, msg: 'Frostmaw howls. The pack answers.' }); }
    if (dist < 5 && e.cd.breath <= 0) { e.st = 'breathwind'; e.tm = 0.7; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (dist < 4) { e.st = 'wind'; e.tm = 0.5; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  AI.lich = (S, e, dt) => { // mage: ice volleys, blink, raises skeleton archers, drains life
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt); const dist = G.dist(e.x, e.y, p.x, p.y);
    ['volley', 'tele', 'raise', 'drain'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'volleywind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.0; for (let k = -2; k <= 2; k++) shoot(S, e, p, 'glob', 10, 0.55, k * 0.18); e.cd.volley = 4; } return; }
    if (e.st === 'drainwind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.0; for (const q of alivePlayers(S)) if (G.dist(q.x, q.y, e.x, e.y) < 6) { Sim.damagePlayer(S, q, e.dmg * 0.8, e, { ranged: true }); e.hp = Math.min(e.maxHp, e.hp + 40); Sim.ev(S, { t: 'zap', x1: q.x, y1: q.y, x2: e.x, y2: e.y }); } e.cd.drain = 9; } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (e.cd.raise <= 0) { e.cd.raise = 13; const n = S.enemies.filter(x => !x.dead && x.summoned).length; if (n < 5) for (let k = 0; k < 2; k++) { const s = Sim.makeEnemy(S, k ? 'goblin_archer' : 'skeleton', e.x + (Math.random() - .5) * 3, e.y + (Math.random() - .5) * 3, Sim.difficulty(S) * 0.7); s.summoned = true; S.enemies.push(s); Sim.ev(S, { t: 'boom', x: s.x, y: s.y, r: 0.6, c: '#6040c0' }); } Sim.ev(S, { t: 'sfx', n: 'summon', x: e.x, y: e.y }); }
    if (dist < 3 && e.cd.tele <= 0) { const a = Math.random() * 6.28; const nx = e.x + Math.cos(a) * 7, ny = e.y + Math.sin(a) * 7; if (!G.blocked(S.world, nx, ny, true)) { Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 1, c: '#6040c0' }); e.x = nx; e.y = ny; Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 1, c: '#6040c0' }); Sim.ev(S, { t: 'sfx', n: 'tele', x: e.x, y: e.y }); e.cd.tele = 5; return; } }
    if (dist < 6 && e.cd.drain <= 0) { e.st = 'drainwind'; e.tm = 1.0; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (e.cd.volley <= 0) { e.st = 'volleywind'; e.tm = 0.8; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, dist > 9 ? 1.3 : (dist < 4 ? -0.8 : 0.5));
  };
  AI.titan = (S, e, dt) => { // stone colossus: stomp quake, boulder barrage, grab-slam
    const p = nearestPlayer(S, e, 60); if (!p) return wander(S, e, dt); const dist = G.dist(e.x, e.y, p.x, p.y) - e.r;
    ['stomp', 'boulder'].forEach(k => bossCd(e, k, dt));
    if (e.st === 'wind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.3; aoe(S, e, 3.2, 1.2); } return; }
    if (e.st === 'stompwind') { e.tm -= dt; if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.6; Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 7, c: '#c0c8e0' }); Sim.ev(S, { t: 'shake', v: 14 }); Sim.ev(S, { t: 'sfx', n: 'slam', x: e.x, y: e.y }); for (const q of alivePlayers(S)) if (G.dist(q.x, q.y, e.x, e.y) < 7) { Sim.damagePlayer(S, q, e.dmg * 0.7, e); q.slow = 2; } e.cd.stomp = 12; } return; }
    if (e.st === 'boulderwind') { e.tm -= dt; e.face = G.angleTo(e.x, e.y, p.x, p.y); if (e.tm <= 0) { e.st = 'cool'; e.tm = 1.2; for (let k = -2; k <= 2; k++) shoot(S, e, p, 'rock', 8 + Math.abs(k), 0.7, k * 0.22); e.cd.boulder = 7; } return; }
    if (e.st === 'cool') { e.tm -= dt; if (e.tm <= 0) e.st = 'chase'; return; }
    if (dist <= 2.6) { e.st = 'wind'; e.tm = 1.2; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    if (e.cd.stomp <= 0 && dist < 6) { e.st = 'stompwind'; e.tm = 1.4; Sim.ev(S, { t: 'tell', id: e.id }); Sim.ev(S, { t: 'target', x: e.x, y: e.y, r: 7, d: 1.4 }); return; }
    if (dist > 5 && e.cd.boulder <= 0) { e.st = 'boulderwind'; e.tm = 1.0; Sim.ev(S, { t: 'tell', id: e.id }); return; }
    e.st = 'chase'; moveToward(S, e, p.x, p.y, dt, 1);
  };
  Enemies.spawnLeviathan = function (S) {
    const b = S.world.boat; let x = b.x, y = b.y + 3;
    // find water south of the boat
    for (let k = 1; k < 8; k++) { if (G.tileAt(S.world, b.x, b.y + k) <= T.WATER) { x = b.x; y = b.y + k + 0.5; break; } }
    const e = Sim.makeEnemy(S, 'leviathan', x, y, Sim.difficulty(S) * 0.85); S.enemies.push(e); S.bosses.leviathan = 'alive';
    Sim.ev(S, { t: 'chat', sys: true, msg: 'THE LEVIATHAN RISES. Kill it to escape!' }); Sim.ev(S, { t: 'sfx', n: 'roar', x, y }); Sim.ev(S, { t: 'shake', v: 12 });
    Sim.ev(S, { t: 'boom', x, y, r: 3, c: '#4090ff' });
  };

  Enemies.update = function (S, dt) {
    if (S.tutHold) { for (const e of S.enemies) if (!e.dead && !e.owner) e.dead = true; S.enemies = S.enemies.filter(e => !e.dead); return; } // the tutorial clearing stays quiet until the first campfire
    const players = alivePlayers(S), night = S.day - 1, nPl = Math.max(1, Object.keys(S.players).length);
    const alive = S.enemies.filter(e => !e.dead && !e.owner && !e.boss).length;
    const cap = 30 + 8 * nPl;
    // waves & trickle
    if (players.length && S.phase === 'run') {
      const inNight = Sim.isNight(S);
      if (inNight) {
        const wave = (k, n) => { if (!S.waves[k]) { S.waves[k] = true; for (let i = 0; i < n; i++) { const p = players[i % players.length]; spawnNear(S, p, pickType(S, night, S.world.biome[G.idx(p.x, p.y)]), 9, 14); } Sim.ev(S, { t: 'chat', sys: true, msg: k === 'a' ? 'Night falls. They are coming.' : 'A heavier wave approaches!' }); Sim.ev(S, { t: 'sfx', n: 'horn' }); } };
        wave('a', Math.round((3 + night * 2) * (0.6 + 0.4 * nPl)));
        if (S.time >= G.NIGHT_AT + 28) { const had = !!S.waves.b; wave('b', Math.round((5 + night * 3) * (0.6 + 0.4 * nPl))); if (!had && night >= 1) Enemies.spawnNightBoss(S, players, night); }
        S.spawnT -= dt;
        if (S.spawnT <= 0 && alive < cap) { S.spawnT = Math.max(2.5, 10 - night * 0.7) / Math.sqrt(nPl); const p = players[Math.floor(Math.random() * players.length)]; spawnNear(S, p, pickType(S, night, S.world.biome[G.idx(p.x, p.y)]), 9, 15); if (S.nev === 'swarm') for (let k = 0; k < 2; k++) spawnNear(S, p, 'bat', 8, 13); }
      } else if (S.time > G.DUSK_AT) {
        S.spawnT -= dt; if (S.spawnT <= 0 && alive < cap) { S.spawnT = 6; const p = players[Math.floor(Math.random() * players.length)]; if (S.world.biome[G.idx(p.x, p.y)] === G.BIOME.FOREST) spawnNear(S, p, 'wolf', 10, 15); }
      }
      // volcano crawlers always; daytime forest wolves occasionally
      S.dayT = (S.dayT || 0) - dt;
      if (S.dayT <= 0) {
        S.dayT = 7;
        for (const p of players) {
          const b = S.world.biome[G.idx(p.x, p.y)];
          if (b === G.BIOME.VOLCANO && S.enemies.filter(e => !e.dead && e.t === 'crawler').length < 3 + nPl) spawnNear(S, p, 'crawler', 8, 13);
          else if (b === G.BIOME.FOREST && night >= 1 && Math.random() < 0.35 && S.enemies.filter(e => !e.dead && e.t === 'wolf').length < 2 + nPl) spawnNear(S, p, 'wolf', 9, 14);
          else if (b === G.BIOME.MEADOW && Math.random() < 0.25 && alive < 6) spawnNear(S, p, Math.random() < 0.5 ? 'slime' : 'goblin', 10, 15);
        }
      }
    }
    if (S.phase === 'siege' && players.length) {
      S.waveT -= dt;
      if (S.waveT <= 0 && alive < cap) { S.waveT = 5; const n = 3 + nPl * 2; for (let i = 0; i < n; i++) { const p = players[i % players.length]; spawnNear(S, p, pickType(S, Math.max(night, 5), S.world.biome[G.idx(p.x, p.y)]), 8, 13, Sim.difficulty(S) * 1.1); } }
    }
    // update enemies
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt; if (e.slow > 0) e.slow -= dt; if (e.atkCd > 0) e.atkCd -= dt;
      if (e.burn > 0) { e.burn -= dt; e.hp -= dt * 6; if (e.hp <= 0) Sim.killEnemy(S, e, null); if (Math.random() < dt * 4) Sim.ev(S, { t: 'fire', x: e.x, y: e.y }); }
      if (e.poison > 0) { e.poison -= dt; e.hp -= dt * 5; if (e.hp <= 0) Sim.killEnemy(S, e, null); if (Math.random() < dt * 3) Sim.ev(S, { t: 'hit', x: e.x, y: e.y, c: '#60c040', n: 1 }); }
      // friendly fire puddles burn monsters
      if (e.burn <= 0 && e.t !== 'crawler' && e.t !== 'cinder') for (const pu of S.puddles) if (pu.friendly && G.dist(pu.x, pu.y, e.x, e.y) < pu.r + e.r) { e.burn = 1; break; }
      // knockback
      if (Math.abs(e.kbx) > 0.01 || Math.abs(e.kby) > 0.01) { G.moveCircle(S.world, e, e.kbx * dt * 0.8, e.kby * dt * 0.8, Math.min(e.r, 0.45), true); e.kbx *= Math.pow(0.02, dt); e.kby *= Math.pow(0.02, dt); }
      if (e.stun > 0) { e.stun -= dt; e.st = 'stun'; continue; }
      // spikes
      const ob = S.world.objs.get(G.idx(e.x, e.y));
      if (ob && O[ob.t].trap && !e.owner) { e.trapT = (e.trapT || 0) + dt; if (e.trapT > 0.5) { e.trapT = 0; Sim.hitEnemy(S, e, O[ob.t].trap, null, { noCrit: true }); ob.hp -= 2; if (ob.hp <= 0) G.setObj(S.world, G.idx(e.x, e.y), null); } }
      // lava hurts non-volcano enemies
      if (G.tileAt(S.world, e.x, e.y) === T.LAVA && e.t !== 'crawler' && e.t !== 'cinder') e.burn = 1;
      const fn = AI[e.ai]; if (fn) fn(S, e, dt);
      // night bosses retreat at dawn (no loot) so one bad night cannot snowball into a lost run
      if (e.nightBoss && !Sim.isNight(S) && S.phase === 'run' && S.time > 20 && S.time < G.DUSK_AT) { e.dead = true; S.bosses[e.t] = undefined; delete S.bosses[e.t]; Sim.ev(S, { t: 'chat', sys: true, msg: G.ENEMIES[e.t].name + ' retreats into the mist. It will be back.' }); Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 2, c: '#c0c0ff' }); continue; }
      // despawn far non-boss enemies during the day
      if (!e.boss && !e.owner && !Sim.isNight(S) && S.phase === 'run' && e.ai !== 'crawler') { const p = nearestPlayer(S, e, 200); if (!p || G.dist(p.x, p.y, e.x, e.y) > 40) e.dead = true; }
    }
    // cleanup
    if (S.enemies.length && S.enemies.some(e => e.dead)) S.enemies = S.enemies.filter(e => !e.dead);
  };
})(window.G);
