import { R, pick, wpick } from './rng';
import type { Variant } from './types';
import { W } from './world';

export type PackId = 'bronze' | 'prata' | 'ouro' | 'premium' | 'especial' | 'evento' | 'lenda';
export interface PackDef { id: PackId; n: string; price: number; cls: string; d: string }

export const PACKS: PackDef[] = [
  { id: 'bronze', n: 'Bronze', price: 400, cls: 'p-bronze', d: '6 jogadores até 67, quase todos bronze. Um pode ser prata.' },
  { id: 'prata', n: 'Prata', price: 1200, cls: 'p-prata', d: '6 jogadores prata. Chance de um ouro.' },
  { id: 'ouro', n: 'Ouro', price: 3500, cls: 'p-ouro', d: '8 jogadores ouro. 10% de chance de uma carta especial.' },
  { id: 'premium', n: 'Ouro Premium', price: 8000, cls: 'p-premium', d: '10 ouros, 3 deles 81+. 30% de chance de especial.' },
  { id: 'especial', n: 'Especiais', price: 18000, cls: 'p-especial', d: '5 ouros 79+ com uma carta especial garantida.' },
  { id: 'evento', n: 'Evento da semana', price: 30000, cls: 'p-evento', d: 'Uma carta do evento da semana garantida e mais 3 ouros 81+.' },
  { id: 'lenda', n: 'Lenda', price: 45000, cls: 'p-lenda', d: 'Uma lenda garantida (Ídolo, Herói ou Hall da Fama) e mais 3 ouros 81+.' },
];
export const packById = (id: PackId): PackDef => PACKS.find(p => p.id === id)!;

export interface Draw { p: string; v: Variant }

function drawRange(min: number, max: number): Draw {
  let cand = W.pool.filter(p => p.ovr >= min && p.ovr <= max);
  // Se a faixa estiver vazia (dados editados), usa os mais próximos.
  if (!cand.length) cand = [...W.pool].sort((a, b) => Math.abs(a.ovr - (min + max) / 2) - Math.abs(b.ovr - (min + max) / 2)).slice(0, 30);
  const w = cand.map(p => [p, Math.exp(-(p.ovr - min) * .13)] as const);
  return { p: wpick(w).id, v: 'base' };
}

function drawSpecial(): Draw {
  const r = R();
  const v: Variant = r < .48 ? 'dest' : r < .7 ? 'heroi' : r < .9 ? 'fc' : 'elite';
  const P = W.pool;
  let cand = v === 'fc' ? P.filter(p => p.age <= 22 && p.ovr >= 70)
    : v === 'elite' ? P.filter(p => p.ovr >= 84)
    : P.filter(p => p.ovr >= (v === 'heroi' ? 77 : 75));
  if (!cand.length) cand = P;
  return { p: wpick(cand.map(p => [p, Math.exp(-(p.ovr - 70) * .08)] as const)).id, v };
}

/** Lenda do pacote: Ídolo 30%, Herói 35%, Hall da Fama 35%. */
function pickLegend() {
  const r = R(), cat = r < .3 ? 'idolo' : r < .65 ? 'heroi' : 'hall';
  // Fora de Série: raríssimos (3% do pacote Lenda)
  if (R() < .03) { const fs = W.legends.filter(p => p.fs); if (fs.length) return pick(fs); }
  const g = W.legends.filter(p => (p.legCat ?? 'idolo') === cat && !p.fs);
  return pick(g.length ? g : W.legends);
}

/** Evento mais recente (o da semana). */
export const currentEvent = () => { const e = W.events.at(-1)?.ev; return e ? W.events.filter(p => p.ev!.id === e.id) : []; };
/** Carta do evento da semana: as de overall mais alto são mais raras. */
function drawEvent(): Draw | null {
  const cards = currentEvent();
  if (!cards.length) return null;
  return { p: wpick(cards.map(p => [p, Math.exp(-(p.ovr - 85) * .35)] as const)).id, v: 'evento' };
}

export function packContents(id: PackId): Draw[] {
  const out: Draw[] = [];
  if (id === 'bronze') { for (let i = 0; i < 6; i++) out.push(i === 0 && R() < .3 ? drawRange(68, 75) : drawRange(40, 67)); }
  else if (id === 'prata') { for (let i = 0; i < 6; i++) out.push(i === 0 && R() < .22 ? drawRange(76, 81) : drawRange(68, 75)); }
  else if (id === 'ouro') { for (let i = 0; i < 8; i++) out.push(drawRange(76, 99)); if (R() < .1) out[0] = drawSpecial(); }
  else if (id === 'premium') { for (let i = 0; i < 10; i++) out.push(i < 3 ? drawRange(81, 99) : drawRange(76, 99)); if (R() < .3) out[0] = drawSpecial(); }
  else if (id === 'evento') { out.push(drawEvent() ?? drawSpecial()); for (let i = 0; i < 3; i++) out.push(drawRange(81, 99)); }
  else if (id === 'especial') { out.push(R() < .15 ? drawEvent() ?? drawSpecial() : drawSpecial()); for (let i = 0; i < 4; i++) out.push(drawRange(79, 99)); }
  else if (id === 'lenda') { out.push({ p: pickLegend().id, v: 'lenda' }); for (let i = 0; i < 3; i++) out.push(drawRange(81, 99)); }
  return out;
}
