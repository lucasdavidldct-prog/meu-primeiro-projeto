// Lance de goleiro no modo leve (2D): o gol dividido em 6 zonas; toque na zona para pular antes da bola chegar.
import { pickShotZone, saveChance, tellOf, type Zone } from '../engine/keeper';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { R } from '../engine/rng';
import { esc } from './dom';
import { haptic, sfx } from './sfx';

export function runKeeper2D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const pen = !!req.pen, sE = req.taker!, gk = M.A.xi.find(e => e.pos === 'GOL' && !e.red);
    const shot = pickShotZone(sE.P, pen, R), tell = tellOf(shot, sE.P, R);
    const ov = document.createElement('div');
    ov.className = 'moment';
    ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>${pen ? 'Pênalti contra!' : 'Defenda!'}</b><span class="acts">${esc(sE.name)}</span></div>
      <div class="k2d"><div class="k2d-goal">${[1, 0].map(row => [0, 1, 2].map(col => `<button class="k2d-z" data-c="${col}" data-r="${row}"></button>`).join('')).join('')}<i class="k2d-ball"></i></div>
      <div class="k2d-shooter" style="--t:${tell}">🏃 ${esc(sE.name)}</div></div>
      <div class="mo-help">Toque na parte do gol para onde vai pular (de cima = bola alta) antes da bola chegar. Repare para que lado o batedor corre.</div>
      <div class="mo-msg" id="k2Msg"></div>`;
    document.body.appendChild(ov);
    const ball = ov.querySelector<HTMLElement>('.k2d-ball')!, msg = ov.querySelector<HTMLElement>('#k2Msg')!;
    let dive: Zone | null = null, locked = false;
    ov.querySelectorAll<HTMLButtonElement>('.k2d-z').forEach(b => b.addEventListener('click', () => {
      if (locked) return;
      locked = true; dive = { col: +b.dataset.c! as 0 | 1 | 2, row: +b.dataset.r! as 0 | 1 };
      b.classList.add('on'); haptic('leve');
    }));
    // Corrida (1,3 s) e chute (0,7 s)
    setTimeout(() => {
      ball.style.left = `${[16.6, 50, 83.4][shot.col]}%`; ball.style.top = `${shot.row ? 25 : 75}%`; ball.classList.add('fly');
      setTimeout(() => { locked = true; }, 560);
      setTimeout(() => {
        const saved = R() < saveChance(shot, dive, gk?.P, sE.P, pen);
        msg.textContent = saved ? 'DEFENDEU!' : 'GOL…'; msg.style.color = saved ? '#9ec9ec' : '#f06a5a'; msg.classList.add('show');
        if (saved) { sfx.ooh(); haptic('forte'); } else sfx.groan();
        setTimeout(() => { ov.remove(); resolve(saved ? { goal: false, shot: true, onTarget: true } : { goal: true, shot: true, onTarget: true }); }, 1400);
      }, 700);
    }, 1300);
  });
}
