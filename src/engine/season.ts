import { FORM_IDS } from './positions';
import { pick, poisson, ri, shuffle } from './rng';
import { STYLE_IDS } from './tactics';
import type { FormationId, StyleId } from './types';
import { ALL_CLUBS } from './world';

export const DIVS = [{ n: 'Série D', s: 61, m: 1 }, { n: 'Série C', s: 67, m: 1.3 }, { n: 'Série B', s: 72, m: 1.7 }, { n: 'Série A', s: 77, m: 2.2 }, { n: 'Elite Mundial', s: 83, m: 3 }];

export interface Row { P: number; W: number; D: number; L: number; GF: number; GA: number; Pts: number }
export interface OppTeam { n: string; s: string; c1: string; c2: string; lg?: string; str: number; form: FormationId; style: StyleId }
export type SeasonTeam = Row & ({ you: true; n: string; s: string; c1: string; c2: string } | (OppTeam & { you?: false }));
export interface Season { div: number; num: number; round: number; teams: SeasonTeam[]; fx: [number, number][][]; last: [number, number, number, number][] }

export function roundRobin(n: number): [number, number][][] {
  const a = [...Array(n).keys()], rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pr: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) pr.push([a[i], a[n - 1 - i]]);
    rounds.push(pr);
    a.splice(1, 0, a.pop()!);
  }
  return rounds;
}

const emptyRow = (): Row => ({ P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 });

export function newSeason(div: number, num = 1): Season {
  const D = DIVS[div];
  const clubs = shuffle(ALL_CLUBS).slice(0, 9);
  const teams: SeasonTeam[] = [
    { you: true, n: '', s: '', c1: '', c2: '', ...emptyRow() },
    ...clubs.map(c => ({ n: c.n, s: c.s, c1: c.c1, c2: c.c2, lg: c.lg, str: D.s + ri(-4, 4), form: pick(FORM_IDS), style: pick(STYLE_IDS), ...emptyRow() })),
  ];
  return { div, num, round: 0, teams, fx: shuffle(roundRobin(10)), last: [] };
}

export const ROUNDS = 9;

export interface Standing extends Row { i: number; n: string; you: boolean }
export function standings(se: Season, yourName: string): Standing[] {
  return se.teams
    .map((t, i) => ({ ...t, i, you: !!t.you, n: t.you ? yourName : t.n }))
    .sort((a, b) => b.Pts - a.Pts || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF);
}

export function applyResult(t: Row, gf: number, ga: number): void {
  t.P++; t.GF += gf; t.GA += ga;
  if (gf > ga) { t.W++; t.Pts += 3; } else if (gf === ga) { t.D++; t.Pts++; } else t.L++;
}

export function quickSim(a: number, b: number): [number, number] {
  const d = (a - b) * .07;
  return [poisson(1.35 * Math.exp(d)), poisson(1.35 * Math.exp(-d))];
}

export function nextOpponent(se: Season): OppTeam {
  const oppI = se.fx[se.round].find(p => p.includes(0))!.find(i => i !== 0)!;
  return se.teams[oppI] as OppTeam;
}

/** Lança o resultado do usuário e simula o resto da rodada. */
export function finishRound(se: Season, gYou: number, gOpp: number): void {
  const pairs = se.fx[se.round];
  se.last = [];
  for (const [x, y] of pairs) {
    let gx: number, gy: number;
    if (x === 0 || y === 0) { const you = x === 0; gx = you ? gYou : gOpp; gy = you ? gOpp : gYou; }
    else [gx, gy] = quickSim((se.teams[x] as OppTeam).str, (se.teams[y] as OppTeam).str);
    applyResult(se.teams[x], gx, gy); applyResult(se.teams[y], gy, gx);
    se.last.push([x, y, gx, gy]);
  }
  se.round++;
}

export interface SeasonEnd { pos: number; coins: number; newDiv: number; msg: string; title: boolean; pack: 'premium' | 'ouro' | null }
/** Calcula prêmios, acesso e rebaixamento. Não altera o estado. */
export function seasonEnd(se: Season, yourName: string): SeasonEnd {
  const table = standings(se, yourName), pos = table.findIndex(t => t.you) + 1, D = DIVS[se.div];
  const coins = Math.round([15000, 10000, 7500, 5000, 4000, 3000, 2500, 2000, 1500, 1000][pos - 1] * D.m);
  let nd = se.div, msg = `${pos}º lugar: +${coins.toLocaleString('pt-BR')} moedas.`, title = false;
  if (pos <= 3 && se.div < 4) { nd++; msg += ` Acesso para a ${DIVS[nd].n}!`; }
  else if (pos === 1 && se.div === 4) { title = true; msg += ' Campeão da Elite Mundial!'; }
  else if (pos >= 9 && se.div > 0) { nd--; msg += ` Rebaixado para a ${DIVS[nd].n}.`; }
  return { pos, coins, newDiv: nd, msg, title, pack: pos === 1 ? 'premium' : pos <= 3 ? 'ouro' : null };
}
