// Lance jogável em canvas 2D (visão de cima) — alternativa leve ao 3D. A lógica vem de LanceScene.
import { GOAL, analyzeGesture, type Pt } from '../engine/lance';
import { bindShotBar, shotBarHTML } from './shotPicker';
import { LanceScene, TITLES, type BallKey, type Plan, type Target } from '../engine/lanceScene';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { clamp } from '../engine/rng';
import { endSound, planSound } from './sfx';
import { awayKit } from '../engine/kits';

export const HELP = {
  escanteio: '<b>Escanteio:</b> toque num companheiro na área para cruzar (bola alta). Depois, <b>desenhe o traço</b> para cabecear ou pegar de primeira. Na cobrança não tem impedimento.',
  lateral: '<b>Lateral:</b> toque num companheiro perto para cobrar com a mão. Depois o lance segue normal. Cuidado com o <b>impedimento</b> (linha amarela).',
  ataque: '<b>1 toque</b> no companheiro: passe rasteiro · <b>2 toques</b>: passe alto · toque no <b>campo</b>: conduzir · toque no <b>seu jogador</b>: finta (drible) · <b>traço até o gol</b>: chute (tipo de chute: escolha embaixo do campo) ou toque dentro do gol · traço para o <b>espaço</b>: lançamento',
  penalti: '<b>Desenhe um traço</b> até o canto (a velocidade dá a força) ou toque dentro do gol.',
  falta: '<b>Desenhe o traço</b> da bola até o gol: a direção mira, a <b>curva</b> dá o efeito e a <b>velocidade</b> dá a força.',
};
export const probColor = (p: number): string => (p >= .6 ? '#56d086' : p >= .35 ? '#f2b640' : '#f06a5a');

export function runMoment2D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const sc = new LanceScene(M, req), B = M.B, kind = req.kind, fk = kind === 'falta', pen = kind === 'penalti';
    const bKit = awayKit([M.A.c1, M.A.c2], [M.B.c1, M.B.c2]);
    const ov = document.createElement('div');
    ov.className = 'moment';
    ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>${sc.title}</b><span class="acts" id="moActs"></span></div>
      <canvas id="moCv"></canvas>
      ${!fk && !pen ? shotBarHTML() : ''}
      <div class="mo-help" id="moHelp">${HELP[kind === 'contra' || kind === 'goleiro' ? 'ataque' : kind as keyof typeof HELP]}</div>
      <div class="mo-msg" id="moMsg"></div>`;
    document.body.appendChild(ov);
    bindShotBar(ov, sc, d => { ov.querySelector<HTMLElement>('#moHelp')!.innerHTML = d; });
    const cv = ov.querySelector<HTMLCanvasElement>('#moCv')!, ctx = cv.getContext('2d')!, msgEl = ov.querySelector<HTMLElement>('#moMsg')!;
    const Wd = Math.min(ov.clientWidth - 32, 460), U = Wd / 68, Y0 = -4, Hu = 48, Ht = Hu * U, dpr = window.devicePixelRatio || 1;
    cv.style.width = Wd + 'px'; cv.style.height = Ht + 'px'; cv.width = Wd * dpr; cv.height = Ht * dpr; ctx.scale(dpr, dpr);
    const SX = (x: number) => x * U, SY = (y: number) => (y - Y0) * U;

    let ball: BallKey = sc.ballAt, anim: { plan: Plan; t0: number } | null = null, hover: Target | null = null, finished = false;
    function flash(text: string, color: string) { msgEl.textContent = text; msgEl.style.color = color; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); }
    function run(plan: Plan) {
      planSound(plan); anim = { plan, t0: performance.now() };
      if (plan.say) flash(plan.say, plan.ok ? '#e8c35f' : '#f06a5a'); hover = null;
      if (plan.gk) { const g = sc.goalie(); g.tx = plan.gk.x; g.ty = plan.gk.y; }
    }
    function endAnim(plan: Plan) {
      anim = null;
      plan.commit();
      if (plan.end && !finished) {
        finished = true; flash(plan.end.text, plan.end.color); endSound(plan.end);
        setTimeout(() => { ov.remove(); resolve(plan.end!.res); }, plan.end.goal ? 1700 : 1400);
      }
    }
    const busy = () => !!anim || finished;

    const toWorld = (e: { clientX: number; clientY: number }): Pt => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / U, y: (e.clientY - b.top) / U + Y0 }; };
    // Mesmos controles do 3D: 1 toque = passe rasteiro, 2 toques = passe alto, toque no campo = conduzir,
    // traço até o gol = chute (velocidade = força, curva = efeito), traço para o espaço = lançamento. Toque dentro do gol também chuta.
    interface Stroke { pts: Pt[]; scr: { x: number; y: number; t: number }[]; drag: boolean }
    let stroke: Stroke | null = null;
    let pendingTap: { m: Target & { kind: 'pass' }; t: number; timer: ReturnType<typeof setTimeout> } | null = null;
    const cancelTap = () => { if (pendingTap) { clearTimeout(pendingTap.timer); pendingTap = null; } };
    const mateAt = (w: Pt) => { let best = null as (Target & { kind: 'pass' }) | null, bd = 3.4; for (const m of sc.mates) { if (m === sc.carrier) continue; const d = Math.hypot(m.x - w.x, m.y - w.y); if (d < bd) { bd = d; best = { kind: 'pass', m }; } } return best; };
    function strokePower(st: Stroke): number {
      let len = 0;
      for (let i = 1; i < st.scr.length; i++) len += Math.hypot(st.scr[i].x - st.scr[i - 1].x, st.scr[i].y - st.scr[i - 1].y);
      const ms = Math.max(60, st.scr[st.scr.length - 1].t - st.scr[0].t);
      return clamp((len / Ht / (ms / 1000) - .5) / 3.6, .12, 1);
    }
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      if (busy()) return;
      cv.setPointerCapture(e.pointerId);
      stroke = { pts: [toWorld(e)], scr: [{ x: e.clientX, y: e.clientY, t: performance.now() }], drag: false };
    });
    cv.addEventListener('pointermove', e => {
      if (busy()) return;
      const w = toWorld(e);
      if (stroke) {
        stroke.pts.push(w); stroke.scr.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (!stroke.drag && Math.hypot(e.clientX - stroke.scr[0].x, e.clientY - stroke.scr[0].y) > 12) { stroke.drag = true; cancelTap(); hover = null; }
      } else if (e.pointerType === 'mouse' && !fk) hover = mateAt(w) ?? sc.target(w.x, w.y);
    });
    cv.addEventListener('pointerup', e => {
      if (busy() || !stroke) { stroke = null; return; }
      const st = stroke; stroke = null;
      const w = toWorld(e);
      st.pts.push(w); st.scr.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (st.drag) {
        const g = analyzeGesture(st.pts, 1);
        if (!g) return;
        const power = strokePower(st);
        if (fk) { const pv = sc.fkFromGesture({ ...g, power }); if (pv) run(sc.performFk(pv.shot)); return; }
        const shot = sc.shotFromGesture({ ...g, power });
        if (shot) { run(sc.perform(shot)); return; }
        if (pen) return;
        const t = sc.throughTarget(w.x, w.y);
        if (t && t.kind !== 'shot') run(sc.perform(t));
        return;
      }
      if (fk) return;
      const pm = pen ? null : mateAt(w);
      if (pm) {
        if (pendingTap && pendingTap.m.m === pm.m && performance.now() - pendingTap.t < 340) { cancelTap(); run(sc.perform({ ...pm, alto: true })); return; }
        cancelTap(); hover = pm;
        pendingTap = { m: pm, t: performance.now(), timer: setTimeout(() => { pendingTap = null; if (!busy()) run(sc.perform(pm)); }, 280) };
        return;
      }
      cancelTap();
      const t = sc.target(w.x, w.y);
      if (t) run(sc.perform(t));
    });
    cv.addEventListener('pointerleave', () => { if (!pendingTap) hover = null; });
    const trail = () => {
      if (!stroke?.drag || stroke.scr.length < 2) return;
      const b = cv.getBoundingClientRect();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [lw, c] of [[10, 'rgba(232,195,95,.3)'], [4, '#fff']] as const) {
        ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath();
        stroke.scr.forEach((p, i) => (i ? ctx.lineTo(p.x - b.left, p.y - b.top) : ctx.moveTo(p.x - b.left, p.y - b.top)));
        ctx.stroke();
      }
    };

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
      // Linha de impedimento (penúltimo defensor)
      if (!fk && !pen && !sc.setPiece && !finished) {
        const ly = SY(sc.offsideLine());
        ctx.strokeStyle = 'rgba(242,182,64,.75)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(Wd, ly); ctx.stroke(); ctx.setLineDash([]);
      }
      for (let y = -2.4; y < 0; y += .6) { ctx.beginPath(); ctx.moveTo(SX(GOAL.left), SY(y)); ctx.lineTo(SX(GOAL.right), SY(y)); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SX(GOAL.left), SY(0)); ctx.lineTo(SX(GOAL.left), SY(-2.4)); ctx.lineTo(SX(GOAL.right), SY(-2.4)); ctx.lineTo(SX(GOAL.right), SY(0)); ctx.stroke();
      const c = sc.carrier;
      if (hover && !busy()) {
        const p = sc.prob(hover), col = probColor(p);
        const tx2 = hover.kind === 'pass' ? hover.m.x : hover.kind === 'drib' || hover.kind === 'lanc' ? hover.x : hover.kind === 'finta' ? c.x : hover.ax;
        const ty2 = hover.kind === 'pass' ? hover.m.y : hover.kind === 'drib' || hover.kind === 'lanc' ? hover.y : hover.kind === 'finta' ? c.y - 3 : -1.2;
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(hover.kind === 'drib' ? [6, 6] : []);
        ctx.beginPath(); ctx.moveTo(SX(c.x), SY(c.y)); ctx.lineTo(SX(tx2), SY(ty2)); ctx.stroke(); ctx.setLineDash([]);
        if (hover.kind === 'shot') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(SX(tx2), SY(ty2), .7 * U, 0, 7); ctx.fill(); }
        label((hover.kind === 'pass' ? 'Passe ' : hover.kind === 'drib' ? 'Conduzir ' : hover.kind === 'finta' ? 'Finta ' : hover.kind === 'lanc' ? 'Lançamento ' : 'Chute · gol ') + Math.round(p * 100) + '%', SX(tx2), SY(ty2) + (hover.kind === 'shot' ? U * 4.5 : -U * 3.2), col);
      }
      const rad = 1.7 * U;
      for (const f of sc.foes) { ctx.fillStyle = f.gk ? '#1f1f1f' : bKit[0]; ctx.strokeStyle = f.gk ? '#e8e8e8' : bKit[1]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(SX(f.x), SY(f.y), rad, 0, 7); ctx.fill(); ctx.stroke(); }
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
      trail();
      const ae = ov.querySelector('#moActs');
      if (ae) ae.textContent = pen ? 'Cobrança' : fk ? `Cobrador: ${c.e!.name}` : `${sc.actions} ações`;
      requestAnimationFrame(draw);
    }
    draw();
  });
}
