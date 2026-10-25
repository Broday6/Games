'use strict';
// NIGHT TIDE — static game data: weapons, evolutions, passives, characters, meta shop.
window.NT = window.NT || {};
(function (NT) {
  NT.WEAPON_IDS = ['boom', 'shell', 'harp', 'lamp', 'tide', 'gull'];
  NT.PASSIVE_IDS = ['speed', 'might', 'area', 'cooldown', 'magnet', 'armor', 'regen', 'luck'];
  NT.MAX_LEVEL = 5;
  NT.MAX_WEAPONS = 6;
  NT.MAX_PASSIVES = 6;
  NT.RUN_LENGTH = 600; // seconds until dawn

  NT.RARITY = [
    { id: 'common', name: 'Common', color: '#cfd6e6', levels: 1 },
    { id: 'rare', name: 'Rare', color: '#4aa8ff', levels: 2 },
    { id: 'epic', name: 'Epic', color: '#c26bff', levels: 3 },
    { id: 'legendary', name: 'Legendary', color: '#ffcf4a', levels: 0 },
  ];

  // lv[i] is merged cumulatively: stats at level L = lv[0] .. lv[L-1]
  NT.WEAPONS = {
    boom: {
      name: 'Driftwood Boomerang', short: 'Boomerang', evo: 'kraken', needs: 'area',
      desc: ['Hurls a spinning boomerang at the nearest foe. It always comes back.',
        '+6 damage', '+1 boomerang', '+25% size, +5 damage', '+1 boomerang, -15% cooldown'],
      lv: [{ dmg: 16, cd: 1.25, count: 1, size: 1, speed: 360, out: 0.55 }, { dmg: 20 }, { count: 2 },
        { size: 1.25, dmg: 25 }, { count: 3, cd: 1.15 }],
      evoStats: { dmg: 40, cd: 1.0, count: 4, size: 1.7, speed: 400, out: 0.62, all: 1 },
    },
    shell: {
      name: 'Orbiting Shells', short: 'Shells', evo: 'halo', needs: 'cooldown',
      desc: ['Seashells circle you, smacking anything they touch.',
        '+1 shell', '+25% orbit size and spin', '+1 shell, +5 damage', '+1 shell, +1s active time'],
      lv: [{ dmg: 11, count: 2, radius: 66, spin: 3.2, dur: 3, off: 2.6 }, { count: 3 },
        { radius: 82, spin: 4.0 }, { count: 4, dmg: 16 }, { count: 5, dur: 4 }],
      evoStats: { dmg: 26, count: 6, radius: 96, spin: 4.4, dur: 0, off: 0, always: 1 },
    },
    harp: {
      name: 'Harpoon', short: 'Harpoon', evo: 'lance', needs: 'might',
      desc: ['Fires a fast harpoon that pierces through foes.',
        '+1 pierce, +6 damage', '+1 harpoon per volley', '+2 pierce, -12% cooldown', '+1 harpoon, +10 damage'],
      lv: [{ dmg: 22, cd: 1.1, count: 1, pierce: 2, speed: 640, size: 1 }, { pierce: 3, dmg: 28 },
        { count: 2 }, { pierce: 5, cd: 0.96 }, { count: 3, dmg: 38 }],
      evoStats: { dmg: 62, cd: 0.78, count: 3, pierce: 999, speed: 760, size: 1.6, fan: 1 },
    },
    lamp: {
      name: 'Storm Lantern', short: 'Lantern', evo: 'lighthouse', needs: 'regen',
      desc: ['A ring of lantern-light that burns nearby shadows.',
        '+20% radius', '+3 damage', '+20% radius, faster burn', '+4 damage, +15% radius'],
      lv: [{ dmg: 6, tick: 0.5, radius: 58 }, { radius: 70 }, { dmg: 9 }, { radius: 82, tick: 0.42 },
        { dmg: 13, radius: 94 }],
      evoStats: { dmg: 19, tick: 0.35, radius: 135, slow: 0.45, heal: 1 },
    },
    tide: {
      name: 'Tide Pulse', short: 'Tide Pulse', evo: 'tsunami', needs: 'armor',
      desc: ['Sends out a wave that damages and shoves foes away.',
        '+4 damage, +15% radius', '-15% cooldown', '+8 damage, stronger shove', '+20% radius, double wave'],
      lv: [{ dmg: 16, cd: 3.6, radius: 150, kb: 240, pulses: 1, expand: 0.55 }, { dmg: 20, radius: 172 },
        { cd: 3.05 }, { dmg: 28, kb: 330 }, { radius: 205, pulses: 2 }],
      evoStats: { dmg: 40, cd: 3.0, radius: 235, kb: 380, pulses: 3, expand: 0.6, stun: 0.4 },
    },
    gull: {
      name: 'Gull Summon', short: 'Gulls', evo: 'albatross', needs: 'luck',
      desc: ['A loyal gull dives on foes and splashes down.',
        '+1 gull', '+8 damage', '+1 gull, bigger splash', '+1 gull, faster dives'],
      lv: [{ dmg: 20, count: 1, splash: 26, rest: 1.0, speed: 480 }, { count: 2 }, { dmg: 28 },
        { count: 3, splash: 36 }, { count: 4, rest: 0.7, speed: 560 }],
      evoStats: { dmg: 44, count: 6, splash: 52, rest: 0.5, speed: 640, crit: 0.25 },
    },
  };

  NT.EVOS = {
    kraken: { name: 'Kraken Crescent', from: 'boom', desc: 'Four giant crescents carve out in every direction.' },
    halo: { name: 'Pearl Halo', from: 'shell', desc: 'A crown of six pearls that never stops spinning.' },
    lance: { name: 'Narwhal Lance', from: 'harp', desc: 'Triple lances that pierce everything in their path.' },
    lighthouse: { name: 'Lighthouse', from: 'lamp', desc: 'A blazing beacon. Slows shadows and mends you as it burns.' },
    tsunami: { name: 'Tsunami', from: 'tide', desc: 'Three crushing waves that stun everything they hit.' },
    albatross: { name: 'Albatross Squadron', from: 'gull', desc: 'Six great albatrosses whose dives often crit.' },
  };

  NT.PASSIVES = {
    speed: { name: 'Swiftfin', desc: '+8% move speed', color: '#7fe0ff' },
    might: { name: 'Coral Fist', desc: '+10% damage', color: '#ff7a7a' },
    area: { name: 'Wide Net', desc: '+10% area and size', color: '#9fe07a' },
    cooldown: { name: 'Tide Clock', desc: '-7% weapon cooldowns', color: '#c9a7ff' },
    magnet: { name: 'Lodestone', desc: '+30% pickup range', color: '#7aa8ff' },
    armor: { name: 'Barnacle Shell', desc: '+1 armor (less damage per hit)', color: '#d7c39a' },
    regen: { name: 'Kelp Wrap', desc: '+0.3 HP regenerated per second', color: '#5fd08a' },
    luck: { name: 'Lucky Pearl', desc: '+10% luck, +3% critical chance', color: '#ffe9a8' },
  };

  NT.CHARS = [
    { id: 'pip', name: 'Pip', title: 'The Castaway', weapon: 'boom', color: '#ffd27a', acc: 'sprout', cost: 0,
      mods: {}, perk: 'Balanced and hopeful.' },
    { id: 'wick', name: 'Wick', title: 'The Lamplighter', weapon: 'lamp', color: '#ff9a5a', acc: 'candle', cost: 120,
      mods: { area: 0.1, maxHp: 20, speed: -0.05 }, perk: '+10% area, +20 HP, -5% speed' },
    { id: 'marlin', name: 'Marlin', title: 'The Harpooner', weapon: 'harp', color: '#7fd6ff', acc: 'bandana', cost: 200,
      mods: { might: 0.15, maxHp: -15 }, perk: '+15% damage, -15 HP' },
    { id: 'skye', name: 'Skye', title: 'The Gull Caller', weapon: 'gull', color: '#f4f1ff', acc: 'feather', cost: 300,
      mods: { luck: 0.2, magnet: 0.25, speed: 0.05 }, perk: '+20% luck, +25% pickup range, +5% speed' },
    { id: 'tilly', name: 'Tilly', title: 'The Tidecaller', weapon: 'tide', color: '#8affc1', acc: 'kelp', cost: 450,
      mods: { armor: 1, cooldown: 0.08, speed: -0.06 }, perk: '+1 armor, -8% cooldowns, -6% speed' },
    { id: 'conch', name: 'Conch', title: 'The Shellkeeper', weapon: 'shell', color: '#ffb0c8', acc: 'shell', cost: 600,
      mods: { regen: 0.4, maxHp: 10 }, perk: '+0.4 HP/s regen, +10 HP' },
  ];

  NT.SHOP = [
    { id: 'hp', name: 'Hearty', desc: '+10 max HP', max: 5, cost: [25, 50, 90, 140, 200] },
    { id: 'might', name: 'Strength', desc: '+5% damage', max: 5, cost: [30, 60, 100, 150, 220] },
    { id: 'armor', name: 'Hardened', desc: '+1 armor', max: 3, cost: [60, 120, 200] },
    { id: 'speed', name: 'Fleet', desc: '+4% move speed', max: 3, cost: [40, 80, 140] },
    { id: 'magnet', name: 'Attraction', desc: '+15% pickup range', max: 3, cost: [30, 60, 100] },
    { id: 'cooldown', name: 'Haste', desc: '-3% cooldowns', max: 3, cost: [60, 120, 200] },
    { id: 'growth', name: 'Insight', desc: '+6% XP gained', max: 4, cost: [40, 80, 130, 190] },
    { id: 'greed', name: 'Greed', desc: '+12% Shards per run', max: 4, cost: [50, 100, 160, 240] },
    { id: 'reroll', name: 'Second Look', desc: '+1 card reroll per run', max: 3, cost: [50, 110, 180] },
    { id: 'revive', name: 'Second Wind', desc: 'Revive once per run at 50% HP', max: 1, cost: [300] },
  ];
})(window.NT);
