// DRIFTWOOD — DOM UI: lobby, HUD, inventory, crafting, chat, end screen
(function (G) {
  'use strict';
  const UI = { open: false, drag: null, color: G.PLAYER_COLORS[0], lastInv: '', lastPw: '', chatOpen: false, cls: 'castaway', lastOffer: null };
  // ---- persistent meta (per browser) ----
  UI.loadMeta = () => { try { return Object.assign({ shards: 0, up: {}, log: { bestDay: 0, kills: 0, bosses: 0, wins: 0, runs: 0, chests: 0 } }, JSON.parse(localStorage.getItem('driftwood_meta') || '{}')); } catch (e) { return { shards: 0, up: {}, log: { bestDay: 0, kills: 0, bosses: 0, wins: 0, runs: 0, chests: 0 } }; } };
  UI.saveMeta = (m) => { try { localStorage.setItem('driftwood_meta', JSON.stringify(m)); } catch (e) { } };
  UI.classUnlocked = (c, meta) => !c.unlock || (meta.log[c.unlock.key] || 0) >= c.unlock.n;
  G.UI = UI;
  const $ = (id) => document.getElementById(id);
  const I = G.ITEMS;

  UI.init = function () {
    // swatches
    const sw = $('swatches');
    G.PLAYER_COLORS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'swatch' + (i === 0 ? ' sel' : ''); d.style.background = c; d.onclick = () => { UI.color = c; [...sw.children].forEach(x => x.classList.remove('sel')); d.classList.add('sel'); }; sw.appendChild(d); });
    try { const saved = JSON.parse(localStorage.getItem('driftwood') || '{}'); if (saved.hat && G.HAT[saved.hat]) UI.hat = saved.hat; if (saved.skin && G.SKINS.some(k => k.id === saved.skin)) UI.skin = saved.skin; if (saved.name) $('name').value = saved.name; if (saved.color) { UI.color = saved.color; [...sw.children].forEach((x, i) => x.classList.toggle('sel', G.PLAYER_COLORS[i] === saved.color)); } if (saved.cls) UI.cls = saved.cls; } catch (e) { }
    UI.renderClasses(); UI.renderHats(); UI.renderSkins(); $('btn-howto').onclick = () => $('howto').classList.remove('hidden'); $('howto-done').onclick = () => $('howto').classList.add('hidden'); UI.renderHowto(); $('tut-close').onclick = () => { const m = UI.loadMeta(); m.tutorialOff = true; UI.saveMeta(m); $('tutorial').classList.add('hidden'); }; $('btn-camp').onclick = () => UI.showCamp(null); $('camp-done').onclick = () => { $('camp').classList.add('hidden'); if (G.Main.started) location.reload(); };
    $('btn-settings').onclick = () => UI.showSettings(); $('menu-settings').onclick = () => UI.showSettings(); $('settings-done').onclick = () => UI.hideSettings();
    $('menu-resume').onclick = () => { UI.setResume(false); UI.paused = false; G.Input.lock(); }; $('resume').onclick = (e) => { if (e.target.id === 'resume') { UI.setResume(false); UI.paused = false; G.Input.lock(); } }; $('menu-quit').onclick = () => location.reload();
    $('binds-reset').onclick = () => { G.Input.resetBinds(); UI.renderBinds(); };
    const S = G.Input.settings; const sync = () => { $('set-sens').value = S.sens; $('sens-v').textContent = S.sens.toFixed(1) + '×'; $('set-fov').value = S.fov; $('fov-v').textContent = S.fov + '°'; $('set-q').value = S.quality; $('q-v').textContent = Math.round(S.quality * 100) + '%'; $('set-inv').checked = !!S.invertY; $('set-shake').checked = !!S.shake; $('set-bob').checked = !!S.bob; $('set-toon').checked = S.toon !== false; $('set-autoq').checked = S.autoq !== false; const mm = UI.loadMeta(); $('set-tut').checked = !mm.tutorialOff; };
    sync();
    $('set-sens').oninput = () => { S.sens = +$('set-sens').value; G.Input.saveSettings(); sync(); }; $('set-fov').oninput = () => { S.fov = +$('set-fov').value; G.Input.saveSettings(); sync(); }; $('set-q').oninput = () => { S.quality = +$('set-q').value; G.Input.saveSettings(); sync(); };
    $('set-inv').onchange = () => { S.invertY = $('set-inv').checked; G.Input.saveSettings(); }; $('set-shake').onchange = () => { S.shake = $('set-shake').checked; G.Input.saveSettings(); }; $('set-bob').onchange = () => { S.bob = $('set-bob').checked; G.Input.saveSettings(); }; $('set-toon').onchange = () => { S.toon = $('set-toon').checked; G.Input.saveSettings(); }; $('set-tut').onchange = () => { const m = UI.loadMeta(); m.tutorialOff = !$('set-tut').checked; if ($('set-tut').checked) { m.tutorialDone = false; UI.tutStep = 0; } UI.saveMeta(m); UI.tutMeta = null; UI.tutLast = ''; }; $('set-autoq').onchange = () => { S.autoq = $('set-autoq').checked; G.Input.saveSettings(); if (!S.autoq) { G.Render.qScale = 1; G.Render.resize(); } };
    // tabs
    const tabs = { host: $('tab-host'), join: $('tab-join'), solo: $('tab-solo') };
    for (const k in tabs) tabs[k].onclick = () => { for (const j in tabs) { tabs[j].classList.toggle('sel', j === k); $('pane-' + j).classList.toggle('hidden', j !== k); } $('manual-host').classList.toggle('hidden', k === 'join'); $('manual-client').classList.toggle('hidden', k !== 'join'); };
    $('manual-client').classList.add('hidden');
    $('randseed').onclick = () => $('seed').value = Math.random().toString(36).slice(2, 8).toUpperCase();
    const name = () => { const n = $('name').value.trim() || 'Castaway'; try { localStorage.setItem('driftwood', JSON.stringify({ name: n, color: UI.color, cls: UI.cls })); } catch (e) { } return n; };
    $('btn-host').onclick = () => { $('btn-host').disabled = true; G.Main.host(name(), UI.color, $('seed').value.trim()); };
    $('btn-start').onclick = () => G.Main.startHostGame();
    $('btn-join').onclick = () => { const code = $('joincode').value.trim().toUpperCase(); if (code.length < 5) return UI.status('Enter the 5-letter room code.'); $('btn-join').disabled = true; G.Main.join(name(), UI.color, code); };
    $('btn-solo').onclick = () => G.Main.solo(name(), UI.color, $('seed2').value.trim());
    $('copycode').onclick = () => { try { navigator.clipboard.writeText($('roomcode').textContent); UI.status('Code copied!'); } catch (e) { } };
    $('joincode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
    // manual signalling
    $('mk-invite').onclick = async () => { $('mk-invite').disabled = true; try { G.Main.ensureHostForManual(name(), UI.color, $('seed').value.trim()); $('invite-out').value = await G.Net.manualCreateInvite(); UI.status('Invite ready — send it to your friend, then paste their reply below.'); try { navigator.clipboard.writeText($('invite-out').value); } catch (e) { } } catch (e) { UI.status('Could not create invite: ' + e.message); } $('mk-invite').disabled = false; };
    $('accept-reply').onclick = async () => { try { await G.Net.manualAcceptReply($('reply-in').value); $('reply-in').value = ''; UI.status('Reply accepted — connecting…'); } catch (e) { UI.status('Bad reply code.'); } };
    $('mk-reply').onclick = async () => { try { G.Main.prepareClient(name(), UI.color); $('reply-out').value = await G.Net.manualAcceptInvite($('invite-in').value); UI.status('Reply ready — send it back to the host and wait.'); try { navigator.clipboard.writeText($('reply-out').value); } catch (e) { } } catch (e) { UI.status('Bad invite code.'); } };
    $('btn-again').onclick = () => location.reload();
    // hotbar / inventory grids
    const hb = $('hotbar'); for (let i = 0; i < 9; i++) hb.appendChild(mkSlot(i, true));
    const grid = $('invgrid'); for (let i = 0; i < 27; i++) grid.appendChild(mkSlot(i, false));
    const arm = $('armor'); ['head', 'chest', 'legs', 'trinket'].forEach(s => { const d = document.createElement('div'); d.className = 'slot'; d.dataset.l = s; d.dataset.armor = s; const c = document.createElement('canvas'); c.width = 16; c.height = 16; d.appendChild(c); d.oncontextmenu = (e) => { e.preventDefault(); G.Main.act({ a: 'unequip', slot: s }); }; d.onclick = () => G.Main.act({ a: 'unequip', slot: s }); d.onmouseenter = () => { const V = G.Main.view(); const me = V && V.players[V.me]; if (me && me.armor[s]) tip(d, me.armor[s]); }; d.onmouseleave = hideTip; arm.appendChild(d); });
    // chat
    $('chatin').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = $('chatin').value.trim(); if (v) G.Main.act({ a: 'chat', msg: v }); closeChat(); e.preventDefault(); } else if (e.key === 'Escape') { closeChat(); } e.stopPropagation(); });
    G.Input.onKey = (k, e) => {
      if (UI.chatOpen) return false;
      if (!$('settings').classList.contains('hidden')) { if (k === 'Escape') UI.hideSettings(); return true; }
      const B = G.Input.binds;
      if (k === B.chat && G.Main.started) { openChat(); return true; }
      if (k === B.inventory && G.Main.started) { UI.toggleInv(); return true; }
      if (k === 'Escape' || k === B.menu) { if (UI.casOpen) { UI.casino(false); return true; } if (UI.open) { UI.toggleInv(false); return true; } if (!$('confirm').classList.contains('hidden')) { $('confirm').classList.add('hidden'); return true; } if (G.Main.started && k !== 'Escape') { G.Input.unlock(); UI.setResume(true); return true; } }
      if (k === B.mute) { const m = G.Audio.toggleMute(); UI.toast(m ? 'Muted' : 'Sound on', ''); return true; }
      if (UI.lastOffer && k >= '1' && k <= '4' && e.altKey) { G.Main.act({ a: 'pick', i: +k - 1 }); return true; }
      return false;
    };
    G.Net.onStatus = UI.status;
  };
  UI.status = (s) => { $('status').textContent = s || ''; };
  // ---- hats (cosmetics): free ones, ones won at the Dealer's Table, ones bought with shards ----
  UI.hat = 'none';
  UI.ownedHats = (meta) => { const m = meta || UI.loadMeta(); const owned = new Set(['none', 'cap', 'beanie']); (m.hats || []).forEach(h => owned.add(h)); return owned; };
  UI.renderHats = function () {
    const meta = UI.loadMeta(); const owned = UI.ownedHats(meta); const box = $('hats'); if (!box) return; box.innerHTML = '';
    if (!owned.has(UI.hat)) UI.hat = 'none';
    G.HATS.forEach(h => { const d = document.createElement('div'); const ok = owned.has(h.id); d.className = 'hat' + (h.id === UI.hat ? ' sel' : '') + (ok ? '' : ' locked'); d.textContent = h.name + (ok ? '' : ' · ' + h.cost + ' shards'); d.title = ok ? 'wear it' : 'buy for ' + h.cost + ' shards (or win it at the Dealer\'s Table)';
      d.onclick = () => { if (ok) { UI.hat = h.id; UI.saveLobby(); UI.renderHats(); } else { const m = UI.loadMeta(); if (m.shards < h.cost) { UI.toast('Not enough shards', h.name + ' costs ' + h.cost + ' shards — earn them by finishing runs, or win hats at the Dealer\'s Table.', '#ff6060'); return; } m.shards -= h.cost; m.hats = (m.hats || []).concat([h.id]); UI.saveMeta(m); UI.hat = h.id; UI.saveLobby(); UI.renderHats(); UI.renderClasses(); UI.toast('New hat', h.name + ' is yours.'); } };
      box.appendChild(d); });
  };
  UI.saveLobby = function () { try { const saved = JSON.parse(localStorage.getItem('driftwood') || '{}'); saved.hat = UI.hat; saved.skin = UI.skin; localStorage.setItem('driftwood', JSON.stringify(saved)); } catch (e) { } };
  UI.skin = 'knight';
  UI.renderSkins = function () { const box = $('skins'); if (!box) return; box.innerHTML = ''; G.SKINS.forEach(k => { const d = document.createElement('div'); d.className = 'hat' + (k.id === UI.skin ? ' sel' : ''); d.textContent = k.name; d.onclick = () => { UI.skin = k.id; UI.saveLobby(); UI.renderSkins(); }; box.appendChild(d); }); };
  UI.unlockHat = function (id) { if (!G.HAT[id]) return; const m = UI.loadMeta(); if ((m.hats || []).includes(id) || ['none', 'cap', 'beanie'].includes(id)) { m.shards += 40; UI.saveMeta(m); UI.toast('Duplicate hat', 'You already own the ' + G.HAT[id].name + ' — 40 shards instead.'); return; } m.hats = (m.hats || []).concat([id]); UI.saveMeta(m); UI.toast('New hat unlocked!', G.HAT[id].name + ' — wear it from the lobby.', '#ff4fd8'); };
  UI.renderClasses = function () {
    const meta = UI.loadMeta(); const box = $('classes'); box.innerHTML = '';
    if (!UI.classUnlocked(G.CLASSES.find(c => c.id === UI.cls) || G.CLASSES[0], meta)) UI.cls = 'castaway';
    G.CLASSES.forEach(c => { const d = document.createElement('div'); const ok = UI.classUnlocked(c, meta); d.className = 'cls' + (c.id === UI.cls ? ' sel' : '') + (ok ? '' : ' locked'); d.innerHTML = '<b>' + c.name + '</b><span>' + (ok ? c.desc : 'Unlock: ' + c.unlock.txt) + '</span>'; if (ok) d.onclick = () => { UI.cls = c.id; UI.renderClasses(); }; box.appendChild(d); });
    const ranks = Object.values(meta.up).reduce((a, b) => a + b, 0);
    $('metaline').textContent = meta.shards + ' shards · ' + ranks + ' upgrade ranks · best day ' + meta.log.bestDay + ' · ' + meta.log.wins + ' escapes';
  };
  UI.showCamp = function (run) {
    const meta = UI.loadMeta(); $('camp').classList.remove('hidden'); $('hud').classList.add('hidden'); $('end').classList.add('hidden'); $('lobby').classList.add('hidden'); $('boon').classList.add('hidden');
    $('camp-run').innerHTML = run ? '<div>' + (run.win ? '<b style="color:var(--acc)">You escaped the island.</b>' : '<b style="color:#e03030">The island kept you.</b>') + ' Days: <b>' + run.day + '</b> · Bosses: <b>' + run.bosses + '</b> · Kills: <b>' + run.kills + '</b> · Level <b>' + run.lvl + '</b> · Seed <b>' + esc(run.seed) + '</b></div><div>Shards earned: <b style="color:var(--acc)">+' + run.shards + '</b></div>' : '<div>Total: <b>' + meta.log.runs + '</b> runs · best day <b>' + meta.log.bestDay + '</b> · <b>' + meta.log.kills + '</b> kills · <b>' + meta.log.bosses + '</b> guardians slain · <b>' + meta.log.wins + '</b> escapes</div>';
    const draw = () => {
      const m = UI.loadMeta(); $('shards').textContent = m.shards; const list = $('camp-list'); list.innerHTML = '';
      G.META.forEach(u => { const r = m.up[u.id] || 0; const d = document.createElement('div'); d.className = 'meta' + (r >= u.max ? ' max' : ''); const cost = r < u.max ? u.cost[r] : null; d.innerHTML = '<div class="i"><b>' + u.name + '</b><span>' + u.desc + '</span></div><div class="r">' + '◆'.repeat(r) + '◇'.repeat(u.max - r) + '</div>'; const b = document.createElement('button'); b.textContent = cost === null ? 'MAX' : cost + ' ◈'; b.disabled = cost === null || m.shards < cost; b.onclick = () => { const mm = UI.loadMeta(); if ((mm.up[u.id] || 0) < u.max && mm.shards >= u.cost[mm.up[u.id] || 0]) { mm.shards -= u.cost[mm.up[u.id] || 0]; mm.up[u.id] = (mm.up[u.id] || 0) + 1; UI.saveMeta(mm); G.Audio.play('craft'); draw(); UI.renderClasses(); } }; d.appendChild(b); list.appendChild(d); });
      $('camplog').textContent = 'Classes unlock from the log: ' + G.CLASSES.filter(c => c.unlock).map(c => c.name + (UI.classUnlocked(c, m) ? ' ✓' : ' (' + c.unlock.txt + ')')).join(' · ');
    };
    draw();
  };
  UI.recordRun = function (V, win, shards) {
    const meta = UI.loadMeta(); const me = V.players[V.me] || {};
    meta.shards += shards; meta.log.runs++; meta.log.bestDay = Math.max(meta.log.bestDay, V.day); meta.log.kills += me.kills || 0; meta.log.bosses += V.stats.bosses || 0; meta.log.chests += V.stats.chests || 0; if (win) meta.log.wins++;
    UI.saveMeta(meta);
    return { win, day: V.day, bosses: V.stats.bosses || 0, kills: me.kills || 0, lvl: me.lvl || 1, seed: V.world.seed, shards };
  };
  UI.boon = function (me) {
    const o = me.offer !== undefined ? me.offer : (me.offers && me.offers.length ? me.offers[0] : null); const key = o ? JSON.stringify(o) : null;
    if (key !== UI.lastOffer) {
      UI.lastOffer = key; $('boon').classList.toggle('hidden', !o);
      if (o) {
        $('boon-title').textContent = (o.why ? o.why + ' — ' : '') + 'choose a boon';
        const box = $('boon-opts'); box.innerHTML = '';
        o.opts.forEach((id, i) => { const p = G.PW[id]; const d = document.createElement('div'); d.className = 'boonopt'; d.style.borderColor = G.RARITY_COL[p.rarity]; const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(G.Sprites.powerup(id), 0, 0); d.appendChild(c); const b = document.createElement('b'); b.textContent = p.name + (me.pw[id] ? ' ×' + (me.pw[id] + 1) : ''); b.style.color = G.RARITY_COL[p.rarity]; d.appendChild(b); const sp = document.createElement('span'); sp.textContent = p.desc; d.appendChild(sp); const k = document.createElement('div'); k.className = 'k'; k.textContent = G.RARITY_NAME[p.rarity] + ' · Alt+' + (i + 1); d.appendChild(k); d.onclick = () => G.Main.act({ a: 'pick', i }); box.appendChild(d); });
      }
    }
    if (o) $('boon-timer').textContent = 'auto-pick in ' + Math.max(0, 25 - Math.round(me.offerT || 0)) + 's · the game keeps running';
  };
  // ---- the Dealer's Table ----
  UI.casOpen = false; UI.casGame = 'slots'; UI.casBet = {}; UI.casPending = null;
  const casAct = (a) => G.Main.act(a);
  UI.casino = function (open, ev) {
    UI.casOpen = !!open; $('casino').classList.toggle('hidden', !open);
    if (open) { UI.casAt = ev ? { x: ev.x, y: ev.y } : null; G.Input.unlock(); UI.setResume(false); G.Main.act({ a: 'sit', v: 1 }); $('cas-log').textContent = 'Pick a game. Every bet is paid in coins; boons are the same skills you get from chests and levels.'; UI.casRender(); }
    else { UI.casPending = null; if (G.Main.started) G.Main.act({ a: 'sit', v: 0 }); if (G.Main.started && !UI.open) G.Input.lock(); }
  };
  $('cas-leave').onclick = () => UI.casino(false);
  [...$('cas-tabs').children].forEach(b => b.onclick = () => { UI.casGame = b.dataset.g; [...$('cas-tabs').children].forEach(x => x.classList.toggle('sel', x === b)); UI.casRender(); });
  const betRow = (bets, key, onPick) => { const row = document.createElement('div'); row.className = 'bets'; const l = document.createElement('span'); l.className = 'small'; l.textContent = 'Bet:'; row.appendChild(l); if (UI.casBet[key] === undefined) UI.casBet[key] = bets[0]; bets.forEach(b => { const x = document.createElement('button'); x.textContent = b + ' ⬤'; x.className = UI.casBet[key] === b ? 'sel' : ''; x.onclick = () => { UI.casBet[key] = b; UI.casRender(); }; row.appendChild(x); }); return row; };
  const bigBtn = (txt, fn) => { const b = document.createElement('button'); b.className = 'bigbtn'; b.textContent = txt; b.onclick = fn; return b; };
  const sym = (id) => (G.SLOT_SYMBOLS.find(s => s.id === id) || { ch: '?' }).ch;
  const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const WHEEL_COL = ['#c0c0c0', '#5aa0ff', '#d05aff', '#ffd24a', '#5aff8a', '#ff4060'];
  UI.casRender = function () {
    const me = G.Main.V && G.Main.V.players[G.Main.V.me]; const coins = me ? me.coins : 0; $('cas-coins').textContent = '⬤ ' + coins;
    const body = $('cas-body'); body.innerHTML = ''; const g = UI.casGame; const C = G.CASINO;
    const rigRow = document.createElement('div'); rigRow.className = 'bets rigs'; const rl = document.createElement('span'); rl.className = 'small'; rl.textContent = 'Sketchy items:'; rigRow.appendChild(rl);
    C.rigs.forEach(r => { const b = document.createElement('button'); const have = me && me.rig && me.rig[r.id]; b.className = have ? 'sel' : ''; b.textContent = r.name + (have ? ' ✓' : ' · ' + r.cost + ' ⬤'); b.title = r.desc; b.disabled = !!have; b.onclick = () => casAct({ a: 'gamble', g: 'buy', item: r.id }); rigRow.appendChild(b); });
    if (g === 'slots') {
      const reels = document.createElement('div'); reels.className = 'reels'; reels.id = 'reels'; for (let i = 0; i < 3; i++) { const r = document.createElement('div'); r.className = 'reel'; r.textContent = UI.casLast && UI.casLast.reels ? sym(UI.casLast.reels[i]) : ['🍒', '🔔', '7'][i]; reels.appendChild(r); } body.appendChild(reels);
      body.appendChild(betRow(C.slotsBets, 'slots')); body.appendChild(bigBtn('SPIN', () => casAct({ a: 'gamble', g: 'slots', bet: UI.casBet.slots })));
      const o = document.createElement('div'); o.className = 'odds'; o.innerHTML = 'Pair pays <b>×2</b> · two 7s <b>×4</b> · three of a kind <b>×6</b> (+ a boon) · <b>777</b> pays <b>×20</b>, an <b>epic boon</b> and a <b>hat</b> · skulls hex you (−15% damage for a while).'; body.appendChild(o);
    } else if (g === 'dice') {
      const d = document.createElement('div'); d.className = 'dice'; d.id = 'dice'; const L = UI.casLast && UI.casLast.mine ? UI.casLast : { mine: [0, 0], dealer: [0, 0] }; d.innerHTML = '<div class="side">you<span>' + DIE[L.mine[0]] + DIE[L.mine[1]] + '</span></div><div style="font-size:18px;color:var(--muted)">vs</div><div class="side">dealer<span>' + DIE[L.dealer[0]] + DIE[L.dealer[1]] + '</span></div>'; body.appendChild(d);
      body.appendChild(betRow(C.diceBets, 'dice')); body.appendChild(bigBtn('ROLL', () => casAct({ a: 'gamble', g: 'dice', bet: UI.casBet.dice })));
      const o = document.createElement('div'); o.className = 'odds'; o.innerHTML = 'Higher total wins <b>×2</b>, ties push. <b>Boxcars</b> (6+6) also grants a common boon · <b>snake eyes</b> hexes you.'; body.appendChild(o);
    } else if (g === 'wheel') {
      const wrap = document.createElement('div'); wrap.className = 'wheelwrap'; const cv = document.createElement('canvas'); cv.width = 340; cv.height = 340; cv.id = 'wheelcv'; wrap.appendChild(cv);
      const tier = Math.max(0, C.wheelBets.indexOf(UI.casBet.wheel === undefined ? C.wheelBets[0] : UI.casBet.wheel)); const odds = C.wheel[tier];
      const o = document.createElement('div'); o.className = 'odds'; o.innerHTML = '<b>Bet ' + C.wheelBets[tier] + '</b> odds:<br>' + C.wheelNames.map((n, i) => '<span style="color:' + WHEEL_COL[i] + '">■</span> ' + n + ' <b>' + Math.round(odds[i] * 100) + '%</b>').join('<br>'); wrap.appendChild(o); body.appendChild(wrap);
      body.appendChild(betRow(C.wheelBets, 'wheel')); body.appendChild(bigBtn('SPIN THE WHEEL', () => casAct({ a: 'gamble', g: 'wheel', bet: UI.casBet.wheel })));
      UI.drawWheel(cv, odds, UI.casWheelAng || 0);
    } else if (g === 'bj') {
      const L = UI.casLast && UI.casLast.g === 'bj' && UI.casLast.hand ? UI.casLast : null;
      const hand = (lbl, cards, val) => { const h = document.createElement('div'); h.className = 'hand'; h.innerHTML = '<div class="lbl">' + lbl + (val !== undefined ? ' — ' + val : '') + '</div>'; const cs = document.createElement('div'); cs.className = 'cards'; (cards || []).forEach(c => { const d = document.createElement('div'); d.className = 'card' + (c === '??' ? ' back' : /[♥♦]/.test(c) ? ' red' : ''); d.textContent = c; cs.appendChild(d); }); h.appendChild(cs); return h; };
      body.appendChild(hand('Dealer', L ? L.dealer : [], L && L.dval)); body.appendChild(hand('You', L ? L.hand : [], L && L.val));
      if (L && !L.done) { const row = document.createElement('div'); row.className = 'bets'; row.appendChild(bigBtn('HIT', () => casAct({ a: 'bj', op: 'hit' }))); row.appendChild(bigBtn('STAND', () => casAct({ a: 'bj', op: 'stand' }))); body.appendChild(row); }
      else { body.appendChild(betRow(C.bjBets, 'bj')); body.appendChild(bigBtn('DEAL', () => casAct({ a: 'bj', op: 'deal', bet: UI.casBet.bj }))); }
      const o = document.createElement('div'); o.className = 'odds'; o.innerHTML = 'Dealer stands on 17. Win pays <b>×2</b>, push returns your bet, a natural <b>blackjack</b> pays <b>5:2</b> and grants a <b>rare boon</b>.'; body.appendChild(o);
    }
    body.appendChild(rigRow);
  };
  UI.drawWheel = function (cv, odds, ang) {
    const x = cv.getContext('2d'); const r = cv.width / 2; x.clearRect(0, 0, cv.width, cv.height); let a0 = ang;
    odds.forEach((o, i) => { if (o <= 0) return; const a1 = a0 + o * Math.PI * 2; x.beginPath(); x.moveTo(r, r); x.arc(r, r, r - 6, a0, a1); x.closePath(); x.fillStyle = WHEEL_COL[i]; x.fill(); x.strokeStyle = '#1a1020'; x.lineWidth = 3; x.stroke(); a0 = a1; });
    x.beginPath(); x.arc(r, r, 18, 0, Math.PI * 2); x.fillStyle = '#1a1020'; x.fill(); x.fillStyle = '#ffd24a'; x.beginPath(); x.moveTo(r, 4); x.lineTo(r - 14, 34); x.lineTo(r + 14, 34); x.closePath(); x.fill();
  };
  UI.gres = function (ev) {
    if (ev.err) { $('cas-log').textContent = ev.err; return; }
    if (ev.g === 'buy') { $('cas-log').textContent = ev.msg; setTimeout(() => UI.casRender(), 60); G.Audio.play('chest'); return; }
    UI.casLast = ev; if (!UI.casOpen) { UI.casino(true); }
    const tab = ev.g; if (UI.casGame !== tab) { UI.casGame = tab; [...$('cas-tabs').children].forEach(x => x.classList.toggle('sel', x.dataset.g === tab)); }
    const done = () => { UI.casRender(); $('cas-coins').textContent = '⬤ ' + ev.coins; $('cas-log').textContent = ev.msg + (ev.win ? ' — +' + ev.win + ' coins' : '') + (ev.boon >= 0 ? ' — pick your boon!' : ''); if (ev.win > ev.bet) G.Audio.play('pw'); else if (ev.hex) G.Audio.play('hurt'); };
    if (ev.g === 'slots') { UI.casRender(); const rs = $('reels'); if (!rs) return done(); [...rs.children].forEach(r => r.classList.add('spin')); let n = 0; const iv = setInterval(() => { n++; [...rs.children].forEach((r, i) => { if (n > 6 + i * 4) { r.classList.remove('spin'); r.textContent = sym(ev.reels[i]); } else r.textContent = sym(G.SLOT_SYMBOLS[Math.floor(Math.random() * G.SLOT_SYMBOLS.length)].id); }); if (n > 15) { clearInterval(iv); done(); } }, 90); $('cas-log').textContent = 'Spinning…'; return; }
    if (ev.g === 'wheel') { UI.casRender(); const cv = $('wheelcv'); if (!cv) return done(); const odds = G.CASINO.wheel[Math.max(0, G.CASINO.wheelBets.indexOf(ev.bet))]; let start = 0; for (let i = 0; i < ev.seg; i++) start += odds[i]; const mid = start + odds[ev.seg] / 2; const target = -Math.PI / 2 - mid * Math.PI * 2 - Math.PI * 2 * 4; const from = UI.casWheelAng || 0; const t0 = performance.now(); const dur = 2200; $('cas-log').textContent = 'The wheel spins…';
      const step = () => { const k = Math.min(1, (performance.now() - t0) / dur); const e = 1 - Math.pow(1 - k, 3); UI.casWheelAng = from + (target - from) * e; const c = $('wheelcv'); if (c) UI.drawWheel(c, odds, UI.casWheelAng); if (k < 1) requestAnimationFrame(step); else done(); }; step(); return; }
    done();
  };
  // ---- tutorial: a checklist that follows the player's progress; hidden once every step was completed or the player closes it ----
  const keyName = (k) => { k = k || ''; if (k === ' ' || k === 'Space') return 'Space'; k = k.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl'); return k.length === 1 ? k.toUpperCase() : k; };
  const fillKeys = (txt) => txt.replace(/\{(\w+)\}/g, (m, k) => '<b>' + keyName((G.Input.binds || {})[k] || k) + '</b>');
  UI.tutStep = 0; UI.tutLast = '';
  UI.tutorial = function (V) {
    const box = $('tutorial'); const me = V && V.players[V.me]; const meta = UI.tutMeta || (UI.tutMeta = UI.loadMeta());
    if (!me || meta.tutorialOff || meta.tutorialDone) { box.classList.add('hidden'); return; }
    const T = G.TUTORIAL; while (UI.tutStep < T.length && T[UI.tutStep].done(V, me)) { UI.tutStep++; UI.tutLast = ''; if (UI.tutStep < T.length) UI.toast('Tutorial', 'Step done! Next: ' + T[UI.tutStep].txt.replace(/\{(\w+)\}/g, (m, k) => keyName((G.Input.binds || {})[k] || k)).slice(0, 90), '#80ffd0'); }
    if (UI.tutStep >= T.length) { meta.tutorialDone = true; UI.saveMeta(meta); UI.toast('Tutorial complete', 'You know everything you need. Good luck out there.', '#80ffd0'); box.classList.add('hidden'); return; }
    const key = UI.tutStep + ':' + JSON.stringify(G.Input.binds || {}); if (key === UI.tutLast) return; UI.tutLast = key; box.classList.remove('hidden');
    $('tut-body').innerHTML = T.map((t, i) => '<div class="tstep' + (i < UI.tutStep ? ' done' : i === UI.tutStep ? ' cur' : '') + '">' + (i < UI.tutStep ? '✓ ' : (i + 1) + '. ') + (i === UI.tutStep ? fillKeys(t.txt) : (i < UI.tutStep ? t.txt.split('.')[0] : '…')) + '</div>').join('');
  };
  UI.renderHowto = function () { const b = G.Input.binds || {}; $('howto-body').innerHTML = '<ol>' + G.TUTORIAL.map(t => '<li>' + fillKeys(t.txt) + '</li>').join('') + '</ol>' +
    '<h3>Controls</h3><div class="small">Look: mouse · Move: <b>' + [b.forward, b.left, b.back, b.right].map(keyName).join('') + '</b> · Sprint: <b>' + keyName(b.sprint) + '</b> · Jump: <b>' + keyName(b.jump) + '</b> · Dodge: <b>' + keyName(b.dodge) + '</b> · Attack: <b>LMB</b> (3-hit combos) · Heavy / draw bow / cast / block: <b>hold RMB</b> · Interact / revive: <b>' + keyName(b.interact) + '</b> · Eat: <b>' + keyName(b.eat) + '</b> · Inventory & crafting: <b>' + keyName(b.inventory) + '</b> · Hotbar: <b>1–9</b> · Chat: <b>Enter</b> · Ping: <b>' + keyName(b.ping) + '</b>. Rebind everything under Controls & settings.</div>' +
    '<h3>The loop</h3><div class="small">Days are for gathering and crafting, nights bring waves and — from night 2 — a night boss. Every level and chest offers a pick-of-3 <b>boon</b>. Three altar guardians drop the gems that repair the ship; sailing summons the Leviathan. Lose or win, you earn <b>Shards</b> for permanent Camp upgrades and hats.</div>' +
    '<h3>Multiplayer</h3><div class="small">One player hosts and shares the 5-letter room code; friends join from the lobby. Everything is shared: the island, the fire, the loot. Downed friends can be revived by holding <b>' + keyName(b.interact) + '</b> next to them.</div>' +
    '<h3>The Dealer\'s Table</h3><div class="small">Bet coins on slots, a dice duel, the Wheel of Fates or blackjack. Wins pay coins and <b>boons</b> (the same skills as chests), jackpots unlock <b>hats</b>, busts <b>hex</b> you. Sketchy items rig the next game in your favour.</div>'; };
  UI.showHostInfo = (code) => { $('hostinfo').classList.remove('hidden'); $('roomcode').textContent = code; };
  UI.setLobbyPlayers = (names) => { $('players').innerHTML = 'Players: ' + names.map(n => '<b style="color:' + n.col + '">' + esc(n.name) + '</b>').join(', '); };
  UI.enterGame = (seed) => { $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden'); $('seedlbl').textContent = 'seed ' + seed; };
  const esc = (s) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  function openChat() { UI.chatOpen = true; $('chatin').classList.remove('hidden'); G.Input.unlock(); UI.setResume(false); $('chatin').focus(); setTimeout(() => $('chatin').focus(), 30); G.Input.locked = true; }
  function closeChat() { UI.chatOpen = false; $('chatin').value = ''; $('chatin').classList.add('hidden'); $('chatin').blur(); G.Input.locked = false; if (G.Main.started) G.Input.lock(); }
  UI.chat = function (ev) {
    const log = $('chatlog'); const d = document.createElement('div');
    if (ev.sys) { d.className = 'sys'; d.textContent = '» ' + ev.msg; } else { d.innerHTML = '<b style="color:' + ev.col + '">' + esc(ev.from) + ':</b> ' + esc(ev.msg); }
    log.appendChild(d); while (log.children.length > 8) log.removeChild(log.firstChild);
    setTimeout(() => d.classList.add('old'), 9000);
  };
  let toastT = null;
  UI.toast = function (title, desc, col) { const t = $('toast'); t.innerHTML = '<div style="color:' + (col || '#ffd24a') + '">' + esc(title) + '</div><div class="d">' + esc(desc || '') + '</div>'; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => t.style.opacity = 0, 3000); };
  UI.confirm = function (html, onYes) { const c = $('confirm'); c.innerHTML = html + '<div class="row" style="justify-content:center"><button id="cy" class="primary">Set sail</button><button id="cn">Not yet</button></div>'; c.classList.remove('hidden'); $('cy').onclick = () => { c.classList.add('hidden'); onYes(); }; $('cn').onclick = () => c.classList.add('hidden'); };
  UI.end = function (win, V, shards) {
    const run = UI.recordRun(V, win, shards || 0); UI.showCamp(run); return;
    const e = $('end'); e.classList.remove('hidden'); e.querySelector('h1').textContent = win ? 'YOU ESCAPED THE ISLAND' : 'THE ISLAND KEEPS YOU';
    e.querySelector('h1').style.color = win ? '#ffd24a' : '#e03030';
    const me = V.players[V.me];
    e.querySelector('.stats').innerHTML = `<div>Days survived: <b>${V.day}</b></div><div>Time: <b>${G.fmtTime(V.elapsed || 0)}</b></div><div>Party kills: <b>${V.stats.kills}</b> · Chests opened: <b>${V.stats.chests}</b> · Deaths: <b>${V.stats.deaths}</b></div><div>Your kills: <b>${me ? me.kills : 0}</b> · Powerups: <b>${me ? Object.values(me.pw).reduce((a, b) => a + b, 0) : 0}</b></div><div>Seed: <b>${esc(V.world.seed)}</b> — type it in the lobby to replay this island.</div>`;
    $('hud').classList.add('hidden');
  };

  // ---------- slots ----------
  function mkSlot(i, hot) {
    const d = document.createElement('div'); d.className = 'slot'; d.dataset.i = i;
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; d.appendChild(c);
    const n = document.createElement('span'); n.className = 'n'; d.appendChild(n);
    if (hot) { const k = document.createElement('span'); k.className = 'k'; k.textContent = i + 1; d.appendChild(k); }
    if (!hot) {
      d.onclick = (e) => {
        const V = G.Main.view(); const me = V && V.players[V.me]; if (!me) return;
        if (e.shiftKey) { if (me.inv[i]) G.Main.act({ a: 'drop', slot: i }); return; }
        if (UI.drag === null) { if (me.inv[i]) { UI.drag = i; d.classList.add('drag'); } }
        else { G.Main.act({ a: 'move', from: UI.drag, to: i }); clearDrag(); }
      };
      d.oncontextmenu = (e) => { e.preventDefault(); clearDrag(); G.Main.act({ a: 'equip', slot: i }); };
      d.onmouseenter = () => { const V = G.Main.view(); const me = V && V.players[V.me]; if (me && me.inv[i]) tip(d, me.inv[i].id, me.inv[i]); };
      d.onmouseleave = hideTip;
    }
    return d;
  }
  function clearDrag() { UI.drag = null; document.querySelectorAll('.slot.drag').forEach(x => x.classList.remove('drag')); }
  function tip(el, id, inst) {
    const d = I[id]; if (!d) return; const t = $('tip'); let s = '<b style="color:' + (inst && (inst.aff || inst.q >= 3) ? G.RARITY_COL[inst.q || 0] : (d.unique ? G.RARITY_COL[3] : 'var(--acc)')) + '">' + (inst ? G.itemName(inst) : d.name) + '</b>';
    if (inst && inst.aff) for (const a of inst.aff) s += '<div style="color:' + G.AFFIX[a].col + '">' + G.AFFIX[a].name + ': ' + G.AFFIX[a].desc + '</div>';
    if (d.desc) s += '<div style="color:#ffd24a">' + d.desc + '</div>';
    if (d.type === 'weapon' || d.type === 'tool') s += '<div class="d">' + Math.round(d.dmg) + ' dmg · ' + d.spd + '/s · reach ' + d.reach + (d.tool ? ' · ' + d.tool + ' tier ' + d.tier : '') + '</div>';
    if (d.type === 'armor') s += '<div class="d">' + (d.def ? '+' + d.def + ' defense ' : '') + '(' + d.slot + ') — right-click to equip</div>';
    if (d.type === 'staff') s += '<div class="d">' + d.dmg + ' spell damage · hold RMB to charge, release to cast (' + d.cost + ' stamina)</div>';
    if (d.type === 'weapon' || d.type === 'tool') s += '<div class="d">hold RMB for a heavy attack · 3rd hit in a row is a combo finisher</div>';
    if (d.type === 'food') s += '<div class="d">+' + d.hunger + ' food, +' + d.hp + ' HP' + (d.buff ? ' · buff: ' + (d.buff.hp ? '+' + d.buff.hp + ' max HP ' : '') + (d.buff.stam ? '+' + d.buff.stam + ' stamina regen ' : '') + 'for ' + Math.round(d.buff.dur / 60) + ' min' : '') + ' — right-click or Q to eat</div>';
    if (d.type === 'bow') s += '<div class="d">' + d.dmg + ' dmg · hold RMB to draw, release to fire · needs arrows</div>';
    if (d.type === 'shield') s += '<div class="d">blocks ' + Math.round(d.block * 100) + '% · hold RMB · block in the first instant to PARRY</div>';
    if (d.type === 'place') s += '<div class="d">place with LMB' + (G.OBJS[d.obj].claim ? ' · light: monsters won\'t spawn nearby' : '') + (G.OBJS[d.obj].station ? ' · crafting station' : '') + (G.OBJS[d.obj].wall ? ' · ' + G.OBJS[d.obj].hp + ' HP' : '') + '</div>';
    if (d.type === 'key') s += '<div class="d">use at the ' + G.OBJS[d.altar].name + ' to summon its guardian</div>';
    if (d.type === 'gem') s += '<div class="d">a guardian\'s heart — bring it to the ship</div>';
    if (d.type === 'material') s += '<div class="d">crafting material</div>';
    t.innerHTML = s; t.classList.remove('hidden'); const r = el.getBoundingClientRect(); t.style.left = Math.min(window.innerWidth - 240, r.right + 6) + 'px'; t.style.top = r.top + 'px';
  }
  function hideTip() { $('tip').classList.add('hidden'); }
  function drawSlot(el, s) {
    const c = el.querySelector('canvas'), x = c.getContext('2d'); x.clearRect(0, 0, 16, 16);
    if (s) { x.drawImage(G.Sprites.item(s.id), 0, 0); }
    const n = el.querySelector('.n'); if (n) n.textContent = s && s.n > 1 ? s.n : '';
    el.classList.remove('q1', 'q2', 'q3'); if (s && (s.aff || s.q >= 3 || (I[s.id] && I[s.id].unique))) el.classList.add('q' + Math.max(1, s.q || 3));
  }
  UI.toggleInv = function (force) {
    UI.open = force === undefined ? !UI.open : force;
    $('inv').classList.toggle('hidden', !UI.open); clearDrag(); hideTip();
    if (UI.open) { UI.lastInv = ''; UI.refreshCraft(true); G.Input.unlock(); UI.setResume(false); }
    else if (G.Main.started) { G.Input.lock(); }
  };
  UI.setResume = function (show) { $('resume').classList.toggle('hidden', !show); UI.paused = show && G.Main.mode === 'host' && G.Net.count() === 0; $('resume-title').textContent = UI.paused ? 'Paused' : (G.Main.started ? 'Menu — the island keeps turning' : 'Click to play'); };
  UI.showSettings = function () { $('settings').classList.remove('hidden'); UI.renderBinds(); G.Input.unlock(); };
  UI.hideSettings = function () { $('settings').classList.add('hidden'); G.Input.capture = null; if (G.Main.started) UI.setResume(true); };
  UI.renderBinds = function () {
    const list = $('bindlist'); list.innerHTML = '';
    for (const a in G.Input.DEFAULT_BINDS) { const d = document.createElement('div'); d.className = 'bind'; const lbl = document.createElement('span'); lbl.textContent = G.Input.BIND_NAMES[a]; d.appendChild(lbl); const b = document.createElement('button'); b.textContent = G.Input.keyName(G.Input.binds[a]); b.onclick = () => { document.querySelectorAll('.bind button').forEach(x => x.classList.remove('listening')); b.classList.add('listening'); b.textContent = 'press a key…'; G.Input.capture = a; G.Input.onCaptured = () => UI.renderBinds(); }; d.appendChild(b); list.appendChild(d); }
  };
  UI.objective = function (V) {
    const gems = ['emerald', 'sapphire', 'ruby'].filter(g => V.boat[g] >= 1).length; const dead = Object.keys(V.bosses).filter(k => V.bosses[k] === 'dead').length;
    let txt;
    if (V.phase === 'siege') txt = 'Hold the dock!'; else if (V.phase === 'final') txt = 'Slay the Leviathan';
    else if (V.boat.done) txt = 'The ship is ready — set sail from the wreck when everyone is ready';
    else if (gems >= 3) txt = 'Bring 60 wood, 20 iron bars, 10 rope to the wreck (' + V.boat.wood + '/60 · ' + V.boat.iron_bar + '/20 · ' + V.boat.rope + '/10)';
    else txt = 'Guardian gems ' + gems + '/3 · bosses slain ' + dead + '/10' + (V.day === 1 ? ' · craft a workbench, torch and campfire before dark' : '');
    return txt;
  };

  // ---------- HUD refresh ----------
  UI.update = function (V, hint) {
    const me = V.players[V.me]; if (!me) return;
    const set = (id, v, max, txt) => { const b = $(id); b.firstElementChild.style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; b.lastElementChild.textContent = txt; };
    set('hpbar', me.hp, me.maxHp, 'HP ' + Math.ceil(me.hp) + '/' + me.maxHp + (me.swCd > 0 ? ' · second wind ' + me.swCd + 's' : ''));
    set('stbar', me.stam, 100, 'Stamina');
    set('fdbar', me.hunger, 100, me.hunger < 25 ? 'Food — STARVING' : 'Food');
    $('coins').textContent = '⬤ ' + me.coins + ' coins';
    $('dodges').textContent = 'Dodge ' + '◆'.repeat(me.dodgeCh) + '◇'.repeat(Math.max(0, (1 + (me.pw.feather || 0)) - me.dodgeCh)) + (me.charge > 0 ? ' · HEAVY ' + Math.round(me.charge * 100) + '%' : '');
    const xpNext = me.xpNext || G.XP_FOR(me.lvl || 1); set('xpbar', me.xp, xpNext, 'Lv ' + me.lvl + ' · ' + Math.round(me.xp) + '/' + xpNext + ' xp');
    UI.boon(me);
    const pwKey = JSON.stringify(me.pw);
    if (pwKey !== UI.lastPw) { UI.lastPw = pwKey; const w = $('pws'); w.innerHTML = ''; for (const k in me.pw) { const d = document.createElement('div'); d.className = 'pwicon'; d.title = G.PW[k].name + ': ' + G.PW[k].desc; const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(G.Sprites.powerup(k), 0, 0); d.appendChild(c); const s = document.createElement('span'); s.textContent = me.pw[k] > 1 ? me.pw[k] : ''; d.appendChild(s); w.appendChild(d); } }
    $('buffs').textContent = me.buffs.map(b => (I[b.id] ? I[b.id].name : b.id === 'hex' ? 'HEXED −15% dmg' : b.id) + ' ' + G.fmtTime(b.t)).join(' · ');
    if (UI.casOpen && UI.casAt && G.dist(me.x, me.y, UI.casAt.x, UI.casAt.y) > 4) UI.casino(false);
    // clock
    const t = V.time; const phase = t < G.DUSK_AT ? 'Day' : t < G.NIGHT_AT ? 'Dusk' : 'Night';
    $('clock').querySelector('.day').textContent = 'Day ' + V.day + ' — ' + phase;
    const rem = t < G.DUSK_AT ? G.DUSK_AT - t : t < G.NIGHT_AT ? G.NIGHT_AT - t : G.DAY_LEN - t;
    let ct = (phase === 'Night' ? 'dawn in ' : phase === 'Dusk' ? 'night in ' : 'dusk in ') + G.fmtTime(rem) + ' · difficulty ' + V.diff.toFixed(1) + 'x';
    if (V.phase === 'siege') ct = '<span class="siege">HOLD THE DOCK — ' + V.siegeT + 's</span>'; if (V.phase === 'final') ct = '<span class="siege">KILL THE LEVIATHAN</span>';
    $('clock').querySelector('.time').innerHTML = ct; $('objective').textContent = UI.objective(V);
    // hotbar & inventory
    const invKey = JSON.stringify(me.inv) + me.held + JSON.stringify(me.armor);
    if (invKey !== UI.lastInv) {
      UI.lastInv = invKey;
      const hb = $('hotbar').children; for (let i = 0; i < 9; i++) { drawSlot(hb[i], me.inv[i]); hb[i].classList.toggle('sel', i === me.held); }
      if (UI.open) { const g = $('invgrid').children; for (let i = 0; i < 27; i++) { drawSlot(g[i], me.inv[i]); g[i].classList.toggle('sel', i === me.held); } const a = $('armor').children; ['head', 'chest', 'legs', 'trinket'].forEach((s, i) => drawSlot(a[i], me.armor[s] ? { id: me.armor[s], n: 1 } : null)); UI.refreshCraft(); const st = G.Sim.stats(me); $('invstats').textContent = 'Defense ' + st.def + ' · Attack x' + st.atk.toFixed(2) + ' · Speed x' + (st.speed / 4.4).toFixed(2) + ' · Crit ' + Math.round(st.crit * 100) + '%'; }
    } else if (UI.open) { UI.craftT = (UI.craftT || 0) + 1; if (UI.craftT % 30 === 0) UI.refreshCraft(); }
    $('hint').textContent = hint || ''; $('hint').style.display = hint ? '' : 'none';
    $('netlbl').textContent = V.netlbl || '';
  };
  UI.refreshCraft = function (rebuild) {
    const V = G.Main.view(); const me = V && V.players[V.me]; if (!me) return;
    const list = $('craftlist');
    const S = G.Main.simForUI();
    if (rebuild || !list.children.length) {
      list.innerHTML = '';
      G.RECIPES.forEach((r, ri) => {
        const d = document.createElement('div'); d.className = 'recipe'; d.dataset.r = ri;
        const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(G.Sprites.item(r.out), 0, 0); d.appendChild(c);
        const nm = document.createElement('span'); nm.textContent = I[r.out].name + (r.n > 1 ? ' ×' + r.n : ''); d.appendChild(nm);
        const nd = document.createElement('span'); nd.className = 'needs'; nd.innerHTML = Object.keys(r.needs).map(k => '<span data-k="' + k + '">' + r.needs[k] + ' ' + I[k].name + '</span>').join(', ') + (r.station ? '<div class="st">@ ' + G.OBJS[r.station].name + '</div>' : ''); d.appendChild(nd);
        d.onclick = () => G.Main.act({ a: 'craft', r: ri }); d.onmouseenter = () => tip(d, r.out); d.onmouseleave = hideTip;
        list.appendChild(d);
      });
    }
    [...list.children].forEach(d => { const r = G.RECIPES[+d.dataset.r]; const ok = G.Sim.canCraft(S, me, r); d.classList.toggle('no', !ok); d.querySelectorAll('[data-k]').forEach(sp => { const k = sp.dataset.k; sp.style.color = G.Sim.count(me, k) >= r.needs[k] ? '' : '#ff8080'; }); });
  };
})(window.G);
