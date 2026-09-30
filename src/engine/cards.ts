import { getPlayer } from './world';
import { PROFILE } from './positions';
import type { BasePlayer, CardPlayer, Pos, Tier, Variant } from './types';

export const VAR: Record<Variant, { n: string; b: number }> = {
  base: { n: 'Base', b: 0 }, dest: { n: 'Destaque da Rodada', b: 3 }, heroi: { n: 'Craque do Mês', b: 6 },
  fc: { n: 'Futuro Craque', b: 8 }, elite: { n: 'Elite do Ano', b: 10 }, lenda: { n: 'Lenda', b: 0 }, evento: { n: 'Evento', b: 0 },
};
export const TIER_N: Record<Tier, string> = {
  bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', dest: 'Destaque', heroi: 'Craque do Mês', fc: 'Futuro Craque', elite: 'Elite', lenda: 'Ídolo', lheroi: 'Herói', hall: 'Hall da Fama', evento: 'Evento',
};
/** Faixas de overall das cartas comuns (calibradas para a escala dos dados reais). */
export const TIER_PRATA = 68, TIER_OURO = 76;

export const isSpecial = (t: Tier): boolean => t !== 'bronze' && t !== 'prata' && t !== 'ouro';

const cache = new Map<string, CardPlayer>();
export function clearCardCache(): void { cache.clear(); }

/** Jogador numa versão de carta (com bônus de atributos). */
export function cardData(pid: string, v: Variant): CardPlayer {
  const k = pid + '|' + v;
  const hit = cache.get(k);
  if (hit) return hit;
  const b = getPlayer(pid);
  if (!b) throw new Error('Jogador desconhecido: ' + pid);
  const P = makeCard(b, v);
  cache.set(k, P);
  return P;
}

export function makeCard(b: BasePlayer, v: Variant): CardPlayer {
  const boost = VAR[v].b;
  const ovr = Math.min(99, b.ovr + boost);
  const st = b.st.map((s, i) => Math.min(99, s + boost + (boost && PROFILE[b.pos][i] >= 1 ? 2 : 0)));
  const tier: Tier = b.ev ? 'evento' : b.leg ? legTier(b) : v !== 'base' ? v : ( ovr >= TIER_OURO ? 'ouro' : ovr >= TIER_PRATA ? 'prata' : 'bronze');
  return { ...b, ovr, st, v, tier };
}

/** Tier da carta de lenda conforme a categoria. */
export const legTier = (b: BasePlayer): Tier => (b.legCat === 'heroi' ? 'lheroi' : b.legCat === 'hall' ? 'hall' : 'lenda');

export const inPos = (P: BasePlayer, pos: Pos): boolean => P.pos === pos || P.alt.includes(pos);

export function sellValue(P: CardPlayer): number {
  const base = P.ovr < TIER_PRATA ? 40 + (P.ovr - 48) * 4 : P.ovr < TIER_OURO ? 180 + (P.ovr - TIER_PRATA) * 25 : 500 + Math.pow(P.ovr - TIER_OURO + 1, 2) * 55;
  const mult = ({ dest: 2.5, heroi: 3, fc: 3, elite: 4, lenda: 5, lheroi: 3.5, hall: 3, evento: 3.2 } as Partial<Record<Tier, number>>)[P.tier] || 1;
  return Math.round(base * mult / 10) * 10;
}
