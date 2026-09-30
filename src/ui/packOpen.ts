import { VAR, cardData, isSpecial, sellValue } from '../engine/cards';
import { packContents, type PackId } from '../engine/packs';
import { addCard } from '../engine/state';
import type { OwnedCard } from '../engine/types';
import { clubOf, nationOf } from '../engine/world';
import { cardHTML, flagHTML } from './card';
import { crestHTML } from './crest';
import { app, render, saveNow } from './ctx';
import { esc, fmt } from './dom';

export interface Got { u: number; P: OwnedCard; dup: boolean }

export function openPack(id: PackId): void {
  const S = app.S;
  const owned = new Set(S.cards.map(c => c.p + '|' + c.v));
  const got: Got[] = packContents(id).map(x => {
    const k = x.p + '|' + x.v, dup = owned.has(k);
    owned.add(k);
    const c = addCard(S, x.p, x.v);
    return { u: c.u, P: { ...cardData(x.p, x.v), u: c.u }, dup };
  });
  S.rec.packs++;
  saveNow(); render();
  got.sort((a, b) => b.P.ovr - a.P.ovr);
  const best = got[0].P;
  const show = () => showReveal(got);
  if (best.ovr >= 84 || isSpecial(best.tier)) walkout(best, show); else show();
}

const GLOW: Record<string, string> = { lenda: '#fff3c4', elite: '#6f95ff', heroi: '#ff7a5c', fc: '#3de0cf', dest: '#f0cf6a' };

/** Revelação em etapas: país, posição, clube e carta. */
export function walkout(P: OwnedCard, done: () => void): void {
  const w = document.createElement('div');
  w.className = 'walk';
  const glow = GLOW[P.tier] || '#f5d77a';
  w.style.setProperty('--glow', glow);
  const c = clubOf(P);
  const steps = [
    `${flagHTML(P.nat, 'flagbig')}<div class="big">${nationOf(P.nat).n}</div>`,
    `<div class="big" style="font-size:120px;color:${glow}">${P.pos}</div>`,
    `${crestHTML(c, 'big')}<div class="big" style="font-size:48px">${esc(c.n)}</div>`,
    `${cardHTML(P, 'xl')}<div style="margin-top:14px;font-size:22px;color:${glow}">${esc(P.name)}${P.v !== 'base' ? ' · ' + VAR[P.v].n : ''}</div>`,
  ];
  let i = 0, timer: ReturnType<typeof setTimeout>;
  const show = () => { w.innerHTML = `<div class="beam"></div><div class="step" style="display:grid;justify-items:center">${steps[i]}</div><div class="skip">${i < 3 ? 'Toque para pular' : 'Toque para continuar'}</div>`; };
  const next = () => {
    clearTimeout(timer);
    if (i >= 3) { w.remove(); done(); return; }
    i++; show();
    if (i < 3) timer = setTimeout(next, 1300);
  };
  w.addEventListener('click', () => { if (i < 3) { clearTimeout(timer); i = 3; show(); } else next(); });
  document.body.appendChild(w); show();
  timer = setTimeout(next, 1300);
}

function showReveal(got: Got[]): void {
  const ov = document.createElement('div');
  ov.className = 'ov'; ov.id = 'reveal';
  const dups = got.filter(g => g.dup), dv = dups.reduce((s, g) => s + sellValue(g.P), 0);
  ov.innerHTML = `<div class="ov-inner"><h2 style="text-align:center">Seu pacote</h2>
   <div class="grid reveal">${got.map(g => `<div style="position:relative">${cardHTML(g.P, 'md', g.dup ? '<span class="dup">REPETIDA</span>' : '')}</div>`).join('')}</div>
   <div style="display:grid;gap:8px;margin-top:20px">
   ${dups.length ? `<button class="btn" data-act="sellPackDups" data-u="${dups.map(g => g.u).join(',')}">Vender repetidas (+${fmt(dv)})</button>` : ''}
   <button class="btn pri" data-act="closeReveal">Guardar no clube</button></div></div>`;
  ov.querySelectorAll<HTMLElement>('.reveal .card').forEach((c, k) => { c.style.animationDelay = (k * 90) + 'ms'; });
  document.body.appendChild(ov);
}
