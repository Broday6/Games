'use strict';
// TIDEWALL — static game data: terrain, towers, enemies, bosses, boons, commanders, meta perks.
(function (TW) {
  TW.W = 11; // grid columns
  TW.H = 17; // grid rows
  TW.NIGHTS = 20;

  // terrain codes
  TW.T = { GRASS: 0, SAND: 1, WATER: 2, ROCK: 3, TREE: 4, STONE: 5, CRYSTAL: 6, CORE: 7 };
  TW.NODE_RES = { 4: 'w', 5: 's', 6: 'c' };

  TW.RES = [
    { id: 'g', name: 'Gold', color: '#ffcf4a' },
    { id: 'w', name: 'Wood', color: '#d79a5a' },
    { id: 's', name: 'Stone', color: '#b8c2d6' },
    { id: 'c', name: 'Crystal', color: '#9b8cff' },
  ];

  TW.RARITY = {
    common: { name: 'Common', color: '#cfd6e6', w: 60 },
    rare: { name: 'Rare', color: '#4fd8e8', w: 28 },
    epic: { name: 'Epic', color: '#c18bff', w: 10 },
    legendary: { name: 'Legendary', color: '#ffcf4a', w: 2.5 },
  };

  // ---------------- structures ----------------
  TW.WALL = {
    wood: { name: 'Palisade', hp: 90, cost: { w: 2 } },
    stone: { name: 'Stone Wall', hp: 300, cost: { s: 3 } }, // upgrade cost from palisade
  };
  TW.HARVESTER = { name: 'Harvester', hp: 120, cost: { g: 35, w: 4 }, yieldPer: { w: 3, s: 3, c: 1 } };
  TW.CORE_RANGE = 2.6;
  TW.SELL_REFUND = 0.7;
  TW.GATHER = { w: 2, s: 2, c: 1 };

  // Path cost tuning: enemies take a detour up to roughly this many extra tiles before breaking a wall.
  TW.PATH = {
    wallPen: 18, towerPen: 34, hpDiv: 9,        // ordinary walkers
    bWallPen: 1.5, bTowerPen: 6, bHpDiv: 70,    // wall-breakers love smashing
  };

  // Tower stat keys: range, rate (attacks/s), dmg, air (can hit flyers), ground, splash, min (min range),
  // burn (dps), burnT, slow, slowT, chains, falloff, shieldMul, pierce, pull, root, reveal, aura, freeze, vuln...
  TW.TOWER_IDS = ['ballista', 'brazier', 'frost', 'mortar', 'lantern', 'tesla', 'harpoon', 'shrine'];
  TW.TOWERS = {
    ballista: {
      name: 'Ballista', color: '#e6b271', accent: '#ffd9a0', mode: 'arrow', hp: 160,
      blurb: 'Fast bolts at one target. Hits flyers.',
      tiers: [
        { cost: { g: 40, w: 2 }, range: 3.0, rate: 1.15, dmg: 11, air: 1 },
        { cost: { g: 55, s: 2 }, range: 3.3, rate: 1.35, dmg: 19, air: 1 },
      ],
      branches: [
        { id: 'repeater', name: 'Repeater', blurb: 'A rattling stream of bolts.', cost: { g: 95, c: 2 }, range: 3.5, rate: 3.6, dmg: 16, air: 1 },
        { id: 'siege', name: 'Siege Bow', blurb: 'Huge armor-piercing spears, long range.', cost: { g: 95, c: 2 }, range: 4.6, rate: 0.6, dmg: 92, pierce: 10, air: 1 },
      ],
    },
    brazier: {
      name: 'Brazier', color: '#ff8a3d', accent: '#ffd36b', mode: 'flame', hp: 160,
      blurb: 'Flame bursts burn every walker around it.',
      tiers: [
        { cost: { g: 50, w: 3 }, range: 1.5, rate: 1.3, dmg: 4, burn: 6, burnT: 2 },
        { cost: { g: 60, s: 3 }, range: 1.7, rate: 1.4, dmg: 6, burn: 11, burnT: 2 },
      ],
      branches: [
        { id: 'inferno', name: 'Inferno', blurb: 'Burns stack up to 3 times.', cost: { g: 105, c: 2 }, range: 1.8, rate: 1.5, dmg: 7, burn: 13, burnT: 2.5, stack: 3 },
        { id: 'blueflame', name: 'Blue Flame', blurb: 'Melts armor and ignores shields.', cost: { g: 105, c: 2 }, range: 1.8, rate: 1.5, dmg: 12, burn: 14, burnT: 2, melt: 5, noShield: 1 },
      ],
    },
    frost: {
      name: 'Frost Bell', color: '#8fe3ff', accent: '#e4fbff', mode: 'pulse', hp: 160,
      blurb: 'Tolls a chilling pulse that slows all around.',
      tiers: [
        { cost: { g: 45, s: 2 }, range: 1.9, rate: 0.7, dmg: 3, slow: 0.35, slowT: 1.7, air: 1 },
        { cost: { g: 55, s: 3 }, range: 2.2, rate: 0.75, dmg: 6, slow: 0.45, slowT: 1.8, air: 1 },
      ],
      branches: [
        { id: 'glacier', name: 'Glacier Bell', blurb: 'Pulses can freeze enemies solid.', cost: { g: 95, c: 3 }, range: 2.4, rate: 0.8, dmg: 8, slow: 0.5, slowT: 2, freeze: 0.2, freezeT: 1.2, air: 1 },
        { id: 'rime', name: 'Rime Bell', blurb: 'Chilled enemies take +25% damage.', cost: { g: 95, c: 3 }, range: 2.5, rate: 0.8, dmg: 8, slow: 0.5, slowT: 2, rime: 0.25, air: 1 },
      ],
    },
    mortar: {
      name: 'Mortar', color: '#9aa4b8', accent: '#e8ecf6', mode: 'bomb', hp: 180,
      blurb: 'Lobbed shells splash groups. Ground only.',
      tiers: [
        { cost: { g: 65, s: 4 }, range: 4.4, min: 1.3, rate: 0.42, dmg: 26, splash: 0.95 },
        { cost: { g: 75, s: 4 }, range: 4.8, min: 1.3, rate: 0.45, dmg: 44, splash: 1.05 },
      ],
      branches: [
        { id: 'cluster', name: 'Cluster Mortar', blurb: 'Shells burst into 4 bomblets.', cost: { g: 120, c: 3 }, range: 5.0, min: 1.3, rate: 0.48, dmg: 52, splash: 1.05, bomblets: 4, bombletDmg: 20 },
        { id: 'tar', name: 'Tar Mortar', blurb: 'Leaves burning tar that slows.', cost: { g: 120, c: 3 }, range: 5.0, min: 1.3, rate: 0.48, dmg: 50, splash: 1.1, tar: 3, tarSlow: 0.4, tarDps: 12 },
      ],
    },
    lantern: {
      name: 'Lantern', color: '#ffe27a', accent: '#fff6c8', mode: 'beam', hp: 140,
      blurb: 'Reveals invisible foes and singes them.',
      tiers: [
        { cost: { g: 35, w: 2 }, range: 2.6, rate: 2, dmg: 5, air: 1, reveal: 1 },
        { cost: { g: 45, c: 1 }, range: 3.1, rate: 2, dmg: 9, air: 1, reveal: 1 },
      ],
      branches: [
        { id: 'beacon', name: 'Beacon', blurb: 'Huge light. Lit enemies take +20% damage.', cost: { g: 85, c: 2 }, range: 4.0, rate: 2, dmg: 10, air: 1, reveal: 1, mark: 0.2 },
        { id: 'searchlight', name: 'Searchlight', blurb: 'A scorching beam that melts one target.', cost: { g: 85, c: 2 }, range: 3.4, rate: 8, dmg: 9, air: 1, reveal: 1 },
      ],
    },
    tesla: {
      name: 'Tesla Coil', color: '#7ab8ff', accent: '#e0f0ff', mode: 'chain', hp: 160,
      blurb: 'Lightning chains between foes. Cracks shields.',
      tiers: [
        { cost: { g: 70, s: 2, c: 1 }, range: 2.6, rate: 0.9, dmg: 15, chains: 3, falloff: 0.82, shieldMul: 2, air: 1 },
        { cost: { g: 75, s: 2, c: 1 }, range: 2.8, rate: 0.95, dmg: 25, chains: 4, falloff: 0.82, shieldMul: 2, air: 1 },
      ],
      branches: [
        { id: 'storm', name: 'Storm Coil', blurb: 'Arcs leap through 8 enemies.', cost: { g: 125, c: 3 }, range: 3.0, rate: 1, dmg: 30, chains: 8, falloff: 0.88, shieldMul: 2, air: 1 },
        { id: 'overload', name: 'Overload', blurb: 'Shatters shields and stuns.', cost: { g: 125, c: 3 }, range: 2.9, rate: 1, dmg: 44, chains: 4, falloff: 0.85, shieldMul: 5, stun: 0.35, air: 1 },
      ],
    },
    harpoon: {
      name: 'Harpoon', color: '#5fd3b0', accent: '#d6fff2', mode: 'harpoon', hp: 170,
      blurb: 'Drags foes back. Pulls flyers out of the sky.',
      tiers: [
        { cost: { g: 55, w: 3 }, range: 3.3, rate: 0.55, dmg: 18, pull: 0.9, air: 1 },
        { cost: { g: 65, s: 3 }, range: 3.5, rate: 0.6, dmg: 32, pull: 1.2, air: 1 },
      ],
      branches: [
        { id: 'whaler', name: 'Whaler', blurb: 'Brutal harpoons. Double damage to bosses.', cost: { g: 115, c: 2 }, range: 3.8, rate: 0.6, dmg: 115, pull: 1.4, boss: 2, air: 1 },
        { id: 'net', name: 'Chain Net', blurb: 'Roots up to 5 enemies in place.', cost: { g: 115, c: 2 }, range: 3.6, rate: 0.6, dmg: 40, pull: 0.8, root: 1.5, netR: 1.2, netN: 5, air: 1 },
      ],
    },
    shrine: {
      name: 'Shrine', color: '#e98cff', accent: '#ffe0ff', mode: 'aura', hp: 150,
      blurb: 'Empowers nearby towers.',
      tiers: [
        { cost: { g: 70, s: 3, c: 2 }, range: 1.6, aura: 0.15 },
        { cost: { g: 75, s: 3, c: 2 }, range: 2.1, aura: 0.25 },
      ],
      branches: [
        { id: 'warshrine', name: 'War Shrine', blurb: '+45% damage, +12% fire rate.', cost: { g: 115, c: 3 }, range: 2.2, aura: 0.45, auraRate: 0.12 },
        { id: 'tideshrine', name: 'Tide Shrine', blurb: '+25% damage, +20% range, mends walls.', cost: { g: 115, c: 3 }, range: 2.3, aura: 0.25, auraRange: 0.2, mend: 0.03 },
      ],
    },
  };
  TW.PRIOS = ['first', 'last', 'strong', 'close'];
  TW.PRIO_NAMES = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };

  // ---------------- enemies ----------------
  // hp at night 1; spd tiles/s; sdps = damage per second vs structures; leak = lighthouse damage
  TW.ENEMY_IDS = ['shade', 'skitter', 'crab', 'gull', 'blob', 'ram', 'mender', 'wisp', 'mole', 'warden', 'brute'];
  TW.ENEMIES = {
    shade: { name: 'Shade', hp: 30, spd: 1.0, gold: 2, leak: 1, sdps: 10, r: 0.27, cost: 1, from: 1, color: '#6b5cff', desc: 'A plain shadow walker.' },
    skitter: { name: 'Skitter', hp: 13, spd: 1.75, gold: 1, leak: 1, sdps: 5, r: 0.2, cost: 0.5, from: 1, pack: 1, color: '#ff6fb1', desc: 'Fast swarmers in packs.' },
    crab: { name: 'Shellback', hp: 52, spd: 0.65, armor: 4, gold: 4, leak: 2, sdps: 12, r: 0.32, cost: 2.2, from: 3, color: '#ff7a4a', desc: 'Armored: flat damage reduction per hit.' },
    gull: { name: 'Gloom Gull', hp: 24, spd: 1.25, fly: 1, gold: 3, leak: 1, r: 0.26, cost: 1.5, from: 4, color: '#c9d4ff', desc: 'Flies straight over walls.' },
    blob: { name: 'Splitter', hp: 60, spd: 0.75, split: 'blobling', splitN: 3, gold: 3, leak: 2, sdps: 10, r: 0.33, cost: 2.4, from: 5, color: '#59e07a', desc: 'Bursts into three blobs on death.' },
    blobling: { name: 'Blobling', hp: 14, spd: 1.4, gold: 1, leak: 1, sdps: 5, r: 0.18, cost: 0, from: 99, color: '#8ff0a2', desc: '' },
    ram: { name: 'Rambreaker', hp: 72, spd: 0.8, armor: 2, breaker: 1, sdps: 55, gold: 5, leak: 2, r: 0.33, cost: 3, from: 6, color: '#d1a04a', desc: 'Smashes straight through walls.' },
    mender: { name: 'Mender', hp: 46, spd: 0.85, heal: 0.06, healR: 1.6, gold: 5, leak: 1, sdps: 8, r: 0.28, cost: 3, from: 7, color: '#7dffd8', desc: 'Heals nearby shadows.' },
    wisp: { name: 'Wisp', hp: 28, spd: 1.15, invis: 1, gold: 4, leak: 1, sdps: 8, r: 0.24, cost: 2, from: 8, color: '#b5f3ff', desc: 'Invisible unless lit by a Lantern.' },
    mole: { name: 'Burrower', hp: 50, spd: 1.0, burrow: 1, gold: 5, leak: 2, sdps: 10, r: 0.3, cost: 2.6, from: 9, color: '#b07a52', desc: 'Tunnels under walls, untouchable below.' },
    warden: { name: 'Warden', hp: 50, shield: 60, spd: 0.85, gold: 6, leak: 2, sdps: 12, r: 0.31, cost: 3.2, from: 11, color: '#5fb0ff', desc: 'Regenerating shield. Tesla cracks it.' },
    brute: { name: 'Brute', hp: 220, spd: 0.55, armor: 3, gold: 10, leak: 4, sdps: 30, r: 0.42, cost: 6, from: 12, color: '#a04cff', desc: 'Slow, huge and hard to stop.' },
  };
  TW.BOSSES = {
    crabking: { name: 'The Crab King', night: 5, hp: 900, spd: 0.42, armor: 4, gold: 80, leak: 10, sdps: 60, r: 0.6, boss: 1, summon: 'crab', summonN: 1, summonT: 5, color: '#ff5a2a', desc: 'Heavy armor. Calls shellbacks.' },
    colossus: { name: 'The Drowned Colossus', night: 10, hp: 4200, spd: 0.38, armor: 4, gold: 150, leak: 20, sdps: 140, r: 0.68, boss: 1, breaker: 1, stomp: 4, color: '#3fbf9f', desc: 'Stomps walls to rubble.' },
    harpy: { name: 'The Storm Harpy', night: 15, hp: 5000, spd: 0.5, fly: 1, gold: 220, leak: 15, r: 0.62, boss: 1, summon: 'gull', summonN: 3, summonT: 5, color: '#e3e9ff', desc: 'Flies over everything. Brings a flock.' },
    eye: { name: 'The Abyssal Eye', night: 20, hp: 15000, shield: 1800, spd: 0.34, gold: 400, leak: 40, sdps: 120, r: 0.72, boss: 1, phase: 1, summon: 'wisp', summonN: 3, summonT: 5, color: '#ff3d6e', desc: 'Shielded. Fades from sight. The last tide.' },
  };
  TW.BOSS_BY_NIGHT = { 5: 'crabking', 10: 'colossus', 15: 'harpy', 20: 'eye' };

  // ---------------- boons ----------------
  // m = run.mods (multipliers/flags); r = run
  TW.BOONS = [
    // common
    { id: 'timber', name: 'Seasoned Timber', rar: 'common', tag: 'Walls', desc: 'Walls +25% HP.', max: 4, apply: (r) => { r.mods.wallHp += 0.25; } },
    { id: 'keen', name: 'Keen Edges', rar: 'common', tag: 'Ballista', desc: 'Ballistas +18% damage.', max: 5, apply: (r) => { r.mods.dmg.ballista += 0.18; } },
    { id: 'bellows', name: 'Bellows', rar: 'common', tag: 'Brazier', desc: 'Braziers burn +25% hotter.', max: 5, apply: (r) => { r.mods.dmg.brazier += 0.25; } },
    { id: 'heavyshot', name: 'Heavy Shot', rar: 'common', tag: 'Mortar', desc: 'Mortars +18% damage.', max: 5, apply: (r) => { r.mods.dmg.mortar += 0.18; } },
    { id: 'purse', name: 'Washed-up Purse', rar: 'common', tag: 'Gold', desc: '+70 gold now.', max: 9, apply: (r) => { r.res.g += 70; } },
    { id: 'lumber', name: 'Driftwood Haul', rar: 'common', tag: 'Wood', desc: '+14 wood now.', max: 9, apply: (r) => { r.res.w += 14; } },
    { id: 'quarry', name: 'Quarry Haul', rar: 'common', tag: 'Stone', desc: '+12 stone now.', max: 9, apply: (r) => { r.res.s += 12; } },
    { id: 'longday', name: 'Long Days', rar: 'common', tag: 'Gather', desc: '+3 gather taps each day.', max: 3, apply: (r) => { r.mods.actions += 3; } },
    { id: 'eyes', name: 'Sharp Eyes', rar: 'common', tag: 'Towers', desc: 'All towers +8% range.', max: 3, apply: (r) => { r.mods.range += 0.08; } },
    { id: 'bounty', name: 'Bounty', rar: 'common', tag: 'Gold', desc: '+15% gold from kills.', max: 4, apply: (r) => { r.mods.gold += 0.15; } },
    { id: 'chill', name: 'Bitter Chill', rar: 'common', tag: 'Frost', desc: 'Frost Bells slow 8% more.', max: 3, apply: (r) => { r.mods.slow += 0.08; } },
    // rare
    { id: 'thorns', name: 'Thorned Walls', rar: 'rare', tag: 'Walls', desc: 'Walls reflect 35% of damage taken back at attackers.', max: 3, apply: (r) => { r.mods.reflect += 0.35; } },
    { id: 'shatter', name: 'Shatterpoint', rar: 'rare', tag: 'Frost', desc: 'Frost Bells shatter frozen or chilled foes under 15% HP.', max: 1, apply: (r) => { r.mods.shatter = 0.15; } },
    { id: 'harv', name: 'Extra Harvester', rar: 'rare', tag: 'Harvest', desc: '+1 harvester allowed.', max: 3, apply: (r) => { r.mods.harvMax += 1; } },
    { id: 'overcharge', name: 'Overcharge', rar: 'rare', tag: 'Tesla', desc: 'Tesla arcs +2 chains, +15% damage.', max: 3, apply: (r) => { r.mods.chains += 2; r.mods.dmg.tesla += 0.15; } },
    { id: 'masonry', name: 'Masonry', rar: 'rare', tag: 'Walls', desc: 'Stone walls cost 1 less stone.', max: 2, apply: (r) => { r.mods.stoneDisc += 1; } },
    { id: 'quick', name: 'Quick Hands', rar: 'rare', tag: 'Towers', desc: 'All towers attack 10% faster.', max: 4, apply: (r) => { r.mods.rate += 0.1; } },
    { id: 'salvage', name: 'Salvage Rights', rar: 'rare', tag: 'Economy', desc: 'Selling refunds 100%.', max: 1, apply: (r) => { r.mods.refund = 1; } },
    { id: 'lens', name: 'Fresnel Lens', rar: 'rare', tag: 'Lighthouse', desc: 'Lighthouse beam deals triple damage, +1 range.', max: 2, apply: (r) => { r.mods.beam += 2; r.mods.beamRange += 1; } },
    { id: 'barbs', name: 'Barbed Hooks', rar: 'rare', tag: 'Harpoon', desc: 'Harpoons +30% damage and pull further.', max: 3, apply: (r) => { r.mods.dmg.harpoon += 0.3; r.mods.pull += 0.3; } },
    { id: 'wicks', name: 'Long Wicks', rar: 'rare', tag: 'Lantern', desc: 'Lanterns +25% radius and +40% damage.', max: 3, apply: (r) => { r.mods.lantern += 0.25; r.mods.dmg.lantern += 0.4; } },
    { id: 'tough', name: 'Hardened Towers', rar: 'rare', tag: 'Towers', desc: 'Towers and harvesters +60% HP.', max: 2, apply: (r) => { r.mods.towerHp += 0.6; } },
    // epic
    { id: 'vein', name: 'Crystal Vein', rar: 'epic', tag: 'Harvest', desc: 'Every harvester also yields +1 crystal each dawn.', max: 2, apply: (r) => { r.mods.vein += 1; } },
    { id: 'chainrx', name: 'Chain Reaction', rar: 'epic', tag: 'Mortar', desc: 'Mortar splash +35% radius.', max: 2, apply: (r) => { r.mods.splash += 0.35; } },
    { id: 'secondwind', name: 'Second Wind', rar: 'epic', tag: 'Lighthouse', desc: 'Lighthouse heals 4 HP each dawn. Heal 6 now.', max: 2, apply: (r) => { r.mods.dawnHeal += 4; r.hp = Math.min(r.maxHp, r.hp + 6); } },
    { id: 'hunter', name: "Hunter's Mark", rar: 'epic', tag: 'Lantern', desc: 'Invisible foes that are revealed take +35% damage.', max: 1, apply: (r) => { r.mods.hunter = 0.35; } },
    { id: 'golden', name: 'Golden Tide', rar: 'epic', tag: 'Gold', desc: 'Every kill drops +1 gold.', max: 3, apply: (r) => { r.mods.goldFlat += 1; } },
    { id: 'fury', name: 'Tidal Fury', rar: 'epic', tag: 'Towers', desc: 'All towers +15% damage.', max: 3, apply: (r) => { r.mods.allDmg += 0.15; } },
    // legendary
    { id: 'twin', name: 'Twin Beams', rar: 'legendary', tag: 'Lighthouse', desc: 'The lighthouse fires two beams, each 5x stronger.', max: 1, apply: (r) => { r.mods.beams = 2; r.mods.beam += 4; } },
    { id: 'bulwark', name: 'Bulwark', rar: 'legendary', tag: 'Walls', desc: 'Walls +60% HP and destroyed walls rebuild at dawn.', max: 1, apply: (r) => { r.mods.wallHp += 0.6; r.mods.rebuild = 1; } },
    { id: 'midas', name: 'Midas Tide', rar: 'legendary', tag: 'Gold', desc: 'Earn 15% interest on banked gold each dawn (max 60).', max: 1, apply: (r) => { r.mods.interest = 0.15; } },
    { id: 'phoenix', name: 'Phoenix Flame', rar: 'legendary', tag: 'Brazier', desc: 'Braziers hit flyers and +50% damage.', max: 1, apply: (r) => { r.mods.phoenix = 1; r.mods.dmg.brazier += 0.5; } },
  ];

  // ---------------- commanders ----------------
  TW.COMMANDERS = [
    { id: 'mara', name: 'Keeper Mara', title: 'Lighthouse Keeper', cost: 0, color: '#ffb347', perk: 'Lighthouse +6 HP and its beam deals double damage.',
      apply: (r) => { r.maxHp += 6; r.hp += 6; r.mods.beam += 1; } },
    { id: 'bram', name: 'Bram', title: 'The Mason', cost: 40, color: '#b8c2d6', perk: 'Palisades cost 1 wood. Walls +40% HP. +8 stone.',
      apply: (r) => { r.mods.wallDisc = 1; r.mods.wallHp += 0.4; r.res.s += 8; } },
    { id: 'rook', name: 'Captain Rook', title: 'Old Gunner', cost: 50, color: '#e6b271', perk: '+60 gold. Ballistas and Harpoons +20% damage.',
      apply: (r) => { r.res.g += 60; r.mods.dmg.ballista += 0.2; r.mods.dmg.harpoon += 0.2; } },
    { id: 'ilse', name: 'Ilse', title: 'The Tidesage', cost: 60, color: '#9b8cff', perk: 'Starts with 5 crystal. Tier-3 upgrades cost 1 less crystal and 15% less gold.',
      apply: (r) => { r.res.c += 5; r.mods.t3Disc = 1; } },
    { id: 'nell', name: 'Nell', title: 'The Wanderer', cost: 80, color: '#5fd3b0', perk: 'Boon picks offer 4 cards. +2 gather taps per day.',
      apply: (r) => { r.mods.boonChoices = 4; r.mods.actions += 2; } },
  ];

  TW.UNLOCKS = [ // towers unlocked with pearls (the others are available from the start)
    { id: 'tesla', cost: 35 },
    { id: 'harpoon', cost: 30 },
    { id: 'shrine', cost: 55 },
  ];
  TW.START_TOWERS = ['ballista', 'brazier', 'frost', 'mortar', 'lantern'];

  TW.PERKS = [
    { id: 'hp', name: 'Thick Lighthouse', desc: '+4 lighthouse HP', cost: [20, 40, 70], apply: (r, lv) => { r.maxHp += 4 * lv; r.hp += 4 * lv; } },
    { id: 'gold', name: 'Provisions', desc: '+30 starting gold', cost: [15, 30, 55], apply: (r, lv) => { r.res.g += 30 * lv; } },
    { id: 'gather', name: 'Early Riser', desc: '+1 gather tap per day', cost: [25, 55], apply: (r, lv) => { r.mods.actions += lv; } },
    { id: 'harv', name: 'Foreman', desc: '+1 harvester allowed', cost: [80], apply: (r, lv) => { r.mods.harvMax += lv; } },
  ];

  TW.START = { g: 130, w: 14, s: 6, c: 0, hp: 30, actions: 8, harvMax: 2 };
})(typeof window !== 'undefined' ? (window.TW = window.TW || {}) : (globalThis.TW = globalThis.TW || {}));
