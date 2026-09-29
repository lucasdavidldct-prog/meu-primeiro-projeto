// Lance jogável em canvas 2D (o do esquadrao.html). Na etapa 5 vira a alternativa ao lance 3D.
import { effNow, pickShooter, type Match, type MomentRequest, type MomentResult, type SideEntry } from '../engine/match';
import { ROLE, slotsOf } from '../engine/positions';
import { R, clamp, pick, rn } from '../engine/rng';

interface Actor { x: number; y: number; tx: number; ty: number; e?: SideEntry; gk?: boolean }
type Target = { kind: 'shot'; ax: number } | { kind: 'pass'; m: Actor } | { kind: 'drib'; x: number; y: number };

export function runMoment2D(M: Match, opt: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const A = M.A, B = M.B;
    const ov = document.createElement('div');
    ov.className = 'moment';
    ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>${opt.pen ? 'Pênalti!' : opt.counter ? 'Contra-ataque!' : 'Chance de ataque'}</b><span class="acts" id="moActs"></span></div>
      <canvas id="moCv"></canvas>
      <div class="mo-help">${opt.pen ? 'Toque dentro do gol para escolher onde bater. Cantos são mais difíceis de defender e mais fáceis de errar.' : 'Toque num <b>companheiro</b> para passar · dentro do <b>gol</b> para chutar · no <b>campo</b> para conduzir. Arraste para ver a chance de dar certo e solte para executar.'}</div>
      <div class="mo-msg" id="moMsg"></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector<HTMLCanvasElement>('#moCv')!, ctx = cv.getContext('2d')!, msgEl = ov.querySelector<HTMLElement>('#moMsg')!;
    const Wd = Math.min(ov.clientWidth - 32, 460), U = Wd / 68, Y0 = -4, Hu = 48, Ht = Hu * U, dpr = window.devicePixelRatio || 1;
    cv.style.width = Wd + 'px'; cv.style.height = Ht + 'px'; cv.width = Wd * dpr; cv.height = Ht * dpr; ctx.scale(dpr, dpr);
    const SX = (x: number) => x * U, SY = (y: number) => (y - Y0) * U;

    // Monta a cena
    const slots = slotsOf(A.form);
    const depth = opt.counter ? rn(4, 9) : rn(0, 4);
    let mates: Actor[] = [];
    const foes: Actor[] = [];
    const gkE = B.xi.find(e => e.pos === 'GOL' && !e.red);
    const gkOvr = gkE ? effNow(gkE, M.min) : 35;
    let carrier: Actor;
    if (opt.pen) {
      const sh = pickShooter(A, { ATA: 6, MEI: 4 });
      mates = [{ x: 34, y: 11, tx: 34, ty: 11, e: sh }];
      foes.push({ x: 34, y: .6, tx: 34, ty: .6, gk: true });
      carrier = mates[0];
    } else {
      A.xi.forEach((e, i) => {
        if (e.red || e.pos === 'GOL') return;
        const s = slots[i], r = ROLE(e.pos);
        if (r === 'D' && !((e.pos === 'LD' || e.pos === 'LE') && R() < .35)) return;
        const X = 3.5 + s.x / 100 * 61;
        let Y = s.y >= 60 ? 31 - (s.y - 60) * .6 : s.y >= 36 ? 30 + (60 - s.y) * .45 : 36;
        Y -= depth;
        const x = clamp(X + rn(-2, 2), 3, 65), y = clamp(Y + rn(-2, 2), 6, 43);
        mates.push({ x, y, tx: x, ty: y, e });
      });
      const nOut = opt.counter ? 3 : 4, nMid = opt.counter ? 1 : 2;
      const ball0 = mates.filter(m => m.y >= 22);
      carrier = ball0.length ? pick(ball0) : mates.reduce((a, b) => (a.y > b.y ? a : b));
      for (let k = 0; k < nOut; k++) {
        const x = clamp(16 + k * (36 / (nOut - 1)) + (carrier.x - 34) * .2 + rn(-2, 2), 4, 64), y = rn(11, 16);
        foes.push({ x, y, tx: x, ty: y });
      }
      for (let k = 0; k < nMid; k++) {
        const x = clamp(carrier.x + rn(-9, 9), 4, 64), y = clamp(carrier.y - rn(5, 8), 8, 40);
        foes.push({ x, y, tx: x, ty: y });
      }
      foes.push({ x: 34, y: .8, tx: 34, ty: .8, gk: true });
    }
    const ball = { x: carrier.x, y: carrier.y - 1, fx: 0, fy: 0, tx: 0, ty: 0, t: 1, dur: 1 };
    let actions = opt.pen ? 1 : 6, busy = false, hover: Target | null = null, lastPasser: Actor | null = null, done = false;
    const stat = (m: Actor, k: number) => m.e!.P.st ? m.e!.P.st[k] : m.e!.base;
    const PAS = (m: Actor) => stat(m, 2), DRI = (m: Actor) => stat(m, 3), FIN = (m: Actor) => stat(m, 1);
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    function segD(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
      const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
      let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
      t = clamp(t, 0, 1);
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    }
    const field = () => foes.filter(f => !f.gk);
    const goalie = () => foes.find(f => f.gk)!;
    function passP(to: Actor) {
      const Ln = dist(carrier, to);
      let ok = 1;
      const Rr = 2 + Ln * .05 - (PAS(carrier) - 70) * .02;
      for (const f of foes) { const d = segD(f, carrier, to); if (d < Rr) ok *= 1 - .85 * (1 - d / Rr); }
      const md = Math.min(...field().map(f => dist(f, to)), 99);
      if (md < 2.4) ok *= .55 + .45 * md / 2.4;
      ok *= clamp(1 - Math.max(0, Ln - 24) * .02, .5, 1);
      return clamp(ok, .03, .97);
    }
    function dribP(to: { x: number; y: number }) {
      let ok = 1;
      const d0 = clamp(.72 - (DRI(carrier) - 70) * .012, .25, .9);
      for (const f of field()) { const d = segD(f, carrier, to); if (d < 3) ok *= 1 - d0 * (1 - d / 3); }
      return clamp(ok * clamp(1 - Math.max(0, dist(carrier, to) - 6) * .04, .6, 1), .03, .97);
    }
    function shotP(ax: number) {
      const gk = goalie();
      const D = Math.hypot(carrier.x - 34, carrier.y), edge = Math.min(1, Math.abs(ax - 34) / 3.66);
      if (opt.pen) {
        const miss = clamp(.03 + Math.pow(edge, 3) * .28 - (FIN(carrier) - 70) * .003, .02, .4);
        const save = clamp(.45 * (1 - .6 * edge) * (gkOvr / 80), .08, .6);
        return { goal: (1 - miss) * (1 - save), miss, save, block: 0 };
      }
      const miss = clamp(.04 + D * .016 + Math.pow(edge, 3) * .3 - (FIN(carrier) - 70) * .005, .03, .85);
      let block = 0;
      for (const f of field()) if (segD(f, carrier, { x: ax, y: 0 }) < 1.2) block = 1 - (1 - block) * .55;
      let save = clamp((gkOvr / 100) * .8 * (1 - .55 * edge) + D * .014 - (FIN(carrier) - 70) * .004 - .1, .05, .95);
      save *= clamp(1 - Math.abs(gk.x - ax) / 11, .45, 1);
      return { goal: (1 - miss) * (1 - block) * (1 - save), miss, save, block };
    }
    function target(wx: number, wy: number): Target | null {
      if (wy < 1.4 && wx > 28.5 && wx < 39.5) return { kind: 'shot', ax: clamp(wx, 30.6, 37.4) };
      if (opt.pen) return null;
      let best: Actor | null = null, bd = 3.4;
      for (const m of mates) { if (m === carrier) continue; const d = Math.hypot(m.x - wx, m.y - wy); if (d < bd) { bd = d; best = m; } }
      if (best) return { kind: 'pass', m: best };
      const dx = wx - carrier.x, dy = wy - carrier.y, Ln = Math.hypot(dx, dy);
      if (Ln < 1) return null;
      const k = Math.min(1, 9 / Ln);
      return { kind: 'drib', x: clamp(carrier.x + dx * k, 1, 67), y: clamp(carrier.y + dy * k, 1.5, 44) };
    }
    const probOf = (t: Target) => (t.kind === 'pass' ? passP(t.m) : t.kind === 'drib' ? dribP(t) : shotP(t.ax).goal);
    function flash(text: string, color: string) { msgEl.textContent = text; msgEl.style.color = color; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); }
    function moveBall(tx: number, ty: number, dur: number) { ball.fx = ball.x; ball.fy = ball.y; ball.tx = tx; ball.ty = ty; ball.t = 0; ball.dur = dur; }
    function finish(res: MomentResult, text: string, color: string, wait = 1500) {
      if (done) return;
      done = true; flash(text, color);
      setTimeout(() => { ov.remove(); resolve(res); }, wait);
    }
    const died = () => finish({ goal: false, shot: false, text: 'A defesa se fechou e a jogada morreu.' }, 'Recuou!', '#ddd');
    function react() {
      const c = carrier;
      const fs = field().slice().sort((a, b) => dist(a, c) - dist(b, c));
      fs.forEach((f, i) => {
        const d = dist(f, c);
        if (i < 2) { const k = Math.min(3.4, Math.max(0, d - 1.9)) / (d || 1); f.tx = f.x + (c.x - f.x) * k; f.ty = f.y + (c.y - f.y) * k; }
        else { f.tx = f.x + ((c.x + 34) / 2 - f.x) * .25; f.ty = clamp(Math.min(f.y, c.y - 2.5) - rn(0, 1.5), 3, 42); }
      });
      const gk = goalie();
      gk.tx = 34 + (c.x - 34) * .28;
      gk.ty = clamp(.6 + (Math.hypot(c.x - 34, c.y) < 14 ? 1.4 : .4), .5, 2.5);
      mates.forEach(m => { if (m === c) return; m.tx = clamp(m.x + rn(-1.5, 1.5), 3, 65); m.ty = clamp(m.y - rn(1, 3.5), 5, 44); });
    }
    function act(t: Target | null) {
      if (!t || busy || done) return;
      busy = true; hover = null;
      const p = probOf(t);
      if (t.kind === 'pass') {
        actions--;
        if (R() < p) {
          const dur = Math.min(700, 220 + dist(carrier, t.m) * 18);
          moveBall(t.m.x, t.m.y - 1, dur); lastPasser = carrier;
          setTimeout(() => { carrier = t.m; react(); busy = false; if (actions <= 0) died(); }, dur + 80);
        } else {
          let f: Actor | undefined = field().sort((a, b) => segD(a, carrier, t.m) - segD(b, carrier, t.m))[0];
          const mk = field().sort((a, b) => dist(a, t.m) - dist(b, t.m))[0];
          if (mk && f && dist(mk, t.m) < segD(f, carrier, t.m)) f = mk;
          moveBall(f ? f.x : t.m.x, f ? f.y : t.m.y, 380);
          setTimeout(() => finish({ goal: false, shot: false, text: `passe de ${carrier.e!.name} interceptado.` }, 'Interceptado!', '#f06a5a'), 400);
        }
      } else if (t.kind === 'drib') {
        actions--;
        if (R() < p) {
          carrier.tx = t.x; carrier.ty = t.y; moveBall(t.x, t.y - 1, 520);
          setTimeout(() => { carrier.x = t.x; carrier.y = t.y; react(); busy = false; if (actions <= 0) died(); }, 560);
        } else {
          const f = field().sort((a, b) => segD(a, carrier, t) - segD(b, carrier, t))[0];
          const mx = (carrier.x + t.x) / 2, my = (carrier.y + t.y) / 2;
          carrier.tx = mx; carrier.ty = my;
          if (f) { f.tx = mx; f.ty = my - .8; }
          moveBall(mx, my - .6, 400);
          setTimeout(() => finish({ goal: false, shot: false, text: `${carrier.e!.name} foi desarmado.` }, 'Desarmado!', '#f06a5a'), 450);
        }
      } else {
        const sp = shotP(t.ax), nm = carrier.e!.name, as = lastPasser ? lastPasser.e!.name : null, gk = goalie();
        if (!opt.pen && R() < sp.block) {
          const f = field().sort((a, b) => segD(a, carrier, { x: t.ax, y: 0 }) - segD(b, carrier, { x: t.ax, y: 0 }))[0];
          moveBall(f.x, f.y, 300);
          setTimeout(() => finish({ goal: false, shot: true, onTarget: false, text: `chute de ${nm} bloqueado pela zaga.` }, 'Bloqueado!', '#f2b640'), 350);
        } else if (R() < sp.miss) {
          const side = t.ax >= 34 ? 1 : -1, post = R() < .25;
          moveBall(post ? 34 + side * 3.66 : t.ax + side * rn(2.5, 5), post ? 0 : -3.2, 420);
          setTimeout(() => finish({ goal: false, shot: true, onTarget: false, text: post ? `${nm} acertou a trave!` : `${nm} chutou pra fora.` }, post ? 'Na trave!' : 'Pra fora!', '#f2b640'), 460);
        } else if (R() < sp.save) {
          gk.tx = t.ax; gk.ty = .8; moveBall(t.ax, .9, 420);
          setTimeout(() => finish({ goal: false, shot: true, onTarget: true, text: `${gkE ? gkE.name : 'o goleiro'} defendeu o chute de ${nm}.` }, 'Defendeu!', '#9ec9ec'), 460);
        } else {
          gk.tx = 34 + (34 - t.ax) * .3; moveBall(t.ax, -1.8, 380);
          setTimeout(() => finish({ goal: true, shot: true, onTarget: true, scorer: nm, assist: as }, 'GOOOL!', '#e8c35f', 1700), 420);
        }
      }
    }
    // Entrada (ponteiro cobre mouse e toque)
    const toWorld = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / U, y: (e.clientY - b.top) / U + Y0 }; };
    cv.addEventListener('pointermove', e => { if (busy || done) return; const w = toWorld(e); hover = target(w.x, w.y); });
    cv.addEventListener('pointerdown', e => { if (busy || done) return; const w = toWorld(e); hover = target(w.x, w.y); });
    cv.addEventListener('pointerup', e => { if (busy || done) return; const w = toWorld(e); act(target(w.x, w.y)); });
    cv.addEventListener('pointerleave', () => { hover = null; });

    function draw() {
      if (!ov.isConnected) return;
      const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
      for (const o of [...mates, ...foes]) { o.x = lerp(o.x, o.tx, .14); o.y = lerp(o.y, o.ty, .14); }
      if (ball.t < 1) { ball.t = Math.min(1, ball.t + 16 / ball.dur); const k = 1 - Math.pow(1 - ball.t, 2); ball.x = lerp(ball.fx, ball.tx, k); ball.y = lerp(ball.fy, ball.ty, k); }
      else if (!done && !busy) { ball.x = carrier.x + .9; ball.y = carrier.y - 1; }
      // gramado
      for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#1a5536' : '#1d5d3a'; ctx.fillRect(0, SY(i * 5), Wd, 5 * U + 1); }
      ctx.fillStyle = '#10321f'; ctx.fillRect(0, 0, Wd, SY(0));
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(SX(0) + 1, SY(0), Wd - 2, Ht); ctx.strokeRect(SX(13.84), SY(0), SX(40.32), 16.5 * U); ctx.strokeRect(SX(24.84), SY(0), SX(18.32), 5.5 * U);
      ctx.beginPath(); ctx.arc(SX(34), SY(11), 9.15 * U, Math.asin(5.5 / 9.15), Math.PI - Math.asin(5.5 / 9.15)); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(SX(34), SY(11), .3 * U, 0, 7); ctx.fill();
      // gol
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(SX(30.34), SY(-2.4), 7.32 * U, 2.4 * U);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
      for (let x = 30.34; x < 37.7; x += .6) { ctx.beginPath(); ctx.moveTo(SX(x), SY(-2.4)); ctx.lineTo(SX(x), SY(0)); ctx.stroke(); }
      for (let y = -2.4; y < 0; y += .6) { ctx.beginPath(); ctx.moveTo(SX(30.34), SY(y)); ctx.lineTo(SX(37.66), SY(y)); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SX(30.34), SY(0)); ctx.lineTo(SX(30.34), SY(-2.4)); ctx.lineTo(SX(37.66), SY(-2.4)); ctx.lineTo(SX(37.66), SY(0)); ctx.stroke();
      // previsão
      if (hover && !busy && !done) {
        const p = probOf(hover), col = p >= .6 ? '#56d086' : p >= .35 ? '#f2b640' : '#f06a5a';
        const tx2 = hover.kind === 'pass' ? hover.m.x : hover.kind === 'drib' ? hover.x : hover.ax;
        const ty2 = hover.kind === 'pass' ? hover.m.y : hover.kind === 'drib' ? hover.y : -1.2;
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(hover.kind === 'drib' ? [6, 6] : []);
        ctx.beginPath(); ctx.moveTo(SX(carrier.x), SY(carrier.y)); ctx.lineTo(SX(tx2), SY(ty2)); ctx.stroke(); ctx.setLineDash([]);
        if (hover.kind === 'shot') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(SX(tx2), SY(ty2), .7 * U, 0, 7); ctx.fill(); }
        const lab = (hover.kind === 'pass' ? 'Passe ' : hover.kind === 'drib' ? 'Conduzir ' : 'Chute · gol ') + Math.round(p * 100) + '%';
        ctx.font = `700 ${Math.max(12, U * 1.9)}px Saira, sans-serif`;
        const tw = ctx.measureText(lab).width;
        const lx = clamp(SX(tx2) - tw / 2, 4, Wd - tw - 4), ly = clamp(SY(ty2) + (hover.kind === 'shot' ? U * 4.5 : -U * 3.2), 14, Ht - 6);
        ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(lx - 5, ly - U * 1.9, tw + 10, U * 2.6); ctx.fillStyle = col; ctx.fillText(lab, lx, ly);
      }
      // jogadores
      const rad = 1.7 * U;
      for (const f of foes) { ctx.fillStyle = f.gk ? '#1f1f1f' : B.c1; ctx.strokeStyle = f.gk ? '#e8e8e8' : B.c2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(SX(f.x), SY(f.y), rad, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.textAlign = 'center';
      for (const m of mates) {
        if (m === carrier) { ctx.strokeStyle = 'rgba(232,195,95,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(SX(m.x), SY(m.y), rad + U * (0.8 + .3 * Math.sin(performance.now() / 200)), 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#e8c35f'; ctx.strokeStyle = '#1a1204'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(SX(m.x), SY(m.y), rad, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a1204'; ctx.font = `900 ${Math.max(10, U * 1.5)}px 'Saira Extra Condensed', sans-serif`;
        ctx.fillText(String(m.e!.P.ovr || Math.round(m.e!.base)), SX(m.x), SY(m.y) + U * .5);
        ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.max(10, U * 1.35)}px Saira, sans-serif`;
        ctx.fillText(m.e!.name, SX(m.x), SY(m.y) + rad + U * 1.5);
      }
      ctx.textAlign = 'left';
      // bola
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(SX(ball.x), SY(ball.y), .62 * U, 0, 7); ctx.fill(); ctx.stroke();
      const ae = ov.querySelector('#moActs');
      if (ae) ae.textContent = opt.pen ? 'Cobrança' : `${actions} ações`;
      requestAnimationFrame(draw);
    }
    if (!opt.pen) { react(); mates.forEach(m => { m.x = m.tx; m.y = m.ty; }); foes.forEach(f => { f.x = f.tx; f.y = f.ty; }); }
    draw();
  });
}
