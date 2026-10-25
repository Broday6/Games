'use strict';
// EMBER DECK — enemies, elites, bosses and the encounter tables.
// Move fields: dmg, hits, block, blockAll, buff{st:n} (self), buffAll, debuff{st:n} (on you), add[card,n,pile], summon[keys], heal, fn(G,e), die.
(function (root) {
  const ED = root.ED;
  const EN = ED.ENEMIES = {};
  function en(k, o) { o.k = k; EN[k] = o; }

  function rep(e, k, n) { // was move k used in each of the last n turns?
    if (e.hist.length < n) return false;
    for (let i = 1; i <= n; i++) if (e.hist[e.hist.length - i] !== k) return false;
    return true;
  }
  function wpick(G, e, opts, maxRep) {
    const pool = opts.filter((o) => !rep(e, o[0], maxRep || 2));
    const use = pool.length ? pool : opts;
    let tot = 0; for (const o of use) tot += o[1];
    let r = G.random() * tot;
    for (const o of use) { r -= o[1]; if (r < 0) return o[0]; }
    return use[use.length - 1][0];
  }
  const cycle = (e, arr, off) => arr[(e.hist.length + (off || 0)) % arr.length];
  ED.AI = { rep, wpick, cycle };

  // ================= ACT 1 — The Wreck Coast =================
  en('slime_s', { n: 'Brine Slimeling', act: 1, hp: [12, 15], art: 'slime', size: 0.62, col: '#6fd38a',
    moves: { tackle: { n: 'Tackle', dmg: 5 }, lick: { n: 'Lick', debuff: { weak: 1 } } },
    ai(G, e) { return wpick(G, e, [['tackle', 60], ['lick', 40]], 1); } });
  en('slime_l', { n: 'Brine Slime', act: 1, hp: [52, 56], art: 'slime', size: 1.1, col: '#56c27a',
    init(G, e) { e.st.split = 1; },
    moves: { slam: { n: 'Slam', dmg: 12 }, spit: { n: 'Spit', dmg: 7, add: ['slime', 2, 'disc'] }, lick: { n: 'Lick', debuff: { weak: 2 } },
      split: { n: 'Split', intent: 'split', fn(G, e) { const hp = e.hp; G.spawn('slime_s', { hp }); G.spawn('slime_s', { hp }); G.kill(e, true); } } },
    ai(G, e) { return wpick(G, e, [['slam', 35], ['spit', 40], ['lick', 25]], 1); } });
  en('crab', { n: 'Shore Crab', act: 1, hp: [38, 42], art: 'crab', size: 0.9, col: '#e0704a',
    init(G, e) { e.st.curl = 7; },
    moves: { pinch: { n: 'Pinch', dmg: 8 }, snap: { n: 'Snap', dmg: 4, hits: 2 }, harden: { n: 'Harden', block: 8, buff: { str: 1 } } },
    ai(G, e) { return wpick(G, e, [['pinch', 40], ['snap', 35], ['harden', 25]], 1); } });
  en('cutthroat', { n: 'Cutthroat', act: 1, hp: [44, 48], art: 'pirate', size: 1, col: '#c94f4f',
    moves: { jab: { n: 'Jab', dmg: 6, debuff: { vuln: 1 } }, slash: { n: 'Slash', dmg: 11 }, ready: { n: 'Ready Up', block: 6, buff: { str: 2 } } },
    ai(G, e) { if (!e.hist.length) return 'jab'; return wpick(G, e, [['slash', 50], ['ready', 25], ['jab', 25]], 1); } });
  en('sailor', { n: 'Drowned Sailor', act: 1, hp: [46, 52], art: 'drowned', size: 1, col: '#5aa3a0',
    moves: { moan: { n: 'Mournful Moan', buff: { rage: 3 } }, claw: { n: 'Claw', dmg: 6 } },
    ai(G, e) { return e.hist.length ? 'claw' : 'moan'; } });
  en('jelly', { n: 'Glass Jellyfish', act: 1, hp: [20, 24], art: 'jelly', size: 0.75, col: '#c59cff',
    moves: { sting: { n: 'Sting', dmg: 3, debuff: { poison: 2 } }, zap: { n: 'Zap', dmg: 7 }, drift: { n: 'Drift', block: 6 } },
    ai(G, e) { return wpick(G, e, [['sting', 40], ['zap', 40], ['drift', 20]], 1); } });
  en('gull', { n: 'Wreck Gull', act: 1, hp: [12, 15], art: 'gull', size: 0.66, col: '#d8dee9',
    moves: { peck: { n: 'Peck', dmg: 2, hits: 2 }, dive: { n: 'Dive', dmg: 5 }, screech: { n: 'Screech', debuff: { frail: 1 } } },
    ai(G, e) { return wpick(G, e, [['peck', 45], ['dive', 35], ['screech', 20]], 1); } });
  // minion
  en('deckhand', { n: 'Drowned Deckhand', act: 1, hp: [16, 18], art: 'drowned', size: 0.72, col: '#4f8f8c', minion: true,
    moves: { swab: { n: 'Swab', dmg: 5 }, grab: { n: 'Grab', dmg: 3, debuff: { weak: 1 } } },
    ai(G, e) { return wpick(G, e, [['swab', 60], ['grab', 40]], 1); } });

  // ----- Act 1 elites -----
  en('brute', { n: 'Reef Brute', act: 1, elite: true, hp: [82, 86], art: 'brute', size: 1.25, col: '#3f8f7a',
    moves: { bellow: { n: 'Bellow', buff: { enrage: 2 } }, bash: { n: 'Skull Bash', dmg: 6, debuff: { vuln: 2 } }, rush: { n: 'Rush', dmg: 14 } },
    ai(G, e) { if (!e.hist.length) return 'bellow'; return wpick(G, e, [['rush', 62], ['bash', 38]], 2); } });
  en('totem', { n: 'Tide Totem', act: 1, elite: true, hp: [38, 42], art: 'totem', size: 0.85, col: '#7aa5c9',
    init(G, e, i) { e.st.artifact = 1; e.d.off = i % 2; },
    moves: { beam: { n: 'Tide Beam', dmg: 9 }, hex: { n: 'Hex', add: ['dazed', 2, 'disc'] } },
    ai(G, e) { return cycle(e, ['hex', 'beam'], e.d.off); } });

  // ----- Act 1 boss -----
  en('captain', { n: 'The Drowned Captain', act: 1, boss: true, hp: [200, 200], art: 'captain', size: 1.45, col: '#2f6f8a',
    moves: {
      cutlass: { n: 'Cutlass', dmg: 14 }, broadside: { n: 'Broadside', dmg: 5, hits: 3 }, rally: { n: 'Rally', block: 8, buff: { str: 2 } },
      hoist: { n: 'Hoist Anchor', block: 16 },
      anchorslam: { n: 'Anchor Slam', dmg: 22 }, callcrew: { n: 'Call the Crew', summon: ['deckhand'], block: 8 }, volley: { n: 'Pistol Volley', dmg: 4, hits: 4 },
    },
    phases: [{ at: 0.5, text: 'The Captain hoists his anchor!', enter(G, e) { e.d.p2 = 0; } }],
    ai(G, e) {
      if (e.ph >= 1) {
        const n = e.d.p2++;
        if (n === 0) return 'hoist';
        const crew = G.enemies().filter((x) => x.k === 'deckhand').length;
        const seq = ['anchorslam', crew < 2 ? 'callcrew' : 'volley', 'volley'];
        return seq[(n - 1) % 3];
      }
      return cycle(e, ['cutlass', 'broadside', 'rally']);
    } });

  // ================= ACT 2 — The Sunken Grotto =================
  en('kelp', { n: 'Kelp Horror', act: 2, hp: [58, 62], art: 'kelp', size: 1.1, col: '#4f9a52',
    moves: { grasp: { n: 'Grasp', dmg: 10, debuff: { weak: 1 } }, bind: { n: 'Bind', block: 8, debuff: { frail: 2 } }, lash: { n: 'Lash', dmg: 4, hits: 3 } },
    ai(G, e) { return wpick(G, e, [['grasp', 40], ['lash', 35], ['bind', 25]], 1); } });
  en('lantern', { n: 'Spore Lantern', act: 2, hp: [36, 40], art: 'lantern', size: 0.8, col: '#c7f07a',
    init(G, e) { e.st.spores = 2; },
    moves: { glow: { n: 'Glow', buffAll: { str: 2 } }, zap: { n: 'Zap', dmg: 9 } },
    ai(G, e) { return cycle(e, ['zap', 'glow', 'zap']); } });
  en('golem', { n: 'Coral Golem', act: 2, hp: [72, 78], art: 'golem', size: 1.2, col: '#ff8f8f',
    init(G, e) { e.st.plating = 4; },
    moves: { slam: { n: 'Slam', dmg: 16 }, harden: { n: 'Calcify', block: 12, buff: { plating: 2 } }, quake: { n: 'Quake', dmg: 8, debuff: { frail: 1 } } },
    ai(G, e) { return wpick(G, e, [['slam', 40], ['quake', 35], ['harden', 25]], 1); } });
  en('siren', { n: 'Grotto Siren', act: 2, hp: [52, 56], art: 'siren', size: 1, col: '#7fd6e0',
    moves: { song: { n: 'Lullaby', add: ['dazed', 2, 'draw'], debuff: { weak: 1 } }, strike: { n: 'Talon', dmg: 12 }, lure: { n: 'Lure', dmg: 6, debuff: { vuln: 2 } } },
    ai(G, e) { if (!e.hist.length) return 'song'; return wpick(G, e, [['strike', 45], ['lure', 35], ['song', 20]], 1); } });
  en('bloat', { n: 'Bloatfish', act: 2, hp: [28, 32], art: 'bloat', size: 0.8, col: '#f0c75a',
    init(G, e) { e.st.thorns = 2; },
    moves: { puff: { n: 'Puff Up', dmg: 5, block: 4 }, burst: { n: 'Burst', dmg: 16, die: true } },
    ai(G, e) { return e.hist.length >= 2 ? 'burst' : 'puff'; } });
  en('ghoul', { n: 'Grotto Ghoul', act: 2, hp: [46, 50], art: 'ghoul', size: 1, col: '#9aa58c',
    moves: { gnaw: { n: 'Gnaw', dmg: 10, heal: 6 }, frenzy: { n: 'Frenzy', dmg: 3, hits: 4 }, howl: { n: 'Howl', buff: { str: 2 }, debuff: { weak: 1 } } },
    ai(G, e) { return wpick(G, e, [['gnaw', 40], ['frenzy', 40], ['howl', 20]], 1); } });
  en('polyp', { n: 'Polyp', act: 2, hp: [14, 16], art: 'polyp', size: 0.6, col: '#ff9ad5', minion: true,
    moves: { sting: { n: 'Sting', dmg: 6 }, spit: { n: 'Spit', debuff: { poison: 3 } } },
    ai(G, e) { return wpick(G, e, [['sting', 60], ['spit', 40]], 1); } });
  en('tentacle', { n: 'Tentacle', act: 2, hp: [18, 20], art: 'tentacle', size: 0.85, col: '#b65ba0', minion: true,
    moves: { grab: { n: 'Grab', dmg: 7 }, squeeze: { n: 'Squeeze', dmg: 4, debuff: { weak: 1 } } },
    ai(G, e) { return wpick(G, e, [['grab', 60], ['squeeze', 40]], 1); } });

  en('matron', { n: 'Lagoon Matron', act: 2, elite: true, hp: [140, 150], art: 'matron', size: 1.3, col: '#ff7ac8',
    init(G, e) { G.spawn('polyp'); G.spawn('polyp'); },
    moves: { brood: { n: 'Brood', summon: ['polyp', 'polyp'], block: 10 }, lash: { n: 'Lash', dmg: 9, hits: 2 }, smother: { n: 'Smother', block: 14, debuff: { weak: 2 } } },
    ai(G, e) {
      const kids = G.enemies().filter((x) => x.k === 'polyp').length;
      if (kids === 0 && !rep(e, 'brood', 1)) return 'brood';
      return wpick(G, e, [['lash', 60], ['smother', 40]], 1);
    } });

  en('kraken', { n: 'The Kraken', act: 2, boss: true, hp: [240, 240], art: 'kraken', size: 1.5, col: '#a04f9a',
    init(G, e) { G.spawn('tentacle'); G.spawn('tentacle'); },
    moves: {
      ink: { n: 'Ink Cloud', block: 12, debuff: { weak: 2, frail: 2 } }, crush: { n: 'Crush', dmg: 18 },
      regrow: { n: 'Regrow', summon: ['tentacle'], block: 10 },
      roar: { n: 'Deep Roar', intent: 'buff', buff: { str: 2, rage: 1 }, fn(G, e) { G.cleanse(e); } },
      maelstrom: { n: 'Maelstrom', dmg: 5, hits: 4 },
    },
    phases: [{ at: 0.5, text: 'The Kraken roars from the deep!', enter(G, e) { e.d.p2 = 0; } }],
    ai(G, e) {
      const ten = G.enemies().filter((x) => x.k === 'tentacle').length;
      if (e.ph >= 1) { const n = e.d.p2++; if (n === 0) return 'roar'; return ['maelstrom', ten < 2 ? 'regrow' : 'crush', 'ink'][(n - 1) % 3]; }
      if (ten < 2 && !rep(e, 'regrow', 1) && e.hist.length > 0 && G.random() < 0.6) return 'regrow';
      return cycle(e, ['ink', 'crush', 'crush']);
    } });

  // ================= ACT 3 — The Abyss =================
  en('eye', { n: 'Abyssal Eye', act: 3, hp: [56, 60], art: 'eye', size: 1, col: '#ff5d73',
    moves: { stare: { n: 'Stare', debuff: { vuln: 2, weak: 2 } }, beam: { n: 'Beam', dmg: 18 }, focus: { n: 'Focus', block: 10, buff: { str: 3 } } },
    ai(G, e) { return cycle(e, ['stare', 'beam', 'focus', 'beam']); } });
  en('leech', { n: 'Void Leech', act: 3, hp: [44, 48], art: 'leech', size: 0.9, col: '#8a6bd9',
    moves: { drain: { n: 'Drain', dmg: 10, heal: 8 }, latch: { n: 'Latch', dmg: 4, debuff: { poison: 4, frail: 1 } } },
    ai(G, e) { return wpick(G, e, [['drain', 55], ['latch', 45]], 1); } });
  en('acolyte', { n: 'Deep Acolyte', act: 3, hp: [60, 64], art: 'acolyte', size: 1.05, col: '#5c7cfa',
    moves: { chant: { n: 'Chant', blockAll: 8, buffAll: { str: 2 } }, curse: { n: 'Curse', debuff: { weak: 2 }, add: ['wound', 1, 'disc'] }, smite: { n: 'Smite', dmg: 15 } },
    ai(G, e) { return wpick(G, e, [['smite', 45], ['chant', 30], ['curse', 25]], 1); } });
  en('eel', { n: 'Shadow Eel', act: 3, hp: [36, 40], art: 'eel', size: 0.9, col: '#3fd0c0',
    moves: { bite: { n: 'Bite', dmg: 7, hits: 2 }, coil: { n: 'Coil', block: 12, buff: { str: 2 } } },
    ai(G, e) { return wpick(G, e, [['bite', 65], ['coil', 35]], 1); } });

  en('knight', { n: 'Abyssal Knight', act: 3, elite: true, hp: [210, 220], art: 'knight', size: 1.3, col: '#6a7fd0',
    moves: { warcry: { n: 'War Cry', buff: { str: 3 } }, cleave: { n: 'Cleave', dmg: 22 }, flurry: { n: 'Flurry', dmg: 7, hits: 3, debuff: { vuln: 1 } }, guard: { n: 'Guard', block: 20, buff: { plating: 4 } } },
    ai(G, e) { if (!e.hist.length) return 'warcry'; return cycle(e, ['cleave', 'flurry', 'guard'], -1); } });

  en('drowngod', { n: 'The Drowned God', act: 3, boss: true, hp: [340, 340], art: 'god', size: 1.6, col: '#ff5a2a',
    moves: {
      tidecall: { n: 'Tidecall', block: 20, add: ['wound', 2, 'draw'] }, crush: { n: 'Crushing Depth', dmg: 24 }, gaze: { n: 'Dread Gaze', debuff: { vuln: 2, weak: 2 } },
      undertow: { n: 'Undertow', dmg: 12, hits: 2 }, drown: { n: 'Drown', dmg: 18, debuff: { frail: 2 } }, ward: { n: 'Abyssal Ward', block: 30 },
      annihilate: { n: 'Annihilate', dmg: 8, hits: 4 }, devour: { n: 'Devour', dmg: 26, heal: 15 },
    },
    phases: [
      { at: 0.66, text: 'The tide rises!', enter(G, e) { G.cleanse(e); G.apply(e, 'plating', 8, { src: 'e' }); e.d.p = 0; } },
      { at: 0.33, text: 'The Drowned God awakens in fury!', enter(G, e) { delete e.st.plating; G.cleanse(e); G.apply(e, 'rage', 2, { src: 'e' }); e.d.p = 0; } },
    ],
    ai(G, e) {
      if (e.ph === 2) return ['annihilate', 'devour'][(e.d.p++) % 2];
      if (e.ph === 1) return ['undertow', 'drown', 'ward'][(e.d.p++) % 3];
      return cycle(e, ['gaze', 'crush', 'tidecall']);
    } });

  // ================= encounter tables =================
  ED.ENCOUNTERS = {
    1: {
      weak: [['slime_s', 'slime_s'], ['sailor'], ['crab'], ['jelly', 'jelly']],
      strong: [['cutthroat'], ['slime_l'], ['gull', 'gull', 'gull'], ['cutthroat', 'slime_s'], ['crab', 'jelly'], ['sailor', 'gull'], ['jelly', 'jelly', 'slime_s']],
      elite: [['brute'], ['totem', 'totem', 'totem']],
      boss: ['captain'],
    },
    2: {
      weak: [['kelp'], ['lantern', 'lantern'], ['siren'], ['ghoul', 'bloat']],
      strong: [['golem'], ['kelp', 'lantern'], ['siren', 'ghoul'], ['bloat', 'lantern'], ['golem', 'bloat'], ['ghoul', 'ghoul']],
      elite: [['matron'], ['totem', 'totem', 'totem'], ['brute']],
      boss: ['kraken'],
    },
    3: {
      weak: [['eye'], ['eel', 'eel'], ['leech', 'leech']],
      strong: [['acolyte', 'eel'], ['eye', 'leech'], ['acolyte', 'acolyte'], ['eel', 'eel', 'leech'], ['eye', 'acolyte'], ['eye', 'eel']],
      elite: [['knight'], ['matron'], ['brute']],
      boss: ['drowngod'],
    },
  };
  ED.ACT_NAMES = { 1: 'The Wreck Coast', 2: 'The Sunken Grotto', 3: 'The Abyss' };
})(typeof window !== 'undefined' ? window : globalThis);
