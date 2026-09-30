// Montagem de times a partir de elencos reais (IA e simulação de clubes).
import { inPos } from './cards';
import { calcChem, effOvr } from './chemistry';
import { FORM_IDS, slotsOf } from './positions';
import type { BasePlayer, FormationId, Pos } from './types';
import { W, clubOf } from './world';
import { psLevel, type PsId } from './playstyles';
import type { StyleId } from './types';

const STAT_BASE: Record<Pos, number[]> = {
  GOL: [1, 1, .8, 1, .6, 1], ZAG: [.7, .4, .7, .6, 1.1, 1], LD: [1, .5, .8, .8, .95, .85], LE: [1, .5, .8, .8, .95, .85],
  VOL: [.7, .55, .9, .8, 1, 1], MC: [.75, .7, 1, .95, .75, .85], MEI: [.8, .85, 1.05, 1, .4, .65], MD: [1, .7, .9, .95, .55, .75],
  ME: [1, .7, .9, .95, .55, .75], PD: [1.05, .85, .85, 1, .35, .7], PE: [1.05, .85, .85, 1, .35, .7], ATA: [.85, 1.05, .72, .9, .3, .9],
};

/** Reserva genérico para completar elencos incompletos (não é um jogador real). */
export function filler(clubId: string, pos: Pos, ovr: number, n: number): BasePlayer {
  const c = W.clubs.get(clubId);
  const nat = W.ligas.find(l => l.id === c?.lg)?.pais ?? 'BRA';
  return {
    id: `reserva-${clubId}-${n}`, name: `Reserva ${n} (${c?.s ?? clubId})`, short: `Reserva ${n}`, nat, pos, alt: [],
    ovr, lg: c?.lg ?? '', club: clubId, age: 24, foot: 'D', ps: [], filler: true,
    st: STAT_BASE[pos].map(w => Math.round(Math.min(99, ovr * w + (w < .6 ? 0 : 4)))),
  };
}

export interface XI { xi: BasePlayer[]; bench: BasePlayer[]; rating: number }

/** Escala o melhor XI possível numa formação: posição exata, depois alternativa, depois qualquer um. */
export function bestXI(players: BasePlayer[], form: FormationId, clubId = 'XXX', benchSize = 7): XI {
  const slots = slotsOf(form), used = new Set<string>(), xi: (BasePlayer | null)[] = Array(11).fill(null);
  const order = slots.map((_, i) => i).sort((a, b) => (slots[a].p === 'GOL' ? -1 : 0) - (slots[b].p === 'GOL' ? -1 : 0));
  for (const pass of [0, 1, 2]) for (const i of order) {
    if (xi[i]) continue;
    const pos = slots[i].p;
    let best: BasePlayer | null = null, bv = -1;
    for (const P of players) {
      if (used.has(P.id)) continue;
      if (pass === 0 ? P.pos !== pos : pass === 1 ? !inPos(P, pos) : (pos === 'GOL') !== (P.pos === 'GOL')) continue;
      const v = effOvr(P, pos, 1) + (P.pos === pos ? .5 : 0);
      if (v > bv) { bv = v; best = P; }
    }
    if (best) { xi[i] = best; used.add(best.id); }
  }
  const real = players.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  const forca = W.clubs.get(clubId)?.forca;
  const avg = forca ?? (players.length ? players.reduce((s, p) => s + p.ovr, 0) / players.length - 5 : 60);
  let n = 1;
  const full = xi.map((P, i) => P ?? filler(clubId, slots[i].p, Math.round(avg), n++));
  const bench: BasePlayer[] = [];
  const gk = real.find(p => p.pos === 'GOL');
  if (gk) bench.push(gk);
  for (const p of real) { if (bench.length >= benchSize) break; if (!bench.includes(p)) bench.push(p); }
  const benchPos: Pos[] = ['GOL', 'ZAG', 'MC', 'PD', 'ATA', 'LD', 'MEI'];
  while (bench.length < benchSize) bench.push(filler(clubId, benchPos[bench.length % 7], Math.round(avg - 2), n++));
  const chem = calcChem(full, form);
  const rating = full.reduce((s, P, i) => s + effOvr(P, slots[i].p, chem.per[i]), 0) / 11;
  return { xi: full, bench, rating };
}

/** Formação que rende o melhor XI para o elenco. */
export function bestFormation(players: BasePlayer[], clubId?: string): FormationId {
  let best: FormationId = '4-3-3', bv = -1;
  for (const f of FORM_IDS) {
    const r = bestXI(players, f, clubId, 0).rating + (f === '4-3-3' || f === '4-2-3-1' || f === '4-4-2' ? .15 : 0);
    if (r > bv) { bv = r; best = f; }
  }
  return best;
}

const strCache = new Map<string, number>();
export function clearStrengthCache(): void { strCache.clear(); }

/** Força do clube: média do overall efetivo do melhor XI (sem bônus de química). */
export function clubStrength(clubId: string): number {
  const hit = strCache.get(clubId);
  if (hit != null) return hit;
  const players = W.byClub.get(clubId) ?? [];
  const { xi } = bestXI(players, '4-3-3', clubId, 0);
  const slots = slotsOf('4-3-3');
  const v = Math.round(xi.reduce((s, P, i) => s + effOvr(P, slots[i].p, 1) - 1, 0) / 11);
  strCache.set(clubId, v);
  return v;
}

export const squadOf = (clubId: string): BasePlayer[] => W.byClub.get(clubId) ?? [];
export const clubName = (P: BasePlayer): string => clubOf(P).n;

/**
 * Tática da IA coerente com o elenco e com o adversário: formação que rende o melhor XI;
 * estilo pela diferença de força e pelo perfil (velocistas → contra-ataque, passadores → toque de bola,
 * marcadores → pressão alta).
 */
export function aiTactics(clubId: string, oppStrength: number): { form: FormationId; style: StyleId } {
  const players = squadOf(clubId);
  const form = bestFormation(players, clubId);
  const { xi } = bestXI(players, form, clubId, 0);
  const cnt = (id: PsId) => xi.reduce((s, p) => s + psLevel(p, id), 0);
  const d = clubStrength(clubId) - oppStrength;
  const ve = cnt('velocista') + cnt('drible-rapido') * .5, pp = cnt('passe-preciso') + cnt('passe-em-profundidade'), ds = cnt('desarme') + cnt('interceptacao') + cnt('incansavel');
  let style: StyleId;
  if (d <= -6) style = ve >= 2 ? 'contra' : 'retranca';
  else if (d <= -3) style = ve >= 2 ? 'contra' : 'equilibrado';
  else if (d >= 5) style = pp >= 3 ? 'posse' : ds >= 3 ? 'pressao' : 'posse';
  else style = pp >= 4 ? 'posse' : ds >= 4 ? 'pressao' : ve >= 3 ? 'contra' : 'equilibrado';
  return { form, style };
}
