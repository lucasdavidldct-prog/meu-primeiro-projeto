// Copas da carreira além da Libertadores: Copa do Brasil (mata-mata com os clubes das Séries A e B) e
// Super Mundial de Clubes (32 clubes do mundo: 8 grupos de 4 e mata-mata em jogo único, campo neutro).
// Tudo serializável (vai para o save) e sem interface.
import { R, shuffle } from './rng';
import { applyResult, emptyRow, quickSim, roundRobin, sortTable } from './season';
import { clubStrength } from './squads';
import { W, leagueClubs } from './world';
import type { CupTie, LibGroup, Res } from './career';

export type CopaId = 'cdb' | 'mundial';
export const COPA_N: Record<CopaId, string> = { cdb: 'Copa do Brasil', mundial: 'Super Mundial de Clubes' };
export interface KoRound { nome: string; legs: 1 | 2; ties: CupTie[] }
export interface Copa {
  id: CopaId; nome: string; year: number;
  /** Fase de grupos (só no Mundial): grupos de 4, turno único. */
  groups: LibGroup[]; groupRound: number;
  /** Rodadas do mata-mata, na ordem; `cur` = a que está sendo jogada (-1 enquanto houver grupos). */
  rounds: KoRound[]; cur: number;
  /** Campo neutro em todos os jogos (Mundial). */
  neutral: boolean;
  champion?: string; last: Res[];
}
export type CopaItem = { c: 'copa'; id: CopaId; g: number } | { c: 'copa'; id: CopaId; r: number; leg: 0 | 1 };

const CDB_ROUNDS: [string, 1 | 2][] = [['1ª fase', 1], ['Oitavas de final', 2], ['Quartas de final', 2], ['Semifinal', 2], ['Final', 2]];
const MUN_ROUNDS: [string, 1 | 2][] = [['Oitavas de final', 1], ['Quartas de final', 1], ['Semifinal', 1], ['Final', 1]];

const pares = (ids: string[]): CupTie[] => {
  const out: CupTie[] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) out.push({ a: ids[i], b: ids[i + 1], legs: [] });
  return out;
};
const comLegs = (ties: CupTie[], legs: 1 | 2) => ties.map(t => ({ ...t, legs: Array.from({ length: legs }, () => null) }));

/** Copa do Brasil: 32 clubes (toda a Série A + os 12 mais fortes da Série B, com o seu clube garantido). Sorteio a cada fase. */
export function makeCdb(year: number, serieA: string[], serieB: string[], user: string): Copa {
  const b = [...serieB].sort((x, y) => clubStrength(y) - clubStrength(x));
  let teams = [...serieA, ...b.slice(0, 12)];
  if (!teams.includes(user)) teams = [...teams.slice(0, 31), user];
  const rounds: KoRound[] = CDB_ROUNDS.map(([nome, legs]) => ({ nome, legs, ties: [] }));
  rounds[0].ties = comLegs(pares(shuffle(teams.slice(0, 32))), rounds[0].legs);
  return { id: 'cdb', nome: COPA_N.cdb, year, groups: [], groupRound: 0, rounds, cur: 0, neutral: false, last: [] };
}

/** Quem joga o Super Mundial: o seu clube (se classificado), 4 brasileiros, 4 sul-americanos e os gigantes das outras ligas. */
export function mundialTeams(user: string | null, br: string[]): string[] {
  const forca = (ids: string[]) => [...ids].sort((a, b) => clubStrength(b) - clubStrength(a));
  const out = user ? [user] : [];
  const add = (ids: string[], n: number) => { for (const id of forca(ids)) { if (n <= 0) break; if (!out.includes(id)) { out.push(id); n--; } } };
  add(br, 4);
  add(leagueClubs('conmebol').map(c => c.id), 4);
  const cota: [string, number][] = [['premier-league', 6], ['laliga', 5], ['serie-a', 4], ['bundesliga', 4], ['saudi-pro-league', 2], ['mls', 2]];
  for (const [lg, n] of cota) add(leagueClubs(lg).map(c => c.id), n);
  // Completa até 32 com os mais fortes que sobraram
  if (out.length < 32) add([...W.clubs.keys()], 32 - out.length);
  return out.slice(0, 32);
}

export function makeMundial(year: number, teams: string[]): Copa {
  const ord = [...teams].sort((a, b) => clubStrength(b) - clubStrength(a));
  // 4 potes por força; cada grupo recebe um de cada pote
  const pots = [0, 1, 2, 3].map(p => shuffle(ord.slice(p * 8, p * 8 + 8)));
  const groups: LibGroup[] = Array.from({ length: 8 }, (_, g) => {
    const t = pots.map(p => p[g]).filter(Boolean);
    return { teams: t, rounds: roundRobin(t.length), table: t.map(emptyRow) };
  });
  const rounds: KoRound[] = MUN_ROUNDS.map(([nome, legs]) => ({ nome, legs, ties: [] }));
  return { id: 'mundial', nome: COPA_N.mundial, year, groups, groupRound: 0, rounds, cur: -1, neutral: true, last: [] };
}

/** Itens de calendário da copa (o jogador só joga os que o envolvem; os outros são simulados). */
export function copaItems(C: Copa): CopaItem[] {
  const g: CopaItem[] = C.groups.length ? Array.from({ length: C.groups[0].rounds.length }, (_, i) => ({ c: 'copa', id: C.id, g: i })) : [];
  const ko = C.rounds.flatMap((r, ri) => Array.from({ length: r.legs }, (_, leg) => ({ c: 'copa', id: C.id, r: ri, leg: leg as 0 | 1 }) as CopaItem));
  return [...g, ...ko];
}

function tieWinner(t: CupTie): string | undefined {
  if (!t.legs.length || t.legs.some(l => !l)) return undefined;
  const a = t.legs.reduce((s, l) => s + l![0], 0), b = t.legs.reduce((s, l) => s + l![1], 0);
  if (a !== b) return a > b ? t.a : t.b;
  if (t.pens) return t.pens[0] > t.pens[1] ? t.a : t.b;
  return undefined;
}
const aiPens = (a: string, b: string): [number, number] => (R() < .5 + (clubStrength(a) - clubStrength(b)) * .01 ? [5, 4] : [4, 5]);

function aposGrupos(C: Copa): void {
  const st = C.groups.map(g => sortTable(g.teams, g.table));
  const w = (g: number, p: number) => st[g][p - 1]?.id;
  const ids: string[] = [];
  for (let g = 0; g < 8; g += 2) ids.push(w(g, 1), w(g + 1, 2), w(g + 1, 1), w(g, 2));
  C.rounds[0].ties = comLegs(pares(ids.filter(Boolean)), C.rounds[0].legs);
  C.cur = 0;
}
function proximaFase(C: Copa): void {
  const win = C.rounds[C.cur].ties.map(t => t.winner!);
  if (C.cur >= C.rounds.length - 1) { C.champion = win[0]; C.cur = C.rounds.length; return; }
  C.cur++;
  // Copa do Brasil: sorteio a cada fase; Mundial: chave fixa
  C.rounds[C.cur].ties = comLegs(pares(C.id === 'cdb' ? shuffle(win) : win), C.rounds[C.cur].legs);
}

export interface UserScore { club: string; gf: number; ga: number; pens?: [number, number] }
/** Joga uma data da copa. `user` traz o placar do usuário (do ponto de vista dele) e pênaltis, se houver. */
export function playCopaItem(C: Copa, it: CopaItem, user?: UserScore): void {
  C.last = [];
  if ('g' in it) {
    for (const g of C.groups) {
      for (const [h, a] of g.rounds[C.groupRound] ?? []) {
        const H = g.teams[h], A = g.teams[a];
        let gh: number, ga: number;
        if (user && H === user.club) [gh, ga] = [user.gf, user.ga];
        else if (user && A === user.club) [gh, ga] = [user.ga, user.gf];
        else [gh, ga] = quickSim(H, A, null);
        applyResult(g.table[h], gh, ga); applyResult(g.table[a], ga, gh);
        C.last.push({ h: H, a: A, gh, ga });
      }
    }
    C.groupRound++;
    if (C.groupRound >= C.groups[0].rounds.length) aposGrupos(C);
    return;
  }
  const R0 = C.rounds[it.r];
  if (!R0 || it.r !== C.cur) return;
  const leg = it.leg;
  // Data já jogada (ex.: ao fechar a temporada): não joga de novo
  if (R0.ties.every(t => t.legs[leg])) return;
  for (const t of R0.ties) {
    const home = C.neutral ? null : leg === 0 ? t.a : t.b, other = home === t.a ? t.b : t.a;
    const involved = user && (t.a === user.club || t.b === user.club);
    let gHome: number, gOther: number;
    if (involved) {
      const userIsHome = home === user!.club || (home === null && t.a === user!.club);
      [gHome, gOther] = userIsHome ? [user!.gf, user!.ga] : [user!.ga, user!.gf];
    } else [gHome, gOther] = quickSim(home ?? t.a, other, home === null ? null : 0);
    const hId = home ?? t.a;
    t.legs[leg] = hId === t.a ? [gHome, gOther] : [gOther, gHome];
    const last = leg === t.legs.length - 1;
    if (last && !tieWinner(t)) t.pens = involved && user!.pens ? (t.a === user!.club ? user!.pens : [user!.pens[1], user!.pens[0]]) : aiPens(t.a, t.b);
    if (last) t.winner = tieWinner(t);
    const r: Res = { h: hId, a: hId === t.a ? t.b : t.a, gh: gHome, ga: gOther };
    if (last && t.pens) r.pens = hId === t.a ? t.pens : [t.pens[1], t.pens[0]];
    C.last.push(r);
  }
  if (R0.ties.every(t => t.winner)) proximaFase(C);
}

/** O usuário joga esta data? */
export function userInCopa(C: Copa, it: CopaItem, club: string): boolean {
  if ('g' in it) return C.groups.some(g => g.teams.includes(club));
  return it.r === C.cur && C.rounds[it.r].ties.some(t => t.a === club || t.b === club);
}

/** Onde o usuário chegou (para a tela, o histórico e os prêmios). */
export function copaStatus(C: Copa, club: string): string {
  if (C.champion === club) return 'Campeão';
  for (let i = C.rounds.length - 1; i >= 0; i--) {
    const t = C.rounds[i].ties.find(x => x.a === club || x.b === club);
    if (!t) continue;
    if (t.winner && t.winner !== club) return i === C.rounds.length - 1 ? 'Vice-campeão' : `Eliminado: ${C.rounds[i].nome.toLowerCase()}`;
    return C.rounds[i].nome;
  }
  if (C.groups.some(g => g.teams.includes(club))) return C.cur < 0 ? 'Fase de grupos' : 'Eliminado na fase de grupos';
  return 'Fora';
}

/** Nome da fase atual. */
export const copaFase = (C: Copa): string => (C.champion ? 'Encerrada' : C.cur < 0 ? 'Fase de grupos' : C.rounds[C.cur]?.nome ?? 'Encerrada');

/** Prêmio em moedas pela campanha. */
export function copaPremio(id: CopaId, status: string): number {
  const t: Record<CopaId, [number, number, number, number, number]> = { cdb: [70000, 40000, 22000, 12000, 6000], mundial: [150000, 80000, 45000, 25000, 12000] };
  const [camp, vice, semi, quartas, resto] = t[id];
  return status === 'Campeão' ? camp : status === 'Vice-campeão' ? vice : /semifinal/i.test(status) ? semi : /quartas/i.test(status) ? quartas : status === 'Fora' ? 0 : resto;
}

