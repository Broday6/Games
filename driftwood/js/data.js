// DRIFTWOOD — game data tables
(function (G) {
  'use strict';

  G.TS = 16;                 // tile size in px (internal resolution)
  G.WORLD = 256;             // world is WORLD x WORLD tiles
  G.DAY_LEN = 240;           // seconds per full day
  G.DUSK_AT = 160;
  G.NIGHT_AT = 180;

  // ---- tiles ----
  G.T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, DARKGRASS: 4, DIRT: 5, STONE: 6, OBSIDIAN: 7, LAVA: 8, ASH: 9 };
  G.TILE_INFO = [
    { name: 'deep water', col: '#1b3a6b', walk: false },
    { name: 'water', col: '#2e6fb5', walk: true, slow: 0.55 },
    { name: 'sand', col: '#d9c68a', walk: true },
    { name: 'grass', col: '#5c9a45', walk: true },
    { name: 'dark grass', col: '#3f7a3a', walk: true },
    { name: 'dirt', col: '#8a6a3f', walk: true },
    { name: 'stone', col: '#7d7f83', walk: true },
    { name: 'obsidian', col: '#3b3340', walk: true },
    { name: 'lava', col: '#ff6a1a', walk: true, dmg: 12, light: 2.5 },
    { name: 'ash', col: '#5a4f4c', walk: true },
  ];
  G.BIOME = { MEADOW: 0, FOREST: 1, VOLCANO: 2 };

  // ---- items ----
  // type: material | food | tool | weapon | bow | shield | armor | place | key | gem | arrow
  const I = {};
  const mat = (id, name, col, extra) => I[id] = Object.assign({ id, name, type: 'material', col }, extra || {});
  mat('wood', 'Wood', '#a0702e'); mat('stick', 'Stick', '#c9a15a'); mat('stone', 'Stone', '#9a9ca1');
  mat('fiber', 'Fiber', '#a8c95a'); mat('rope', 'Rope', '#d8b56c');
  mat('iron_ore', 'Iron Ore', '#b07a5a'); mat('iron_bar', 'Iron Bar', '#c8c8d0');
  mat('gold_ore', 'Gold Ore', '#e0b030'); mat('gold_bar', 'Gold Bar', '#ffd24a');
  mat('obsidian', 'Obsidian', '#5a4a70'); mat('coal', 'Coal', '#2a2a2e');
  mat('wolf_pelt', 'Wolf Pelt', '#8d7a68'); mat('bone', 'Bone', '#eae6d6'); mat('slime_gel', 'Slime Gel', '#7ce07c');
  mat('ember', 'Ember Core', '#ff8a3a');
  const food = (id, name, col, hunger, hp, buff) => I[id] = { id, name, type: 'food', col, hunger, hp, buff };
  food('berry', 'Berries', '#c03060', 8, 2); food('mushroom', 'Mushroom', '#c99a7a', 6, 4);
  food('cactus_fruit', 'Cactus Fruit', '#e05a9a', 10, 3); food('raw_meat', 'Raw Meat', '#c04a4a', 5, 0);
  food('cooked_meat', 'Cooked Meat', '#8a4a2a', 25, 12, { hp: 20, dur: 180 });
  food('bread', 'Bread', '#d9a862', 22, 8, { stam: 25, dur: 180 });
  food('stew', 'Hearty Stew', '#a05a3a', 40, 20, { hp: 40, stam: 20, dur: 300 });
  food('wheat', 'Wheat', '#d8c25a', 3, 0);
  const TIERS = ['wood', 'stone', 'iron', 'gold', 'obsidian'];
  const TIERCOL = ['#a0702e', '#9a9ca1', '#c8c8d0', '#ffd24a', '#7a5aa0'];
  const TNAME = ['Wooden', 'Stone', 'Iron', 'Golden', 'Obsidian'];
  TIERS.forEach((t, i) => {
    const tier = i + 1;
    I['axe_' + t] = { id: 'axe_' + t, name: TNAME[i] + ' Axe', type: 'tool', tool: 'axe', tier, power: 1 + i, dmg: 4 + i * 4, spd: 1.6, reach: 1.3, arc: 1.4, kb: 3, col: TIERCOL[i] };
    I['pick_' + t] = { id: 'pick_' + t, name: TNAME[i] + ' Pickaxe', type: 'tool', tool: 'pick', tier, power: 1 + i, dmg: 3 + i * 3, spd: 1.6, reach: 1.3, arc: 1.2, kb: 2, col: TIERCOL[i] };
    I['sword_' + t] = { id: 'sword_' + t, name: TNAME[i] + ' Sword', type: 'weapon', tier, dmg: [7, 12, 19, 28, 40][i], spd: 2.6, reach: 1.6, arc: 2.0, kb: 4, col: TIERCOL[i], anim: 'slash' };
    if (i >= 2) {
      I['helm_' + t] = { id: 'helm_' + t, name: TNAME[i] + ' Helm', type: 'armor', slot: 'head', def: [0, 0, 6, 10, 15][i], col: TIERCOL[i] };
      I['chest_' + t] = { id: 'chest_' + t, name: TNAME[i] + ' Chestplate', type: 'armor', slot: 'chest', def: [0, 0, 10, 16, 24][i], col: TIERCOL[i] };
      I['legs_' + t] = { id: 'legs_' + t, name: TNAME[i] + ' Leggings', type: 'armor', slot: 'legs', def: [0, 0, 8, 13, 20][i], col: TIERCOL[i] };
    }
  });
  I.helm_bone = { id: 'helm_bone', name: 'Bone Helm', type: 'armor', slot: 'head', def: 4, col: '#eae6d6' };
  I.chest_bone = { id: 'chest_bone', name: 'Bone Harness', type: 'armor', slot: 'chest', def: 7, col: '#eae6d6' };
  I.legs_bone = { id: 'legs_bone', name: 'Bone Greaves', type: 'armor', slot: 'legs', def: 6, col: '#eae6d6' };
  // boss armour: unique effects (eff fields are read by Sim.stats)
  I.crown_hollow = { id: 'crown_hollow', name: 'Crown of the Hollow King', type: 'armor', slot: 'head', def: 12, col: '#ffd24a', unique: true, eff: { dodges: 2, darkImmune: true }, desc: '+2 dodge charges, the dark cannot bite you' };
  I.helm_titan = { id: 'helm_titan', name: 'Titan Visor', type: 'armor', slot: 'head', def: 22, col: '#7080a0', unique: true, eff: { maxHp: 40, speed: -0.08 }, desc: '+40 max HP, -8% speed' };
  I.chest_dragonscale = { id: 'chest_dragonscale', name: 'Wyrmscale Plate', type: 'armor', slot: 'chest', def: 24, col: '#ff5030', unique: true, eff: { fireImmune: true, atk: 0.2 }, desc: 'immune to fire and lava, +20% attack' };
  I.chest_warden = { id: 'chest_warden', name: 'Wardenplate', type: 'armor', slot: 'chest', def: 34, col: '#8090b0', unique: true, eff: { thorns: 0.35, speed: -0.1 }, desc: 'reflects 35% of melee damage, -10% speed' };
  I.chest_lich = { id: 'chest_lich', name: 'Lichrobe', type: 'armor', slot: 'chest', def: 10, col: '#6040c0', unique: true, eff: { ls: 0.12, stamRegen: 10 }, desc: '12% lifesteal, faster stamina regen' };
  I.legs_spider = { id: 'legs_spider', name: 'Silkweave Leggings', type: 'armor', slot: 'legs', def: 10, col: '#a0a0ff', unique: true, eff: { speed: 0.25, dodgeCost: 0.5 }, desc: '+25% speed, dodges cost half stamina' };
  I.legs_frostmaw = { id: 'legs_frostmaw', name: 'Frostmaw Greaves', type: 'armor', slot: 'legs', def: 18, col: '#a0e0ff', unique: true, eff: { frostAura: true }, desc: 'nearby enemies are slowed' };
  I.legs_gronk = { id: 'legs_gronk', name: "Gronk's Loincloth", type: 'armor', slot: 'legs', def: 14, col: '#6a8a40', unique: true, eff: { kbImmune: true, maxHp: 25 }, desc: '+25 max HP, heavy attacks charge twice as fast' };
  // trinkets (4th equipment slot)
  I.trinket_rabbit = { id: 'trinket_rabbit', name: "Lucky Rabbit's Foot", type: 'armor', slot: 'trinket', def: 0, col: '#f0e0d0', eff: { crit: 0.15, coinMul: 0.25 }, desc: '+15% crit, +25% coins' };
  I.trinket_vampire = { id: 'trinket_vampire', name: 'Vampire Amulet', type: 'armor', slot: 'trinket', def: 0, col: '#a02060', eff: { ls: 0.08, maxHp: -10 }, desc: '8% lifesteal, -10 max HP' };
  I.trinket_phoenix = { id: 'trinket_phoenix', name: 'Phoenix Pendant', type: 'armor', slot: 'trinket', def: 0, col: '#ff9030', unique: true, eff: { phoenix: true }, desc: 'self-revive once per run' };
  I.trinket_storm = { id: 'trinket_storm', name: 'Stormheart', type: 'armor', slot: 'trinket', def: 0, col: '#80c0ff', unique: true, eff: { chain: 0.25 }, desc: '25% chance hits arc lightning to 3 enemies' };
  I.trinket_hunger = { id: 'trinket_hunger', name: 'Everfull Gourd', type: 'armor', slot: 'trinket', def: 0, col: '#c0a060', eff: { hunger: 0.5, regen: 0.5 }, desc: 'hunger drains half as fast, +0.5 HP/s' };
  I.trinket_titan = { id: 'trinket_titan', name: 'Titan Core', type: 'armor', slot: 'trinket', def: 8, col: '#7080a0', unique: true, eff: { atk: 0.3, dmgTaken: 0.2 }, desc: '+30% attack, +20% damage taken' };
  I.helm_leather = { id: 'helm_leather', name: 'Leather Cap', type: 'armor', slot: 'head', def: 3, col: '#8d7a68' };
  I.chest_leather = { id: 'chest_leather', name: 'Leather Tunic', type: 'armor', slot: 'chest', def: 5, col: '#8d7a68' };
  I.legs_leather = { id: 'legs_leather', name: 'Leather Pants', type: 'armor', slot: 'legs', def: 4, col: '#8d7a68' };
  I.spear_iron = { id: 'spear_iron', name: 'Iron Spear', type: 'weapon', tier: 3, dmg: 16, spd: 2.2, reach: 2.4, arc: 0.7, kb: 6, col: '#c8c8d0', anim: 'thrust' };
  I.hammer_gold = { id: 'hammer_gold', name: 'Golden Warhammer', type: 'weapon', tier: 4, dmg: 45, spd: 1.1, reach: 1.7, arc: 2.6, kb: 10, col: '#ffd24a', anim: 'slam', big: true };
  I.blade_ember = { id: 'blade_ember', name: 'Emberblade', type: 'weapon', tier: 5, dmg: 34, spd: 3.2, reach: 1.7, arc: 2.0, kb: 4, burn: true, col: '#ff8a3a', anim: 'slash' };
  I.dagger_iron = { id: 'dagger_iron', name: 'Iron Dagger', type: 'weapon', tier: 3, dmg: 11, spd: 4.4, reach: 1.25, arc: 1.2, kb: 1.5, crit: 0.15, col: '#c8c8d0', anim: 'thrust' };
  I.dagger_obsidian = { id: 'dagger_obsidian', name: 'Obsidian Dagger', type: 'weapon', tier: 5, dmg: 22, spd: 4.8, reach: 1.25, arc: 1.2, kb: 1.5, crit: 0.25, col: '#7a5aa0', anim: 'thrust' };
  I.greatsword_iron = { id: 'greatsword_iron', name: 'Iron Greatsword', type: 'weapon', tier: 3, dmg: 30, spd: 1.3, reach: 2.1, arc: 3.0, kb: 8, col: '#c8c8d0', anim: 'slash', big: true };
  I.greatsword_gold = { id: 'greatsword_gold', name: 'Golden Greatsword', type: 'weapon', tier: 4, dmg: 44, spd: 1.3, reach: 2.2, arc: 3.0, kb: 9, col: '#ffd24a', anim: 'slash', big: true };
  I.crossbow_iron = { id: 'crossbow_iron', name: 'Iron Crossbow', type: 'bow', dmg: 30, draw: 1.3, pierce: true, col: '#8a6a40' };
  I.staff_ember = { id: 'staff_ember', name: 'Ember Staff', type: 'staff', dmg: 26, draw: 0.6, cost: 18, col: '#ff6a1a' };
  I.staff_frost = { id: 'staff_frost', name: 'Frost Staff', type: 'staff', dmg: 18, draw: 0.5, cost: 14, frost: true, col: '#80d0ff' };
  // boss weapons (unique legendaries with specials, handled in the sim)
  I.gronk_hammer = { id: 'gronk_hammer', name: "Gronk's Skullcrusher", type: 'weapon', tier: 5, dmg: 60, spd: 1.0, reach: 1.9, arc: 2.8, kb: 12, col: '#6a8a40', anim: 'slam', big: true, unique: true, special: 'shock', desc: 'heavy attacks send a shockwave that hits everything within 4m' };
  I.hollow_blade = { id: 'hollow_blade', name: 'Crownblade', type: 'weapon', tier: 5, dmg: 36, spd: 3.0, reach: 1.7, arc: 2.0, kb: 4, col: '#4050c0', anim: 'slash', unique: true, special: 'shadowbolt', desc: 'every swing fires a shadow bolt' };
  I.wyrm_fang = { id: 'wyrm_fang', name: "Wyrm's Fang", type: 'weapon', tier: 5, dmg: 26, spd: 5.0, reach: 1.3, arc: 1.2, kb: 1.5, crit: 0.3, burn: true, col: '#ff5030', anim: 'thrust', unique: true, special: 'firetrail', desc: 'hits leave burning ground' };
  I.bonecleaver = { id: 'bonecleaver', name: 'Bonecleaver', type: 'weapon', tier: 5, dmg: 55, spd: 1.4, reach: 2.3, arc: 3.1, kb: 9, col: '#eae6d6', anim: 'slash', big: true, unique: true, special: 'execute', desc: 'double damage to enemies below half health' };
  I.warden_shield = { id: 'warden_shield', name: "Warden's Bulwark", type: 'shield', block: 0.95, col: '#8090b0', unique: true, special: 'parrywave', desc: 'blocks 95%; a parry blasts everything nearby' };
  I.venom_bow = { id: 'venom_bow', name: 'Venomfang Bow', type: 'bow', dmg: 34, draw: 0.7, col: '#60c040', unique: true, special: 'poison', desc: 'arrows poison and slow' };
  I.frost_maul = { id: 'frost_maul', name: 'Frostmaw Maul', type: 'weapon', tier: 5, dmg: 52, spd: 1.2, reach: 1.9, arc: 2.6, kb: 10, frost: true, col: '#a0e0ff', anim: 'slam', big: true, unique: true, special: 'freeze', desc: 'heavy attacks freeze everything within 4m for 2s' };
  I.lich_staff = { id: 'lich_staff', name: "Lich's Staff", type: 'staff', dmg: 40, draw: 0.5, cost: 14, chain: true, col: '#6040c0', unique: true, special: 'lichbolt', desc: 'bolts chain to 4 enemies and heal you' };
  I.titan_fist = { id: 'titan_fist', name: "Titan's Fist", type: 'weapon', tier: 5, dmg: 48, spd: 2.0, reach: 1.5, arc: 1.8, kb: 14, col: '#7080a0', anim: 'thrust', unique: true, special: 'punch', desc: 'every third hit is a quaking punch' };
  I.bow_wood = { id: 'bow_wood', name: 'Wooden Bow', type: 'bow', dmg: 10, draw: 1.0, col: '#a0702e' };
  I.bow_iron = { id: 'bow_iron', name: 'Iron Longbow', type: 'bow', dmg: 20, draw: 0.8, col: '#c8c8d0' };
  I.bow_gold = { id: 'bow_gold', name: 'Golden Bow', type: 'bow', dmg: 32, draw: 0.6, col: '#ffd24a' };
  I.arrow = { id: 'arrow', name: 'Arrow', type: 'arrow', col: '#d8c8a8' };
  I.shield_wood = { id: 'shield_wood', name: 'Wooden Shield', type: 'shield', block: 0.6, col: '#a0702e' };
  I.shield_iron = { id: 'shield_iron', name: 'Iron Shield', type: 'shield', block: 0.8, col: '#c8c8d0' };
  I.torch_hand = { id: 'torch_hand', name: 'Torch (hand)', type: 'place', obj: 'torch', light: 4, col: '#ffb040' };
  const place = (id, name, obj, col) => I[id] = { id, name, type: 'place', obj, col };
  place('workbench', 'Workbench', 'workbench', '#b08040'); place('furnace', 'Furnace', 'furnace', '#8a8a90');
  place('anvil', 'Anvil', 'anvil', '#606068'); place('cauldron', 'Cauldron', 'cauldron', '#404850');
  place('campfire', 'Campfire', 'campfire', '#ff9040'); place('wall_wood', 'Wooden Wall', 'wall_wood', '#a0702e');
  place('wall_stone', 'Stone Wall', 'wall_stone', '#8a8c90'); place('door_wood', 'Wooden Door', 'door_wood', '#c09050');
  place('floor_wood', 'Wooden Floor / Bridge', 'floor_wood', '#c9a15a'); place('spikes', 'Spike Trap', 'spikes', '#b0b0b8');
  I.totem_meadow = { id: 'totem_meadow', name: 'Ogre Totem', type: 'key', altar: 'altar_meadow', col: '#40c060' };
  I.totem_forest = { id: 'totem_forest', name: 'Hollow Totem', type: 'key', altar: 'altar_forest', col: '#4060d0' };
  I.totem_volcano = { id: 'totem_volcano', name: 'Cinder Totem', type: 'key', altar: 'altar_volcano', col: '#e04040' };
  I.emerald = { id: 'emerald', name: 'Emerald Gem', type: 'gem', col: '#30e070' };
  I.sapphire = { id: 'sapphire', name: 'Sapphire Gem', type: 'gem', col: '#3070ff' };
  I.ruby = { id: 'ruby', name: 'Ruby Gem', type: 'gem', col: '#ff3050' };
  G.ITEMS = I;
  G.ITEM_LIST = Object.keys(I);
  G.ITEM_IDX = {}; G.ITEM_LIST.forEach((k, i) => G.ITEM_IDX[k] = i);
  G.STACK = (id) => (I[id].type === 'material' || I[id].type === 'food' || I[id].type === 'arrow' || I[id].type === 'place') ? 99 : 1;
  // tools default to a chop animation
  for (const k in I) if (I[k].type === 'tool') I[k].anim = 'chop';

  // ---- weapon affixes (roguelike loot) ----
  G.AFFIX = {
    swift: { name: 'Swift', desc: '+25% attack speed', col: '#8fd3ff', spd: 1.25 },
    brutal: { name: 'Brutal', desc: '+25% damage', col: '#ff6060', dmg: 1.25 },
    vampiric: { name: 'Vampiric', desc: '10% lifesteal', col: '#c040a0', ls: 0.10 },
    flaming: { name: 'Flaming', desc: 'hits set enemies ablaze', col: '#ff8a3a', burn: true },
    frozen: { name: 'Frozen', desc: 'hits slow enemies', col: '#c0f0ff', frost: true },
    lucky: { name: 'Lucky', desc: '+15% crit chance', col: '#ffe060', crit: 0.15 },
    heavy: { name: 'Heavy', desc: 'double knockback, +10% damage', col: '#d0d0d0', kb: 2, dmg: 1.1 },
    keen: { name: 'Keen', desc: '+20% reach', col: '#a0ffa0', reach: 1.2 },
    cursed: { name: 'Cursed', desc: '+45% damage, -20 max HP while held', col: '#a040ff', dmg: 1.45, hp: -20 },
  };
  G.AFFIX_LIST = Object.keys(G.AFFIX);
  G.itemName = (s) => { const d = I[s.id]; if (!s.aff || !s.aff.length) return d.name; return s.aff.map(a => G.AFFIX[a].name).join(' ') + ' ' + d.name; };

  // ---- starting classes (roguelike meta) ----
  G.CLASSES = [
    { id: 'castaway', name: 'Castaway', desc: 'Nothing but your fists and your wits.', items: [], pw: {}, unlock: null },
    { id: 'warrior', name: 'Warrior', desc: 'Starts with a stone sword, a wooden shield and a leather tunic. +6 defense.', items: [['sword_stone', 1], ['shield_wood', 1], ['chest_leather', 1]], pw: { ironskin: 1 }, unlock: { key: 'bestDay', n: 3, txt: 'reach day 3' } },
    { id: 'hunter', name: 'Hunter', desc: 'Starts with a bow, 30 arrows and cooked meat. +12% speed.', items: [['bow_wood', 1], ['arrow', 30], ['cooked_meat', 3]], pw: { sneakers: 1 }, unlock: { key: 'kills', n: 60, txt: 'slay 60 monsters in total' } },
    { id: 'builder', name: 'Builder', desc: 'Starts with a workbench, campfire, 30 wood, 10 stone and 4 torches. +15 max HP.', items: [['workbench', 1], ['campfire', 1], ['wood', 30], ['stone', 10], ['torch_hand', 4]], pw: { broth: 1 }, unlock: { key: 'bosses', n: 1, txt: 'slay a guardian' } },
  ];

  // ---- night events (random modifiers announced at dusk) ----
  G.NIGHT_EVENTS = [
    { id: 'clear', name: 'Clear Night', desc: 'Nothing unusual. Yet.', w: 3 },
    { id: 'bloodmoon', name: 'Blood Moon', desc: 'Monsters hit 30% harder and drop double coins.', w: 2, dmg: 1.3, coins: 2 },
    { id: 'fog', name: 'Dead Fog', desc: 'You can barely see. Monsters spawn closer.', w: 2 },
    { id: 'swarm', name: 'The Swarm', desc: 'Bats. So many bats.', w: 2 },
    { id: 'bounty', name: "Smuggler's Night", desc: 'Chests cost half price tonight.', w: 2, chest: 0.5 },
    { id: 'eclipse', name: 'Long Dark', desc: 'The night lasts 40% longer.', w: 1, len: 1.4 },
    { id: 'elite', name: 'Champions Rise', desc: 'Far more elite monsters tonight.', w: 2, elite: 0.35 },
  ];

  // ---- recipes ----
  const R = [];
  const rec = (out, n, needs, station) => R.push({ out, n, needs, station: station || null });
  rec('stick', 4, { wood: 1 }); rec('rope', 1, { fiber: 3 }); rec('torch_hand', 2, { stick: 1, coal: 1 });
  rec('torch_hand', 1, { stick: 1, wood: 1 });
  rec('axe_wood', 1, { wood: 5, stick: 2 }); rec('pick_wood', 1, { wood: 5, stick: 2 }); rec('sword_wood', 1, { wood: 6, stick: 1 });
  rec('workbench', 1, { wood: 10, stone: 4 });
  rec('axe_stone', 1, { stone: 6, stick: 2 }, 'workbench'); rec('pick_stone', 1, { stone: 6, stick: 2 }, 'workbench');
  rec('sword_stone', 1, { stone: 8, stick: 2 }, 'workbench'); rec('bow_wood', 1, { wood: 6, rope: 2 }, 'workbench');
  rec('arrow', 6, { stick: 2, stone: 1 }, 'workbench'); rec('shield_wood', 1, { wood: 8, rope: 1 }, 'workbench');
  rec('furnace', 1, { stone: 20, wood: 5 }, 'workbench'); rec('cauldron', 1, { stone: 10, iron_bar: 3 }, 'workbench');
  rec('campfire', 1, { wood: 6, stone: 4 }); rec('wall_wood', 4, { wood: 6 }, 'workbench');
  rec('wall_stone', 4, { stone: 8 }, 'workbench'); rec('door_wood', 1, { wood: 6, stick: 2 }, 'workbench');
  rec('floor_wood', 4, { wood: 4 }, 'workbench'); rec('spikes', 2, { wood: 4, stone: 2, iron_bar: 1 }, 'workbench');
  rec('helm_leather', 1, { wolf_pelt: 3, rope: 1 }, 'workbench'); rec('chest_leather', 1, { wolf_pelt: 5, rope: 2 }, 'workbench');
  rec('legs_leather', 1, { wolf_pelt: 4, rope: 1 }, 'workbench');
  rec('helm_bone', 1, { bone: 4, rope: 1 }, 'workbench'); rec('chest_bone', 1, { bone: 8, rope: 2 }, 'workbench'); rec('legs_bone', 1, { bone: 6, rope: 1 }, 'workbench');
  rec('trinket_rabbit', 1, { wolf_pelt: 2, gold_bar: 2, slime_gel: 3 }, 'anvil'); rec('trinket_hunger', 1, { wood: 10, berry: 10, rope: 2 }, 'workbench'); rec('trinket_vampire', 1, { bone: 6, gold_bar: 3, ember: 1 }, 'anvil');
  rec('iron_bar', 1, { iron_ore: 2, coal: 1 }, 'furnace'); rec('gold_bar', 1, { gold_ore: 2, coal: 1 }, 'furnace');
  rec('coal', 2, { wood: 3 }, 'furnace');
  rec('anvil', 1, { iron_bar: 8, stone: 10 }, 'workbench');
  rec('axe_iron', 1, { iron_bar: 4, stick: 2 }, 'anvil'); rec('pick_iron', 1, { iron_bar: 4, stick: 2 }, 'anvil');
  rec('sword_iron', 1, { iron_bar: 6, stick: 1 }, 'anvil'); rec('spear_iron', 1, { iron_bar: 4, stick: 4 }, 'anvil');
  rec('bow_iron', 1, { iron_bar: 4, wood: 4, rope: 3 }, 'anvil'); rec('shield_iron', 1, { iron_bar: 6, wood: 2 }, 'anvil');
  rec('dagger_iron', 1, { iron_bar: 3, stick: 1 }, 'anvil'); rec('greatsword_iron', 1, { iron_bar: 10, stick: 2 }, 'anvil'); rec('crossbow_iron', 1, { iron_bar: 6, wood: 6, rope: 3 }, 'anvil');
  rec('helm_iron', 1, { iron_bar: 5 }, 'anvil'); rec('chest_iron', 1, { iron_bar: 8 }, 'anvil'); rec('legs_iron', 1, { iron_bar: 6 }, 'anvil');
  rec('axe_gold', 1, { gold_bar: 4, stick: 2 }, 'anvil'); rec('pick_gold', 1, { gold_bar: 4, stick: 2 }, 'anvil');
  rec('sword_gold', 1, { gold_bar: 6, stick: 1 }, 'anvil'); rec('hammer_gold', 1, { gold_bar: 10, wood: 4 }, 'anvil');
  rec('bow_gold', 1, { gold_bar: 5, wood: 4, rope: 3 }, 'anvil');
  rec('greatsword_gold', 1, { gold_bar: 12, stick: 2 }, 'anvil'); rec('staff_frost', 1, { gold_bar: 4, wood: 6, slime_gel: 8 }, 'anvil');
  rec('helm_gold', 1, { gold_bar: 5 }, 'anvil'); rec('chest_gold', 1, { gold_bar: 8 }, 'anvil'); rec('legs_gold', 1, { gold_bar: 6 }, 'anvil');
  rec('axe_obsidian', 1, { obsidian: 6, gold_bar: 2 }, 'anvil'); rec('pick_obsidian', 1, { obsidian: 6, gold_bar: 2 }, 'anvil');
  rec('sword_obsidian', 1, { obsidian: 8, gold_bar: 2 }, 'anvil'); rec('blade_ember', 1, { obsidian: 6, ember: 3, gold_bar: 2 }, 'anvil');
  rec('dagger_obsidian', 1, { obsidian: 5, gold_bar: 1 }, 'anvil'); rec('staff_ember', 1, { obsidian: 4, ember: 4, wood: 6 }, 'anvil');
  rec('helm_obsidian', 1, { obsidian: 6, iron_bar: 2 }, 'anvil'); rec('chest_obsidian', 1, { obsidian: 10, iron_bar: 2 }, 'anvil');
  rec('legs_obsidian', 1, { obsidian: 8, iron_bar: 2 }, 'anvil');
  rec('cooked_meat', 1, { raw_meat: 1 }, 'campfire'); rec('bread', 2, { wheat: 3 }, 'campfire');
  rec('stew', 1, { cooked_meat: 1, mushroom: 2, berry: 2 }, 'cauldron');
  rec('totem_meadow', 1, { wood: 15, stone: 15, slime_gel: 5 }, 'workbench');
  rec('totem_forest', 1, { iron_bar: 5, wolf_pelt: 3, bone: 5 }, 'anvil');
  rec('totem_volcano', 1, { gold_bar: 5, obsidian: 5, ember: 2 }, 'anvil');
  G.RECIPES = R;

  // ---- world objects ----
  // solid: blocks movement. tool/tier: needed to harvest. drops: [id, min, max]. light: radius. claim: no spawns within.
  const O = {};
  const obj = (id, def) => O[id] = Object.assign({ id, solid: true, hp: 10 }, def);
  obj('tree', { name: 'Tree', hp: 10, tool: 'axe', tier: 1, drops: [['wood', 3, 5], ['stick', 0, 2]], tall: true, colR: 0.3 });
  obj('birch', { name: 'Birch', hp: 16, tool: 'axe', tier: 1, drops: [['wood', 5, 8], ['stick', 1, 2]], tall: true, colR: 0.28 });
  obj('deadtree', { name: 'Dead Tree', hp: 10, tool: 'axe', tier: 1, drops: [['wood', 2, 3], ['coal', 1, 3]], tall: true, colR: 0.28 });
  obj('rock', { name: 'Rock', hp: 10, tool: 'pick', tier: 1, drops: [['stone', 3, 5]], colR: 0.5 });
  obj('coal_rock', { name: 'Coal Deposit', hp: 12, tool: 'pick', tier: 1, drops: [['coal', 2, 4], ['stone', 1, 2]], colR: 0.5 });
  obj('iron_vein', { name: 'Iron Vein', hp: 18, tool: 'pick', tier: 2, drops: [['iron_ore', 2, 4], ['stone', 1, 2]], colR: 0.5 });
  obj('gold_vein', { name: 'Gold Vein', hp: 26, tool: 'pick', tier: 3, drops: [['gold_ore', 2, 3]], colR: 0.5 });
  obj('obsidian_vein', { name: 'Obsidian Vein', hp: 38, tool: 'pick', tier: 4, drops: [['obsidian', 2, 4]], colR: 0.5 });
  obj('berry_bush', { name: 'Berry Bush', hp: 3, tool: null, tier: 0, drops: [['berry', 2, 4], ['fiber', 1, 2]], solid: false, regrow: 90 });
  obj('mushroom', { name: 'Mushroom', hp: 2, tool: null, tier: 0, drops: [['mushroom', 1, 3]], solid: false, regrow: 120 });
  obj('wheat', { name: 'Wild Wheat', hp: 2, tool: null, tier: 0, drops: [['wheat', 1, 3], ['fiber', 1, 2]], solid: false, regrow: 100 });
  obj('cactus', { name: 'Cactus', hp: 5, tool: null, tier: 0, drops: [['cactus_fruit', 1, 2], ['fiber', 1, 1]], solid: false, regrow: 150 });
  obj('grass_tuft', { name: 'Tall Grass', hp: 1, tool: null, tier: 0, drops: [['fiber', 1, 2]], solid: false, regrow: 60 });
  const chest = (id, name, rarity, cost) => obj(id, { name, chest: rarity, isChest: true, cost, hp: 9999, tool: 'none', tier: 99 });
  chest('chest_c', 'Chest', 0, 6); chest('chest_u', 'Green Chest', 1, 14); chest('chest_r', 'Red Chest', 2, 30); chest('chest_l', 'Golden Chest', 3, 60);
  obj('altar_meadow', { name: 'Ogre Altar', hp: 9999, tool: 'none', tier: 99, altar: 'gronk', key: 'totem_meadow' });
  obj('altar_forest', { name: 'Hollow Altar', hp: 9999, tool: 'none', tier: 99, altar: 'hollow', key: 'totem_forest' });
  obj('altar_volcano', { name: 'Cinder Altar', hp: 9999, tool: 'none', tier: 99, altar: 'cinder', key: 'totem_volcano' });
  obj('boat', { name: 'Shipwreck', hp: 9999, tool: 'none', tier: 99, boat: true });
  obj('casino', { name: "Dealer's Table", hp: 9999, tool: 'none', tier: 99, casino: true, light: 3, neon: true });
  // placeables
  obj('workbench', { name: 'Workbench', hp: 40, tool: 'none', tier: 99, station: 'workbench', built: true });
  obj('furnace', { name: 'Furnace', hp: 80, tool: 'none', tier: 99, station: 'furnace', built: true, light: 2.5 });
  obj('anvil', { name: 'Anvil', hp: 100, tool: 'none', tier: 99, station: 'anvil', built: true });
  obj('cauldron', { name: 'Cauldron', hp: 60, tool: 'none', tier: 99, station: 'cauldron', built: true, light: 1.5 });
  obj('campfire', { name: 'Campfire', hp: 30, tool: 'none', tier: 99, station: 'campfire', built: true, light: 6, claim: 7, rest: true, solid: false });
  obj('torch', { name: 'Torch', hp: 10, tool: 'none', tier: 99, built: true, light: 4.5, claim: 5, solid: false });
  obj('wall_wood', { name: 'Wooden Wall', hp: 60, tool: 'none', tier: 99, built: true, wall: true });
  obj('wall_stone', { name: 'Stone Wall', hp: 200, tool: 'none', tier: 99, built: true, wall: true });
  obj('door_wood', { name: 'Wooden Door', hp: 60, tool: 'none', tier: 99, built: true, door: true, wall: true });
  obj('floor_wood', { name: 'Wooden Floor', hp: 30, tool: 'none', tier: 99, built: true, floor: true, solid: false });
  obj('spikes', { name: 'Spike Trap', hp: 40, tool: 'none', tier: 99, built: true, trap: 8, solid: false });
  G.OBJS = O;
  G.OBJ_LIST = Object.keys(O); G.OBJ_IDX = {}; G.OBJ_LIST.forEach((k, i) => G.OBJ_IDX[k] = i);

  // ---- powerups ----
  const P = [];
  const pw = (id, name, rarity, desc, col) => P.push({ id, name, rarity, desc, col });
  pw('sneakers', 'Sneakers', 0, '+12% move speed', '#8fd3ff');
  pw('whetstone', 'Whetstone', 0, '+10% attack', '#d0d0d0');
  pw('ironskin', 'Iron Skin', 0, '+6 defense', '#a0a8b8');
  pw('broth', 'Broth', 0, '+15 max HP', '#e0a060');
  pw('feather', 'Feather', 0, '+1 dodge charge', '#ffffff');
  pw('luckycoin', 'Lucky Coin', 0, '+25% coin drops', '#ffd24a');
  pw('bandage', 'Bandage', 0, '+0.5 HP/s regen', '#f0e0d0');
  pw('sundial', 'Sundial', 1, 'night 12% shorter (max 50%)', '#ffe080');
  pw('berserk', 'Berserker Horn', 1, '+30% attack below 40% HP', '#e04040');
  pw('vampire', 'Vampire Fang', 1, '8% lifesteal', '#a02060');
  pw('critlens', 'Crit Lens', 1, '+10% crit chance', '#60e0ff');
  pw('magnet', 'Magnet', 1, '+2 tile pickup radius', '#ff6060');
  pw('sprinter', "Sprinter's Wrap", 1, 'sprint costs 30% less', '#80ff80');
  pw('thorns', 'Thorns', 1, 'reflect 20% melee damage', '#40a040');
  pw('blastcap', 'Blast Cap', 2, '15% chance hits explode', '#ff8020');
  pw('chain', 'Chain Lightning', 2, '10% chance to arc to 3 enemies', '#80c0ff');
  pw('frost', 'Frost Edge', 2, 'hits slow enemies 30%', '#c0f0ff');
  pw('secondwind', 'Second Wind', 2, 'survive lethal hit (60s cd)', '#ffe0a0');
  pw('phoenix', 'Phoenix Feather', 3, 'self-revive once per run', '#ff9030');
  pw('midas', 'Midas Glove', 3, '2x coins, chests 20% cheaper', '#ffd24a');
  pw('wolfpack', 'Wolf Pack', 3, 'a wolf companion fights for you', '#a08060');
  pw('timeshard', 'Time Shard', 3, 'dodge freezes nearby enemies 1s', '#c0a0ff');
  pw('gluttony', 'Gluttony', 3, 'food is twice as effective', '#ffa0c0');
  pw('warlord', "Warlord's Crown", 3, '+50% attack, +50% damage taken', '#ff4040');
  pw('backstab', 'Backstab', 1, '+30% damage to enemies not facing you', '#c0c0ff');
  pw('heavyhitter', 'Heavy Hitter', 1, 'heavy attacks +40% damage', '#ff9060');
  pw('finisher', 'Finisher', 1, 'combo finisher +40% damage', '#ffe0a0');
  pw('splitshot', 'Split Shot', 2, 'bows fire an extra arrow', '#a0d0a0');
  pw('fireaura', 'Ember Aura', 2, 'enemies near you slowly burn', '#ff6a1a');
  pw('scavenger', 'Scavenger', 0, '+20% resource drops', '#a0c060');
  pw('ironlungs', 'Iron Lungs', 0, '+30 stamina regen', '#80ffd0');
  pw('treasure', 'Treasure Sense', 2, 'weapon drops roll one rarity higher', '#ffd24a');
  pw('glass', 'Glass Cannon', 3, '+100% attack, max HP halved', '#ff80ff');
  pw('lastword', 'Last Word', 2, 'when downed, explode for massive damage', '#ff4040');
  G.POWERUPS = P; G.PW = {}; P.forEach(p => G.PW[p.id] = p);
  G.RARITY_COL = ['#c8c8c8', '#50e050', '#ff5050', '#ffd24a'];
  G.RARITY_NAME = ['Common', 'Uncommon', 'Rare', 'Legendary'];

  // ---- enemies ----
  // ai: chase | archer | wolf | treant | skeleton | crawler | bat | boss types
  const E = {};
  const en = (id, def) => E[id] = Object.assign({ id }, def);
  en('slime', { name: 'Slime', hp: 22, dmg: 5, spd: 2.6, r: 0.4, ai: 'chase', coins: 2, col: '#60d060', drops: [['slime_gel', 1, 2]], minNight: 0, splits: true, windup: 0.5, reach: 0.9 });
  en('slime_small', { name: 'Slimelet', hp: 8, dmg: 4, spd: 3.4, r: 0.25, ai: 'chase', coins: 1, col: '#90ff90', drops: [['slime_gel', 0, 1]], minNight: 99, windup: 0.4, reach: 0.7 });
  en('goblin', { name: 'Goblin', hp: 30, dmg: 7, spd: 4.2, r: 0.35, ai: 'chase', coins: 3, col: '#7aa040', drops: [['stick', 0, 2], ['raw_meat', 0, 1]], minNight: 0, windup: 0.45, reach: 1.0 });
  en('goblin_archer', { name: 'Goblin Archer', hp: 26, dmg: 8, spd: 3.6, r: 0.35, ai: 'archer', coins: 4, col: '#a0a040', drops: [['arrow', 2, 5]], minNight: 2, windup: 0.8, reach: 7 });
  en('wolf', { name: 'Wolf', hp: 45, dmg: 12, spd: 5.2, r: 0.4, ai: 'wolf', coins: 4, col: '#8d7a68', drops: [['wolf_pelt', 1, 2], ['raw_meat', 1, 2]], minNight: 1, windup: 0.5, reach: 1.0, biome: 1 });
  en('treant', { name: 'Treant', hp: 160, dmg: 22, spd: 1.8, r: 0.7, ai: 'treant', coins: 12, col: '#4a6a30', drops: [['wood', 6, 10], ['stick', 2, 4]], minNight: 3, windup: 1.0, reach: 2.2, biome: 1 });
  en('skeleton', { name: 'Skeleton', hp: 60, dmg: 14, spd: 3.2, r: 0.38, ai: 'skeleton', coins: 6, col: '#e0e0d0', drops: [['bone', 1, 3]], minNight: 2, windup: 0.6, reach: 1.1 });
  en('crawler', { name: 'Magma Crawler', hp: 50, dmg: 10, spd: 3.0, r: 0.4, ai: 'crawler', coins: 6, col: '#ff6a1a', drops: [['ember', 0, 1], ['coal', 1, 2]], minNight: 0, windup: 0.7, reach: 6, biome: 2, always: true });
  en('bat', { name: 'Scout Drone', hp: 6, dmg: 3, spd: 5.5, r: 0.2, ai: 'bat', coins: 1, col: '#503060', drops: [], minNight: 1, windup: 0.2, reach: 0.6 });
  en('wolf_pet', { name: 'Wolf Companion', hp: 80, dmg: 12, spd: 5.5, r: 0.4, ai: 'pet', coins: 0, col: '#d0c0a0', drops: [], minNight: 99, windup: 0.3, reach: 1.0 });
  en('tentacle', { name: 'Tentacle', hp: 120, dmg: 18, spd: 0, r: 0.6, ai: 'tentacle', coins: 5, col: '#3a5a7a', drops: [], minNight: 99, windup: 0.9, reach: 2.6 });
  en('spiderling', { name: 'Spiderling', hp: 14, dmg: 5, spd: 4.8, r: 0.25, ai: 'chase', coins: 1, col: '#503060', drops: [], minNight: 99, windup: 0.35, reach: 0.7 });
  // night bosses (arrive with the heavy wave from night 2)
  en('bonecrusher', { name: 'Bonecrusher', hp: 700, dmg: 24, spd: 2.6, r: 0.9, ai: 'bonecrusher', coins: 50, col: '#e0e0d0', drops: [['bone', 8, 12]], minNight: 99, boss: true, windup: 0.9, reach: 2.0, night: true, loot: 'bonecleaver', armor: 'helm_bone' });
  en('warden', { name: 'The Warden', hp: 1000, dmg: 20, spd: 2.4, r: 0.8, ai: 'warden', coins: 60, col: '#8090b0', drops: [['iron_bar', 6, 10]], minNight: 99, boss: true, windup: 0.8, reach: 1.9, night: true, loot: 'warden_shield', armor: 'chest_warden' });
  en('matriarch', { name: 'The Matriarch', hp: 1100, dmg: 18, spd: 3.4, r: 1.1, ai: 'matriarch', coins: 70, col: '#402050', drops: [['rope', 10, 15]], minNight: 99, boss: true, windup: 0.7, reach: 2.2, night: true, loot: 'venom_bow', armor: 'legs_spider' });
  en('frostmaw', { name: 'Frostmaw', hp: 1400, dmg: 26, spd: 4.2, r: 0.9, ai: 'frostmaw', coins: 80, col: '#a0e0ff', drops: [['wolf_pelt', 8, 12]], minNight: 99, boss: true, windup: 0.6, reach: 1.8, night: true, loot: 'frost_maul', armor: 'legs_frostmaw' });
  en('lich', { name: 'The Lich', hp: 1500, dmg: 24, spd: 2.6, r: 0.7, ai: 'lich', coins: 100, col: '#6040c0', drops: [['gold_bar', 6, 10]], minNight: 99, boss: true, windup: 0.8, reach: 8, night: true, loot: 'lich_staff', armor: 'chest_lich' });
  en('titan', { name: 'The Titan', hp: 2600, dmg: 36, spd: 1.8, r: 1.4, ai: 'titan', coins: 140, col: '#7080a0', drops: [['obsidian', 8, 12], ['stone', 20, 30]], minNight: 99, boss: true, windup: 1.2, reach: 2.6, night: true, loot: 'titan_fist', armor: 'helm_titan' });
  // bosses
  en('gronk', { name: 'Gronk, the Meadow Ogre', hp: 900, dmg: 26, spd: 2.4, r: 1.0, ai: 'gronk', coins: 60, col: '#6a8a40', drops: [['emerald', 1, 1]], minNight: 99, boss: true, windup: 1.0, reach: 2.0, loot: 'gronk_hammer', armor: 'legs_gronk' });
  en('hollow', { name: 'The Hollow King', hp: 1300, dmg: 22, spd: 2.8, r: 0.8, ai: 'hollow', coins: 90, col: '#4050a0', drops: [['sapphire', 1, 1]], minNight: 99, boss: true, windup: 0.9, reach: 2.0, loot: 'hollow_blade', armor: 'crown_hollow' });
  en('cinder', { name: 'Cinderwyrm', hp: 1800, dmg: 30, spd: 3.0, r: 1.1, ai: 'cinder', coins: 120, col: '#e04020', drops: [['ruby', 1, 1], ['ember', 3, 5]], minNight: 99, boss: true, windup: 1.0, reach: 2.4, loot: 'wyrm_fang', armor: 'chest_dragonscale' });
  en('leviathan', { name: 'The Leviathan', hp: 2600, dmg: 34, spd: 0, r: 1.6, ai: 'leviathan', coins: 0, col: '#204060', drops: [], minNight: 99, boss: true, windup: 1.2, reach: 3.0, armor: 'trinket_storm' });
  G.ENEMIES = E; G.EN_LIST = Object.keys(E); G.EN_IDX = {}; G.EN_LIST.forEach((k, i) => G.EN_IDX[k] = i);

  G.NIGHT_BOSSES = ['bonecrusher', 'warden', 'matriarch', 'frostmaw', 'lich', 'titan'];
  G.XP_FOR = (lvl) => Math.round(40 * Math.pow(1.35, lvl - 1)); // xp needed to go from lvl to lvl+1
  // permanent upgrades bought with Shards at the Camp between runs
  G.META = [
    { id: 'vitality', name: 'Vitality', desc: '+10 max HP per rank', max: 5, cost: [30, 50, 80, 120, 170] },
    { id: 'might', name: 'Might', desc: '+6% attack per rank', max: 5, cost: [30, 50, 80, 120, 170] },
    { id: 'swift', name: 'Swiftness', desc: '+4% move speed per rank', max: 5, cost: [30, 50, 80, 120, 170] },
    { id: 'fortune', name: 'Fortune', desc: '+12% coins per rank', max: 5, cost: [25, 40, 60, 90, 130] },
    { id: 'lungs', name: 'Endurance', desc: '+15% stamina regen per rank', max: 3, cost: [30, 60, 100] },
    { id: 'sense', name: 'Chest Sense', desc: 'chests 10% cheaper per rank', max: 3, cost: [40, 80, 140] },
    { id: 'sharp', name: 'Sharp Start', desc: 'start every run with a stone axe and pickaxe', max: 1, cost: [60] },
    { id: 'chance', name: 'Second Chance', desc: 'start every run with Second Wind', max: 1, cost: [120] },
    { id: 'boons', name: 'Wider Choice', desc: 'boon picks offer 4 options instead of 3', max: 1, cost: [150] },
    { id: 'scholar', name: 'Scholar', desc: '+20% XP per rank', max: 3, cost: [40, 80, 140] },
    { id: 'armory', name: 'Armory', desc: 'weapon drops get an extra affix chance', max: 2, cost: [90, 180] },
  ];
  G.BOAT_NEED = { wood: 60, iron_bar: 20, rope: 10, emerald: 1, sapphire: 1, ruby: 1 };
  // ---- cosmetics: hats sit on the head bone; the first three are free, the rest are won at the Dealer's Table or bought with shards in the Camp
  G.HATS = [
    { id: 'none', name: 'Bare head', cost: 0 }, { id: 'cap', name: 'Ball Cap', cost: 0 }, { id: 'beanie', name: 'Beanie', cost: 0 },
    { id: 'visor', name: 'Dealer Visor', cost: 60 }, { id: 'chef', name: 'Chef Hat', cost: 80 }, { id: 'tophat', name: 'Top Hat', cost: 120 }, { id: 'cowboy', name: 'Cowboy Hat', cost: 120 },
    { id: 'pirate', name: 'Pirate Hat', cost: 160 }, { id: 'horns', name: 'Devil Horns', cost: 200 }, { id: 'halo', name: 'Halo', cost: 240 }, { id: 'crown', name: 'Crown', cost: 320 },
  ];
  G.HAT = {}; G.HATS.forEach(h => G.HAT[h.id] = h);
  // playable looks (KayKit Adventurers, CC0) — purely cosmetic, picked in the lobby
  G.SKINS = [{ id: 'happy', name: 'Happy' }, { id: 'wide', name: 'Wide-eyed' }, { id: 'sleepy', name: 'Sleepy' }, { id: 'grumpy', name: 'Grumpy' }, { id: 'derp', name: 'Goofy' }];
  // tutorial steps: text shown to new players, key names are filled from the current binds, done() checks the client view
  G.TUTORIAL = [
    { id: 'move', txt: 'Look around with the mouse. Walk with {forward}{left}{back}{right}, sprint with {sprint}, jump with {jump}.', done: (V, me) => G.dist(me.x, me.y, V.world.spawn.x, V.world.spawn.y) > 4 },
    { id: 'wood', txt: 'Punch a tree (LMB) until it drops wood and sticks. Walk over drops to pick them up. You need 3 wood.', done: (V, me) => me.inv.some(s => s && s.id === 'wood' && s.n >= 3) },
    { id: 'stone', txt: 'Punch a rock the same way for stone (2 is enough).', done: (V, me) => me.inv.some(s => s && s.id === 'stone') },
    { id: 'axe', txt: 'Open crafting with {inventory}. Bright recipes are ready to make — click the highlighted Stone Axe. Hover a recipe to see what it needs.', hl: ['axe_stone'], done: (V, me) => me.inv.some(s => s && /^axe_/.test(s.id)) },
    { id: 'pick', txt: 'Craft a Stone Pickaxe too — tools harvest much faster, and pickaxes open ore veins.', hl: ['pick_stone'], done: (V, me) => me.inv.some(s => s && /^pick_/.test(s.id)) },
    { id: 'bench', txt: 'Craft a Workbench, put it on your hotbar (1–9), select it and click where you look to place it. Stand near it for better recipes.', hl: ['workbench'], done: (V) => [...V.world.objs.values()].some(o => o.t === 'workbench') },
    { id: 'fire', txt: 'Light keeps monsters away: craft a Campfire and place it, then a Torch to carry. The clock starts when the fire is lit.', hl: ['campfire', 'torch_hand', 'torch'], done: (V) => [...V.world.objs.values()].some(o => o.t === 'campfire') },
    { id: 'gear', txt: 'Gear up at the workbench: craft a Wooden Sword and a Wooden Shield (hold RMB to block). Leather armour comes later from wolf pelts — right-click armour in the inventory to equip it.', hl: ['sword_wood', 'sword_stone', 'shield_wood'], done: (V, me) => me.inv.some(s => s && (/^sword_/.test(s.id) || s.id === 'shield_wood')) },
    { id: 'food', txt: 'Grab berries from bushes and eat with {eat} when the Food bar drops.', done: (V, me) => me.inv.some(s => s && G.ITEMS[s.id] && G.ITEMS[s.id].type === 'food') },
    { id: 'night', txt: 'Survive the night near your fire. Kill what comes for XP, coins and boons.', done: (V) => V.day >= 2 },
    { id: 'casino', txt: "Find a Dealer's Table (by the wreck) and gamble coins for boons, hats and sketchy items.", done: (V, me) => (me.gambles || 0) > 0 },
    { id: 'altar', txt: 'Craft a totem for an altar, summon its guardian and slay it for a gem. Three gems repair the ship.', done: (V) => (V.stats && V.stats.bosses > 0) || Object.values(V.bosses || {}).some(b => b) },
    { id: 'boat', txt: 'Deposit repairs at the shipwreck with {interact}, then set sail — and brace for the final fight.', done: (V) => V.boat && V.boat.done },
  ];
  // ---- the Dealer's Table: gamble coins for coins, boons (skills) and hats. Odds are public so players can read them in-game.
  G.SLOT_SYMBOLS = [{ id: 'cherry', ch: '🍒', w: 30 }, { id: 'bell', ch: '🔔', w: 22 }, { id: 'bar', ch: '▬', w: 16 }, { id: 'star', ch: '★', w: 12 }, { id: 'skull', ch: '☠', w: 14 }, { id: 'seven', ch: '7', w: 6 }];
  G.CASINO = {
    slotsBets: [10, 25, 50, 100], diceBets: [10, 25, 50, 100], bjBets: [10, 25, 50, 100], wheelBets: [30, 60, 120],
    // wheel segments per bet tier: [common boon, rare boon, epic boon, legendary boon, coins x3, bust]
    wheel: [[0.40, 0.18, 0.04, 0.00, 0.14, 0.24], [0.30, 0.28, 0.10, 0.02, 0.12, 0.18], [0.18, 0.30, 0.20, 0.06, 0.10, 0.16]],
    wheelNames: ['Common boon', 'Rare boon', 'Epic boon', 'Legendary boon', 'Coins ×3', 'BUST — hexed'],
    hex: { atk: -0.15, dur: 120 },
    // one-use odds riggers sold at the table (inspired by casino party games' 'sketchy items')
    rigs: [
      { id: 'dice', name: 'Loaded Dice', cost: 40, desc: '+2 on your next Dice Duel roll' },
      { id: 'chip', name: 'Lucky Chip', cost: 60, desc: 'your next losing slots spin is re-spun once' },
      { id: 'statue', name: 'Holy Statue', cost: 90, desc: 'your next Wheel of Fates bust becomes a common boon instead' },
      { id: 'peek', name: "Dealer's Peek", cost: 50, desc: 'see the dealer\'s hidden blackjack card next hand' },
    ],
  };
  G.PLAYER_COLORS = ['#ff5a5a', '#5aa0ff', '#5aff8a', '#ffd25a', '#d05aff', '#5affff', '#ff9a5a', '#ffffff'];
})(window.G);
