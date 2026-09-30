// Evolução dos jogadores entre temporadas (opção da carreira): jovens sobem, veteranos caem, todo mundo envelhece.
// O save guarda só a diferença acumulada de cada jogador; os dados originais continuam intactos.
import { clearCardCache } from './cards';
import { R, clamp, type Rng } from './rng';
import { clearStrengthCache } from './squads';
import type { BasePlayer } from './types';
import { W } from './world';

/** Diferença acumulada por jogador: o = overall, a = idade. */
export type Evo = Record<string, { o: number; a: number }>;

const orig = new WeakMap<BasePlayer, { ovr: number; st: number[]; age: number }>();
const base = (P: BasePlayer) => { let o = orig.get(P); if (!o) { o = { ovr: P.ovr, st: P.st.slice(), age: P.age }; orig.set(P, o); } return o; };

/** Aplica a evolução guardada no save por cima dos dados originais (vazio = volta ao original). */
export function applyEvolution(evo: Evo | undefined): void {
  for (const P of W.players.values()) {
    if (P.leg) continue;
    const o = base(P), d = evo?.[P.id];
    P.ovr = clamp(o.ovr + (d?.o ?? 0), 35, 97);
    P.age = o.age + (d?.a ?? 0);
    const k = P.ovr - o.ovr;
    P.st = o.st.map(v => clamp(Math.round(v + k * .9), 15, 99));
  }
  clearCardCache(); clearStrengthCache();
}

/** Faixa de evolução por idade (mín., máx.) em pontos de overall por temporada. */
export function faixa(age: number): [number, number] {
  return age <= 20 ? [1, 6] : age <= 23 ? [0, 4] : age <= 27 ? [-1, 2] : age <= 30 ? [-2, 1] : age <= 32 ? [-3, 0] : age <= 34 ? [-5, -1] : [-7, -2];
}

export interface Mudanca { id: string; de: number; para: number; idade: number }
/** Passa uma temporada: todos envelhecem um ano e o overall muda conforme a idade (com um pouco de sorte). */
export function evolveSeason(evo: Evo, r: Rng = R): Mudanca[] {
  const out: Mudanca[] = [];
  for (const P of W.pool) {
    if (P.leg || P.filler) continue;
    const [lo, hi] = faixa(P.age);
    // Quem já está no topo cresce menos
    const teto = P.ovr >= 88 ? .5 : P.ovr >= 84 ? .75 : 1;
    let d = Math.round(lo + r() * (hi - lo));
    if (d > 0) d = Math.round(d * teto);
    const cur = evo[P.id] ?? { o: 0, a: 0 };
    const para = clamp(P.ovr + d, 35, 97);
    evo[P.id] = { o: cur.o + (para - P.ovr), a: cur.a + 1 };
    if (para !== P.ovr) out.push({ id: P.id, de: P.ovr, para, idade: P.age + 1 });
  }
  return out;
}
