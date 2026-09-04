// DRIFTWOOD — authoritative simulation (runs on the host)
(function (G) {
  'use strict';
  const I = G.ITEMS, O = G.OBJS, T = G.T;
  const INV = 27, HOTBAR = 9;
  const FIST = { name: 'Fists', dmg: 3, spd: 2.2, reach: 1.1, arc: 1.6, kb: 2, power: 0.6, tool: 'fist', tier: 1 };
  const TOOL_POWER = [0, 1.5, 2.5, 4, 6, 9];

  const Sim = {};
  G.Sim = Sim;

  Sim.create = function (seedStr) {
    const world = G.generateWorld(seedStr);
    return {
      world, time: 30, day: 1, elapsed: 0, phase: 'run', players: {}, enemies: [], projs: [], drops: [], puddles: [],
      events: [], boat: { wood: 0, iron_bar: 0, rope: 0, emerald: 0, sapphire: 0, ruby: 0, done: false },
      siegeT: 0, bosses: {}, kills: 0, spawnT: 4, waves: {}, lights: [], lightT: 0, order: 0, stats: { kills: 0, chests: 0, deaths: 0 },
      msg: [],
    };
  };

  Sim.ev = (S, e) => S.events.push(e);

  // ---------------- players ----------------
  Sim.addPlayer = function (S, id, name, col) {
    const sp = S.world.spawn;
    const p = {
      id, name: String(name || 'Player').slice(0, 14), col: col || G.PLAYER_COLORS[Object.keys(S.players).length % 8],
      x: sp.x + (Object.keys(S.players).length % 4) * 0.8 - 1, y: sp.y, vx: 0, vy: 0, face: -Math.PI / 2,
      hp: 100, maxHp: 100, stam: 100, hunger: 100, inv: new Array(INV).fill(null), held: 0,
      armor: { head: null, chest: null, legs: null }, coins: 0, pw: {}, buffs: [],
      swing: null, atkCd: 0, dodgeT: 0, dodgeCh: 1, dodgeCd: 0, dodgeDx: 0, dodgeDy: 0, draw: 0, blocking: false, blockT: 0,
      downed: false, bleed: 0, dead: false, revive: 0, flash: 0, swCd: 0, phoenixUsed: false, kills: 0, dark: 0, burn: 0,
      in: { ax: 0, ay: 0, aimx: sp.x, aimy: sp.y - 1, sprint: false, attack: false, sec: false, interact: false },
      moving: false, anim: 0, pet: null, order: S.order++,
    };
    S.players[id] = p;
    Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' washed ashore.' });
    return p;
  };
  Sim.removePlayer = function (S, id) { const p = S.players[id]; if (p) { Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' left.' }); delete S.players[id]; } };
  Sim.setInput = function (S, id, inp) { const p = S.players[id]; if (p) p.in = inp; };

  Sim.stats = function (p) {
    const c = k => p.pw[k] || 0, s = {};
    s.speed = 4.4 * (1 + 0.12 * c('sneakers'));
    s.atk = (1 + 0.10 * c('whetstone')) * (1 + 0.5 * c('warlord'));
    if (p.hp < 0.4 * p.maxHp) s.atk *= 1 + 0.3 * c('berserk');
    let def = 6 * c('ironskin');
    for (const k in p.armor) if (p.armor[k]) def += I[p.armor[k]].def;
    s.def = def;
    let hpB = 0, stB = 0;
    for (const b of p.buffs) { hpB += b.hp || 0; stB += b.stam || 0; }
    s.maxHp = 100 + 15 * c('broth') + hpB;
    s.crit = 0.05 + 0.10 * c('critlens');
    s.lifesteal = 0.08 * c('vampire');
    s.regen = 0.5 * c('bandage');
    s.pickup = 1.7 + 2 * c('magnet');
    s.dodges = 1 + c('feather');
    s.sprintCost = 12 * Math.pow(0.7, c('sprinter'));
    s.thorns = 0.2 * c('thorns');
    s.blast = 1 - Math.pow(0.85, c('blastcap'));
    s.chain = 1 - Math.pow(0.9, c('chain'));
    s.frost = c('frost') > 0;
    s.coinMul = (1 + 0.25 * c('luckycoin')) * (c('midas') ? 2 : 1);
    s.chestDisc = c('midas') ? 0.8 : 1;
    s.foodMul = c('gluttony') ? 2 : 1;
    s.dmgTaken = 1 + 0.5 * c('warlord');
    s.stamRegen = 16 + stB;
    return s;
  };

  Sim.heldItem = (p) => p.inv[p.held];
  Sim.weapon = function (p) {
    const it = Sim.heldItem(p); if (!it) return FIST;
    const d = I[it.id];
    if (d.type === 'weapon' || d.type === 'tool') return d;
    return FIST;
  };

  // ---- inventory ----
  Sim.count = (p, id) => p.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
  Sim.give = function (p, id, n) {
    const max = G.STACK(id);
    for (let i = 0; i < INV && n > 0; i++) { const s = p.inv[i]; if (s && s.id === id && s.n < max) { const a = Math.min(max - s.n, n); s.n += a; n -= a; } }
    for (let i = 0; i < INV && n > 0; i++) if (!p.inv[i]) { const a = Math.min(max, n); p.inv[i] = { id, n: a }; n -= a; }
    return n; // leftover
  };
  Sim.take = function (p, id, n) {
    for (let i = INV - 1; i >= 0 && n > 0; i--) { const s = p.inv[i]; if (s && s.id === id) { const a = Math.min(s.n, n); s.n -= a; n -= a; if (s.n <= 0) p.inv[i] = null; } }
    return n === 0;
  };
  Sim.canCraft = function (S, p, r) {
    for (const k in r.needs) if (Sim.count(p, k) < r.needs[k]) return false;
    if (r.station && !Sim.nearStation(S, p, r.station, 3.5)) return false;
    return true;
  };
  Sim.nearStation = function (S, p, st, rad) {
    const w = S.world;
    for (let y = Math.floor(p.y - rad); y <= p.y + rad; y++) for (let x = Math.floor(p.x - rad); x <= p.x + rad; x++) {
      const o = w.objs.get(G.idx(x, y)); if (o && O[o.t].station === st && G.dist(p.x, p.y, x + .5, y + .5) <= rad) return true;
    }
    return false;
  };

  // ---------------- drops ----------------
  Sim.spawnDrop = function (S, item, n, x, y) {
    const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.2;
    S.drops.push({ id: G.uid(), item, n, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
  };
  Sim.dropLoot = function (S, drops, x, y, mul) {
    for (const [id, a, b] of drops) { const n = Math.round((a + Math.floor(Math.random() * (b - a + 1))) * (mul || 1)); if (n > 0) Sim.spawnDrop(S, id, n, x, y); }
  };

  // ---------------- damage ----------------
  Sim.damagePlayer = function (S, p, dmg, src, opts) {
    opts = opts || {};
    if (p.dead || p.downed) return;
    if (p.dodgeT > 0.05) { Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'dodge', c: '#ffffff' }); return; }
    const st = Sim.stats(p);
    if (p.blocking) {
      const it = Sim.heldItem(p); const sh = it && I[it.id].type === 'shield' ? I[it.id] : null;
      let facing = true;
      if (src && src.x !== undefined) facing = Math.abs(G.angDiff(p.face, G.angleTo(p.x, p.y, src.x, src.y))) < 1.4;
      if (sh && facing && p.stam > 0) {
        if (p.blockT < 0.18 && src && src.hp !== undefined) { src.stun = Math.max(src.stun || 0, 1.2); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'PARRY', c: '#80e0ff' }); Sim.ev(S, { t: 'sfx', n: 'parry', x: p.x, y: p.y }); }
        dmg *= (1 - sh.block); p.stam = Math.max(0, p.stam - 15);
        Sim.ev(S, { t: 'sfx', n: 'block', x: p.x, y: p.y });
      }
    }
    dmg *= st.dmgTaken;
    dmg *= 1 - st.def / (st.def + 50);
    if (!opts.env) dmg = Math.min(dmg, p.maxHp * 0.6);
    dmg = Math.max(0.5, dmg);
    if (st.thorns > 0 && src && src.hp !== undefined && !opts.ranged) Sim.hitEnemy(S, src, dmg * st.thorns, p, { noFx: true });
    p.hp -= dmg; p.flash = 0.15;
    Sim.ev(S, { t: 'dmg', x: p.x, y: p.y - 0.6, v: Math.round(dmg), c: '#ff6060' });
    Sim.ev(S, { t: 'sfx', n: 'hurt', x: p.x, y: p.y });
    Sim.ev(S, { t: 'shake', v: Math.min(6, dmg / 6), id: p.id });
    if (p.hp <= 0) {
      if ((p.pw.secondwind || 0) > 0 && p.swCd <= 0) { p.hp = 1; p.swCd = 60; Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 1, s: 'SECOND WIND', c: '#ffe0a0' }); return; }
      if ((p.pw.phoenix || 0) > 0 && !p.phoenixUsed) { p.phoenixUsed = true; p.hp = p.maxHp * 0.6; Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 1, s: 'REBORN', c: '#ff9030' }); Sim.ev(S, { t: 'sfx', n: 'revive', x: p.x, y: p.y }); return; }
      p.hp = 0; p.downed = true; p.bleed = 30; p.revive = 0; p.blocking = false; p.swing = null;
      const others = Object.values(S.players).filter(q => q !== p && !q.dead && !q.downed);
      Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' is down!' + (others.length ? ' Revive them (hold E)!' : '') });
      Sim.ev(S, { t: 'sfx', n: 'down', x: p.x, y: p.y });
      if (!others.length) Sim.killPlayer(S, p);
    }
  };
  Sim.killPlayer = function (S, p) {
    p.dead = true; p.downed = false; p.hp = 0; S.stats.deaths++;
    Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' died.' });
    if (Object.values(S.players).every(q => q.dead)) { S.phase = 'lost'; Sim.ev(S, { t: 'end', win: false }); }
  };

  Sim.hitEnemy = function (S, e, dmg, by, opts) {
    opts = opts || {};
    if (e.dead || e.hidden) return;
    let crit = false;
    const st = by ? Sim.stats(by) : null;
    if (st && !opts.noCrit) { if (Math.random() < st.crit) { crit = true; dmg *= 2; } }
    const d = G.ENEMIES[e.t];
    if (e.ai === 'skeleton' && !e.stun && by && by.x !== undefined && Math.abs(G.angDiff(e.face, G.angleTo(e.x, e.y, by.x, by.y))) < 1.2 && !opts.aoe) { dmg *= 0.3; Sim.ev(S, { t: 'txt', x: e.x, y: e.y - 0.8, s: 'blocked', c: '#c0c0c0' }); }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.12;
    if (!opts.noFx) {
      Sim.ev(S, { t: 'dmg', x: e.x, y: e.y - e.r - 0.3, v: dmg, c: crit ? '#ffe040' : '#ffffff', crit });
      Sim.ev(S, { t: 'hit', x: e.x, y: e.y, c: d.col, n: crit ? 10 : 5 });
      Sim.ev(S, { t: 'sfx', n: crit ? 'crit' : 'hit', x: e.x, y: e.y });
    }
    if (by && by.x !== undefined && opts.kb) { const a = G.angleTo(by.x, by.y, e.x, e.y); const k = opts.kb * (d.boss ? 0.15 : 1) / (e.r + 0.4); e.kbx += Math.cos(a) * k; e.kby += Math.sin(a) * k; }
    if (st) {
      if (st.lifesteal > 0) by.hp = Math.min(by.maxHp, by.hp + dmg * st.lifesteal);
      if (st.frost) e.slow = Math.max(e.slow, 2);
      if (!opts.aoe && st.blast > 0 && Math.random() < st.blast) {
        Sim.ev(S, { t: 'boom', x: e.x, y: e.y, r: 1.6 }); Sim.ev(S, { t: 'sfx', n: 'boom', x: e.x, y: e.y });
        for (const o of S.enemies) if (o !== e && !o.dead && G.dist(o.x, o.y, e.x, e.y) < 1.6 + o.r) Sim.hitEnemy(S, o, dmg * 0.6, by, { aoe: true, noCrit: true });
      }
      if (!opts.aoe && st.chain > 0 && Math.random() < st.chain) {
        let n = 0;
        for (const o of S.enemies) { if (n >= 3) break; if (o !== e && !o.dead && G.dist(o.x, o.y, e.x, e.y) < 5) { n++; Sim.ev(S, { t: 'zap', x1: e.x, y1: e.y, x2: o.x, y2: o.y }); Sim.hitEnemy(S, o, dmg * 0.5, by, { aoe: true, noCrit: true }); } }
      }
    }
    if (opts.burn) e.burn = 3;
    if (e.hp <= 0) Sim.killEnemy(S, e, by);
  };

  Sim.killEnemy = function (S, e, by) {
    if (e.dead) return;
    e.dead = true; S.stats.kills++;
    const d = G.ENEMIES[e.t];
    Sim.ev(S, { t: 'die', x: e.x, y: e.y, c: d.col, r: e.r });
    Sim.ev(S, { t: 'sfx', n: d.boss ? 'bossdie' : 'die', x: e.x, y: e.y });
    if (by && by.kills !== undefined) by.kills++;
    if (d.coins > 0) {
      const mul = by && by.pw ? Sim.stats(by).coinMul : 1;
      const n = Math.max(1, Math.round(d.coins * (0.7 + Math.random() * 0.6) * mul * (1 + S.day * 0.08)));
      Sim.spawnDrop(S, 'coin', n, e.x, e.y);
    }
    Sim.dropLoot(S, d.drops, e.x, e.y, 1);
    if (d.splits) for (let k = 0; k < 2; k++) S.enemies.push(Sim.makeEnemy(S, 'slime_small', e.x + (Math.random() - .5), e.y + (Math.random() - .5)));
    if (d.boss) {
      S.bosses[e.t] = 'dead';
      Sim.ev(S, { t: 'chat', sys: true, msg: d.name + ' has been slain!' });
      if (e.t === 'leviathan') { S.phase = 'won'; Sim.ev(S, { t: 'end', win: true }); }
      else { Sim.spawnDrop(S, 'coin', 40, e.x, e.y); const cx = Math.floor(e.x), cy = Math.floor(e.y); const i = G.idx(cx, cy); if (!S.world.objs.has(i) && S.world.tiles[i] > T.SAND) G.setObj(S.world, i, { t: 'chest_r', hp: 9999, free: true }); }
    }
  };

  Sim.makeEnemy = function (S, type, x, y, lvl) {
    const d = G.ENEMIES[type];
    const diff = lvl || Sim.difficulty(S);
    return { id: G.uid(), t: type, x, y, hp: Math.round(d.hp * diff), maxHp: Math.round(d.hp * diff), r: d.r, ai: d.ai, st: 'idle', tm: 0, tgt: null, face: 0, flash: 0, slow: 0, stun: 0, kbx: 0, kby: 0, dmg: d.dmg * (0.75 + 0.25 * diff), spd: d.spd, atkCd: 0, dead: false, burn: 0, wx: 0, wy: 0, boss: !!d.boss, ph: 0, cd: {}, owner: null, hidden: false, dmgTo: null };
  };
  Sim.difficulty = (S) => 1 + 0.35 * (S.day - 1) + 0.02 * (S.elapsed / 60);
  Sim.isNight = (S) => S.time >= G.NIGHT_AT;
  Sim.darkness = function (S) {
    const t = S.time;
    if (t < G.DUSK_AT) return t < 20 ? (1 - t / 20) * 0.9 : 0;
    if (t < G.NIGHT_AT) return (t - G.DUSK_AT) / (G.NIGHT_AT - G.DUSK_AT) * 0.9;
    return 0.9;
  };

  // ---------------- lights & claims ----------------
  Sim.rebuildLights = function (S) {
    const L = [];
    for (const [i, o] of S.world.objs) { const d = O[o.t]; if (d.light) L.push({ x: (i % G.WORLD) + .5, y: Math.floor(i / G.WORLD) + .5, r: d.light, claim: d.claim || 0 }); }
    S.lights = L;
  };
  Sim.lightAt = function (S, x, y) {
    let l = 0;
    for (const s of S.lights) { const d = G.dist(x, y, s.x, s.y); if (d < s.r) l = Math.max(l, 1 - d / s.r); }
    for (const id in S.players) { const p = S.players[id]; const it = Sim.heldItem(p); if (it && it.id === 'torch_hand' && !p.dead) { const d = G.dist(x, y, p.x, p.y); if (d < 3.5) l = Math.max(l, 1 - d / 3.5); } }
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if (G.tileAt(S.world, tx + ox, ty + oy) === T.LAVA) l = Math.max(l, 0.6);
    return l;
  };
  Sim.claimed = function (S, x, y) {
    for (const s of S.lights) if (s.claim && G.dist(x, y, s.x, s.y) < s.claim) return true;
    return false;
  };

  // ---------------- actions ----------------
  Sim.action = function (S, id, a) {
    const p = S.players[id]; if (!p) return;
    if (a.a === 'chat') { Sim.ev(S, { t: 'chat', from: p.name, col: p.col, msg: String(a.msg).slice(0, 120) }); return; }
    if (a.a === 'ping') { Sim.ev(S, { t: 'ping', x: a.x, y: a.y, col: p.col, name: p.name }); return; }
    if (p.dead || p.downed) return;
    switch (a.a) {
      case 'held': if (a.slot >= 0 && a.slot < HOTBAR) { p.held = a.slot; p.draw = 0; } break;
      case 'move': { const f = a.from | 0, t = a.to | 0; if (f >= 0 && f < INV && t >= 0 && t < INV && f !== t) { const A = p.inv[f], B = p.inv[t]; if (A && B && A.id === B.id && G.STACK(A.id) > 1) { const mv = Math.min(G.STACK(A.id) - B.n, A.n); B.n += mv; A.n -= mv; if (A.n <= 0) p.inv[f] = null; } else { p.inv[f] = B; p.inv[t] = A; } } break; }
      case 'drop': { const s = p.inv[a.slot | 0]; if (s) { Sim.spawnDrop(S, s.id, s.n, p.x + Math.cos(p.face), p.y + Math.sin(p.face)); p.inv[a.slot | 0] = null; } break; }
      case 'eat': Sim.eat(S, p, a.slot | 0); break;
      case 'equip': Sim.equip(S, p, a.slot | 0); break;
      case 'unequip': { const it = p.armor[a.slot]; if (it && Sim.give(p, it, 1) === 0) p.armor[a.slot] = null; break; }
      case 'craft': Sim.craft(S, p, a.r | 0); break;
      case 'build': Sim.build(S, p, a.item, a.tx | 0, a.ty | 0); break;
      case 'interact': Sim.interact(S, p); break;
      case 'dodge': Sim.dodge(S, p); break;
      case 'sail': if (S.boat.done && S.phase === 'run') Sim.startSiege(S); break;
    }
  };
  Sim.eat = function (S, p, slot) {
    const s = p.inv[slot]; if (!s || I[s.id].type !== 'food') return;
    const f = I[s.id], st = Sim.stats(p);
    p.hunger = Math.min(100, p.hunger + f.hunger * st.foodMul); p.hp = Math.min(p.maxHp, p.hp + f.hp * st.foodMul);
    if (f.buff) { p.buffs = p.buffs.filter(b => b.id !== s.id); p.buffs.push({ id: s.id, hp: (f.buff.hp || 0) * st.foodMul, stam: (f.buff.stam || 0) * st.foodMul, t: f.buff.dur }); }
    s.n--; if (s.n <= 0) p.inv[slot] = null;
    Sim.ev(S, { t: 'sfx', n: 'eat', x: p.x, y: p.y }); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: '+' + f.hunger + ' food', c: '#ffd080' });
  };
  Sim.equip = function (S, p, slot) {
    const s = p.inv[slot]; if (!s) return; const d = I[s.id];
    if (d.type === 'armor') { const cur = p.armor[d.slot]; p.armor[d.slot] = s.id; p.inv[slot] = cur ? { id: cur, n: 1 } : null; Sim.ev(S, { t: 'sfx', n: 'equip', x: p.x, y: p.y }); }
    else if (d.type === 'food') Sim.eat(S, p, slot);
    else if (slot >= HOTBAR) { const t = p.held; const A = p.inv[slot]; p.inv[slot] = p.inv[t]; p.inv[t] = A; }
  };
  Sim.craft = function (S, p, ri) {
    const r = G.RECIPES[ri]; if (!r || !Sim.canCraft(S, p, r)) return;
    for (const k in r.needs) Sim.take(p, k, r.needs[k]);
    const left = Sim.give(p, r.out, r.n); if (left > 0) Sim.spawnDrop(S, r.out, left, p.x, p.y);
    Sim.ev(S, { t: 'sfx', n: 'craft', x: p.x, y: p.y }); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: '+' + I[r.out].name, c: '#c0ffc0' });
  };
  Sim.build = function (S, p, item, tx, ty) {
    const d = I[item]; if (!d || d.type !== 'place' || Sim.count(p, item) < 1) return;
    const w = S.world;
    if (!G.inWorld(tx, ty) || G.dist(p.x, p.y, tx + .5, ty + .5) > 5.5) return;
    const i = G.idx(tx, ty), t = w.tiles[i]; const od = O[d.obj];
    if (w.objs.has(i)) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'occupied', c: '#ff8080', to: p.id });
    if (od.floor) { if (t !== T.WATER && t !== T.DEEP) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'floors go on water', c: '#ff8080', to: p.id }); }
    else if (t <= T.WATER || t === T.LAVA) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: "can't build here", c: '#ff8080', to: p.id });
    if (od.solid) {
      for (const id in S.players) { const q = S.players[id]; if (Math.floor(q.x) === tx && Math.floor(q.y) === ty) return; }
      for (const e of S.enemies) if (!e.dead && Math.floor(e.x) === tx && Math.floor(e.y) === ty) return;
    }
    const free = ['workbench', 'campfire', 'torch'];
    if (!free.includes(d.obj) && !Sim.nearStation(S, p, 'workbench', 8)) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'needs a workbench nearby', c: '#ff8080', to: p.id });
    Sim.take(p, item, 1);
    const o = { t: d.obj, hp: od.hp }; if (od.door) o.closed = true;
    if (od.floor) { G.setObj(w, i, o); w.tiles[i] = T.WATER; Sim.ev(S, { t: 'tile', i, v: T.WATER }); } else G.setObj(w, i, o);
    if (od.light) Sim.rebuildLights(S);
    Sim.ev(S, { t: 'sfx', n: 'build', x: tx + .5, y: ty + .5 });
  };
  Sim.interact = function (S, p) {
    const w = S.world;
    // nearest interactable object within 2 tiles of aim/player
    let best = null, bd = 2.2;
    for (let y = Math.floor(p.y - 2); y <= p.y + 2; y++) for (let x = Math.floor(p.x - 2); x <= p.x + 2; x++) {
      const o = w.objs.get(G.idx(x, y)); if (!o) continue; const d = O[o.t];
      if (!(d.isChest || d.altar || d.boat || d.door)) continue;
      const dd = G.dist(p.x, p.y, x + .5, y + .5); if (dd < bd) { bd = dd; best = { o, d, x, y, i: G.idx(x, y) }; }
    }
    if (!best) return;
    const { o, d, x, y, i } = best;
    if (d.door) { o.closed = !o.closed; G.setObj(w, i, o); Sim.ev(S, { t: 'sfx', n: 'door', x: x + .5, y: y + .5 }); return; }
    if (d.isChest) {
      const cost = o.free ? 0 : Math.round(d.cost * (1 + (S.day - 1) * 0.25) * Sim.stats(p).chestDisc);
      if (p.coins < cost) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'need ' + cost + ' coins', c: '#ffd24a', to: p.id });
      p.coins -= cost; G.setObj(w, i, null); S.stats.chests++;
      Sim.ev(S, { t: 'sfx', n: 'chest', x: x + .5, y: y + .5 }); Sim.ev(S, { t: 'boom', x: x + .5, y: y + .5, r: 0.8, c: G.RARITY_COL[d.chest] });
      for (const id in S.players) { const q = S.players[id]; if (!q.dead && G.dist(q.x, q.y, x + .5, y + .5) < 6) Sim.givePowerup(S, q, d.chest); }
      return;
    }
    if (d.altar) {
      if (S.bosses[d.altar]) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: S.bosses[d.altar] === 'dead' ? 'the altar is silent' : 'the boss is already here!', c: '#c0c0ff', to: p.id });
      if (Sim.count(p, d.key) < 1) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'needs ' + I[d.key].name, c: '#c0c0ff', to: p.id });
      Sim.take(p, d.key, 1);
      const a = Math.random() * Math.PI * 2; const e = Sim.makeEnemy(S, d.altar, x + .5 + Math.cos(a) * 3, y + .5 + Math.sin(a) * 3, Sim.difficulty(S) * 0.9);
      S.enemies.push(e); S.bosses[d.altar] = 'alive';
      Sim.ev(S, { t: 'chat', sys: true, msg: G.ENEMIES[d.altar].name + ' awakens!' }); Sim.ev(S, { t: 'sfx', n: 'roar', x: e.x, y: e.y }); Sim.ev(S, { t: 'shake', v: 8 });
      return;
    }
    if (d.boat) {
      if (S.boat.done) { Sim.ev(S, { t: 'sail', to: p.id }); return; }
      let any = false;
      for (const k in G.BOAT_NEED) { const need = G.BOAT_NEED[k] - S.boat[k]; if (need > 0) { const have = Math.min(need, Sim.count(p, k)); if (have > 0) { Sim.take(p, k, have); S.boat[k] += have; any = true; } } }
      if (Object.keys(G.BOAT_NEED).every(k => S.boat[k] >= G.BOAT_NEED[k])) { S.boat.done = true; Sim.ev(S, { t: 'chat', sys: true, msg: 'The ship is repaired! Interact with it to set sail... and brace yourselves.' }); }
      Sim.ev(S, { t: 'sfx', n: any ? 'build' : 'no', x: p.x, y: p.y });
      if (!any) Sim.ev(S, { t: 'boatinfo', to: p.id });
    }
  };
  Sim.givePowerup = function (S, p, rarity) {
    let r = rarity; if (Math.random() < 0.15 && r < 3) r++;
    const pool = G.POWERUPS.filter(x => x.rarity === r);
    const pw = pool[Math.floor(Math.random() * pool.length)];
    p.pw[pw.id] = (p.pw[pw.id] || 0) + 1;
    Sim.ev(S, { t: 'pw', id: pw.id, to: p.id, x: p.x, y: p.y });
  };
  Sim.dodge = function (S, p) {
    if (p.dodgeT > 0 || p.dodgeCh < 1 || p.stam < 15) return;
    p.stam -= 15; p.dodgeCh--; p.dodgeT = 0.28;
    let dx = p.in.ax, dy = p.in.ay; if (!dx && !dy) { dx = Math.cos(p.face); dy = Math.sin(p.face); }
    const l = Math.hypot(dx, dy) || 1; p.dodgeDx = dx / l; p.dodgeDy = dy / l; p.swing = null; p.draw = 0;
    Sim.ev(S, { t: 'sfx', n: 'dodge', x: p.x, y: p.y }); Sim.ev(S, { t: 'dust', x: p.x, y: p.y });
    if (p.pw.timeshard) for (const e of S.enemies) if (!e.dead && G.dist(e.x, e.y, p.x, p.y) < 3.5) e.stun = Math.max(e.stun, 1);
  };
  Sim.startSiege = function (S) {
    S.phase = 'siege'; S.siegeT = 90; S.waveT = 0;
    Sim.ev(S, { t: 'chat', sys: true, msg: 'Something stirs beneath the waves. HOLD THE DOCK for 90 seconds!' });
    Sim.ev(S, { t: 'sfx', n: 'roar', x: S.world.boat.x, y: S.world.boat.y }); Sim.ev(S, { t: 'shake', v: 10 });
  };

  // ---------------- per-tick player update ----------------
  function updatePlayer(S, p, dt) {
    const w = S.world, st = Sim.stats(p);
    p.maxHp = st.maxHp; if (p.hp > p.maxHp) p.hp = p.maxHp;
    if (p.flash > 0) p.flash -= dt;
    if (p.swCd > 0) p.swCd -= dt;
    for (let i = p.buffs.length - 1; i >= 0; i--) { p.buffs[i].t -= dt; if (p.buffs[i].t <= 0) p.buffs.splice(i, 1); }
    if (p.dead) return;
    if (p.downed) {
      p.bleed -= dt;
      // teammates reviving?
      let reviving = false;
      for (const id in S.players) { const q = S.players[id]; if (q !== p && !q.dead && !q.downed && q.in.interact && G.dist(q.x, q.y, p.x, p.y) < 1.6) reviving = true; }
      if (reviving) { p.revive += dt; if (p.revive >= 3) { p.downed = false; p.hp = p.maxHp * 0.4; p.revive = 0; Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' was revived!' }); Sim.ev(S, { t: 'sfx', n: 'revive', x: p.x, y: p.y }); } }
      else p.revive = Math.max(0, p.revive - dt * 0.5);
      if (p.bleed <= 0) Sim.killPlayer(S, p);
      return;
    }
    // hunger, regen, environment
    p.hunger = Math.max(0, p.hunger - dt * 0.25);
    if (p.hunger <= 0) p.hp -= dt * 1.0;
    else if (p.hunger > 30) p.hp = Math.min(p.maxHp, p.hp + dt * (0.6 + st.regen + (Sim.nearStation(S, p, 'campfire', 3) ? 2.5 : 0)));
    else p.hp = Math.min(p.maxHp, p.hp + dt * st.regen);
    const tile = G.tileAt(w, p.x, p.y);
    if (tile === T.LAVA) { p.burn = 2; }
    if (p.burn > 0) { p.burn -= dt; p.hp -= dt * 8; if (Math.random() < dt * 6) Sim.ev(S, { t: 'fire', x: p.x, y: p.y }); }
    if (Sim.darkness(S) >= 0.85 && Sim.lightAt(S, p.x, p.y) <= 0) { p.dark += dt; if (p.dark > 4) p.hp -= dt * 1.0; } else p.dark = 0;
    if (p.hp <= 0) { p.hp = 0.01; Sim.damagePlayer(S, p, 1, null, { env: true }); if (p.downed || p.dead) return; }
    // movement
    let ax = p.in.ax, ay = p.in.ay; const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    p.moving = l > 0.1;
    let spd = st.speed * G.tileSpeed(w, p.x, p.y);
    const sprinting = p.in.sprint && p.moving && p.stam > 0 && !p.blocking && p.draw <= 0;
    if (sprinting) { spd *= 1.5; p.stam -= st.sprintCost * dt; }
    else p.stam = Math.min(100, p.stam + st.stamRegen * dt * (p.swing ? 0.3 : 1));
    if (p.blocking) spd *= 0.5; if (p.draw > 0) spd *= 0.6; if (p.swing) spd *= 0.75;
    if (p.dodgeT > 0) { p.dodgeT -= dt; G.moveCircle(w, p, p.dodgeDx * 11 * dt, p.dodgeDy * 11 * dt, 0.3, false); }
    else if (p.moving) G.moveCircle(w, p, ax * spd * dt, ay * spd * dt, 0.3, false);
    if (p.dodgeCh < st.dodges) { p.dodgeCd += dt; if (p.dodgeCd >= 1.6) { p.dodgeCd = 0; p.dodgeCh++; } } else p.dodgeCd = 0;
    if (p.moving) p.anim += dt * (sprinting ? 12 : 8);
    p.face = G.angleTo(p.x, p.y, p.in.aimx, p.in.aimy);
    // spikes / puddles hurt players? spikes don't; puddles do
    for (const pu of S.puddles) if (G.dist(pu.x, pu.y, p.x, p.y) < pu.r) p.burn = Math.max(p.burn, 0.6);
    // held item logic
    const it = Sim.heldItem(p); const d = it ? I[it.id] : null;
    const wasBlocking = p.blocking; p.blocking = false;
    if (d && d.type === 'shield' && p.in.sec) { p.blocking = true; p.blockT = wasBlocking ? p.blockT + dt : 0; }
    if (d && d.type === 'bow') {
      if (p.in.sec && Sim.count(p, 'arrow') > 0) p.draw = Math.min(1.5, p.draw + dt);
      else if (p.draw > 0.15) { Sim.fireArrow(S, p, d); p.draw = 0; }
      else p.draw = 0;
    } else p.draw = 0;
    if (p.atkCd > 0) p.atkCd -= dt;
    if (p.swing) { p.swing.t += dt; if (!p.swing.hit && p.swing.t >= p.swing.dur * 0.45) { p.swing.hit = true; Sim.meleeHit(S, p); } if (p.swing.t >= p.swing.dur) p.swing = null; }
    if (p.in.attack && !p.swing && p.atkCd <= 0 && !p.blocking && p.draw <= 0 && p.dodgeT <= 0) {
      if (d && d.type === 'place') { /* placing handled by client 'build' action */ }
      else if (d && d.type === 'bow') { /* bows attack via RMB */ }
      else if (p.stam >= 4) { const wp = Sim.weapon(p); p.stam -= 4; p.swing = { t: 0, dur: 1 / wp.spd, ang: p.face, hit: false, arc: wp.arc, reach: wp.reach }; p.atkCd = 1 / wp.spd + 0.05; Sim.ev(S, { t: 'sfx', n: 'swing', x: p.x, y: p.y }); }
    }
    // pickup
    for (let i = S.drops.length - 1; i >= 0; i--) {
      const dr = S.drops[i]; const dd = G.dist(dr.x, dr.y, p.x, p.y);
      if (dd < st.pickup && dr.t > 0.3) {
        if (dd > 0.5) { const a = G.angleTo(dr.x, dr.y, p.x, p.y); dr.x += Math.cos(a) * dt * 9; dr.y += Math.sin(a) * dt * 9; continue; }
        if (dr.item === 'coin') { p.coins += dr.n; S.drops.splice(i, 1); Sim.ev(S, { t: 'sfx', n: 'coin', x: p.x, y: p.y, to: p.id }); }
        else { const left = Sim.give(p, dr.item, dr.n); if (left < dr.n) { Sim.ev(S, { t: 'sfx', n: 'pickup', x: p.x, y: p.y, to: p.id }); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.9, s: '+' + (dr.n - left) + ' ' + I[dr.item].name, c: '#e0e0e0', to: p.id, small: true }); } if (left === 0) S.drops.splice(i, 1); else dr.n = left; }
      }
    }
    // pet
    if (p.pw.wolfpack && (!p.pet || !S.enemies.find(e => e.id === p.pet && !e.dead))) { const e = Sim.makeEnemy(S, 'wolf_pet', p.x + 1, p.y, Sim.difficulty(S)); e.owner = p.id; S.enemies.push(e); p.pet = e.id; }
  }

  Sim.meleeHit = function (S, p) {
    const wp = Sim.weapon(p), st = Sim.stats(p), sw = p.swing;
    const reach = sw.reach + 0.3, half = sw.arc / 2;
    // enemies
    let hitAny = false;
    for (const e of S.enemies) {
      if (e.dead || e.hidden || e.owner) continue;
      const dd = G.dist(p.x, p.y, e.x, e.y) - e.r; if (dd > reach) continue;
      if (Math.abs(G.angDiff(sw.ang, G.angleTo(p.x, p.y, e.x, e.y))) > half + (e.r > 0.6 ? 0.5 : 0)) continue;
      Sim.hitEnemy(S, e, wp.dmg * st.atk, p, { kb: wp.kb, burn: wp.burn }); hitAny = true;
    }
    if (hitAny) Sim.ev(S, { t: 'hitstop', to: p.id });
    // world object: sample along the aim ray
    const w = S.world;
    for (let s = 0.4; s <= reach; s += 0.35) {
      const x = p.x + Math.cos(sw.ang) * s, y = p.y + Math.sin(sw.ang) * s; const i = G.idx(x, y); const o = w.objs.get(i); if (!o) continue;
      const od = O[o.t]; if (od.isChest || od.altar || od.boat) continue;
      const tool = wp.tool || 'fist', power = wp.power ? (wp.tool === 'fist' ? 0.6 : TOOL_POWER[wp.tier]) : 0.6;
      let can = false;
      if (od.built) can = true;
      else if (!od.tool) can = true;
      else if (od.tool === tool && (wp.tier || 1) >= od.tier) can = true;
      else if (tool === 'fist' && od.tier <= 1) can = true;
      if (!can) { Sim.ev(S, { t: 'txt', x: x, y: y - 0.6, s: 'need ' + (od.tool === 'axe' ? 'axe' : 'pickaxe') + ' tier ' + od.tier, c: '#ff9090', to: p.id, small: true }); Sim.ev(S, { t: 'sfx', n: 'clank', x, y }); return; }
      o.hp -= od.built ? (od.hp / 4) : power;
      Sim.ev(S, { t: 'sfx', n: od.tool === 'pick' ? 'mine' : 'chop', x, y }); Sim.ev(S, { t: 'hit', x: (i % G.WORLD) + .5, y: Math.floor(i / G.WORLD) + .5, c: od.tool === 'pick' ? '#aaa' : '#a0702e', n: 4 });
      Sim.ev(S, { t: 'wobble', i });
      if (o.hp <= 0) {
        const tx = (i % G.WORLD) + .5, ty = Math.floor(i / G.WORLD) + .5;
        if (od.built) { const itemId = Object.keys(I).find(k => I[k].type === 'place' && I[k].obj === o.t); if (itemId) Sim.spawnDrop(S, itemId, 1, tx, ty); if (od.floor) { w.tiles[i] = T.WATER; } }
        else Sim.dropLoot(S, od.drops, tx, ty, 1);
        if (od.regrow) G.setObj(w, i, { t: o.t, hp: od.hp, grow: od.regrow, stub: true }); else G.setObj(w, i, null);
        if (od.light) Sim.rebuildLights(S);
        Sim.ev(S, { t: 'sfx', n: 'break', x: tx, y: ty }); Sim.ev(S, { t: 'hit', x: tx, y: ty, c: od.tool === 'pick' ? '#aaa' : '#5c9a45', n: 10 });
      } else G.setObj(w, i, o);
      return;
    }
  };

  Sim.fireArrow = function (S, p, bow) {
    if (!Sim.take(p, 'arrow', 1)) return;
    const st = Sim.stats(p), pow = Math.min(1, p.draw / bow.draw);
    const spd = 10 + 12 * pow, dmg = bow.dmg * (0.4 + 0.6 * pow) * st.atk;
    S.projs.push({ id: G.uid(), x: p.x, y: p.y, vx: Math.cos(p.face) * spd, vy: Math.sin(p.face) * spd, dmg, owner: p.id, type: 'arrow', life: 1.6, r: 0.15, pierce: pow >= 1 ? 1 : 0 });
    Sim.ev(S, { t: 'sfx', n: 'bow', x: p.x, y: p.y });
  };

  // ---------------- projectiles, drops, puddles ----------------
  function updateProjectiles(S, dt) {
    const w = S.world;
    for (let i = S.projs.length - 1; i >= 0; i--) {
      const pr = S.projs[i]; pr.life -= dt;
      let dead = pr.life <= 0;
      // sub-step fast projectiles so they can't tunnel through small targets
      const speed = Math.hypot(pr.vx, pr.vy), sub = Math.max(1, Math.ceil(speed * dt / 0.25)), sdt = dt / sub;
      for (let s = 0; s < sub && !dead; s++) {
        pr.x += pr.vx * sdt; pr.y += pr.vy * sdt;
        const o = w.objs.get(G.idx(pr.x, pr.y));
        if (!G.inWorld(pr.x, pr.y) || (o && O[o.t].solid && !O[o.t].tall && !O[o.t].floor)) { dead = true; if (o && O[o.t].built && pr.type !== 'arrow') { o.hp -= pr.dmg * 0.5; if (o.hp <= 0) G.setObj(w, G.idx(pr.x, pr.y), null); else G.setObj(w, G.idx(pr.x, pr.y), o); } break; }
        if (pr.type === 'arrow') {
          for (const e of S.enemies) { if (e.dead || e.hidden || e.owner || (pr.hitIds && pr.hitIds.includes(e.id))) continue; if (G.dist(e.x, e.y, pr.x, pr.y) < e.r + pr.r) { Sim.hitEnemy(S, e, pr.dmg, S.players[pr.owner], { kb: 3 }); (pr.hitIds || (pr.hitIds = [])).push(e.id); if (pr.pierce > 0) pr.pierce--; else dead = true; break; } }
        } else {
          for (const id in S.players) { const p = S.players[id]; if (p.dead || p.downed) continue; if (G.dist(p.x, p.y, pr.x, pr.y) < 0.35 + pr.r) { Sim.damagePlayer(S, p, pr.dmg, pr.src, { ranged: true }); dead = true; break; } }
          if (pr.type === 'glob' && dead) S.puddles.push({ x: pr.x, y: pr.y, r: 0.9, t: 5 });
        }
      }
      if (dead) { if (pr.type === 'glob' && pr.life <= 0) S.puddles.push({ x: pr.x, y: pr.y, r: 0.9, t: 5 }); if (pr.type === 'rock') { Sim.ev(S, { t: 'boom', x: pr.x, y: pr.y, r: 1.2 }); for (const id in S.players) { const p = S.players[id]; if (!p.dead && G.dist(p.x, p.y, pr.x, pr.y) < 1.4) Sim.damagePlayer(S, p, pr.dmg * 0.7, pr.src); } } S.projs.splice(i, 1); }
    }
    for (let i = S.drops.length - 1; i >= 0; i--) { const d = S.drops[i]; d.t += dt; if (d.t < 0.5) { G.moveCircle(w, d, d.vx * dt, d.vy * dt, 0.1, false); d.vx *= 0.9; d.vy *= 0.9; } if (d.t > 300) S.drops.splice(i, 1); }
    for (let i = S.puddles.length - 1; i >= 0; i--) { S.puddles[i].t -= dt; if (S.puddles[i].t <= 0) S.puddles.splice(i, 1); }
  }

  // ---------------- world regrowth ----------------
  function updateWorld(S, dt) {
    S.lightT -= dt; if (S.lightT <= 0) { S.lightT = 1; Sim.rebuildLights(S); }
    S.regrowT = (S.regrowT || 0) + dt;
    if (S.regrowT > 2) {
      S.regrowT = 0;
      for (const [i, o] of S.world.objs) if (o.stub) { o.grow -= 2; if (o.grow <= 0) { G.setObj(S.world, i, { t: o.t, hp: O[o.t].hp }); } }
    }
  }

  // ---------------- main step ----------------
  Sim.step = function (S, dt) {
    if (S.phase === 'won' || S.phase === 'lost') return;
    S.elapsed += dt;
    // time of day (sundial shortens night)
    let tdt = dt;
    if (Sim.isNight(S)) { let n = 0; for (const id in S.players) n = Math.max(n, S.players[id].pw.sundial || 0); tdt = dt / (1 - Math.min(0.5, 0.12 * n)); }
    if (S.phase === 'run') { S.time += tdt; if (S.time >= G.DAY_LEN) { S.time -= G.DAY_LEN; S.day++; S.waves = {}; Sim.ev(S, { t: 'chat', sys: true, msg: 'Day ' + S.day + ' dawns.' }); for (const id in S.players) { const p = S.players[id]; if (p.dead) { p.dead = false; p.downed = false; p.hp = p.maxHp * 0.5; p.hunger = 60; p.x = S.world.spawn.x; p.y = S.world.spawn.y; p.inv = new Array(INV).fill(null); Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' washed back ashore.' }); } } } }
    else if (S.phase === 'siege') { S.time = Math.min(S.time + tdt, G.DAY_LEN - 1); S.siegeT -= dt; if (S.siegeT <= 0) { S.phase = 'final'; G.Enemies.spawnLeviathan(S); } }
    for (const id in S.players) updatePlayer(S, S.players[id], dt);
    G.Enemies.update(S, dt);
    updateProjectiles(S, dt);
    updateWorld(S, dt);
  };

  // ---------------- snapshot (host -> client) ----------------
  Sim.snapshot = function (S, full) {
    const w = S.world;
    const players = {};
    for (const id in S.players) {
      const p = S.players[id];
      players[id] = { id: p.id, name: p.name, col: p.col, x: +p.x.toFixed(2), y: +p.y.toFixed(2), face: +p.face.toFixed(2), hp: Math.round(p.hp * 10) / 10, maxHp: p.maxHp, stam: Math.round(p.stam), hunger: Math.round(p.hunger), inv: p.inv, held: p.held, armor: p.armor, coins: p.coins, pw: p.pw, buffs: p.buffs.map(b => ({ id: b.id, t: Math.round(b.t) })), swing: p.swing ? { t: +p.swing.t.toFixed(2), dur: p.swing.dur, ang: +p.swing.ang.toFixed(2), arc: p.swing.arc, reach: p.swing.reach } : null, dodgeT: p.dodgeT > 0 ? 1 : 0, dodgeCh: p.dodgeCh, blocking: p.blocking ? 1 : 0, draw: +p.draw.toFixed(2), downed: p.downed ? 1 : 0, bleed: Math.round(p.bleed), revive: +p.revive.toFixed(1), dead: p.dead ? 1 : 0, flash: p.flash > 0 ? 1 : 0, moving: p.moving ? 1 : 0, anim: +p.anim.toFixed(2), kills: p.kills, dark: p.dark > 2.5 ? 1 : 0, burn: p.burn > 0 ? 1 : 0, swCd: Math.round(p.swCd) };
    }
    const enemies = S.enemies.filter(e => !e.dead).map(e => [e.id, G.EN_IDX[e.t], +e.x.toFixed(2), +e.y.toFixed(2), Math.round(e.hp), e.maxHp, e.st, +e.face.toFixed(2), e.flash > 0 ? 1 : 0, e.r, e.stun > 0 ? 1 : 0, e.hidden ? 1 : 0, e.owner ? 1 : 0, e.burn > 0 ? 1 : 0, +(e.tm || 0).toFixed(2)]);
    const projs = S.projs.map(p => [p.id, p.type, +p.x.toFixed(2), +p.y.toFixed(2), +Math.atan2(p.vy, p.vx).toFixed(2)]);
    const drops = S.drops.map(d => [d.id, d.item === 'coin' ? -1 : G.ITEM_IDX[d.item], +d.x.toFixed(2), +d.y.toFixed(2), d.n]);
    const puddles = S.puddles.map(p => [+p.x.toFixed(1), +p.y.toFixed(1), p.r, +p.t.toFixed(1)]);
    const snap = { t: 'snap', time: +S.time.toFixed(2), day: S.day, phase: S.phase, siegeT: Math.ceil(S.siegeT), boat: S.boat, bosses: S.bosses, players, enemies, projs, drops, puddles, stats: S.stats, diff: +Sim.difficulty(S).toFixed(2) };
    // object changes
    if (full) { snap.objs = []; for (const [i, o] of w.changes) snap.objs.push([i, o]); snap.tiles = []; for (const [i, o] of w.changes) if (o && O[o.t].floor) snap.tiles.push([i, w.tiles[i]]); snap.full = true; }
    else if (w.pending && w.pending.length) { snap.objs = w.pending; w.pending = []; }
    return snap;
  };
  Sim.flushChanges = function (S) { // called after each step on host: move new changes to pending queue
    const w = S.world; if (!w.pending) w.pending = [];
    if (w.dirty && w.dirty.length) { for (const i of w.dirty) w.pending.push([i, w.objs.get(i) ? G.clone(w.objs.get(i)) : null]); w.dirty = []; }
  };
})(window.G);
