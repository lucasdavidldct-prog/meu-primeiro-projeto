// Modo carreira: Brasileirão (Série A ou B), Libertadores e outras ligas simuladas em segundo plano.
// Tudo aqui é serializável (vai para o save) e sem interface.
import { R, shuffle, wpick } from './rng';
import { applyResult, doubleRoundRobin, emptyRow, quickSim, roundRobin, sortTable, type Row, type Standing } from './season';
import { clubStrength } from './squads';
import { W, leagueClubs } from './world';

export const MAIN_LEAGUES = ['premier-league', 'laliga', 'serie-a', 'bundesliga', 'saudi-pro-league', 'mls'];
export const LIB_SIZE = 16;
export const LIB_BR = 5;

export interface Res { h: string; a: string; gh: number; ga: number; pens?: [number, number] }
export interface LeagueComp { id: string; name: string; teams: string[]; rounds: [number, number][][]; round: number; table: Row[]; last: Res[] }
export interface CupTie { a: string; b: string; legs: ([number, number] | null)[]; pens?: [number, number]; winner?: string }
export type LibPhase = 'grupos' | 'quartas' | 'semi' | 'final' | 'fim';
export interface LibGroup { teams: string[]; rounds: [number, number][][]; table: Row[] }
export interface CupComp { year: number; groups: LibGroup[]; groupRound: number; phase: LibPhase; ties: Record<'quartas' | 'semi' | 'final', CupTie[]>; champion?: string; last: Res[] }

export type CalItem = { c: 'liga'; round: number } | { c: 'lib'; phase: 'grupos'; round: number } | { c: 'lib'; phase: 'quartas' | 'semi'; leg: 0 | 1 } | { c: 'lib'; phase: 'final' };
export interface Trophy { comp: 'brasileirao' | 'serie-b' | 'libertadores'; name: string; year: number }
export interface SeasonRecord { year: number; div: 'A' | 'B'; pos: number; pts: number; lib: string | null; coins: number }

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
  /** Números dos seus jogadores na temporada atual (gols, assistências, jogos, soma das notas). */
  stats?: Record<string, { g: number; a: number; j: number; n: number }>;
  /** Fase alcançada na Libertadores desta temporada (para o histórico e os prêmios). */
  libReached: string | null;
}

export interface Fixture {
  comp: 'liga' | 'lib';
  label: string;
  opp: string;
  /** Mandante: 0 = você, 1 = adversário, null = campo neutro. */
  home: 0 | 1 | null;
  mult: number;
  /** Mata-mata: placar agregado antes do jogo (você, adversário) e se é o jogo decisivo. */
  ko?: { phase: 'quartas' | 'semi' | 'final'; leg: 0 | 1; agg: [number, number]; decisive: boolean };
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
function playLeagueRound(L: LeagueComp, user?: { club: string; gf: number; ga: number }): void {
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
function buildCalendar(ligaRounds: number, withLib: boolean): CalItem[] {
  const lib: CalItem[] = withLib ? [
    ...[0, 1, 2, 3, 4, 5].map(round => ({ c: 'lib', phase: 'grupos', round }) as CalItem),
    { c: 'lib', phase: 'quartas', leg: 0 }, { c: 'lib', phase: 'quartas', leg: 1 },
    { c: 'lib', phase: 'semi', leg: 0 }, { c: 'lib', phase: 'semi', leg: 1 },
    { c: 'lib', phase: 'final' },
  ] : [];
  // Distribui as datas da Libertadores ao longo de ~90% da temporada.
  const at = lib.map((_, i) => Math.max(1, Math.round((i + 1) * ligaRounds * .9 / (lib.length + 1))));
  const cal: CalItem[] = [];
  let k = 0;
  for (let r = 0; r < ligaRounds; r++) {
    cal.push({ c: 'liga', round: r });
    while (k < lib.length && at[k] === r + 1) cal.push(lib[k++]);
  }
  while (k < lib.length) cal.push(lib[k++]);
  return cal;
}

// ---------- Temporada ----------
function newSeasonComps(c: Pick<Career, 'club' | 'year' | 'short' | 'div' | 'brTeams' | 'sbTeams' | 'libNext'>): Pick<Career, 'league' | 'lib' | 'others' | 'cal' | 'idx' | 'libReached'> {
  const league = c.div === 'A' ? makeLeague('brasileirao', c.brTeams, c.short) : makeLeague('serie-b', c.sbTeams, c.short);
  const withLib = c.div === 'A' && c.libNext.includes(c.club);
  const brLib = c.libNext.slice(0, LIB_BR);
  if (withLib && !brLib.includes(c.club)) brLib[LIB_BR - 1] = c.club;
  const lib = withLib ? makeLib(c.year, brLib) : null;
  const others = [
    ...(c.div === 'B' ? [makeLeague('brasileirao', c.brTeams, false)] : []),
    ...MAIN_LEAGUES.map(id => makeLeague(id, leagueClubs(id).map(x => x.id), id === 'mls')),
  ];
  return { league, lib, others, cal: buildCalendar(league.rounds.length, withLib), idx: 0, libReached: withLib ? 'Fase de grupos' : null };
}

export interface CareerOpts { short?: boolean; libNow?: boolean; year?: number }
export function newCareer(club: string, o: CareerOpts = {}): Career {
  const brTeams = leagueClubs('brasileirao').map(c => c.id), sbTeams = leagueClubs('serie-b').map(c => c.id);
  const div: 'A' | 'B' = sbTeams.includes(club) ? 'B' : 'A';
  // 1ª temporada: vagas na Libertadores pelos mais fortes do Brasileirão (com opção de incluir o seu clube).
  const byStr = [...brTeams].sort((a, b) => clubStrength(b) - clubStrength(a));
  let libNext = byStr.filter(id => id !== club).slice(0, LIB_BR);
  if (o.libNow !== false && div === 'A') libNext = [...libNext.slice(0, LIB_BR - 1), club];
  const base = { club, year: o.year ?? 2026, short: !!o.short, div, brTeams, sbTeams, libNext };
  return { ...base, ...newSeasonComps(base), trophies: [], history: [] };
}

const MULT = { A: 2.2, B: 1.3, lib: 3 };

/** Próximo jogo do usuário. Datas em que ele não joga (eliminado da Libertadores) são simuladas antes. */
export function nextFixture(c: Career): Fixture | null {
  skipNonUser(c);
  const it = c.cal[c.idx];
  if (!it) return null;
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

function userInItem(c: Career, it: CalItem): boolean {
  if (it.c === 'liga') return true;
  const L = c.lib;
  if (!L) return false;
  if (it.phase === 'grupos') return true;
  return L.ties[it.phase].some(t => t.a === c.club || t.b === c.club);
}

function skipNonUser(c: Career): void {
  while (c.idx < c.cal.length && !userInItem(c, c.cal[c.idx])) {
    const it = c.cal[c.idx] as Extract<CalItem, { c: 'lib' }>;
    playLibItem(c.lib!, it);
    c.idx++;
  }
}

/** O jogo do usuário precisa de pênaltis com esse placar? (mata-mata decisivo empatado no agregado) */
export function needsPens(f: Fixture, gf: number, ga: number): boolean {
  return !!f.ko?.decisive && f.ko.agg[0] + gf === f.ko.agg[1] + ga;
}

/** Registra o resultado do usuário, simula o resto da data e avança as outras ligas. */
export function recordResult(c: Career, gf: number, ga: number, pens?: [number, number]): void {
  const it = c.cal[c.idx];
  if (!it) return;
  if (it.c === 'liga') {
    playLeagueRound(c.league, { club: c.club, gf, ga });
    const frac = c.league.round / c.league.rounds.length;
    for (const L of c.others) while (L.round < Math.floor(frac * L.rounds.length + 1e-9)) playLeagueRound(L);
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
  c.history.push({ year: c.year, div: c.div, pos, pts: table.find(s => s.id === c.club)!.Pts, lib: libStatus, coins });
  c.trophies.push(...trophies);
  c.brTeams = [...c.brTeams.filter(id => !down.includes(id)), ...up];
  c.sbTeams = [...c.sbTeams.filter(id => !up.includes(id)), ...down];
  c.div = newDiv; c.year++; c.libNext = libNext;
  Object.assign(c, newSeasonComps(c));
  return { pos, coins, msgs, trophies, pack: trophies.length ? 'premium' : pos <= 4 ? 'ouro' : null, newDiv };
}
