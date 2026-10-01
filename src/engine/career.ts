// Modo carreira: Brasileirão (Série A ou B), Libertadores e outras ligas simuladas em segundo plano.
// Tudo aqui é serializável (vai para o save) e sem interface.
import { R, shuffle, wpick } from './rng';
import type { Pos } from './types';
import { applyResult, doubleRoundRobin, emptyRow, quickSim, roundRobin, sortTable, type Row, type Standing } from './season';
import { clubStrength } from './squads';
import { W, leagueClubs } from './world';
import { copaItems, copaPremio, copaStatus, makeCdb, makeMundial, mundialTeams, playCopaItem, userInCopa, type Copa, type CopaId, type CopaItem } from './copas';

export const MAIN_LEAGUES = ['premier-league', 'laliga', 'serie-a', 'bundesliga', 'saudi-pro-league', 'mls'];
export const LIB_SIZE = 16;
export const LIB_BR = 5;

export interface Res { h: string; a: string; gh: number; ga: number; pens?: [number, number] }
export interface LeagueComp { id: string; name: string; teams: string[]; rounds: [number, number][][]; round: number; table: Row[]; last: Res[];
  /** Artilharia e assistências da liga (id do jogador → gols, assistências e clube). */
  art?: Record<string, { g: number; a: number; c: string }> }
export interface CupTie { a: string; b: string; legs: ([number, number] | null)[]; pens?: [number, number]; winner?: string }
export type LibPhase = 'grupos' | 'quartas' | 'semi' | 'final' | 'fim';
export interface LibGroup { teams: string[]; rounds: [number, number][][]; table: Row[] }
export interface CupComp { year: number; groups: LibGroup[]; groupRound: number; phase: LibPhase; ties: Record<'quartas' | 'semi' | 'final', CupTie[]>; champion?: string; last: Res[] }

export type CalItem = { c: 'liga'; round: number } | { c: 'lib'; phase: 'grupos'; round: number } | { c: 'lib'; phase: 'quartas' | 'semi'; leg: 0 | 1 } | { c: 'lib'; phase: 'final' } | CopaItem;
export interface Trophy { comp: 'brasileirao' | 'serie-b' | 'libertadores' | 'copa-do-brasil' | 'mundial'; name: string; year: number }
export interface SeasonRecord { year: number; div: 'A' | 'B'; pos: number; pts: number; lib: string | null; coins: number; /** Campanha na Copa do Brasil e no Super Mundial. */ cdb?: string; mundial?: string; /** Artilheiro do seu time na temporada. */ art?: string }

export interface Career {
  club: string;
  year: number;
  short: boolean;
  div: 'A' | 'B';
  brTeams: string[];
  sbTeams: string[];
  league: LeagueComp;
  lib: CupComp | null;
  others: LeagueComp[];
  cal: CalItem[];
  idx: number;
  libNext: string[];
  trophies: Trophy[];
  history: SeasonRecord[];
  /** Opções escolhidas ao começar: evolução dos jogadores e mercado de leilão. */
  evo?: boolean;
  mercado?: boolean;
  /** Números dos seus jogadores na temporada atual (gols, assistências, jogos, soma das notas). */
  stats?: Record<string, { g: number; a: number; j: number; n: number; /** desarmes, erros, defesas, finalizações e id do jogador */ d?: number; e?: number; s?: number; f?: number; id?: string }>;
  /** Fase alcançada na Libertadores desta temporada (para o histórico e os prêmios). */
  libReached: string | null;
  /** Copa do Brasil e Super Mundial desta temporada (saves antigos não têm: entram na próxima temporada). */
  copas?: Copa[];
  /** Classificado para o Super Mundial da próxima temporada. */
  mundialNext?: boolean;
  /** Jogadores fora (id do jogador): suspensos ou lesionados, com quantos jogos faltam. */
  fora?: Record<string, { t: 'susp' | 'les'; n: number }>;
  /** Amarelos acumulados (3 = suspensão de 1 jogo). */
  amarelos?: Record<string, number>;
}

/** Aplica cartões e lesões da partida: quem estava fora cumpre um jogo; expulsão e 3º amarelo suspendem; lesão tira de 1 a 4 jogos. */
export function applyIncidents(C: Career, inc: { y: string[]; r: string[]; les: { id: string; jogos: number }[] }): string[] {
  const fora = C.fora ??= {}, am = C.amarelos ??= {}, avisos: string[] = [];
  for (const id of Object.keys(fora)) if (--fora[id].n <= 0) delete fora[id];
  for (const id of inc.r) { fora[id] = { t: 'susp', n: 1 }; delete am[id]; avisos.push(id + '|vermelho'); }
  for (const id of inc.y) {
    if (inc.r.includes(id)) continue;
    am[id] = (am[id] ?? 0) + 1;
    if (am[id] >= 3) { fora[id] = { t: 'susp', n: 1 }; delete am[id]; avisos.push(id + '|amarelos'); }
  }
  for (const l of inc.les) { fora[l.id] = { t: 'les', n: Math.max(fora[l.id]?.n ?? 0, l.jogos) }; avisos.push(l.id + '|lesao'); }
  return avisos;
}

export interface Fixture {
  comp: 'liga' | 'lib' | 'copa';
  /** Qual copa (Copa do Brasil ou Super Mundial). */
  copa?: CopaId;
  label: string;
  opp: string;
  /** Mandante: 0 = você, 1 = adversário, null = campo neutro. */
  home: 0 | 1 | null;
  mult: number;
  /** Mata-mata: placar agregado antes do jogo (você, adversário) e se é o jogo decisivo. */
  ko?: { phase: string; leg: 0 | 1; agg: [number, number]; decisive: boolean; final?: boolean };
}

const LEAGUE_NAMES: Record<string, string> = { brasileirao: 'Brasileirão Série A', 'serie-b': 'Brasileirão Série B' };
const PHASE_N: Record<string, string> = { grupos: 'Fase de grupos', quartas: 'Quartas de final', semi: 'Semifinal', final: 'Final', fim: 'Encerrada' };
export const phaseName = (p: string): string => PHASE_N[p] ?? p;

function makeLeague(id: string, teams: string[], single: boolean): LeagueComp {
  const ids = shuffle(teams);
  const rounds = single ? roundRobin(ids.length) : doubleRoundRobin(ids.length);
  return { id, name: LEAGUE_NAMES[id] ?? W.leagues.find(l => l.id === id)?.n ?? id, teams: ids, rounds, round: 0, table: ids.map(emptyRow), last: [] };
}

/** Joga uma rodada de liga. `user` recebe o resultado do jogo do usuário (se houver). */
/** Distribui os gols de um clube da IA entre os jogadores (atacantes e bons finalizadores marcam mais; meias dão mais assistências). */
const GOL_W: Partial<Record<Pos, number>> = { ATA: 6, PD: 3.5, PE: 3.5, MEI: 3, MD: 1.6, ME: 1.6, MC: 1.2, VOL: .5, LD: .35, LE: .35, ZAG: .5 };
const AST_W: Partial<Record<Pos, number>> = { MEI: 4, PD: 3, PE: 3, MD: 2.6, ME: 2.6, MC: 2.5, ATA: 2, LD: 1.3, LE: 1.3, VOL: 1, ZAG: .3 };
function creditGoals(L: LeagueComp, club: string, goals: number): void {
  if (!goals) return;
  const squad = (W.byClub.get(club) ?? []).filter(p => !p.filler && p.pos !== 'GOL').sort((a, b) => b.ovr - a.ovr).slice(0, 16);
  if (!squad.length) return;
  const art = L.art ??= {};
  const w = (m: Partial<Record<Pos, number>>, k: number) => squad.map(p => [p, (m[p.pos] ?? .2) * Math.pow((p.st[k] ?? 70) / 70, 3) * Math.pow(p.ovr / 75, 2)] as const);
  const wg = w(GOL_W, 1), wa = w(AST_W, 2);
  for (let i = 0; i < goals; i++) {
    const s = wpick(wg);
    (art[s.id] ??= { g: 0, a: 0, c: club }).g++;
    const outros = wa.filter(([p]) => p !== s);
    if (outros.length && R() < .72) { const a = wpick(outros); (art[a.id] ??= { g: 0, a: 0, c: club }).a++; }
  }
}

function playLeagueRound(L: LeagueComp, user?: { club: string; gf: number; ga: number; nums?: { id: string; g: number; a: number }[] }): void {
  const pairs = L.rounds[L.round];
  if (!pairs) return;
  L.last = [];
  for (const [h, a] of pairs) {
    const H = L.teams[h], A = L.teams[a];
    let gh: number, ga: number;
    if (user && H === user.club) [gh, ga] = [user.gf, user.ga];
    else if (user && A === user.club) [gh, ga] = [user.ga, user.gf];
    else [gh, ga] = quickSim(H, A, 0);
    applyResult(L.table[h], gh, ga); applyResult(L.table[a], ga, gh);
    // Artilharia: seus gols vêm da partida; os da IA são distribuídos pelo elenco
    for (const [club, g] of [[H, gh], [A, ga]] as const) {
      if (user && club === user.club) { const art = L.art ??= {}; for (const n of user.nums ?? []) if (n.g || n.a) { const r = art[n.id] ??= { g: 0, a: 0, c: club }; r.g += n.g; r.a += n.a; } }
      else creditGoals(L, club, g);
    }
    L.last.push({ h: H, a: A, gh, ga });
  }
  L.round++;
}
export const leagueStandings = (L: LeagueComp): Standing[] => sortTable(L.teams, L.table);
export const groupStandings = (g: LibGroup): Standing[] => sortTable(g.teams, g.table);

// ---------- Libertadores ----------
function libParticipants(br: string[]): string[] {
  const pool = leagueClubs('conmebol').map(c => c.id);
  const out = [...br];
  const cand = [...pool];
  while (out.length < LIB_SIZE && cand.length) {
    const id = wpick(cand.map(c => [c, Math.pow(clubStrength(c) - 60, 2)] as const));
    out.push(id); cand.splice(cand.indexOf(id), 1);
  }
  return out;
}
function makeLib(year: number, br: string[]): CupComp {
  const parts = libParticipants(br).sort((a, b) => clubStrength(b) - clubStrength(a));
  // 4 potes por força; cada grupo recebe um de cada pote
  const pots = [0, 1, 2, 3].map(p => shuffle(parts.slice(p * 4, p * 4 + 4)));
  const groups: LibGroup[] = [0, 1, 2, 3].map(g => {
    const teams = pots.map(p => p[g]);
    return { teams, rounds: doubleRoundRobin(4), table: teams.map(emptyRow) };
  });
  return { year, groups, groupRound: 0, phase: 'grupos', ties: { quartas: [], semi: [], final: [] }, last: [] };
}

function tieWinner(t: CupTie): string | undefined {
  if (t.legs.some(l => !l)) return undefined;
  const a = t.legs.reduce((s, l) => s + l![0], 0), b = t.legs.reduce((s, l) => s + l![1], 0);
  if (a !== b) return a > b ? t.a : t.b;
  if (t.pens) return t.pens[0] > t.pens[1] ? t.a : t.b;
  return undefined;
}
function aiPens(a: string, b: string): [number, number] {
  const pa = .5 + (clubStrength(a) - clubStrength(b)) * .01;
  return R() < pa ? [5, 4] : [4, 5];
}

function libAfterGroups(L: CupComp): void {
  const st = L.groups.map(groupStandings);
  const w = (g: number, p: number) => st[g][p - 1].id;
  // 1º colocado decide em casa (é o "b" da ida → joga o 2º jogo em casa)
  L.ties.quartas = [[w(1, 2), w(0, 1)], [w(0, 2), w(1, 1)], [w(3, 2), w(2, 1)], [w(2, 2), w(3, 1)]].map(([a, b]) => ({ a, b, legs: [null, null] }));
  L.phase = 'quartas';
}
function libNextPhase(L: CupComp): void {
  if (L.phase === 'quartas') {
    const q = L.ties.quartas.map(t => t.winner!);
    L.ties.semi = [{ a: q[0], b: q[1], legs: [null, null] }, { a: q[2], b: q[3], legs: [null, null] }];
    L.phase = 'semi';
  } else if (L.phase === 'semi') {
    const s = L.ties.semi.map(t => t.winner!);
    L.ties.final = [{ a: s[0], b: s[1], legs: [null] }];
    L.phase = 'final';
  } else if (L.phase === 'final') {
    L.champion = L.ties.final[0].winner; L.phase = 'fim';
  }
}

/** Joga uma data da Libertadores. `user` traz o placar do usuário (do ponto de vista dele) e pênaltis se houver. */
function playLibItem(L: CupComp, it: Extract<CalItem, { c: 'lib' }>, user?: { club: string; gf: number; ga: number; pens?: [number, number] }): void {
  L.last = [];
  if (it.phase === 'grupos') {
    for (const g of L.groups) {
      for (const [h, a] of g.rounds[L.groupRound]) {
        const H = g.teams[h], A = g.teams[a];
        let gh: number, ga: number;
        if (user && H === user.club) [gh, ga] = [user.gf, user.ga];
        else if (user && A === user.club) [gh, ga] = [user.ga, user.gf];
        else [gh, ga] = quickSim(H, A, 0);
        applyResult(g.table[h], gh, ga); applyResult(g.table[a], ga, gh);
        L.last.push({ h: H, a: A, gh, ga });
      }
    }
    L.groupRound++;
    if (L.groupRound >= 6) libAfterGroups(L);
    return;
  }
  const phase = it.phase, leg = it.phase === 'final' ? 0 : it.leg;
  for (const t of L.ties[phase]) {
    // Na ida o mandante é "a"; na volta, "b". Final em campo neutro.
    const home = phase === 'final' ? null : leg === 0 ? t.a : t.b;
    const other = home === t.a ? t.b : t.a;
    let gHome: number, gOther: number;
    const involved = user && (t.a === user.club || t.b === user.club);
    if (involved) {
      const userIsHome = home === user!.club || (home === null && t.a === user!.club);
      [gHome, gOther] = userIsHome ? [user!.gf, user!.ga] : [user!.ga, user!.gf];
    } else [gHome, gOther] = quickSim(home ?? t.a, other, home === null ? null : 0);
    const hId = home ?? t.a;
    t.legs[leg] = hId === t.a ? [gHome, gOther] : [gOther, gHome];
    const last = t.legs.length - 1 === leg;
    if (last && !tieWinner(t)) t.pens = involved && user!.pens ? (t.a === user!.club ? user!.pens : [user!.pens[1], user!.pens[0]]) : aiPens(t.a, t.b);
    if (last) t.winner = tieWinner(t);
    const r: Res = { h: hId, a: hId === t.a ? t.b : t.a, gh: gHome, ga: gOther };
    if (last && t.pens) r.pens = hId === t.a ? t.pens : [t.pens[1], t.pens[0]];
    L.last.push(r);
  }
  if (L.ties[phase].every(t => t.winner)) libNextPhase(L);
}

export function libUserStatus(L: CupComp, club: string): string {
  if (L.champion === club) return 'Campeão';
  for (const ph of ['final', 'semi', 'quartas'] as const) {
    const t = L.ties[ph].find(x => x.a === club || x.b === club);
    if (t) return t.winner && t.winner !== club ? (ph === 'final' ? 'Vice-campeão' : `Eliminado nas ${ph === 'quartas' ? 'quartas' : 'semifinais'}`) : phaseName(ph);
  }
  return L.phase === 'grupos' ? 'Fase de grupos' : 'Eliminado na fase de grupos';
}

// ---------- Calendário ----------
/** Espalha as datas das copas entre as rodadas da liga (cada copa num trecho da temporada). */
function buildCalendar(ligaRounds: number, withLib: boolean, extras: { items: CalItem[]; de: number; ate: number }[] = []): CalItem[] {
  const lib: CalItem[] = withLib ? [
    ...[0, 1, 2, 3, 4, 5].map(round => ({ c: 'lib', phase: 'grupos', round }) as CalItem),
    { c: 'lib', phase: 'quartas', leg: 0 }, { c: 'lib', phase: 'quartas', leg: 1 },
    { c: 'lib', phase: 'semi', leg: 0 }, { c: 'lib', phase: 'semi', leg: 1 },
    { c: 'lib', phase: 'final' },
  ] : [];
  const listas = [{ items: lib, de: 0, ate: .9 }, ...extras];
  const marcados: { at: number; ord: number; it: CalItem }[] = [];
  listas.forEach((L, li) => L.items.forEach((it, i) => {
    const f = L.de + (L.ate - L.de) * (i + 1) / (L.items.length + 1);
    marcados.push({ at: Math.max(1, Math.round(f * ligaRounds)), ord: li * 1000 + i, it });
  }));
  marcados.sort((p, q) => p.at - q.at || p.ord - q.ord);
  const cal: CalItem[] = [];
  let k = 0;
  for (let r = 0; r < ligaRounds; r++) {
    cal.push({ c: 'liga', round: r });
    while (k < marcados.length && marcados[k].at === r + 1) cal.push(marcados[k++].it);
  }
  while (k < marcados.length) cal.push(marcados[k++].it);
  return cal;
}

// ---------- Temporada ----------
function newSeasonComps(c: Pick<Career, 'club' | 'year' | 'short' | 'div' | 'brTeams' | 'sbTeams' | 'libNext' | 'mundialNext'>): Pick<Career, 'league' | 'lib' | 'others' | 'cal' | 'idx' | 'libReached' | 'copas'> {
  const league = c.div === 'A' ? makeLeague('brasileirao', c.brTeams, c.short) : makeLeague('serie-b', c.sbTeams, c.short);
  const withLib = c.div === 'A' && c.libNext.includes(c.club);
  const brLib = c.libNext.slice(0, LIB_BR);
  if (withLib && !brLib.includes(c.club)) brLib[LIB_BR - 1] = c.club;
  const lib = withLib ? makeLib(c.year, brLib) : null;
  const others = [
    ...(c.div === 'B' ? [makeLeague('brasileirao', c.brTeams, false)] : []),
    ...MAIN_LEAGUES.map(id => makeLeague(id, leagueClubs(id).map(x => x.id), id === 'mls')),
  ];
  // Copa do Brasil (todo ano, Séries A e B) e Super Mundial (só para quem se classificou)
  const cdb = makeCdb(c.year, c.brTeams, c.sbTeams, c.club);
  const mundial = c.mundialNext ? makeMundial(c.year, mundialTeams(c.club, c.brTeams)) : null;
  const copas = [cdb, ...(mundial ? [mundial] : [])];
  const extras = [{ items: copaItems(cdb), de: .04, ate: .95 }, ...(mundial ? [{ items: copaItems(mundial), de: .3, ate: .75 }] : [])];
  return { league, lib, others, copas, cal: buildCalendar(league.rounds.length, withLib, extras), idx: 0, libReached: withLib ? 'Fase de grupos' : null };
}

export interface CareerOpts { short?: boolean; libNow?: boolean; year?: number; evo?: boolean; mercado?: boolean }
export function newCareer(club: string, o: CareerOpts = {}): Career {
  const brTeams = leagueClubs('brasileirao').map(c => c.id), sbTeams = leagueClubs('serie-b').map(c => c.id);
  const div: 'A' | 'B' = sbTeams.includes(club) ? 'B' : 'A';
  // 1ª temporada: vagas na Libertadores pelos mais fortes do Brasileirão (com opção de incluir o seu clube).
  const byStr = [...brTeams].sort((a, b) => clubStrength(b) - clubStrength(a));
  let libNext = byStr.filter(id => id !== club).slice(0, LIB_BR);
  if (o.libNow !== false && div === 'A') libNext = [...libNext.slice(0, LIB_BR - 1), club];
  // O Super Mundial da 1ª temporada vem junto com a vaga na Libertadores (mesma opção ao começar)
  const base = { club, year: o.year ?? 2026, short: !!o.short, div, brTeams, sbTeams, libNext, mundialNext: o.libNow !== false && div === 'A' };
  return { ...base, ...newSeasonComps(base), trophies: [], history: [], evo: o.evo ?? false, mercado: o.mercado ?? false };
}

const MULT = { A: 2.2, B: 1.3, lib: 3, cdb: 2.6, mundial: 3.6 };

/** Próximo jogo do usuário. Datas em que ele não joga (eliminado da Libertadores) são simuladas antes. */
export function nextFixture(c: Career): Fixture | null {
  skipNonUser(c);
  const it = c.cal[c.idx];
  if (!it) return null;
  if (it.c === 'copa') return copaFixture(c, it);
  if (it.c === 'liga') {
    const L = c.league, ui = L.teams.indexOf(c.club);
    const [h, a] = L.rounds[it.round].find(p => p.includes(ui))!;
    return { comp: 'liga', label: `${L.name} · Rodada ${it.round + 1} de ${L.rounds.length}`, opp: L.teams[h === ui ? a : h], home: h === ui ? 0 : 1, mult: MULT[c.div] };
  }
  const L = c.lib!;
  if (it.phase === 'grupos') {
    const g = L.groups.find(x => x.teams.includes(c.club))!, ui = g.teams.indexOf(c.club);
    const [h, a] = g.rounds[L.groupRound].find(p => p.includes(ui))!;
    return { comp: 'lib', label: `Libertadores · Grupo ${'ABCD'[L.groups.indexOf(g)]} · Rodada ${L.groupRound + 1} de 6`, opp: g.teams[h === ui ? a : h], home: h === ui ? 0 : 1, mult: MULT.lib };
  }
  const phase = it.phase, leg = it.phase === 'final' ? 0 : it.leg;
  const t = L.ties[phase].find(x => x.a === c.club || x.b === c.club)!;
  const youA = t.a === c.club, opp = youA ? t.b : t.a;
  const home: 0 | 1 | null = phase === 'final' ? null : ((leg === 0) === youA ? 0 : 1);
  const agg: [number, number] = [0, 0];
  t.legs.forEach(l => { if (l) { agg[0] += youA ? l[0] : l[1]; agg[1] += youA ? l[1] : l[0]; } });
  const decisive = leg === t.legs.length - 1;
  return {
    comp: 'lib', label: `Libertadores · ${phaseName(phase)}${phase === 'final' ? ' (jogo único)' : leg ? ' · volta' : ' · ida'}`, opp, home, mult: MULT.lib,
    ko: { phase, leg: leg as 0 | 1, agg, decisive },
  };
}

/** Jogo do usuário numa copa (grupo do Mundial ou mata-mata). */
function copaFixture(c: Career, it: CopaItem): Fixture | null {
  const C = c.copas?.find(x => x.id === it.id);
  if (!C) return null;
  const mult = MULT[C.id];
  if ('g' in it) {
    const g = C.groups.find(x => x.teams.includes(c.club))!, ui = g.teams.indexOf(c.club);
    const [h, a] = g.rounds[C.groupRound].find(p => p.includes(ui))!;
    return { comp: 'copa', copa: C.id, label: `${C.nome} · Grupo ${'ABCDEFGH'[C.groups.indexOf(g)]} · Rodada ${C.groupRound + 1} de ${g.rounds.length}`, opp: g.teams[h === ui ? a : h], home: null, mult };
  }
  const R0 = C.rounds[it.r], t = R0.ties.find(x => x.a === c.club || x.b === c.club)!;
  const youA = t.a === c.club, opp = youA ? t.b : t.a;
  const home: 0 | 1 | null = C.neutral ? null : ((it.leg === 0) === youA ? 0 : 1);
  const agg: [number, number] = [0, 0];
  t.legs.forEach(l => { if (l) { agg[0] += youA ? l[0] : l[1]; agg[1] += youA ? l[1] : l[0]; } });
  const decisive = it.leg === t.legs.length - 1, final = it.r === C.rounds.length - 1;
  return { comp: 'copa', copa: C.id, label: `${C.nome} · ${R0.nome}${R0.legs === 2 ? (it.leg ? ' · volta' : ' · ida') : ' (jogo único)'}`, opp, home, mult: mult * (final ? 1.3 : 1),
    ko: { phase: R0.nome, leg: it.leg, agg, decisive, final } };
}

function userInItem(c: Career, it: CalItem): boolean {
  if (it.c === 'copa') { const C = c.copas?.find(x => x.id === it.id); return !!C && userInCopa(C, it, c.club); }
  if (it.c === 'liga') return true;
  const L = c.lib;
  if (!L) return false;
  if (it.phase === 'grupos') return true;
  return L.ties[it.phase].some(t => t.a === c.club || t.b === c.club);
}

function skipNonUser(c: Career): void {
  while (c.idx < c.cal.length && !userInItem(c, c.cal[c.idx])) {
    const it = c.cal[c.idx];
    if (it.c === 'copa') { const C = c.copas?.find(x => x.id === it.id); if (C) playCopaItem(C, it); }
    else if (it.c === 'lib' && c.lib) playLibItem(c.lib, it);
    c.idx++;
  }
}

/** O jogo do usuário precisa de pênaltis com esse placar? (mata-mata decisivo empatado no agregado) */
export function needsPens(f: Fixture, gf: number, ga: number): boolean {
  return !!f.ko?.decisive && f.ko.agg[0] + gf === f.ko.agg[1] + ga;
}

/** Registra o resultado do usuário, simula o resto da data e avança as outras ligas. */
export function recordResult(c: Career, gf: number, ga: number, pens?: [number, number], nums?: { id: string; g: number; a: number }[]): void {
  const it = c.cal[c.idx];
  if (!it) return;
  if (it.c === 'liga') {
    playLeagueRound(c.league, { club: c.club, gf, ga, nums });
    const frac = c.league.round / c.league.rounds.length;
    for (const L of c.others) while (L.round < Math.floor(frac * L.rounds.length + 1e-9)) playLeagueRound(L);
  } else if (it.c === 'copa') {
    const C = c.copas?.find(x => x.id === it.id);
    if (C) playCopaItem(C, it, { club: c.club, gf, ga, pens });
  } else {
    playLibItem(c.lib!, it, { club: c.club, gf, ga, pens });
    c.libReached = libUserStatus(c.lib!, c.club);
  }
  c.idx++;
  skipNonUser(c);
}

export const seasonOver = (c: Career): boolean => { skipNonUser(c); return c.idx >= c.cal.length; };

export interface SeasonSummary { pos: number; coins: number; msgs: string[]; trophies: Trophy[]; pack: 'premium' | 'ouro' | null; newDiv: 'A' | 'B' }

const PRIZE_A = [60000, 42000, 34000, 28000, 22000, 20000, 15000, 14000, 13000, 12000, 9000, 9000, 8000, 8000, 7000, 7000, 5000, 5000, 5000, 5000];
const PRIZE_B = [25000, 20000, 17000, 15000, 9000, 8000, 7000, 7000, 6000, 6000, 5000, 5000, 4000, 4000, 4000, 4000, 3000, 3000, 3000, 3000];
const LIB_PRIZE: Record<string, number> = { 'Campeão': 80000, 'Vice-campeão': 45000, 'Eliminado nas semifinais': 25000, 'Eliminado nas quartas': 15000, 'Eliminado na fase de grupos': 8000 };

/** Fecha a temporada: prêmios, troféus, acesso/rebaixamento, vagas na Libertadores e nova temporada. */
export function endSeason(c: Career): SeasonSummary {
  // Termina o que faltar
  while (c.league.round < c.league.rounds.length) playLeagueRound(c.league);
  for (const L of c.others) while (L.round < L.rounds.length) playLeagueRound(L);
  const table = leagueStandings(c.league), pos = table.findIndex(s => s.id === c.club) + 1;
  const msgs: string[] = [], trophies: Trophy[] = [];
  const shortMult = c.short ? .6 : 1;
  let coins = Math.round((c.div === 'A' ? PRIZE_A : PRIZE_B)[pos - 1] * shortMult);
  msgs.push(`${pos}º lugar no ${c.league.name}: +${coins.toLocaleString('pt-BR')} moedas.`);
  if (pos === 1) {
    trophies.push({ comp: c.div === 'A' ? 'brasileirao' : 'serie-b', name: c.league.name, year: c.year });
    msgs.push(c.div === 'A' ? `🏆 Campeão brasileiro de ${c.year}!` : `🏆 Campeão da Série B de ${c.year}!`);
  }
  let libStatus: string | null = null;
  if (c.lib) {
    libStatus = libUserStatus(c.lib, c.club);
    const p = Math.round((LIB_PRIZE[libStatus] ?? 0) * shortMult);
    if (p) { coins += p; msgs.push(`Libertadores (${libStatus.toLowerCase()}): +${p.toLocaleString('pt-BR')} moedas.`); }
    if (c.lib.champion === c.club) { trophies.push({ comp: 'libertadores', name: 'Copa Libertadores', year: c.year }); msgs.push(`🏆 Campeão da Libertadores de ${c.year}!`); }
  }
  // Copa do Brasil e Super Mundial: termina o que faltar, prêmios e troféus
  const st: Partial<Record<CopaId, string>> = {};
  for (const C of c.copas ?? []) {
    for (const it of copaItems(C)) if (!('g' in it) || C.groupRound <= it.g) playCopaItem(C, it);
    const s0 = copaStatus(C, c.club);
    if (s0 === 'Fora') continue;
    st[C.id] = s0;
    const p = Math.round(copaPremio(C.id, s0) * shortMult);
    if (p) { coins += p; msgs.push(`${C.nome} (${s0.toLowerCase()}): +${p.toLocaleString('pt-BR')} moedas.`); }
    if (C.champion === c.club) {
      trophies.push({ comp: C.id === 'cdb' ? 'copa-do-brasil' : 'mundial', name: C.nome, year: c.year });
      msgs.push(C.id === 'cdb' ? `🏆 Campeão da Copa do Brasil de ${c.year}!` : `🌍🏆 Campeão do Super Mundial de Clubes de ${c.year}!`);
    }
  }
  // Acesso e rebaixamento (4 sobem, 4 caem). A outra divisão é simulada de forma simples.
  const aTable = c.div === 'A' ? table : leagueStandings(c.others.find(l => l.id === 'brasileirao')!);
  let bTable: Standing[];
  if (c.div === 'B') bTable = table;
  else { const sb = makeLeague('serie-b', c.sbTeams, false); while (sb.round < sb.rounds.length) playLeagueRound(sb); bTable = leagueStandings(sb); }
  const down = aTable.slice(-4).map(s => s.id), up = bTable.slice(0, 4).map(s => s.id);
  const newDiv: 'A' | 'B' = up.includes(c.club) ? 'A' : down.includes(c.club) ? 'B' : c.div;
  if (c.div === 'A' && newDiv === 'B') msgs.push('Rebaixado para a Série B.');
  if (c.div === 'B' && newDiv === 'A') msgs.push('⬆️ Acesso à Série A!');
  // Vagas na próxima Libertadores: 5 primeiros da Série A (mais o campeão, se não estiver entre eles)
  let libNext = aTable.slice(0, LIB_BR).map(s => s.id);
  if (c.lib?.champion && W.clubs.get(c.lib.champion)?.lg === 'brasileirao' && !libNext.includes(c.lib.champion)) libNext = [...libNext.slice(0, LIB_BR - 1), c.lib.champion];
  if (newDiv === 'A' && libNext.includes(c.club)) msgs.push(`Classificado para a Libertadores de ${c.year + 1}.`);
  // Super Mundial do ano que vem: campeão brasileiro, da Libertadores ou da Copa do Brasil, ou top 4 da Série A
  const mundialNext = (c.div === 'A' && pos <= 4) || c.lib?.champion === c.club || c.copas?.find(x => x.id === 'cdb')?.champion === c.club;
  if (mundialNext) msgs.push(`🌍 Classificado para o Super Mundial de Clubes de ${c.year + 1}!`);
  c.history.push({ year: c.year, div: c.div, pos, pts: table.find(s => s.id === c.club)!.Pts, lib: libStatus, coins, cdb: st.cdb, mundial: st.mundial });
  c.trophies.push(...trophies);
  c.brTeams = [...c.brTeams.filter(id => !down.includes(id)), ...up];
  c.sbTeams = [...c.sbTeams.filter(id => !up.includes(id)), ...down];
  c.div = newDiv; c.year++; c.libNext = libNext; c.mundialNext = !!mundialNext;
  Object.assign(c, newSeasonComps(c));
  return { pos, coins, msgs, trophies, pack: trophies.length ? 'premium' : pos <= 4 ? 'ouro' : null, newDiv };
}
