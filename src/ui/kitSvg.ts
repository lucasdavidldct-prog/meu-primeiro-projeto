// Miniatura da camisa (desenho próprio) para escolher o uniforme.
import type { Kit } from '../engine/kits';

let n = 0;
export function kitSVG(k: Kit, size = 64): string {
  const id = 'kt' + (n++ % 100000);
  const shirt = 'M18 6l-12 8 5 11 6-3v32h26V22l6 3 5-11-12-8c-2 4-5 6-12 6s-10-2-12-6z';
  let pat = '';
  if (k.p === 'listras') for (let x = 14; x < 60; x += 8) pat += `<rect x="${x}" y="0" width="4" height="60" fill="${k.t}"/>`;
  else if (k.p === 'aros') for (let y = 14; y < 60; y += 10) pat += `<rect x="0" y="${y}" width="60" height="5" fill="${k.t}"/>`;
  else if (k.p === 'faixa') pat = `<rect x="0" y="22" width="60" height="8" fill="${k.t}"/>`;
  else if (k.p === 'diagonal') pat = `<path d="M6 12L16 8L56 52L46 56z" fill="${k.t}"/>`;
  else if (k.p === 'metade') pat = `<rect x="30" y="0" width="30" height="60" fill="${k.t}"/>`;
  else pat = `<rect x="17" y="22" width="2.5" height="32" fill="${k.t}"/><rect x="40.5" y="22" width="2.5" height="32" fill="${k.t}"/>`;
  return `<svg class="kit-svg" viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true"><defs><clipPath id="${id}"><path d="${shirt}"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect width="60" height="60" fill="${k.s}"/>${pat}</g>
    <path d="${shirt}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/><path d="M24 6c1 3 3 5 6 5s5-2 6-5" fill="none" stroke="${k.t}" stroke-width="2"/>
    <rect x="17" y="54" width="26" height="4" fill="${k.sh}" stroke="rgba(0,0,0,.3)" stroke-width=".6"/></svg>`;
}
