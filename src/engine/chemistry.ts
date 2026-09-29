import { inPos } from './cards';
import { slotsOf } from './positions';
import type { BasePlayer, FormationId, Pos } from './types';

export interface Chem { per: number[]; total: number }

/** Química por posição (0 a 3) e total (máx. 33). Legendas valem como 2 compatriotas e reforçam a liga de todos. */
export function calcChem(xi: (BasePlayer | null)[], form: FormationId): Chem {
  const slots = slotsOf(form);
  const club: Record<string, number> = {}, nat: Record<string, number> = {}, lg: Record<string, number> = {};
  let legs = 0;
  xi.forEach(P => {
    if (!P) return;
    if (P.leg) { legs++; nat[P.nat] = (nat[P.nat] || 0) + 2; return; }
    const k = P.lg + ':' + P.club;
    club[k] = (club[k] || 0) + 1; lg[P.lg] = (lg[P.lg] || 0) + 1; nat[P.nat] = (nat[P.nat] || 0) + 1;
  });
  const per = xi.map((P, i) => {
    if (!P || !inPos(P, slots[i].p)) return 0;
    if (P.leg) return 3;
    const cc = club[P.lg + ':' + P.club], nc = nat[P.nat], lc = lg[P.lg] + legs;
    const c = (cc >= 7 ? 3 : cc >= 4 ? 2 : cc >= 2 ? 1 : 0) + (nc >= 8 ? 3 : nc >= 5 ? 2 : nc >= 2 ? 1 : 0) + (lc >= 8 ? 3 : lc >= 5 ? 2 : lc >= 3 ? 1 : 0);
    return Math.min(3, c);
  });
  return { per, total: per.reduce((a, b) => a + b, 0) };
}

/** Overall efetivo numa posição: goleiro fora do gol (ou linha no gol) desaba, fora de posição perde 7, química soma de -3 a +2. */
export function effOvr(P: BasePlayer | null, pos: Pos, chem: number): number {
  if (!P) return 25;
  let e = P.ovr;
  if ((pos === 'GOL') !== (P.pos === 'GOL')) e = Math.min(e, 32);
  else if (!inPos(P, pos)) e -= 7;
  return e + [-3, -1, 1, 2][chem];
}

export const W_ATT: Record<Pos, number> = { GOL: 0, ZAG: .06, LD: .25, LE: .25, VOL: .18, MC: .42, MEI: .8, MD: .6, ME: .6, PD: .9, PE: .9, ATA: 1 };
export const W_DEF: Record<Pos, number> = { GOL: 0, ZAG: 1, LD: .85, LE: .85, VOL: .85, MC: .45, MEI: .15, MD: .35, ME: .35, PD: .08, PE: .08, ATA: .04 };
export const W_MID: Record<Pos, number> = { GOL: 0, ZAG: .2, LD: .3, LE: .3, VOL: .9, MC: 1, MEI: .9, MD: .8, ME: .8, PD: .4, PE: .4, ATA: .25 };
const refW = (W: Record<Pos, number>) => slotsOf('4-3-3').reduce((s, x) => s + W[x.p], 0);
const REF = { att: refW(W_ATT), def: refW(W_DEF), mid: refW(W_MID) };

export interface RateEntry { pos: Pos; eff: number; red?: boolean }
export interface Ratings { att: number; def: number; mid: number; gk: number }

/** Força por setor, ponderada pela posição; expulsões pesam 5% cada. */
export function rate(entries: RateEntry[]): Ratings {
  const f = (W: Record<Pos, number>, ref: number) => {
    let s = 0, w = 0;
    for (const e of entries) { if (e.red) continue; const k = W[e.pos]; s += e.eff * k; w += k; }
    return w ? (s / w) * Math.pow(w / ref, .3) : 30;
  };
  const gk = entries.find(e => e.pos === 'GOL' && !e.red);
  const reds = entries.filter(e => e.red).length, pen = Math.pow(.95, reds);
  return { att: f(W_ATT, REF.att) * pen, def: f(W_DEF, REF.def) * pen, mid: f(W_MID, REF.mid) * pen, gk: gk ? gk.eff : 30 };
}
