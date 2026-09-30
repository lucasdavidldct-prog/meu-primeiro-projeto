import { PACKS } from '../../engine/packs';
import { today } from '../../engine/state';
import { app } from '../ctx';
import { fmt } from '../dom';
import { viewMarket } from '../market';

export function viewStore(): string {
  const S = app.S, free = S.lastFree !== today();
  const tabs = S.career?.mercado ? `<div class="chips" style="margin-bottom:8px"><button class="chip" data-act="storeTab" data-t="pacotes" aria-pressed="${app.storeTab === 'pacotes'}">Pacotes</button><button class="chip" data-act="storeTab" data-t="mercado" aria-pressed="${app.storeTab === 'mercado'}">Mercado (leilão)</button></div>` : '';
  if (S.career?.mercado && app.storeTab === 'mercado') return `<h2>Mercado de leilão</h2>${tabs}<p class="muted small" style="margin-top:-2px">Busque pelo nome, dê lances contra a CPU ou use o Compre já. Lance nos últimos 15 s prorroga o leilão.</p>${viewMarket()}`;
  return `<h2>Loja de pacotes</h2>${tabs}
  <p class="muted small" style="margin-top:-4px">Ganhe moedas jogando partidas da temporada. Cartas repetidas podem ser vendidas no Clube.</p>
  <div class="packs">
    <button class="pack" data-act="free" ${free ? '' : 'disabled'} style="${free ? '' : 'opacity:.5'}"><div class="foil p-free"><b>Grátis<br>do dia</b></div><div class="price">${free ? 'Resgatar' : 'Volte amanhã'}</div><p>Um pacote prata por dia, de graça.</p></button>
    ${PACKS.map(p => `<button class="pack" data-act="buy" data-p="${p.id}" ${S.coins < p.price ? 'aria-disabled="true"' : ''}>
      <div class="foil ${p.cls}"><b>${p.n}</b></div>
      <div class="price"><i class="coin"></i>${fmt(p.price)}</div><p>${p.d}</p></button>`).join('')}
  </div>`;
}
