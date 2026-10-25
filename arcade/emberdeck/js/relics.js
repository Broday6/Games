'use strict';
// EMBER DECK — relics and potions. Hooks are called by the combat engine with the helper `G` and the relic instance `R`.
(function (root) {
  const ED = root.ED;
  const RELICS = ED.RELICS = {};
  function relic(k, o) { o.k = k; o.c = o.c || 'any'; RELICS[k] = o; }

  // ----- starters -----
  relic('driftcharm', { n: 'Driftwood Charm', r: 'starter', c: 'cast', art: 'charm', d: 'At the end of combat, heal 6 HP.',
    combatEnd(run, R, C) { if (C.p.hp > 0) return { heal: 6 }; } });
  relic('emberlocket', { n: 'Ember Locket', r: 'starter', c: 'witch', art: 'locket', d: 'Whenever you Exhaust a card, apply 3 Burn to a random enemy.',
    onExhaust(G) { const e = G.randomEnemy(); if (e) { G.flash('emberlocket'); G.apply(e, 'burn', 3); } } });
  relic('fishhook', { n: "Fisher's Hook", r: 'starter', c: 'rogue', art: 'hook', d: 'At the start of each combat, draw 2 additional cards.',
    combatStart(G) { G.C.bonusDraw += 2; G.flash('fishhook'); } });

  // ----- common -----
  relic('anchor', { n: 'Rusted Anchor', r: 'common', art: 'anchor', d: 'Start each combat with 10 Block.', combatStart(G) { G.flash('anchor'); G.rawBlock(10, G.p); } });
  relic('lantern', { n: 'Storm Lantern', r: 'common', art: 'lantern', d: 'Gain 1 Energy on the first turn of each combat.', turnStart(G) { if (G.C.turn === 1) { G.flash('lantern'); G.energy(1); } } });
  relic('marbles', { n: 'Bag of Pebbles', r: 'common', art: 'pebbles', d: 'At the start of each combat, apply 1 Vulnerable to ALL enemies.', combatStart(G) { G.flash('marbles'); G.applyAll('vuln', 1); } });
  relic('sharktooth', { n: 'Shark Tooth', r: 'common', art: 'tooth', d: 'Start each combat with 1 Strength.', combatStart(G) { G.flash('sharktooth'); G.apply(G.p, 'str', 1); } });
  relic('seaglass', { n: 'Sea Glass', r: 'common', art: 'glass', d: 'Start each combat with 1 Dexterity.', combatStart(G) { G.flash('seaglass'); G.apply(G.p, 'dex', 1); } });
  relic('urchin', { n: 'Urchin Spines', r: 'common', art: 'urchin', d: 'Start each combat with 3 Thorns.', combatStart(G) { G.flash('urchin'); G.apply(G.p, 'thorns', 3); } });
  relic('kelptonic', { n: 'Kelp Tonic', r: 'common', art: 'vial', d: 'At the start of each combat, heal 2 HP.', combatStart(G) { G.flash('kelptonic'); G.heal(2); } });
  relic('whetstone', { n: 'Whetstone', r: 'common', art: 'whetstone', counter: true, d: 'Every 10th Attack you play deals double damage.' });
  relic('sunstone', { n: 'Sunstone', r: 'common', art: 'sun', d: 'Every 3rd turn, gain 1 Energy.', turnStart(G) { if (G.C.turn % 3 === 0) { G.flash('sunstone'); G.energy(1); } } });
  relic('barnacleplate', { n: 'Barnacle Plate', r: 'common', art: 'plate', d: 'If you end your turn without Block, gain 6 Block.', turnEnd(G) { if (G.p.block === 0) { G.flash('barnacleplate'); G.rawBlock(6, G.p); } } });
  relic('saltedfig', { n: 'Salted Fig', r: 'common', art: 'fig', d: 'Raise your Max HP by 7.', pickup(run) { run.maxHp += 7; run.hp += 7; } });
  relic('bandolier', { n: 'Bandolier', r: 'common', art: 'belt', d: 'Gain 2 extra potion slots.', pickup(run) { run.potions.push(null, null); } });
  relic('pillow', { n: 'Feather Pillow', r: 'common', art: 'pillow', d: 'Resting at a campfire heals an additional 15 HP.' });

  // ----- uncommon -----
  relic('fishchain', { n: 'Fishhook Chain', r: 'uncommon', art: 'chain', d: 'Every time you play 3 Attacks in a turn, gain 1 Dexterity.', onPlay(G, R, c, d) { if (d.t === 'atk' && G.C.turnAtk % 3 === 0) { G.flash('fishchain'); G.apply(G.p, 'dex', 1); } } });
  relic('sailneedle', { n: 'Sail Needle', r: 'uncommon', art: 'needle', d: 'Every time you play 3 Attacks in a turn, gain 1 Strength.', onPlay(G, R, c, d) { if (d.t === 'atk' && G.C.turnAtk % 3 === 0) { G.flash('sailneedle'); G.apply(G.p, 'str', 1); } } });
  relic('corkfloat', { n: 'Cork Float', r: 'uncommon', art: 'cork', d: 'Every time you play 3 Attacks in a turn, gain 4 Block.', onPlay(G, R, c, d) { if (d.t === 'atk' && G.C.turnAtk % 3 === 0) { G.flash('corkfloat'); G.rawBlock(4, G.p); } } });
  relic('shellknife', { n: 'Shell Knife', r: 'uncommon', art: 'shell', d: 'Every time you play 3 Skills in a turn, deal 5 damage to ALL enemies.', onPlay(G, R, c, d) { if (d.t === 'skl' && G.C.turnSkl % 3 === 0) { G.flash('shellknife'); G.damageAll(5); } } });
  relic('secondtide', { n: 'Second Tide', r: 'uncommon', art: 'wave', d: 'At the start of your 2nd turn, gain 14 Block.', turnStart(G) { if (G.C.turn === 2) { G.flash('secondtide'); G.rawBlock(14, G.p); } } });
  relic('clayidol', { n: 'Clay Idol', r: 'uncommon', art: 'idol', d: 'Whenever you lose HP in combat, gain 3 Block next turn.', onHpLoss(G) { G.apply(G.p, 'nextBlock', 3); } });
  relic('smokedeel', { n: 'Smoked Eel', r: 'uncommon', art: 'eel', d: 'If your HP is at or below 50% at the end of combat, heal 12 HP.', combatEnd(run, R, C) { if (C.p.hp > 0 && C.p.hp <= C.p.maxHp / 2) return { heal: 12 }; } });
  relic('inkpot', { n: 'Ink Pot', r: 'uncommon', art: 'ink', counter: true, d: 'Every 10 cards you play, draw 1 card.', onPlay(G, R) { R.c = (R.c || 0) + 1; if (R.c >= 10) { R.c = 0; G.flash('inkpot'); G.draw(1); } } });
  relic('brazier', { n: 'Brass Brazier', r: 'uncommon', c: 'witch', art: 'brazier', d: 'Whenever you apply Burn, apply 1 more.' });
  relic('charredtome', { n: 'Charred Tome', r: 'uncommon', c: 'witch', art: 'book', d: 'The first time you Exhaust a card each turn, draw 1 card.', onExhaust(G) { if (!G.C.tomeUsed) { G.C.tomeUsed = 1; G.flash('charredtome'); G.draw(1); } } });
  relic('pufferspine', { n: 'Puffer Spine', r: 'uncommon', c: 'rogue', art: 'spine', d: 'Whenever you apply Poison, apply 1 more.' });
  relic('windchime', { n: 'Wind Chime', r: 'uncommon', c: 'rogue', art: 'chime', d: 'Whenever you discard a card during your turn, deal 3 damage to a random enemy.', onDiscard(G) { const e = G.randomEnemy(); if (e) { G.flash('windchime'); G.damage(e, 3); } } });
  relic('shivpouch', { n: 'Shiv Pouch', r: 'uncommon', c: 'rogue', art: 'pouch', d: 'At the start of each combat, add 3 Shivs to your hand.', combatStart(G) { G.flash('shivpouch'); G.C.startShivs = 3; } });
  relic('spyglass', { n: "Captain's Spyglass", r: 'uncommon', c: 'cast', art: 'spyglass', d: 'Enemies with Vulnerable take 75% more damage instead of 50%.' });
  relic('sunburnt', { n: 'Sunburnt Skull', r: 'uncommon', c: 'cast', art: 'skull', d: 'While your HP is at or below 50%, you have 3 more Strength.' });

  // ----- rare -----
  relic('emberbranch', { n: 'Ember Branch', r: 'rare', art: 'branch', d: 'Whenever you Exhaust a card, add a random card to your hand.', onExhaust(G) { G.flash('emberbranch'); G.addRandomCard(); } });
  relic('ironhull', { n: 'Iron Hull', r: 'rare', art: 'hull', d: 'Whenever you would lose HP, lose 1 less.' });
  relic('moonjar', { n: 'Moon Jar', r: 'rare', art: 'jar', d: 'Unspent Energy carries over to your next turn.' });
  relic('phoenixash', { n: 'Phoenix Ash', r: 'rare', art: 'phoenix', d: 'When you would die, heal to 50% of your Max HP instead. Works once.' });
  relic('spinningtop', { n: 'Spinning Top', r: 'rare', art: 'top', d: 'Whenever your hand is empty during your turn, draw 1 card.' });
  relic('tideledger', { n: 'Tide Ledger', r: 'rare', art: 'book', d: 'At the start of your turn, lose only 15 Block instead of all of it.' });

  // ----- shop -----
  relic('merchantseal', { n: "Merchant's Seal", r: 'shop', art: 'seal', d: 'Everything in shops costs 30% less.' });
  relic('smilemask', { n: 'Smiling Mask', r: 'shop', art: 'mask', d: 'Removing a card at the shop always costs 50 Gold.' });

  // ----- special (events) -----
  relic('goldenidol', { n: 'Golden Idol', r: 'special', art: 'idol', d: 'Gain 25% more Gold from combat.' });

  // ----- boss -----
  relic('crackedflask', { n: 'Cracked Flask', r: 'boss', art: 'flask', energy: 1, d: 'Gain 1 Energy each turn. You can no longer obtain potions.' });
  relic('ghostcoin', { n: 'Ghost Coin', r: 'boss', art: 'coin', energy: 1, d: 'Gain 1 Energy each turn. You can no longer gain Gold.' });
  relic('sleeplamp', { n: 'Sleepless Lamp', r: 'boss', art: 'lantern', energy: 1, d: 'Gain 1 Energy each turn. You can no longer Rest at campfires.' });
  relic('brokencrown', { n: 'Broken Crown', r: 'boss', art: 'crown', energy: 1, d: 'Gain 1 Energy each turn. Card rewards offer 2 fewer choices.' });
  relic('blindfold', { n: 'Kelp Blindfold', r: 'boss', art: 'blind', energy: 1, d: 'Gain 1 Energy each turn. You can no longer see enemy intents.' });
  relic('emberedcrown', { n: 'Embered Crown', r: 'boss', art: 'crown2', energy: 1, d: 'Gain 1 Energy each turn. ALL enemies start combat with 1 Strength.', combatStart(G) { G.flash('emberedcrown'); for (const e of G.enemies()) G.apply(e, 'str', 1, { src: 'e' }); } });
  relic('blackpearl', { n: 'Black Pearl', r: 'boss', art: 'pearl', d: 'Elites drop an additional relic.' });
  relic('captainslog', { n: "Captain's Log", r: 'boss', art: 'book', d: 'Draw 1 additional card each turn.', drawBonus: 1 });

  ED.relicList = (rarity, ch) => Object.values(RELICS).filter((r) => r.r === rarity && (r.c === 'any' || r.c === ch));

  // ---------------- potions ----------------
  const POTIONS = ED.POTIONS = {};
  function potion(k, o) { o.k = k; o.tg = o.tg || 'self'; POTIONS[k] = o; }
  potion('fire', { n: 'Fire Flask', r: 'common', tg: 'enemy', col: '#ff6a3d', d: 'Deal 20 damage to an enemy.', use(G, t) { G.damage(t, 20); } });
  potion('explosive', { n: 'Powder Keg', r: 'common', tg: 'all', col: '#ffb347', d: 'Deal 10 damage to ALL enemies.', use(G) { G.damageAll(10); } });
  potion('block', { n: 'Shell Tonic', r: 'common', col: '#6cb8ff', d: 'Gain 12 Block.', use(G) { G.rawBlock(12, G.p); } });
  potion('strength', { n: 'Bull Kelp Brew', r: 'common', col: '#ff5d5d', d: 'Gain 2 Strength.', use(G) { G.apply(G.p, 'str', 2); } });
  potion('dex', { n: 'Quicksilver', r: 'common', col: '#9be7ff', d: 'Gain 2 Dexterity.', use(G) { G.apply(G.p, 'dex', 2); } });
  potion('swift', { n: 'Swift Draught', r: 'common', col: '#e8f0ff', d: 'Draw 3 cards.', use(G) { G.draw(3); } });
  potion('energy', { n: 'Spark Juice', r: 'common', col: '#ffd24a', d: 'Gain 2 Energy.', use(G) { G.energy(2); } });
  potion('weak', { n: 'Murk Ink', r: 'common', tg: 'enemy', col: '#9d7bea', d: 'Apply 3 Weak.', use(G, t) { G.apply(t, 'weak', 3); } });
  potion('fear', { n: 'Dread Draught', r: 'common', tg: 'enemy', col: '#ff9a3d', d: 'Apply 3 Vulnerable.', use(G, t) { G.apply(t, 'vuln', 3); } });
  potion('poison', { n: 'Venom Vial', r: 'uncommon', tg: 'enemy', col: '#8bdc5a', d: 'Apply 7 Poison.', use(G, t) { G.apply(t, 'poison', 7); } });
  potion('flame', { n: 'Liquid Flame', r: 'uncommon', tg: 'all', col: '#ff8a3d', d: 'Apply 6 Burn to ALL enemies.', use(G) { G.applyAll('burn', 6); } });
  potion('heal', { n: 'Healing Salve', r: 'uncommon', col: '#ff7890', out: true, d: 'Heal 25% of your Max HP. Can be used outside combat.', use(G) { G.heal(Math.floor(G.p.maxHp * 0.25)); }, useOut(run) { run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * 0.25)); } });
  potion('artifact', { n: 'Ancient Oil', r: 'uncommon', col: '#ffe08a', d: 'Gain 1 Artifact.', use(G) { G.apply(G.p, 'artifact', 1); } });
  potion('regen', { n: 'Tidewater', r: 'uncommon', col: '#7be0a0', d: 'Gain 5 Regen.', use(G) { G.apply(G.p, 'regen', 5); } });
  potion('tide', { n: 'Bottled Tide', r: 'rare', col: '#5ce1e6', d: 'Choose 1 of 3 random cards to add to your hand. It costs 0 this turn.', use(G) { G.discover(); } });
  potion('fury', { n: 'Ember Rum', r: 'rare', col: '#ff4d2e', d: 'Gain 5 Strength. At the end of this turn, lose 5 Strength.', use(G) { G.apply(G.p, 'str', 5); G.apply(G.p, 'strDown', 5); } });
  ED.potionList = (r) => Object.values(POTIONS).filter((p) => !r || p.r === r);
})(typeof window !== 'undefined' ? window : globalThis);
