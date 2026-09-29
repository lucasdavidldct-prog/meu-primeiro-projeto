import { inPos } from '../engine/cards';
import { calcChem, effOvr } from '../engine/chemistry';
import { slotsOf } from '../engine/positions';
import { allCards, cardByUid, xiCards } from '../engine/state';
import type { BasePlayer } from '../engine/types';
import { clubOf, NATIONS } from '../engine/world';
import { cardHTML, pips } from './card';
import { app, render } from './ctx';
import { esc, openSheet } from './dom';

/** Lista de cartas para uma vaga, ordenada por encaixe e overall efetivo, com o efeito na química. */
export function openPicker(kind: 'xi' | 'bench', i: number): void {
  const S = app.S;
  app.sel = { kind, i }; render();
  const form = S.squad.form, slots = slotsOf(form), xi = xiCards(S);
  const cur = kind === 'xi' ? xi[i] : (S.squad.bench[i] ? cardByUid(S, S.squad.bench[i]) : null);
  const pos = kind === 'xi' ? slots[i].p : null;
  const baseChem = calcChem(xi, form).total;
  const xiU = new Set(S.squad.xi), benchU = new Set(S.squad.bench);
  let rows = allCards(S).filter(P => !cur || P.u !== cur.u).map(P => {
    let chemAfter: number | null = null, myChem = 0;
    if (kind === 'xi') {
      const t: (BasePlayer | null)[] = xi.slice();
      const j = S.squad.xi.indexOf(P.u);
      if (j >= 0) t[j] = cur || null;
      t[i] = P;
      const c = calcChem(t, form);
      chemAfter = c.total; myChem = c.per[i];
    }
    return { P, chemAfter, myChem, where: xiU.has(P.u) ? 'Titular' : benchU.has(P.u) ? 'Reserva' : 'Clube', fit: pos ? (P.pos === pos ? 2 : inPos(P, pos) ? 1 : 0) : 0 };
  });
  rows.sort((a, b) => b.fit - a.fit || (pos ? effOvr(b.P, pos, b.myChem) : b.P.ovr) - (pos ? effOvr(a.P, pos, a.myChem) : a.P.ovr));
  rows = rows.slice(0, 80);
  const title = kind === 'xi' ? `Escolher ${pos}` : 'Escolher reserva';
  openSheet(`<h2>${title}</h2>${cur ? `<p class="small muted" style="margin-top:-4px">Atual: <b>${esc(cur.name)}</b> (${cur.ovr} · ${cur.pos})</p>` : ''}
   ${kind === 'bench' && cur ? `<button class="btn block" style="margin-bottom:10px" data-act="benchClear" data-i="${i}">Deixar vaga livre</button>` : ''}
   <div class="plist">${rows.map(r => {
     const P = r.P, d = r.chemAfter != null ? r.chemAfter - baseChem : 0;
     return `<button class="prow" data-act="pickP" data-u="${P.u}">${cardHTML(P)}<div style="min-width:0"><div class="nm">${esc(P.name)}</div><div class="meta">${P.pos}${P.alt.length ? ' / ' + P.alt.join(' / ') : ''} · ${NATIONS[P.nat].n} · ${esc(clubOf(P).n)}</div><div class="meta">${r.where}${kind === 'xi' && pos && !inPos(P, pos) ? ' · <span class="down">fora de posição</span>' : ''}</div></div>
     <div class="right"><b>${P.ovr}</b>${kind === 'xi' ? `<div>${pips(r.myChem)}</div><div class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">Quím. ${d > 0 ? '+' : ''}${d}</div>` : ''}</div></button>`;
   }).join('')}</div>`, '', () => { app.sel = null; render(); });
}
