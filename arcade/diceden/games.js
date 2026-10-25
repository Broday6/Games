// DICE DEN — game controllers: Liar's Dice, Farkle, Ship Captain & Crew.
(function () {
  'use strict';
  const DD = window.DD;
  const { R, Dice, Au, $, $$, esc, ICON, COLORS } = DD;
  const fi = (v, size, t) => `<img src="${Dice.faceIcon(v, size || 44, t)}" alt="${v}">`;
  const rnd = Math.random;

  // ---------------- bid wheel ----------------
  class Wheel {
    constructor(items, value, onChange, caption) {
      this.items = items; this.onChange = onChange;
      this.idx = Math.max(0, items.findIndex((it) => it.v === value));
      this.pos = this.idx;
      const el = this.el = document.createElement('div');
      el.className = 'wheel';
      el.setAttribute('aria-label', caption);
      el.innerHTML = `<button class="arrow up" aria-label="Up">${ICON.up}</button><div class="track"></div><button class="arrow dn" aria-label="Down">${ICON.down}</button>`;
            this.track = $('.track', el);
      this.track.innerHTML = items.map((it, i) => `<div class="it" data-i="${i}">${it.html}</div>`).join('');
      this.nodes = $$('.it', this.track);
      $('.up', el).onclick = (e) => { e.stopPropagation(); this.step(1); };
      $('.dn', el).onclick = (e) => { e.stopPropagation(); this.step(-1); };
      el.addEventListener('wheel', (e) => { e.preventDefault(); this.step(e.deltaY < 0 ? 1 : -1); }, { passive: false });
      let sy = 0, sp = 0, moved = 0, down = false;
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.arrow')) return;
        down = true; sy = e.clientY; sp = this.pos; moved = 0;
        try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      });
      el.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dy = e.clientY - sy; moved = Math.max(moved, Math.abs(dy));
        this.pos = Math.max(0, Math.min(items.length - 1, sp + dy / 44));
        this.layout();
      });
      const up = (e) => {
        if (!down) return; down = false;
        if (moved < 6) {
          const r = el.getBoundingClientRect();
          const d = Math.round((r.top + r.height / 2 - e.clientY) / 44);
          this.set(this.idx + d, true);
        } else this.set(Math.round(this.pos), true);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      this.layout();
    }
    get value() { return this.items[this.idx].v; }
    step(d) { this.set(this.idx + d, true); }
    set(i, user) {
      i = Math.max(0, Math.min(this.items.length - 1, i));
      const changed = i !== this.idx;
      this.idx = i; this.pos = i; this.layout();
      if (changed) { Au.S.tick(i % 12); DD.buzz(6); }
      if (user && this.onChange) this.onChange(this.value);
    }
    setValue(v) { const i = this.items.findIndex((it) => it.v === v); if (i >= 0) { this.idx = i; this.pos = i; this.layout(); } }
    mark(bad) { this.nodes.forEach((n, i) => n.classList.toggle('bad', !!bad(this.items[i].v))); }
    layout() {
      this.nodes.forEach((n, i) => {
        const d = this.pos - i;
        const ad = Math.abs(d);
        n.style.transform = `translateY(${d * 44}px) scale(${Math.max(0.55, 1 - ad * 0.3)})`;
        n.style.opacity = ad > 2.2 ? 0 : Math.max(0, 1 - ad * 0.42);
      });
    }
  }

  function potHTML(n) {
    const k = Math.max(1, Math.min(5, Math.ceil(n / 50)));
    return `<div class="stack">${Array.from({ length: k }, (_, i) => `<i style="bottom:${i * 3}px"></i>`).join('')}</div><b>${n}</b>`;
  }

  // ---------------- base ----------------
  class Base {
    constructor(g, fresh) {
      this.g = g; this.s = g.state; this.alive = true; this.gen = 0; this.fresh = fresh;
      this.act = {
        gmenu: () => this.menu(),
      };
    }
    destroy() { this.alive = false; DD.Shake.handler = null; $('#handoff').classList.add('hidden'); }
    save() { DD.persist(); }
    sleep(ms) { return DD.wait(this.ff ? ms * 0.12 : ms).then(() => this.alive); }
    topbar(title) {
      return `<div class="gtop"><button class="btn icon-btn" data-act="gmenu" aria-label="Menu">${ICON.menu}</button>
        <div class="gtitle"><b>${esc(title)}</b><span id="g-sub"></span></div>
        <div class="pot" id="g-pot" title="Pot">${potHTML(this.g.pot)}</div>
        ${DD.muteBtn()}</div>`;
    }
    sub(t) { const e = $('#g-sub'); if (e) e.textContent = t; }
    menu() {
      const m = DD.openModal(`<h2>Paused</h2><p class="muted">${esc(DD.GAMES[this.g.kind].name)} · pot <span class="chipcount">${this.g.pot}</span></p>
        <div style="display:grid;gap:10px">
          <button class="btn gold block" data-act="closem">Back to the game</button>
          <button class="btn block" data-act="rules" data-game="${this.g.kind}">${ICON.book} Rules</button>
          <button class="btn block" id="pm-lobby">Lobby (game stays saved)</button>
          <button class="btn pink block" id="pm-quit">Leave table — refund antes</button>
        </div>`);
      $('#pm-lobby', m).onclick = () => { DD.closeModal(); DD.show('lobby'); };
      $('#pm-quit', m).onclick = () => { DD.closeModal(); DD.quitGame(); };
    }
    begin(seatSel) {
      this.busy = !!(this.fresh && this.g.stake);
      this.render();
      this.antes(seatSel).then(() => { this.busy = false; if (this.alive) this.tick(); });
    }
    async antes(seatSel) {
      if (!this.fresh || !this.g.stake) return;
      const pot = $('#g-pot');
      const seats = $$(seatSel);
      for (const el of seats) { DD.flyChips(el, pot, 3); await DD.wait(90); }
      await DD.wait(600);
      if (pot) { pot.classList.remove('bump'); void pot.offsetWidth; pot.classList.add('bump'); }
    }
    async payout(winnerEls) {
      const pot = $('#g-pot');
      if (this.g.pot && pot) {
        for (const el of winnerEls) DD.flyChips(pot, el, 8);
        await DD.wait(900);
      }
    }
    dieSize(maxW, n, cap) { return Math.floor(Math.min(cap, maxW / n)); }
  }

  // =====================================================================
  // LIAR'S DICE
  // =====================================================================
  class LiarsGame extends Base {
    constructor(g, fresh) {
      super(g, fresh);
      const s = this.s;
      this.humans = s.players.map((p, i) => (p.type === 'human' ? i : -1)).filter((i) => i >= 0);
      this.solo = this.humans.length === 1;
      g.ui = g.ui || {};
      g.ui.outs = g.ui.outs || [];
      this.viewer = this.solo ? this.humans[0] : null; // multi-human: always re-ask after reload
      this.dice = [];
      Object.assign(this.act, {
        ldbid: () => this.humanBid(),
        ldliar: () => this.humanCall('liar'),
        ldspot: () => this.humanCall('spot'),
        ldroll: () => this.rollMine(),
        ldnext: () => this.nextRound(),
        ldff: () => { this.ff = true; this.renderControls(); if (this.s.phase === 'reveal' && $('#rv-next') && !$('#rv-next').classList.contains('invisible')) this.nextRound(); },
      });
    }
    mount(root) {
      root.innerHTML = `<div class="gshell felt">${this.topbar("Liar's Dice")}
        <div class="ld-seats" id="ld-seats"></div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;position:relative" id="ld-main">
          <div class="ld-center"><div id="ld-bid" style="text-align:center"></div><div class="ld-log" id="ld-log"></div><div class="hint" id="ld-hint"></div></div>
          <div class="ld-me"><div class="lbl" id="ld-melbl"></div><div class="mydice" id="ld-mydice"></div></div>
          <div class="ld-controls" id="ld-ctrl"></div>
        </div></div>`;
      this.begin('.seat');
    }
    relayout() { this.renderMine(true); }
    total() { return R.Liars.totalDice(this.s); }
    render() {
      this.renderSeats(); this.renderBid(); this.renderMine(); this.renderControls();
      this.sub(`Round ${this.s.round} · ${this.total()} dice${this.s.wild ? ' · 1s wild' : ''}`);
    }
    renderSeats() {
      const s = this.s, el = $('#ld-seats'); if (!el) return;
      const lastBy = {};
      s.history.forEach((h) => { lastBy[h.by] = h; });
      const n = s.players.length;
      el.style.gridTemplateColumns = `repeat(${n <= 3 ? n : n === 4 ? 2 : 3}, minmax(0, 1fr))`;
      el.classList.toggle('tight', n > 4);
      el.innerHTML = s.players.map((p, i) => {
        const pr = DD.P(p.id) || {};
        const h = lastBy[i];
        const thinking = s.phase === 'bidding' && s.turn === i && p.type === 'bot';
        return `<div class="seat ${s.phase === 'bidding' && s.turn === i ? 'turn' : ''} ${p.out ? 'out' : ''}" data-seat="${i}">
          ${thinking ? '<div class="think"><i></i><i></i><i></i></div>' : ''}
          <div class="nm"><span class="dot" style="background:${COLORS[pr.theme] || '#fff'}"></span><span class="nmt">${esc(p.name)}</span><span class="tag ${p.out || i === this.viewer ? 'key' : ''}">${p.out ? 'out' : i === this.viewer ? 'you' : p.type === 'bot' ? R.PERSONALITIES[p.personality].label : ''}</span></div>
          <div class="srow"><div class="cnt">${Array.from({ length: 5 }, (_, k) => `<i class="${k < p.count ? '' : 'gone'}"></i>`).join('')}</div>
          <div class="said">${h ? `${h.q}×${fi(h.f, 32)}` : ''}</div></div></div>`;
      }).join('');
    }
    renderBid(pop) {
      const s = this.s, el = $('#ld-bid'); if (!el) return;
      if (s.bid) {
        el.innerHTML = `<div class="bidbig ${pop ? 'pop' : ''}">${s.bid.q} <span style="font-size:.6em;opacity:.8">×</span> ${fi(s.bid.f, 104)}</div><div class="bidby">${esc(s.players[s.bid.by].name)} bids ${s.bid.q} ${faceName(s.bid.f, s.bid.q)}</div>`;
      } else {
        el.innerHTML = `<div class="bidbig" style="font-size:26px">Round ${s.round}</div><div class="bidby">${esc(s.players[s.turn].name)} opens the bidding</div>`;
      }
      const log = $('#ld-log');
      log.innerHTML = s.history.slice(-7, -1).map((h) => `<span>${esc(s.players[h.by].name)} ${h.q}×${fi(h.f, 28)}</span>`).join('');
    }
    renderMine(force) {
      const s = this.s, wrap = $('#ld-mydice'), lbl = $('#ld-melbl'); if (!wrap) return;
      const v = this.viewer;
      if (v == null || s.players[v].out) {
        lbl.textContent = v != null ? `${s.players[v].name} is out — watching` : '';
        wrap.innerHTML = this.solo || v != null ? '' : '<div class="hint" style="align-self:center">Cups are down. Pass the phone when asked.</div>';
        this.dice = []; return;
      }
      const p = s.players[v];
      const prof = DD.P(p.id) || {};
      lbl.innerHTML = `${esc(p.name)}’s cup · ${p.count} ${p.count === 1 ? 'die' : 'dice'}`;
      const W = Math.min(wrap.clientWidth || 360, 520);
      const size = this.dieSize(W, 5.1, 76);
      if (!s.seen[v]) {
        wrap.innerHTML = `<div style="height:${size}px;display:flex;align-items:center;justify-content:center;gap:12px"><div class="cup" style="width:${size * 0.8}px;height:${size * 0.8}px;border-radius:14px 14px 22px 22px;background:linear-gradient(180deg,#7b3cff,#3b157a);box-shadow:0 0 20px rgba(123,60,255,.6)"></div>
          <span class="muted" style="color:#d8fff8">Shake your cup to see your dice</span></div>`;
        this.dice = []; return;
      }
      if (!force && this.dice.length === p.dice.length && this.dice.every((d, i) => d.value === p.dice[i])) return;
      wrap.innerHTML = '';
      this.dice = p.dice.map((val) => { const d = new Dice.Die(size, prof.theme); d.set(val); wrap.appendChild(d.el); return d; });
    }
    myTurn() { const s = this.s; return s.phase === 'bidding' && s.turn === this.viewer && s.players[s.turn].type === 'human'; }
    renderControls() {
      const s = this.s, el = $('#ld-ctrl'); if (!el) return;
      DD.Shake.handler = null;
      const v = this.viewer;
      const hint = $('#ld-hint'); if (hint) hint.textContent = '';
      if (s.phase !== 'bidding') { el.innerHTML = ''; return; }
      if (this.busy) { el.innerHTML = '<div class="wait"><div style="font-size:18px;font-weight:800">Antes in…</div></div>'; return; }
      if (v != null && !s.players[v].out && !s.seen[v]) {
        el.innerHTML = `<div class="wait"><button class="btn gold" style="min-width:220px;min-height:64px;font-size:22px" data-act="ldroll">Roll my dice</button>
          <div class="muted" style="color:#d8fff8">${DD.db.settings.shake ? 'or shake the phone' : 'Only you should look!'}</div></div>`;
        DD.Shake.handler = () => this.rollMine();
        return;
      }
      if (!this.myTurn()) {
        const cur = s.players[s.turn];
        const noHumans = !s.players.some((p) => p.type === 'human' && !p.out);
        el.innerHTML = `<div class="wait"><div style="font-size:18px;font-weight:800">${esc(cur.name)} is ${cur.type === 'bot' ? 'thinking' : 'up'}…</div><div class="muted" style="color:#bfe">${this.total()} dice on the table</div>
          ${noHumans && !this.ff ? '<button class="btn small" data-act="ldff">Fast-forward the bots</button>' : ''}</div>`;
        return;
      }
      const total = this.total();
      const prev = s.bid;
      const me = s.players[v];
      // default: the cheapest raise on the current face (or our best face when opening)
      let f = prev ? prev.f : bestFace(me.dice, s.wild);
      let q = R.Liars.minQty(prev, f, total, s.wild);
      if (!prev) {
        const mine = me.dice.filter((x) => R.Liars.matches(x, f, s.wild)).length;
        q = Math.max(1, Math.min(total, Math.floor(mine + (total - me.dice.length) * R.Liars.faceP(f, s.wild) * 0.7)));
      }
      if (q == null) {
        const lb = R.Liars.legalBids(prev, total, s.wild, 0)[0];
        if (lb) { f = lb.f; q = lb.q; }
      }
      const canRaise = R.Liars.legalBids(prev, total, s.wild, 0).length > 0;
      el.innerHTML = `<div class="wheels" id="ld-wheels"></div>
        <div class="callrow"><button class="btn pink" data-act="ldliar" ${prev ? '' : 'disabled'}>Liar!</button><button class="btn cyan" data-act="ldspot" ${prev ? '' : 'disabled'}>Spot on</button></div>`;
      const wh = $('#ld-wheels', el);
      const qItems = Array.from({ length: total }, (_, i) => ({ v: i + 1, html: String(i + 1) }));
      const fItems = [1, 2, 3, 4, 5, 6].map((x) => ({ v: x, html: fi(x, 68) }));
      const upd = () => {
        const b = { q: this.wq.value, f: this.wf.value };
        const ok = R.Liars.isValidBid(prev, b, total, s.wild);
        this.wq.mark((qq) => !R.Liars.isValidBid(prev, { q: qq, f: b.f }, total, s.wild));
        this.wf.mark((ff) => !R.Liars.isValidBid(prev, { q: b.q, f: ff }, total, s.wild));
        const btn = $('#ld-bidbtn');
        btn.disabled = !ok;
        btn.innerHTML = ok ? `Bid<small>${b.q} × ${faceName(b.f, b.q)}</small>` : `Bid<small>${canRaise ? 'raise it higher' : 'no raise left'}</small>`;
      };
      this.wq = new Wheel(qItems, q || 1, upd, 'How many');
      this.wf = new Wheel(fItems, f, upd, 'Face');
      wh.appendChild(this.wq.el);
      const x = document.createElement('div'); x.className = 'times'; x.textContent = '×'; wh.appendChild(x);
      wh.appendChild(this.wf.el);
      const bb = document.createElement('button'); bb.className = 'btn gold bidbtn'; bb.id = 'ld-bidbtn'; bb.dataset.act = 'ldbid'; wh.appendChild(bb);
      upd();
      $('#ld-hint').textContent = prev ? 'Raise the bid, or call it.' : 'Open the bidding.';
    }
    async rollMine() {
      const s = this.s, v = this.viewer;
      if (v == null || s.seen[v] || this.rolling) return;
      this.rolling = true;
      DD.Shake.handler = null;
      s.seen[v] = true; this.save();
      const p = s.players[v], prof = DD.P(p.id) || {};
      const wrap = $('#ld-mydice');
      const size = this.dieSize(Math.min(wrap.clientWidth || 360, 520), 5.1, 76);
      wrap.innerHTML = '';
      Au.S.rattle(0.7); DD.buzz([20, 30, 20, 30, 40]);
      this.dice = p.dice.map((val) => { const d = new Dice.Die(size, prof.theme); wrap.appendChild(d.el); return d; });
      $('#ld-ctrl').innerHTML = '<div class="wait"></div>';
      await Promise.all(this.dice.map((d, i) => d.roll(p.dice[i], { delay: i * 60 })));
      this.rolling = false;
      if (!this.alive) return;
      $('#ld-melbl').innerHTML = `${esc(p.name)}’s cup · ${p.count} ${p.count === 1 ? 'die' : 'dice'}`;
      this.renderControls(); this.renderSeats();
      this.tick();
    }
    // The main driver: figure out who acts next.
    tick() {
      if (!this.alive) return;
      const s = this.s;
      const my = ++this.gen;
      if (s.phase === 'reveal') { this.showReveal(); return; }
      if (s.phase === 'over') { this.finish(); return; }
      const cur = s.players[s.turn];
      if (cur.type === 'bot') {
        if (this.solo && !s.seen[this.viewer] && !s.players[this.viewer].out) { this.render(); return; } // wait for the human to look
        this.render();
        this.botTurn(my);
        return;
      }
      if (this.viewer !== s.turn) { this.handoff(s.turn); return; }
      this.render();
    }
    handoff(i) {
      const s = this.s, p = s.players[i];
      const ho = $('#handoff');
      this.viewer = null; this.render();
      ho.innerHTML = `<div class="cup"></div><div class="muted">Liar’s Dice · round ${s.round}</div><div class="big">Hand the phone to<br>${esc(p.name)}</div>
        <div class="muted" style="max-width:300px">Everyone else, eyes off the screen.</div>
        <button class="btn gold" style="min-width:240px;min-height:60px;font-size:20px" id="ho-go">I’m ${esc(p.name)} — show my dice</button>`;
      ho.classList.remove('hidden');
      $('#ho-go').onclick = () => {
        ho.classList.add('hidden'); ho.innerHTML = '';
        this.viewer = i; Au.S.tap();
        this.render();
        this.tick();
      };
    }
    async botTurn(my) {
      const s = this.s, i = s.turn;
      const ok = await this.sleep(700 + rnd() * 900);
      if (!ok || my !== this.gen || s.turn !== i || s.phase !== 'bidding') return;
      const d = R.Liars.botDecide(s, i);
      if (d.type === 'bid') {
        if (!R.Liars.applyBid(s, d)) { // should never happen; fall back to a call
          console.warn('bot made illegal bid', d);
          if (s.bid) return this.call('liar');
          const lb = R.Liars.legalBids(null, this.total(), s.wild, 0)[0];
          R.Liars.applyBid(s, lb);
        }
        this.afterBid();
      } else this.call(d.type);
    }
    afterBid() {
      this.save();
      Au.S.blip(true); DD.buzz(10);
      this.renderBid(true);
      this.tick();
    }
    humanBid() {
      if (!this.myTurn() || !this.wq) return;
      const b = { q: this.wq.value, f: this.wf.value };
      if (!R.Liars.applyBid(this.s, b)) { DD.toast('That bid doesn’t beat the last one.'); return; }
      if (!this.solo) this.viewer = null; // cups down before the phone moves
      this.afterBid();
    }
    humanCall(type) {
      if (!this.myTurn() || !this.s.bid) return;
      this.call(type);
    }
    call(type) {
      const s = this.s;
      const r = R.Liars.applyCall(s, type);
      if (!r) return;
      this.save();
      this.gen++;
      this.showReveal(true);
    }
    async showReveal(fresh) {
      const s = this.s, r = s.result;
      const my = ++this.gen;
      this.renderSeats();
      $('#ld-ctrl').innerHTML = '';
      const shell = $('#scr-game .gshell'), top = $('#scr-game .gtop');
      const oldOv = $('.reveal', shell); if (oldOv) oldOv.remove();
      const ov = document.createElement('div'); ov.className = 'reveal';
      ov.style.top = (top.offsetTop + top.offsetHeight + 4) + 'px';
      const main = ov;
      const caller = s.players[r.caller].name;
      ov.innerHTML = `<div class="rv-head"><div class="banner ${r.type === 'liar' ? '' : 'cyan'}" style="font-size:30px">${r.type === 'liar' ? 'LIAR!' : 'SPOT ON!'}</div>
        <div class="muted" style="color:#d8fff8;display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap"><b>${esc(caller)}</b> calls ${esc(s.players[r.bidder].name)}’s ${r.q} × ${fi(r.f, 48).replace('<img', '<img style="width:24px;height:24px"')}</div>
        <div class="rv-count"><span id="rv-count">0</span><small id="rv-lbl">counting…</small></div></div>
        <div class="rv-rows" id="rv-rows"></div><div class="rv-verdict" id="rv-verdict"></div>
        <button class="btn gold block invisible" id="rv-next" data-act="ldnext">Next round</button>`;
      shell.appendChild(ov);
      if (fresh) { r.type === 'liar' ? Au.S.liar() : Au.S.spot(); DD.buzz([60, 40, 120]); }
      const rows = $('#rv-rows', ov);
      const W = Math.min(main.clientWidth - 110, 420);
      const active = s.players.map((p, i) => ({ p, i })).filter((x) => !x.p.out);
      const size = Math.floor(Math.max(26, Math.min(48, W / 5 + 6, (rows.clientHeight - 4) / active.length + 6)));
      const all = [];
      for (const { p } of active) {
        const row = document.createElement('div'); row.className = 'rv-row';
        row.innerHTML = `<div class="nm">${esc(p.name)}</div><div class="dz"></div>`;
        const dz = $('.dz', row);
        const prof = DD.P(p.id) || {};
        p.dice.forEach((v) => { const d = new Dice.Die(size, prof.theme); dz.appendChild(d.el); all.push({ d, v }); });
        rows.appendChild(row);
      }
      Au.S.rattle(0.4);
      await Promise.all(all.map((x, k) => x.d.roll(x.v, { delay: k * 25, dur: 600, dx: 0, dy: -size * 0.6 })));
      if (!this.alive || my !== this.gen) return;
      await this.sleep(300);
      let n = 0;
      const cnt = $('#rv-count', ov);
      for (const x of all) {
        if (R.Liars.matches(x.v, r.f, s.wild)) {
          n++;
          x.d.setGlow(x.v === r.f ? '#f7c948' : '#ff4fb0');
          cnt.textContent = n; $('#rv-lbl', ov).textContent = faceName(r.f, n); Au.S.tick(n); DD.buzz(8);
          if (!(await this.sleep(DD.db.settings.reduced ? 80 : 260)) || my !== this.gen) return;
        } else x.d.el.classList.add('dim');
      }
      $('#rv-lbl', ov).textContent = `${faceName(r.f, n)} on the table${s.wild && r.f !== 1 ? ' (1s wild)' : ''}`;
      const loser = r.loser != null ? s.players[r.loser].name : null;
      let msg;
      if (r.type === 'liar') msg = r.correct ? `Only ${n}! ${esc(s.players[r.bidder].name)} was bluffing — <b style="color:var(--red)">${esc(loser)} loses a die.</b>` : `The bid stands. <b style="color:var(--red)">${esc(loser)} loses a die.</b>`;
      else msg = r.correct ? `Exactly ${n}! <b style="color:var(--green)">${esc(caller)} ${s.players[r.caller].count < 5 ? 'wins a die back' : 'nails it'}.</b>` : `Not exact. <b style="color:var(--red)">${esc(caller)} loses a die.</b>`;
      const vEl = $('#rv-verdict', ov);
      vEl.innerHTML = `<div>${msg}</div>`;
      const humanHurt = r.loser != null && s.players[r.loser].type === 'human';
      if (humanHurt) { Au.S.lose(); DD.buzz(120); } else Au.S.spot();
      const nb = $('#rv-next', ov);
      const willEnd = r.loser != null && s.players[r.loser].count === 1 && R.Liars.active(s).length === 2;
      nb.textContent = willEnd ? 'Finish' : 'Next round';
      nb.classList.remove('invisible');
      if (this.ff) setTimeout(() => this.alive && my === this.gen && this.nextRound(), 600);
    }
    nextRound() {
      const s = this.s;
      if (s.phase !== 'reveal') return;
      const before = s.players.map((p) => p.out);
      R.Liars.applyResult(s);
      s.players.forEach((p, i) => { if (p.out && !before[i]) this.g.ui.outs.push(i); });
      $$('.reveal').forEach((x) => x.remove());
      if (!this.solo) this.viewer = null;
      this.save();
      this.dice = [];
      if (s.phase !== 'over') { Au.S.rattle(0.5); DD.buzz(20); }
      this.render();
      this.tick();
    }
    async finish() {
      const s = this.s;
      if (this.done) return; this.done = true;
      this.render();
      await this.payout([$(`.seat[data-seat="${s.winner}"]`)]);
      const outs = this.g.ui.outs.slice().reverse();
      const st = [{ id: s.players[s.winner].id, name: s.players[s.winner].name, note: '1st · last cup standing' }]
        .concat(outs.map((i, k) => ({ id: s.players[i].id, name: s.players[i].name, note: ordinal(k + 2) })));
      DD.endGame([s.winner], st);
    }
  }
  function bestFace(dice, wild) {
    let best = wild ? 2 : 1, n = -1;
    for (let f = wild ? 2 : 1; f <= 6; f++) { const c = dice.filter((v) => R.Liars.matches(v, f, wild)).length; if (c >= n) { n = c; best = f; } }
    return best;
  }
  function faceName(f, q) { const n = ['', 'one', 'two', 'three', 'four', 'five', 'six'][f]; return q === 1 ? n : (f === 6 ? 'sixes' : n + 's'); }
  function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th'); }

  // =====================================================================
  // FARKLE
  // =====================================================================
  class FarkleGame extends Base {
    constructor(g, fresh) {
      super(g, fresh);
      this.sel = [];
      this.dice = [];
      Object.assign(this.act, {
        fkroll: () => this.humanRoll(),
        fkbank: () => this.humanBank(),
        fkdie: (b) => this.toggle(+b.dataset.i),
      });
    }
    mount(root) {
      root.innerHTML = `<div class="gshell felt">${this.topbar('Farkle')}
        <div class="fk-board" id="fk-board"></div>
        <div class="fk-table"><div class="fk-kept" id="fk-kept"></div><div class="tray" id="fk-tray"></div><div class="fk-msg" id="fk-msg"></div><div class="hint" id="fk-hint"></div></div>
        <div class="fk-turn" id="fk-turn"></div>
        <div class="actions2" id="fk-act"></div>
        <div style="text-align:center;margin-top:6px"><button class="btn small ghost" data-act="rules" data-game="farkle">${ICON.book} Scoring guide</button></div></div>`;
      this.begin('.fk-p');
    }
    relayout() { this.renderTray(true); }
    cur() { return this.s.players[this.s.turn]; }
    isHuman() { return this.cur().type === 'human'; }
    render() { this.renderBoard(); this.renderTray(); this.renderTurn(); this.renderActions(); }
    renderBoard() {
      const s = this.s, el = $('#fk-board'); if (!el) return;
      el.className = 'fk-board' + (s.players.length <= 2 ? '' : '');
      el.innerHTML = s.players.map((p, i) => `<div class="fk-p ${i === s.turn && s.phase !== 'over' ? 'turn' : ''}" data-seat="${i}">
        <div class="top"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}${p.type === 'bot' ? ' <small class="muted">bot</small>' : ''}</span><span class="sc">${p.score.toLocaleString()}</span></div>
        <div class="bar"><i style="width:${Math.min(100, p.score / s.target * 100)}%"></i></div></div>`).join('');
      this.sub(`First to ${s.target.toLocaleString()}${s.finalRound ? ' · FINAL ROUND' : ''}`);
    }
    renderTray(force) {
      const s = this.s, tray = $('#fk-tray'), kept = $('#fk-kept'); if (!tray) return;
      kept.innerHTML = s.kept.length ? `<span class="lbl">Kept</span>${s.kept.map((v) => fi(v, 64)).join('')}` : '<span class="lbl">Set-aside dice land here</span>';
      const W = Math.min(tray.parentNode.clientWidth || 360, 460);
      const H = tray.parentNode.clientHeight || 300;
      const size = Math.floor(Math.min(96, W / 3.3, (H - 90) / 2));
      this.size = size;
      if (!force && this.dice.length === s.dice.length && this.dice.every((d, i) => d.value === s.dice[i])) { this.paintSel(); return; }
      tray.innerHTML = '';
      const prof = DD.P(this.cur().id) || {};
      this.dice = s.dice.map((v, i) => {
        const b = document.createElement('button'); b.className = 'diebtn'; b.dataset.act = 'fkdie'; b.dataset.i = i;
        b.setAttribute('aria-label', 'Die showing ' + v);
        const d = new Dice.Die(size, s.phase === 'farkle' ? 'coal' : 'ivory'); d.set(v);
        b.appendChild(d.el); tray.appendChild(b); d.btn = b;
        b.style.transform = `translate(${(rnd() - 0.5) * 8}px, ${(rnd() - 0.5) * 8}px)`;
        return d;
      });
      void prof;
      this.paintSel();
    }
    paintSel() {
      const can = this.s.phase === 'rolled' && this.isHuman() && !this.busy;
      this.dice.forEach((d, i) => { d.btn.classList.toggle('sel', this.sel.indexOf(i) >= 0); d.btn.disabled = !can; });
    }
    selScore() { return R.Farkle.score(this.sel.map((i) => this.s.dice[i])); }
    renderTurn() {
      const s = this.s, el = $('#fk-turn'); if (!el) return;
      const ss = this.selScore();
      el.innerHTML = `<div>Turn <span>${s.turnScore}</span></div>${s.phase === 'rolled' ? `<div>Selected <em>${this.sel.length ? (ss ? '+' + ss : 'not scoring') : '—'}</em></div>` : ''}`;
    }
    renderActions() {
      const s = this.s, el = $('#fk-act'), hint = $('#fk-hint'); if (!el) return;
      DD.Shake.handler = null;
      if (s.phase === 'over') { el.innerHTML = ''; return; }
      const p = this.cur();
      if (!this.isHuman()) { el.innerHTML = `<button class="btn" disabled>${esc(p.name)} is rolling…</button>`; hint.textContent = ''; return; }
      if (this.busy) { el.innerHTML = '<button class="btn" disabled>…</button>'; return; }
      if (s.phase === 'start') {
        el.innerHTML = `<button class="btn gold" data-act="fkroll">Roll 6 dice</button>`;
        hint.textContent = `${p.name}, your turn${s.finalRound ? ' — last chance!' : ''}`;
        DD.Shake.handler = () => this.humanRoll();
        return;
      }
      if (s.phase === 'kept') {
        const left = s.kept.length >= 6 ? 6 : 6 - s.kept.length;
        el.innerHTML = `<button class="btn cyan" data-act="fkbank">Bank ${s.turnScore.toLocaleString()}</button><button class="btn gold" data-act="fkroll">Roll ${left}</button>`;
        return;
      }
      if (s.phase === 'rolled') {
        const ss = this.selScore();
        const remain = s.dice.length - this.sel.length;
        const hot = ss && remain === 0;
        el.innerHTML = `<button class="btn cyan" data-act="fkbank" ${ss ? '' : 'disabled'}>Bank ${ss ? (s.turnScore + ss).toLocaleString() : ''}</button>
          <button class="btn gold" data-act="fkroll" ${ss ? '' : 'disabled'}>${hot ? 'Hot dice! Roll 6' : `Roll ${remain || ''} more`}</button>`;
        hint.textContent = ss ? '' : 'Tap scoring dice to set them aside';
        if (ss) DD.Shake.handler = () => this.humanRoll();
      }
    }
    toggle(i) {
      if (this.s.phase !== 'rolled' || !this.isHuman() || this.busy) return;
      const k = this.sel.indexOf(i);
      if (k >= 0) this.sel.splice(k, 1); else this.sel.push(i);
      Au.S.tap(); DD.buzz(8);
      this.paintSel(); this.renderTurn(); this.renderActions();
    }
    tick() {
      if (!this.alive) return;
      const s = this.s;
      const my = ++this.gen;
      if (s.phase === 'over') { this.finish(); return; }
      if (s.phase === 'farkle') { this.showFarkle(my); return; }
      this.render();
      if (!this.isHuman()) this.botTurn(my);
    }
    async doRoll() {
      const s = this.s;
      const hot = s.kept.length >= 6;
      const res = R.Farkle.roll(s);
      this.sel = [];
      this.save();
      this.busy = true;
      if (hot) { this.flash('HOT DICE!', 'gold'); Au.S.hot(); }
      // build fresh dice and tumble them
      this.renderTray(true);
      this.renderTurn(); this.renderActions();
      Au.S.rattle(0.6); DD.buzz([15, 25, 15]);
      await Promise.all(this.dice.map((d, i) => d.roll(s.dice[i], { delay: i * 50 })));
      this.busy = false;
      if (this.alive) { this.paintSel(); this.renderActions(); }
      return res;
    }
    flash(text, cls) {
      const m = $('#fk-msg'); if (!m) return;
      m.innerHTML = `<div class="banner ${cls || ''}">${text}</div>`;
      clearTimeout(this.flashT);
      this.flashT = setTimeout(() => { if (m) m.innerHTML = ''; }, 1400 * DD.SPEED + 300);
    }
    async humanRoll() {
      const s = this.s;
      if (!this.isHuman() || this.busy) return;
      if (s.phase === 'rolled') {
        if (!this.selScore()) return;
        R.Farkle.keep(s, this.sel.slice());
        this.sel = [];
      } else if (s.phase !== 'start' && s.phase !== 'kept') return;
      DD.Shake.handler = null;
      const my = ++this.gen;
      const res = await this.doRoll();
      if (!this.alive || my !== this.gen) return;
      if (res === 'farkle') { this.showFarkle(my); return; }
      this.render();
    }
    async humanBank() {
      const s = this.s;
      if (!this.isHuman() || this.busy) return;
      if (s.phase === 'kept') { await this.bank(); return; }
      if (s.phase !== 'rolled' || !this.selScore()) return;
      R.Farkle.keep(s, this.sel.slice()); this.sel = [];
      await this.bank();
    }
    async bank() {
      const s = this.s, who = s.turn, pts = s.turnScore;
      const wasFinal = !!s.finalRound;
      R.Farkle.bank(s);
      this.save();
      Au.S.chip(Math.min(6, 1 + Math.floor(pts / 300))); DD.buzz(20);
      this.flash(`+${pts.toLocaleString()}`, 'cyan');
      if (!wasFinal && s.finalRound) DD.toast(`${s.players[who].name} hit ${s.target.toLocaleString()}! Everyone else gets one last turn.`, 3200);
      this.dice = [];
      this.render();
      await this.sleep(700);
      this.tick();
    }
    async showFarkle(my) {
      const s = this.s;
      this.renderTray(true);
      this.flash('FARKLE!');
      Au.S.farkle(); DD.buzz([80, 60, 80]);
      this.busy = true; this.renderActions();
      const ok = await this.sleep(1500);
      this.busy = false;
      if (!ok || my !== this.gen) return;
      R.Farkle.bust(s);
      this.save();
      this.dice = [];
      this.tick();
    }
    async botTurn(my) {
      const s = this.s, me = s.turn;
      const p = this.cur();
      const go = async (ms) => (await this.sleep(ms)) && my === this.gen && s.turn === me;
      if (!(await go(600))) return;
      for (let guard = 0; guard < 60; guard++) {
        if (s.phase === 'start' || s.phase === 'kept') {
          const res = await this.doRoll();
          if (!this.alive || my !== this.gen) return;
          if (res === 'farkle') { this.showFarkle(my); return; }
          this.render();
        }
        if (!(await go(650))) return;
        const ch = R.Farkle.botChoose(s.dice, { turn: s.turnScore, banked: p.score, target: s.target, leader: R.Farkle.leader(s, me), finalRound: !!s.finalRound, oppMax: R.Farkle.leader(s, me) }, p.personality);
        if (!ch) { this.showFarkle(my); return; }
        this.sel = ch.keep.slice(); this.paintSel(); this.renderTurn(); Au.S.tap();
        if (!(await go(700))) return;
        R.Farkle.keep(s, ch.keep); this.sel = [];
        this.save();
        if (ch.action === 'bank') { await this.bank(); return; }
        this.renderTray(); this.renderTurn();
      }
    }
    async finish() {
      const s = this.s;
      if (this.done) return; this.done = true;
      this.render();
      await this.payout([$(`.fk-p[data-seat="${s.winner}"]`)]);
      const order = s.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
      DD.endGame([s.winner], order.map((x, k) => ({ id: x.p.id, name: x.p.name, note: `${ordinal(k + 1)} · ${x.p.score.toLocaleString()}` })));
    }
  }

  // =====================================================================
  // SHIP, CAPTAIN & CREW
  // =====================================================================
  class SCCGame extends Base {
    constructor(g, fresh) {
      super(g, fresh);
      this.dice = [];
      Object.assign(this.act, {
        scroll: () => this.humanRoll(),
        sckeep: () => this.humanKeep(),
      });
    }
    mount(root) {
      root.innerHTML = `<div class="gshell felt">${this.topbar(innerWidth < 420 ? 'Ship & Crew' : 'Ship, Captain & Crew')}
        <div class="sc-board" id="sc-board"></div>
        <div class="fk-table">
          <div class="sc-slots" id="sc-slots"></div>
          <div class="cargo" id="sc-cargo"></div>
          <div class="tray" id="sc-tray" style="grid-template-columns:repeat(5,auto)"></div>
          <div class="rolls" id="sc-rolls"></div>
          <div class="fk-msg" id="sc-msg"></div><div class="hint" id="sc-hint"></div>
        </div>
        <div class="actions2" id="sc-act"></div>
        <div style="text-align:center;margin-top:6px"><button class="btn small ghost" data-act="rules" data-game="scc">${ICON.book} How to play</button></div></div>`;
      this.begin('.sc-p');
    }
    relayout() { this.renderTray(this.s.t.dice, true); }
    cur() { return this.s.players[Math.min(this.s.turn, this.s.players.length - 1)]; }
    isHuman() { return this.s.phase === 'play' && this.cur().type === 'human'; }
    render() { this.renderBoard(); this.renderSlots(); this.renderTray(this.s.t.dice); this.renderActions(); }
    renderBoard() {
      const s = this.s, el = $('#sc-board'); if (!el) return;
      el.innerHTML = s.players.map((p, i) => {
        const r = p.result;
        const res = r == null ? (i === s.turn && s.phase === 'play' ? 'rolling…' : '—') : r === 0 ? '<span class="res bust">sunk</span>' : `<span class="res">${r}</span>`;
        return `<div class="sc-p ${i === s.turn && s.phase === 'play' ? 'turn' : ''}" data-seat="${i}"><span class="scn">${esc(p.name)}</span><span style="flex:none">${res}</span></div>`;
      }).join('');
      const best = R.SCC.best(s);
      this.sub(`Hand ${s.hand}${best ? ` · best cargo ${best}` : ''}`);
    }
    renderSlots(pop) {
      const t = this.s.t, el = $('#sc-slots'); if (!el) return;
      const slot = (got, v, l) => `<div class="slot ${got ? 'got' : ''} ${pop === v ? 'popin' : ''}"><div class="lbl">${l}</div><div class="sd">${fi(v, 84, 'gold')}</div></div>`;
      el.innerHTML = slot(t.ship, 6, 'Ship') + slot(t.captain, 5, 'Captain') + slot(t.crew, 4, 'Crew');
      $('#sc-cargo').innerHTML = t.cargo != null ? `Cargo <b>${t.cargo}</b>` : (t.rolls < 3 && t.done ? '<span style="color:var(--red)">Sunk!</span>' : '<span class="muted" style="color:#bfe">Need 6 → 5 → 4</span>');
      $('#sc-rolls').innerHTML = [0, 1, 2].map((i) => `<i class="${i < t.rolls ? 'on' : ''}"></i>`).join('');
    }
    renderTray(vals, force) {
      const tray = $('#sc-tray'); if (!tray) return;
      const W = Math.min(tray.parentNode.clientWidth || 360, 480);
      const size = Math.floor(Math.min(78, W / 5.3));
      if (!force && this.dice.length === vals.length && this.dice.every((d, i) => d.value === vals[i])) return;
      tray.innerHTML = '';
      this.dice = vals.map((v) => { const d = new Dice.Die(size, 'ruby'); d.set(v); tray.appendChild(d.el); return d; });
      if (!vals.length) tray.innerHTML = `<div style="height:${size}px"></div>`;
    }
    renderActions() {
      const s = this.s, t = s.t, el = $('#sc-act'), hint = $('#sc-hint'); if (!el) return;
      DD.Shake.handler = null;
      if (s.phase !== 'play') { el.innerHTML = ''; return; }
      const p = this.cur();
      if (!this.isHuman()) { el.innerHTML = `<button class="btn" disabled>${esc(p.name)} is rolling…</button>`; hint.textContent = ''; return; }
      if (this.busy || t.done) { el.innerHTML = '<button class="btn" disabled>…</button>'; return; }
      hint.textContent = `${p.name}, ${t.rolls === 3 ? 'your roll' : `${t.rolls} roll${t.rolls === 1 ? '' : 's'} left`}`;
      if (t.cargo != null) {
        el.innerHTML = `<button class="btn cyan" data-act="sckeep">Keep cargo ${t.cargo}</button><button class="btn gold" data-act="scroll">Reroll cargo</button>`;
      } else {
        el.innerHTML = `<button class="btn gold" data-act="scroll">Roll ${5 - R.SCC.held(t)} dice</button>`;
      }
      DD.Shake.handler = () => this.humanRoll();
    }
    tick() {
      if (!this.alive) return;
      const s = this.s, my = ++this.gen;
      if (s.phase === 'over') { this.finish(); return; }
      if (s.phase === 'push') { this.push(my); return; }
      this.render();
      if (s.t.done) { this.endTurn(my); return; }
      if (!this.isHuman()) this.botTurn(my);
    }
    async doRoll() {
      const s = this.s, t = s.t;
      if (t.done || t.rolls <= 0) return;
      const before = { ship: t.ship, captain: t.captain, crew: t.crew };
      const vals = R.rollN(5 - R.SCC.held(t));
      t.rolls--;
      R.SCC.assign(t, vals);
      if (t.rolls <= 0) t.done = true;
      this.save();
      this.busy = true; this.renderActions();
      this.renderTray(vals, true);
      Au.S.rattle(0.55); DD.buzz([15, 25, 15]);
      await Promise.all(this.dice.map((d, i) => d.roll(vals[i], { delay: i * 50 })));
      if (!this.alive) return;
      const got = ['ship', 'captain', 'crew'].filter((k) => t[k] && !before[k]);
      if (got.length) { got.forEach((_, i) => setTimeout(() => Au.S.chip(1), i * 120)); DD.buzz(15); }
      await this.sleep(got.length ? 450 : 250);
      this.busy = false;
      this.renderSlots(); this.renderTray(t.dice); this.renderBoard(); this.renderActions();
      if (t.cargo != null && got.length) this.flash(got.length === 3 ? 'ALL ABOARD!' : 'CREW ABOARD!', 'gold');
    }
    flash(text, cls) {
      const m = $('#sc-msg'); if (!m) return;
      m.innerHTML = `<div class="banner ${cls || ''}">${text}</div>`;
      clearTimeout(this.flashT);
      this.flashT = setTimeout(() => { if (m) m.innerHTML = ''; }, 1300 * DD.SPEED + 300);
    }
    async humanRoll() {
      if (!this.isHuman() || this.busy || this.s.t.done) return;
      const my = ++this.gen;
      await this.doRoll();
      if (!this.alive || my !== this.gen) return;
      if (this.s.t.done) { this.endTurn(my); return; }
      this.renderActions();
    }
    humanKeep() {
      if (!this.isHuman() || this.busy || this.s.t.cargo == null) return;
      this.s.t.done = true; this.save();
      this.endTurn(++this.gen);
    }
    async botTurn(my) {
      const s = this.s, me = s.turn, p = this.cur();
      const go = async (ms) => (await this.sleep(ms)) && my === this.gen && s.turn === me;
      if (!(await go(500))) return;
      while (!s.t.done) {
        await this.doRoll();
        if (!this.alive || my !== this.gen) return;
        if (s.t.done) break;
        if (s.t.cargo != null && R.SCC.botKeep(s.t, R.SCC.best(s), p.personality)) { s.t.done = true; this.save(); break; }
        if (!(await go(500))) return;
      }
      this.endTurn(my);
    }
    async endTurn(my) {
      const s = this.s, t = s.t;
      const p = this.cur();
      if (t.cargo == null) { this.flash('SUNK!'); Au.S.farkle(); } else { Au.S.chip(2); }
      this.renderSlots();
      if (!(await this.sleep(1100)) || my !== this.gen) return;
      void p;
      R.SCC.finishTurn(s);
      this.save();
      this.dice = [];
      this.tick();
    }
    async push(my) {
      this.render();
      this.flash('EVERYONE SANK!');
      DD.toast('Nobody shipped out — the pot rides on to another hand.', 2800);
      if (!(await this.sleep(1800)) || my !== this.gen) return;
      R.SCC.rehand(this.s);
      this.save();
      this.tick();
    }
    async finish() {
      const s = this.s;
      if (this.done) return; this.done = true;
      this.render();
      await this.payout(s.winners.map((i) => $(`.sc-p[data-seat="${i}"]`)));
      const order = s.players.map((p, i) => ({ p, i })).sort((a, b) => (b.p.result || 0) - (a.p.result || 0));
      DD.endGame(s.winners, order.map((x) => ({ id: x.p.id, name: x.p.name, note: x.p.result ? `cargo ${x.p.result}` : 'sunk' })));
    }
  }

  DD.games.liars = LiarsGame;
  DD.games.farkle = FarkleGame;
  DD.games.scc = SCCGame;
})();
