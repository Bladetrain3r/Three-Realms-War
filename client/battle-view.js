// The battle on a 1920 x 1080 canvas: backdrop, two parties, hit points, status badges, floating numbers.
// `draw(now)` is a pure function of the replay state and the running animations, so it can be timed and screenshotted.
import { Art } from './art/index.js';
import { initState, applyEvent, applyAll } from './replay-state.js';

export const W = 1920;
export const H = 1080;
const DUR = { 0: 800, 1: 450, 2: 150, 3: 500, 4: 550, 5: 550, 6: 280, 7: 380, 8: 0, 9: 550, 10: 450, 11: 900, 12: 650, 13: 0, 14: 700 };
const BADGE = { burn: ['B', '#c8562a'], chill: ['C', '#4d8c88'], shock: ['S', '#c8962e'], mark: ['M', '#9e2b25'], bulwark: ['W', '#2f5d9e'], fury: ['F', '#b8442a'], mend: ['R', '#3f7a46'] };
const feet = (u) => { const lane = u.slot % 2, front = u.slot < 2, x = (front ? 740 : 470) + (lane ? 150 : 0), y = lane ? 940 : 690; return { x: u.side === 'hero' ? x : W - x, y, s: lane ? 1.08 : 1 }; };

export class BattleView {
  constructor(canvas, replay, content, { reduced = false, bg = null } = {}) {
    this.canvas = canvas; this.bg = bg; this.replay = replay; this.content = content; this.reduced = reduced;
    canvas.width = W; canvas.height = H; this.ctx = canvas.getContext('2d');
    this.realm = replay.inputs.realm; this.speed = 1; this.playing = false; this.anims = []; this.nextAt = 0; this.clock = 0;
    this.reset();
    this.ready = this.warm();
  }
  reset() { this.state = initState(this.replay, this.content); this.anims = []; this.nextAt = this.clock; this.onChange && this.onChange(); }
  // paint every sprite the replay will show, one per tick, so the page does not freeze
  warm() {
    const jobs = [() => Art.backdrop(this.realm)];
    this.replay.inputs.party.forEach((p) => jobs.push(() => Art.hero(this.content.heroById[p.class])));
    const seen = new Set();
    for (const enc of this.replay.plan) for (const e of enc) if (!seen.has(e.id)) { seen.add(e.id); jobs.push(() => this.spriteOfFoe(e.id)); }
    return new Promise((res) => { const step = () => { const j = jobs.shift(); if (!j) { this.paintBackdrop(); return res(); } j(); setTimeout(step, 0); }; setTimeout(step, 0); });
  }
  paintBackdrop() {
    if (!this.bg) return;
    this.bg.width = W; this.bg.height = H;
    this.bg.getContext('2d').drawImage(Art.backdrop(this.realm), 0, 0, W, H);
  }
  spriteOfFoe(id) {
    const b = this.content.bossById[id];
    return b ? Art.boss(b) : Art.monster(this.content.roster.find((m) => m.id === id));
  }
  sprite(u) { return u.side === 'hero' ? Art.hero(this.content.heroById[u.def.class]) : this.spriteOfFoe(u.id2); }

  play(speed = this.speed) { this.speed = speed; this.playing = true; }
  pause() { this.playing = false; }
  skip() { applyAll(this.state, this.replay, this.content); this.anims = []; this.playing = false; this.onChange && this.onChange(); }
  restart() { this.reset(); this.playing = true; }
  get done() { return this.state.cursor >= this.replay.events.length; }

  // advance the replay clock by dt milliseconds (only while playing)
  tick(dt) {
    this.clock += dt;
    if (!this.playing) return;
    while (!this.done && this.clock >= this.nextAt) {
      const ev = this.replay.events[this.state.cursor], cue = applyEvent(this.state, ev, this.replay, this.content);
      this.cue(cue);
      this.nextAt = Math.max(this.nextAt, this.clock - 200) + DUR[ev[0]] / this.speed;
      this.onChange && this.onChange(cue);
    }
    if (this.done && this.anims.length === 0) this.playing = false;
  }
  cue(c) {
    const t = this.clock, sp = this.speed;
    const add = (a) => this.anims.push({ t0: t, dur: 600 / sp, ...a });
    if (c.kind === 'skill' && c.target >= 0) add({ type: 'lunge', unit: c.unit, to: c.target, dur: 450 / sp });
    else if (c.kind === 'hit') { add({ type: 'shake', unit: c.dst, dur: 380 / sp }); add({ type: 'float', unit: c.dst, text: `${c.amount}${c.crit ? '!' : ''}`, color: c.crit ? '#ffd36a' : '#fff6e0', big: c.crit, dur: 900 / sp }); }
    else if (c.kind === 'heal') add({ type: 'float', unit: c.dst, text: `+${c.amount}`, color: '#8fdc9a', dur: 900 / sp });
    else if (c.kind === 'tick') add({ type: 'float', unit: c.unit, text: `${c.heal ? '+' : '-'}${c.amount}`, color: c.heal ? '#8fdc9a' : '#ff9a6a', dur: 800 / sp });
    else if (c.kind === 'status') add({ type: 'float', unit: c.dst, text: c.status, color: '#e9dcb9', small: true, dur: 800 / sp });
    else if (c.kind === 'death_save') add({ type: 'float', unit: c.unit, text: c.result === 1 ? 'lost for good' : c.result === 2 ? 'the Thread holds' : 'lives', color: c.result === 1 ? '#ff9a8a' : '#e9dcb9', small: true, dur: 1100 / sp });
    else if (c.kind === 'down') add({ type: 'fall', unit: c.unit, dur: 500 / sp });
    else if (c.kind === 'skip') add({ type: 'float', unit: c.unit, text: 'skipped', color: '#e9dcb9', small: true, dur: 700 / sp });
    else if (c.kind === 'enc_start') add({ type: 'banner', text: `Encounter ${c.index + 1}`, dur: 900 / sp });
    this.anims = this.anims.filter((a) => t - a.t0 < a.dur + 50);
  }

  draw(now = this.clock) {
    const ctx = this.ctx, st = this.state;
    if (this.reduced) this.anims = [];
    ctx.clearRect(0, 0, W, H); // the backdrop lives on its own canvas underneath and is painted once
    const list = st.units.filter((u) => u.present).map((u) => ({ u, f: feet(u) })).sort((a, b) => a.f.y - b.f.y || a.u.id - b.u.id);
    for (const { u, f } of list) this.drawUnit(ctx, u, f, now);
    for (const { u, f } of list) this.drawPlate(ctx, u, f);
    for (const a of this.anims) this.drawAnim(ctx, a, now);
    ctx.font = 'bold 30px Georgia, serif'; ctx.textAlign = 'left'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(42,29,18,0.9)'; ctx.fillStyle = '#e9dcb9';
    const head = `Round ${st.round}  ·  Encounter ${Math.max(1, st.enc + 1)} of ${st.encCount}`;
    ctx.strokeText(head, 36, 56); ctx.fillText(head, 36, 56);
    if (st.over) { ctx.textAlign = 'center'; ctx.font = 'bold 64px Georgia, serif'; ctx.lineWidth = 10; ctx.strokeStyle = st.outcome === 1 ? '#2a1d12' : '#6e1a16'; ctx.fillStyle = '#e9dcb9'; const t = st.outcome === 1 ? 'Victory' : 'Defeat'; ctx.strokeText(t, W / 2, 140); ctx.fillText(t, W / 2, 140); }
  }
  offsetOf(u, now) {
    let dx = 0, dy = 0, alpha = u.alive ? 1 : 0.3, ang = 0;
    for (const a of this.anims) {
      if (a.unit !== u.id) continue;
      const p = Math.min(1, Math.max(0, (now - a.t0) / a.dur)), dir = u.side === 'hero' ? 1 : -1;
      if (a.type === 'lunge') dx += Math.sin(p * Math.PI) * 90 * dir;
      else if (a.type === 'shake') dx += Math.sin(p * 18) * 14 * (1 - p);
      else if (a.type === 'fall') { alpha = 1 - 0.7 * p; ang = -0.12 * p * dir; }
    }
    if (this.state.actor === u.id && u.alive) dy -= 6 + 4 * Math.sin(now / 160);
    return { dx, dy, alpha, ang };
  }
  drawUnit(ctx, u, f, now) {
    const spr = this.sprite(u), o = this.offsetOf(u, now), boss = u.boss, k = (boss ? 1.1 : 1.55) * f.s, w = spr.width * k, hgt = spr.height * k;
    const flip = u.side === 'foe';
    ctx.save(); ctx.globalAlpha = o.alpha; ctx.translate(f.x + o.dx, f.y + o.dy);
    if (this.state.actor === u.id && u.alive) { ctx.fillStyle = 'rgba(255,220,120,0.28)'; ctx.beginPath(); ctx.ellipse(0, 4, 110 * f.s, 24 * f.s, 0, 0, 7); ctx.fill(); }
    ctx.rotate(o.ang); if (flip) ctx.scale(-1, 1);
    const feetY = boss ? 0.945 : 0.915; // fraction of the sheet where the feet rest
    ctx.drawImage(spr, -w / 2, -hgt * feetY, w, hgt);
    ctx.restore();
  }
  drawPlate(ctx, u, f) {
    const boss = u.boss, top = f.y + 16, w = boss ? 220 : 150, x = f.x - w / 2;
    ctx.save(); ctx.globalAlpha = u.alive ? 1 : 0.4; ctx.textAlign = 'center'; ctx.font = '22px Georgia, serif';
    ctx.fillStyle = 'rgba(233,220,185,0.85)'; ctx.fillRect(x - 6, top - 30, w + 12, 54);
    ctx.fillStyle = '#2a1d12'; ctx.fillText(u.name, f.x, top - 8, w + 8);
    ctx.fillStyle = '#5b3a1e'; ctx.fillRect(x, top, w, 12);
    ctx.fillStyle = u.side === 'hero' ? '#3f7a46' : '#9e2b25'; ctx.fillRect(x, top, Math.round((w * u.hp) / Math.max(1, u.maxHp)), 12);
    ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 2; ctx.strokeRect(x, top, w, 12);
    ctx.font = '16px monospace'; ctx.fillStyle = '#2a1d12'; ctx.fillText(`${u.hp}/${u.maxHp}`, f.x, top + 28);
    let bx = x;
    for (const s of Object.keys(u.statuses)) { const b = BADGE[s] || ['?', '#555']; ctx.fillStyle = b[1]; ctx.fillRect(bx, top + 34, 22, 22); ctx.fillStyle = '#fff6e0'; ctx.font = 'bold 16px monospace'; ctx.fillText(b[0], bx + 11, top + 51); bx += 26; }
    ctx.restore();
  }
  drawAnim(ctx, a, now) {
    const p = (now - a.t0) / a.dur; if (p < 0 || p > 1) return;
    if (a.type === 'float') {
      const u = this.state.units[a.unit], f = feet(u), top = f.y - 340 * f.s;
      ctx.save(); ctx.globalAlpha = 1 - p * p; ctx.textAlign = 'center'; ctx.font = `bold ${a.big ? 64 : a.small ? 26 : 46}px Georgia, serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(42,29,18,0.9)'; ctx.strokeText(a.text, f.x, top - p * 90); ctx.fillStyle = a.color; ctx.fillText(a.text, f.x, top - p * 90); ctx.restore();
    } else if (a.type === 'banner') {
      ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI); ctx.textAlign = 'center'; ctx.font = 'bold 96px Georgia, serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#2a1d12'; ctx.strokeText(a.text, W / 2, 330); ctx.fillStyle = '#e9dcb9'; ctx.fillText(a.text, W / 2, 330); ctx.restore();
    }
  }
}
