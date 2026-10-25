'use strict';
// EMBER DECK — mystery events (and the opening boon). Steps are recomputed from saved data, so they survive reloads.
(function (root) {
  const ED = root.ED, R = ED.Run;
  const rand = ED.rand, rint = ED.rint;
  const EV = ED.EVENTS = {};
  const Ev = ED.Events = {};
  const leave = (l) => ({ l: l || 'Leave', go: () => ({ end: true }) });
  const pct = (run, f) => Math.max(1, Math.floor(run.maxHp * f));
  const done = (msg) => ({ s: 'done', msg });

  // ---------- the opening boon ----------
  const BOONS = {
    gold: { l: 'Salvaged purse', d: 'Gain 100 Gold.', go(run) { R.gainGold(run, 100); return done('Coins clink in the purse.'); } },
    maxhp: { l: 'Hardy constitution', d: (run) => 'Raise your Max HP by ' + Math.round(run.maxHp * 0.1) + '.', go(run) { R.addMaxHp(run, Math.round(run.maxHp * 0.1)); return done('You feel sturdier.'); } },
    relic: { l: 'Washed-up trinket', d: 'Obtain a random common relic.', go(run, d) { const k = R.rollRelic(run, 'common'); R.gainRelic(run, k); d.relic = k; return done('You found the ' + ED.RELICS[k].n + '.'); } },
    remove: { l: 'Lighten the pack', d: 'Remove a card from your deck.', go() { return { select: { purpose: 'remove', title: 'Remove a card' } }; } },
    upgrade: { l: 'Whetted edge', d: 'Upgrade a card.', go() { return { select: { purpose: 'upgrade', title: 'Upgrade a card' } }; } },
    transform: { l: 'Strange tide', d: 'Transform a card into a random one.', go() { return { select: { purpose: 'transform', title: 'Transform a card' } }; } },
    card: { l: 'Message in a bottle', d: 'Choose 1 of 3 cards to add to your deck.', go(run, d) { d.cards = R.rollCards(run, 3, 'elite'); return { s: 'pick' }; } },
    potions: { l: 'Smuggler\'s crate', d: 'Obtain 2 random potions.', go(run) { R.gainPotion(run, R.rollPotion(run)); R.gainPotion(run, R.rollPotion(run)); return done('Two bottles, still sealed.'); } },
    gamble: { l: 'Ember bargain', d: (run) => 'Lose ' + Math.round(run.maxHp * 0.1) + ' Max HP. Obtain a random rare relic.', go(run) { R.addMaxHp(run, -Math.round(run.maxHp * 0.1)); const k = R.rollRelic(run, 'rare'); R.gainRelic(run, k); return done('The ember gifts you the ' + ED.RELICS[k].n + '.'); } },
  };
  EV.neow = { n: 'The Ember Shrine', art: 'shrine', acts: [],
    init(run, d) { d.boons = ED.shuffle(run.rng, 'ev', Object.keys(BOONS)).slice(0, 3); },
    steps: {
      start: (run, d) => ({ text: 'You wash ashore beside a shrine where a single ember still glows. It offers a gift before your journey into the dark.',
        opts: d.boons.map((b) => ({ l: BOONS[b].l, d: typeof BOONS[b].d === 'function' ? BOONS[b].d(run) : BOONS[b].d, go: BOONS[b].go })).concat([leave('Walk on')]) }),
      pick: (run, d) => ({ text: 'The bottle holds three cards, wrapped in oilcloth. Take one.',
        opts: d.cards.map((c) => ({ card: c, l: ED.CARDS[c.k].n + (c.up ? '+' : ''), go(run2) { R.addCard(run2, c.k, c.up); return done(ED.CARDS[c.k].n + ' joins your deck.'); } })).concat([{ l: 'Skip', go: () => ({ end: true }) }]) }),
    } };

  // ---------- mystery events ----------
  EV.whale = { n: 'The Beached Whale', art: 'whale', acts: [1, 2],
    init(run, d) { d.gold = rint(run.rng, 'ev', 55, 70); },
    steps: { start: (run, d) => ({ text: 'A great whale lies dead on the sand, its belly glinting with swallowed treasure. Gulls circle, impatient.',
      opts: [
        { l: 'Climb inside', d: `Gain ${d.gold} Gold. Lose 8 HP.`, go(run2) { R.gainGold(run2, d.gold); R.hurt(run2, 8); return done('You emerge reeking, but richer.'); } },
        { l: 'Carve ambergris', d: 'Obtain a random potion. Lose 4 HP.', go(run2) { const k = R.rollPotion(run2); const ok = R.gainPotion(run2, k); R.hurt(run2, 4); return done(ok ? 'You bottle something precious: ' + ED.POTIONS[k].n + '.' : 'You have nowhere to keep it. It spoils on the sand.'); } },
        leave(),
      ] }) } };
  EV.idol = { n: 'The Tidepool Idol', art: 'idol', acts: [1, 2],
    steps: {
      start: (run) => ({ text: 'In a sea cave a golden idol sits on a stone plinth, slick with kelp. The tide is coming in.',
        opts: [{ l: 'Take the idol', d: 'Obtain the Golden Idol. Something will happen.', go(run2) { R.gainRelic(run2, 'goldenidol'); return { s: 'trap' }; } }, leave()] }),
      trap: (run) => ({ text: 'The plinth sinks and sea water roars into the cave!',
        opts: [
          { l: 'Swim for it', d: 'Lose ' + pct(run, 0.25) + ' HP.', go(run2) { R.hurt(run2, pct(run2, 0.25)); return done('You burst into daylight, gasping, idol in hand.'); } },
          { l: 'Hold your breath', d: 'Lose ' + pct(run, 0.08) + ' Max HP.', go(run2) { R.addMaxHp(run2, -pct(run2, 0.08)); return done('Your lungs burn, but you make it out.'); } },
          { l: 'Brace against the rocks', d: 'Become cursed: Injury.', go(run2) { R.addCard(run2, 'injury'); return done('Your shoulder pops. It never quite heals.'); } },
        ] }),
    } };
  EV.mermaid = { n: "The Mermaid's Bargain", art: 'mermaid', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: 'A mermaid lounges on a rock, combing her hair with a fishbone. "Everything has a price, darling."',
      opts: [
        { l: 'Trade your breath', d: 'Lose 6 Max HP. Obtain a random rare card.', go(run2, d) { R.addMaxHp(run2, -6); const c = R.rollCards(run2, 1, 'boss')[0]; R.addCard(run2, c.k, c.up); return done('She presses ' + ED.CARDS[c.k].n + ' into your hand.'); } },
        { l: 'Trade your gold', d: 'Pay 60 Gold. Remove a card.', dis: run.gold < 60 ? 'Need 60 Gold' : null, go(run2) { run2.gold -= 60; return { select: { purpose: 'remove', title: 'Remove a card', cancel: false } }; } },
        leave(),
      ] }) } };
  EV.campsite = { n: 'Abandoned Campsite', art: 'camp', acts: [1, 2],
    steps: { start: (run) => ({ text: 'Embers still smoulder in a ring of stones. Whoever camped here left in a hurry, packs and all.',
      opts: [
        { l: 'Rest by the embers', d: 'Heal ' + pct(run, 0.25) + ' HP.', go(run2) { R.heal(run2, pct(run2, 0.25)); return done('You doze, warm for once.'); } },
        { l: 'Search the packs', d: 'Obtain a random potion. They may come back...', go(run2) { const k = R.rollPotion(run2); R.gainPotion(run2, k); if (rand(run2.rng, 'ev') < 0.5) return { fight: { type: 'fight' }, msg: 'Footsteps! The owners return, blades drawn.' }; return done('You slip away with a ' + ED.POTIONS[k].n + '.'); } },
        leave(),
      ] }) } };
  EV.library = { n: 'Shipwrecked Library', art: 'book', acts: [2, 3],
    steps: {
      start: (run) => ({ text: 'A sunken galleon holds a captain\'s library, pages swollen but legible. A hammock sways in the corner.',
        opts: [
          { l: 'Read', d: 'Choose 1 of 3 cards to add to your deck.', go(run2, d) { d.cards = R.rollCards(run2, 3, 'elite'); return { s: 'pick' }; } },
          { l: 'Sleep', d: 'Heal ' + pct(run, 0.33) + ' HP.', go(run2) { R.heal(run2, pct(run2, 0.33)); return done('You sleep like the drowned.'); } },
        ] }),
      pick: (run, d) => ({ text: 'Three passages leap off the page.', opts: d.cards.map((c) => ({ card: c, l: ED.CARDS[c.k].n + (c.up ? '+' : ''), go(run2) { R.addCard(run2, c.k, c.up); return done('You commit ' + ED.CARDS[c.k].n + ' to memory.'); } })).concat([{ l: 'Skip', go: () => ({ end: true }) }]) }),
    } };
  EV.well = { n: 'The Wishing Well', art: 'well', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: 'An old stone well hums with a faint glow. Coins glitter far below.',
      opts: [
        { l: 'Toss a coin', d: 'Pay 25 Gold. 50%: obtain a random relic.', dis: run.gold < 25 ? 'Need 25 Gold' : null, go(run2, d) { run2.gold -= 25; if (rand(run2.rng, 'ev') < 0.5) { const k = R.rollRelic(run2); if (k) { R.gainRelic(run2, k); return done('The well sighs and coughs up the ' + ED.RELICS[k].n + '!'); } } return done('Plink. Nothing happens.'); } },
        { l: 'Dive in', d: 'Lose 10 HP. Gain 75 Gold.', go(run2) { R.hurt(run2, 10); R.gainGold(run2, 75); return done('Freezing, but your pockets are full.'); } },
        leave(),
      ] }) } };
  EV.shrine = { n: 'Shrine of Embers', art: 'shrine', acts: [1, 2, 3],
    steps: { start: () => ({ text: 'A crumbling shrine of black glass holds an ember that never dies. It flares as you approach.',
      opts: [
        { l: 'Pray', d: 'Upgrade a card.', go() { return { select: { purpose: 'upgrade', title: 'Upgrade a card', cancel: false } }; } },
        { l: 'Offer a card to the flame', d: 'Remove a card. Lose 5 HP.', go() { return { select: { purpose: 'remove', title: 'Burn away a card', hurt: 5, cancel: false } }; } },
        leave(),
      ] }) } };
  EV.hermit = { n: 'The Hermit Crab Trader', art: 'crab', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: 'A crab the size of a rowboat wears a lighthouse lens as its shell. It clicks: it wants to trade.',
      opts: [
        { l: 'Swap shells', d: 'Transform a card.', go() { return { select: { purpose: 'transform', title: 'Transform a card', cancel: false } }; } },
        { l: 'Trade a potion', d: 'Lose a random potion. Gain 80 Gold.', dis: run.potions.some(Boolean) ? null : 'No potions', go(run2) { const idx = run2.potions.map((p, i) => (p ? i : -1)).filter((i) => i >= 0); const i = ED.pick(run2.rng, 'ev', idx); run2.potions[i] = null; R.gainGold(run2, 80); return done('Click click. The crab seems pleased.'); } },
        leave(),
      ] }) } };
  EV.fog = { n: 'Fog of Whispers', art: 'fog', acts: [2, 3],
    steps: { start: () => ({ text: 'A cold fog rolls in carrying voices: the drowned, bargaining. One offers a gift if you will carry its doubt.',
      opts: [
        { l: 'Listen', d: 'Obtain a random rare relic. Become cursed: Doubt.', go(run2) { const k = R.rollRelic(run2, 'rare'); R.gainRelic(run2, k); R.addCard(run2, 'doubt'); return done('You hold the ' + (k ? ED.RELICS[k].n : 'nothing') + '. The whispers follow you.'); } },
        { l: 'Shout back', d: 'Lose 6 HP. Upgrade 2 random cards.', go(run2) { R.hurt(run2, 6); const ups = ED.shuffle(run2.rng, 'ev', run2.deck.filter(ED.upgradable)).slice(0, 2); ups.forEach((c) => { c.up = 1; }); return done(ups.length ? 'Defiance sharpens ' + ups.map((c) => ED.CARDS[c.k].n).join(' and ') + '.' : 'Your voice echoes back.'); } },
        leave(),
      ] }) } };
  EV.bones = { n: 'Bones of the Drowned', art: 'skull', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: 'A skeleton in a captain\'s coat lies half-buried. A ring still glints on one finger.',
      opts: [
        { l: 'Take the ring', d: 'Obtain a random relic. Become cursed: Decay.', go(run2) { const k = R.rollRelic(run2); R.gainRelic(run2, k); R.addCard(run2, 'decay'); return done('It is the ' + (k ? ED.RELICS[k].n : 'nothing') + '. Your skin feels cold.'); } },
        { l: 'Bury them', d: 'Heal ' + pct(run, 0.2) + ' HP.', go(run2) { R.heal(run2, pct(run2, 0.2)); return done('A small peace settles over you.'); } },
        leave(),
      ] }) } };
  EV.duelist = { n: 'The Dueling Pirate', art: 'pirate', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: '"None pass without crossin\' steel with Gentleman Jack!" A pirate in a feathered hat bars the path.',
      opts: [
        { l: 'Duel him', d: 'Fight an elite. Win a relic.', go() { return { fight: { type: 'elite' } }; } },
        { l: 'Pay the toll', d: 'Lose 35 Gold.', dis: run.gold < 35 ? 'Need 35 Gold' : null, go(run2) { run2.gold -= 35; return done('"A gentleman\'s choice!"'); } },
        { l: 'Run', d: 'Lose 7 HP.', go(run2) { R.hurt(run2, 7); return done('A parting slash catches your arm.'); } },
      ] }) } };
  EV.tidepools = { n: 'The Tide Pools', art: 'pool', acts: [1, 2, 3],
    init(run, d) { d.cost = 3; d.tries = 0; },
    steps: {
      start: (run, d) => ({ text: d.tries ? 'Spiny things nip at your fingers. Something still glints deeper in.' : 'Clear pools glitter with shells, urchins and something that might be treasure.',
        opts: [
          { l: 'Reach in', d: `Lose ${d.cost} HP. 35%: find a relic, otherwise 15 Gold.`, go(run2, d2) { R.hurt(run2, d2.cost); d2.cost += 3; d2.tries++; if (rand(run2.rng, 'ev') < 0.35) { const k = R.rollRelic(run2); if (k) { R.gainRelic(run2, k); return done('Your fingers close on the ' + ED.RELICS[k].n + '!'); } } R.gainGold(run2, 15); return { s: 'start' }; } },
          leave(d.tries ? 'Stop' : 'Leave'),
        ] }),
    } };
  EV.alchemist = { n: 'The Wandering Alchemist', art: 'flask', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: 'A cart rattles with bottles. "Remedies! Tonics! Questionable brews! All fresh from the deep!"',
      opts: [
        { l: 'Buy a remedy', d: 'Pay 30 Gold. Obtain a random potion.', dis: run.gold < 30 ? 'Need 30 Gold' : (!run.potions.includes(null) ? 'Potion slots full' : null), go(run2) { run2.gold -= 30; const k = R.rollPotion(run2); R.gainPotion(run2, k); return done('"' + ED.POTIONS[k].n + '! Excellent choice."'); } },
        { l: 'Drink the strange brew', d: 'Raise your Max HP by 8. Become cursed: Clumsy.', go(run2) { R.addMaxHp(run2, 8); R.addCard(run2, 'clumsy'); return done('You feel enormous, and your fingers feel like sausages.'); } },
        leave(),
      ] }) } };
  EV.lighthouse = { n: 'The Lighthouse Keeper', art: 'lighthouse', acts: [1, 2, 3],
    steps: { start: (run) => ({ text: 'An old keeper waves you up the spiral stairs. "Tea? Or you could help me fix the great lamp."',
      opts: [
        { l: 'Share his tea', d: 'Pay 40 Gold. Heal to full.', dis: run.gold < 40 ? 'Need 40 Gold' : null, go(run2) { run2.gold -= 40; R.heal(run2, run2.maxHp); return done('The best tea you have ever had.'); } },
        { l: 'Fix the lamp', d: 'Raise Max HP by 4. Upgrade a random card.', go(run2) { R.addMaxHp(run2, 4); const ups = ED.shuffle(run2.rng, 'ev', run2.deck.filter(ED.upgradable)).slice(0, 1); ups.forEach((c) => { c.up = 1; }); return done('The beam sweeps the sea again.' + (ups.length ? ' ' + ED.CARDS[ups[0].k].n + ' was upgraded.' : '')); } },
        leave(),
      ] }) } };
  EV.merchant = { n: 'The Drowned Merchant', art: 'coin', acts: [2, 3],
    steps: { start: (run) => ({ text: 'A ghostly merchant floats over a chest. "One trade, then I sleep. A card for a card?"',
      opts: [
        { l: 'Trade', d: 'Remove a card. Then choose 1 of 3 rare cards.', go(run2, d) { d.cards = R.rollCards(run2, 3, 'boss'); return { select: { purpose: 'remove', title: 'Give up a card', cancel: false }, after: 'pick' }; } },
        leave(),
      ] }),
      pick: (run, d) => ({ text: '"A fair trade. Choose."', opts: d.cards.map((c) => ({ card: c, l: ED.CARDS[c.k].n, go(run2) { R.addCard(run2, c.k, c.up); return done('The merchant fades with a smile.'); } })) }),
    } };

  // ---------- framework ----------
  Ev.begin = function (run, key) {
    if (!key) {
      const pool = Object.keys(EV).filter((k) => EV[k].acts.includes(run.act) && !run.eventsSeen.includes(k));
      key = pool.length ? ED.pick(run.rng, 'ev', pool) : 'well';
    }
    if (key !== 'neow') run.eventsSeen.push(key);
    const ev = { k: key, s: 'start', d: {}, after: null };
    if (EV[key].init) EV[key].init(run, ev.d);
    return ev;
  };
  Ev.view = function (run) {
    const ev = run.event;
    const def = EV[ev.k];
    if (ev.s === 'done') return { n: def.n, art: def.art, text: ev.d.msg || '', opts: [{ l: 'Continue', go: () => ({ end: true }) }] };
    const st = def.steps[ev.s](run, ev.d);
    return { n: def.n, art: def.art, text: st.text, opts: st.opts };
  };
  Ev.choose = function (run, i) {
    if (run.phase !== 'event' || !run.event) return false;
    const v = Ev.view(run);
    const o = v.opts[i];
    if (!o || o.dis) return false;
    const res = o.go(run, run.event.d) || { end: true };
    if (res.end) { R.toMap(run); return true; }
    if (res.fight) {
      run.event.d.msg = res.msg || null;
      run.event.after = null;
      const type = res.fight.type;
      R.startFight(run, type, null, 'event');
      return true;
    }
    if (res.select) {
      run.event.d.msg = res.select.msg || null;
      R.beginSelect(run, res.select.purpose, run.event.k === 'neow' ? 'neow' : 'event', { title: res.select.title, after: res.after || null, hurt: res.select.hurt, cancel: false });
      return true;
    }
    if (res.msg !== undefined) run.event.d.msg = res.msg;
    run.event.s = res.s || 'done';
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
