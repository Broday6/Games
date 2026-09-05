// DRIFTWOOD — authoritative simulation (runs on the host)
(function (G) {
  'use strict';
  const I = G.ITEMS, O = G.OBJS, T = G.T;
  const INV = 27, HOTBAR = 9;
  const FIST = { name: 'Fists', dmg: 3, spd: 2.2, reach: 1.1, arc: 1.6, kb: 2, power: 0.6, tool: 'fist', tier: 1 };
  const TOOL_POWER = [0, 1.5, 2.5, 4, 6, 9];

  const Sim = {};
  G.Sim = Sim;

  Sim.create = function (seedStr, opts) {
    const world = G.generateWorld(seedStr, opts);
    return {
      world, time: 30, day: 1, elapsed: 0, phase: 'run', players: {}, tutorial: !!(opts && opts.tutorial), tutHold: !!(opts && opts.tutorial), enemies: [], projs: [], drops: [], puddles: [],
      events: [], boat: { wood: 0, iron_bar: 0, rope: 0, emerald: 0, sapphire: 0, ruby: 0, done: false },
      siegeT: 0, bosses: {}, kills: 0, spawnT: 4, waves: {}, lights: [], lightT: 0, order: 0, stats: { kills: 0, chests: 0, deaths: 0, bosses: 0 }, nev: 'clear', nevDay: 0,
      msg: [],
    };
  };

  Sim.ev = (S, e) => S.events.push(e);

  // ---------------- players ----------------
  Sim.addPlayer = function (S, id, name, col, cls, meta, hat, skin) {
    const sp = S.world.spawn;
    const p = {
      id, name: String(name || 'Player').slice(0, 14), col: col || G.PLAYER_COLORS[Object.keys(S.players).length % 8],
      x: sp.x + (Object.keys(S.players).length % 4) * 0.8 - 1, y: sp.y, vx: 0, vy: 0, face: -Math.PI / 2,
      hp: 100, maxHp: 100, stam: 100, hunger: 100, inv: new Array(INV).fill(null), held: 0,
      armor: { head: null, chest: null, legs: null, trinket: null }, coins: 0, pw: {}, buffs: [], xp: 0, lvl: 1, offers: [], offerT: 0, slow: 0, punchN: 0, auraT: 0,
      swing: null, atkCd: 0, dodgeT: 0, dodgeCh: 1, dodgeCd: 0, dodgeDx: 0, dodgeDy: 0, draw: 0, blocking: false, blockT: 0,
      downed: false, bleed: 0, dead: false, revive: 0, flash: 0, swCd: 0, phoenixUsed: false, kills: 0, dark: 0, burn: 0,
      in: { ax: 0, ay: 0, aimx: sp.x, aimy: sp.y - 1, sprint: false, attack: false, sec: false, interact: false },
      moving: false, anim: 0, pet: null, order: S.order++, combo: 0, comboT: 0, charge: 0, cls: cls || 'castaway', meta: meta || {}, hat: G.HAT[hat] ? hat : 'none', skin: G.SKINS && G.SKINS.some(k => k.id === skin) ? skin : 'happy', sitting: false, emote: 0, bj: null, gambles: 0, rig: {},
    };
    S.players[id] = p;
    const C = G.CLASSES.find(c => c.id === p.cls); if (C) { for (const [it, n] of C.items) Sim.give(p, it, n); for (const k in C.pw) p.pw[k] = (p.pw[k] || 0) + C.pw[k]; }
    const m = (k) => Math.max(0, Math.min(9, (p.meta && p.meta[k]) | 0));
    if (m('sharp')) { Sim.give(p, 'axe_stone', 1); Sim.give(p, 'pick_stone', 1); }
    if (m('chance')) p.pw.secondwind = (p.pw.secondwind || 0) + 1;
    Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' washed ashore.' });
    return p;
  };
  Sim.removePlayer = function (S, id) { const p = S.players[id]; if (p) { Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' left.' }); delete S.players[id]; } };
  Sim.setInput = function (S, id, inp) { const p = S.players[id]; if (p) p.in = inp; };

  Sim.stats = function (p) {
    const c = k => p.pw[k] || 0, s = {}; const m = (k) => Math.max(0, Math.min(9, (p.meta && p.meta[k]) | 0));
    // armour effects (all four slots)
    const A = { def: 0, speed: 0, atk: 0, crit: 0, ls: 0, dodges: 0, regen: 0, thorns: 0, maxHp: 0, dmgTaken: 0, coinMul: 0, chain: 0, stamRegen: 0, hunger: 1, dodgeCost: 1 };
    for (const k in p.armor) if (p.armor[k]) { const d = I[p.armor[k]]; A.def += d.def || 0; const e = d.eff; if (e) { for (const f in e) { if (f === 'hunger' || f === 'dodgeCost') A[f] *= e[f]; else if (typeof e[f] === 'number') A[f] += e[f]; else A[f] = e[f]; } } }
    s.A = A;
    const wp = Sim.weapon(p);
    s.speed = 4.4 * (1 + 0.12 * c('sneakers') + A.speed + 0.04 * m('swift'));
    s.atk = (1 + 0.10 * c('whetstone') + A.atk + 0.06 * m('might')) * (1 + 0.5 * c('warlord')) * (c('glass') ? 2 : 1);
    if (p.hp < 0.4 * p.maxHp) s.atk *= 1 + 0.3 * c('berserk');
    s.def = 6 * c('ironskin') + A.def;
    let hpB = 0, stB = 0, atkB = 0;
    for (const b of p.buffs) { hpB += b.hp || 0; stB += b.stam || 0; atkB += b.atk || 0; }
    s.atk *= Math.max(0.3, 1 + atkB);
    s.maxHp = Math.max(30, Math.round((100 + 15 * c('broth') + hpB + (wp.hpMod || 0) + A.maxHp + 10 * m('vitality')) * (c('glass') ? 0.5 : 1)));
    s.crit = 0.05 + 0.10 * c('critlens') + (wp.crit || 0) + A.crit;
    s.lifesteal = 0.08 * c('vampire') + A.ls;
    s.regen = 0.5 * c('bandage') + A.regen;
    s.pickup = 1.7 + 2 * c('magnet');
    s.dodges = 1 + c('feather') + A.dodges;
    s.dodgeCost = 15 * A.dodgeCost;
    s.sprintCost = 12 * Math.pow(0.7, c('sprinter'));
    s.thorns = 0.2 * c('thorns') + A.thorns;
    s.blast = 1 - Math.pow(0.85, c('blastcap'));
    s.chain = 1 - Math.pow(0.9, c('chain')) + A.chain;
    s.frost = c('frost') > 0;
    s.coinMul = (1 + 0.25 * c('luckycoin') + A.coinMul + 0.12 * m('fortune')) * (c('midas') ? 2 : 1);
    s.chestDisc = (c('midas') ? 0.8 : 1) * (1 - 0.1 * m('sense'));
    s.foodMul = c('gluttony') ? 2 : 1;
    s.dmgTaken = 1 + 0.5 * c('warlord') + A.dmgTaken;
    s.stamRegen = (16 + stB + A.stamRegen + 30 * c('ironlungs')) * (1 + 0.15 * m('lungs'));
    s.hungerRate = 0.25 * A.hunger;
    s.xpMul = 1 + 0.2 * m('scholar');
    s.fireImmune = !!A.fireImmune; s.darkImmune = !!A.darkImmune; s.frostAura = !!A.frostAura; s.kbImmune = !!A.kbImmune; s.phoenix = !!A.phoenix || c('phoenix') > 0;
    s.boons = 3 + (m('boons') ? 1 : 0);
    return s;
  };

  Sim.heldItem = (p) => p.inv[p.held];
  const STAFF_BONK = { name: 'Staff', dmg: 6, spd: 2.0, reach: 1.6, arc: 1.6, kb: 3, anim: 'slam' };
  Sim.weapon = function (p) {
    const it = Sim.heldItem(p); if (!it) return FIST;
    const d = I[it.id];
    let base = null;
    if (d.type === 'weapon' || d.type === 'tool') base = d; else if (d.type === 'staff') base = STAFF_BONK; else return FIST;
    if (!it.aff || !it.aff.length) return base;
    const e = Object.assign({ crit: 0, ls: 0, hpMod: 0 }, base);
    for (const k of it.aff) { const a = G.AFFIX[k]; if (!a) continue; if (a.dmg) e.dmg *= a.dmg; if (a.spd) e.spd *= a.spd; if (a.reach) e.reach *= a.reach; if (a.kb) e.kb *= a.kb; if (a.crit) e.crit += a.crit; if (a.ls) e.ls += a.ls; if (a.burn) e.burn = true; if (a.frost) e.frost = true; if (a.hp) e.hpMod += a.hp; }
    return e;
  };
  // roguelike loot: roll a weapon of a rarity, with affixes
  const LOOT_TIER = { bow_wood: 1, bow_iron: 3, crossbow_iron: 3, bow_gold: 4, staff_frost: 4, staff_ember: 5, shield_wood: 1, shield_iron: 3 };
  Sim.rollWeapon = function (S, rarity, p) {
    const maxTier = Math.min(5, 1 + rarity + Math.floor((S.day - 1) / 3)), minTier = Math.max(1, maxTier - 1);
    const pool = [];
    for (const k in I) { const d = I[k]; const t = d.tier || LOOT_TIER[k]; if (!t) continue; if (d.type !== 'weapon' && d.type !== 'bow' && d.type !== 'staff' && d.type !== 'shield') continue; if (t >= minTier && t <= maxTier) pool.push(k); }
    if (!pool.length) pool.push('sword_stone');
    const id = pool[Math.floor(Math.random() * pool.length)];
    let n = rarity === 0 ? (Math.random() < 0.4 ? 1 : 0) : rarity === 1 ? 1 : rarity === 2 ? 1 + (Math.random() < 0.5 ? 1 : 0) : 2;
    const arm = p && p.meta ? (p.meta.armory | 0) : 0; if (arm && Math.random() < 0.35 * arm) n = Math.min(3, n + 1);
    const aff = []; const list = G.AFFIX_LIST.filter(a => a !== 'cursed' || rarity >= 2);
    while (aff.length < n && aff.length < list.length) { const a = list[Math.floor(Math.random() * list.length)]; if (!aff.includes(a)) aff.push(a); }
    return { id, aff, q: rarity };
  };

  // ---- inventory ----
  Sim.count = (p, id) => p.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
  Sim.give = function (p, id, n, aff, q) {
    if (aff && aff.length) { for (let i = 0; i < INV; i++) if (!p.inv[i]) { p.inv[i] = { id, n: 1, aff: aff.slice(), q: q || 0 }; return 0; } return 1; }
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
  Sim.dropWeapon = function (S, roll, x, y) { const a = Math.random() * Math.PI * 2; S.drops.push({ id: G.uid(), item: roll.id, n: 1, aff: roll.aff && roll.aff.length ? roll.aff : null, q: roll.q, x, y, vx: Math.cos(a), vy: Math.sin(a), t: 0 }); Sim.ev(S, { t: 'boom', x, y, r: 0.6, c: G.RARITY_COL[roll.q] }); };
  // ---- XP, levels, boon offers (Hades-style pick of 3) ----
  Sim.giveXp = function (S, p, n) {
    p.xp += n;
    while (p.xp >= G.XP_FOR(p.lvl)) { p.xp -= G.XP_FOR(p.lvl); p.lvl++; const r = p.lvl % 5 === 0 ? 2 : (p.lvl % 2 === 0 ? 1 : 0); Sim.offerPerks(S, p, r, 'Level ' + p.lvl); Sim.ev(S, { t: 'sfx', n: 'pw', x: p.x, y: p.y, to: p.id }); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 1, s: 'LEVEL ' + p.lvl, c: '#80ffd0', to: p.id }); }
  };
  Sim.offerPerks = function (S, p, rarity, why) {
    let r = rarity; if (Math.random() < 0.15 && r < 3) r++;
    const n = Sim.stats(p).boons; const opts = [];
    const pool = G.POWERUPS.filter(x => x.rarity === r); const pool2 = G.POWERUPS.filter(x => Math.abs(x.rarity - r) === 1);
    while (opts.length < n && (pool.length || pool2.length)) { const src = pool.length ? pool : pool2; const k = Math.floor(Math.random() * src.length); const pw = src.splice(k, 1)[0]; if (!opts.includes(pw.id)) opts.push(pw.id); }
    p.offers.push({ opts, why: why || '' }); if (p.offers.length === 1) p.offerT = 0;
  };
  Sim.pick = function (S, p, i) {
    const o = p.offers.shift(); if (!o) return; p.offerT = 0;
    const id = o.opts[Math.max(0, Math.min(o.opts.length - 1, i | 0))];
    p.pw[id] = (p.pw[id] || 0) + 1;
    Sim.ev(S, { t: 'pw', id, to: p.id, x: p.x, y: p.y });
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
        if (p.blockT < 0.18 && src && src.hp !== undefined) { src.stun = Math.max(src.stun || 0, 1.2); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'PARRY', c: '#80e0ff' }); Sim.ev(S, { t: 'sfx', n: 'parry', x: p.x, y: p.y }); if (sh.special === 'parrywave') { Sim.ev(S, { t: 'boom', x: p.x, y: p.y, r: 3.5, c: '#a0c0ff' }); for (const e of S.enemies) if (!e.dead && !e.owner && G.dist(e.x, e.y, p.x, p.y) < 3.5 + e.r) { Sim.hitEnemy(S, e, dmg * 3, p, { aoe: true, kb: 10 }); e.stun = Math.max(e.stun, 1); } } }
        dmg *= (1 - sh.block); p.stam = Math.max(0, p.stam - 15);
        Sim.ev(S, { t: 'sfx', n: 'block', x: p.x, y: p.y });
      }
    }
    dmg *= st.dmgTaken;
    if (src && src.hp !== undefined && S.nev === 'bloodmoon') dmg *= 1.3;
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
      if (st.phoenix && !p.phoenixUsed) { p.phoenixUsed = true; p.hp = p.maxHp * 0.6; Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 1, s: 'REBORN', c: '#ff9030' }); Sim.ev(S, { t: 'sfx', n: 'revive', x: p.x, y: p.y }); return; }
      p.hp = 0; p.downed = true; p.bleed = 30; p.revive = 0; p.blocking = false; p.swing = null;
      if (p.pw.lastword) { Sim.ev(S, { t: 'boom', x: p.x, y: p.y, r: 4, c: '#ff4040' }); Sim.ev(S, { t: 'sfx', n: 'boom', x: p.x, y: p.y }); Sim.ev(S, { t: 'shake', v: 8 }); for (const e of S.enemies) if (!e.dead && !e.owner && G.dist(e.x, e.y, p.x, p.y) < 4 + e.r) Sim.hitEnemy(S, e, 120 * p.pw.lastword, p, { aoe: true, kb: 8 }); }
      const others = Object.values(S.players).filter(q => q !== p && !q.dead && !q.downed);
      Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' is down!' + (others.length ? ' Revive them (hold E)!' : '') });
      Sim.ev(S, { t: 'sfx', n: 'down', x: p.x, y: p.y });
      if (!others.length) Sim.killPlayer(S, p);
    }
  };
  Sim.shards = (S, win) => { const o = {}; for (const id in S.players) { const p = S.players[id]; o[id] = Math.round(S.day * 10 + S.stats.bosses * 25 + p.kills / 4 + p.lvl * 3 + (win ? 150 : 0)); } return o; };
  Sim.killPlayer = function (S, p) {
    p.dead = true; p.downed = false; p.hp = 0; S.stats.deaths++;
    Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' died.' });
    if (Object.values(S.players).every(q => q.dead)) { S.phase = 'lost'; Sim.ev(S, { t: 'end', win: false, shards: Sim.shards(S, false) }); }
  };

  Sim.hitEnemy = function (S, e, dmg, by, opts) {
    opts = opts || {};
    if (e.dead || e.hidden) return;
    let crit = false;
    const st = by ? Sim.stats(by) : null;
    if (st && !opts.noCrit) { if (Math.random() < st.crit + (opts.crit || 0)) { crit = true; dmg *= 2; } }
    const d = G.ENEMIES[e.t];
    if ((e.ai === 'skeleton' || e.ai === 'warden') && !e.stun && by && by.x !== undefined && Math.abs(G.angDiff(e.face, G.angleTo(e.x, e.y, by.x, by.y))) < 1.2 && !opts.aoe) { dmg *= 0.3; Sim.ev(S, { t: 'txt', x: e.x, y: e.y - 0.8, s: 'blocked', c: '#c0c0c0' }); }
    if (by && by.pw && by.pw.backstab && !opts.aoe && Math.abs(G.angDiff(e.face, G.angleTo(by.x, by.y, e.x, e.y))) < 1.3) dmg *= 1 + 0.3 * by.pw.backstab;
    if (opts.execute && e.hp < e.maxHp * 0.5) dmg *= 2;
    if (opts.poison) { e.poison = Math.max(e.poison || 0, 4); e.slow = Math.max(e.slow, 4); }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.12;
    if (!opts.noFx) {
      Sim.ev(S, { t: 'dmg', x: e.x, y: e.y - e.r - 0.3, v: dmg, c: crit ? '#ffe040' : '#ffffff', crit });
      Sim.ev(S, { t: 'hit', x: e.x, y: e.y, c: d.col, n: crit ? 10 : 5 });
      Sim.ev(S, { t: 'sfx', n: crit ? 'crit' : 'hit', x: e.x, y: e.y });
    }
    if (by && by.x !== undefined && opts.kb) { const a = G.angleTo(by.x, by.y, e.x, e.y); const k = opts.kb * (d.boss ? 0.15 : 1) / (e.r + 0.4); e.kbx += Math.cos(a) * k; e.kby += Math.sin(a) * k; }
    if (st) {
      const ls = st.lifesteal + (opts.ls || 0); if (ls > 0) by.hp = Math.min(by.maxHp, by.hp + dmg * ls);
      if (st.frost || opts.frost) e.slow = Math.max(e.slow, 2);
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
    Sim.ev(S, { t: 'die', x: e.x, y: e.y, c: d.col, r: e.r, k: e.t, f: +e.face.toFixed(2), el: e.elite ? 1 : 0 });
    Sim.ev(S, { t: 'sfx', n: d.boss ? 'bossdie' : 'die', x: e.x, y: e.y });
    if (by && by.kills !== undefined) by.kills++;
    { const xp = Math.round((d.coins || 1) * 3 * (e.elite ? 2 : 1) * (d.boss ? 2 : 1)) + 2; for (const id in S.players) { const q = S.players[id]; if (q.dead) continue; Sim.giveXp(S, q, Math.round(xp * Sim.stats(q).xpMul)); } }
    if (d.coins > 0) {
      const mul = by && by.pw ? Sim.stats(by).coinMul : 1;
      const n = Math.max(1, Math.round(d.coins * (0.7 + Math.random() * 0.6) * mul * (1 + S.day * 0.08) * (S.nev === 'bloodmoon' ? 2 : 1) * (e.elite ? 3 : 1)));
      Sim.spawnDrop(S, 'coin', n, e.x, e.y);
    }
    Sim.dropLoot(S, d.drops, e.x, e.y, e.elite ? 2 : 1);
    if (e.elite && Math.random() < 0.5) Sim.dropWeapon(S, Sim.rollWeapon(S, Math.random() < 0.3 ? 2 : 1), e.x, e.y);
    if (d.splits) for (let k = 0; k < 2; k++) S.enemies.push(Sim.makeEnemy(S, 'slime_small', e.x + (Math.random() - .5), e.y + (Math.random() - .5)));
    if (d.boss) {
      S.bosses[e.t] = 'dead'; S.stats.bosses++;
      Sim.ev(S, { t: 'chat', sys: true, msg: d.name + ' has been slain!' });
      if (e.t !== 'leviathan') Sim.dropWeapon(S, Sim.rollWeapon(S, 3), e.x + 1, e.y);
      if (d.loot) Sim.dropWeapon(S, { id: d.loot, aff: [], q: 3, unique: true }, e.x - 1, e.y);
      if (d.armor) Sim.dropWeapon(S, { id: d.armor, aff: [], q: 3, unique: true }, e.x, e.y + 1);
      if (e.t === 'leviathan') { S.phase = 'won'; Sim.ev(S, { t: 'end', win: true, shards: Sim.shards(S, true) }); }
      else { Sim.spawnDrop(S, 'coin', 40, e.x, e.y); const cx = Math.floor(e.x), cy = Math.floor(e.y); const i = G.idx(cx, cy); if (!S.world.objs.has(i) && S.world.tiles[i] > T.SAND) G.setObj(S.world, i, { t: 'chest_r', hp: 9999, free: true }); }
    }
  };

  Sim.makeEnemy = function (S, type, x, y, lvl, elite) {
    const d = G.ENEMIES[type];
    const diff = (lvl || Sim.difficulty(S)) * (elite ? 2.5 : 1);
    return { id: G.uid(), t: type, x, y, hp: Math.round(d.hp * diff), maxHp: Math.round(d.hp * diff), r: d.r * (elite ? 1.25 : 1), ai: d.ai, st: 'idle', tm: 0, tgt: null, face: 0, flash: 0, slow: 0, stun: 0, kbx: 0, kby: 0, dmg: d.dmg * (0.75 + 0.25 * (lvl || Sim.difficulty(S))) * (elite ? 1.4 : 1), spd: d.spd * (elite ? 1.1 : 1), atkCd: 0, dead: false, burn: 0, wx: 0, wy: 0, boss: !!d.boss, ph: 0, cd: {}, owner: null, hidden: false, dmgTo: null, elite: !!elite };
  };
  Sim.pickNightEvent = function (S) {
    if (S.nevDay === S.day) return; S.nevDay = S.day;
    if (S.day === 1) { S.nev = 'clear'; return; }
    const tot = G.NIGHT_EVENTS.reduce((a, e) => a + e.w, 0); let r = Math.random() * tot; let ev = G.NIGHT_EVENTS[0];
    for (const e of G.NIGHT_EVENTS) { r -= e.w; if (r <= 0) { ev = e; break; } }
    S.nev = ev.id; Sim.ev(S, { t: 'nev', id: ev.id }); Sim.ev(S, { t: 'chat', sys: true, msg: 'Tonight: ' + ev.name + ' — ' + ev.desc });
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
      case 'pick': Sim.pick(S, p, a.i | 0); break;
      case 'sail': if (S.boat.done && S.phase === 'run') Sim.startSiege(S); break;
      case 'gamble': Sim.gamble(S, p, a); break;
      case 'sit': p.sitting = !!a.v; break;
      case 'sort': { const rest = p.inv.slice(HOTBAR).filter(Boolean); const merged = []; for (const s of rest) { const m = merged.find(x => x.id === s.id && !x.aff && !s.aff && x.n < G.STACK(s.id)); if (m) { const take = Math.min(G.STACK(s.id) - m.n, s.n); m.n += take; s.n -= take; if (s.n > 0) merged.push(s); } else merged.push(s); }
        const order = { weapon: 0, tool: 1, bow: 2, staff: 3, shield: 4, armor: 5, food: 6, place: 7, gem: 8, key: 9 }; merged.sort((a, b) => ((order[I[a.id].type] ?? 20) - (order[I[b.id].type] ?? 20)) || I[a.id].name.localeCompare(I[b.id].name));
        for (let k = HOTBAR; k < INV; k++) p.inv[k] = merged[k - HOTBAR] || null; break; }
      case 'emote': if (!p.swing && p.emote <= 0) { p.emote = 2.2; Sim.ev(S, { t: 'sfx', n: 'pw', x: p.x, y: p.y }); } break;
      case 'bj': Sim.blackjack(S, p, a); break;
    }
  };

  // ---------------- the Dealer's Table (gambling for coins, boons and hats) ----------------
  Sim.nearCasino = function (S, p) { for (let y = Math.floor(p.y - 3); y <= p.y + 3; y++) for (let x = Math.floor(p.x - 3); x <= p.x + 3; x++) { const o = S.world.objs.get(G.idx(x, y)); if (o && O[o.t].casino && G.dist(p.x, p.y, x + .5, y + .5) < 3.5) return true; } return false; };
  const CAS = G.CASINO;
  function hexPlayer(S, p, dur) { p.buffs = p.buffs.filter(b => b.id !== 'hex'); p.buffs.push({ id: 'hex', atk: CAS.hex.atk, t: dur || CAS.hex.dur }); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 1, s: 'HEXED', c: '#c060ff', to: p.id }); }
  function gres(S, p, r) { r.t = 'gres'; r.to = p.id; r.coins = p.coins; Sim.ev(S, r); }
  function weightedSymbol() { const tot = G.SLOT_SYMBOLS.reduce((a, s) => a + s.w, 0); let r = Math.random() * tot; for (const s of G.SLOT_SYMBOLS) { r -= s.w; if (r <= 0) return s.id; } return 'cherry'; }
  function unlockHat(S, p) { const pool = G.HATS.filter(h => h.cost > 0); const h = pool[Math.floor(Math.random() * pool.length)]; Sim.ev(S, { t: 'hat', to: p.id, id: h.id }); Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' won a ' + h.name + ' at the Dealer\'s Table!' }); }
  function bigWin(S, p, txt) { Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' ' + txt }); Sim.ev(S, { t: 'boom', x: p.x, y: p.y, r: 1.2, c: '#ffd24a' }); Sim.ev(S, { t: 'sfx', n: 'win', x: p.x, y: p.y }); }
  Sim.gamble = function (S, p, a) {
    if (!Sim.nearCasino(S, p)) return;
    const g = a.g;
    if (g === 'buy') { const r = CAS.rigs.find(x => x.id === a.item); if (!r) return; if (p.rig[r.id]) return gres(S, p, { g: 'buy', err: 'You already hold a ' + r.name + '.' }); if (p.coins < r.cost) return gres(S, p, { g: 'buy', err: 'You need ' + r.cost + ' coins for the ' + r.name + '.' }); p.coins -= r.cost; p.rig[r.id] = 1; return gres(S, p, { g: 'buy', item: r.id, msg: r.name + ' bought — it triggers on its own.' }); }
    const bets = g === 'slots' ? CAS.slotsBets : g === 'dice' ? CAS.diceBets : g === 'wheel' ? CAS.wheelBets : null; if (!bets) return;
    const bet = bets.includes(a.bet | 0) ? a.bet | 0 : bets[0];
    if (p.coins < bet) return gres(S, p, { g, err: 'You need ' + bet + ' coins for that bet.' });
    p.coins -= bet; p.gambles++; S.stats.gambles = (S.stats.gambles || 0) + 1;
    if (g === 'slots') {
      let reels = [weightedSymbol(), weightedSymbol(), weightedSymbol()]; let used = null;
      const isLoss = (r) => !(r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) || r.includes('skull');
      if (p.rig.chip && isLoss(reels)) { delete p.rig.chip; used = 'chip'; reels = [weightedSymbol(), weightedSymbol(), weightedSymbol()]; }
      const [a1, b1, c1] = reels; let win = 0, msg = '', boon = -1, hex = 0, hat = false;
      if (a1 === b1 && b1 === c1) {
        if (a1 === 'seven') { win = bet * 20; boon = 2; hat = true; msg = 'JACKPOT! Triple seven'; bigWin(S, p, 'hit the JACKPOT on the slots!'); }
        else if (a1 === 'skull') { win = 0; hex = 120; msg = 'Three skulls… the table takes its due'; }
        else { win = bet * 6; boon = a1 === 'star' ? 1 : 0; msg = 'Three of a kind!'; }
      } else if (a1 === b1 || b1 === c1 || a1 === c1) {
        const pair = a1 === b1 ? a1 : b1 === c1 ? b1 : a1;
        if (pair === 'skull') { win = 0; hex = 45; msg = 'A pair of skulls — hexed'; } else if (pair === 'seven') { win = bet * 4; msg = 'Two sevens!'; } else { win = bet * 2; msg = 'A pair — double your bet'; }
      } else msg = 'No luck. The reels mock you.';
      p.coins += win; if (hex) hexPlayer(S, p, hex); if (boon >= 0) Sim.offerPerks(S, p, boon, 'Slots'); if (hat) unlockHat(S, p);
      return gres(S, p, { g, bet, reels, win, msg: (used ? 'Lucky Chip re-spin! ' : '') + msg, boon, hex, used });
    }
    if (g === 'dice') {
      const d6 = () => 1 + Math.floor(Math.random() * 6); const mine = [d6(), d6()], dealer = [d6(), d6()]; let used = null; let bonus = 0; if (p.rig.dice) { delete p.rig.dice; used = 'dice'; bonus = 2; } const ms = mine[0] + mine[1] + bonus, ds = dealer[0] + dealer[1]; let win = 0, msg = used ? 'Loaded dice (+2)! ' : '', boon = -1, hex = 0;
      if (ms > ds) { win = bet * 2; msg += 'You out-roll the dealer'; } else if (ms === ds) { win = bet; msg += 'Push — bet returned'; } else msg += 'The dealer wins';
      if (mine[0] === 6 && mine[1] === 6) { boon = 0; msg += ' — BOXCARS! A boon is yours'; } if (mine[0] === 1 && mine[1] === 1) { hex = 60; msg += ' — snake eyes, hexed'; }
      p.coins += win; if (hex) hexPlayer(S, p, hex); if (boon >= 0) Sim.offerPerks(S, p, boon, 'Dice Duel');
      return gres(S, p, { g, bet, mine, dealer, win, msg, boon, hex, used, bonus });
    }
    if (g === 'wheel') {
      const tier = CAS.wheelBets.indexOf(bet); const odds = CAS.wheel[tier]; let r = Math.random(), seg = odds.length - 1; for (let i = 0; i < odds.length; i++) { r -= odds[i]; if (r <= 0) { seg = i; break; } }
      let win = 0, msg = CAS.wheelNames[seg], boon = -1, hex = 0, used = null;
      if (seg === 5 && p.rig.statue) { delete p.rig.statue; used = 'statue'; seg = 0; msg = 'Holy Statue saves you — common boon instead of a bust'; }
      if (seg <= 3) { boon = seg; Sim.offerPerks(S, p, seg, 'Wheel of Fates'); if (seg === 3) bigWin(S, p, 'spun a LEGENDARY boon on the Wheel of Fates!'); }
      else if (seg === 4) { win = bet * 3; } else { hex = CAS.hex.dur; hexPlayer(S, p, hex); }
      p.coins += win;
      return gres(S, p, { g, bet, seg, win, msg, boon, hex, used });
    }
  };
  // blackjack: dealer stands on 17, blackjack pays 5:2 and offers a rare boon
  const cardVal = (c) => { const r = c.slice(0, -1); return r === 'A' ? 11 : 'JQK'.includes(r) ? 10 : +r; };
  const handVal = (h) => { let v = 0, aces = 0; for (const c of h) { v += cardVal(c); if (c[0] === 'A') aces++; } while (v > 21 && aces > 0) { v -= 10; aces--; } return v; };
  function newDeck() { const d = []; for (const s of ['♠', '♥', '♦', '♣']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) d.push(r + s); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
  Sim.blackjack = function (S, p, a) {
    if (!Sim.nearCasino(S, p)) return;
    const bj = p.bj;
    if (a.op === 'deal') {
      if (bj && !bj.done) return;
      const bet = CAS.bjBets.includes(a.bet | 0) ? a.bet | 0 : CAS.bjBets[0]; if (p.coins < bet) return gres(S, p, { g: 'bj', err: 'You need ' + bet + ' coins for that bet.' });
      p.coins -= bet; p.gambles++; S.stats.gambles = (S.stats.gambles || 0) + 1;
      const deck = newDeck(); p.bj = { deck, bet, hand: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], done: false };
      if (p.rig.peek) { delete p.rig.peek; p.bj.peek = true; }
      if (handVal(p.bj.hand) === 21) return finishBj(S, p, true);
      return gres(S, p, { g: 'bj', bet, hand: p.bj.hand, dealer: p.bj.peek ? p.bj.dealer.slice() : [p.bj.dealer[0], '??'], val: handVal(p.bj.hand), msg: (p.bj.peek ? "Dealer's Peek: you see the hole card. " : '') + 'Hit or stand?' });
    }
    if (!bj || bj.done) return;
    if (a.op === 'hit') { bj.hand.push(bj.deck.pop()); if (handVal(bj.hand) > 21) return finishBj(S, p, false); if (handVal(bj.hand) === 21) return finishBj(S, p, false); return gres(S, p, { g: 'bj', bet: bj.bet, hand: bj.hand, dealer: bj.peek ? bj.dealer.slice() : [bj.dealer[0], '??'], val: handVal(bj.hand), msg: handVal(bj.hand) + ' — hit or stand?' }); }
    if (a.op === 'stand') return finishBj(S, p, false);
  };
  function finishBj(S, p, natural) {
    const bj = p.bj; bj.done = true; const pv = handVal(bj.hand); let win = 0, msg = '', boon = -1;
    if (pv > 21) msg = 'Bust! ' + pv;
    else { while (handVal(bj.dealer) < 17) bj.dealer.push(bj.deck.pop()); const dv = handVal(bj.dealer);
      if (natural) { win = Math.round(bj.bet * 2.5); boon = 1; msg = 'BLACKJACK! Pays 5:2 and a rare boon'; bigWin(S, p, 'got a natural blackjack!'); }
      else if (dv > 21) { win = bj.bet * 2; msg = 'Dealer busts with ' + dv; } else if (pv > dv) { win = bj.bet * 2; msg = pv + ' beats ' + dv; } else if (pv === dv) { win = bj.bet; msg = 'Push at ' + pv; } else msg = 'Dealer\'s ' + dv + ' beats your ' + pv; }
    p.coins += win; if (boon >= 0) Sim.offerPerks(S, p, boon, 'Blackjack');
    return gres(S, p, { g: 'bj', bet: bj.bet, hand: bj.hand, dealer: bj.dealer, val: pv, dval: handVal(bj.dealer), win, msg, boon, done: true });
  }
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
    if (S.tutHold && d.obj === 'campfire') { S.tutHold = false; Sim.ev(S, { t: 'chat', sys: true, msg: 'The fire is lit — the day begins. Dusk comes in a few minutes; gather food and stay near the light tonight.' }); }
    if (od.light) Sim.rebuildLights(S);
    Sim.ev(S, { t: 'sfx', n: 'build', x: tx + .5, y: ty + .5 });
  };
  Sim.interact = function (S, p) {
    const w = S.world;
    // nearest interactable object within 2 tiles of aim/player
    let best = null, bd = 2.2;
    for (let y = Math.floor(p.y - 2); y <= p.y + 2; y++) for (let x = Math.floor(p.x - 2); x <= p.x + 2; x++) {
      const o = w.objs.get(G.idx(x, y)); if (!o) continue; const d = O[o.t];
      if (!(d.isChest || d.altar || d.boat || d.door || d.casino)) continue;
      const dd = G.dist(p.x, p.y, x + .5, y + .5); if (dd < bd) { bd = dd; best = { o, d, x, y, i: G.idx(x, y) }; }
    }
    if (!best) return;
    const { o, d, x, y, i } = best;
    if (d.casino) { Sim.ev(S, { t: 'casino', to: p.id, x: x + .5, y: y + .5 }); Sim.ev(S, { t: 'sfx', n: 'chest', x: x + .5, y: y + .5 }); return; }
    if (d.door) { o.closed = !o.closed; G.setObj(w, i, o); Sim.ev(S, { t: 'sfx', n: 'door', x: x + .5, y: y + .5 }); return; }
    if (d.isChest) {
      const cost = o.free ? 0 : Math.round(d.cost * (1 + (S.day - 1) * 0.25) * Sim.stats(p).chestDisc * (S.nev === 'bounty' ? 0.5 : 1));
      if (p.coins < cost) return Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'need ' + cost + ' coins', c: '#ffd24a', to: p.id });
      p.coins -= cost; G.setObj(w, i, null); S.stats.chests++;
      Sim.ev(S, { t: 'sfx', n: 'chest', x: x + .5, y: y + .5 }); Sim.ev(S, { t: 'boom', x: x + .5, y: y + .5, r: 0.8, c: G.RARITY_COL[d.chest] });
      for (const id in S.players) { const q = S.players[id]; if (!q.dead && G.dist(q.x, q.y, x + .5, y + .5) < 6) Sim.offerPerks(S, q, d.chest, d.name); }
      if (d.chest === 3 || Math.random() < 0.3 + d.chest * 0.15) Sim.dropWeapon(S, Sim.rollWeapon(S, Math.min(3, d.chest + (p.pw.treasure ? 1 : 0)), p), x + .5, y + .5);
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
    const cost = Sim.stats(p).dodgeCost; if (p.dodgeT > 0 || p.dodgeCh < 1 || p.stam < cost) return;
    p.stam -= cost; p.dodgeCh--; p.dodgeT = 0.28;
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
    p.hunger = Math.max(0, p.hunger - dt * st.hungerRate);
    if (p.slow > 0) p.slow -= dt;
    if (p.offers.length) { p.offerT += dt; if (p.offerT > 25) Sim.pick(S, p, 0); }
    p.auraT -= dt; if (p.auraT <= 0) { p.auraT = 0.5; if (p.pw.fireaura || st.frostAura) for (const e of S.enemies) { if (e.dead || e.owner || G.dist(e.x, e.y, p.x, p.y) > 3) continue; if (p.pw.fireaura) { e.burn = Math.max(e.burn, 1); } if (st.frostAura) e.slow = Math.max(e.slow, 1); } }
    if (p.hunger <= 0) p.hp -= dt * 1.0;
    else if (p.hunger > 30) p.hp = Math.min(p.maxHp, p.hp + dt * (0.6 + st.regen + (Sim.nearStation(S, p, 'campfire', 3) ? 2.5 : 0)));
    else p.hp = Math.min(p.maxHp, p.hp + dt * st.regen);
    const tile = G.tileAt(w, p.x, p.y);
    if (tile === T.LAVA && !st.fireImmune) { p.burn = 2; }
    if (st.fireImmune) p.burn = 0;
    if (p.burn > 0) { p.burn -= dt; p.hp -= dt * 8; if (Math.random() < dt * 6) Sim.ev(S, { t: 'fire', x: p.x, y: p.y }); }
    if (!st.darkImmune && Sim.darkness(S) >= 0.85 && Sim.lightAt(S, p.x, p.y) <= 0) { p.dark += dt; if (p.dark > 4) p.hp -= dt * 1.0; } else p.dark = 0;
    if (p.hp <= 0) { p.hp = 0.01; Sim.damagePlayer(S, p, 1, null, { env: true }); if (p.downed || p.dead) return; }
    // movement
    let ax = p.in.ax, ay = p.in.ay; const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
    p.moving = l > 0.1;
    let spd = st.speed * G.tileSpeed(w, p.x, p.y) * (p.slow > 0 ? 0.6 : 1);
    const sprinting = p.in.sprint && p.moving && p.stam > 0 && !p.blocking && p.draw <= 0;
    if (sprinting) { spd *= 1.8; p.stam -= st.sprintCost * dt; }
    else p.stam = Math.min(100, p.stam + st.stamRegen * dt * (p.swing ? 0.3 : 1));
    if (p.blocking) spd *= 0.5; if (p.draw > 0) spd *= 0.6; if (p.swing) spd *= 0.9; if (p.charge > 0) spd *= 0.55;
    if (p.dodgeT > 0) { p.dodgeT -= dt; G.moveCircle(w, p, p.dodgeDx * 11 * dt, p.dodgeDy * 11 * dt, 0.3, false); }
    else if (p.moving) { G.moveCircle(w, p, ax * spd * dt, ay * spd * dt, 0.3, false); p.sitting = false; p.emote = 0; }
    if (p.emote > 0) p.emote -= dt;
    if (p.dodgeCh < st.dodges) { p.dodgeCd += dt; if (p.dodgeCd >= 1.6) { p.dodgeCd = 0; p.dodgeCh++; } } else p.dodgeCd = 0;
    if (p.moving) p.anim += dt * (sprinting ? 12 : 8);
    p.face = G.angleTo(p.x, p.y, p.in.aimx, p.in.aimy);
    // spikes / puddles hurt players? spikes don't; puddles do
    if (!st.fireImmune) for (const pu of S.puddles) if (!pu.friendly && G.dist(pu.x, pu.y, p.x, p.y) < pu.r) p.burn = Math.max(p.burn, 0.6);
    // held item logic
    const it = Sim.heldItem(p); const d = it ? I[it.id] : null;
    const wasBlocking = p.blocking; p.blocking = false;
    if (d && d.type === 'shield' && p.in.sec) { p.blocking = true; p.blockT = wasBlocking ? p.blockT + dt : 0; }
    if (d && d.type === 'bow') {
      if (p.in.sec && Sim.count(p, 'arrow') > 0) p.draw = Math.min(1.5, p.draw + dt);
      else if (p.draw > 0.15) { Sim.fireArrow(S, p, d); p.draw = 0; }
      else p.draw = 0;
    } else if (d && d.type === 'staff') {
      if (p.in.sec && p.stam >= d.cost) p.draw = Math.min(1.2, p.draw + dt);
      else if (p.draw >= d.draw * 0.5) { Sim.castStaff(S, p, d); p.draw = 0; }
      else p.draw = 0;
    } else p.draw = 0;
    if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
    // heavy attack: hold RMB with a melee weapon/tool, release to unleash
    const meleeHeld = !d || d.type === 'weapon' || d.type === 'tool';
    if (meleeHeld && p.in.sec && !p.swing && p.dodgeT <= 0) p.charge = Math.min(1, p.charge + dt * 1.4 * (st.kbImmune ? 2 : 1));
    else if (p.charge > 0) {
      if (p.charge >= 0.25 && p.stam >= 10 && !p.swing) { const wp = Sim.weapon(p); p.stam -= 10; const pow = p.charge; p.swing = { t: 0, dur: 1 / wp.spd * 1.15, ang: p.face, hit: false, arc: wp.arc * 1.2, reach: wp.reach + 0.25, heavy: true, pow, combo: 3, anim: 'slam' }; p.atkCd = 1 / wp.spd * 1.15 + 0.15; Sim.ev(S, { t: 'sfx', n: 'swing', x: p.x, y: p.y }); }
      p.charge = 0;
    }
    if (p.atkCd > 0) p.atkCd -= dt;
    if (p.swing) { p.swing.t += dt; if (!p.swing.hit && p.swing.t >= p.swing.dur * 0.3) { p.swing.hit = true; Sim.meleeHit(S, p); } if (p.swing.t >= p.swing.dur) p.swing = null; }
    if (p.in.attack && !p.swing && p.atkCd <= 0 && !p.blocking && p.draw <= 0 && p.dodgeT <= 0 && p.charge <= 0) {
      if (d && d.type === 'place') { /* placing handled by client 'build' action */ }
      else if (d && d.type === 'bow') { /* bows attack via RMB */ }
      else if (p.stam >= 4) { const wp = Sim.weapon(p); p.stam -= 4; if (p.comboT > 0) p.combo = (p.combo + 1) % 3; else p.combo = 0; p.comboT = 1.2; p.swing = { t: 0, dur: 1 / wp.spd, ang: p.face, hit: false, arc: wp.arc, reach: wp.reach, combo: p.combo, anim: wp.anim || 'slash' }; p.atkCd = 1 / wp.spd + 0.05; Sim.ev(S, { t: 'sfx', n: 'swing', x: p.x, y: p.y }); }
    }
    // pickup
    for (let i = S.drops.length - 1; i >= 0; i--) {
      const dr = S.drops[i]; const dd = G.dist(dr.x, dr.y, p.x, p.y);
      if (dd < st.pickup && dr.t > 0.3) {
        if (dd > 0.5) { const a = G.angleTo(dr.x, dr.y, p.x, p.y); dr.x += Math.cos(a) * dt * 9; dr.y += Math.sin(a) * dt * 9; continue; }
        if (dr.item === 'coin') { p.coins += dr.n; S.drops.splice(i, 1); Sim.ev(S, { t: 'sfx', n: 'coin', x: p.x, y: p.y, to: p.id }); }
        else { const left = Sim.give(p, dr.item, dr.n, dr.aff, dr.q); if (left < dr.n) { Sim.ev(S, { t: 'sfx', n: dr.aff ? 'pw' : 'pickup', x: p.x, y: p.y, to: p.id }); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.9, s: '+' + (dr.n - left) + ' ' + G.itemName({ id: dr.item, aff: dr.aff }), c: dr.aff ? G.RARITY_COL[dr.q || 0] : '#e0e0e0', to: p.id, small: !dr.aff }); } if (left === 0) S.drops.splice(i, 1); else dr.n = left; }
      }
    }
    // pet
    if (p.pw.wolfpack && (!p.pet || !S.enemies.find(e => e.id === p.pet && !e.dead))) { const e = Sim.makeEnemy(S, 'wolf_pet', p.x + 1, p.y, Sim.difficulty(S)); e.owner = p.id; S.enemies.push(e); p.pet = e.id; }
  }

  Sim.meleeHit = function (S, p) {
    const wp = Sim.weapon(p), st = Sim.stats(p), sw = p.swing;
    const reach = sw.reach + 0.3, half = sw.arc / 2;
    let mult = 1; if (sw.heavy) mult = 1.4 + 0.8 * (sw.pow || 0); else if (sw.combo === 2) mult = 1.5;
    // enemies
    let hitAny = false;
    for (const e of S.enemies) {
      if (e.dead || e.hidden || e.owner) continue;
      const dd = G.dist(p.x, p.y, e.x, e.y) - e.r; if (dd > reach) continue;
      if (Math.abs(G.angDiff(sw.ang, G.angleTo(p.x, p.y, e.x, e.y))) > half + (e.r > 0.6 ? 0.5 : 0)) continue;
      if (sw.heavy && p.pw.heavyhitter) mult *= 1 + 0.4 * p.pw.heavyhitter; if (sw.combo === 2 && p.pw.finisher) mult *= 1 + 0.4 * p.pw.finisher;
      Sim.hitEnemy(S, e, wp.dmg * st.atk * mult, p, { kb: wp.kb * (sw.heavy ? 2 : 1), burn: wp.burn, frost: wp.frost, ls: wp.ls, crit: (sw.combo === 2 ? 0.1 : 0), execute: wp.special === 'execute' });
      if (sw.heavy) e.stun = Math.max(e.stun, 0.4);
      if (wp.special === 'firetrail') S.puddles.push({ x: e.x, y: e.y, r: 0.8, t: 4, friendly: true });
      hitAny = true;
    }
    // boss weapon specials
    if (wp.special === 'shock' && sw.heavy) { Sim.ev(S, { t: 'boom', x: p.x, y: p.y, r: 4, c: '#c0ffc0' }); Sim.ev(S, { t: 'shake', v: 8 }); for (const e of S.enemies) if (!e.dead && !e.owner && G.dist(e.x, e.y, p.x, p.y) < 4 + e.r) { Sim.hitEnemy(S, e, wp.dmg * st.atk * 1.2, p, { aoe: true, kb: 10 }); e.stun = Math.max(e.stun, 0.8); } }
    if (wp.special === 'freeze' && sw.heavy) { Sim.ev(S, { t: 'boom', x: p.x, y: p.y, r: 4, c: '#a0e0ff' }); for (const e of S.enemies) if (!e.dead && !e.owner && G.dist(e.x, e.y, p.x, p.y) < 4 + e.r) { e.stun = Math.max(e.stun, 2); e.slow = 5; Sim.hitEnemy(S, e, wp.dmg * st.atk * 0.5, p, { aoe: true, frost: true }); } }
    if (wp.special === 'shadowbolt') { S.projs.push({ id: G.uid(), x: p.x + Math.cos(sw.ang) * 0.6, y: p.y + Math.sin(sw.ang) * 0.6, vx: Math.cos(sw.ang) * 12, vy: Math.sin(sw.ang) * 12, dmg: wp.dmg * st.atk * 0.6, owner: p.id, type: 'shadow', life: 1.0, r: 0.2, aoe: 0.9 }); }
    if (wp.special === 'punch' && hitAny) { p.punchN = (p.punchN || 0) + 1; if (p.punchN >= 3) { p.punchN = 0; Sim.ev(S, { t: 'boom', x: p.x + Math.cos(sw.ang) * 1.2, y: p.y + Math.sin(sw.ang) * 1.2, r: 2.5, c: '#c0c8e0' }); Sim.ev(S, { t: 'shake', v: 6 }); Sim.ev(S, { t: 'sfx', n: 'slam', x: p.x, y: p.y }); for (const e of S.enemies) if (!e.dead && !e.owner && G.dist(e.x, e.y, p.x, p.y) < 3 + e.r) { Sim.hitEnemy(S, e, wp.dmg * st.atk, p, { aoe: true, kb: 16 }); e.stun = Math.max(e.stun, 0.6); } } }
    if (hitAny) { Sim.ev(S, { t: 'hitstop', to: p.id }); if (sw.heavy) { Sim.ev(S, { t: 'shake', v: 4, id: p.id }); Sim.ev(S, { t: 'sfx', n: 'slam', x: p.x, y: p.y }); } else if (sw.combo === 2) Sim.ev(S, { t: 'txt', x: p.x + Math.cos(sw.ang), y: p.y + Math.sin(sw.ang) - 0.5, s: 'COMBO', c: '#ffe040', to: p.id }); }
    // world object: sample along the aim ray
    const w = S.world;
    for (let s = 0.4; s <= reach; s += 0.35) {
      const x = p.x + Math.cos(sw.ang) * s, y = p.y + Math.sin(sw.ang) * s; const i = G.idx(x, y); const o = w.objs.get(i); if (!o) continue;
      const od = O[o.t]; if (od.isChest || od.altar || od.boat) continue;
      const tool = wp.tool || 'fist'; let power = wp.power ? (wp.tool === 'fist' ? 1.0 : TOOL_POWER[wp.tier]) : 1.0;
      if (od.tool === 'pick' && tool === 'pick') power *= 1.5; else if (od.tool === 'axe' && tool === 'axe') power *= 1.4; // the right tool is quick: ~5 hits for a tree or rock at tier 1
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
        else Sim.dropLoot(S, od.drops, tx, ty, 1 + 0.2 * (p.pw.scavenger || 0));
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
    const shots = 1 + (p.pw.splitshot || 0);
    for (let k = 0; k < shots; k++) { const a = p.face + (k - (shots - 1) / 2) * 0.12; S.projs.push({ id: G.uid(), x: p.x, y: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, owner: p.id, type: 'arrow', life: 1.6, r: 0.15, pierce: (pow >= 1 ? 1 : 0) + (bow.pierce ? 2 : 0), poison: bow.special === 'poison' }); }
    Sim.ev(S, { t: 'sfx', n: 'bow', x: p.x, y: p.y });
  };
  Sim.castStaff = function (S, p, staff) {
    if (p.stam < staff.cost) return; p.stam -= staff.cost;
    const st = Sim.stats(p), pow = Math.min(1, p.draw / staff.draw);
    S.projs.push({ id: G.uid(), x: p.x + Math.cos(p.face) * 0.5, y: p.y + Math.sin(p.face) * 0.5, vx: Math.cos(p.face) * 11, vy: Math.sin(p.face) * 11, dmg: staff.dmg * (0.6 + 0.4 * pow) * st.atk, owner: p.id, type: staff.chain ? 'lich' : staff.frost ? 'ice' : 'fire', life: 1.4, r: 0.25, aoe: staff.chain ? 1.0 : 1.4 });
    Sim.ev(S, { t: 'sfx', n: staff.frost ? 'tele' : 'boom', x: p.x, y: p.y });
  };
  Sim.explode = function (S, pr) {
    if (pr.exploded) return; pr.exploded = true;
    const by = S.players[pr.owner]; Sim.ev(S, { t: 'boom', x: pr.x, y: pr.y, r: pr.aoe, c: pr.type === 'ice' ? '#a0e0ff' : '#ff8030' }); Sim.ev(S, { t: 'sfx', n: 'boom', x: pr.x, y: pr.y });
    for (const e of S.enemies) if (!e.dead && !e.hidden && !e.owner && G.dist(e.x, e.y, pr.x, pr.y) < pr.aoe + e.r) { Sim.hitEnemy(S, e, pr.dmg, by, { aoe: true, kb: 4, burn: pr.type === 'fire', frost: pr.type === 'ice' }); if (pr.type === 'ice') e.stun = Math.max(e.stun, 0.8); }
    if (pr.type === 'lich') { let n = 0, from = { x: pr.x, y: pr.y }; for (const e of S.enemies) { if (n >= 4) break; if (e.dead || e.owner || G.dist(e.x, e.y, pr.x, pr.y) > 7) continue; n++; Sim.ev(S, { t: 'zap', x1: from.x, y1: from.y, x2: e.x, y2: e.y }); Sim.hitEnemy(S, e, pr.dmg * 0.7, by, { aoe: true, noCrit: true }); from = e; if (by) by.hp = Math.min(by.maxHp, by.hp + pr.dmg * 0.15); } }
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
        if (!G.inWorld(pr.x, pr.y) || (o && O[o.t].solid && !O[o.t].tall && !O[o.t].floor)) { dead = true; if (pr.owner && pr.type !== 'arrow') { Sim.explode(S, pr); break; } if (o && O[o.t].built && pr.type !== 'arrow') { o.hp -= pr.dmg * 0.5; if (o.hp <= 0) G.setObj(w, G.idx(pr.x, pr.y), null); else G.setObj(w, G.idx(pr.x, pr.y), o); } break; }
        if (pr.type === 'arrow') {
          for (const e of S.enemies) { if (e.dead || e.hidden || e.owner || (pr.hitIds && pr.hitIds.includes(e.id))) continue; if (G.dist(e.x, e.y, pr.x, pr.y) < e.r + pr.r) { Sim.hitEnemy(S, e, pr.dmg, S.players[pr.owner], { kb: 3, poison: pr.poison }); (pr.hitIds || (pr.hitIds = [])).push(e.id); if (pr.pierce > 0) pr.pierce--; else dead = true; break; } }
        } else if (pr.owner) { // player spell: explodes on contact
          for (const e of S.enemies) { if (e.dead || e.hidden || e.owner) continue; if (G.dist(e.x, e.y, pr.x, pr.y) < e.r + pr.r) { dead = true; break; } }
          if (dead) Sim.explode(S, pr);
          if (Math.random() < 0.5) Sim.ev(S, { t: 'fire', x: pr.x, y: pr.y });
        } else {
          for (const id in S.players) { const p = S.players[id]; if (p.dead || p.downed) continue; if (G.dist(p.x, p.y, pr.x, pr.y) < 0.35 + pr.r) { Sim.damagePlayer(S, p, pr.dmg, pr.src, { ranged: true }); if (pr.type === 'web') { p.slow = Math.max(p.slow, 2.5); Sim.ev(S, { t: 'txt', x: p.x, y: p.y - 0.8, s: 'webbed', c: '#c0c0ff', to: p.id }); } dead = true; break; } }
          if (pr.type === 'glob' && dead) S.puddles.push({ x: pr.x, y: pr.y, r: 0.9, t: 5 });
        }
      }
      if (dead && pr.owner && pr.type !== 'arrow') Sim.explode(S, pr);
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
    if (Sim.isNight(S)) { let n = 0; for (const id in S.players) n = Math.max(n, S.players[id].pw.sundial || 0); tdt = dt / (1 - Math.min(0.5, 0.12 * n)); if (S.nev === 'eclipse') tdt /= 1.4; }
    if (S.phase === 'run' && S.time >= G.DUSK_AT && S.nevDay !== S.day) Sim.pickNightEvent(S);
    if (S.tutHold && S.elapsed > 480) S.tutHold = false;
    if (S.tutHold) tdt = 0;
    if (S.phase === 'run') { S.time += tdt; if (S.time >= G.DAY_LEN) { S.time -= G.DAY_LEN; S.day++; S.waves = {}; S.nev = 'clear'; Sim.ev(S, { t: 'nev', id: 'clear' }); Sim.ev(S, { t: 'chat', sys: true, msg: 'Day ' + S.day + ' dawns.' }); for (const id in S.players) { const p = S.players[id]; if (p.dead) { p.dead = false; p.downed = false; p.hp = p.maxHp * 0.5; p.hunger = 60; p.x = S.world.spawn.x; p.y = S.world.spawn.y; p.inv = new Array(INV).fill(null); Sim.ev(S, { t: 'chat', sys: true, msg: p.name + ' washed back ashore.' }); } } } }
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
      players[id] = { id: p.id, name: p.name, col: p.col, hat: p.hat, skin: p.skin, sitting: p.sitting ? 1 : 0, emote: p.emote > 0 ? +p.emote.toFixed(1) : 0, rig: p.rig, x: +p.x.toFixed(2), y: +p.y.toFixed(2), face: +p.face.toFixed(2), hp: Math.round(p.hp * 10) / 10, maxHp: p.maxHp, stam: Math.round(p.stam), hunger: Math.round(p.hunger), inv: p.inv, held: p.held, armor: p.armor, coins: p.coins, pw: p.pw, buffs: p.buffs.map(b => ({ id: b.id, t: Math.round(b.t) })), swing: p.swing ? { t: +p.swing.t.toFixed(2), dur: p.swing.dur, ang: +p.swing.ang.toFixed(2), arc: p.swing.arc, reach: p.swing.reach, combo: p.swing.combo || 0, anim: p.swing.anim || 'slash', heavy: p.swing.heavy ? 1 : 0 } : null, charge: +p.charge.toFixed(2), dodgeT: p.dodgeT > 0 ? 1 : 0, dodgeCh: p.dodgeCh, blocking: p.blocking ? 1 : 0, draw: +p.draw.toFixed(2), downed: p.downed ? 1 : 0, bleed: Math.round(p.bleed), revive: +p.revive.toFixed(1), dead: p.dead ? 1 : 0, flash: p.flash > 0 ? 1 : 0, moving: p.moving ? 1 : 0, anim: +p.anim.toFixed(2), kills: p.kills, dark: p.dark > 2.5 ? 1 : 0, xp: p.xp, lvl: p.lvl, xpNext: G.XP_FOR(p.lvl), offer: p.offers.length ? p.offers[0] : null, offerT: Math.round(p.offerT), slow: p.slow > 0 ? 1 : 0, burn: p.burn > 0 ? 1 : 0, swCd: Math.round(p.swCd) };
    }
    const enemies = S.enemies.filter(e => !e.dead).map(e => [e.id, G.EN_IDX[e.t], +e.x.toFixed(2), +e.y.toFixed(2), Math.round(e.hp), e.maxHp, e.st, +e.face.toFixed(2), e.flash > 0 ? 1 : 0, e.r, e.stun > 0 ? 1 : 0, e.hidden ? 1 : 0, e.owner ? 1 : 0, e.burn > 0 ? 1 : 0, +(e.tm || 0).toFixed(2), e.elite ? 1 : 0]);
    const projs = S.projs.map(p => [p.id, p.type, +p.x.toFixed(2), +p.y.toFixed(2), +Math.atan2(p.vy, p.vx).toFixed(2)]);
    const drops = S.drops.map(d => [d.id, d.item === 'coin' ? -1 : G.ITEM_IDX[d.item], +d.x.toFixed(2), +d.y.toFixed(2), d.n, d.aff || 0, d.q || 0]);
    const puddles = S.puddles.map(p => [+p.x.toFixed(1), +p.y.toFixed(1), p.r, +p.t.toFixed(1)]);
    const snap = { t: 'snap', time: +S.time.toFixed(2), day: S.day, phase: S.phase, nev: S.nev, siegeT: Math.ceil(S.siegeT), boat: S.boat, bosses: S.bosses, players, enemies, projs, drops, puddles, stats: S.stats, diff: +Sim.difficulty(S).toFixed(2) };
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
