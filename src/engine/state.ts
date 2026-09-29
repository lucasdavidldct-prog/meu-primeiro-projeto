// Estado do jogo (o que vai para o save) e operações sobre o elenco.
import { cardData, inPos } from './cards';
import { calcChem, effOvr, rate, type Chem, type Ratings } from './chemistry';
import { slotsOf } from './positions';
import { pick } from './rng';
import { newSeason, type Season } from './season';
import type { FormationId, OwnedCard, Pos, SlotDef, StyleId, Variant } from './types';
import { POOL } from './world';

export const SAVE_VERSION = 2;

export interface CardRef { u: number; p: number; v: Variant }
export interface GameState {
  v: number;
  t: number;
  name: string;
  coins: number;
  uid: number;
  cards: CardRef[];
  squad: { form: FormationId; xi: number[]; bench: number[] };
  tac: { style: StyleId; ment: number };
  season: Season;
  rec: { w: number; d: number; l: number; gf: number; ga: number; packs: number };
  lastFree: string;
  moments: boolean;
  titles: number;
}

export function newGame(): GameState {
  const S: GameState = {
    v: SAVE_VERSION, t: Date.now(), name: 'Esquadrão FC', coins: 5000, uid: 1, cards: [],
    squad: { form: '4-3-3', xi: Array(11).fill(0), bench: Array(7).fill(0) },
    tac: { style: 'equilibrado', ment: 2 }, season: newSeason(0),
    rec: { w: 0, d: 0, l: 0, gf: 0, ga: 0, packs: 0 }, lastFree: '', moments: true, titles: 0,
  };
  const need: Pos[] = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ME', 'MD', 'LD'];
  const got = new Set<number>();
  for (const pos of need) {
    const cand = POOL.filter(p => p.pos === pos && p.ovr >= 57 && p.ovr <= 66 && !got.has(p.id));
    const p = pick(cand);
    got.add(p.id);
    addCard(S, p.id, 'base');
  }
  autoLineup(S);
  return S;
}

export function addCard(S: GameState, p: number, v: Variant): CardRef {
  const c = { u: S.uid++, p, v };
  S.cards.push(c);
  return c;
}

export function cardByUid(S: GameState, u: number): OwnedCard | null {
  const c = S.cards.find(c => c.u === u);
  return c ? { ...cardData(c.p, c.v), u } : null;
}
export const allCards = (S: GameState): OwnedCard[] => S.cards.map(c => ({ ...cardData(c.p, c.v), u: c.u }));
export const xiCards = (S: GameState): (OwnedCard | null)[] => S.squad.xi.map(u => (u ? cardByUid(S, u) : null));

export function removeCard(S: GameState, u: number): void {
  S.cards = S.cards.filter(c => c.u !== u);
  S.squad.xi = S.squad.xi.map(x => (x === u ? 0 : x));
  S.squad.bench = S.squad.bench.map(x => (x === u ? 0 : x));
}

/** Escala o melhor time: primeiro posição exata, depois alternativa, depois qualquer um. */
export function autoLineup(S: GameState): void {
  const slots = slotsOf(S.squad.form);
  const all = allCards(S);
  const usedU = new Set<number>(), usedP = new Set<number>(), xi: number[] = Array(11).fill(0);
  const order = slots.map((_, i) => i).sort((a, b) => (slots[a].p === 'GOL' ? -1 : 0) - (slots[b].p === 'GOL' ? -1 : 0));
  for (const pass of [0, 1, 2]) for (const i of order) {
    if (xi[i]) continue;
    const pos = slots[i].p;
    let best: OwnedCard | null = null, bv = -1;
    for (const P of all) {
      if (usedU.has(P.u) || usedP.has(P.id)) continue;
      const ok = pass === 0 ? P.pos === pos : pass === 1 ? inPos(P, pos) : true;
      if (!ok) continue;
      const v = effOvr(P, pos, 1) + (P.pos === pos ? .5 : 0);
      if (v > bv) { bv = v; best = P; }
    }
    if (best) { xi[i] = best.u; usedU.add(best.u); usedP.add(best.id); }
  }
  S.squad.xi = xi;
  const rest = all.filter(P => !usedU.has(P.u)).sort((a, b) => b.ovr - a.ovr);
  const bench: number[] = [], bp = new Set<number>();
  const g = rest.find(P => P.pos === 'GOL');
  if (g) { bench.push(g.u); bp.add(g.id); }
  for (const P of rest) {
    if (bench.length >= 7) break;
    if (bp.has(P.id) || usedP.has(P.id) || bench.includes(P.u)) continue;
    bench.push(P.u); bp.add(P.id);
  }
  while (bench.length < 7) bench.push(0);
  S.squad.bench = bench;
}

export interface TeamInfo { xi: (OwnedCard | null)[]; chem: Chem; slots: SlotDef[]; r: Ratings; ovr: number; full: boolean }
export function teamInfo(S: GameState): TeamInfo {
  const xi = xiCards(S), form = S.squad.form, slots = slotsOf(form), chem = calcChem(xi, form);
  const entries = slots.map((s, i) => ({ pos: s.p, eff: effOvr(xi[i], s.p, chem.per[i]) }));
  const filled = xi.filter(Boolean) as OwnedCard[];
  const ovr = filled.length ? Math.round(filled.reduce((a, P) => a + P.ovr, 0) / 11) : 0;
  return { xi, chem, slots, r: rate(entries), ovr, full: filled.length === 11 };
}

/** Coloca a carta u na vaga (titular ou reserva), trocando de lugar se ela já estiver no time. */
export function applyPick(S: GameState, kind: 'xi' | 'bench', i: number, u: number): { ok: boolean; msg?: string } {
  const xi = S.squad.xi, bench = S.squad.bench;
  const cand = cardByUid(S, u);
  if (!cand) return { ok: false };
  const target = kind === 'xi' ? xi : bench, cur = target[i];
  const jx = xi.indexOf(u), jb = bench.indexOf(u);
  if (kind === 'xi' && jx < 0) {
    const dupe = xi.some((x, k) => x && k !== i && cardByUid(S, x)!.id === cand.id);
    if (dupe) return { ok: false, msg: 'Esse jogador já está escalado em outra versão' };
  }
  if (jx >= 0) xi[jx] = cur || 0;
  else if (jb >= 0) bench[jb] = cur || 0;
  target[i] = u;
  return { ok: true };
}

/** Repetidas vendáveis (mesmo jogador e versão, fora do elenco). A primeira cópia fica. */
export function duplicates(S: GameState): number[] {
  const inSq = new Set([...S.squad.xi, ...S.squad.bench].filter(Boolean));
  const seen = new Set<string>(), out: number[] = [];
  for (const c of S.cards.slice().sort((a, b) => a.u - b.u)) {
    const k = c.p + '|' + c.v;
    if (seen.has(k) && !inSq.has(c.u)) out.push(c.u); else seen.add(k);
  }
  return out;
}

export function today(): string {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
