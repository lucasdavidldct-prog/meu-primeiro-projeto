// Lance de defesa no modo leve (sem 3D): o mesmo motor, com botões. A cada rodada você escolhe o defensor e a ação.
import { DEF_N, DefesaScene } from '../engine/defesa';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { esc } from './dom';
import { psChips } from './choice';
import { haptic, sfx } from './sfx';

export function runDefense2D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const sc = new DefesaScene(M, req.taker!, req.creator);
    const ov = document.createElement('div');
    ov.className = 'moment';
    document.body.appendChild(ov);
    let nota = '';
    const draw = () => {
      const c = sc.carrier, it = sc.intencao, D = Math.round(Math.hypot(c.x - 34, c.y));
      const ops = sc.campo().flatMap(d => sc.opcoes(d));
      ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>Defenda com a zaga!</b><span class="acts">Rodada ${Math.min(3, 4 - sc.actions)}/3</span></div>
        <div class="def2d"><p><b>${esc(c.e?.name ?? '')}</b> está com a bola a <b>${D} m</b> do seu gol.</p>
        ${sc.lida ? `<p class="k3-read">👁️ Antecipação: ele vai <b>${it.a === 'chute' ? 'chutar' : it.a === 'drible' ? 'driblar' : `passar para ${esc(it.para?.e?.name ?? '')}`}</b>${sc.resposta()?.e ? ` · use <b>${esc(sc.resposta()!.e!.name)}</b>` : ''}</p>` : ''}
        ${nota ? `<p class="small">${nota}</p>` : ''}
        <div class="ch-ops">${ops.map((o, i) => `<button data-i="${i}"><b>${esc(o.d.e?.name ?? '')}: ${DEF_N[o.acao]}</b><span class="ch-p">${Math.round(o.p * 100)}%</span><small>${esc(o.dica)}</small>${o.ps.length ? `<span class="ch-ps">${psChips(o.ps)}</span>` : ''}</button>`).join('') || '<p>Ninguém chega na jogada.</p>'}</div></div>
        <div class="mo-msg" id="d2Msg"></div>`;
      ov.querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b => b.addEventListener('click', () => {
        const p = sc.jogar(ops[+b.dataset.i!]);
        haptic('leve'); p.commit();
        if (p.end) {
          const m = ov.querySelector<HTMLElement>('#d2Msg')!;
          m.textContent = p.end.text; m.style.color = p.end.color; m.classList.add('show');
          if (p.end.goal) sfx.groan(); else sfx.ooh();
          setTimeout(() => { ov.remove(); resolve(p.end!.res); }, 1500);
          ov.querySelectorAll('button').forEach(x => { x.disabled = true; });
          return;
        }
        nota = `${p.say} ${psChips(p.ps)}`;
        draw();
      }));
    };
    draw();
  });
}
