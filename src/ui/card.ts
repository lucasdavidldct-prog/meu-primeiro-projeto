import { TIER_N, isSpecial } from '../engine/cards';
import { STAT_G, STAT_L } from '../engine/positions';
import type { CardPlayer, Club } from '../engine/types';
import { NATIONS, clubOf } from '../engine/world';
import { esc } from './dom';

function faceSVG(c: Club): string {
  return `<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="19" r="10.5" fill="currentColor" opacity=".32"/><path d="M26 28h8v6h-8z" fill="currentColor" opacity=".32"/><path d="M6 60c0-14 10-24 24-24s24 10 24 24z" fill="${c.c1}"/><path d="M6 60c0-14 10-24 24-24s24 10 24 24z" fill="none" stroke="rgba(0,0,0,.25)"/><path d="M21 37l9 8 9-8" fill="none" stroke="${c.c2}" stroke-width="3"/><path d="M18 48h24" stroke="${c.c2}" stroke-width="2" opacity=".5"/></svg>`;
}

export function cardHTML(P: CardPlayer, size = 'sm', extra = ''): string {
  const f = NATIONS[P.nat].f, c = clubOf(P), L = P.pos === 'GOL' ? STAT_G : STAT_L;
  return `<div class="card ${size} t-${P.tier}" title="${esc(P.name)} ${P.ovr}">${extra}
   <div class="c-top"><b class="c-ovr">${P.ovr}</b><span class="c-pos">${P.pos}</span><i class="flag" style="--a:${f[0]};--b:${f[1]};--c:${f[2]}"></i><i class="badge" style="--a:${c.c1};--b:${c.c2}"></i></div>
   <div class="c-face">${faceSVG(c)}</div>
   <div class="c-name">${esc(P.short)}</div>
   <div class="c-stats">${P.st.map((s, i) => `<span><b>${s}</b>${L[i]}</span>`).join('')}</div>
   ${isSpecial(P.tier) ? `<div class="c-tag">${TIER_N[P.tier]}</div>` : ''}
  </div>`;
}

export const pips = (n: number): string =>
  `<span class="pips">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
