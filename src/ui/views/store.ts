import { PACKS } from '../../engine/packs';
import { today } from '../../engine/state';
import { app } from '../ctx';
import { fmt } from '../dom';

export function viewStore(): string {
  const S = app.S, free = S.lastFree !== today();
  return `<h2>Loja de pacotes</h2>
  <p class="muted small" style="margin-top:-4px">Ganhe moedas jogando partidas da temporada. Cartas repetidas podem ser vendidas no Clube.</p>
  <div class="packs">
    <button class="pack" data-act="free" ${free ? '' : 'disabled'} style="${free ? '' : 'opacity:.5'}"><div class="foil p-free"><b>Grátis<br>do dia</b></div><div class="price">${free ? 'Resgatar' : 'Volte amanhã'}</div><p>Um pacote prata por dia, de graça.</p></button>
    ${PACKS.map(p => `<button class="pack" data-act="buy" data-p="${p.id}" ${S.coins < p.price ? 'aria-disabled="true"' : ''}>
      <div class="foil ${p.cls}"><b>${p.n}</b></div>
      <div class="price"><i class="coin"></i>${fmt(p.price)}</div><p>${p.d}</p></button>`).join('')}
  </div>`;
}
