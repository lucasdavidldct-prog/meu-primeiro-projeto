import { R, pick, wpick } from './rng';
import type { Variant } from './types';
import { LEGENDS, POOL } from './world';

export type PackId = 'bronze' | 'prata' | 'ouro' | 'premium' | 'especial' | 'lenda';
export interface PackDef { id: PackId; n: string; price: number; cls: string; d: string }

export const PACKS: PackDef[] = [
  { id: 'bronze', n: 'Bronze', price: 400, cls: 'p-bronze', d: '6 jogadores, quase todos bronze. Um pode ser prata.' },
  { id: 'prata', n: 'Prata', price: 1200, cls: 'p-prata', d: '6 jogadores prata. Chance de um ouro.' },
  { id: 'ouro', n: 'Ouro', price: 3500, cls: 'p-ouro', d: '8 jogadores ouro. 10% de chance de uma carta especial.' },
  { id: 'premium', n: 'Ouro Premium', price: 8000, cls: 'p-premium', d: '10 ouros, 3 deles 80+. 30% de chance de especial.' },
  { id: 'especial', n: 'Especiais', price: 18000, cls: 'p-especial', d: '5 ouros 78+ com uma carta especial garantida.' },
  { id: 'lenda', n: 'Lenda', price: 45000, cls: 'p-lenda', d: 'Uma Lenda garantida e mais 3 ouros 80+.' },
];
export const packById = (id: PackId): PackDef => PACKS.find(p => p.id === id)!;

export interface Draw { p: number; v: Variant }

function drawRange(min: number, max: number): Draw {
  const cand = POOL.filter(p => p.ovr >= min && p.ovr <= max);
  const w = cand.map(p => [p, Math.exp(-(p.ovr - min) * .13)] as const);
  return { p: wpick(w).id, v: 'base' };
}

function drawSpecial(): Draw {
  const r = R();
  const v: Variant = r < .48 ? 'dest' : r < .7 ? 'heroi' : r < .9 ? 'fc' : 'elite';
  const cand = v === 'fc' ? POOL.filter(p => p.age <= 22 && p.ovr >= 64)
    : v === 'elite' ? POOL.filter(p => p.ovr >= 83)
    : POOL.filter(p => p.ovr >= (v === 'heroi' ? 74 : 72));
  return { p: wpick(cand.map(p => [p, Math.exp(-(p.ovr - 70) * .08)] as const)).id, v };
}

export function packContents(id: PackId): Draw[] {
  const out: Draw[] = [];
  if (id === 'bronze') { for (let i = 0; i < 6; i++) out.push(i === 0 && R() < .3 ? drawRange(65, 74) : drawRange(47, 64)); }
  else if (id === 'prata') { for (let i = 0; i < 6; i++) out.push(i === 0 && R() < .22 ? drawRange(75, 80) : drawRange(65, 74)); }
  else if (id === 'ouro') { for (let i = 0; i < 8; i++) out.push(drawRange(75, 99)); if (R() < .1) out[0] = drawSpecial(); }
  else if (id === 'premium') { for (let i = 0; i < 10; i++) out.push(i < 3 ? drawRange(80, 99) : drawRange(75, 99)); if (R() < .3) out[0] = drawSpecial(); }
  else if (id === 'especial') { out.push(drawSpecial()); for (let i = 0; i < 4; i++) out.push(drawRange(78, 99)); }
  else if (id === 'lenda') { out.push({ p: pick(LEGENDS).id, v: 'lenda' }); for (let i = 0; i < 3; i++) out.push(drawRange(80, 99)); }
  return out;
}
