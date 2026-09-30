// Estado do jogo (o que vai para o save) e operações sobre o elenco.
import { cardData, inPos } from './cards';
import { calcChem, effOvr, rate, type Chem, type Ratings } from './chemistry';
import { slotsOf } from './positions';
import { pick } from './rng';
import { newCareer, type Career, type CareerOpts } from './career';
import type { FormationId, OwnedCard, Pos, SlotDef, StyleId, Variant } from './types';
import { W, getPlayer } from './world';

export const SAVE_VERSION = 4;

export interface CardRef { u: number; p: string; v: Variant }
export interface GameState {
  v: number;
  t: number;
  name: string;
  coins: number;
  uid: number;
  cards: CardRef[];
  squad: { form: FormationId; xi: number[]; bench: number[] };
  tac: { style: StyleId; ment: number };
  /** Modo carreira (null = ainda não escolheu o clube). */
  career: Career | null;
  rec: { w: number; d: number; l: number; gf: number; ga: number; packs: number };
  lastFree: string;
  moments: boolean;
  titles: number;
  /** Mensagem para mostrar uma vez ao abrir o jogo (não é salva de volta). */
  aviso?: string;
}

/** Jogo novo sem clube (a interface pede para escolher o clube da carreira). */
export function blankGame(): GameState {
  return {
    v: SAVE_VERSION, t: Date.now(), name: 'Esquadrão FC', coins: 5000, uid: 1, cards: [],
    squad: { form: '4-3-3', xi: Array(11).fill(0), bench: Array(7).fill(0) },
    tac: { style: 'equilibrado', ment: 2 }, career: null,
    rec: { w: 0, d: 0, l: 0, gf: 0, ga: 0, packs: 0 }, lastFree: '', moments: true, titles: 0,
  };
}

/** Carreira com um clube real: o elenco do clube vira as cartas iniciais. */
export function newCareerGame(club: string, o: CareerOpts = {}): GameState {
  const S = blankGame();
  const c = W.clubs.get(club);
  S.name = c?.n ?? club;
  const squad = W.byClub.get(club) ?? [];
  for (const p of squad) addCard(S, p.id, 'base');
  // Clubes com elenco incompleto nos dados (ex.: Série B) ganham reforços reais de nível parecido.
  if (squad.length < 18) {
    const lvl = c?.forca ?? 66, have = new Set(squad.map(p => p.id));
    const need: Pos[] = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ME', 'MD', 'LD'];
    for (const pos of need.slice(squad.length)) {
      let cand = W.pool.filter(p => p.pos === pos && Math.abs(p.ovr - lvl) <= 3 && !have.has(p.id));
      if (!cand.length) cand = W.pool.filter(p => p.pos === pos && !have.has(p.id));
      const p = pick(cand); have.add(p.id); addCard(S, p.id, 'base');
    }
  }
  S.career = newCareer(club, o);
  autoLineup(S);
  return S;
}

/** Jogo avulso com cartas sorteadas (usado nos testes). */
export function newGame(): GameState {
  const S = blankGame();
  const need: Pos[] = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ME', 'MD', 'LD'];
  const got = new Set<string>();
  for (const pos of need) {
    let cand = W.pool.filter(p => p.pos === pos && p.ovr >= 64 && p.ovr <= 70 && !got.has(p.id));
    if (!cand.length) cand = W.pool.filter(p => p.pos === pos && !got.has(p.id));
    const p = pick(cand);
    got.add(p.id);
    addCard(S, p.id, 'base');
  }
  autoLineup(S);
  return S;
}

export function addCard(S: GameState, p: string, v: Variant): CardRef {
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
  const usedU = new Set<number>(), usedP = new Set<string>(), xi: number[] = Array(11).fill(0);
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
  const bench: number[] = [], bp = new Set<string>();
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

/** Remove cartas de jogadores que não existem mais (ex.: apagados no editor). Retorna quantas saíram. */
export function sanitizeState(S: GameState): number {
  const before = S.cards.length;
  const gone = S.cards.filter(c => !getPlayer(c.p)).map(c => c.u);
  for (const u of gone) removeCard(S, u);
  return before - S.cards.length;
}
