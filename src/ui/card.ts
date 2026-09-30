import { TIER_N, isSpecial } from '../engine/cards';
import { PS_BY_ID, parsePs } from '../engine/data/schema';
import { STAT_G, STAT_L } from '../engine/positions';
import type { CardPlayer, Club } from '../engine/types';
import { clubOf, nationOf } from '../engine/world';
import { crestHTML } from './crest';
import { esc } from './dom';
import { fotoDe } from './fotos';

function faceSVG(c: Club): string {
  return `<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="19" r="10.5" fill="currentColor" opacity=".32"/><path d="M26 28h8v6h-8z" fill="currentColor" opacity=".32"/><path d="M6 60c0-14 10-24 24-24s24 10 24 24z" fill="${c.c1}"/><path d="M6 60c0-14 10-24 24-24s24 10 24 24z" fill="none" stroke="rgba(0,0,0,.25)"/><path d="M21 37l9 8 9-8" fill="none" stroke="${c.c2}" stroke-width="3"/><path d="M18 48h24" stroke="${c.c2}" stroke-width="2" opacity=".5"/></svg>`;
}

/** Bandeira estilizada em três faixas (verticais ou horizontais). */
export function flagHTML(nat: string, cls = 'flag'): string {
  const n = nationOf(nat), f = n.f;
  return `<i class="${cls}${n.h ? ' h' : ''}" title="${esc(n.n)}" style="--a:${f[0]};--b:${f[1]};--c:${f[2]}"></i>`;
}

export function cardHTML(P: CardPlayer, size = 'sm', extra = ''): string {
  const c = clubOf(P), L = P.pos === 'GOL' ? STAT_G : STAT_L;
  return `<div class="card ${size} t-${P.tier}" style="--k1:${c.c1};--k2:${c.c2}" title="${esc(P.name)} ${P.ovr}">${extra}
   <div class="c-rib"><b class="c-ovr">${P.ovr}</b><span class="c-pos">${P.pos}</span>${flagHTML(P.nat)}${crestHTML(c, 'badge')}</div>
   <div class="c-face">${faceSVG(c)}${photoHTML(P.id)}</div>
   ${P.ps.length ? `<div class="c-ps">${psIcons(P.ps)}</div>` : ''}
   <div class="c-name">${esc(P.short)}</div>
   <div class="c-stats">${P.st.map((s, i) => `<span><b>${s}</b>${L[i]}</span>`).join('')}</div>
   ${isSpecial(P.tier) ? `<div class="c-tag">${TIER_N[P.tier]}</div>` : ''}
  </div>`;
}

/** Ícones dos playstyles (os "+" ganham anel dourado). */
export function psIcons(list: string[]): string {
  return list.map(x => { const { id, plus } = parsePs(x), d = PS_BY_ID.get(id); return d ? `<i class="${plus ? 'plus' : ''}" title="${esc(d.nome)}${plus ? '+' : ''}">${d.icone}</i>` : ''; }).join('');
}

export const pips = (n: number): string =>
  `<span class="pips">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

/** Legenda legível embaixo da carta: país e clube por extenso. */
export function cardCaption(P: CardPlayer): string {
  const c = clubOf(P), n = nationOf(P.nat);
  return `<div class="c-cap">${flagHTML(P.nat)}<span>${esc(n.n)}</span>${crestHTML(c, 'badge')}<span>${esc(P.leg ? (P.hist ?? 'Lenda') : c.n)}</span></div>`;
}

/** Foto por cima da silhueta; se não carregar (sem internet), a silhueta continua. */
function photoHTML(id: string): string {
  const f = fotoDe(id);
  // Se a URL direta falhar, tenta o redirecionamento da Commons; se também falhar, fica a silhueta
  return f ? `<img class="c-photo" src="${esc(f.url)}"${f.alt ? ` data-alt="${esc(f.alt)}"` : ''} alt="" loading="lazy" decoding="async" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt=''}else this.remove()">` : '';
}
