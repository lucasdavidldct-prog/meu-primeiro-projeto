import { inPos } from './cards';
import { slotsOf } from './positions';
import type { BasePlayer, FormationId, Pos, SlotDef } from './types';
import type { OrderFx } from './orders';
import { psLevel, type PsId } from './playstyles';

export interface Chem { per: number[]; total: number }

/** Química por posição (0 a 3) e total (máx. 33). Legendas valem como 2 compatriotas e reforçam a liga de todos. */
export function calcChem(xi: (BasePlayer | null)[], form: FormationId | SlotDef[]): Chem {
  const slots = typeof form === 'string' ? slotsOf(form) : form;
  const club: Record<string, number> = {}, nat: Record<string, number> = {}, lg: Record<string, number> = {};
  let legs = 0;
  xi.forEach(P => {
    if (!P) return;
    if (P.leg) { legs++; nat[P.nat] = (nat[P.nat] || 0) + 2; return; }
    const k = P.lg + ':' + P.club;
    club[k] = (club[k] || 0) + 1; lg[P.lg] = (lg[P.lg] || 0) + 1; nat[P.nat] = (nat[P.nat] || 0) + 1;
  });
  const per = xi.map((P, i) => {
    if (!P || !inPos(P, slots[i].p)) return 0;
    if (P.leg) return 3;
    const cc = club[P.lg + ':' + P.club], nc = nat[P.nat], lc = lg[P.lg] + legs;
    const c = (cc >= 7 ? 3 : cc >= 4 ? 2 : cc >= 2 ? 1 : 0) + (nc >= 8 ? 3 : nc >= 5 ? 2 : nc >= 2 ? 1 : 0) + (lc >= 8 ? 3 : lc >= 5 ? 2 : lc >= 3 ? 1 : 0);
    return Math.min(3, c);
  });
  return { per, total: per.reduce((a, b) => a + b, 0) };
}

/** Overall efetivo numa posição: goleiro fora do gol (ou linha no gol) desaba, fora de posição perde 7, química soma de -3 a +2. */
export function effOvr(P: BasePlayer | null, pos: Pos, chem: number): number {
  if (!P) return 25;
  let e = P.ovr;
  if ((pos === 'GOL') !== (P.pos === 'GOL')) e = Math.min(e, 32);
  else if (!inPos(P, pos)) e -= 7;
  return e + [-3, -1, 1, 2][chem];
}

export const W_ATT: Record<Pos, number> = { GOL: 0, ZAG: .06, LD: .25, LE: .25, VOL: .18, MC: .42, MEI: .8, MD: .6, ME: .6, PD: .9, PE: .9, ATA: 1 };
export const W_DEF: Record<Pos, number> = { GOL: 0, ZAG: 1, LD: .85, LE: .85, VOL: .85, MC: .45, MEI: .15, MD: .35, ME: .35, PD: .08, PE: .08, ATA: .04 };
export const W_MID: Record<Pos, number> = { GOL: 0, ZAG: .2, LD: .3, LE: .3, VOL: .9, MC: 1, MEI: .9, MD: .8, ME: .8, PD: .4, PE: .4, ATA: .25 };
const refW = (W: Record<Pos, number>) => slotsOf('4-3-3').reduce((s, x) => s + W[x.p], 0);
const REF = { att: refW(W_ATT), def: refW(W_DEF), mid: refW(W_MID) };

export interface RateEntry { pos: Pos; eff: number; red?: boolean; P?: BasePlayer | null; ofx?: OrderFx }
export interface Ratings { att: number; def: number; mid: number; gk: number }
export type Sector = 'att' | 'mid' | 'def';

/** Quanto os atributos puxam a força do jogador em cada setor para cima ou para baixo do overall. */
export const ATTR_K = .65;
/** Composição de atributos por setor (RIT FIN PAS DRI DEF FIS). */
const COMP: Record<Sector, number[]> = {
  att: [.2, .32, .13, .25, 0, .1],
  mid: [.05, .03, .42, .23, .12, .15],
  def: [.15, 0, .08, 0, .52, .25],
};
/** Bônus (em pontos) de cada playstyle no setor: [normal, +]. As versões + pesam bem mais. */
const PS_SECTOR: Partial<Record<PsId, Partial<Record<Sector | 'gk', [number, number]>>>> = {
  'finalizacao-precisa': { att: [1.5, 3.5] }, 'chute-de-longe': { att: [1, 2.5] }, 'drible-rapido': { att: [1.5, 3.5], mid: [.5, 1.5] },
  velocista: { att: [1.5, 3.5] }, 'primeiro-toque': { att: [1, 2], mid: [1, 2.5] }, 'passe-preciso': { mid: [1.5, 3.5] },
  'passe-em-profundidade': { att: [1, 2.5], mid: [1, 2] }, cruzamento: { att: [1, 2.5] }, cabeceio: { att: [.8, 2], def: [1, 2.5] },
  desarme: { def: [1.5, 3.5] }, interceptacao: { def: [1.5, 3.5], mid: [.5, 1.5] }, bloqueio: { def: [1, 2.5] },
  'imposicao-fisica': { def: [1, 2.5], mid: [.5, 1.5] }, incansavel: { mid: [.5, 1.5] }, 'reposicao-longa': { mid: [.5, 1.5] },
  'chute-colocado': { att: [1, 2.5] }, 'chute-rasteiro': { att: [1, 2] }, cavadinha: { att: [.5, 1.5] }, acrobatico: { att: [.5, 1.5] }, trivela: { att: [.5, 1.5], mid: [.5, 1] },
  'passe-tenso': { mid: [1, 2.5] }, lancamento: { mid: [1, 2] }, 'tiki-taka': { mid: [1.5, 3] },
  firula: { att: [1, 2.5] }, tecnico: { att: [1, 2], mid: [.5, 1.5] }, 'resistente-pressao': { mid: [1, 2.5] }, explosao: { att: [1, 2.5] },
  antecipacao: { def: [1.5, 3] }, contencao: { def: [1, 2.5] },
  reflexos: { gk: [1.5, 3.5] }, 'saida-do-gol': { gk: [1, 2] }, 'pegador-de-penalti': { gk: [.3, .8] },
};
function psBonus(P: BasePlayer, k: Sector | 'gk'): number {
  let b = 0;
  for (const id in PS_SECTOR) {
    const v = PS_SECTOR[id as PsId]![k];
    if (!v) continue;
    const l = psLevel(P, id as PsId);
    if (l) b += v[l - 1];
  }
  return b;
}
/** Força do jogador num setor: overall efetivo ajustado pelos atributos daquele setor e pelos playstyles. */
export function sectorEff(e: RateEntry, k: Sector): number {
  const P = e.P;
  if (!P || !P.st || P.pos === 'GOL') return e.eff;
  return e.eff + offsets(P)[k];
}
/** Parte fixa da força por setor (atributos + playstyles): calculada uma vez por jogador.
 *  A partida recalcula os setores a cada minuto; sem cache isso dominava o tempo da simulação.
 *  Vale enquanto ovr/st/ps forem os mesmos objetos (a evolução e o editor trocam por novos). */
const offCache = new WeakMap<BasePlayer, { ovr: number; st: number[]; ps: string[]; att: number; mid: number; def: number; gk: number }>();
function offsets(P: BasePlayer) {
  let o = offCache.get(P);
  if (o && o.ovr === P.ovr && o.st === P.st && o.ps === P.ps) return o;
  const sec = (k: Sector) => ATTR_K * (COMP[k].reduce((s, w, i) => s + w * P.st[i], 0) - P.ovr) + psBonus(P, k);
  const gk = ATTR_K * (.3 * P.st[3] + .25 * P.st[0] + .2 * P.st[5] + .15 * P.st[1] + .1 * P.st[4] - P.ovr) + psBonus(P, 'gk');
  o = { ovr: P.ovr, st: P.st, ps: P.ps, att: sec('att'), mid: sec('mid'), def: sec('def'), gk };
  offCache.set(P, o);
  return o;
}
/** Goleiro: MER, POS e REF pesam mais (atributos de goleiro: MER MAN CHU REF VEL POS). */
export function gkEff(e: RateEntry): number {
  const P = e.P;
  if (!P || !P.st || P.pos !== 'GOL') return e.eff;
  return e.eff + offsets(P).gk;
}

/** Força por setor, ponderada pela posição e pela função de cada jogador; expulsões pesam 5% cada. */
export function rate(entries: RateEntry[]): Ratings {
  const f = (W: Record<Pos, number>, ref: number, k: Sector) => {
    let s = 0, w = 0;
    for (const e of entries) { if (e.red) continue; const kw = W[e.pos] * (e.ofx ? e.ofx[k] : 1); s += sectorEff(e, k) * kw; w += kw; }
    return w ? (s / w) * Math.pow(w / ref, .3) : 30;
  };
  const gk = entries.find(e => e.pos === 'GOL' && !e.red);
  const reds = entries.filter(e => e.red).length, pen = Math.pow(.95, reds);
  return { att: f(W_ATT, REF.att, 'att') * pen, def: f(W_DEF, REF.def, 'def') * pen, mid: f(W_MID, REF.mid, 'mid') * pen, gk: gk ? gkEff(gk) : 30 };
}

/** Força do time numa escala só (a mesma para você e para os clubes da IA): média dos setores, goleiro com peso menor. */
export const power = (r: Ratings): number => Math.round(.3 * r.att + .3 * r.mid + .3 * r.def + .1 * r.gk - SCALE_OFFSET);
/** Os setores somam química, playstyles e atributos; para exibir, a escala é recentralizada no overall dos jogadores. */
export const SCALE_OFFSET = 6.5;
