// Utilidades de competição: tabelas, tabelas de jogos, simulação rápida entre clubes da IA.
import { pick, poisson } from './rng';
import { aiTactics, clubStrength } from './squads';
import type { FormationId, StyleId } from './types';
import { W, type ClubInfo } from './world';

export interface Row { P: number; W: number; D: number; L: number; GF: number; GA: number; Pts: number }
export interface OppTeam { club: string; n: string; s: string; c1: string; c2: string; lg?: string; str: number; form: FormationId; style: StyleId }

export const emptyRow = (): Row => ({ P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 });

/** Tabela de turno (método do círculo); n par. Alterna mando para não repetir casa/fora demais. */
export function roundRobin(n: number): [number, number][][] {
  const a = [...Array(n).keys()], rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pr: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = a[i], y = a[n - 1 - i];
      pr.push(i === 0 && r % 2 ? [y, x] : (i % 2 ? [y, x] : [x, y]));
    }
    rounds.push(pr);
    a.splice(1, 0, a.pop()!);
  }
  return rounds;
}
/** Turno e returno (o returno inverte o mando). */
export const doubleRoundRobin = (n: number): [number, number][][] => {
  const t = roundRobin(n);
  return [...t, ...t.map(r => r.map(([h, a]) => [a, h] as [number, number]))];
};

export function applyResult(t: Row, gf: number, ga: number): void {
  t.P++; t.GF += gf; t.GA += ga;
  if (gf > ga) { t.W++; t.Pts += 3; } else if (gf === ga) { t.D++; t.Pts++; } else t.L++;
}

/** Placar rápido entre dois clubes da IA (calibrado para se parecer com o motor completo). */
export function quickSim(a: string, b: string, home: 0 | 1 | null = 0, r?: () => number): [number, number] {
  const d = (clubStrength(a) - clubStrength(b)) * .06;
  const ha = home === 0 ? 1.13 : home === 1 ? .9 : 1, hb = home === 1 ? 1.13 : home === 0 ? .9 : 1;
  return [poisson(1.3 * Math.exp(d) * ha, r), poisson(1.3 * Math.exp(-d) * hb, r)];
}

/** Adversário real com tática da IA coerente com o elenco e com o seu time. */
export function oppFromClub(c: ClubInfo, yourStrength?: number): OppTeam {
  const t = aiTactics(c.id, yourStrength ?? clubStrength(c.id));
  return { club: c.id, n: c.n, s: c.s, c1: c.c1, c2: c.c2, lg: c.lg, str: clubStrength(c.id), form: t.form, style: t.style };
}
export const oppFromId = (id: string, yourStrength?: number): OppTeam => oppFromClub(W.clubs.get(id)!, yourStrength);

export interface Standing extends Row { id: string; n: string; pos: number }
export function sortTable(ids: string[], rows: Row[]): Standing[] {
  return ids.map((id, i) => ({ ...rows[i], id, n: W.clubs.get(id)?.n ?? id, pos: 0 }))
    .sort((x, y) => y.Pts - x.Pts || y.W - x.W || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF || x.n.localeCompare(y.n))
    .map((s, i) => ({ ...s, pos: i + 1 }));
}
export { pick };
