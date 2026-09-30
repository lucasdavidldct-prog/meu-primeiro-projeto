// Lance de goleiro no modo leve (2D): 3 botões (alto esquerdo, meio, alto direito). O batedor espera você escolher.
import { cantoDoGesto, keeperResolve, pickCanto, pistaCanto, tempoEscolha, type Canto } from '../engine/keeper';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { R } from '../engine/rng';
import { esc } from './dom';
import { haptic, sfx } from './sfx';

export function runKeeper2D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const pen = !!req.pen, sE = req.taker!, gk = M.A.xi.find(e => e.pos === 'GOL' && !e.red);
    const shot = pickCanto(sE.P, pen, R), tell = pistaCanto(shot, sE.P, R, gk?.P, pen);
    const ov = document.createElement('div');
    ov.className = 'moment';
    ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>${pen ? 'Pênalti contra!' : 'Defenda!'}</b><span class="acts">${esc(sE.name)}</span></div>
      <div class="k2d"><div class="k2d-goal k2d-3">${([0, 1, 2] as Canto[]).map(c => `<button class="k2d-z" data-c="${c}">${['⬉ Alto esq.', '● Meio', 'Alto dir. ⬈'][c]}</button>`).join('')}<i class="k2d-ball"></i></div>
      <div class="k2d-shooter" style="--t:${tell}">🏃 ${esc(sE.name)}</div></div>
      <div class="mo-help">Toque onde vai defender (ou arraste para o lado). Acertou, defendeu. Repare para que lado o batedor corre.</div>
      <div class="mo-msg" id="k2Msg"></div>`;
    document.body.appendChild(ov);
    const ball = ov.querySelector<HTMLElement>('.k2d-ball')!, msg = ov.querySelector<HTMLElement>('#k2Msg')!;
    let dive: Canto | null = null;
    const go = () => {
      ball.style.left = `${[16.6, 50, 83.4][shot]}%`; ball.style.top = shot === 1 ? '55%' : '22%'; ball.classList.add('fly');
      setTimeout(() => {
        const r = keeperResolve(shot, dive, gk?.P, sE.P, pen, R), gol = r === 'gol';
        msg.textContent = gol ? 'GOL…' : r === 'fora' ? 'PRA FORA!' : r === 'pe' ? 'DEFENDEU COM O PÉ!' : 'DEFENDEU!';
        msg.style.color = gol ? '#f06a5a' : '#9ec9ec'; msg.classList.add('show');
        if (gol) sfx.groan(); else { sfx.ooh(); haptic('forte'); }
        setTimeout(() => { ov.remove(); resolve(gol ? { goal: true, shot: true, onTarget: true } : { goal: false, shot: true, onTarget: r !== 'fora' }); }, 1400);
      }, 700);
    };
    const timer = setTimeout(() => { if (dive === null) { dive = 1; go(); } }, tempoEscolha(gk?.P, pen));
    const pick = (c: Canto) => {
      if (dive !== null) return;
      dive = c; clearTimeout(timer); haptic('leve');
      ov.querySelector(`.k2d-z[data-c="${c}"]`)?.classList.add('on');
      setTimeout(go, 500);
    };
    ov.querySelectorAll<HTMLButtonElement>('.k2d-z').forEach(b => b.addEventListener('click', () => pick(+b.dataset.c! as Canto)));
    let p0: { x: number; y: number } | null = null;
    const g = ov.querySelector<HTMLElement>('.k2d')!;
    g.addEventListener('pointerdown', e => { p0 = { x: e.clientX, y: e.clientY }; });
    g.addEventListener('pointerup', e => { if (!p0) return; const dx = e.clientX - p0.x, dy = e.clientY - p0.y; p0 = null; if (Math.hypot(dx, dy) > 30) pick(cantoDoGesto(dx, dy)); });
  });
}
