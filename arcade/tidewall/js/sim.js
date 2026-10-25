'use strict';
// TIDEWALL — headless game simulation: structures, flow-field pathing, enemies, towers, projectiles, waves,
// day/night economy and roguelite state. No DOM; visual/audio feedback goes through the `fx` hook object.
(function (TW) {
  const T = TW.T, C = TW.Core;
  const W = TW.W, H = TW.H, N = W * H;
  const MAXE = 900, MAXP = 700, MAXTAR = 48;
  const PREVIEW_ID = 30000;
  const NOOP = function () {};
  const NOFX = { spark: NOOP, puff: NOOP, text: NOOP, shake: NOOP, sound: NOOP, ring: NOOP, bolt: NOOP, beam: NOOP, flame: NOOP, event: NOOP, haptic: NOOP };

  function defaultMods() {
    const dmg = {};
    for (const id of TW.TOWER_IDS) dmg[id] = 0;
    return {
      wallHp: 1, towerHp: 0, dmg, allDmg: 0, range: 0, rate: 0, gold: 0, goldFlat: 0, actions: 0, harvMax: 0,
      reflect: 0, shatter: 0, chains: 0, stoneDisc: 0, wallDisc: 0, refund: TW.SELL_REFUND, beam: 1, beamRange: 0,
      beams: 1, vein: 0, splash: 0, dawnHeal: 0, hunter: 0, rebuild: 0, interest: 0, phoenix: 0, slow: 0, pull: 0,
      lantern: 0, t3Disc: 0, boonChoices: 3,
    };
  }

  function Enemy() {
    this.active = false; this.uid = 0; this.def = null; this.id = '';
    this.x = 0; this.y = 0; this.hp = 0; this.maxHp = 0; this.armor = 0; this.shield = 0; this.shieldMax = 0; this.shieldT = 0;
    this.spd = 1; this.r = 0.3; this.fly = false; this.boss = false; this.breaker = false; this.invis = false;
    this.slow = 0; this.slowT = 0; this.stunT = 0; this.rootT = 0; this.freezeT = 0; this.burn = 0; this.burnT = 0; this.burnStacks = 0;
    this.rime = 0; this.rimeT = 0; this.markT = 0; this.meltT = 0; this.melt = 0; this.revealT = 0; this.hitT = 0;
    this.burrowed = false; this.burrowT = 0; this.healT = 0; this.sumT = 0; this.stompT = 0; this.phaseT = 0; this.faded = false;
    this.pullT = 0; this.pvx = 0; this.pvy = 0; this.prog = 0; this.atk = false; this.face = 1; this.t = 0; this.wob = 0;
    this.gnext = -1; this.seed = 0; this.tarSlow = 0; this.lastCell = -1; this.idx = 0;
  }
  function Proj() {
    this.active = false; this.kind = ''; this.x = 0; this.y = 0; this.x0 = 0; this.y0 = 0; this.tx = 0; this.ty = 0;
    this.t = 0; this.T = 0; this.spd = 0; this.target = null; this.tuid = 0; this.src = null; this.dmg = 0; this.ang = 0; this.z = 0;
    this.st = null; this.small = false;
  }

  // ---------------------------------------------------------------- Run
  function Run(cfg) {
    cfg = cfg || {};
    this.fx = cfg.fx || NOFX;
    this.god = !!cfg.god;
    this.seed = cfg.seed >>> 0 || C.newSeed();
    this.mapSeed = (cfg.mapSeed >>> 0) || this.seed;
    this.map = C.genMap(this.mapSeed);
    this.terr = this.map.terr;
    this.core = this.map.core;
    this.cx = (this.core % W) + 0.5; this.cy = ((this.core / W) | 0) + 0.5;
    this.cmd = cfg.cmd || 'mara';
    this.unlocked = (cfg.unlocked || TW.START_TOWERS).slice();
    this.night = 1; this.phase = 'day';
    this.res = { g: TW.START.g, w: TW.START.w, s: TW.START.s, c: TW.START.c };
    this.maxHp = TW.START.hp; this.hp = this.maxHp;
    this.mods = defaultMods();
    this.boons = {}; this.offers = [];
    this.stats = { kills: 0, leaks: 0, gold: 0, bossKills: 0, nightsCleared: 0, built: 0, dmgBy: {} };
    this.structs = []; this.occ = new Int16Array(N).fill(-1); this.nextId = 0;
    this.lostWalls = [];
    this.dawn = null;
    // pools
    this.enemies = []; for (let i = 0; i < MAXE; i++) this.enemies.push(new Enemy());
    this.projs = []; for (let i = 0; i < MAXP; i++) this.projs.push(new Proj());
    this.tars = []; for (let i = 0; i < MAXTAR; i++) this.tars.push({ active: false, x: 0, y: 0, r: 1, t: 0, slow: 0, dps: 0 });
    this.alive = 0; this.uidc = 1;
    this.head = new Int32Array(N).fill(-1); this.enext = new Int32Array(MAXE).fill(-1);
    this.qbuf = new Array(MAXE); this.qn = 0;
    this.hitMark = new Uint32Array(MAXE); this.hitGen = 1;
    // fields
    this.F = { walk: C.makeField(W, H), brk: C.makeField(W, H), free: C.makeField(W, H), open: C.makeField(W, H) };
    this.PF = { walk: C.makeField(W, H), open: C.makeField(W, H) };
    this.cost = new Float32Array(N); this.solid = new Uint8Array(N);
    this.occT = new Int16Array(N);
    this.previewKind = 'wall';
    const self = this;
    this.kindOf = (id) => (id === PREVIEW_ID ? self.previewKind : self.structs[id].kind);
    this.hpOf = (id) => (id === PREVIEW_ID ? self.previewHp : self.structs[id].maxHp);
    this.routes = null; this.dirty = true;
    this.wave = null; this.nt = 0; this.beamCd = 0; this.beamAim = 0; this.beamFlash = 0;
    // apply commander + perks
    if (!cfg.restore) {
      const cm = TW.COMMANDERS.find((c) => c.id === this.cmd) || TW.COMMANDERS[0];
      cm.apply(this);
      const perks = cfg.perks || {};
      for (const p of TW.PERKS) if (perks[p.id]) p.apply(this, perks[p.id]);
      this.actions = this.actionsMax();
    }
    this.recalc();
  }
  TW.Run = Run;
  const R = Run.prototype;

  R.actionsMax = function () { return TW.START.actions + this.mods.actions; };
  R.harvMax = function () { return TW.START.harvMax + this.mods.harvMax; };
  R.harvCount = function () { let n = 0; for (const s of this.structs) if (s && s.kind === 'harv') n++; return n; };
  R.spawnsActive = function (night) { return this.map.spawns.slice(0, C.spawnCount(night || this.night)); };
  R.isSpawn = function (i) { return this.map.spawns.indexOf(i) >= 0; };

  // ---------------- costs ----------------
  R.wallCost = function () { return { w: Math.max(1, TW.WALL.wood.cost.w - this.mods.wallDisc) }; };
  R.stoneCost = function () { return { s: Math.max(1, TW.WALL.stone.cost.s - this.mods.stoneDisc) }; };
  R.towerCost = function (type, tier, br) {
    const d = TW.TOWERS[type];
    if (tier < 2) return Object.assign({}, d.tiers[tier].cost);
    const c = Object.assign({}, d.branches[br].cost);
    if (this.mods.t3Disc) { c.g = Math.round(c.g * 0.85); if (c.c) c.c = Math.max(0, c.c - this.mods.t3Disc); }
    return c;
  };
  R.harvCost = function () { return Object.assign({}, TW.HARVESTER.cost); };
  R.afford = function (c) { return (c.g || 0) <= this.res.g && (c.w || 0) <= this.res.w && (c.s || 0) <= this.res.s && (c.c || 0) <= this.res.c; };
  R.pay = function (c, s) {
    for (const k of ['g', 'w', 's', 'c']) {
      const v = c[k] || 0; if (!v) continue;
      this.res[k] -= v; if (s) s.spent[k] = (s.spent[k] || 0) + v;
    }
  };

  // ---------------- placement ----------------
  R.cellFree = function (i) {
    if (i < 0 || i >= N) return false;
    return C.buildable(this.terr[i]) && this.occ[i] < 0 && !this.isSpawn(i);
  };
  R.placeReason = function (i) {
    if (this.phase !== 'day') return 'Build during the day';
    if (i < 0 || i >= N) return 'Off the island';
    const t = this.terr[i];
    if (t === T.CORE) return 'That is the lighthouse';
    if (TW.NODE_RES[t]) return 'Resource node';
    if (!C.buildable(t)) return 'Cannot build there';
    if (this.occ[i] >= 0) return 'Occupied';
    if (this.isSpawn(i)) return 'Landing beach';
    return '';
  };
  R.addStruct = function (kind, i, extra) {
    const s = Object.assign({
      id: this.nextId++, kind, i, x: i % W, y: (i / W) | 0, hp: 1, maxHp: 1, stone: false, type: '', tier: 0, br: -1,
      prio: 'first', spent: {}, cd: 0, aim: -Math.PI / 2, flash: 0, dmg: 0, kills: 0, st: null, pulse: 0, born: 0,
    }, extra || {});
    this.structs[s.id] = s;
    this.occ[i] = s.id;
    this.refreshHp(s, true);
    this.dirty = true;
    return s;
  };
  R.refreshHp = function (s, full) {
    let mh;
    if (s.kind === 'wall') mh = (s.stone ? TW.WALL.stone.hp : TW.WALL.wood.hp) * this.mods.wallHp;
    else if (s.kind === 'harv') mh = TW.HARVESTER.hp * (1 + this.mods.towerHp);
    else mh = TW.TOWERS[s.type].hp * (1 + this.mods.towerHp) * (1 + 0.35 * s.tier);
    const frac = s.maxHp > 0 ? s.hp / s.maxHp : 1;
    s.maxHp = Math.round(mh);
    s.hp = full ? s.maxHp : Math.max(1, Math.round(s.maxHp * frac));
  };
  R.removeStruct = function (s) {
    if (!s || this.structs[s.id] !== s) return;
    this.structs[s.id] = null;
    if (this.occ[s.i] === s.id) this.occ[s.i] = -1;
    this.dirty = true;
  };
  // Paint a wall line. Returns number of walls placed.
  R.buildWalls = function (cells) {
    if (this.phase !== 'day') return 0;
    let n = 0;
    for (const i of cells) {
      if (this.placeReason(i)) continue;
      const c = this.wallCost();
      if (!this.afford(c)) break;
      const s = this.addStruct('wall', i);
      this.pay(c, s); n++;
    }
    if (n) { this.stats.built += n; this.recalc(); }
    return n;
  };
  R.buildTower = function (i, type) {
    if (this.placeReason(i) || this.unlocked.indexOf(type) < 0) return null;
    const c = this.towerCost(type, 0);
    if (!this.afford(c)) return null;
    const s = this.addStruct('tower', i, { type });
    this.pay(c, s);
    this.stats.built++;
    this.recalc();
    return s;
  };
  R.harvYield = function (i) {
    const y = { w: 0, s: 0, c: 0 };
    const x0 = i % W, y0 = (i / W) | 0;
    for (let k = 0; k < 8; k++) {
      const x = x0 + C.DX[k], yy = y0 + C.DY[k];
      if (x < 0 || yy < 0 || x >= W || yy >= H) continue;
      const r = TW.NODE_RES[this.terr[yy * W + x]];
      if (r) y[r] += TW.HARVESTER.yieldPer[r];
    }
    y.c += this.mods.vein;
    return y;
  };
  R.buildHarvester = function (i) {
    if (this.placeReason(i) || this.harvCount() >= this.harvMax()) return null;
    const c = this.harvCost();
    if (!this.afford(c)) return null;
    const s = this.addStruct('harv', i);
    this.pay(c, s);
    this.stats.built++;
    this.recalc();
    return s;
  };
  R.upgradeCost = function (s, br) {
    if (s.kind === 'wall') return s.stone ? null : this.stoneCost();
    if (s.kind !== 'tower' || s.tier >= 2) return null;
    return this.towerCost(s.type, s.tier + 1, br || 0);
  };
  R.upgrade = function (s, br) {
    if (!s || this.phase === 'boon' || this.phase === 'over') return false;
    const c = this.upgradeCost(s, br);
    if (!c || !this.afford(c)) return false;
    this.pay(c, s);
    if (s.kind === 'wall') { s.stone = true; this.refreshHp(s, true); this.dirty = true; this.recalc(); return true; }
    s.tier++;
    if (s.tier === 2) s.br = br || 0;
    this.refreshHp(s, false);
    s.hp = s.maxHp;
    this.dirty = true; this.recalc();
    return true;
  };
  R.refundOf = function (s) {
    const r = {}, f = this.mods.refund;
    for (const k in s.spent) r[k] = Math.floor(s.spent[k] * f);
    return r;
  };
  R.sell = function (s) {
    if (!s || this.phase !== 'day') return false;
    const r = this.refundOf(s);
    for (const k in r) this.res[k] += r[k];
    this.removeStruct(s);
    this.recalc();
    return true;
  };
  R.cyclePrio = function (s) {
    const k = TW.PRIOS.indexOf(s.prio);
    s.prio = TW.PRIOS[(k + 1) % TW.PRIOS.length];
    return s.prio;
  };
  R.gather = function (i) {
    if (this.phase !== 'day' || this.actions <= 0) return 0;
    const r = TW.NODE_RES[this.terr[i]];
    if (!r) return 0;
    const v = TW.GATHER[r];
    this.res[r] += v; this.actions--;
    return v;
  };

  // ---------------- tower stats ----------------
  R.statsFor = function (type, tier, br, buf) {
    const d = TW.TOWERS[type];
    const base = tier < 2 ? d.tiers[tier] : d.branches[br];
    const m = this.mods;
    const st = Object.assign({}, base);
    const dm = 1 + (m.dmg[type] || 0) + m.allDmg + (buf ? buf.dmg : 0);
    st.dmg = (st.dmg || 0) * dm;
    if (st.burn) st.burn *= dm;
    if (st.tarDps) st.tarDps *= dm;
    if (st.bombletDmg) st.bombletDmg *= dm;
    st.rate = (st.rate || 0) * (1 + m.rate + (buf ? buf.rate : 0));
    let rm = 1 + m.range + (buf ? buf.range : 0);
    if (type === 'lantern') rm += m.lantern;
    if (d.mode !== 'aura') st.range *= rm;
    if (st.slow) st.slow = Math.min(0.8, st.slow + m.slow);
    if (st.chains) st.chains += m.chains;
    if (st.splash) st.splash *= 1 + m.splash;
    if (st.pull) st.pull *= 1 + m.pull;
    if (type === 'brazier' && m.phoenix) st.air = 1;
    st.ground = 1;
    return st;
  };
  R.recalcTowers = function () {
    // shrine buffs then stats for every tower
    const towers = [];
    for (const s of this.structs) if (s && s.kind === 'tower') towers.push(s);
    for (const s of towers) s.buf = { dmg: 0, rate: 0, range: 0 };
    for (const sh of towers) {
      if (sh.type !== 'shrine') continue;
      const st = this.statsFor('shrine', sh.tier, sh.br, null);
      sh.st = st;
      for (const s of towers) {
        if (s === sh || s.type === 'shrine') continue;
        const dx = s.x - sh.x, dy = s.y - sh.y;
        if (dx * dx + dy * dy > st.range * st.range + 0.01) continue;
        // strongest shrine wins per stat (no stacking)
        s.buf.dmg = Math.max(s.buf.dmg, st.aura || 0);
        s.buf.rate = Math.max(s.buf.rate, st.auraRate || 0);
        s.buf.range = Math.max(s.buf.range, st.auraRange || 0);
      }
    }
    for (const s of towers) if (s.type !== 'shrine') s.st = this.statsFor(s.type, s.tier, s.br, s.buf);
  };

  // ---------------- pathing ----------------
  R.computeFields = function (occ, F, modes) {
    for (const mode of modes) {
      C.fillCost(this.terr, occ, this.kindOf, this.hpOf, mode, this.cost, this.solid);
      C.computeField(F[mode], this.cost, mode === 'open' ? null : this.solid, this.core);
    }
  };
  R.recalc = function () {
    if (!this.dirty) return;
    this.dirty = false;
    this.computeFields(this.occ, this.F, ['walk', 'brk', 'free', 'open']);
    this.routes = this.routesFrom(this.F.walk, this.F.open, this.occ);
    this.recalcTowers();
  };
  R.routesFrom = function (Fw, Fo, occ) {
    const sp = this.spawnsActive();
    const paths = [], breach = [];
    let sealed = false;
    for (const s of sp) {
      const p = C.trace(Fw, s, this.core, []);
      paths.push(p);
      if (Fo.dist[s] === Infinity) sealed = true;
      for (const c of p) if (occ[c] >= 0 && breach.indexOf(c) < 0) breach.push(c);
    }
    let len = 0;
    for (const p of paths) len = Math.max(len, p.length);
    return { paths, breach, sealed, len };
  };
  // Hypothetical routes if `cells` were built (kind 'wall' | 'tower' | 'harv'); null cells => current.
  R.previewRoutes = function (cells, kind, type) {
    if (!cells || !cells.length) return this.routes;
    this.occT.set(this.occ);
    for (const i of cells) if (this.cellFree(i)) this.occT[i] = PREVIEW_ID;
    this.previewKind = kind === 'wall' ? 'wall' : 'tower';
    this.previewHp = kind === 'wall' ? TW.WALL.wood.hp * this.mods.wallHp : (type ? TW.TOWERS[type].hp : TW.HARVESTER.hp) * (1 + this.mods.towerHp);
    this.computeFields(this.occT, this.PF, ['walk', 'open']);
    return this.routesFrom(this.PF.walk, this.PF.open, this.occT);
  };

  // ---------------- night ----------------
  R.startNight = function () {
    if (this.phase !== 'day') return false;
    this.recalc();
    this.wave = C.genWave(this.night, this.seed);
    this.wave.spawned = 0;
    this.wave.gs = this.wave.groups.map(() => ({ n: 0, t: 0 }));
    this.wave.bossDone = !this.wave.boss;
    this.nt = 0; this.phase = 'night'; this.lostWalls = [];
    this.nightKills = 0; this.nightLeaks = 0; this.nightGold = 0;
    for (const s of this.structs) if (s) { s.cd = Math.random() * 0.3; s.dmgNight = 0; }
    this.fx.event('nightStart', this.night, this.wave.boss);
    return true;
  };
  R.spawnEnemy = function (id, x, y, isBoss) {
    let e = null;
    for (let k = 0; k < MAXE; k++) { if (!this.enemies[k].active) { e = this.enemies[k]; e.idx = k; break; } }
    if (!e) return null;
    const d = isBoss ? TW.BOSSES[id] : TW.ENEMIES[id];
    const hm = isBoss ? 1 + Math.max(0, this.night - d.night) * 0.1 : this.wave.hpMul;
    e.active = true; e.uid = this.uidc++; e.def = d; e.id = id;
    e.x = x; e.y = y; e.maxHp = e.hp = d.hp * hm; e.armor = d.armor || 0;
    e.shieldMax = e.shield = (d.shield || 0) * hm; e.shieldT = 0;
    e.spd = d.spd; e.r = d.r || 0.3; e.fly = !!d.fly; e.boss = !!isBoss; e.breaker = !!d.breaker; e.invis = !!d.invis;
    e.slow = 0; e.slowT = 0; e.stunT = 0; e.rootT = 0; e.freezeT = 0; e.burn = 0; e.burnT = 0; e.burnStacks = 0;
    e.rime = 0; e.rimeT = 0; e.markT = 0; e.meltT = 0; e.melt = 0; e.revealT = 0; e.hitT = 0;
    e.burrowed = !!d.burrow; e.burrowT = d.burrow ? 2.2 : 0; e.healT = 1; e.sumT = d.summonT || 0; e.stompT = d.stomp || 0;
    e.phaseT = d.phase ? 7 : 0; e.faded = false; e.pullT = 0; e.atk = false; e.t = 0; e.wob = Math.random() * 6.28;
    e.seed = Math.random(); e.tarSlow = 0; e.face = 1; e.lastCell = -1;
    e.prog = 999;
    this.alive++;
    return e;
  };
  R.spawnAt = function (sp, id, isBoss) {
    const sx = (sp % W) + 0.5, sy = ((sp / W) | 0) + 0.5;
    const d = isBoss ? TW.BOSSES[id] : TW.ENEMIES[id];
    if (d.fly) return this.spawnEnemy(id, sx + (Math.random() - 0.5) * 1.6, Math.max(0.2, sy - 1.6 - Math.random()), isBoss);
    return this.spawnEnemy(id, sx + (Math.random() - 0.5) * 0.4, sy + (Math.random() - 0.5) * 0.3, isBoss);
  };
  R.waveProgress = function () {
    if (!this.wave) return 0;
    const tot = this.wave.total;
    return tot ? Math.max(0, Math.min(1, (this.wave.spawned - this.alive) / tot)) : 1;
  };

  R.update = function (dt) {
    if (this.phase !== 'night') return;
    this.recalc();
    this.nt += dt;
    const wv = this.wave, sps = this.spawnsActive();
    // spawning
    for (let g = 0; g < wv.groups.length; g++) {
      const G = wv.groups[g], S = wv.gs[g];
      if (S.n >= G.n || this.nt < G.at) continue;
      S.t -= dt;
      if (S.t <= 0) {
        if (this.spawnAt(sps[G.sp % sps.length], G.type, false)) { S.n++; wv.spawned++; }
        S.t = G.gap;
      }
    }
    if (!wv.bossDone && this.nt >= wv.bossAt) {
      wv.bossDone = true;
      const e = this.spawnAt(sps[0], wv.boss, true);
      if (e) { wv.spawned++; this.fx.event('boss', wv.boss); }
    }
    this.updateEnemies(dt);
    this.buildGrid();
    this.updateTars(dt);
    this.updateTowers(dt);
    this.updateCoreBeam(dt);
    this.updateProjs(dt);
    if (this.phase === 'night' && wv.spawned >= wv.total && this.alive <= 0) this.endNight();
  };

  R.fieldFor = function (e) { return e.burrowed ? this.F.free : (e.breaker ? this.F.brk : this.F.walk); };
  R.cellAt = function (x, y) {
    let cx = x | 0, cy = y | 0;
    if (cx < 0) cx = 0; else if (cx >= W) cx = W - 1;
    if (cy < 0) cy = 0; else if (cy >= H) cy = H - 1;
    return cy * W + cx;
  };
  R.walkable = function (i) { return C.passable(this.terr[i]) && this.occ[i] < 0; };

  R.updateEnemies = function (dt) {
    const E = this.enemies, fx = this.fx, cx = this.cx, cy = this.cy;
    for (let k = 0; k < MAXE; k++) {
      const e = E[k];
      if (!e.active) continue;
      const d = e.def;
      e.t += dt;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.revealT > 0) e.revealT -= dt;
      if (e.markT > 0) e.markT -= dt;
      if (e.rimeT > 0) e.rimeT -= dt;
      if (e.meltT > 0) e.meltT -= dt;
      // burning (ignores armor and shields)
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burn * e.burnStacks * dt;
        if (e.hp <= 0) { this.kill(e, null); continue; }
        if (e.burnT <= 0) { e.burnStacks = 0; e.burn = 0; }
      }
      // shield regen
      if (e.shieldMax > 0) {
        if (e.shieldT > 0) e.shieldT -= dt;
        else if (e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.25 * dt);
      }
      // abilities
      if (d.heal) {
        e.healT -= dt;
        if (e.healT <= 0) { e.healT = 1; this.healAround(e); }
      }
      if (d.summon) {
        e.sumT -= dt;
        if (e.sumT <= 0) {
          e.sumT = d.summonT;
          for (let s = 0; s < d.summonN; s++) {
            const m = this.spawnEnemy(d.summon, e.x + (Math.random() - 0.5) * 0.8, e.y + (Math.random() - 0.5) * 0.8, false);
            if (m) { this.wave.total++; this.wave.spawned++; }
          }
          fx.ring(e.x, e.y, 1.2, d.color); fx.sound('summon');
        }
      }
      if (d.stomp) {
        e.stompT -= dt;
        if (e.stompT <= 0) { e.stompT = d.stomp; this.stomp(e); }
      }
      if (d.phase) {
        e.phaseT -= dt;
        if (e.phaseT <= 0) { e.faded = !e.faded; e.invis = e.faded; e.phaseT = e.faded ? 3.5 : 7; fx.ring(e.x, e.y, 1.5, '#ff3d6e'); }
      }
      if (d.burrow) {
        e.burrowT -= dt;
        if (e.burrowT <= 0) {
          if (e.burrowed) {
            const c = this.cellAt(e.x, e.y);
            if (this.walkable(c) || this.terr[c] === T.CORE) { e.burrowed = false; e.burrowT = 1.7; fx.puff(e.x, e.y, '#8a6040', 0.5); }
            else e.burrowT = 0.2;
          } else { e.burrowed = true; e.burrowT = 2.3; fx.puff(e.x, e.y, '#8a6040', 0.5); }
        }
      }
      // movement
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      if (e.stunT > 0) e.stunT -= dt;
      if (e.rootT > 0) e.rootT -= dt;
      if (e.freezeT > 0) e.freezeT -= dt;
      let sp = e.spd * (1 - Math.max(e.slow, e.tarSlow)) * (e.burrowed ? 1.25 : 1);
      e.tarSlow = 0;
      e.atk = false;
      if (e.pullT > 0) {
        e.pullT -= dt;
        const nx = e.x + e.pvx * dt, ny = e.y + e.pvy * dt;
        if (e.fly || this.walkable(this.cellAt(nx, ny))) { e.x = nx; e.y = ny; }
        else e.pullT = 0;
        continue;
      }
      if (e.stunT > 0 || e.freezeT > 0 || (e.rootT > 0 && !e.boss)) continue;
      let step = sp * dt;
      if (e.fly) {
        const dx = cx - e.x, dy = cy - e.y, dd = Math.sqrt(dx * dx + dy * dy);
        e.prog = dd;
        if (dd < 0.45) { this.leak(e); continue; }
        if (step > dd) step = dd;
        e.x += dx / dd * step; e.y += dy / dd * step;
        if (dx < -0.01) e.face = -1; else if (dx > 0.01) e.face = 1;
        continue;
      }
      const F = this.fieldFor(e);
      const c = this.cellAt(e.x, e.y);
      if (c === this.core) { this.leak(e); continue; }
      let nxt;
      if (F.dist[c] === Infinity) nxt = e.lastCell >= 0 ? e.lastCell : this.F.free.next[c]; // nudged off the field: step back
      else { nxt = F.next[c]; e.lastCell = c; }
      if (nxt < 0) { const dx = cx - e.x, dy = cy - e.y, dd = Math.hypot(dx, dy) || 1; e.x += dx / dd * step; e.y += dy / dd * step; continue; }
      const tx = (nxt % W) + 0.5, ty = ((nxt / W) | 0) + 0.5;
      const dx = tx - e.x, dy = ty - e.y, dd = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      e.prog = F.dist[nxt] + dd;
      if (dx < -0.01) e.face = -1; else if (dx > 0.01) e.face = 1;
      const sid = this.occ[nxt];
      if (sid >= 0 && !e.burrowed) {
        // structure in the way: walk up to it and smash
        const reach = 0.5 + Math.min(0.2, e.r * 0.5);
        if (dd > reach) {
          const mv = Math.min(step, dd - reach);
          e.x += dx / dd * mv; e.y += dy / dd * mv;
        } else {
          e.atk = true;
          this.damageStruct(this.structs[sid], (d.sdps || 8) * dt * (e.boss ? 1 : this.wave.hpMul * 0.5 + 0.5), e);
        }
        continue;
      }
      if (step >= dd) { e.x = tx; e.y = ty; }
      else { e.x += dx / dd * step; e.y += dy / dd * step; }
    }
  };
  R.damageStruct = function (s, amt, e) {
    if (!s) return;
    s.hp -= amt;
    s.flash = 0.12;
    if (e && this.mods.reflect > 0 && s.kind === 'wall') {
      e.hp -= amt * this.mods.reflect;
      if (e.hp <= 0) this.kill(e, null);
    }
    if (Math.random() < 0.08) { this.fx.spark(s.x + 0.5, s.y + 0.5, s.kind === 'wall' ? (s.stone ? '#c9d2e4' : '#c78b4f') : '#ffcf8a', 2); this.fx.sound('wallhit'); }
    if (s.hp <= 0) {
      if (s.kind === 'wall') this.lostWalls.push({ i: s.i, stone: s.stone, spent: s.spent });
      this.removeStruct(s);
      this.fx.puff(s.x + 0.5, s.y + 0.5, s.kind === 'wall' ? (s.stone ? '#aab4c8' : '#a8743f') : '#888', 1.1);
      this.fx.shake(0.25); this.fx.sound('wallbreak'); this.fx.event('structLost', s);
      this.recalc();
    }
  };
  R.stomp = function (e) {
    const r = 1.6;
    for (const s of this.structs) {
      if (!s) continue;
      const dx = s.x + 0.5 - e.x, dy = s.y + 0.5 - e.y;
      if (dx * dx + dy * dy <= r * r) this.damageStruct(s, 90, null);
    }
    this.fx.ring(e.x, e.y, r, '#3fbf9f'); this.fx.shake(0.5); this.fx.sound('stomp');
  };
  R.healAround = function (e) {
    const r2 = e.def.healR * e.def.healR, amt = e.def.heal;
    let any = false;
    for (let k = 0; k < MAXE; k++) {
      const o = this.enemies[k];
      if (!o.active || o.hp >= o.maxHp) continue;
      const dx = o.x - e.x, dy = o.y - e.y;
      if (dx * dx + dy * dy > r2) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * amt * (o.boss ? 0.15 : 1));
      any = true;
    }
    if (any) this.fx.ring(e.x, e.y, e.def.healR, '#7dffd8');
  };
  R.leak = function (e) {
    const dmg = e.def.leak || 1;
    e.active = false; this.alive--;
    if (!this.god) this.hp -= dmg;
    this.stats.leaks += dmg; this.nightLeaks += dmg;
    this.fx.event('leak', dmg, e);
    if (this.hp <= 0 && this.phase === 'night') { this.hp = 0; this.lose(); }
  };
  R.kill = function (e, src) {
    if (!e.active) return;
    e.active = false; this.alive--;
    const d = e.def;
    const g = Math.max(1, Math.round((d.gold || 1) * (1 + this.mods.gold))) + this.mods.goldFlat;
    this.res.g += g; this.stats.gold += g; this.nightGold += g;
    this.stats.kills++; this.nightKills++;
    if (src) src.kills++;
    if (e.boss) this.stats.bossKills++;
    this.fx.event('kill', e, g);
    if (d.split) {
      for (let s = 0; s < d.splitN; s++) {
        const m = this.spawnEnemy(d.split, e.x + (Math.random() - 0.5) * 0.5, e.y + (Math.random() - 0.5) * 0.5, false);
        if (m) { this.wave.total++; this.wave.spawned++; }
      }
    }
  };
  R.vulnOf = function (e) {
    let v = 1;
    if (e.rimeT > 0) v += e.rime;
    if (e.markT > 0) v += 0.2;
    if (e.def.invis && e.revealT > 0) v += this.mods.hunter;
    return v;
  };
  // central hit routine; returns damage dealt
  R.hit = function (e, dmg, src, pierce, shieldMul, noShield) {
    if (!e.active || e.burrowed) return 0;
    let armor = e.armor;
    if (e.meltT > 0) { e.armor = Math.max(0, armor - e.melt); }
    const dealt = C.resolveHit(e, dmg * this.vulnOf(e), pierce || 0, shieldMul || 1, noShield);
    e.armor = armor;
    e.shieldT = 3; e.hitT = 0.09;
    if (src) {
      src.dmg += dealt; src.dmgNight = (src.dmgNight || 0) + dealt;
      const k = src.type || 'core';
      this.stats.dmgBy[k] = (this.stats.dmgBy[k] || 0) + dealt;
    }
    if (e.hp <= 0) this.kill(e, src);
    return dealt;
  };

  // spatial grid of targetable enemies (rebuilt every step, no allocation)
  R.buildGrid = function () {
    this.head.fill(-1);
    const E = this.enemies;
    for (let k = 0; k < MAXE; k++) {
      const e = E[k];
      if (!e.active || e.burrowed) continue;
      const c = this.cellAt(e.x, e.y);
      this.enext[k] = this.head[c]; this.head[c] = k;
    }
  };
  // fills this.qbuf with enemies within r of (x,y); flags: air/ground allowed, needVisible
  R.query = function (x, y, r, air, ground, needVis) {
    let n = 0;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.floor(y + r));
    const r2 = r * r, E = this.enemies;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let k = this.head[cy * W + cx];
        while (k >= 0) {
          const e = E[k];
          k = this.enext[k];
          if (!e.active) continue;
          if (e.fly ? !air : !ground) continue;
          if (needVis && e.invis && e.revealT <= 0) continue;
          const dx = e.x - x, dy = e.y - y;
          if (dx * dx + dy * dy > r2 + e.r * e.r * 0.5) continue;
          this.qbuf[n++] = e;
        }
      }
    }
    this.qn = n;
    return n;
  };
  R.pickTarget = function (s, n) {
    let best = null, bv = 0;
    const prio = s.prio, sx = s.x + 0.5, sy = s.y + 0.5, q = this.qbuf;
    for (let k = 0; k < n; k++) {
      const e = q[k];
      let v;
      if (prio === 'first') v = -e.prog;
      else if (prio === 'last') v = e.prog;
      else if (prio === 'strong') v = e.hp + e.shield + (e.boss ? 1e6 : 0);
      else { const dx = e.x - sx, dy = e.y - sy; v = -(dx * dx + dy * dy); }
      if (best === null || v > bv) { best = e; bv = v; }
    }
    return best;
  };

  R.updateTowers = function (dt) {
    const fx = this.fx;
    // lantern reveal pass first
    for (const s of this.structs) {
      if (!s || s.kind !== 'tower' || s.type !== 'lantern') continue;
      const st = s.st, n = this.query(s.x + 0.5, s.y + 0.5, st.range, 1, 1, false);
      for (let k = 0; k < n; k++) { const e = this.qbuf[k]; e.revealT = 0.15; if (st.mark) e.markT = 0.15; }
    }
    for (const s of this.structs) {
      if (!s) continue;
      if (s.flash > 0) s.flash -= dt;
      if (s.pulse > 0) s.pulse -= dt;
      if (s.kind !== 'tower') continue;
      const st = s.st;
      if (s.type === 'shrine') {
        if (st.mend) this.mendAround(s, st, dt);
        continue;
      }
      s.cd -= dt;
      if (s.cd > 0) continue;
      const sx = s.x + 0.5, sy = s.y + 0.5;
      const mode = TW.TOWERS[s.type].mode;
      if (mode === 'flame') {
        const n = this.query(sx, sy, st.range, st.air ? 1 : 0, 1, false);
        if (!n) { s.cd = 0.1; continue; }
        for (let k = 0; k < n; k++) {
          const e = this.qbuf[k];
          this.hit(e, st.dmg, s, 0, 1, st.noShield);
          if (!e.active) continue;
          if (st.stack) { e.burnStacks = Math.min(st.stack, e.burnStacks + 1); }
          else e.burnStacks = Math.max(1, e.burnStacks);
          e.burn = Math.max(e.burn, st.burn); e.burnT = st.burnT;
          if (st.melt) { e.melt = st.melt; e.meltT = 2.5; }
        }
        s.cd = 1 / st.rate; s.pulse = 0.3;
        fx.flame(sx, sy, st.range, st.noShield ? '#6fc8ff' : '#ff8a3d'); fx.sound('flame');
        continue;
      }
      if (mode === 'pulse') {
        const n = this.query(sx, sy, st.range, 1, 1, false);
        if (!n) { s.cd = 0.1; continue; }
        for (let k = 0; k < n; k++) {
          const e = this.qbuf[k];
          this.hit(e, st.dmg, s, 0, 1, false);
          if (!e.active) continue;
          const sl = e.boss ? st.slow * 0.5 : st.slow;
          if (sl >= e.slow) { e.slow = sl; e.slowT = st.slowT; } else e.slowT = Math.max(e.slowT, st.slowT * 0.5);
          if (st.freeze && !e.boss && Math.random() < st.freeze) { e.freezeT = st.freezeT; fx.spark(e.x, e.y, '#e4fbff', 4); }
          if (st.rime) { e.rime = st.rime; e.rimeT = st.slowT; }
          if (this.mods.shatter && !e.boss && e.hp < e.maxHp * this.mods.shatter) {
            fx.spark(e.x, e.y, '#bff4ff', 6); fx.sound('shatter');
            this.hit(e, e.hp + e.shield + 999, s, 999, 1, true);
          }
        }
        s.cd = 1 / st.rate; s.pulse = 0.45;
        fx.ring(sx, sy, st.range, '#8fe3ff'); fx.sound('bell');
        continue;
      }
      const needAir = st.air ? 1 : 0;
      const n = this.query(sx, sy, st.range, needAir, 1, true);
      if (!n) { s.cd = 0.08; continue; }
      let cand = n;
      if (st.min) { // mortar minimum range filter (compact qbuf)
        let m = 0; const mn2 = st.min * st.min;
        for (let k = 0; k < n; k++) { const e = this.qbuf[k], dx = e.x - sx, dy = e.y - sy; if (dx * dx + dy * dy >= mn2) this.qbuf[m++] = e; }
        cand = m;
        if (!cand) { s.cd = 0.1; continue; }
      }
      const tgt = this.pickTarget(s, cand);
      if (!tgt) { s.cd = 0.1; continue; }
      s.aim = Math.atan2(tgt.y - sy, tgt.x - sx);
      s.cd = 1 / st.rate; s.pulse = 0.15;
      if (mode === 'arrow') { this.fire('arrow', s, tgt, st.dmg, 13, st); fx.sound(s.br === 1 ? 'siege' : 'arrow'); }
      else if (mode === 'harpoon') { this.fire('harpoon', s, tgt, st.dmg, 10, st); fx.sound('harpoon'); }
      else if (mode === 'bomb') { this.lob(s, tgt.x, tgt.y, st, false, st.dmg); fx.sound('mortar'); }
      else if (mode === 'chain') this.zap(s, tgt, st);
      else if (mode === 'beam') {
        this.hit(tgt, st.dmg, s, 0, 1, false);
        fx.beam(sx, sy - 0.25, tgt.x, tgt.y, s.br === 1 ? '#fff0a0' : '#ffe27a');
        if (s.br !== 1 || Math.random() < 0.3) fx.sound('beam');
      }
    }
  };
  R.mendAround = function (s, st, dt) {
    for (const o of this.structs) {
      if (!o || o.hp >= o.maxHp) continue;
      const dx = o.x - s.x, dy = o.y - s.y;
      if (dx * dx + dy * dy > st.range * st.range) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * st.mend * dt);
    }
  };
  R.zap = function (s, first, st) {
    const fx = this.fx;
    this.hitGen++;
    let e = first, px = s.x + 0.5, py = s.y + 0.1, dmg = st.dmg;
    for (let c = 0; c < st.chains && e; c++) {
      this.hitMark[e.idx] = this.hitGen;
      fx.bolt(px, py, e.x, e.y, s.br === 1 ? '#c6a4ff' : '#9fd0ff');
      px = e.x; py = e.y;
      const ex = e.x, ey = e.y;
      this.hit(e, dmg, s, 0, st.shieldMul, false);
      if (st.stun && e.active && !e.boss) e.stunT = Math.max(e.stunT, st.stun);
      dmg *= st.falloff;
      // next: nearest unhit visible enemy within 1.7
      const n = this.query(ex, ey, 1.7, 1, 1, true);
      let nb = null, nd = 1e9;
      for (let k = 0; k < n; k++) {
        const o = this.qbuf[k];
        if (this.hitMark[o.idx] === this.hitGen) continue;
        const dx = o.x - ex, dy = o.y - ey, d2 = dx * dx + dy * dy;
        if (d2 < nd) { nd = d2; nb = o; }
      }
      e = nb;
    }
    fx.sound('zap');
  };
  R.getProj = function () {
    for (let k = 0; k < MAXP; k++) if (!this.projs[k].active) return this.projs[k];
    return null;
  };
  R.fire = function (kind, s, tgt, dmg, spd, st) {
    const p = this.getProj(); if (!p) return;
    p.active = true; p.kind = kind; p.x = s.x + 0.5; p.y = s.y + 0.3; p.target = tgt; p.tuid = tgt.uid;
    p.tx = tgt.x; p.ty = tgt.y; p.spd = spd; p.src = s; p.dmg = dmg; p.st = st; p.t = 0; p.small = s.br === 0 && s.type === 'ballista' && s.tier === 2;
    p.ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  };
  R.lob = function (s, tx, ty, st, small, dmg, fromX, fromY) {
    const p = this.getProj(); if (!p) return;
    p.active = true; p.kind = 'bomb'; p.small = !!small; p.src = s; p.st = st; p.dmg = dmg;
    p.x0 = fromX !== undefined ? fromX : s.x + 0.5; p.y0 = fromY !== undefined ? fromY : s.y + 0.3;
    p.tx = tx; p.ty = ty; p.x = p.x0; p.y = p.y0; p.t = 0;
    const dd = Math.hypot(tx - p.x0, ty - p.y0);
    p.T = small ? 0.35 + dd * 0.05 : 0.55 + dd * 0.09; p.z = 0;
  };
  R.updateProjs = function (dt) {
    const fx = this.fx;
    for (let k = 0; k < MAXP; k++) {
      const p = this.projs[k];
      if (!p.active) continue;
      if (p.kind === 'bomb') {
        p.t += dt;
        const u = Math.min(1, p.t / p.T);
        p.x = p.x0 + (p.tx - p.x0) * u; p.y = p.y0 + (p.ty - p.y0) * u;
        p.z = Math.sin(Math.PI * u) * (p.small ? 0.5 : 1.3 + p.T * 0.6);
        if (u >= 1) { p.active = false; this.explode(p); }
        continue;
      }
      const e = p.target;
      if (e && e.active && e.uid === p.tuid && !e.burrowed) { p.tx = e.x; p.ty = e.y; }
      else p.target = null;
      const dx = p.tx - p.x, dy = p.ty - p.y, dd = Math.sqrt(dx * dx + dy * dy);
      const step = p.spd * dt;
      p.ang = Math.atan2(dy, dx);
      if (dd <= step + 0.12) {
        p.active = false;
        if (p.target) this.projHit(p, p.target);
        continue;
      }
      p.x += dx / dd * step; p.y += dy / dd * step;
      p.t += dt; if (p.t > 3) p.active = false;
    }
  };
  R.projHit = function (p, e) {
    const st = p.st, s = p.src, fx = this.fx;
    if (p.kind === 'arrow') {
      this.hit(e, p.dmg, s, st.pierce || 0, 1, false);
      fx.spark(e.x, e.y, '#ffe0a8', 3); fx.sound('hit');
      return;
    }
    // harpoon
    let dmg = p.dmg * (e.boss && st.boss ? st.boss : 1);
    this.hit(e, dmg, s, 0, 1, false);
    fx.spark(e.x, e.y, '#d6fff2', 4); fx.sound('hit');
    if (!e.active) return;
    if (!e.boss) {
      const sx = s.x + 0.5, sy = s.y + 0.5, dx = sx - e.x, dy = sy - e.y, dd = Math.hypot(dx, dy) || 1;
      const pull = Math.min(st.pull, Math.max(0, dd - 0.6));
      e.pullT = 0.22; e.pvx = dx / dd * pull / 0.22; e.pvy = dy / dd * pull / 0.22;
      if (e.fly) e.stunT = Math.max(e.stunT, 0.9);
    }
    if (st.root) {
      const n = this.query(e.x, e.y, st.netR, 1, 1, false);
      let c = 0;
      for (let k = 0; k < n && c < st.netN; k++) { const o = this.qbuf[k]; if (!o.boss) { o.rootT = st.root; c++; } }
      fx.ring(e.x, e.y, st.netR, '#5fd3b0');
    }
  };
  R.explode = function (p) {
    const st = p.st, s = p.src, fx = this.fx;
    const r = p.small ? 0.6 : st.splash;
    const n = this.query(p.tx, p.ty, r, 0, 1, false);
    for (let k = 0; k < n; k++) this.hit(this.qbuf[k], p.dmg, s, 0, 1, false);
    fx.ring(p.tx, p.ty, r, p.small ? '#ffcf8a' : '#ffb067'); fx.spark(p.tx, p.ty, '#ffcf6a', p.small ? 3 : 7);
    fx.puff(p.tx, p.ty, '#5a5560', p.small ? 0.4 : 0.8);
    fx.sound(p.small ? 'pop' : 'boom');
    if (!p.small) {
      fx.shake(0.08);
      if (st.bomblets) for (let b = 0; b < st.bomblets; b++) {
        const a = Math.random() * 6.283, d = 0.5 + Math.random() * 0.7;
        this.lob(s, p.tx + Math.cos(a) * d, p.ty + Math.sin(a) * d, st, true, st.bombletDmg, p.tx, p.ty);
      }
      if (st.tar) {
        for (const t of this.tars) if (!t.active) {
          t.active = true; t.x = p.tx; t.y = p.ty; t.r = st.splash; t.t = st.tar; t.slow = st.tarSlow; t.dps = st.tarDps; t.src = s; break;
        }
      }
    }
  };
  R.updateTars = function (dt) {
    for (const t of this.tars) {
      if (!t.active) continue;
      t.t -= dt;
      if (t.t <= 0) { t.active = false; continue; }
      const n = this.query(t.x, t.y, t.r, 0, 1, false);
      for (let k = 0; k < n; k++) {
        const e = this.qbuf[k];
        e.tarSlow = Math.max(e.tarSlow, e.boss ? t.slow * 0.5 : t.slow);
        e.hp -= t.dps * dt;
        if (t.src) t.src.dmg += t.dps * dt;
        if (e.hp <= 0) this.kill(e, t.src);
      }
    }
  };
  R.updateCoreBeam = function (dt) {
    if (this.beamFlash > 0) this.beamFlash -= dt;
    this.beamCd -= dt;
    if (this.beamCd > 0) return;
    const r = TW.CORE_RANGE + this.mods.beamRange;
    const n = this.query(this.cx, this.cy, r, 1, 1, true);
    if (!n) { this.beamCd = 0.1; return; }
    const dmg = (5 + this.night * 0.9) * this.mods.beam;
    // nearest targets
    for (let b = 0; b < this.mods.beams; b++) {
      let best = null, bd = 1e9;
      for (let k = 0; k < n; k++) {
        const e = this.qbuf[k];
        if (!e.active) continue;
        const d2 = (e.x - this.cx) ** 2 + (e.y - this.cy) ** 2 + (b && k === 0 ? 0.01 : 0);
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (!best) break;
      this.beamAim = Math.atan2(best.y - this.cy, best.x - this.cx);
      this.fx.beam(this.cx, this.cy - 0.9, best.x, best.y, '#fff3c0');
      this.hit(best, dmg, null, 0, 1, false);
      this.stats.dmgBy.core = (this.stats.dmgBy.core || 0) + dmg;
    }
    this.beamFlash = 0.15;
    this.beamCd = 0.8;
    this.fx.sound('beam');
  };

  // ---------------- night end / dawn ----------------
  R.endNight = function () {
    this.phase = 'dawn';
    for (const p of this.projs) p.active = false;
    for (const t of this.tars) t.active = false;
    this.stats.nightsCleared = this.night;
    const n = this.night;
    const rep = { night: n, g: 0, w: 0, s: 0, c: 0, heal: 0, kills: this.nightKills, leaks: this.nightLeaks, killGold: this.nightGold, rebuilt: 0 };
    rep.g += 25 + 6 * n;
    if (this.mods.interest) rep.g += Math.min(60, Math.floor(this.res.g * this.mods.interest));
    for (const s of this.structs) {
      if (!s) continue;
      if (s.kind === 'harv') { const y = this.harvYield(s.i); rep.w += y.w; rep.s += y.s; rep.c += y.c; }
      s.hp = s.maxHp;
    }
    if (this.mods.rebuild) {
      for (const lw of this.lostWalls) {
        if (!this.cellFree(lw.i)) continue;
        const s = this.addStruct('wall', lw.i, { stone: lw.stone });
        s.spent = lw.spent; this.refreshHp(s, true); rep.rebuilt++;
      }
      this.recalc();
    }
    if (this.mods.dawnHeal) { rep.heal = Math.min(this.maxHp - this.hp, this.mods.dawnHeal); this.hp += rep.heal; }
    this.res.g += rep.g; this.res.w += rep.w; this.res.s += rep.s; this.res.c += rep.c;
    this.dawn = rep;
    if (n >= TW.NIGHTS) { this.phase = 'over'; this.result = 'win'; this.fx.event('win'); return; }
    this.rollOffers();
    this.phase = 'boon';
    this.fx.event('dawn', rep);
  };
  R.rollOffers = function () {
    const rr = C.rng(C.hash(this.seed, this.night * 131 + 7));
    const built = {};
    for (const s of this.structs) if (s && s.kind === 'tower') built[s.type] = (built[s.type] || 0) + 1;
    this.offers = C.rollBoons(rr, this.boons, this.mods.boonChoices, this.night, this.unlocked, built);
  };
  R.pickBoon = function (k) {
    if (this.phase !== 'boon') return false;
    const id = this.offers[k];
    const b = TW.BOONS.find((x) => x.id === id);
    if (b) {
      b.apply(this); this.boons[id] = (this.boons[id] || 0) + 1;
      // walls/towers may have new max hp
      for (const s of this.structs) if (s) this.refreshHp(s, true);
      this.dirty = true;
    }
    this.offers = [];
    this.night++;
    this.phase = 'day';
    this.actions = this.actionsMax();
    this.dirty = true; this.recalc();
    return true;
  };
  R.lose = function () {
    this.phase = 'over'; this.result = 'lose';
    this.fx.event('lose');
  };
  R.pearls = function () {
    const st = this.stats;
    return st.nightsCleared * 2 + st.bossKills * 8 + (this.result === 'win' ? 30 : 0);
  };

  // ---------------- save / restore (day & boon phases only) ----------------
  R.serialize = function () {
    if (this.phase !== 'day' && this.phase !== 'boon') return null;
    const structs = [];
    for (const s of this.structs) if (s) structs.push([s.kind, s.i, s.kind === 'wall' ? (s.stone ? 1 : 0) : s.type, s.tier, s.br, s.prio, s.spent, s.dmg | 0, s.kills]);
    return {
      v: 1, seed: this.seed, mapSeed: this.mapSeed, cmd: this.cmd, night: this.night, phase: this.phase, res: this.res, hp: this.hp,
      maxHp: this.maxHp, actions: this.actions, mods: this.mods, boons: this.boons, offers: this.offers, stats: this.stats,
      unlocked: this.unlocked, structs, dawn: this.dawn,
    };
  };
  Run.restore = function (o, fx) {
    if (!o || o.v !== 1) return null;
    const r = new Run({ seed: o.seed, mapSeed: o.mapSeed, cmd: o.cmd, unlocked: o.unlocked, fx, restore: true });
    r.night = o.night | 0 || 1; r.phase = o.phase === 'boon' ? 'boon' : 'day';
    Object.assign(r.res, o.res); r.hp = o.hp; r.maxHp = o.maxHp; r.actions = o.actions;
    const dm = defaultMods();
    r.mods = Object.assign(dm, o.mods || {}); r.mods.dmg = Object.assign(defaultMods().dmg, (o.mods && o.mods.dmg) || {});
    r.boons = o.boons || {}; r.offers = o.offers || []; r.stats = Object.assign(r.stats, o.stats || {}); r.dawn = o.dawn || null;
    if (!r.stats.dmgBy) r.stats.dmgBy = {};
    for (const a of o.structs || []) {
      const [kind, i, x, tier, br, prio, spent, dmg, kills] = a;
      if (i < 0 || i >= N || r.occ[i] >= 0 || !C.buildable(r.terr[i])) continue;
      const s = r.addStruct(kind, i, kind === 'wall' ? { stone: !!x } : (kind === 'tower' ? { type: x, tier: tier | 0, br: br } : {}));
      if (kind === 'tower' && !TW.TOWERS[x]) { r.removeStruct(s); continue; }
      s.prio = prio || 'first'; s.spent = spent || {}; s.dmg = dmg || 0; s.kills = kills || 0;
      r.refreshHp(s, true);
    }
    if (r.phase === 'boon' && !r.offers.length) r.rollOffers();
    r.dirty = true; r.recalc();
    return r;
  };

  TW.Sim = { MAXE, MAXP, PREVIEW_ID, defaultMods };
})(typeof window !== 'undefined' ? (window.TW = window.TW || {}) : (globalThis.TW = globalThis.TW || {}));
