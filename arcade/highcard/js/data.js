'use strict';
// HIGH CARD — static content: hands, charms, omens, stars, vouchers, bosses, decks, stakes, packs.
// Description mini-markup: {c:..} chips (blue), {m:..} mult (red), {x:..} xmult, {$:..} money, {g:..} highlight,
// {b:..} hands (blue), {r:..} discards (red).
(function (G) {
  const HC = G.HC = G.HC || {};

  HC.SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
  HC.SUIT_CH = ['♠', '♥', '♣', '♦'];
  HC.RANK_CH = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  HC.RANK_NAME = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  HC.rankChips = (r) => (r <= 10 ? r : r === 14 ? 11 : 10);

  // ---------- poker hands ----------
  HC.HANDS = [
    { k: 'high', name: 'High Card', c: 5, m: 1, lc: 10, lm: 1 },
    { k: 'pair', name: 'Pair', c: 10, m: 2, lc: 15, lm: 1 },
    { k: 'two', name: 'Two Pair', c: 20, m: 2, lc: 20, lm: 1 },
    { k: 'three', name: 'Three of a Kind', c: 30, m: 3, lc: 20, lm: 2 },
    { k: 'straight', name: 'Straight', c: 30, m: 4, lc: 30, lm: 3 },
    { k: 'flush', name: 'Flush', c: 35, m: 4, lc: 15, lm: 2 },
    { k: 'full', name: 'Full House', c: 40, m: 4, lc: 25, lm: 2 },
    { k: 'four', name: 'Four of a Kind', c: 60, m: 7, lc: 30, lm: 3 },
    { k: 'sflush', name: 'Straight Flush', c: 100, m: 8, lc: 40, lm: 4 },
    { k: 'five', name: 'Five of a Kind', c: 120, m: 12, lc: 35, lm: 3, secret: true },
    { k: 'fhouse', name: 'Flush House', c: 140, m: 14, lc: 40, lm: 4, secret: true },
    { k: 'ffive', name: 'Flush Five', c: 160, m: 16, lc: 50, lm: 3, secret: true },
  ];
  HC.HAND = {};
  HC.HANDS.forEach((h, i) => { h.i = i; HC.HAND[h.k] = h; });

  // ---------- enhancements / editions / seals ----------
  HC.ENH = {
    bonus: { name: 'Bonus', desc: '{c:+30} extra Chips' },
    mult: { name: 'Mult', desc: '{m:+4} Mult' },
    wild: { name: 'Wild', desc: 'Counts as every suit' },
    glass: { name: 'Glass', desc: '{x:×2} Mult, {g:1 in 4} chance to shatter' },
    steel: { name: 'Steel', desc: '{x:×1.5} Mult while held in hand' },
    stone: { name: 'Stone', desc: '{c:+50} Chips, no rank or suit, always scores' },
    gold: { name: 'Gold', desc: '{$:$3} if held in hand at end of round' },
    lucky: { name: 'Lucky', desc: '{g:1 in 5}: {m:+20} Mult, {g:1 in 15}: {$:$20}' },
  };
  HC.ED = {
    shimmer: { name: 'Shimmer', desc: '{c:+50} Chips', cost: 2 },
    prism: { name: 'Prism', desc: '{m:+10} Mult', cost: 3 },
    aurora: { name: 'Aurora', desc: '{x:×1.5} Mult', cost: 5 },
  };
  HC.SEAL = {
    gold: { name: 'Gold Seal', desc: 'Earn {$:$3} when scored' },
    red: { name: 'Red Seal', desc: 'Retrigger this card' },
    blue: { name: 'Blue Seal', desc: 'Held at end of round: create the Star of your last hand' },
    purple: { name: 'Purple Seal', desc: 'Discarded: create a random Omen' },
  };

  // ---------- charms ----------
  // hooks: before(x,ch) card(x,ch,c) held(x,ch,c) retrig(x,ch,c,zone) main(x,ch)  -> effect {chips,mult,xmult,money,msg}
  //        discard(run,ch,cards,E) roundEnd(run,ch,E) roundStart(run,ch,E)   passive:{...}
  const CH = HC.CHARMS = [];
  function C(id, name, r, cost, icon, hue, tag, desc, hooks) {
    CH.push(Object.assign({ id, name, r, cost, icon, hue, tag, desc }, hooks || {}));
  }
  const suitMult = (s) => ({ card: (x, ch, c) => (x.suitIs(c, s) ? { mult: 3 } : null) });
  const ifHas = (k, eff) => ({ main: (x) => (x.has[k] ? eff : null) });
  const ODD = { 14: 1, 9: 1, 7: 1, 5: 1, 3: 1 };
  const EVEN = { 10: 1, 8: 1, 6: 1, 4: 1, 2: 1 };
  const now = (ch, f) => (ch ? ' (now ' + f(ch.s) + ')' : '');
  const fx = (v) => '{x:×' + (Math.round(v * 100) / 100) + '}';

  // Common
  C('copper', 'Copper Penny', 1, 2, 'coin', 30, 'mult', '{m:+4} Mult', { main: () => ({ mult: 4 }) });
  C('rose', 'Red Rose', 1, 5, 'heart', 350, 'mult', 'Scored {g:Hearts} give {m:+3} Mult', suitMult(1));
  C('lantern', 'Paper Lantern', 1, 5, 'diamond', 215, 'mult', 'Scored {g:Diamonds} give {m:+3} Mult', suitMult(3));
  C('clover', 'Clover Patch', 1, 5, 'club', 130, 'mult', 'Scored {g:Clubs} give {m:+3} Mult', suitMult(2));
  C('raven', 'Raven Feather', 1, 5, 'spade', 250, 'mult', 'Scored {g:Spades} give {m:+3} Mult', suitMult(0));
  C('twins', 'Twin Flames', 1, 4, 'flame', 12, 'mult', '{m:+8} Mult if hand contains a {g:Pair}', ifHas('pair', { mult: 8 }));
  C('trident', 'Trident', 1, 4, 'trident', 190, 'mult', '{m:+12} Mult if hand contains {g:Three of a Kind}', ifHas('three', { mult: 12 }));
  C('domino', 'Domino', 1, 4, 'domino', 0, 'mult', '{m:+10} Mult if hand contains {g:Two Pair}', ifHas('two', { mult: 10 }));
  C('ladder', 'Rope Ladder', 1, 4, 'ladder', 32, 'mult', '{m:+12} Mult if hand contains a {g:Straight}', ifHas('straight', { mult: 12 }));
  C('tidepool', 'Tidepool', 1, 4, 'wave', 195, 'mult', '{m:+10} Mult if hand contains a {g:Flush}', ifHas('flush', { mult: 10 }));
  C('stack', 'Chip Stack', 1, 4, 'chips', 210, 'chips', '{c:+50} Chips if hand contains a {g:Pair}', ifHas('pair', { chips: 50 }));
  C('brick', 'Brickyard', 1, 4, 'brick', 15, 'chips', '{c:+80} Chips if hand contains {g:Two Pair}', ifHas('two', { chips: 80 }));
  C('chalk', 'Chalk Line', 1, 4, 'arrow', 60, 'chips', '{c:+100} Chips if hand contains a {g:Straight}', ifHas('straight', { chips: 100 }));
  C('seaglass', 'Sea Glass', 1, 4, 'gem', 170, 'chips', '{c:+80} Chips if hand contains a {g:Flush}', ifHas('flush', { chips: 80 }));
  C('fox', 'Sly Fox', 1, 4, 'fox', 24, 'chips', '{c:+100} Chips if hand contains {g:Three of a Kind}', ifHas('three', { chips: 100 }));
  C('halfmoon', 'Half Moon', 1, 5, 'moon', 50, 'mult', '{m:+20} Mult if the played hand has {g:3 or fewer} cards', { main: (x) => (x.played.length <= 3 ? { mult: 20 } : null) });
  C('oddduck', 'Odd Duck', 1, 4, 'duck', 55, 'chips', 'Scored {g:A, 9, 7, 5, 3} give {c:+31} Chips', { card: (x, ch, c) => (ODD[x.rankOf(c)] ? { chips: 31 } : null) });
  C('evenkeel', 'Even Keel', 1, 4, 'anchor', 205, 'mult', 'Scored {g:10, 8, 6, 4, 2} give {m:+4} Mult', { card: (x, ch, c) => (EVEN[x.rankOf(c)] ? { mult: 4 } : null) });
  C('facepaint', 'Face Paint', 1, 4, 'mask', 300, 'chips', 'Scored {g:face cards} give {c:+30} Chips', { card: (x, ch, c) => (x.isFace(c) ? { chips: 30 } : null) });
  C('acehole', 'Ace Up the Sleeve', 1, 5, 'card', 0, 'mult', 'Scored {g:Aces} give {c:+20} Chips and {m:+4} Mult', { card: (x, ch, c) => (x.rankOf(c) === 14 ? { chips: 20, mult: 4 } : null) });
  C('sevens', 'Lucky Sevens', 1, 5, 'seven', 45, 'mult', 'Scored {g:7s} give {m:+7} Mult and a {g:1 in 7} chance for {$:$7}', {
    card: (x, ch, c) => { if (x.rankOf(c) !== 7) return null; const e = { mult: 7 }; if (x.chance(1, 7)) e.money = 7; return e; },
  });
  C('allowance', 'Allowance', 1, 5, 'bag', 45, 'econ', 'Earn {$:$4} at the end of each round', { nocopy: true, roundEnd: () => ({ money: 4 }) });
  C('piggy', 'Piggy Bank', 1, 4, 'pig', 330, 'econ', (ch) => 'Gains {$:$2} of sell value at the end of each round' + now(ch, (s) => '{$:+$' + (s.sell || 0) + '}'), {
    nocopy: true, roundEnd: (run, ch) => { ch.s.sell = (ch.s.sell || 0) + 2; return { msg: 'Value up!' }; },
  });
  C('tipjar', 'Tip Jar', 1, 5, 'cup', 40, 'econ', 'Scored {g:face cards} have a {g:1 in 2} chance to earn {$:$1}', { card: (x, ch, c) => (x.isFace(c) && x.chance(1, 2) ? { money: 1 } : null) });
  C('coupon', 'Coupon Book', 1, 5, 'ticket', 300, 'econ', 'The first reroll in each shop is {g:free}', { nocopy: true, passive: { freeReroll: 1 } });
  C('broom', 'Clean Sweep', 1, 5, 'broom', 35, 'util', '{r:+1} Discard every round', { nocopy: true, passive: { discards: 1 } });
  C('pickpocket', 'Pickpocket', 1, 6, 'hand', 270, 'util', '{g:+1} hand size', { nocopy: true, passive: { handSize: 1 } });
  C('deckhand', 'Deckhand', 1, 5, 'cards', 220, 'chips', (ch, run) => '{c:+2} Chips for each card left in your draw pile' + (run ? ' (now {c:+' + 2 * run.draw.length + '})' : ''), { main: (x) => ({ chips: 2 * x.run.draw.length }) });
  C('summit', 'Empty Pockets', 1, 5, 'mountain', 200, 'mult', '{m:+15} Mult when you have {r:0 discards} left', { main: (x) => (x.run.round.discards === 0 ? { mult: 15 } : null) });
  C('anteup', 'Ante Up', 1, 5, 'chips', 140, 'mult', (ch, run) => '{m:+3} Mult per Ante reached' + (run ? ' (now {m:+' + 3 * run.ante + '})' : ''), { main: (x) => ({ mult: 3 * x.run.ante }) });
  C('dealer', "Dealer's Cut", 1, 5, 'coin', 100, 'econ', 'Earn {$:$2} for each discard left at the end of the round', { nocopy: true, roundEnd: (run) => (run.round.discards > 0 ? { money: 2 * run.round.discards } : null) });

  // Uncommon
  C('hoard', "Dragon's Hoard", 2, 6, 'crown', 45, 'mult', (ch, run) => '{m:+2} Mult for every {$:$5} you have' + (run ? ' (now {m:+' + 2 * Math.floor(Math.max(0, run.money) / 5) + '})' : ''), { main: (x) => ({ mult: 2 * Math.floor(Math.max(0, x.run.money) / 5) }) });
  C('snowball', 'Snowball', 2, 6, 'snow', 195, 'mult', (ch) => 'Gains {m:+1} Mult per hand played, loses {m:1} per discard' + now(ch, (s) => '{m:+' + s.v + '}'), {
    init: () => ({ v: 0 }), before: (x, ch) => { ch.s.v++; return { msg: '+1 Mult' }; },
    discard: (run, ch) => { if (ch.s.v > 0) { ch.s.v--; return { msg: '-1' }; } return null; }, main: (x, ch) => ({ mult: ch.s.v }),
  });
  C('magpie', 'Magpie', 2, 6, 'bird', 220, 'chips', (ch) => 'Gains {c:+3} Chips for every card discarded' + now(ch, (s) => '{c:+' + s.v + '}'), {
    init: () => ({ v: 0 }), discard: (run, ch, cards) => { ch.s.v += 3 * cards.length; return { msg: '+' + 3 * cards.length }; }, main: (x, ch) => ({ chips: ch.s.v }),
  });
  C('rising', 'Rising Tide', 2, 6, 'wave', 185, 'chips', (ch) => 'Gains {c:+15} Chips each time you play a {g:Straight}' + now(ch, (s) => '{c:+' + s.v + '}'), {
    init: () => ({ v: 0 }), before: (x, ch) => { if (x.has.straight) { ch.s.v += 15; return { msg: 'Upgrade!' }; } return null; }, main: (x, ch) => ({ chips: ch.s.v }),
  });
  C('register', 'Cash Register', 2, 6, 'slot', 48, 'chips', (ch, run) => '{c:+Chips} equal to double your money' + (run ? ' (now {c:+' + 2 * Math.max(0, run.money) + '})' : ''), { main: (x) => ({ chips: 2 * Math.max(0, x.run.money) }) });
  C('lastcall', 'Last Call', 2, 7, 'bell', 30, 'xmult', '{x:×3} Mult on the {g:final hand} of the round', { main: (x) => (x.isFinal ? { xmult: 3 } : null) });
  C('opener', 'Opening Act', 2, 6, 'curtain', 350, 'xmult', '{x:×1.5} Mult on the {g:first hand} of each round', { main: (x) => (x.isFirst ? { xmult: 1.5 } : null) });
  C('glasscannon', 'Glass Cannon', 2, 6, 'glass', 185, 'xmult', '{x:×2.5} Mult. {g:1 in 6} chance to shatter at the end of the round', {
    main: () => ({ xmult: 2.5 }), roundEnd: (run, ch, E) => (E.chance(run, 1, 6) ? { destroy: true, msg: 'Shattered!' } : { msg: 'Safe!' }),
  });
  C('roulette', 'Roulette Wheel', 2, 6, 'wheel', 0, 'xmult', '{g:1 in 3} chance for {x:×3} Mult', { main: (x) => (x.chance(1, 3) ? { xmult: 3 } : { msg: 'Miss' }) });
  C('bandit', 'One-Armed Bandit', 2, 6, 'seven', 300, 'econ', '{g:1 in 4} chance to earn {$:$6} each hand played', { main: (x) => (x.chance(1, 4) ? { money: 6 } : null) });
  C('wildflower', 'Wildflower', 2, 6, 'flower', 300, 'xmult', 'Scored {g:Wild} cards give {x:×1.5} Mult', { card: (x, ch, c) => (c.enh === 'wild' ? { xmult: 1.5 } : null) });
  C('magnolia', 'Steel Magnolia', 2, 7, 'anvil', 210, 'xmult', (ch, run) => '{x:×0.25} Mult for each {g:Steel} card in your full deck' + (run ? ' (now ' + fx(1 + 0.25 * cnt(run, 'steel')) + ')' : ''), { main: (x) => { const n = x.count('steel'); return n ? { xmult: 1 + 0.25 * n } : null; } });
  C('treasure', 'Treasure Map', 2, 6, 'map', 42, 'mult', '{m:+4} Mult for each {g:Gold} card in your full deck', { main: (x) => { const n = x.count('gold'); return n ? { mult: 4 * n } : null; } });
  C('quarry', 'Quarry', 2, 6, 'rock', 30, 'chips', '{c:+25} Chips for each {g:Stone} card in your full deck', { main: (x) => { const n = x.count('stone'); return n ? { chips: 25 * n } : null; } });
  C('velvet', 'Velvet Glove', 2, 6, 'glove', 320, 'mult', 'Each {g:Queen} held in hand gives {m:+13} Mult', { held: (x, ch, c) => (x.rankOf(c) === 12 ? { mult: 13 } : null) });
  C('encore', 'Encore', 2, 6, 'star', 55, 'retrig', 'Retrigger the {g:first} scored card {g:2} more times', { retrig: (x, ch, c, z) => (z === 'play' && c === x.scoring[0] ? 2 : 0) });
  C('smallfry', 'Small Fry', 2, 6, 'fish', 200, 'retrig', 'Retrigger each scored {g:2, 3, 4 and 5}', { retrig: (x, ch, c, z) => { const r = x.rankOf(c); return z === 'play' && r >= 2 && r <= 5 ? 1 : 0; } });
  C('pinch', 'Pinch', 2, 7, 'hand', 150, 'util', '{g:Flushes} and {g:Straights} can be made with {g:4} cards', { nocopy: true, passive: { four: 1 } });
  C('hopscotch', 'Hopscotch', 2, 7, 'steps', 90, 'util', '{g:Straights} may skip one rank (e.g. 3 5 7 9 J)', { nocopy: true, passive: { gaps: 1 } });
  C('inkblot', 'Inkblot', 2, 7, 'drop', 260, 'util', '{g:Hearts} and {g:Diamonds} count as one suit, {g:Spades} and {g:Clubs} as another', { nocopy: true, passive: { smeared: 1 } });
  C('crowd', 'Crowd Pleaser', 2, 6, 'mask', 40, 'util', 'All cards count as {g:face cards}', { nocopy: true, passive: { allFace: 1 } });
  C('stargazer', 'Stargazer', 2, 7, 'scope', 230, 'xmult', (ch, run) => '{x:×0.1} Mult for every {g:Star} used this run' + (run ? ' (now ' + fx(1 + 0.1 * run.stats.stars) + ')' : ''), { main: (x) => (x.run.stats.stars ? { xmult: 1 + 0.1 * x.run.stats.stars } : null) });
  C('fortune', 'Fortune Teller', 2, 6, 'eye', 280, 'mult', (ch, run) => '{m:+1} Mult for every {g:Omen} used this run' + (run ? ' (now {m:+' + run.stats.omens + '})' : ''), { main: (x) => (x.run.stats.omens ? { mult: x.run.stats.omens } : null) });
  C('bounty', 'Bounty Hunter', 2, 6, 'skull', 0, 'econ', 'Earn {$:$8} when you defeat a {g:Boss Blind}', { nocopy: true, roundEnd: (run) => (run.blind === 2 ? { money: 8 } : null) });
  C('palmist', 'Palmist', 2, 6, 'eye', 120, 'util', 'Create a random {g:Omen} when each blind starts (if room)', { nocopy: true, roundStart: (run, ch, E) => (E.gainOmen(run) ? { msg: '+1 Omen' } : null) });
  C('loaded', 'Loaded Dice', 2, 7, 'dice', 0, 'util', 'Doubles all {g:listed chances} (1 in 3 becomes 2 in 3)', { nocopy: true, passive: { prob: 1 } });
  C('nestegg', 'Nest Egg', 2, 6, 'egg', 45, 'econ', 'Earn {$:$1} extra interest for every {$:$5} you have (max {$:$5})', { nocopy: true, passive: { interest2: 1 } });
  C('blackjack', 'Twenty-One', 2, 6, 'cards', 0, 'xmult', '{x:×2.5} Mult if the scoring cards add up to exactly {g:21} (A = 11, faces = 10)', {
    main: (x) => { let t = 0; for (const c of x.scoring) t += x.blackVal(c); return t === 21 ? { xmult: 2.5 } : null; },
  });
  C('secondwind', 'Second Wind', 2, 8, 'wind', 190, 'util', '{b:+1} Hand every round', { nocopy: true, passive: { hands: 1 } });

  // Rare
  C('hollow', 'Hollow Mask', 3, 8, 'ghost', 270, 'xmult', '{x:×1} Mult for each empty Charm slot (counts itself)', { main: (x) => ({ xmult: 1 + Math.max(0, x.run.charmSlots - x.run.charms.length) }) });
  C('mimic', 'Mimic', 3, 10, 'mirror', 190, 'copy', 'Copies the ability of the Charm to its {g:right}', { copy: 'right' });
  C('doppel', 'Doppelganger', 3, 10, 'mirror', 280, 'copy', 'Copies the ability of your {g:leftmost} Charm', { copy: 'left' });
  C('masq', 'Masquerade', 3, 8, 'mask', 330, 'retrig', 'Retrigger all scored {g:face cards}', { retrig: (x, ch, c, z) => (z === 'play' && x.isFace(c) ? 1 : 0) });
  C('curtain', 'Curtain Call', 3, 8, 'curtain', 0, 'retrig', 'Retrigger all scored cards on the {g:final hand} of the round', { retrig: (x, ch, c, z) => (z === 'play' && x.isFinal ? 1 : 0) });
  C('puppeteer', 'Puppeteer', 3, 8, 'puppet', 280, 'retrig', 'Retrigger the abilities of every card {g:held in hand}', { retrig: (x, ch, c, z) => (z === 'held' ? 1 : 0) });
  C('ironcrown', 'Iron Crown', 3, 8, 'crown', 210, 'xmult', 'Each {g:King} held in hand gives {x:×1.5} Mult', { held: (x, ch, c) => (x.rankOf(c) === 13 ? { xmult: 1.5 } : null) });
  C('royal', 'Royal Decree', 3, 9, 'scepter', 45, 'xmult', 'Scored {g:Kings} and {g:Queens} give {x:×1.5} Mult', { card: (x, ch, c) => { const r = x.rankOf(c); return r === 12 || r === 13 ? { xmult: 1.5 } : null; } });
  C('cannonball', 'Cannonball', 3, 7, 'bomb', 0, 'util', '{g:Every} played card counts in scoring', { nocopy: true, passive: { splash: 1 } });
  C('bonfire', 'Bonfire', 3, 8, 'flame', 20, 'xmult', (ch) => 'Gains {x:×0.25} Mult for every playing card destroyed' + now(ch, (s) => fx(1 + 0.25 * s.v)), { init: () => ({ v: 0 }), main: (x, ch) => (ch.s.v ? { xmult: 1 + 0.25 * ch.s.v } : null) });
  C('hotstreak', 'Hot Streak', 3, 8, 'bolt', 50, 'xmult', (ch) => 'Gains {x:×0.25} Mult whenever a single hand beats the whole blind' + now(ch, (s) => fx(1 + 0.25 * s.v)), { init: () => ({ v: 0 }), main: (x, ch) => (ch.s.v ? { xmult: 1 + 0.25 * ch.s.v } : null) });
  C('jackpot', 'Jackpot', 3, 8, 'seven', 130, 'xmult', (ch) => 'Gains {x:×0.5} Mult every time a {g:Lucky} card triggers' + now(ch, (s) => fx(1 + 0.5 * s.v)), { init: () => ({ v: 0 }), main: (x, ch) => (ch.s.v ? { xmult: 1 + 0.5 * ch.s.v } : null) });
  C('pokerface', 'Poker Face', 3, 8, 'face', 220, 'xmult', '{x:×4} Mult if the played hand is a {g:High Card}', { main: (x) => (x.type === 'high' ? { xmult: 4 } : null) });
  C('monsoon', 'Monsoon', 3, 8, 'rain', 200, 'xmult', '{x:×2} Mult if hand contains a {g:Flush}', { main: (x) => (x.has.flush ? { xmult: 2 } : null) });
  C('duet', 'Duet', 3, 8, 'heart', 320, 'xmult', '{x:×2} Mult if hand contains a {g:Pair}', { main: (x) => (x.has.pair ? { xmult: 2 } : null) });
  C('roadtrip', 'Road Trip', 3, 8, 'road', 30, 'xmult', '{x:×3} Mult if hand contains a {g:Straight}', { main: (x) => (x.has.straight ? { xmult: 3 } : null) });
  C('trinity', 'Trinity', 3, 8, 'tri', 265, 'xmult', '{x:×3} Mult if hand contains {g:Three of a Kind}', { main: (x) => (x.has.three ? { xmult: 3 } : null) });
  C('quads', 'Four Corners', 3, 8, 'square', 160, 'xmult', '{x:×4} Mult if hand contains {g:Four of a Kind}', { main: (x) => (x.has.four ? { xmult: 4 } : null) });

  function cnt(run, enh) { let n = 0; for (const c of run.cards) if (c.enh === enh) n++; return n; }
  HC.CHARM = {};
  CH.forEach((c) => { HC.CHARM[c.id] = c; c.nocopy = !!c.nocopy || !!c.copy; });
  HC.RARITY = ['', 'Common', 'Uncommon', 'Rare'];

  // ---------- omens (enhance / convert cards) ----------
  const OM = HC.OMENS = [];
  function O(id, name, icon, hue, need, desc, use) { OM.push({ id, name, icon, hue, need, desc, use }); }
  const enhUse = (e) => (run, cards) => { for (const c of cards) c.enh = e; return true; };
  const suitUse = (s) => (run, cards) => { for (const c of cards) { if (c.enh === 'stone') c.enh = null; c.suit = s; } return true; };
  O('smith', 'The Smith', 'anvil', 210, [1, 2], 'Enhance up to {g:2} cards to {g:Steel}', enhUse('steel'));
  O('glassblower', 'The Glassblower', 'glass', 185, [1, 2], 'Enhance up to {g:2} cards to {g:Glass}', enhUse('glass'));
  O('banker', 'The Banker', 'coin', 45, [1, 1], 'Enhance {g:1} card to {g:Gold}', enhUse('gold'));
  O('gambler', 'The Gambler', 'dice', 120, [1, 2], 'Enhance up to {g:2} cards to {g:Lucky}', enhUse('lucky'));
  O('trickster', 'The Trickster', 'mask', 300, [1, 1], 'Enhance {g:1} card to {g:Wild}', enhUse('wild'));
  O('mason', 'The Mason', 'rock', 30, [1, 1], 'Enhance {g:1} card to {g:Stone}', enhUse('stone'));
  O('bard', 'The Bard', 'bell', 215, [1, 2], 'Enhance up to {g:2} cards to {g:Bonus}', enhUse('bonus'));
  O('fury', 'The Fury', 'flame', 355, [1, 2], 'Enhance up to {g:2} cards to {g:Mult}', enhUse('mult'));
  O('lover', 'The Lover', 'heart', 350, [1, 3], 'Convert up to {g:3} cards to {g:Hearts}', suitUse(1));
  O('merchant', 'The Merchant', 'diamond', 215, [1, 3], 'Convert up to {g:3} cards to {g:Diamonds}', suitUse(3));
  O('gardener', 'The Gardener', 'club', 130, [1, 3], 'Convert up to {g:3} cards to {g:Clubs}', suitUse(2));
  O('soldier', 'The Soldier', 'spade', 250, [1, 3], 'Convert up to {g:3} cards to {g:Spades}', suitUse(0));
  O('twin', 'The Twin', 'cards', 280, [1, 1], 'Add a {g:copy} of 1 selected card to your deck', null);
  O('mirror', 'The Mirror', 'mirror', 190, [2, 2], 'Select 2 cards: the {g:left} one becomes a copy of the {g:right} one', null);
  O('ascent', 'The Ascent', 'arrow', 90, [1, 2], 'Raise the rank of up to {g:2} cards by 1', null);
  O('reaper', 'The Reaper', 'skull', 0, [1, 2], '{g:Destroy} up to 2 selected cards', null);
  O('notary', 'The Notary', 'key', 40, [1, 1], 'Add a random {g:Seal} to 1 card', null);
  O('miser', 'The Miser', 'bag', 45, 0, '{g:Double} your money (max {$:+$20})', null);
  O('oracle', 'The Oracle', 'eye', 230, 0, 'Create up to {g:2} random Stars (if room)', null);
  O('echo', 'The Echo', 'wave', 260, 0, 'Create a copy of the {g:last} Omen or Star you used (not The Echo)', null);
  O('pact', 'The Pact', 'sun', 20, 0, 'Create a random {g:Charm} (needs a free slot)', null);
  O('wheel', 'The Wheel', 'wheel', 330, 0, '{g:1 in 4} chance to add Shimmer, Prism or Aurora to a random Charm', null);
  O('tithe', 'The Tithe', 'cup', 50, 0, 'Gain the total sell value of your Charms (max {$:$50})', null);
  HC.OMEN = {};
  OM.forEach((o) => { HC.OMEN[o.id] = o; });

  // ---------- stars (level up a hand) ----------
  const STAR_NAMES = { high: 'Wisp', pair: 'Binar', two: 'Quadra', three: 'Trine', straight: 'Arrow', flush: 'Tidewell', full: 'Hearth', four: 'Quartet', sflush: 'Comet', five: 'Nova', fhouse: 'Nebula', ffive: 'Quasar' };
  const STAR_HUES = { high: 50, pair: 20, two: 330, three: 280, straight: 200, flush: 180, full: 10, four: 260, sflush: 160, five: 40, fhouse: 300, ffive: 0 };
  HC.STARS = HC.HANDS.map((h) => ({ id: h.k, name: STAR_NAMES[h.k], hand: h.k, hue: STAR_HUES[h.k], secret: !!h.secret }));
  HC.STAR = {};
  HC.STARS.forEach((s) => { HC.STAR[s.id] = s; });

  // ---------- vouchers ----------
  HC.VOUCHERS = [
    { id: 'shelf', name: 'Extra Shelf', icon: 'cards', desc: '{g:+1} card slot in the shop' },
    { id: 'clearance', name: 'Clearance Sale', icon: 'ticket', desc: 'Everything in the shop is {g:25% off}' },
    { id: 'rerun', name: 'Rerun', icon: 'wheel', desc: 'Rerolls cost {$:$2} less' },
    { id: 'steady', name: 'Steady Hand', icon: 'hand', desc: '{b:+1} Hand every round' },
    { id: 'basket', name: 'Wastebasket', icon: 'broom', desc: '{r:+1} Discard every round' },
    { id: 'palms', name: 'Big Palms', icon: 'glove', desc: '{g:+1} hand size' },
    { id: 'seedmoney', name: 'Seed Money', icon: 'egg', desc: 'Interest cap raised to {$:$10}' },
    { id: 'telescope', name: 'Telescope', icon: 'scope', desc: 'Star Packs always hold the Star for your {g:most played} hand' },
    { id: 'pouch', name: 'Crystal Pouch', icon: 'gem', desc: '{g:+1} consumable slot' },
    { id: 'omenmerch', name: 'Omen Merchant', icon: 'eye', desc: 'Omens appear {g:2×} more often in the shop' },
    { id: 'starmerch', name: 'Star Merchant', icon: 'star', desc: 'Stars appear {g:2×} more often in the shop' },
    { id: 'glint', name: 'Glint', icon: 'gem', desc: 'Charm editions appear {g:2×} more often' },
  ];
  HC.VOUCHER = {};
  HC.VOUCHERS.forEach((v) => { HC.VOUCHER[v.id] = v; });

  // ---------- boss blinds ----------
  const debSuit = (s) => (c) => c.enh !== 'stone' && (c.suit === s || c.enh === 'wild');
  HC.BOSSES = [
    { id: 'bleed', name: 'The Bleeding Heart', min: 1, color: '#e0284a', desc: 'All {g:Hearts} are debuffed', debuff: debSuit(1) },
    { id: 'tarnish', name: 'The Tarnish', min: 1, color: '#2f7fe8', desc: 'All {g:Diamonds} are debuffed', debuff: debSuit(3) },
    { id: 'thicket', name: 'The Thicket', min: 1, color: '#2aa05a', desc: 'All {g:Clubs} are debuffed', debuff: debSuit(2) },
    { id: 'eclipse', name: 'The Eclipse', min: 1, color: '#6b6f8a', desc: 'All {g:Spades} are debuffed', debuff: debSuit(0) },
    { id: 'purist', name: 'The Purist', min: 2, color: '#d9a43a', desc: 'All {g:face cards} are debuffed', debuffFace: true },
    { id: 'edict', name: 'The Edict', min: 2, color: '#b04de0', desc: 'Only {g:one hand type} may score: the first one you play' },
    { id: 'ledger', name: 'The Ledger', min: 3, color: '#8a7cf0', desc: 'No hand type can score {g:twice} this round' },
    { id: 'veil', name: 'The Veil', min: 2, color: '#5a6ca8', desc: '{g:1 in 3} cards are drawn {g:face down}' },
    { id: 'mask', name: 'The Mask', min: 2, color: '#c84f86', desc: 'All {g:face cards} are drawn {g:face down}' },
    { id: 'cutpurse', name: 'The Cutpurse', min: 1, color: '#c65a2e', desc: 'Discards {g:2 random} cards from your hand every time you play' },
    { id: 'taxman', name: 'The Taxman', min: 2, color: '#3aa58c', desc: 'Lose {$:$1} for every card you play' },
    { id: 'monolith', name: 'The Monolith', min: 2, color: '#7a8796', desc: 'A {g:huge} blind: ×4 score', mult: 4 },
    { id: 'anvil', name: 'The Anvil', min: 2, color: '#9aa0aa', desc: 'Base {c:Chips} and {m:Mult} are {g:halved}' },
    { id: 'quintet', name: 'The Quintet', min: 1, color: '#e08a2a', desc: 'You must play {g:exactly 5} cards' },
    { id: 'longshot', name: 'The Long Shot', min: 2, color: '#e05050', desc: 'Only {b:1 Hand} this round (normal ×1 target)', mult: 1 },
    { id: 'drought', name: 'The Drought', min: 2, color: '#c9a35a', desc: 'Start with {r:0 Discards}' },
    { id: 'shackle', name: 'The Shackle', min: 1, color: '#6a7a8c', desc: '{g:−1} hand size' },
    { id: 'leech', name: 'The Leech', min: 2, color: '#a03050', desc: 'Playing a hand {g:lowers its level} by 1' },
    { id: 'static', name: 'The Static', min: 2, color: '#40c8d8', desc: 'A random {g:Charm} is disabled each hand' },
    // showdown bosses (ante 8, 16, ...)
    { id: 'crimson', name: 'The Crimson Crown', show: true, color: '#ff2a55', desc: 'A random {g:Charm} is disabled for the whole round' },
    { id: 'lasthouse', name: 'The Last House', show: true, color: '#ffb02a', desc: '{b:−1 Hand} and {r:−1 Discard}' },
    { id: 'midnight', name: 'The Midnight Sun', show: true, color: '#7a5cff', desc: 'An enormous blind: ×3 score', mult: 3 },
    { id: 'dealerboss', name: 'The Dealer', show: true, color: '#2ad0a0', desc: 'Your {g:first hand} is dealt face down; ×2.5 score', mult: 2.5 },
  ];
  HC.BOSS = {};
  HC.BOSSES.forEach((b) => { HC.BOSS[b.id] = b; });

  // ---------- decks ----------
  HC.DECKS = [
    { id: 'house', name: 'House Deck', back: ['#c2183f', '#5a0a1e'], desc: 'The classic 52. No tricks.', unlock: null },
    { id: 'ember', name: 'Ember Deck', back: ['#ff6a1a', '#6a1e04'], desc: '{r:+1} Discard every round', unlock: { ante: 2 }, mod: { discards: 1 } },
    { id: 'tide', name: 'Tide Deck', back: ['#1a8cff', '#062a5a'], desc: '{b:+1} Hand every round', unlock: { ante: 3 }, mod: { hands: 1 } },
    { id: 'gilded', name: 'Gilded Deck', back: ['#e8b62a', '#5a3c06'], desc: 'Start with {$:$14} instead of $4', unlock: { ante: 4 }, mod: { money: 10 } },
    { id: 'painted', name: 'Painted Deck', back: ['#d43ad8', '#3c0a4a'], desc: '{g:+2} hand size, {g:−1} Charm slot', unlock: { ante: 5 }, mod: { handSize: 2, charmSlots: -1 } },
    { id: 'commoner', name: 'Commoner Deck', back: ['#8a9a5a', '#2a3214'], desc: 'No face cards (40 cards)', unlock: { ante: 6 }, mod: { noFace: 1 } },
    { id: 'oracle', name: 'Oracle Deck', back: ['#7a5cff', '#1e1050'], desc: 'Start with {g:Crystal Pouch} and 2 copies of {g:The Oracle}', unlock: { omens: 15 }, mod: { vouchers: ['pouch'], cons: [['omen', 'oracle'], ['omen', 'oracle']] } },
    { id: 'starlight', name: 'Starlight Deck', back: ['#20c8e0', '#06323a'], desc: 'Start with {g:Telescope} and {g:Star Merchant}', unlock: { stars: 15 }, mod: { vouchers: ['telescope', 'starmerch'] } },
    { id: 'mono', name: 'Two-Tone Deck', back: ['#e8e8f0', '#30303c'], desc: 'Only {g:Spades} and {g:Hearts} (26 of each)', unlock: { wins: 1 }, mod: { twoTone: 1 } },
    { id: 'gambler', name: "Gambler's Deck", back: ['#18b060', '#063a1e'], desc: 'Start with {g:Loaded Dice} and {g:Roulette Wheel}, but $0', unlock: { stakeWin: 1 }, mod: { money: -4, charms: ['loaded', 'roulette'] } },
  ];
  HC.DECK = {};
  HC.DECKS.forEach((d) => { HC.DECK[d.id] = d; });

  // ---------- stakes (cumulative) ----------
  HC.STAKES = [
    { id: 0, name: 'Penny', color: '#c88a5a', desc: 'Base difficulty' },
    { id: 1, name: 'Nickel', color: '#b8c4cc', desc: 'Small Blinds give {$:no reward}' },
    { id: 2, name: 'Dime', color: '#8ad0ff', desc: 'Required scores grow {g:faster}' },
    { id: 3, name: 'Quarter', color: '#7ae0a0', desc: '{r:−1 Discard} every round' },
    { id: 4, name: 'Dollar', color: '#ffd23f', desc: 'Boss Blinds are {g:25% bigger}; shop prices {$:+$1}' },
  ];

  // ---------- packs ----------
  HC.PACKS = {
    charm: { name: 'Charm Pack', kind: 'charm', n: 2, pick: 1, cost: 4, w: 4 },
    charmM: { name: 'Mega Charm Pack', kind: 'charm', n: 4, pick: 2, cost: 8, w: 1 },
    omen: { name: 'Omen Pack', kind: 'omen', n: 3, pick: 1, cost: 4, w: 4 },
    omenM: { name: 'Mega Omen Pack', kind: 'omen', n: 5, pick: 2, cost: 8, w: 1 },
    star: { name: 'Star Pack', kind: 'star', n: 3, pick: 1, cost: 4, w: 4 },
    starM: { name: 'Mega Star Pack', kind: 'star', n: 5, pick: 2, cost: 8, w: 1 },
    card: { name: 'Card Pack', kind: 'card', n: 3, pick: 1, cost: 4, w: 3 },
    cardM: { name: 'Mega Card Pack', kind: 'card', n: 5, pick: 2, cost: 6, w: 1 },
  };

  HC.BASE_TARGETS = [300, 800, 1800, 4200, 9000, 16000, 27000, 40000];
  HC.STEEP_TARGETS = [300, 900, 2400, 6500, 15000, 28000, 46000, 75000];
  HC.BLIND_NAMES = ['Small Blind', 'Big Blind'];
  HC.BLIND_MULT = [1, 1.5, 2];
  HC.BLIND_REWARD = [3, 4, 5];
})(typeof window !== 'undefined' ? window : globalThis);
