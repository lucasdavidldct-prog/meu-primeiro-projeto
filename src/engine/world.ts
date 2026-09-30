// Mundo do jogo carregado de data/: nações, ligas, clubes, jogadores reais e lendas.
// O editor de elencos pode recarregar tudo com dados editados (loadWorld).
import nacoesJson from '../../data/nacoes.json';
import lendasJson from '../../data/lendas.json';
import { ATR_GOL, ATR_LINHA, type JogadorData, type LendasData, type LigaData, type NacoesData } from './data/schema';
import type { BasePlayer, Club, Nation, Pos } from './types';

// Imports estáticos (funcionam no Vite, nos testes e nos scripts com tsx).
import brasileirao from '../../data/ligas/brasileirao.json';
import premierLeague from '../../data/ligas/premier-league.json';
import laliga from '../../data/ligas/laliga.json';
import serieA from '../../data/ligas/serie-a.json';
import bundesliga from '../../data/ligas/bundesliga.json';
import saudi from '../../data/ligas/saudi-pro-league.json';
import mls from '../../data/ligas/mls.json';
import serieB from '../../data/ligas/serie-b.json';
import conmebol from '../../data/ligas/conmebol.json';
export const BUNDLED_LIGAS = [brasileirao, premierLeague, laliga, serieA, bundesliga, saudi, mls, serieB, conmebol] as unknown as LigaData[];
export const BUNDLED_LENDAS = lendasJson as unknown as LendasData;
export const NACOES = nacoesJson as unknown as NacoesData;

const LIGA_ORDEM = ['brasileirao', 'serie-b', 'premier-league', 'laliga', 'serie-a', 'bundesliga', 'saudi-pro-league', 'mls', 'conmebol'];

export const NATIONS: Record<string, Nation> = Object.fromEntries(
  Object.entries(NACOES).map(([k, v]) => [k, { n: v.nome, f: v.cores, h: !!v.horizontal }]),
);
const UNKNOWN_NATION: Nation = { n: '—', f: ['#666666', '#999999', '#666666'] };
export const nationOf = (code: string): Nation => NATIONS[code] ?? UNKNOWN_NATION;

export interface ClubInfo extends Club { id: string; lg: string; city: string; forca?: number }
export interface LeagueInfo { id: string; n: string; pais: string; temporada: string; clubs: ClubInfo[] }

export const LEGEND_CLUB: ClubInfo = { id: 'ICO', n: 'Lendas', s: 'ICO', c1: '#d9c28a', c2: '#3a2a08', lg: 'ICO', city: '' };

/** Estado do mundo: substituído por inteiro em loadWorld. */
export const W = {
  ligas: [] as LigaData[],
  lendas: BUNDLED_LENDAS,
  leagues: [] as LeagueInfo[],
  clubs: new Map<string, ClubInfo>(),
  players: new Map<string, BasePlayer>(),
  byClub: new Map<string, BasePlayer[]>(),
  /** Jogadores reais em atividade (fonte dos pacotes). */
  pool: [] as BasePlayer[],
  legends: [] as BasePlayer[],
};

export function toPlayer(j: JogadorData, lg: string, club: string): BasePlayer {
  const keys = j.posicao === 'GOL' ? ATR_GOL : ATR_LINHA;
  return {
    id: j.id, name: j.nome, short: j.nomeCurto, nat: j.nacionalidade, pos: j.posicao, alt: [...j.posicoesAlt] as Pos[],
    ovr: j.overall, lg, club, age: j.idade, st: keys.map(k => j.atributos[k] ?? 50), foot: j.pe, ps: [...j.playstyles],
  };
}

export function loadWorld(ligas: LigaData[], lendas: LendasData = BUNDLED_LENDAS): void {
  const sorted = [...ligas].sort((a, b) => (LIGA_ORDEM.indexOf(a.id) + 99) % 99 - (LIGA_ORDEM.indexOf(b.id) + 99) % 99);
  W.ligas = sorted;
  W.lendas = lendas;
  W.leagues = [];
  W.clubs = new Map();
  W.players = new Map();
  W.byClub = new Map();
  W.pool = [];
  for (const l of sorted) {
    const info: LeagueInfo = { id: l.id, n: l.nome, pais: l.pais, temporada: l.temporada, clubs: [] };
    for (const c of l.clubes) {
      const ci: ClubInfo = { id: c.id, n: c.nome, s: c.sigla, c1: c.cores[0], c2: c.cores[1], lg: l.id, city: c.cidade, forca: c.forca };
      info.clubs.push(ci);
      W.clubs.set(c.id, ci);
      const squad = c.elenco.map(j => toPlayer(j, l.id, c.id));
      W.byClub.set(c.id, squad);
      for (const p of squad) { W.players.set(p.id, p); W.pool.push(p); }
    }
    W.leagues.push(info);
  }
  W.legends = lendas.lendas.map(j => ({ ...toPlayer(j, 'ICO', 'ICO'), leg: true, hist: j.clubeHistorico, epoca: j.epoca, legClub: j.clube, legCat: j.categoria ?? 'idolo' }));
  for (const p of W.legends) W.players.set(p.id, p);
}
loadWorld(BUNDLED_LIGAS);

/** Clubes das 7 ligas principais (sem Série B e sul-americanos). */
export const allClubs = (): ClubInfo[] => W.leagues.filter(l => !EXTRA.has(l.id)).flatMap(l => l.clubs);
const EXTRA = new Set(['serie-b', 'conmebol']);
export const leagueClubs = (id: string): ClubInfo[] => W.leagues.find(l => l.id === id)?.clubs ?? [];
export const leagueById = (id: string): LeagueInfo | undefined => W.leagues.find(l => l.id === id);

export function clubOf(P: BasePlayer): ClubInfo {
  if (P.leg) return LEGEND_CLUB;
  return W.clubs.get(P.club) ?? { id: P.club, n: P.club, s: P.club, c1: '#555555', c2: '#dddddd', lg: P.lg, city: '' };
}
export const leagueName = (P: BasePlayer): string => (P.leg ? 'Ícones' : leagueById(P.lg)?.n ?? P.lg);
export const getPlayer = (id: string): BasePlayer | undefined => W.players.get(id);

/** Recarrega o mundo com as ligas editadas por cima das originais. */
export function applyEdits(edits: Record<string, LigaData>): void {
  loadWorld(BUNDLED_LIGAS.map(l => edits[l.id] ?? l));
}
