// DRIFTWOOD — game data tables
(function (G) {
  'use strict';

  G.TS = 16;                 // tile size in px (internal resolution)
  G.WORLD = 160;             // world is WORLD x WORLD tiles
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
    I['sword_' + t] = { id: 'sword_' + t, name: TNAME[i] + ' Sword', type: 'weapon', tier, dmg: [7, 12, 19, 28, 40][i], spd: 2.6, reach: 1.6, arc: 2.0, kb: 4, col: TIERCOL[i] };
    if (i >= 2) {
      I['helm_' + t] = { id: 'helm_' + t, name: TNAME[i] + ' Helm', type: 'armor', slot: 'head', def: [0, 0, 6, 10, 15][i], col: TIERCOL[i] };
      I['chest_' + t] = { id: 'chest_' + t, name: TNAME[i] + ' Chestplate', type: 'armor', slot: 'chest', def: [0, 0, 10, 16, 24][i], col: TIERCOL[i] };
      I['legs_' + t] = { id: 'legs_' + t, name: TNAME[i] + ' Leggings', type: 'armor', slot: 'legs', def: [0, 0, 8, 13, 20][i], col: TIERCOL[i] };
    }
  });
  I.helm_leather = { id: 'helm_leather', name: 'Leather Cap', type: 'armor', slot: 'head', def: 3, col: '#8d7a68' };
  I.chest_leather = { id: 'chest_leather', name: 'Leather Tunic', type: 'armor', slot: 'chest', def: 5, col: '#8d7a68' };
  I.legs_leather = { id: 'legs_leather', name: 'Leather Pants', type: 'armor', slot: 'legs', def: 4, col: '#8d7a68' };
  I.spear_iron = { id: 'spear_iron', name: 'Iron Spear', type: 'weapon', tier: 3, dmg: 16, spd: 2.2, reach: 2.4, arc: 0.7, kb: 6, col: '#c8c8d0' };
  I.hammer_gold = { id: 'hammer_gold', name: 'Golden Warhammer', type: 'weapon', tier: 4, dmg: 45, spd: 1.1, reach: 1.7, arc: 2.6, kb: 10, col: '#ffd24a' };
  I.blade_ember = { id: 'blade_ember', name: 'Emberblade', type: 'weapon', tier: 5, dmg: 34, spd: 3.2, reach: 1.7, arc: 2.0, kb: 4, burn: true, col: '#ff8a3a' };
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
  rec('iron_bar', 1, { iron_ore: 2, coal: 1 }, 'furnace'); rec('gold_bar', 1, { gold_ore: 2, coal: 1 }, 'furnace');
  rec('coal', 2, { wood: 3 }, 'furnace');
  rec('anvil', 1, { iron_bar: 8, stone: 10 }, 'workbench');
  rec('axe_iron', 1, { iron_bar: 4, stick: 2 }, 'anvil'); rec('pick_iron', 1, { iron_bar: 4, stick: 2 }, 'anvil');
  rec('sword_iron', 1, { iron_bar: 6, stick: 1 }, 'anvil'); rec('spear_iron', 1, { iron_bar: 4, stick: 4 }, 'anvil');
  rec('bow_iron', 1, { iron_bar: 4, wood: 4, rope: 3 }, 'anvil'); rec('shield_iron', 1, { iron_bar: 6, wood: 2 }, 'anvil');
  rec('helm_iron', 1, { iron_bar: 5 }, 'anvil'); rec('chest_iron', 1, { iron_bar: 8 }, 'anvil'); rec('legs_iron', 1, { iron_bar: 6 }, 'anvil');
  rec('axe_gold', 1, { gold_bar: 4, stick: 2 }, 'anvil'); rec('pick_gold', 1, { gold_bar: 4, stick: 2 }, 'anvil');
  rec('sword_gold', 1, { gold_bar: 6, stick: 1 }, 'anvil'); rec('hammer_gold', 1, { gold_bar: 10, wood: 4 }, 'anvil');
  rec('bow_gold', 1, { gold_bar: 5, wood: 4, rope: 3 }, 'anvil');
  rec('helm_gold', 1, { gold_bar: 5 }, 'anvil'); rec('chest_gold', 1, { gold_bar: 8 }, 'anvil'); rec('legs_gold', 1, { gold_bar: 6 }, 'anvil');
  rec('axe_obsidian', 1, { obsidian: 6, gold_bar: 2 }, 'anvil'); rec('pick_obsidian', 1, { obsidian: 6, gold_bar: 2 }, 'anvil');
  rec('sword_obsidian', 1, { obsidian: 8, gold_bar: 2 }, 'anvil'); rec('blade_ember', 1, { obsidian: 6, ember: 3, gold_bar: 2 }, 'anvil');
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
  obj('tree', { name: 'Tree', hp: 12, tool: 'axe', tier: 1, drops: [['wood', 3, 5], ['stick', 0, 2]], tall: true });
  obj('birch', { name: 'Birch', hp: 16, tool: 'axe', tier: 1, drops: [['wood', 5, 8], ['stick', 1, 2]], tall: true });
  obj('deadtree', { name: 'Dead Tree', hp: 10, tool: 'axe', tier: 1, drops: [['wood', 2, 3], ['coal', 1, 3]], tall: true });
  obj('rock', { name: 'Rock', hp: 14, tool: 'pick', tier: 1, drops: [['stone', 3, 5]] });
  obj('coal_rock', { name: 'Coal Deposit', hp: 16, tool: 'pick', tier: 1, drops: [['coal', 2, 4], ['stone', 1, 2]] });
  obj('iron_vein', { name: 'Iron Vein', hp: 24, tool: 'pick', tier: 2, drops: [['iron_ore', 2, 4], ['stone', 1, 2]] });
  obj('gold_vein', { name: 'Gold Vein', hp: 34, tool: 'pick', tier: 3, drops: [['gold_ore', 2, 3]] });
  obj('obsidian_vein', { name: 'Obsidian Vein', hp: 50, tool: 'pick', tier: 4, drops: [['obsidian', 2, 4]] });
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
  en('bat', { name: 'Bat', hp: 6, dmg: 3, spd: 5.5, r: 0.2, ai: 'bat', coins: 1, col: '#503060', drops: [], minNight: 1, windup: 0.2, reach: 0.6 });
  en('wolf_pet', { name: 'Wolf Companion', hp: 80, dmg: 12, spd: 5.5, r: 0.4, ai: 'pet', coins: 0, col: '#d0c0a0', drops: [], minNight: 99, windup: 0.3, reach: 1.0 });
  en('tentacle', { name: 'Tentacle', hp: 120, dmg: 18, spd: 0, r: 0.6, ai: 'tentacle', coins: 5, col: '#3a5a7a', drops: [], minNight: 99, windup: 0.9, reach: 2.6 });
  // bosses
  en('gronk', { name: 'Gronk, the Meadow Ogre', hp: 900, dmg: 26, spd: 2.4, r: 1.0, ai: 'gronk', coins: 60, col: '#6a8a40', drops: [['emerald', 1, 1]], minNight: 99, boss: true, windup: 1.0, reach: 2.0 });
  en('hollow', { name: 'The Hollow King', hp: 1300, dmg: 22, spd: 2.8, r: 0.8, ai: 'hollow', coins: 90, col: '#4050a0', drops: [['sapphire', 1, 1]], minNight: 99, boss: true, windup: 0.9, reach: 2.0 });
  en('cinder', { name: 'Cinderwyrm', hp: 1800, dmg: 30, spd: 3.0, r: 1.1, ai: 'cinder', coins: 120, col: '#e04020', drops: [['ruby', 1, 1], ['ember', 3, 5]], minNight: 99, boss: true, windup: 1.0, reach: 2.4 });
  en('leviathan', { name: 'The Leviathan', hp: 2600, dmg: 34, spd: 0, r: 1.6, ai: 'leviathan', coins: 0, col: '#204060', drops: [], minNight: 99, boss: true, windup: 1.2, reach: 3.0 });
  G.ENEMIES = E; G.EN_LIST = Object.keys(E); G.EN_IDX = {}; G.EN_LIST.forEach((k, i) => G.EN_IDX[k] = i);

  G.BOAT_NEED = { wood: 60, iron_bar: 20, rope: 10, emerald: 1, sapphire: 1, ruby: 1 };
  G.PLAYER_COLORS = ['#ff5a5a', '#5aa0ff', '#5aff8a', '#ffd25a', '#d05aff', '#5affff', '#ff9a5a', '#ffffff'];
})(window.G);
