// Lance jogável em canvas 2D (visão de cima) — alternativa leve ao 3D. A lógica vem de LanceScene.
import { GOAL, analyzeGesture, type Pt } from '../engine/lance';
import { LanceScene, TITLES, type BallKey, type Plan, type Target } from '../engine/lanceScene';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { clamp } from '../engine/rng';

export const HELP = {
  ataque: 'Toque num <b>companheiro</b> para passar · dentro do <b>gol</b> para chutar · no <b>campo</b> para conduzir. Arraste para ver a chance de dar certo e solte para executar.',
  penalti: 'Toque dentro do gol para escolher onde bater. Cantos são mais difíceis de defender e mais fáceis de errar.',
  falta: 'Arraste da bola em direção ao gol: a <b>direção</b> mira, o <b>comprimento</b> dá a força e a <b>curva do traço</b> dá o efeito. Passe por cima ou em volta da barreira.',
};
export const probColor = (p: number): string => (p >= .6 ? '#56d086' : p >= .35 ? '#f2b640' : '#f06a5a');

export function runMoment2D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const sc = new LanceScene(M, req), B = M.B, kind = req.kind, fk = kind === 'falta', pen = kind === 'penalti';
    const ov = document.createElement('div');
    ov.className = 'moment';
    ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>${TITLES[kind]}</b><span class="acts" id="moActs"></span></div>
      <canvas id="moCv"></canvas>
      <div class="mo-help">${HELP[kind === 'contra' ? 'ataque' : kind]}</div>
      <div class="mo-msg" id="moMsg"></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector<HTMLCanvasElement>('#moCv')!, ctx = cv.getContext('2d')!, msgEl = ov.querySelector<HTMLElement>('#moMsg')!;
    const Wd = Math.min(ov.clientWidth - 32, 460), U = Wd / 68, Y0 = -4, Hu = 48, Ht = Hu * U, dpr = window.devicePixelRatio || 1;
    cv.style.width = Wd + 'px'; cv.style.height = Ht + 'px'; cv.width = Wd * dpr; cv.height = Ht * dpr; ctx.scale(dpr, dpr);
    const SX = (x: number) => x * U, SY = (y: number) => (y - Y0) * U;

    let ball: BallKey = sc.ballAt, anim: { plan: Plan; t0: number } | null = null, hover: Target | null = null, finished = false;
    let gesture: Pt[] | null = null;
    function flash(text: string, color: string) { msgEl.textContent = text; msgEl.style.color = color; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); }
    function run(plan: Plan) {
      anim = { plan, t0: performance.now() }; hover = null;
      if (plan.gk) { const g = sc.goalie(); g.tx = plan.gk.x; g.ty = plan.gk.y; }
    }
    function endAnim(plan: Plan) {
      anim = null;
      plan.commit();
      if (plan.end && !finished) {
        finished = true; flash(plan.end.text, plan.end.color);
        setTimeout(() => { ov.remove(); resolve(plan.end!.res); }, plan.end.goal ? 1700 : 1400);
      }
    }
    const busy = () => !!anim || finished;

    const toWorld = (e: PointerEvent): Pt => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / U, y: (e.clientY - b.top) / U + Y0 }; };
    cv.addEventListener('pointerdown', e => {
      if (busy()) return;
      const w = toWorld(e);
      if (fk) { cv.setPointerCapture(e.pointerId); gesture = [w]; return; }
      hover = sc.target(w.x, w.y);
    });
    cv.addEventListener('pointermove', e => {
      if (busy()) return;
      const w = toWorld(e);
      if (fk) { if (gesture) gesture.push(w); return; }
      hover = sc.target(w.x, w.y);
    });
    cv.addEventListener('pointerup', e => {
      if (busy()) return;
      const w = toWorld(e);
      if (fk) {
        if (!gesture) return;
        gesture.push(w);
        const g = analyzeGesture(gesture, 16), pv = g && sc.fkFromGesture(g);
        gesture = null;
        if (pv) run(sc.performFk(pv.shot));
        return;
      }
      const t = sc.target(w.x, w.y);
      if (t) run(sc.perform(t));
    });
    cv.addEventListener('pointerleave', () => { hover = null; });

    function label(text: string, x: number, y: number, col: string) {
      ctx.font = `700 ${Math.max(12, U * 1.9)}px Saira, sans-serif`;
      const tw = ctx.measureText(text).width;
      const lx = clamp(x - tw / 2, 4, Wd - tw - 4), ly = clamp(y, 14, Ht - 6);
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(lx - 5, ly - U * 1.9, tw + 10, U * 2.6); ctx.fillStyle = col; ctx.fillText(text, lx, ly);
    }
    function draw() {
      if (!ov.isConnected) return;
      const now = performance.now();
      for (const o of [...sc.mates, ...sc.foes]) { o.x += (o.tx - o.x) * .14; o.y += (o.ty - o.y) * .14; }
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / anim.plan.dur), keys = anim.plan.ball, f = k * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(f)), u = f - i;
        ball = { x: keys[i].x + (keys[i + 1].x - keys[i].x) * u, y: keys[i].y + (keys[i + 1].y - keys[i].y) * u, h: keys[i].h + (keys[i + 1].h - keys[i].h) * u };
        if (k >= 1) endAnim(anim.plan);
      } else if (!finished && !fk) ball = sc.ballAt;
      // gramado
      for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#1a5536' : '#1d5d3a'; ctx.fillRect(0, SY(i * 5), Wd, 5 * U + 1); }
      ctx.fillStyle = '#10321f'; ctx.fillRect(0, 0, Wd, SY(0));
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(SX(0) + 1, SY(0), Wd - 2, Ht); ctx.strokeRect(SX(13.84), SY(0), SX(40.32), 16.5 * U); ctx.strokeRect(SX(24.84), SY(0), SX(18.32), 5.5 * U);
      ctx.beginPath(); ctx.arc(SX(34), SY(11), 9.15 * U, Math.asin(5.5 / 9.15), Math.PI - Math.asin(5.5 / 9.15)); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(SX(34), SY(11), .3 * U, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(SX(GOAL.left), SY(-2.4), 7.32 * U, 2.4 * U);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
      for (let x = GOAL.left; x < 37.7; x += .6) { ctx.beginPath(); ctx.moveTo(SX(x), SY(-2.4)); ctx.lineTo(SX(x), SY(0)); ctx.stroke(); }
      for (let y = -2.4; y < 0; y += .6) { ctx.beginPath(); ctx.moveTo(SX(GOAL.left), SY(y)); ctx.lineTo(SX(GOAL.right), SY(y)); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SX(GOAL.left), SY(0)); ctx.lineTo(SX(GOAL.left), SY(-2.4)); ctx.lineTo(SX(GOAL.right), SY(-2.4)); ctx.lineTo(SX(GOAL.right), SY(0)); ctx.stroke();
      const c = sc.carrier;
      if (hover && !busy()) {
        const p = sc.prob(hover), col = probColor(p);
        const tx2 = hover.kind === 'pass' ? hover.m.x : hover.kind === 'drib' ? hover.x : hover.ax;
        const ty2 = hover.kind === 'pass' ? hover.m.y : hover.kind === 'drib' ? hover.y : -1.2;
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(hover.kind === 'drib' ? [6, 6] : []);
        ctx.beginPath(); ctx.moveTo(SX(c.x), SY(c.y)); ctx.lineTo(SX(tx2), SY(ty2)); ctx.stroke(); ctx.setLineDash([]);
        if (hover.kind === 'shot') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(SX(tx2), SY(ty2), .7 * U, 0, 7); ctx.fill(); }
        label((hover.kind === 'pass' ? 'Passe ' : hover.kind === 'drib' ? 'Conduzir ' : 'Chute · gol ') + Math.round(p * 100) + '%', SX(tx2), SY(ty2) + (hover.kind === 'shot' ? U * 4.5 : -U * 3.2), col);
      }
      if (fk && gesture && !busy()) {
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath();
        gesture.forEach((p, i) => (i ? ctx.lineTo(SX(p.x), SY(p.y)) : ctx.moveTo(SX(p.x), SY(p.y)))); ctx.stroke();
        const g = analyzeGesture(gesture, 16), pv = g && sc.fkFromGesture(g);
        if (pv) {
          const path = sc.fkPath(pv.shot), col = probColor(pv.goal * 1.6), end = path[path.length - 1];
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.beginPath();
          path.forEach((p, i) => (i ? ctx.lineTo(SX(p.x), SY(p.y)) : ctx.moveTo(SX(p.x), SY(p.y)))); ctx.stroke(); ctx.setLineDash([]);
          const pw = pv.shot.power;
          ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(8, Ht - 18, 120, 10);
          ctx.fillStyle = pw > .8 ? '#f06a5a' : pw > .42 ? '#56d086' : '#f2b640'; ctx.fillRect(8, Ht - 18, 120 * pw, 10);
          label(`Falta · gol ${Math.round(pv.goal * 100)}%`, SX(end.x), SY(0) + U * 4.5, col);
        }
      }
      const rad = 1.7 * U;
      for (const f of sc.foes) { ctx.fillStyle = f.gk ? '#1f1f1f' : B.c1; ctx.strokeStyle = f.gk ? '#e8e8e8' : B.c2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(SX(f.x), SY(f.y), rad, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.textAlign = 'center';
      for (const m of sc.mates) {
        if (m === c) { ctx.strokeStyle = 'rgba(232,195,95,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(SX(m.x), SY(m.y), rad + U * (0.8 + .3 * Math.sin(now / 200)), 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#e8c35f'; ctx.strokeStyle = '#1a1204'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(SX(m.x), SY(m.y), rad, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a1204'; ctx.font = `900 ${Math.max(10, U * 1.5)}px 'Saira Extra Condensed', sans-serif`;
        ctx.fillText(String(m.e!.P.ovr || Math.round(m.e!.base)), SX(m.x), SY(m.y) + U * .5);
        ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.max(10, U * 1.35)}px Saira, sans-serif`;
        ctx.fillText(m.e!.name, SX(m.x), SY(m.y) + rad + U * 1.5);
      }
      ctx.textAlign = 'left';
      const br = .62 * U * (1 + ball.h * .12);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(SX(ball.x), SY(ball.y), .6 * U, .4 * U, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(SX(ball.x), SY(ball.y) - ball.h * U * .5, br, 0, 7); ctx.fill(); ctx.stroke();
      const ae = ov.querySelector('#moActs');
      if (ae) ae.textContent = pen ? 'Cobrança' : fk ? `Cobrador: ${c.e!.name}` : `${sc.actions} ações`;
      requestAnimationFrame(draw);
    }
    draw();
  });
}
