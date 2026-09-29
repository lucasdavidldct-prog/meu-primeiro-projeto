import { PBYID } from './world';
import { PROFILE } from './positions';
import type { BasePlayer, CardPlayer, Pos, Tier, Variant } from './types';

export const VAR: Record<Variant, { n: string; b: number }> = {
  base: { n: 'Base', b: 0 }, dest: { n: 'Destaque da Rodada', b: 3 }, heroi: { n: 'Herói', b: 6 },
  fc: { n: 'Futuro Craque', b: 8 }, elite: { n: 'Elite do Ano', b: 10 }, lenda: { n: 'Lenda', b: 0 },
};
export const TIER_N: Record<Tier, string> = {
  bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', dest: 'Destaque', heroi: 'Herói', fc: 'Futuro Craque', elite: 'Elite', lenda: 'Lenda',
};
export const isSpecial = (t: Tier): boolean => t !== 'bronze' && t !== 'prata' && t !== 'ouro';

const cache = new Map<string, CardPlayer>();
export function clearCardCache(): void { cache.clear(); }

/** Jogador numa versão de carta (com bônus de atributos). */
export function cardData(pid: number, v: Variant): CardPlayer {
  const k = pid + '|' + v;
  const hit = cache.get(k);
  if (hit) return hit;
  const b = PBYID.get(pid);
  if (!b) throw new Error('Jogador desconhecido: ' + pid);
  const P = makeCard(b, v);
  cache.set(k, P);
  return P;
}

export function makeCard(b: BasePlayer, v: Variant): CardPlayer {
  const boost = VAR[v].b;
  const ovr = Math.min(99, b.ovr + boost);
  const st = b.st.map((s, i) => Math.min(99, s + boost + (boost && PROFILE[b.pos][i] >= 1 ? 2 : 0)));
  const tier: Tier = v !== 'base' ? v : (b.leg ? 'lenda' : ovr >= 75 ? 'ouro' : ovr >= 65 ? 'prata' : 'bronze');
  return { ...b, ovr, st, v, tier };
}

export const inPos = (P: BasePlayer, pos: Pos): boolean => P.pos === pos || P.alt.includes(pos);

export function sellValue(P: CardPlayer): number {
  const base = P.ovr < 65 ? 40 + (P.ovr - 45) * 4 : P.ovr < 75 ? 180 + (P.ovr - 65) * 25 : 500 + Math.pow(P.ovr - 74, 2) * 55;
  const mult = ({ dest: 2.5, heroi: 3, fc: 3, elite: 4, lenda: 5 } as Partial<Record<Tier, number>>)[P.tier] || 1;
  return Math.round(base * mult / 10) * 10;
}
