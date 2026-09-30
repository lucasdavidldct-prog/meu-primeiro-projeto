// Escudos estilizados gerados com as cores e a sigla do clube (sem logos oficiais).
// Se existir public/escudos/<SIGLA>.png, a imagem do usuário é usada no lugar.
import siglas from 'virtual:escudos';
import type { Club } from '../engine/types';
import { esc } from './dom';

const CUSTOM = new Set(siglas);
const SHIELD = 'M50 2 L96 14 L96 58 C96 84 72 104 50 118 C28 104 4 84 4 58 L4 14 Z';

function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** SVG do escudo gerado. Padrão escolhido pela sigla, sempre o mesmo para o mesmo clube. */
export function crestSVG(c: Club): string {
  const id = 'cr' + c.s.replace(/[^A-Za-z0-9]/g, '') + (hash(c.c1 + c.c2) % 997);
  const p = hash(c.s) % 6;
  const a = c.c1, b = c.c2;
  const pattern = [
    `<rect x="0" y="0" width="50" height="120" fill="${a}"/><rect x="50" y="0" width="50" height="120" fill="${b}"/>`,
    `<rect width="100" height="120" fill="${a}"/><rect x="0" y="44" width="100" height="26" fill="${b}"/>`,
    `<rect width="100" height="120" fill="${a}"/>${[14, 42, 70].map(x => `<rect x="${x}" y="0" width="14" height="120" fill="${b}"/>`).join('')}`,
    `<rect width="100" height="120" fill="${a}"/><path d="M-10 30 L30 -10 L110 70 L70 110 Z" fill="${b}"/>`,
    `<rect width="100" height="120" fill="${a}"/><path d="M0 40 L50 70 L100 40 L100 62 L50 92 L0 62 Z" fill="${b}"/>`,
    `<rect width="100" height="120" fill="${a}"/><circle cx="50" cy="60" r="30" fill="${b}"/>`,
  ][p];
  const txt = lum(a) > .6 && lum(b) > .6 ? '#111111' : lum(a) < .35 && lum(b) < .35 ? '#ffffff' : (lum(a) > .5 ? '#111111' : '#ffffff');
  const fs = c.s.length >= 4 ? 24 : 30;
  return `<svg class="crest-svg" viewBox="0 0 100 120" role="img" aria-label="${esc(c.n)}"><defs><clipPath id="${id}"><path d="${SHIELD}"/></clipPath></defs>
  <g clip-path="url(#${id})">${pattern}</g>
  <path d="${SHIELD}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="4"/><path d="M50 9 L89 19 L89 58 C89 80 69 97 50 110 C31 97 11 80 11 58 L11 19 Z" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
  <text x="50" y="${p === 1 ? 66 : 70}" text-anchor="middle" font-family="'Saira Extra Condensed',sans-serif" font-weight="900" font-size="${fs}" fill="${txt}" stroke="${txt === '#ffffff' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.5)'}" stroke-width="1.2" paint-order="stroke">${esc(c.s)}</text></svg>`;
}

/** Escudo pronto para a página: imagem própria se existir, senão o gerado. */
export function crestHTML(c: Club, cls = ''): string {
  if (CUSTOM.has(c.s.toUpperCase())) return `<span class="crest-box ${cls}"><img src="${import.meta.env.BASE_URL}escudos/${encodeURIComponent(c.s.toUpperCase())}.png" alt="${esc(c.n)}" loading="lazy"></span>`;
  return `<span class="crest-box ${cls}">${crestSVG(c)}</span>`;
}
export const hasCustomCrest = (sigla: string): boolean => CUSTOM.has(sigla.toUpperCase());
