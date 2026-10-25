'use strict';
// DEEP CAST — static game data: rarities, locations, species, shop.

const RARITY = [
  { name: 'Common',    col: '#d5dde2', w: 60 },
  { name: 'Uncommon',  col: '#7ee08f', w: 26 },
  { name: 'Rare',      col: '#62b8ff', w: 10 },
  { name: 'Epic',      col: '#c99aff', w: 3.4 },
  { name: 'Legendary', col: '#ffcc4d', w: 0.9 },
];

// water: [surface colour, deep colour] at full daylight
const LOCS = [
  { id: 'harbour', name: 'Old Harbour',    depth: 25,   boat: 0, reward: 600,   rewardBait: ['shrimp', 15],
    desc: 'Lamplit piers, gulls and patient old fishers.', water: ['#3d93b2', '#0e3a50'],
    weather: { clear: 46, rain: 26, fog: 16, storm: 12 } },
  { id: 'kelp',    name: 'Kelp Forest',    depth: 45,   boat: 1, reward: 1600,  rewardBait: ['squid', 15],
    desc: 'Swaying green cathedrals over rocky reef.', water: ['#2f9d8e', '#0a3a33'],
    weather: { clear: 40, rain: 24, fog: 24, storm: 12 } },
  { id: 'open',    name: 'Open Sea',       depth: 220,  boat: 2, reward: 4500,  rewardBait: ['glow', 15],
    desc: 'Blue water to every horizon. Big fish, big storms.', water: ['#2283c4', '#06213f'],
    weather: { clear: 42, rain: 22, fog: 14, storm: 22 } },
  { id: 'trench',  name: 'Abyssal Trench', depth: 2400, boat: 3, reward: 11000, rewardBait: ['golden', 4],
    desc: 'The shelf drops away into black. Things glow down there.', water: ['#1d5486', '#02060f'],
    weather: { clear: 38, rain: 22, fog: 26, storm: 14 } },
  { id: 'vent',    name: 'Volcanic Vent',  depth: 650,  boat: 4, reward: 25000, rewardBait: ['golden', 8],
    desc: 'Ash skies over boiling water. Fortune for the brave.', water: ['#3b6a7c', '#1c0906'],
    weather: { clear: 30, rain: 14, fog: 30, storm: 26 } },
];
const LOC_BY_ID = Object.fromEntries(LOCS.map(l => [l.id, l]));

// Species. t: time (any/day/night/dawn/dusk/twilight)  w: weather (any/clear/rain/fog/storm/wet)
// d: depth band as fraction of location depth.  kg: weight range.  p: base price.  b: behaviour.  df: difficulty 0..1
// a: art — sh shape, h height ratio, c body, bl belly, f fin, pat pattern, pc pattern colour, tail, dor dorsal, dt dorsal type, eye, x extras, glow
const SPECIES = [
  // ---------------- Old Harbour ----------------
  { id: 'sardine', name: 'Sardine', loc: 'harbour', r: 0, b: 'calm', df: .10, kg: [.05, .25], p: 5, t: 'any', w: 'any', d: [0, .45],
    a: { sh: 'fusi', h: .24, c: '#8fb3cc', bl: '#eef4f8', f: '#6f8fa8', pat: 'stripeH', pc: '#3e6487', tail: 'fork', dor: .4 } },
  { id: 'mackerel', name: 'Mackerel', loc: 'harbour', r: 0, b: 'darting', df: .25, kg: [.3, 1.4], p: 11, t: 'day', w: 'any', d: [0, .5],
    a: { sh: 'fusi', h: .22, c: '#3f8f7f', bl: '#e9efe9', f: '#2f6c63', pat: 'bands', pc: '#17363a', tail: 'fork', dor: .45, x: ['finlets'] } },
  { id: 'bream', name: 'Sea Bream', loc: 'harbour', r: 0, b: 'calm', df: .2, kg: [.4, 2.2], p: 10, t: 'any', w: 'any', d: [.1, .6],
    a: { sh: 'deep', h: .44, c: '#b8bfc9', bl: '#eef0f2', f: '#8e9aa8', pat: 'stripeV', pc: 'rgba(90,100,120,.35)', tail: 'fork', dor: .7, dt: 'spiny' } },
  { id: 'mullet', name: 'Grey Mullet', loc: 'harbour', r: 0, b: 'calm', df: .25, kg: [.5, 3], p: 14, t: 'twilight', w: 'any', d: [0, .4],
    a: { sh: 'fusi', h: .25, c: '#7d8a96', bl: '#dfe4e8', f: '#5e6b77', pat: 'stripeH', pc: '#59687a', tail: 'fork', dor: .4 } },
  { id: 'flounder', name: 'Flounder', loc: 'harbour', r: 1, b: 'sinker', df: .35, kg: [.5, 3.5], p: 24, t: 'any', w: 'any', d: [.35, .65],
    a: { sh: 'flat', h: .52, c: '#9a8466', bl: '#b9a47e', f: '#7d6a50', pat: 'spots', pc: '#5d4c37', tail: 'round', eye: 1.1, x: ['fringe'] } },
  { id: 'puffer', name: 'Pufferfish', loc: 'harbour', r: 1, b: 'erratic', df: .45, kg: [.2, 1.2], p: 30, t: 'day', w: 'clear', d: [.1, .6],
    a: { sh: 'puff', h: .8, c: '#d9c27a', bl: '#f4ecd0', f: '#b79e55', pat: 'spots', pc: '#5b4a2a', tail: 'round', eye: 1.3, x: ['spikes'] } },
  { id: 'conger', name: 'Conger Eel', loc: 'harbour', r: 1, b: 'sinker', df: .45, kg: [1, 12], p: 38, t: 'night', w: 'any', d: [.4, 1],
    a: { sh: 'eel', h: .11, c: '#4c5560', bl: '#9aa3ab', f: '#3a424c', tail: 'point', eye: 1.2 } },
  { id: 'seabass', name: 'Sea Bass', loc: 'harbour', r: 2, b: 'darting', df: .55, kg: [1, 9], p: 72, t: 'dusk', w: 'any', d: [.2, .65],
    a: { sh: 'fusi', h: .3, c: '#7f97a8', bl: '#e3eaee', f: '#5c7385', pat: 'scales', pc: 'rgba(40,60,80,.25)', tail: 'square', dor: .65, dt: 'spiny' } },
  { id: 'harbourmaster', name: 'The Harbourmaster', loc: 'harbour', r: 4, b: 'legend', df: .82, kg: [40, 90], p: 1800, t: 'night', w: 'wet', d: [.55, 1],
    hint: 'An old cod the size of a dinghy. Wet nights, deep under the pier.',
    a: { sh: 'fusi', h: .31, c: '#6e7d5d', bl: '#d8d8c0', f: '#4f5a40', pat: 'mottle', pc: '#3c452f', tail: 'square', dor: .55, x: ['whisk', 'crown'], glow: '#ffe9a0' } },

  // ---------------- Kelp Forest ----------------
  { id: 'perch', name: 'Kelp Perch', loc: 'kelp', r: 0, b: 'calm', df: .2, kg: [.2, 1], p: 18, t: 'any', w: 'any', d: [0, .5],
    a: { sh: 'deep', h: .38, c: '#a88b5e', bl: '#e6d7b8', f: '#8a6e43', pat: 'stripeV', pc: 'rgba(90,60,30,.45)', tail: 'fork', dor: .6, dt: 'spiny' } },
  { id: 'rockfish', name: 'Rockfish', loc: 'kelp', r: 0, b: 'sinker', df: .3, kg: [.5, 3], p: 24, t: 'any', w: 'any', d: [.35, .9],
    a: { sh: 'fusi', h: .35, c: '#c0583f', bl: '#efb69a', f: '#9e3f2c', pat: 'mottle', pc: '#7a2a1e', tail: 'square', dor: .8, dt: 'spiny', eye: 1.35 } },
  { id: 'garibaldi', name: 'Garibaldi', loc: 'kelp', r: 1, b: 'darting', df: .4, kg: [.3, 1.2], p: 42, t: 'day', w: 'any', d: [0, .5],
    a: { sh: 'deep', h: .46, c: '#ff7a1a', bl: '#ffa64e', f: '#ff6a00', tail: 'round', dor: .6 } },
  { id: 'sheephead', name: 'Sheephead', loc: 'kelp', r: 1, b: 'calm', df: .4, kg: [1, 8], p: 52, t: 'day', w: 'any', d: [.2, .7],
    a: { sh: 'deep', h: .38, c: '#d64f5a', bl: '#f2cbc6', f: '#2a2a32', pat: 'sheep', pc: '#232129', tail: 'lunate', dor: .5, x: ['teeth'] } },
  { id: 'pipefish', name: 'Kelp Pipefish', loc: 'kelp', r: 1, b: 'erratic', df: .45, kg: [.05, .3], p: 46, t: 'any', w: 'any', d: [0, .6],
    a: { sh: 'eel', h: .07, c: '#8fa64a', bl: '#c9d68a', f: '#6b7f30', pat: 'bands', pc: '#5d6e2a', tail: 'round' } },
  { id: 'lingcod', name: 'Lingcod', loc: 'kelp', r: 2, b: 'sinker', df: .55, kg: [3, 20], p: 115, t: 'any', w: 'wet', d: [.45, 1],
    a: { sh: 'fusi', h: .24, c: '#7a8150', bl: '#cfd2a0', f: '#5a603a', pat: 'mottle', pc: '#424625', tail: 'round', dor: .7, x: ['teeth'] } },
  { id: 'wolfeel', name: 'Wolf Eel', loc: 'kelp', r: 2, b: 'sinker', df: .6, kg: [5, 18], p: 140, t: 'night', w: 'any', d: [.5, 1],
    a: { sh: 'eel', h: .13, c: '#7f8790', bl: '#b7bec4', f: '#5f676f', pat: 'spots', pc: '#3d434a', tail: 'point', eye: 1.2, x: ['bigmouth'] } },
  { id: 'leafydragon', name: 'Leafy Seadragon', loc: 'kelp', r: 3, b: 'erratic', df: .7, kg: [.1, .4], p: 380, t: 'dawn', w: 'fog', d: [.15, .7],
    a: { sh: 'eel', h: .14, c: '#c9a94a', bl: '#e9d48a', f: '#9db346', pat: 'bands', pc: '#a58533', tail: 'point', x: ['leafy'] } },
  { id: 'kelpjaw', name: 'Old Kelpjaw', loc: 'kelp', r: 4, b: 'legend', df: .86, kg: [25, 60], p: 2600, t: 'any', w: 'fog', d: [.75, 1],
    hint: 'Wears the forest as a beard. Only stirs in thick fog, at the very bottom.',
    a: { sh: 'deep', h: .42, c: '#3f6b3a', bl: '#a7c58d', f: '#2c4a28', pat: 'mottle', pc: '#26401f', tail: 'round', dor: .7, dt: 'spiny', x: ['leafy', 'teeth', 'crown'], glow: '#b6ff9a' } },

  // ---------------- Open Sea ----------------
  { id: 'herring', name: 'Herring', loc: 'open', r: 0, b: 'calm', df: .2, kg: [.1, .6], p: 20, t: 'any', w: 'any', d: [0, .5],
    a: { sh: 'fusi', h: .24, c: '#7aa4c4', bl: '#f1f6fa', f: '#5a85a8', tail: 'fork', dor: .4 } },
  { id: 'bonito', name: 'Bonito', loc: 'open', r: 0, b: 'darting', df: .35, kg: [1, 5], p: 34, t: 'day', w: 'any', d: [0, .6],
    a: { sh: 'fusi', h: .27, c: '#33507a', bl: '#e8eef4', f: '#253d5e', pat: 'stripeH', pc: '#1b2c45', tail: 'lunate', dor: .5, x: ['finlets'] } },
  { id: 'flyingfish', name: 'Flying Fish', loc: 'open', r: 1, b: 'erratic', df: .5, kg: [.2, 1], p: 60, t: 'day', w: 'clear', d: [0, .3],
    a: { sh: 'fusi', h: .22, c: '#4a7fc0', bl: '#eaf2fb', f: '#8fc0f0', tail: 'fork', dor: .3, x: ['wings'] } },
  { id: 'mahi', name: 'Mahi-Mahi', loc: 'open', r: 1, b: 'darting', df: .5, kg: [3, 18], p: 90, t: 'day', w: 'any', d: [.1, .6],
    a: { sh: 'fusi', h: .3, c: '#3fb27f', bl: '#f2e04a', f: '#2f8fc0', pat: 'spots', pc: '#2b6fb0', tail: 'fork', dor: .9, dt: 'long' } },
  { id: 'sunfish', name: 'Ocean Sunfish', loc: 'open', r: 2, b: 'calm', df: .5, kg: [50, 400], p: 260, t: 'day', w: 'clear', d: [0, .5],
    a: { sh: 'mola', h: .85, c: '#9aa7b0', bl: '#d8dee2', f: '#7f8b94', pat: 'mottle', pc: '#c7cfd4' } },
  { id: 'tuna', name: 'Yellowfin Tuna', loc: 'open', r: 2, b: 'darting', df: .7, kg: [20, 120], p: 320, t: 'any', w: 'any', d: [.3, .85],
    a: { sh: 'fusi', h: .28, c: '#24406a', bl: '#e6ecf2', f: '#f5c518', tail: 'lunate', dor: .6, x: ['finlets'] } },
  { id: 'blueshark', name: 'Blue Shark', loc: 'open', r: 2, b: 'erratic', df: .65, kg: [30, 150], p: 300, t: 'any', w: 'wet', d: [.4, 1],
    a: { sh: 'shark', h: .2, c: '#3e6fc0', bl: '#e7eef8', f: '#335fa8', tail: 'shark', dor: .7 } },
  { id: 'swordfish', name: 'Swordfish', loc: 'open', r: 3, b: 'darting', df: .8, kg: [50, 300], p: 720, t: 'night', w: 'any', d: [.5, 1],
    a: { sh: 'fusi', h: .22, c: '#3f4b6a', bl: '#c9ced8', f: '#323c56', tail: 'lunate', dor: .8, dt: 'sail', x: ['bill'] } },
  { id: 'manta', name: 'Manta Ray', loc: 'open', r: 3, b: 'calm', df: .72, kg: [300, 1300], p: 820, t: 'night', w: 'clear', d: [.2, .7],
    a: { sh: 'ray', h: .6, c: '#2a3240', bl: '#e8ecf0', f: '#1f2530', pat: 'spots', pc: '#dfe5ea' } },
  { id: 'marlin', name: 'Storm Marlin', loc: 'open', r: 4, b: 'legend', df: .92, kg: [300, 700], p: 4200, t: 'day', w: 'storm', d: [.6, 1],
    hint: 'Rides the lightning. Hunts the deep when storms break by day.',
    a: { sh: 'fusi', h: .24, c: '#1f4f9a', bl: '#d6e6f5', f: '#2a6ad0', pat: 'stripeV', pc: '#7fc7ff', tail: 'lunate', dor: 1, dt: 'sail', x: ['bill', 'crown'], glow: '#9fe0ff' } },

  // ---------------- Abyssal Trench ----------------
  { id: 'lanternfish', name: 'Lanternfish', loc: 'trench', r: 0, b: 'calm', df: .25, kg: [.02, .1], p: 55, t: 'any', w: 'any', d: [0, .6],
    a: { sh: 'fusi', h: .25, c: '#2e3f55', bl: '#5a6b80', f: '#22314a', pat: 'dots', pc: '#7fe6ff', tail: 'fork', dor: .35, eye: 1.6 } },
  { id: 'hatchet', name: 'Hatchetfish', loc: 'trench', r: 0, b: 'erratic', df: .35, kg: [.02, .12], p: 60, t: 'any', w: 'any', d: [.1, .6],
    a: { sh: 'hatchet', h: .62, c: '#9fb2c4', bl: '#e6eef5', f: '#6e8296', pat: 'dots', pc: '#a8f0ff', tail: 'fork', dor: .3, eye: 1.8 } },
  { id: 'grenadier', name: 'Grenadier', loc: 'trench', r: 0, b: 'sinker', df: .3, kg: [1, 6], p: 70, t: 'any', w: 'any', d: [.4, 1],
    a: { sh: 'longtail', h: .22, c: '#6b6058', bl: '#9a8f86', f: '#534a43', tail: 'point', dor: .5, eye: 1.7, x: ['whisk'] } },
  { id: 'viperfish', name: 'Viperfish', loc: 'trench', r: 1, b: 'darting', df: .55, kg: [.1, .4], p: 130, t: 'night', w: 'any', d: [.3, .8],
    a: { sh: 'fusi', h: .2, c: '#2b3a4a', bl: '#4a5f74', f: '#1f2a36', pat: 'dots', pc: '#6fffd0', tail: 'fork', dor: .3, eye: 1.4, x: ['teeth', 'bigmouth'] } },
  { id: 'gulper', name: 'Gulper Eel', loc: 'trench', r: 1, b: 'erratic', df: .55, kg: [.5, 3], p: 150, t: 'any', w: 'any', d: [.5, 1],
    a: { sh: 'eel', h: .15, c: '#1e1e2a', bl: '#33334a', f: '#151520', tail: 'point', x: ['bigmouth', 'tailglow'], glow: '#ff6ad5' } },
  { id: 'angler', name: 'Anglerfish', loc: 'trench', r: 2, b: 'sinker', df: .65, kg: [2, 20], p: 320, t: 'any', w: 'any', d: [.6, 1],
    a: { sh: 'angler', h: .62, c: '#3a3540', bl: '#5a5260', f: '#2a252e', tail: 'round', eye: .8, x: ['lure', 'teeth'], glow: '#b0ffef' } },
  { id: 'barreleye', name: 'Barreleye', loc: 'trench', r: 2, b: 'calm', df: .6, kg: [.1, .6], p: 380, t: 'any', w: 'fog', d: [.3, .8],
    a: { sh: 'fusi', h: .3, c: '#4a4f5a', bl: '#7a8090', f: '#3a3e48', tail: 'fork', dor: .4, eye: 0, x: ['tube'] } },
  { id: 'frilled', name: 'Frilled Shark', loc: 'trench', r: 3, b: 'erratic', df: .8, kg: [10, 60], p: 900, t: 'night', w: 'any', d: [.7, 1],
    a: { sh: 'eel', h: .13, c: '#5a4a42', bl: '#8a7a70', f: '#43362f', tail: 'point', eye: 1.2, x: ['frill', 'teeth'] } },
  { id: 'lanternking', name: 'The Lantern King', loc: 'trench', r: 4, b: 'legend', df: .95, kg: [80, 220], p: 5200, t: 'night', w: 'any', d: [.86, 1],
    hint: 'A crown of light in the black. Only the deepest line, only at night.',
    a: { sh: 'angler', h: .64, c: '#271e34', bl: '#47355c', f: '#1a1324', tail: 'round', eye: .9, x: ['lure', 'teeth', 'crown'], glow: '#ffd86b' } },

  // ---------------- Volcanic Vent ----------------
  { id: 'goby', name: 'Cinder Goby', loc: 'vent', r: 0, b: 'calm', df: .25, kg: [.1, .5], p: 80, t: 'any', w: 'any', d: [0, .5],
    a: { sh: 'fusi', h: .24, c: '#5a4a44', bl: '#a08070', f: '#3e3230', pat: 'spots', pc: '#ff8a3d', tail: 'round', dor: .5, eye: 1.3 } },
  { id: 'eelpout', name: 'Vent Eelpout', loc: 'vent', r: 0, b: 'sinker', df: .35, kg: [.5, 3], p: 95, t: 'any', w: 'any', d: [.4, 1],
    a: { sh: 'eel', h: .15, c: '#c78a6a', bl: '#f0c8b0', f: '#a56a4c', tail: 'round', eye: 1.2 } },
  { id: 'snapper', name: 'Magma Snapper', loc: 'vent', r: 1, b: 'darting', df: .5, kg: [2, 10], p: 180, t: 'any', w: 'any', d: [.1, .6],
    a: { sh: 'deep', h: .36, c: '#e0402a', bl: '#ffb08a', f: '#b02a1a', tail: 'fork', dor: .7, dt: 'spiny' } },
  { id: 'ashray', name: 'Ash Ray', loc: 'vent', r: 1, b: 'calm', df: .5, kg: [5, 30], p: 200, t: 'any', w: 'any', d: [.3, .8],
    a: { sh: 'ray', h: .6, c: '#6a6a70', bl: '#b0b0b8', f: '#4a4a50', pat: 'spots', pc: '#ff9a50' } },
  { id: 'wrasse', name: 'Flame Wrasse', loc: 'vent', r: 1, b: 'erratic', df: .55, kg: [.3, 2], p: 210, t: 'day', w: 'any', d: [0, .6],
    a: { sh: 'fusi', h: .3, c: '#ff9a2a', bl: '#ffe07a', f: '#ff4a2a', pat: 'stripeH', pc: '#d02a6a', tail: 'round', dor: .55 } },
  { id: 'sulfurpuffer', name: 'Sulfur Puffer', loc: 'vent', r: 2, b: 'erratic', df: .7, kg: [.5, 3], p: 420, t: 'any', w: 'fog', d: [.2, .7],
    a: { sh: 'puff', h: .8, c: '#e5e04a', bl: '#fff8b0', f: '#b8b02a', pat: 'spots', pc: '#6a6a1a', tail: 'round', eye: 1.3, x: ['spikes'] } },
  { id: 'grouper', name: 'Obsidian Grouper', loc: 'vent', r: 2, b: 'sinker', df: .75, kg: [20, 120], p: 520, t: 'night', w: 'any', d: [.6, 1],
    a: { sh: 'deep', h: .4, c: '#1c1a22', bl: '#2e2a36', f: '#121016', pat: 'cracks', pc: '#ff6a1a', tail: 'round', dor: .6, dt: 'spiny' } },
  { id: 'basaltshark', name: 'Basalt Shark', loc: 'vent', r: 3, b: 'darting', df: .85, kg: [80, 350], p: 1400, t: 'any', w: 'wet', d: [.5, 1],
    a: { sh: 'shark', h: .21, c: '#3a3634', bl: '#7a7270', f: '#2a2624', pat: 'cracks', pc: '#ff7a3a', tail: 'shark', dor: .7 } },
  { id: 'calderawyrm', name: 'Caldera Wyrm', loc: 'vent', r: 4, b: 'legend', df: .98, kg: [150, 480], p: 7500, t: 'night', w: 'storm', d: [.8, 1],
    hint: 'Coils in the magma chimneys. Surfaces only for a stormy night.',
    a: { sh: 'eel', h: .14, c: '#7a1a10', bl: '#ff7a3a', f: '#3a0a08', pat: 'cracks', pc: '#ffcf5a', tail: 'point', eye: 1.2, x: ['frill', 'crown', 'teeth'], glow: '#ffb040' } },
];
const SP_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
for (const s of SPECIES) {
  s.mid = (s.kg[0] + s.kg[1]) / 2;
  // drawn length scale in scene, by typical weight
  s.sz = Math.max(0.42, Math.min(1.7, 0.45 + 0.3 * Math.log10(s.mid * 8 + 1)));
}

// ---------------- shop ----------------
// zone = catch zone height (fraction of bar), reel = progress fill multiplier, win = extra hook window (s)
const RODS = [
  { name: 'Bamboo Rod',     price: 0,     zone: .26, reel: 1.00, win: 0,   col: '#c9a25a', desc: 'Grandad\'s old faithful.' },
  { name: 'Fiberglass Rod', price: 300,   zone: .29, reel: 1.12, win: .05, col: '#e8e2d0', desc: 'Light, forgiving, a little springy.' },
  { name: 'Carbon Rod',     price: 1300,  zone: .32, reel: 1.25, win: .10, col: '#2b2f38', desc: 'Stiff and fast. Feels every twitch.' },
  { name: 'Tidecaller',     price: 4500,  zone: .35, reel: 1.42, win: .15, col: '#3fb8c8', desc: 'Hums softly near the water.' },
  { name: 'Leviathan Rod',  price: 12000, zone: .39, reel: 1.62, win: .20, col: '#ffcc4d', desc: 'Forged for monsters. Gold-wound guides.' },
];
// reach = max depth fraction of a location the hook can reach
const LINES = [
  { name: 'Cotton Twine',  price: 0,    reach: .45, desc: 'Reaches the shallows.' },
  { name: 'Monofilament',  price: 220,  reach: .65, desc: 'Down into mid-water.' },
  { name: 'Braided Line',  price: 1100, reach: .84, desc: 'Thin, strong, goes deep.' },
  { name: 'Steel Leader',  price: 3800, reach: 1.0, desc: 'Touches the very bottom of anything.' },
];
const BOATS = [
  { name: 'Rowboat',         price: 0,     loc: 'harbour', hull: '#8a5a35', trim: '#c99a5a', desc: 'Two oars and a dream.' },
  { name: 'Sea Skiff',       price: 350,   loc: 'kelp',    hull: '#3a6fa0', trim: '#f2efe6', desc: 'Outboard motor. Reaches the Kelp Forest.' },
  { name: 'Trawler',         price: 1900,  loc: 'open',    hull: '#b8402f', trim: '#f2efe6', desc: 'Cabin and radio. Sails the Open Sea.' },
  { name: 'Deepwinch Barge', price: 6500,  loc: 'trench',  hull: '#e0b02a', trim: '#2b2f38', desc: 'A winch for the Abyssal Trench.' },
  { name: 'Heatshield Hull', price: 16000, loc: 'vent',    hull: '#3c3f46', trim: '#ff7a2a', desc: 'Ceramic plates. Survives the Volcanic Vent.' },
];
const COOLERS = [
  { name: 'Tackle Bucket', price: 0,    cap: 8 },
  { name: 'Small Cooler',  price: 300,  cap: 12 },
  { name: 'Ice Chest',     price: 1000, cap: 18 },
  { name: 'Deck Freezer',  price: 3200, cap: 26 },
  { name: 'Cold Hold',     price: 8500, cap: 40 },
];
// bait: bite = wait multiplier, rare = rarity bias, attract = species ids x3, beh = behaviour attracted x2, locs = location boost
const BAITS = [
  { id: 'none',    name: 'Bare Hook',   price: 0,   pack: 0,  bite: 1.25, rare: 0,   desc: 'Free, slow, hopeful.', col: '#9aa' },
  { id: 'worm',    name: 'Worms',       price: 15,  pack: 10, bite: .85,  rare: .05, attract: ['bream', 'perch', 'flounder', 'mullet'], desc: 'Faster bites. Bream, perch and flatfish love them.', col: '#d77a7a' },
  { id: 'shrimp',  name: 'Shrimp',      price: 45,  pack: 10, bite: .8,   rare: .18, attract: ['seabass', 'garibaldi', 'sheephead', 'lingcod', 'rockfish'], desc: 'Reef fish and bass can\'t resist.', col: '#ff9a7a' },
  { id: 'spinner', name: 'Spinner',     price: 120, pack: 10, bite: .55,  rare: .05, beh: 'darting', desc: 'Very fast bites. Attracts darting hunters.', col: '#cfd8e0' },
  { id: 'squid',   name: 'Squid Strip', price: 95,  pack: 10, bite: .85,  rare: .3,  attract: ['tuna', 'swordfish', 'blueshark', 'mahi', 'wolfeel', 'marlin'], desc: 'Big predators follow the scent.', col: '#e8d0e0' },
  { id: 'glow',    name: 'Glow Lure',   price: 220, pack: 10, bite: .8,   rare: .35, attract: ['lanternfish', 'angler', 'viperfish', 'barreleye', 'frilled', 'lanternking'], night: true, desc: 'Deep and night fish swarm it. Stronger after dark.', col: '#7fffe0' },
  { id: 'ember',   name: 'Ember Bait',  price: 320, pack: 10, bite: .75,  rare: .35, locs: ['vent'], desc: 'Smoulders underwater. Vent fish bite eagerly.', col: '#ff8a3d' },
  { id: 'golden',  name: 'Golden Lure', price: 800, pack: 3,  bite: .9,   rare: .9,  legend: 5, desc: 'Legendaries take notice. Heavy rarity bias.', col: '#ffcc4d' },
];
const BAIT_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));

const WEATHER_INFO = {
  clear: { name: 'Clear', bite: 1,   rare: 0 },
  rain:  { name: 'Rain',  bite: .75, rare: .15 },
  fog:   { name: 'Fog',   bite: 1,   rare: .4 },
  storm: { name: 'Storm', bite: .9,  rare: .8 },
};
