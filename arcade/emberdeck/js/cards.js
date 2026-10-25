'use strict';
// EMBER DECK — status effects and every card. Card effects call the combat helper `G` (see engine.js).
(function (root) {
  const ED = root.ED;

  // ---------------- status effects ----------------
  // kind: buff | debuff ; turn: decrements at end of owner's turn ; show: shown as a number
  const S = ED.STATUS = {};
  function st(k, o) { o.k = k; S[k] = o; }
  st('str', { n: 'Strength', kind: 'buff', icon: 'str', col: '#ff6b5a', neg: true, d: (n) => n >= 0 ? `Attacks deal ${n} more damage per hit.` : `Attacks deal ${-n} less damage per hit.` });
  st('dex', { n: 'Dexterity', kind: 'buff', icon: 'dex', col: '#6cb8ff', neg: true, d: (n) => n >= 0 ? `Block gained from cards is increased by ${n}.` : `Block gained from cards is reduced by ${-n}.` });
  st('vuln', { n: 'Vulnerable', kind: 'debuff', turn: true, icon: 'vuln', col: '#ff9a3d', d: (n) => `Takes 50% more damage from attacks for ${n} turn${n > 1 ? 's' : ''}.` });
  st('weak', { n: 'Weak', kind: 'debuff', turn: true, icon: 'weak', col: '#b9a3ff', d: (n) => `Deals 25% less attack damage for ${n} turn${n > 1 ? 's' : ''}.` });
  st('frail', { n: 'Frail', kind: 'debuff', turn: true, icon: 'frail', col: '#9fb4c8', d: (n) => `Gains 25% less Block from cards for ${n} turn${n > 1 ? 's' : ''}.` });
  st('poison', { n: 'Poison', kind: 'debuff', icon: 'poison', col: '#8bdc5a', d: (n) => `At the start of its turn, loses ${n} HP (ignores Block). Then Poison goes down by 1.` });
  st('burn', { n: 'Burn', kind: 'debuff', icon: 'burn', col: '#ff8a3d', d: (n) => `At the start of its turn, takes ${n} damage (ignores Block). Then Burn drops by half.` });
  st('thorns', { n: 'Thorns', kind: 'buff', icon: 'thorns', col: '#d9c27a', d: (n) => `When attacked, deals ${n} damage back to the attacker.` });
  st('plating', { n: 'Plating', kind: 'buff', icon: 'plating', col: '#8fb3d9', d: (n) => `At the end of its turn, gains ${n} Block.` });
  st('rage', { n: 'Rising Rage', kind: 'buff', icon: 'rage', col: '#ff5d73', d: (n) => `At the end of its turn, gains ${n} Strength.` });
  st('regen', { n: 'Regen', kind: 'buff', icon: 'regen', col: '#7be0a0', d: (n) => `At the end of its turn, heals ${n} HP. Then Regen goes down by 1.` });
  st('artifact', { n: 'Artifact', kind: 'buff', icon: 'artifact', col: '#ffd27a', d: (n) => `Negates the next ${n} debuff${n > 1 ? 's' : ''}.` });
  st('strDown', { n: 'Fading Strength', kind: 'debuff', icon: 'strdown', col: '#c58a8a', d: (n) => `At the end of this turn, lose ${n} Strength.` });
  st('riposte', { n: 'Riposte', kind: 'buff', icon: 'thorns', col: '#ffd27a', d: (n) => `Until your next turn, deals ${n} damage back when attacked.` });
  st('shroud', { n: 'Flame Shroud', kind: 'buff', icon: 'burn', col: '#ffb36b', d: (n) => `Until your next turn, applies ${n} Burn to attackers.` });
  st('enrage', { n: 'Enrage', kind: 'buff', icon: 'rage', col: '#ff5d73', d: (n) => `Whenever you play a Skill, gains ${n} Strength.` });
  st('curl', { n: 'Curl Up', kind: 'buff', icon: 'shield', col: '#8fb3d9', d: (n) => `The first time it takes attack damage, gains ${n} Block.` });
  st('split', { n: 'Split', kind: 'buff', icon: 'split', col: '#8bdc5a', show: false, d: () => 'At half HP or less, splits into two smaller slimes.' });
  st('spores', { n: 'Spore Burst', kind: 'buff', icon: 'spore', col: '#c7f07a', d: (n) => `When it dies, applies ${n} Vulnerable to you.` });
  st('minion', { n: 'Minion', kind: 'buff', icon: 'minion', col: '#a3aed0', show: false, d: () => 'Flees when its master dies.' });
  st('nextBlock', { n: 'Next Turn Block', kind: 'buff', icon: 'shield', col: '#6cb8ff', d: (n) => `At the start of your next turn, gain ${n} Block.` });
  st('nextDraw', { n: 'Next Turn Draw', kind: 'buff', icon: 'draw', col: '#6cb8ff', d: (n) => `At the start of your next turn, draw ${n} more cards.` });
  st('noDraw', { n: 'No Draw', kind: 'debuff', icon: 'nodraw', col: '#9fb4c8', show: false, d: () => 'You cannot draw more cards this turn.' });
  // powers
  st('fortress', { n: 'Fortress', kind: 'buff', icon: 'fortress', col: '#8fb3d9', show: false, d: () => 'Block is not removed at the start of your turn.' });
  st('tidebreaker', { n: 'Tidebreaker', kind: 'buff', icon: 'wave', col: '#5ce1e6', d: (n) => `Whenever you gain Block, deal ${n} damage to a random enemy.` });
  st('unbroken', { n: 'Unbroken', kind: 'buff', icon: 'str', col: '#ff6b5a', d: (n) => `At the start of your turn, gain ${n} Strength.` });
  st('kindleSoul', { n: 'Kindling Soul', kind: 'buff', icon: 'shield', col: '#ffb36b', d: (n) => `Whenever you Exhaust a card, gain ${n} Block.` });
  st('emberHeart', { n: 'Ember Heart', kind: 'buff', icon: 'draw', col: '#ffb36b', d: (n) => `Whenever you Exhaust a card, draw ${n} card${n > 1 ? 's' : ''}.` });
  st('pyromancy', { n: 'Pyromancy', kind: 'buff', icon: 'burn', col: '#ff8a3d', d: (n) => `At the start of your turn, apply ${n} Burn to ALL enemies.` });
  st('everburn', { n: 'Everburn', kind: 'buff', icon: 'burn', col: '#ff5a2a', show: false, d: () => 'Burn on enemies goes down by 1 each turn instead of halving.' });
  st('ashPact', { n: 'Ash Pact', kind: 'buff', icon: 'ash', col: '#c9b8a8', show: false, d: () => 'Skills cost 0. Whenever you play a Skill, Exhaust it.' });
  st('infernoForm', { n: 'Inferno Form', kind: 'buff', icon: 'burn', col: '#ff5a2a', d: (n) => `Whenever you play a card, apply ${n} Burn to ALL enemies.` });
  st('fireWithin', { n: 'Fire Within', kind: 'buff', icon: 'energy', col: '#ffc35a', d: (n) => `At the start of your turn, gain ${n} Energy and add ${n} Cinder to your hand.` });
  st('accuracy', { n: 'Accuracy', kind: 'buff', icon: 'dagger', col: '#d0e6ff', d: (n) => `Shivs deal ${n} more damage.` });
  st('noxious', { n: 'Noxious Fumes', kind: 'buff', icon: 'poison', col: '#8bdc5a', d: (n) => `At the start of your turn, apply ${n} Poison to ALL enemies.` });
  st('endlessEdge', { n: 'Endless Edge', kind: 'buff', icon: 'dagger', col: '#d0e6ff', d: (n) => `At the start of your turn, add ${n} Shiv to your hand.` });
  st('afterImage', { n: 'After Image', kind: 'buff', icon: 'shield', col: '#6cb8ff', d: (n) => `Whenever you play a card, gain ${n} Block.` });
  st('thousandCuts', { n: 'A Thousand Cuts', kind: 'buff', icon: 'dagger', col: '#ff9a3d', d: (n) => `Whenever you play a card, deal ${n} damage to ALL enemies.` });
  st('envenom', { n: 'Envenom', kind: 'buff', icon: 'poison', col: '#8bdc5a', d: (n) => `Whenever an Attack deals unblocked damage, apply ${n} Poison.` });

  // ---------------- keywords (for card tooltips) ----------------
  ED.KEYWORDS = {
    Block: 'Prevents damage. Removed at the start of your next turn.',
    Exhaust: 'Removed from play until the end of combat.',
    Ethereal: 'If it is in your hand at the end of turn, it is Exhausted.',
    Innate: 'Starts each combat in your opening hand.',
    Retain: 'Stays in your hand at the end of turn.',
    Unplayable: 'Cannot be played.',
    Shiv: '0-cost Attack: deal 4 damage. Exhaust.',
    Tinder: 'Unplayable, Ethereal kindling. Fuel for Exhaust effects.',
    Cinder: 'Unplayable. Burns you for 2 at the end of your turn if held.',
    Strength: S.str.d(1).replace('1 more damage per hit', 'more damage per point'),
    Dexterity: 'Increases Block gained from cards.',
    Vulnerable: 'Takes 50% more damage from attacks.',
    Weak: 'Deals 25% less attack damage.',
    Frail: 'Gains 25% less Block from cards.',
    Poison: 'Loses HP equal to Poison at the start of its turn, then Poison goes down by 1.',
    Burn: 'Takes damage equal to Burn at the start of its turn, then Burn drops by half.',
    Thorns: 'Deals damage back to attackers.',
    Artifact: 'Negates the next debuff.',
  };

  // ---------------- cards ----------------
  const CARDS = ED.CARDS = {};
  const LIST = ED.CARD_LIST = [];
  function card(k, o) {
    o.k = k;
    if (!Array.isArray(o.cost)) o.cost = [o.cost, o.cost];
    o.v = o.v || {};
    if (o.ex === undefined) o.ex = false;
    if (!Array.isArray(o.ex)) o.ex = [o.ex, o.ex];
    if (!Array.isArray(o.d)) o.d = [o.d, o.d];
    if (o.inn !== undefined && !Array.isArray(o.inn)) o.inn = [o.inn, o.inn];
    o.tg = o.tg || (o.t === 'atk' ? 'enemy' : 'self');
    CARDS[k] = o; LIST.push(o);
    return o;
  }
  ED.cardDef = (k) => CARDS[k];

  const CH = 'cast', WI = 'witch', RO = 'rogue';

  // ===== Castaway — balanced: strikes, block, Strength and Vulnerable =====
  card('strike_c', { n: 'Strike', c: CH, t: 'atk', r: 'starter', cost: 1, v: { d: [6, 9] }, d: 'Deal {d} damage.', art: 'sword', tags: ['strike'], play(G, x) { G.hit(x.t, x.v.d); } });
  card('defend_c', { n: 'Defend', c: CH, t: 'skl', r: 'starter', cost: 1, v: { b: [5, 8] }, d: 'Gain {b} Block.', art: 'shield', tags: ['defend'], play(G, x) { G.block(x.v.b); } });
  card('oarsmash', { n: 'Oar Smash', c: CH, t: 'atk', r: 'starter', cost: 2, v: { d: [8, 10], x: [2, 3] }, d: 'Deal {d} damage. Apply {x} Vulnerable.', art: 'oar', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'vuln', x.v.x); } });
  card('twinpaddle', { n: 'Twin Paddle', c: CH, t: 'atk', r: 'common', cost: 1, v: { d: [5, 7] }, d: 'Deal {d} damage twice.', art: 'oar2', play(G, x) { G.hit(x.t, x.v.d, { hits: 2 }); } });
  card('brace', { n: 'Brace', c: CH, t: 'skl', r: 'common', cost: 1, v: { b: [8, 11] }, d: 'Gain {b} Block. Draw 1 card.', art: 'shield', play(G, x) { G.block(x.v.b); G.draw(1); } });
  card('club', { n: 'Driftwood Club', c: CH, t: 'atk', r: 'common', cost: 1, v: { d: [9, 10], x: [1, 2] }, d: ['Deal {d} damage. Draw 1 card.', 'Deal {d} damage. Draw 2 cards.'], art: 'club', play(G, x) { G.hit(x.t, x.v.d); G.draw(x.v.x); } });
  card('sweep', { n: 'Sweeping Oar', c: CH, t: 'atk', r: 'common', cost: 1, tg: 'all', v: { d: [8, 11] }, d: 'Deal {d} damage to ALL enemies.', art: 'sweep', play(G, x) { G.hitAll(x.v.d); } });
  card('sandbag', { n: 'Sandbag', c: CH, t: 'skl', r: 'common', cost: 1, v: { b: [5, 7], x: [5, 7] }, d: 'Gain {b} Block. Next turn, gain {x} Block.', art: 'sack', play(G, x) { G.block(x.v.b); G.apply(G.p, 'nextBlock', x.v.x); } });
  card('bulwark', { n: 'Bulwark Bash', c: CH, t: 'atk', r: 'common', cost: [1, 0], v: {}, d: 'Deal damage equal to your Block.{dd}', art: 'shieldbash', dmgBase: (G) => G.p.block, play(G, x) { G.hit(x.t, G.p.block); } });
  card('surge', { n: 'Adrenal Surge', c: CH, t: 'skl', r: 'common', cost: 0, v: { x: [2, 4] }, d: 'Gain {x} Strength. At the end of this turn, lose {x} Strength.', art: 'fist', play(G, x) { G.apply(G.p, 'str', x.v.x); G.apply(G.p, 'strDown', x.v.x); } });
  card('coconut', { n: 'Coconut Toss', c: CH, t: 'atk', r: 'common', cost: 1, v: { d: [6, 8], x: [1, 2] }, d: 'Deal {d} damage. Apply {x} Weak.', art: 'coconut', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'weak', x.v.x); } });
  card('flint', { n: 'Flint Spark', c: CH, t: 'atk', r: 'common', cost: 0, v: { d: [3, 5] }, d: 'Deal {d} damage. Draw 1 card.', art: 'spark', play(G, x) { G.hit(x.t, x.v.d); G.draw(1); } });
  card('tackle', { n: 'Tackle', c: CH, t: 'atk', r: 'common', cost: 1, v: { d: [5, 7], b: [5, 7] }, d: 'Gain {b} Block. Deal {d} damage.', art: 'tackle', play(G, x) { G.block(x.v.b); G.hit(x.t, x.v.d); } });
  card('flare', { n: 'Signal Flare', c: CH, t: 'skl', r: 'common', cost: 1, tg: 'all', v: { x: [1, 2] }, d: 'Apply {x} Weak and {x} Vulnerable to ALL enemies.', art: 'flare', play(G, x) { G.applyAll('weak', x.v.x); G.applyAll('vuln', x.v.x); } });
  card('salvage', { n: 'Salvage', c: CH, t: 'atk', r: 'common', cost: 1, v: { d: [8, 10] }, d: 'Deal {d} damage. Put a random card from your discard pile into your hand.', art: 'hook', play(G, x) { G.hit(x.t, x.v.d); G.fromDiscard(1); } });
  card('shakeoff', { n: 'Shake It Off', c: CH, t: 'skl', r: 'common', cost: 1, v: { b: [7, 10] }, d: 'Gain {b} Block. Remove your Weak, Vulnerable and Frail.', art: 'wave', play(G, x) { G.block(x.v.b); G.cleanse(G.p); } });

  card('barnacle', { n: 'Barnacle Hide', c: CH, t: 'pow', r: 'uncommon', cost: 1, v: { b: [4, 6], x: [2, 3] }, d: 'Gain {b} Block. Gain {x} Thorns.', art: 'barnacle', play(G, x) { G.block(x.v.b); G.apply(G.p, 'thorns', x.v.x); } });
  card('anchor', { n: 'Anchor Drop', c: CH, t: 'atk', r: 'uncommon', cost: 2, v: { d: [14, 14], x: [3, 5] }, d: 'Deal {d} damage. Strength affects this card {x} times.', art: 'anchor', strMult: (up) => (up ? 5 : 3), play(G, x) { G.hit(x.t, x.v.d, { strMult: x.v.x }); } });
  card('secondwind', { n: 'Second Wind', c: CH, t: 'skl', r: 'uncommon', cost: 1, v: { b: [5, 7] }, d: 'Exhaust all non-Attack cards in your hand. Gain {b} Block for each.', art: 'wind', play(G, x) { const n = G.exhaustHand((c) => G.def(c).t !== 'atk'); for (let i = 0; i < n; i++) G.block(x.v.b); } });
  card('seawall', { n: 'Seawall', c: CH, t: 'pow', r: 'uncommon', cost: 2, v: { x: [3, 4] }, d: 'At the end of your turn, gain {x} Block.', art: 'wall', play(G, x) { G.apply(G.p, 'plating', x.v.x); } });
  card('grit', { n: 'Hardened Grit', c: CH, t: 'pow', r: 'uncommon', cost: 1, v: { x: [2, 3] }, d: 'Gain {x} Strength.', art: 'fist', play(G, x) { G.apply(G.p, 'str', x.v.x); } });
  card('riposte', { n: 'Riposte', c: CH, t: 'skl', r: 'uncommon', cost: 1, v: { b: [6, 9], x: [4, 6] }, d: 'Gain {b} Block. Until your next turn, deal {x} damage back whenever you are attacked.', art: 'parry', play(G, x) { G.block(x.v.b); G.apply(G.p, 'riposte', x.v.x); } });
  card('entrench', { n: 'Entrench', c: CH, t: 'skl', r: 'uncommon', cost: [2, 1], d: 'Double your Block.', art: 'wall', play(G) { G.rawBlock(G.p.block, G.p); } });
  card('tidalfury', { n: 'Tidal Fury', c: CH, t: 'atk', r: 'uncommon', cost: 1, v: { d: [8, 8], x: [5, 8] }, d: "Deal {d} damage. This card's damage grows by {x} this combat.", art: 'wave', dmgBase: (G, x) => x.v.d + (x.card.b || 0), play(G, x) { G.hit(x.t, x.v.d + (x.card.b || 0)); x.card.b = (x.card.b || 0) + x.v.x; } });
  card('haymaker', { n: 'Haymaker', c: CH, t: 'atk', r: 'uncommon', cost: 2, v: { d: [13, 13], x: [1, 2] }, d: 'Deal {d} damage. Apply {x} Weak and {x} Vulnerable.', art: 'fist', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'weak', x.v.x); G.apply(x.t, 'vuln', x.v.x); } });
  card('readtide', { n: 'Read the Tide', c: CH, t: 'skl', r: 'uncommon', cost: 1, tg: 'enemy', v: { x: [3, 4] }, d: 'If the enemy intends to attack, gain {x} Strength.', art: 'eye', play(G, x) { if (G.intendsAttack(x.t)) G.apply(G.p, 'str', x.v.x); } });
  card('shoulder', { n: 'Shoulder Check', c: CH, t: 'atk', r: 'uncommon', cost: 1, v: { d: [6, 9] }, d: 'Deal {d} damage. If the enemy is Vulnerable, gain 1 Energy and draw 1 card.', art: 'tackle', play(G, x) { const v = (x.t.st.vuln || 0) > 0; G.hit(x.t, x.v.d); if (v) { G.energy(1); G.draw(1); } } });
  card('scavenge', { n: 'Scavenge', c: CH, t: 'skl', r: 'uncommon', cost: 0, v: { x: [3, 4] }, d: 'Draw {x} cards. You cannot draw more cards this turn.', art: 'hook', play(G, x) { G.draw(x.v.x); G.p.st.noDraw = 1; } });
  card('warcry', { n: 'War Cry', c: CH, t: 'skl', r: 'uncommon', cost: 2, tg: 'all', v: { x: [3, 5] }, d: 'Apply {x} Weak and {x} Vulnerable to ALL enemies.', ex: true, art: 'horn', play(G, x) { G.applyAll('weak', x.v.x); G.applyAll('vuln', x.v.x); } });

  card('fortress', { n: 'Fortress', c: CH, t: 'pow', r: 'rare', cost: [3, 2], d: 'Block is no longer removed at the start of your turn.', art: 'fortress', play(G) { G.p.st.fortress = 1; } });
  card('tidebreaker', { n: 'Tidebreaker', c: CH, t: 'pow', r: 'rare', cost: 2, v: { x: [5, 7] }, d: 'Whenever you gain Block, deal {x} damage to a random enemy.', art: 'wave', play(G, x) { G.apply(G.p, 'tidebreaker', x.v.x); } });
  card('unbroken', { n: 'Unbroken', c: CH, t: 'pow', r: 'rare', cost: 3, v: { x: [2, 3] }, d: 'At the start of each turn, gain {x} Strength.', art: 'crown', play(G, x) { G.apply(G.p, 'unbroken', x.v.x); } });
  card('shelter', { n: 'Shipwreck Shelter', c: CH, t: 'skl', r: 'rare', cost: 2, v: { b: [30, 40] }, d: 'Gain {b} Block.', ex: true, art: 'hull', play(G, x) { G.block(x.v.b); } });
  card('mastcrash', { n: 'Mast Crash', c: CH, t: 'atk', r: 'rare', cost: 3, v: { d: [32, 42] }, d: 'Deal {d} damage.', art: 'mast', play(G, x) { G.hit(x.t, x.v.d); } });
  card('laststand', { n: 'Last Stand', c: CH, t: 'skl', r: 'rare', cost: 0, v: { x: [3, 5] }, d: 'Lose 6 HP. Gain 2 Energy. Draw {x} cards.', ex: true, art: 'heart', play(G, x) { G.loseHp(G.p, 6); G.energy(2); G.draw(x.v.x); } });
  card('hunt', { n: 'Hunt', c: CH, t: 'atk', r: 'rare', cost: 1, v: { d: [10, 12], x: [3, 4] }, d: 'Deal {d} damage. If this kills a non-minion enemy, raise your Max HP by {x}.', ex: true, art: 'spear', play(G, x) { G.hit(x.t, x.v.d); if (x.t.hp <= 0 && !x.t.st.minion) G.raiseMaxHp(x.v.x); } });
  card('surgewill', { n: 'Surge of Will', c: CH, t: 'skl', r: 'rare', cost: 1, d: 'Double your Strength.', ex: [true, false], art: 'crown', play(G) { const s = G.p.st.str || 0; if (s > 0) G.apply(G.p, 'str', s); } });

  // ===== Ember Witch — Burn and Exhaust =====
  card('strike_w', { n: 'Strike', c: WI, t: 'atk', r: 'starter', cost: 1, v: { d: [6, 9] }, d: 'Deal {d} damage.', art: 'sword', tags: ['strike'], play(G, x) { G.hit(x.t, x.v.d); } });
  card('defend_w', { n: 'Defend', c: WI, t: 'skl', r: 'starter', cost: 1, v: { b: [5, 8] }, d: 'Gain {b} Block.', art: 'shield', tags: ['defend'], play(G, x) { G.block(x.v.b); } });
  card('kindle', { n: 'Kindle', c: WI, t: 'skl', r: 'starter', cost: 1, tg: 'enemy', v: { x: [8, 11] }, d: 'Apply {x} Burn.', art: 'flame', play(G, x) { G.apply(x.t, 'burn', x.v.x); } });
  card('ashrite', { n: 'Ash Rite', c: WI, t: 'skl', r: 'starter', cost: [1, 0], d: 'Exhaust a card in your hand. Draw 2 cards.', art: 'ash', play(G) { G.choose({ n: 1, act: 'exhaust', prompt: 'Exhaust a card' }); }, after(G) { G.draw(2); } });
  card('flamelash', { n: 'Flame Lash', c: WI, t: 'atk', r: 'common', cost: 1, v: { d: [6, 8], x: [3, 4] }, d: 'Deal {d} damage. Apply {x} Burn.', art: 'whip', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'burn', x.v.x); } });
  card('scorch', { n: 'Scorch', c: WI, t: 'atk', r: 'common', cost: 1, tg: 'all', v: { d: [4, 6], x: [2, 3] }, d: 'Deal {d} damage and apply {x} Burn to ALL enemies.', art: 'blaze', play(G, x) { G.hitAll(x.v.d); G.applyAll('burn', x.v.x); } });
  card('smokeveil', { n: 'Smoke Veil', c: WI, t: 'skl', r: 'common', cost: 1, v: { b: [7, 10], x: [2, 3] }, d: 'Gain {b} Block. Apply {x} Burn to ALL enemies.', art: 'smoke', play(G, x) { G.block(x.v.b); G.applyAll('burn', x.v.x); } });
  card('ashshield', { n: 'Ash Shield', c: WI, t: 'skl', r: 'common', cost: 1, v: { b: [11, 15] }, d: 'Exhaust a card in your hand. Gain {b} Block.', art: 'ash', play(G) { G.choose({ n: 1, act: 'exhaust', prompt: 'Exhaust a card' }); }, after(G, x) { G.block(x.v.b); } });
  card('spark', { n: 'Spark', c: WI, t: 'atk', r: 'common', cost: 0, v: { d: [3, 5], x: [2, 3] }, d: 'Deal {d} damage. Apply {x} Burn.', art: 'spark', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'burn', x.v.x); } });
  card('pyrestrike', { n: 'Pyre Strike', c: WI, t: 'atk', r: 'common', cost: 2, v: { d: [12, 16], x: [4, 6] }, d: 'Deal {d} damage. Apply {x} Burn.', art: 'blaze', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'burn', x.v.x); } });
  card('fanflames', { n: 'Fan the Flames', c: WI, t: 'skl', r: 'common', cost: 1, tg: 'all', v: { x: [4, 6] }, d: 'Apply {x} Burn to ALL enemies.', art: 'fan', play(G, x) { G.applyAll('burn', x.v.x); } });
  card('steamguard', { n: 'Steam Guard', c: WI, t: 'skl', r: 'common', cost: 1, v: { b: [5, 7] }, d: 'Gain {b} Block, +1 for every 2 Burn on enemies.', art: 'steam', blockBase: (G, x) => x.v.b + Math.floor(G.totalBurn() / 2), play(G, x) { G.block(x.v.b + Math.floor(G.totalBurn() / 2)); } });
  card('gathertinder', { n: 'Gather Tinder', c: WI, t: 'skl', r: 'common', cost: 0, v: { x: [2, 3] }, d: 'Add {x} Tinder to your hand.', art: 'twigs', play(G, x) { G.add('tinder', 'hand', x.v.x); } });
  card('hexbolt', { n: 'Hex Bolt', c: WI, t: 'atk', r: 'common', cost: 1, v: { d: [7, 10], x: [1, 2] }, d: 'Deal {d} damage. Apply {x} Vulnerable.', art: 'bolt', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'vuln', x.v.x); } });
  card('rummage', { n: 'Rummage Ashes', c: WI, t: 'skl', r: 'common', cost: 0, v: { x: [2, 3] }, d: 'Draw {x} cards. Exhaust a random card in your hand.', art: 'ash', play(G, x) { G.draw(x.v.x); G.exhaustRandom(1); } });
  card('flashfire', { n: 'Flash Fire', c: WI, t: 'atk', r: 'common', cost: 1, v: { d: [11, 15] }, d: 'Deal {d} damage.', ex: true, art: 'blaze', play(G, x) { G.hit(x.t, x.v.d); } });
  card('searing', { n: 'Searing Touch', c: WI, t: 'atk', r: 'common', cost: 1, v: { d: [7, 9], x: [2, 3] }, d: 'Deal {d} damage. If the enemy has Burn, apply {x} Weak.', art: 'hand', play(G, x) { const b = (x.t.st.burn || 0) > 0; G.hit(x.t, x.v.d); if (b) G.apply(x.t, 'weak', x.v.x); } });

  card('ignite', { n: 'Ignite', c: WI, t: 'atk', r: 'uncommon', cost: 1, v: { x: [2, 3] }, d: 'Remove all Burn from the enemy. Deal {x}× that much damage.{dd}', art: 'boom', dmgBase: (G, x, t) => (t ? (t.st.burn || 0) * x.v.x : 0), play(G, x) { const b = x.t.st.burn || 0; delete x.t.st.burn; G.hit(x.t, b * x.v.x); } });
  card('wildfire', { n: 'Wildfire', c: WI, t: 'skl', r: 'uncommon', cost: [1, 0], tg: 'enemy', d: "Double the enemy's Burn.", art: 'flame2', play(G, x) { const b = x.t.st.burn || 0; if (b > 0) G.apply(x.t, 'burn', b, { raw: true }); } });
  card('kindlesoul', { n: 'Kindling Soul', c: WI, t: 'pow', r: 'uncommon', cost: 1, v: { x: [3, 4] }, d: 'Whenever you Exhaust a card, gain {x} Block.', art: 'heartflame', play(G, x) { G.apply(G.p, 'kindleSoul', x.v.x); } });
  card('emberheart', { n: 'Ember Heart', c: WI, t: 'pow', r: 'uncommon', cost: [2, 1], d: 'Whenever you Exhaust a card, draw 1 card.', art: 'heartflame', play(G) { G.apply(G.p, 'emberHeart', 1); } });
  card('flameshroud', { n: 'Flame Shroud', c: WI, t: 'skl', r: 'uncommon', cost: 2, v: { b: [12, 16], x: [4, 6] }, d: 'Gain {b} Block. Until your next turn, apply {x} Burn to any enemy that attacks you.', art: 'shieldflame', play(G, x) { G.block(x.v.b); G.apply(G.p, 'shroud', x.v.x); } });
  card('immolate', { n: 'Immolate', c: WI, t: 'atk', r: 'uncommon', cost: 2, tg: 'all', v: { d: [18, 24] }, d: 'Deal {d} damage to ALL enemies. Add a Cinder to your discard pile.', art: 'blaze', play(G, x) { G.hitAll(x.v.d); G.add('cinder', 'discard', 1); } });
  card('pyromancy', { n: 'Pyromancy', c: WI, t: 'pow', r: 'uncommon', cost: 2, v: { x: [3, 4] }, d: 'At the start of your turn, apply {x} Burn to ALL enemies.', art: 'flame2', play(G, x) { G.apply(G.p, 'pyromancy', x.v.x); } });
  card('bloodkindle', { n: 'Blood Kindling', c: WI, t: 'skl', r: 'uncommon', cost: 0, d: ['Lose 4 HP. Gain 2 Energy.', 'Lose 4 HP. Gain 2 Energy. Draw 1 card.'], ex: true, art: 'drop', play(G, x) { G.loseHp(G.p, 4); G.energy(2); if (x.up) G.draw(1); } });
  card('cinderstorm', { n: 'Cinder Storm', c: WI, t: 'atk', r: 'uncommon', cost: 1, tg: 'random', v: { d: [3, 3], x: [3, 4] }, d: 'Deal {d} damage to a random enemy {x} times. Each hit applies 2 Burn.', art: 'embers', play(G, x) { for (let i = 0; i < x.v.x; i++) { const e = G.randomEnemy(); if (!e) break; G.hit(e, x.v.d); if (e.hp > 0) G.apply(e, 'burn', 2); } } });
  card('purge', { n: 'Purge', c: WI, t: 'atk', r: 'uncommon', cost: 2, v: { d: [16, 22] }, d: 'Exhaust all non-Attack cards in your hand. Deal {d} damage.', art: 'boom', play(G, x) { G.exhaustHand((c) => G.def(c).t !== 'atk'); G.hit(x.t, x.v.d); } });
  card('sootcloak', { n: 'Soot Cloak', c: WI, t: 'skl', r: 'uncommon', cost: 1, tg: 'all', v: { x: [2, 3] }, d: 'Apply {x} Weak to ALL enemies.', ex: true, art: 'smoke', play(G, x) { G.applyAll('weak', x.v.x); } });
  card('brand', { n: 'Brand', c: WI, t: 'skl', r: 'uncommon', cost: 1, tg: 'enemy', v: { x: [2, 3], y: [5, 7] }, d: 'Apply {x} Vulnerable and {y} Burn.', art: 'brand', play(G, x) { G.apply(x.t, 'vuln', x.v.x); G.apply(x.t, 'burn', x.v.y); } });

  card('infernoform', { n: 'Inferno Form', c: WI, t: 'pow', r: 'rare', cost: 3, v: { x: [1, 2] }, d: 'Whenever you play a card, apply {x} Burn to ALL enemies.', art: 'phoenix', play(G, x) { G.apply(G.p, 'infernoForm', x.v.x); } });
  card('pyre', { n: 'Pyre', c: WI, t: 'atk', r: 'rare', cost: 2, v: { d: [7, 10] }, d: 'Exhaust all other cards in your hand. Deal {d} damage for each card Exhausted.', ex: true, art: 'pyre', play(G, x) { const n = G.exhaustHand(() => true); G.hit(x.t, x.v.d, { hits: n }); } });
  card('everburn', { n: 'Everburn', c: WI, t: 'pow', r: 'rare', cost: [2, 1], d: 'Burn on enemies goes down by 1 each turn instead of halving.', art: 'flame2', play(G) { G.p.st.everburn = 1; } });
  card('ashpact', { n: 'Ash Pact', c: WI, t: 'pow', r: 'rare', cost: [3, 2], d: 'Skills cost 0. Whenever you play a Skill, Exhaust it.', art: 'ash', play(G) { G.p.st.ashPact = 1; } });
  card('detonate', { n: 'Detonate', c: WI, t: 'atk', r: 'rare', cost: 2, tg: 'all', v: { x: [2, 3] }, d: 'Remove all Burn from ALL enemies. Each takes {x}× its Burn as damage.', art: 'boom', play(G, x) { for (const e of G.enemies()) { const b = e.st.burn || 0; delete e.st.burn; if (b > 0) G.hit(e, b * x.v.x); } } });
  card('firewithin', { n: 'Fire Within', c: WI, t: 'pow', r: 'rare', cost: [1, 0], d: 'At the start of your turn, gain 1 Energy and add a Cinder to your hand.', art: 'heartflame', play(G) { G.apply(G.p, 'fireWithin', 1); } });
  card('cauterize', { n: 'Cauterize', c: WI, t: 'skl', r: 'rare', cost: 1, v: { x: [7, 10] }, d: 'Heal {x} HP.', ex: true, art: 'heart', play(G, x) { G.heal(x.v.x); } });
  card('comet', { n: 'Searing Comet', c: WI, t: 'atk', r: 'rare', cost: 2, v: { d: [20, 26], x: [8, 10] }, d: 'Deal {d} damage. Apply {x} Burn.', ex: true, art: 'comet', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'burn', x.v.x); } });

  // ===== Tide Rogue — Poison, card draw, Shivs =====
  card('strike_r', { n: 'Strike', c: RO, t: 'atk', r: 'starter', cost: 1, v: { d: [6, 9] }, d: 'Deal {d} damage.', art: 'sword', tags: ['strike'], play(G, x) { G.hit(x.t, x.v.d); } });
  card('defend_r', { n: 'Defend', c: RO, t: 'skl', r: 'starter', cost: 1, v: { b: [5, 8] }, d: 'Gain {b} Block.', art: 'shield', tags: ['defend'], play(G, x) { G.block(x.v.b); } });
  card('brinedart', { n: 'Brine Dart', c: RO, t: 'atk', r: 'starter', cost: 0, v: { d: [3, 4], x: [1, 2] }, d: 'Deal {d} damage. Apply {x} Weak.', art: 'dart', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'weak', x.v.x); } });
  card('undertow', { n: 'Undertow', c: RO, t: 'skl', r: 'starter', cost: 1, v: { b: [8, 11] }, d: 'Gain {b} Block. Discard 1 card.', art: 'wave', play(G, x) { G.block(x.v.b); G.choose({ n: 1, act: 'discard', prompt: 'Discard a card' }); } });
  card('bladefan', { n: 'Blade Fan', c: RO, t: 'skl', r: 'common', cost: 1, v: { x: [3, 4] }, d: 'Add {x} Shivs to your hand.', art: 'daggers', play(G, x) { G.add('shiv', 'hand', x.v.x); } });
  card('quickslash', { n: 'Quick Slash', c: RO, t: 'atk', r: 'common', cost: 1, v: { d: [8, 11] }, d: 'Deal {d} damage. Draw 1 card.', art: 'dagger', play(G, x) { G.hit(x.t, x.v.d); G.draw(1); } });
  card('venomstab', { n: 'Venom Stab', c: RO, t: 'atk', r: 'common', cost: 1, v: { d: [6, 8], x: [3, 4] }, d: 'Deal {d} damage. Apply {x} Poison.', art: 'dagger', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'poison', x.v.x); } });
  card('sting', { n: 'Jellyfish Sting', c: RO, t: 'skl', r: 'common', cost: 1, tg: 'enemy', v: { x: [6, 9] }, d: 'Apply {x} Poison.', art: 'jelly', play(G, x) { G.apply(x.t, 'poison', x.v.x); } });
  card('cloak', { n: 'Cloak and Dagger', c: RO, t: 'skl', r: 'common', cost: 1, v: { b: [6, 6], x: [1, 2] }, d: ['Gain {b} Block. Add a Shiv to your hand.', 'Gain {b} Block. Add 2 Shivs to your hand.'], art: 'cloak', play(G, x) { G.block(x.v.b); G.add('shiv', 'hand', x.v.x); } });
  card('backflip', { n: 'Backflip', c: RO, t: 'skl', r: 'common', cost: 1, v: { b: [5, 8] }, d: 'Gain {b} Block. Draw 2 cards.', art: 'flip', play(G, x) { G.block(x.v.b); G.draw(2); } });
  card('prepared', { n: 'Prepared', c: RO, t: 'skl', r: 'common', cost: 0, v: { x: [1, 2] }, d: ['Draw 1 card. Discard 1 card.', 'Draw 2 cards. Discard 2 cards.'], art: 'cards', play(G, x) { G.draw(x.v.x); G.choose({ n: x.v.x, act: 'discard', prompt: 'Discard ' + x.v.x }); } });
  card('daggerthrow', { n: 'Dagger Throw', c: RO, t: 'atk', r: 'common', cost: 1, v: { d: [9, 12] }, d: 'Deal {d} damage. Draw 1 card. Discard 1 card.', art: 'dart', play(G, x) { G.hit(x.t, x.v.d); G.draw(1); G.choose({ n: 1, act: 'discard', prompt: 'Discard a card' }); } });
  card('slice', { n: 'Slice', c: RO, t: 'atk', r: 'common', cost: 0, v: { d: [6, 9] }, d: 'Deal {d} damage.', art: 'dagger', play(G, x) { G.hit(x.t, x.v.d); } });
  card('acrobatics', { n: 'Acrobatics', c: RO, t: 'skl', r: 'common', cost: 1, v: { x: [3, 4] }, d: 'Draw {x} cards. Discard 1 card.', art: 'flip', play(G, x) { G.draw(x.v.x); G.choose({ n: 1, act: 'discard', prompt: 'Discard a card' }); } });
  card('bane', { n: 'Bane', c: RO, t: 'atk', r: 'common', cost: 1, v: { d: [7, 10] }, d: 'Deal {d} damage. If the enemy is Poisoned, deal it again.', art: 'skulldagger', play(G, x) { G.hit(x.t, x.v.d); if ((x.t.st.poison || 0) > 0 && x.t.hp > 0) G.hit(x.t, x.v.d); } });
  card('deflect', { n: 'Deflect', c: RO, t: 'skl', r: 'common', cost: 0, v: { b: [4, 7] }, d: 'Gain {b} Block.', art: 'parry', play(G, x) { G.block(x.v.b); } });
  card('suckerpunch', { n: 'Sucker Punch', c: RO, t: 'atk', r: 'common', cost: 1, v: { d: [7, 9], x: [1, 2] }, d: 'Deal {d} damage. Apply {x} Weak.', art: 'fist', play(G, x) { G.hit(x.t, x.v.d); G.apply(x.t, 'weak', x.v.x); } });

  card('accuracy', { n: 'Accuracy', c: RO, t: 'pow', r: 'uncommon', cost: 1, v: { x: [4, 6] }, d: 'Shivs deal {x} more damage.', art: 'target', play(G, x) { G.apply(G.p, 'accuracy', x.v.x); } });
  card('noxious', { n: 'Noxious Fumes', c: RO, t: 'pow', r: 'uncommon', cost: 1, v: { x: [2, 3] }, d: 'At the start of your turn, apply {x} Poison to ALL enemies.', art: 'fumes', play(G, x) { G.apply(G.p, 'noxious', x.v.x); } });
  card('catalyst', { n: 'Catalyst', c: RO, t: 'skl', r: 'uncommon', cost: 1, tg: 'enemy', d: ["Double the enemy's Poison.", "Triple the enemy's Poison."], ex: true, art: 'flask', play(G, x) { const p = x.t.st.poison || 0; if (p > 0) G.apply(x.t, 'poison', p * (x.up ? 2 : 1), { raw: true }); } });
  card('footwork', { n: 'Footwork', c: RO, t: 'pow', r: 'uncommon', cost: 1, v: { x: [2, 3] }, d: 'Gain {x} Dexterity.', art: 'boot', play(G, x) { G.apply(G.p, 'dex', x.v.x); } });
  card('flask', { n: 'Bouncing Flask', c: RO, t: 'skl', r: 'uncommon', cost: 2, tg: 'random', v: { x: [3, 4] }, d: 'Apply 3 Poison to a random enemy {x} times.', art: 'flask', play(G, x) { for (let i = 0; i < x.v.x; i++) { const e = G.randomEnemy(); if (e) G.apply(e, 'poison', 3); } } });
  card('tripwire', { n: 'Tripwire', c: RO, t: 'skl', r: 'uncommon', cost: 2, tg: 'enemy', v: { b: [11, 14], x: [2, 3] }, d: 'Apply {x} Weak. Gain {b} Block.', art: 'rope', play(G, x) { G.apply(x.t, 'weak', x.v.x); G.block(x.v.b); } });
  card('riffle', { n: 'Riffle', c: RO, t: 'skl', r: 'uncommon', cost: 0, d: 'Discard your hand, then draw that many cards.', ex: [true, false], art: 'cards', play(G) { const n = G.discardHand(); G.draw(n); } });
  card('finisher', { n: 'Finisher', c: RO, t: 'atk', r: 'uncommon', cost: 1, v: { d: [6, 8] }, d: 'Deal {d} damage for each Attack played this turn.{hh}', art: 'skulldagger', hitsFn: (G) => G.C.turnAtk, play(G, x) { G.hit(x.t, x.v.d, { hits: G.C.turnAtk }); } });
  card('eviscerate', { n: 'Eviscerate', c: RO, t: 'atk', r: 'uncommon', cost: 3, v: { d: [7, 9] }, d: 'Costs 1 less for each card discarded this turn. Deal {d} damage 3 times.', art: 'claws', costFn: (G, c, base) => Math.max(0, base - G.C.turnDisc), play(G, x) { G.hit(x.t, x.v.d, { hits: 3 }); } });
  card('predator', { n: 'Predator', c: RO, t: 'atk', r: 'uncommon', cost: 2, v: { d: [15, 20] }, d: 'Deal {d} damage. Next turn, draw 2 more cards.', art: 'shark', play(G, x) { G.hit(x.t, x.v.d); G.apply(G.p, 'nextDraw', 2); } });
  card('endlessedge', { n: 'Endless Edge', c: RO, t: 'pow', r: 'uncommon', cost: 1, inn: [false, true], d: 'At the start of your turn, add a Shiv to your hand.', art: 'daggers', play(G) { G.apply(G.p, 'endlessEdge', 1); } });
  card('escapeplan', { n: 'Escape Plan', c: RO, t: 'skl', r: 'uncommon', cost: 0, v: { b: [3, 5] }, d: 'Draw 1 card. If it is a Skill, gain {b} Block.', art: 'boot', play(G, x) { const got = G.draw(1); if (got[0] && G.def(got[0]).t === 'skl') G.block(x.v.b); } });
  card('cloud', { n: 'Crippling Cloud', c: RO, t: 'skl', r: 'uncommon', cost: 2, tg: 'all', v: { x: [4, 7] }, d: 'Apply {x} Poison and 2 Weak to ALL enemies.', ex: true, art: 'fumes', play(G, x) { G.applyAll('poison', x.v.x); G.applyAll('weak', 2); } });
  card('reflex', { n: 'Reflex', c: RO, t: 'skl', r: 'uncommon', cost: 0, unp: true, v: { x: [2, 3] }, d: 'When this is discarded during your turn, draw {x} cards.', art: 'flip', onDiscard(G, c) { G.draw(c.up ? 3 : 2); } });
  card('tactician', { n: 'Tactician', c: RO, t: 'skl', r: 'uncommon', cost: 0, unp: true, v: { x: [1, 2] }, d: 'When this is discarded during your turn, gain {x} Energy.', art: 'energy', onDiscard(G, c) { G.energy(c.up ? 2 : 1); } });

  card('storm', { n: 'Storm of Steel', c: RO, t: 'skl', r: 'rare', cost: 1, d: ['Discard your hand. Add a Shiv to your hand for each card discarded.', 'Discard your hand. Add a Shiv+ to your hand for each card discarded.'], art: 'daggers', play(G, x) { const n = G.discardHand(); G.add('shiv', 'hand', n, x.up ? 1 : 0); } });
  card('afterimage', { n: 'After Image', c: RO, t: 'pow', r: 'rare', cost: 1, inn: [false, true], d: 'Whenever you play a card, gain 1 Block.', art: 'ghost', play(G) { G.apply(G.p, 'afterImage', 1); } });
  card('thousandcuts', { n: 'A Thousand Cuts', c: RO, t: 'pow', r: 'rare', cost: 2, v: { x: [1, 2] }, d: 'Whenever you play a card, deal {x} damage to ALL enemies.', art: 'claws', play(G, x) { G.apply(G.p, 'thousandCuts', x.v.x); } });
  card('envenom', { n: 'Envenom', c: RO, t: 'pow', r: 'rare', cost: [2, 1], d: 'Whenever an Attack deals unblocked damage, apply 1 Poison.', art: 'fumes', play(G) { G.apply(G.p, 'envenom', 1); } });
  card('adrenaline', { n: 'Adrenaline', c: RO, t: 'skl', r: 'rare', cost: 0, v: { x: [1, 2] }, d: 'Gain {x} Energy. Draw 2 cards.', ex: true, art: 'energy', play(G, x) { G.energy(x.v.x); G.draw(2); } });
  card('glassknife', { n: 'Glass Knife', c: RO, t: 'atk', r: 'rare', cost: 1, v: { d: [8, 12] }, d: "Deal {d} damage twice. This card's damage drops by 2 this combat.", art: 'glass', dmgBase: (G, x) => Math.max(0, x.v.d - (x.card.b || 0)), play(G, x) { G.hit(x.t, Math.max(0, x.v.d - (x.card.b || 0)), { hits: 2 }); x.card.b = (x.card.b || 0) + 2; } });
  card('frenzy', { n: 'Riptide Frenzy', c: RO, t: 'atk', r: 'rare', cost: 1, tg: 'all', v: { d: [13, 17] }, d: 'Deal {d} damage to ALL enemies.', ex: true, art: 'whirl', play(G, x) { G.hitAll(x.v.d); } });
  card('finale', { n: 'Grand Finale', c: RO, t: 'atk', r: 'rare', cost: 0, tg: 'all', v: { d: [50, 60] }, d: 'Can only be played if your draw pile is empty. Deal {d} damage to ALL enemies.', art: 'star', canPlay: (G) => (G.C.draw.length ? 'Your draw pile is not empty' : null), play(G, x) { G.hitAll(x.v.d); } });

  // ===== Colorless (shops & events) =====
  const NE = 'neutral';
  card('bandage', { n: 'Bandage Up', c: NE, t: 'skl', r: 'uncommon', cost: 0, v: { x: [4, 6] }, d: 'Heal {x} HP.', ex: true, art: 'heart', play(G, x) { G.heal(x.v.x); } });
  card('insight', { n: 'Flash of Insight', c: NE, t: 'skl', r: 'uncommon', cost: 0, v: { x: [2, 3] }, d: 'Draw {x} cards.', ex: true, art: 'eye', play(G, x) { G.draw(x.v.x); } });
  card('swiftstrike', { n: 'Swift Strike', c: NE, t: 'atk', r: 'uncommon', cost: 0, v: { d: [7, 10] }, d: 'Deal {d} damage.', art: 'sword', play(G, x) { G.hit(x.t, x.v.d); } });
  card('panacea', { n: 'Panacea', c: NE, t: 'skl', r: 'uncommon', cost: 0, v: { x: [1, 2] }, d: 'Gain {x} Artifact.', ex: true, art: 'flask', play(G, x) { G.apply(G.p, 'artifact', x.v.x); } });
  card('instinct', { n: 'Good Instincts', c: NE, t: 'skl', r: 'uncommon', cost: 0, v: { b: [6, 9] }, d: 'Gain {b} Block.', art: 'shield', play(G, x) { G.block(x.v.b); } });
  card('trip', { n: 'Trip', c: NE, t: 'skl', r: 'uncommon', cost: 0, tg: 'enemy', v: { x: [2, 3] }, d: 'Apply {x} Vulnerable.', art: 'rope', play(G, x) { G.apply(x.t, 'vuln', x.v.x); } });
  card('apotheosis', { n: 'Apotheosis', c: NE, t: 'skl', r: 'rare', cost: [2, 1], d: 'Upgrade ALL your cards for the rest of combat.', ex: true, art: 'star', play(G) { G.upgradeAllCombat(); } });
  card('greed', { n: 'Hand of Greed', c: NE, t: 'atk', r: 'rare', cost: 2, v: { d: [20, 25], x: [20, 25] }, d: 'Deal {d} damage. If this kills a non-minion enemy, gain {x} Gold.', art: 'coin', play(G, x) { G.hit(x.t, x.v.d); if (x.t.hp <= 0 && !x.t.st.minion) G.gold(x.v.x); } });

  // ===== Tokens, statuses, curses =====
  card('shiv', { n: 'Shiv', c: 'token', t: 'atk', r: 'special', cost: 0, v: { d: [4, 6] }, d: 'Deal {d} damage.', ex: true, art: 'dagger', tags: ['shiv'], dmgBase: (G, x) => x.v.d + (G.p.st.accuracy || 0), play(G, x) { G.hit(x.t, x.v.d + (G.p.st.accuracy || 0)); } });
  card('tinder', { n: 'Tinder', c: 'token', t: 'skl', r: 'special', cost: 0, unp: true, eth: true, d: 'Kindling for Exhaust effects.', art: 'twigs' });
  card('cinder', { n: 'Cinder', c: 'status', t: 'status', r: 'special', cost: 0, unp: true, d: 'At the end of your turn, if this is in your hand, take 2 damage.', art: 'embers', endTurn(G) { G.damagePlayer(2, 'cinder'); } });
  card('wound', { n: 'Wound', c: 'status', t: 'status', r: 'special', cost: 0, unp: true, d: 'A useless, painful card.', art: 'wound' });
  card('dazed', { n: 'Dazed', c: 'status', t: 'status', r: 'special', cost: 0, unp: true, eth: true, d: 'Your head is spinning.', art: 'daze' });
  card('slime', { n: 'Brine Slime', c: 'status', t: 'status', r: 'special', cost: 1, ex: true, d: 'Sticky gunk. Costs Energy to clear.', art: 'slime', play() {} });
  card('injury', { n: 'Injury', c: 'curse', t: 'curse', r: 'special', cost: 0, unp: true, d: 'An old wound that never healed.', art: 'wound' });
  card('doubt', { n: 'Doubt', c: 'curse', t: 'curse', r: 'special', cost: 0, unp: true, d: 'At the end of your turn, if this is in your hand, gain 1 Weak.', art: 'daze', endTurn(G) { G.apply(G.p, 'weak', 1, { src: 'e' }); } });
  card('decay', { n: 'Decay', c: 'curse', t: 'curse', r: 'special', cost: 0, unp: true, d: 'At the end of your turn, if this is in your hand, take 2 damage.', art: 'skull', endTurn(G) { G.damagePlayer(2, 'decay'); } });
  card('clumsy', { n: 'Clumsy', c: 'curse', t: 'curse', r: 'special', cost: 0, unp: true, eth: true, d: 'Butterfingers.', art: 'hand' });
  card('seasick', { n: 'Seasick', c: 'curse', t: 'curse', r: 'special', cost: 0, unp: true, d: 'At the end of your turn, if this is in your hand, lose 1 HP for each card in your hand.', art: 'wave', endTurn(G) { G.loseHp(G.p, G.C.hand.length); } });

  ED.CURSES = ['injury', 'doubt', 'decay', 'clumsy', 'seasick'];
  ED.pool = function (ch, rarity) {
    return LIST.filter((c) => c.c === ch && (!rarity || c.r === rarity) && c.r !== 'starter' && c.r !== 'special');
  };
  ED.upgradable = (card) => !card.up && CARDS[card.k] && !['status', 'curse'].includes(CARDS[card.k].t);
})(typeof window !== 'undefined' ? window : globalThis);
