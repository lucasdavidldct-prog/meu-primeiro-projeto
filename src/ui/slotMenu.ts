// Menu ao tocar numa carta da escalação: substituir, detalhes, função e orientação.
import { inPos } from '../engine/cards';
import { FUNCS, PART_LABELS, POS_NAME, ROLE_SWAPS, groupOf } from '../engine/orders';
import { slotsOf } from '../engine/positions';
import { cardByUid, orderAt, squadSlots } from '../engine/state';
import { cardHTML } from './card';
import { app } from './ctx';
import { esc } from './dom';

export function slotMenuHTML(i: number): string {
  const S = app.S, u = S.squad.xi[i], P = u ? cardByUid(S, u) : null;
  if (!P) return '';
  const slot = squadSlots(S)[i], base = slotsOf(S.squad.form)[i].p, pos = slot.p, g = groupOf(pos);
  const o = orderAt(S, i, P, pos), part = o.p ?? 0;
  const roles = ROLE_SWAPS[base].map(p => {
    const ok = inPos(P, p);
    return `<button class="chip" data-act="slotRole" data-i="${i}" data-p="${p}" aria-pressed="${p === pos}" title="${POS_NAME[p]}">${p}${ok ? '' : ' <span class="down">!</span>'}</button>`;
  }).join('');
  const funcs = FUNCS[g].map(f => `<button class="fn-opt" data-act="slotFunc" data-i="${i}" data-f="${f.id}" aria-pressed="${f.id === o.f}"><b>${f.n}</b><span>${f.d}</span></button>`).join('');
  const parts = g === 'GOL' ? '' : `<h3>Participação</h3><div class="chips">${[-1, 0, 1].map(k => `<button class="chip" data-act="slotPart" data-i="${i}" data-p="${k}" aria-pressed="${k === part}">${PART_LABELS[g][k + 1]}</button>`).join('')}</div>`;
  return `<div class="slot-menu">
    <div class="sm-head">${cardHTML(P, 'sm')}<div><h2 style="margin:0">${esc(P.name)}</h2><div class="small muted">${POS_NAME[pos]} · ${FUNCS[g].find(f => f.id === o.f)?.n ?? ''}</div></div></div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn pri" style="flex:1" data-act="slotSub" data-i="${i}">Substituir</button><button class="btn" style="flex:1" data-act="card" data-u="${P.u}">Detalhes</button></div>
    <h3>Função no campo</h3><div class="chips">${roles}</div>
    ${inPos(P, pos) ? '' : '<p class="small down" style="margin:6px 0 0">Fora de posição: rende menos nessa função.</p>'}
    <h3>Orientação</h3><div class="fn-list">${funcs}</div>
    ${parts}
  </div>`;
}
