// Mercado de leilão (opção da carreira): a CPU anuncia cartas e disputa lances com você; você também vende as suas.
// Lógica pura: o relógio vem de fora (`now` em ms), a interface só chama tick() a cada segundo.
import { cardData, isSpecial, VAR } from './cards';
import { parsePs } from './data/schema';
import { R, type Rng } from './rng';
import type { CardPlayer, Variant } from './types';
import { W } from './world';

/** Valor de mercado de uma carta: barato até ~80, dispara nas cartas de elite; lendas e versões especiais valem bem mais. */
export function marketValue(P: CardPlayer): number {
  // Comum vale pouco (tem muito no mercado); o preço dispara só nas cartas de elite e nas lendas
  let v = 100 + 12 * Math.pow(1.35, P.ovr - 65);
  if (P.leg) v *= P.legCat === 'hall' ? 2.6 : P.legCat === 'heroi' ? 3.2 : 5;
  else if (P.ev) v *= 2.4;
  if (P.fs) v *= 2.5;
  else if (isSpecial(P.tier)) v *= P.v === 'elite' ? 2.6 : P.v === 'fc' ? 2.2 : P.v === 'heroi' ? 1.9 : 1.5;
  const plus = P.ps.filter(x => parsePs(x).plus).length;
  v *= 1 + .04 * P.ps.length + .06 * plus;
  return roundPrice(v);
}
/** Preços "redondos" como num mercado de verdade. */
export function roundPrice(v: number): number {
  const step = v >= 100000 ? 5000 : v >= 10000 ? 500 : v >= 1000 ? 50 : 10;
  return Math.max(100, Math.round(v / step) * step);
}
/** Menor lance seguinte (≈5% acima do atual). */
export const nextBid = (cur: number, start: number): number => (cur ? roundPrice(cur * 1.05 + 1) : start);

export interface Listing {
  id: number; p: string; v: Variant;
  /** Vendedor: CPU ou você (carta da sua coleção, uid). */
  seller: 'cpu' | 'voce'; uid?: number;
  start: number; buyNow: number;
  bid: number; bidder: 'cpu' | 'voce' | null;
  ends: number;
  /** Quanto a CPU aceita pagar no máximo nesta carta (escondido). */
  cpuMax: number;
  /** Próximo momento em que a CPU pode reagir. */
  cpuAt: number;
  /** Você já deu lance aqui (continua em "Meus lances" mesmo se a CPU cobrir). */
  you?: boolean;
  done?: 'vendido' | 'sem-lances' | 'comprado-ja';
}

export interface MarketState { seq: number; list: Listing[]; log: string[] }
export const newMarket = (): MarketState => ({ seq: 1, list: [], log: [] });

const LEILAO_MS = [60000, 180000];
const PRORROGA_MS = 15000;

/** Busca por nome (jogadores reais e lendas) e gera os anúncios da CPU para os encontrados. */
export function search(M: MarketState, q: string, now: number, r: Rng = R): Listing[] {
  const t = norm(q);
  if (t.length < 3) return [];
  const all = [...W.pool.filter(p => !p.filler), ...W.legends, ...W.events];
  const found = all.filter(p => norm(p.name).includes(t) || norm(p.short).includes(t)).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const out: Listing[] = [];
  for (const b of found) {
    const have = M.list.filter(l => l.p === b.id && !l.done && l.seller === 'cpu');
    if (have.length) { out.push(...have); continue; }
    // Fora de Série: quase ninguém vende (só às vezes aparece um, e a CPU briga muito por ele)
    if (b.fs && r() > .4) continue;
    const n = b.fs ? 1 : 1 + Math.floor(r() * (b.ovr >= 85 ? 2 : 4));
    for (let k = 0; k < n; k++) {
      const v: Variant = b.ev ? 'evento' : b.leg ? 'lenda' : r() < .12 ? (['dest', 'heroi', 'fc', 'elite'] as const)[Math.floor(r() * 4)] : 'base';
      if (v === 'fc' && b.age > 22) continue;
      const P = cardData(b.id, v), val = marketValue(P);
      const start = roundPrice(val * (.6 + r() * .25)), buyNow = roundPrice(val * (1.1 + r() * .45));
      const l: Listing = { id: M.seq++, p: b.id, v, seller: 'cpu', start, buyNow, bid: 0, bidder: null,
        ends: now + LEILAO_MS[0] + r() * (LEILAO_MS[1] - LEILAO_MS[0]), cpuMax: roundPrice(val * (b.fs ? 1.05 + r() * .4 : .8 + r() * .4)), cpuAt: now + 4000 + r() * 8000 };
      M.list.push(l); out.push(l);
    }
  }
  return out;
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Moedas presas nos leilões em que você está ganhando. */
export const committed = (M: MarketState): number => M.list.reduce((s, l) => s + (!l.done && l.seller === 'cpu' && l.bidder === 'voce' ? l.bid : 0), 0);

export function bid(M: MarketState, l: Listing, coins: number, now: number): { ok: boolean; msg?: string } {
  if (l.done || now >= l.ends) return { ok: false, msg: 'Esse leilão já terminou' };
  if (l.bidder === 'voce') return { ok: false, msg: 'Você já está ganhando esse leilão' };
  const v = nextBid(l.bid, l.start);
  if (coins - committed(M) < v) return { ok: false, msg: 'Moedas insuficientes (contando os lances em que você está ganhando)' };
  l.bid = v; l.bidder = 'voce'; l.you = true;
  if (l.ends - now < PRORROGA_MS) l.ends = now + PRORROGA_MS;
  l.cpuAt = now + 1500 + R() * 3500;
  return { ok: true };
}

/** Comprar já: paga o preço fixo e leva na hora. Devolve o custo. */
export function buyNow(M: MarketState, l: Listing, coins: number, now: number): { ok: boolean; msg?: string; cost?: number } {
  if (l.done || now >= l.ends) return { ok: false, msg: 'Esse leilão já terminou' };
  const livre = coins - committed(M) + (l.bidder === 'voce' ? l.bid : 0);
  if (livre < l.buyNow) return { ok: false, msg: 'Moedas insuficientes' };
  l.done = 'comprado-ja'; l.bidder = 'voce'; l.bid = l.buyNow; l.you = true;
  return { ok: true, cost: l.buyNow };
}

/** Anuncia uma carta sua. */
export function listMine(M: MarketState, uid: number, p: string, v: Variant, start: number, buyNowP: number, minutes: number, now: number, r: Rng = R): Listing {
  const val = marketValue(cardData(p, v));
  const l: Listing = { id: M.seq++, p, v, seller: 'voce', uid, start: roundPrice(start), buyNow: roundPrice(Math.max(buyNowP, start)), bid: 0, bidder: null,
    ends: now + minutes * 60000, cpuMax: roundPrice(val * (.75 + r() * .5)), cpuAt: now + 5000 + r() * 15000 };
  M.list.push(l);
  return l;
}

export interface TickEvent { l: Listing; kind: 'superado' | 'ganhou' | 'perdeu' | 'vendeu' | 'nao-vendeu' | 'lance-cpu' }
/** Avança o mercado: a CPU dá lances e compra; leilões que acabaram são fechados. */
export function tick(M: MarketState, now: number, r: Rng = R): TickEvent[] {
  const ev: TickEvent[] = [];
  for (const l of M.list) {
    if (l.done) continue;
    if (now < l.ends && now >= l.cpuAt) {
      l.cpuAt = now + 2500 + r() * 6000;
      const nb = nextBid(l.bid, l.start);
      if (l.seller === 'cpu') {
        // Outro comprador (CPU) cobre o seu lance se ainda estiver abaixo do máximo dele
        if (l.bidder === 'voce' && nb <= l.cpuMax && r() < .8) { l.bid = nb; l.bidder = 'cpu'; if (l.ends - now < PRORROGA_MS) l.ends = now + PRORROGA_MS; ev.push({ l, kind: 'superado' }); }
        else if (!l.bidder && nb <= l.cpuMax * .9 && r() < .25) { l.bid = nb; l.bidder = 'cpu'; }
      } else {
        // Sua carta: compradores da CPU
        if (l.buyNow <= l.cpuMax && r() < .35) { l.bid = l.buyNow; l.bidder = 'cpu'; l.done = 'comprado-ja'; ev.push({ l, kind: 'vendeu' }); continue; }
        if (nb <= l.cpuMax && r() < .45) { l.bid = nb; l.bidder = 'cpu'; if (l.ends - now < PRORROGA_MS) l.ends = now + PRORROGA_MS; ev.push({ l, kind: 'lance-cpu' }); }
      }
    }
    if (now >= l.ends) {
      if (l.seller === 'cpu') { l.done = l.bidder ? 'vendido' : 'sem-lances'; if (l.bidder === 'voce') ev.push({ l, kind: 'ganhou' }); }
      else { l.done = l.bidder ? 'vendido' : 'sem-lances'; ev.push({ l, kind: l.bidder ? 'vendeu' : 'nao-vendeu' }); }
    }
  }
  // Guarda só os leilões recentes
  M.list = M.list.filter(l => !l.done || now - l.ends < 10 * 60000);
  return ev;
}

/** Taxa do mercado sobre as suas vendas. */
export const TAXA = .05;
export const netOf = (price: number): number => Math.round(price * (1 - TAXA));
export const variantName = (v: Variant): string => (v === 'base' ? '' : VAR[v].n);

