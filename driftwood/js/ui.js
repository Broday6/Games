// DRIFTWOOD — DOM UI: lobby, HUD, inventory, crafting, chat, end screen
(function (G) {
  'use strict';
  const UI = { open: false, drag: null, color: G.PLAYER_COLORS[0], lastInv: '', lastPw: '', chatOpen: false };
  G.UI = UI;
  const $ = (id) => document.getElementById(id);
  const I = G.ITEMS;

  UI.init = function () {
    // swatches
    const sw = $('swatches');
    G.PLAYER_COLORS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'swatch' + (i === 0 ? ' sel' : ''); d.style.background = c; d.onclick = () => { UI.color = c; [...sw.children].forEach(x => x.classList.remove('sel')); d.classList.add('sel'); }; sw.appendChild(d); });
    try { const saved = JSON.parse(localStorage.getItem('driftwood') || '{}'); if (saved.name) $('name').value = saved.name; if (saved.color) { UI.color = saved.color; [...sw.children].forEach((x, i) => x.classList.toggle('sel', G.PLAYER_COLORS[i] === saved.color)); } } catch (e) { }
    // tabs
    const tabs = { host: $('tab-host'), join: $('tab-join'), solo: $('tab-solo') };
    for (const k in tabs) tabs[k].onclick = () => { for (const j in tabs) { tabs[j].classList.toggle('sel', j === k); $('pane-' + j).classList.toggle('hidden', j !== k); } $('manual-host').classList.toggle('hidden', k === 'join'); $('manual-client').classList.toggle('hidden', k !== 'join'); };
    $('manual-client').classList.add('hidden');
    $('randseed').onclick = () => $('seed').value = Math.random().toString(36).slice(2, 8).toUpperCase();
    const name = () => { const n = $('name').value.trim() || 'Castaway'; try { localStorage.setItem('driftwood', JSON.stringify({ name: n, color: UI.color })); } catch (e) { } return n; };
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
    const arm = $('armor'); ['head', 'chest', 'legs'].forEach(s => { const d = document.createElement('div'); d.className = 'slot'; d.dataset.l = s; d.dataset.armor = s; const c = document.createElement('canvas'); c.width = 16; c.height = 16; d.appendChild(c); d.oncontextmenu = (e) => { e.preventDefault(); G.Main.act({ a: 'unequip', slot: s }); }; d.onclick = () => G.Main.act({ a: 'unequip', slot: s }); d.onmouseenter = () => { const V = G.Main.view(); const me = V && V.players[V.me]; if (me && me.armor[s]) tip(d, me.armor[s]); }; d.onmouseleave = hideTip; arm.appendChild(d); });
    // chat
    $('chatin').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = $('chatin').value.trim(); if (v) G.Main.act({ a: 'chat', msg: v }); closeChat(); e.preventDefault(); } else if (e.key === 'Escape') { closeChat(); } e.stopPropagation(); });
    G.Input.onKey = (k, e) => {
      if (UI.chatOpen) return false;
      if (k === 'Enter') { openChat(); return true; }
      if (k === 'Tab' || k === 'i') { UI.toggleInv(); return true; }
      if (k === 'Escape') { if (UI.open) { UI.toggleInv(false); return true; } if (!$('confirm').classList.contains('hidden')) { $('confirm').classList.add('hidden'); return true; } }
      if (k === 'm') { const m = G.Audio.toggleMute(); UI.toast(m ? 'Muted' : 'Sound on', ''); return true; }
      return false;
    };
    G.Net.onStatus = UI.status;
  };
  UI.status = (s) => { $('status').textContent = s || ''; };
  UI.showHostInfo = (code) => { $('hostinfo').classList.remove('hidden'); $('roomcode').textContent = code; };
  UI.setLobbyPlayers = (names) => { $('players').innerHTML = 'Players: ' + names.map(n => '<b style="color:' + n.col + '">' + esc(n.name) + '</b>').join(', '); };
  UI.enterGame = (seed) => { $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden'); $('seedlbl').textContent = 'seed ' + seed; };
  const esc = (s) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  function openChat() { UI.chatOpen = true; $('chatin').classList.remove('hidden'); $('chatin').focus(); G.Input.locked = true; }
  function closeChat() { UI.chatOpen = false; $('chatin').value = ''; $('chatin').classList.add('hidden'); $('chatin').blur(); G.Input.locked = false; }
  UI.chat = function (ev) {
    const log = $('chatlog'); const d = document.createElement('div');
    if (ev.sys) { d.className = 'sys'; d.textContent = '» ' + ev.msg; } else { d.innerHTML = '<b style="color:' + ev.col + '">' + esc(ev.from) + ':</b> ' + esc(ev.msg); }
    log.appendChild(d); while (log.children.length > 8) log.removeChild(log.firstChild);
    setTimeout(() => d.classList.add('old'), 9000);
  };
  let toastT = null;
  UI.toast = function (title, desc, col) { const t = $('toast'); t.innerHTML = '<div style="color:' + (col || '#ffd24a') + '">' + esc(title) + '</div><div class="d">' + esc(desc || '') + '</div>'; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => t.style.opacity = 0, 3000); };
  UI.confirm = function (html, onYes) { const c = $('confirm'); c.innerHTML = html + '<div class="row" style="justify-content:center"><button id="cy" class="primary">Set sail</button><button id="cn">Not yet</button></div>'; c.classList.remove('hidden'); $('cy').onclick = () => { c.classList.add('hidden'); onYes(); }; $('cn').onclick = () => c.classList.add('hidden'); };
  UI.end = function (win, V) {
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
      d.onmouseenter = () => { const V = G.Main.view(); const me = V && V.players[V.me]; if (me && me.inv[i]) tip(d, me.inv[i].id); };
      d.onmouseleave = hideTip;
    }
    return d;
  }
  function clearDrag() { UI.drag = null; document.querySelectorAll('.slot.drag').forEach(x => x.classList.remove('drag')); }
  function tip(el, id) {
    const d = I[id]; if (!d) return; const t = $('tip'); let s = '<b>' + d.name + '</b>';
    if (d.type === 'weapon' || d.type === 'tool') s += '<div class="d">' + Math.round(d.dmg) + ' dmg · ' + d.spd + '/s · reach ' + d.reach + (d.tool ? ' · ' + d.tool + ' tier ' + d.tier : '') + '</div>';
    if (d.type === 'armor') s += '<div class="d">+' + d.def + ' defense (' + d.slot + ') — right-click to equip</div>';
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
  }
  UI.toggleInv = function (force) {
    UI.open = force === undefined ? !UI.open : force;
    $('inv').classList.toggle('hidden', !UI.open); clearDrag(); hideTip();
    if (UI.open) { UI.lastInv = ''; UI.refreshCraft(true); }
  };

  // ---------- HUD refresh ----------
  UI.update = function (V, hint) {
    const me = V.players[V.me]; if (!me) return;
    const set = (id, v, max, txt) => { const b = $(id); b.firstElementChild.style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; b.lastElementChild.textContent = txt; };
    set('hpbar', me.hp, me.maxHp, 'HP ' + Math.ceil(me.hp) + '/' + me.maxHp + (me.swCd > 0 ? ' · second wind ' + me.swCd + 's' : ''));
    set('stbar', me.stam, 100, 'Stamina');
    set('fdbar', me.hunger, 100, me.hunger < 25 ? 'Food — STARVING' : 'Food');
    $('coins').textContent = '⬤ ' + me.coins + ' coins';
    $('dodges').textContent = 'Dodge ' + '◆'.repeat(me.dodgeCh) + '◇'.repeat(Math.max(0, (1 + (me.pw.feather || 0)) - me.dodgeCh));
    const pwKey = JSON.stringify(me.pw);
    if (pwKey !== UI.lastPw) { UI.lastPw = pwKey; const w = $('pws'); w.innerHTML = ''; for (const k in me.pw) { const d = document.createElement('div'); d.className = 'pwicon'; d.title = G.PW[k].name + ': ' + G.PW[k].desc; const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(G.Sprites.powerup(k), 0, 0); d.appendChild(c); const s = document.createElement('span'); s.textContent = me.pw[k] > 1 ? me.pw[k] : ''; d.appendChild(s); w.appendChild(d); } }
    $('buffs').textContent = me.buffs.map(b => I[b.id].name + ' ' + G.fmtTime(b.t)).join(' · ');
    // clock
    const t = V.time; const phase = t < G.DUSK_AT ? 'Day' : t < G.NIGHT_AT ? 'Dusk' : 'Night';
    $('clock').querySelector('.day').textContent = 'Day ' + V.day + ' — ' + phase;
    const rem = t < G.DUSK_AT ? G.DUSK_AT - t : t < G.NIGHT_AT ? G.NIGHT_AT - t : G.DAY_LEN - t;
    let ct = (phase === 'Night' ? 'dawn in ' : phase === 'Dusk' ? 'night in ' : 'dusk in ') + G.fmtTime(rem) + ' · difficulty ' + V.diff.toFixed(1) + 'x';
    if (V.phase === 'siege') ct = '<span class="siege">HOLD THE DOCK — ' + V.siegeT + 's</span>'; if (V.phase === 'final') ct = '<span class="siege">KILL THE LEVIATHAN</span>';
    $('clock').querySelector('.time').innerHTML = ct;
    // hotbar & inventory
    const invKey = JSON.stringify(me.inv) + me.held + JSON.stringify(me.armor);
    if (invKey !== UI.lastInv) {
      UI.lastInv = invKey;
      const hb = $('hotbar').children; for (let i = 0; i < 9; i++) { drawSlot(hb[i], me.inv[i]); hb[i].classList.toggle('sel', i === me.held); }
      if (UI.open) { const g = $('invgrid').children; for (let i = 0; i < 27; i++) { drawSlot(g[i], me.inv[i]); g[i].classList.toggle('sel', i === me.held); } const a = $('armor').children; ['head', 'chest', 'legs'].forEach((s, i) => drawSlot(a[i], me.armor[s] ? { id: me.armor[s], n: 1 } : null)); UI.refreshCraft(); const st = G.Sim.stats(me); $('invstats').textContent = 'Defense ' + st.def + ' · Attack x' + st.atk.toFixed(2) + ' · Speed x' + (st.speed / 4.4).toFixed(2) + ' · Crit ' + Math.round(st.crit * 100) + '%'; }
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
