// Guias: os melhores por posição (os mais "roubados") e o guia tático (qual formação/estilo faz mais gols ou sofre menos).
import { gkEff, sectorEff, type Sector } from './chemistry';
import { Match, sideFromTeam, sideOpp } from './match';
import { suggestOrder } from './orders';
import { FORM_IDS } from './positions';
import { resetRng, seedRng } from './rng';
import { oppFromClub } from './season';
import { clubStrength } from './squads';
import { autoLineup, setFormation, teamInfo, teamStrength, type GameState } from './state';
import { STYLE_IDS } from './tactics';
import type { BasePlayer, FormationId, Pos, StyleId } from './types';
import { W, allClubs } from './world';

// ---------- Melhores por posição ----------
export type Grupo = 'GOL' | 'ZAG' | 'LAT' | 'VOL' | 'MEI' | 'PONTA' | 'ATA';
export const GRUPOS: { id: Grupo; n: string; pos: Pos[] }[] = [
  { id: 'GOL', n: 'Goleiros', pos: ['GOL'] },
  { id: 'ZAG', n: 'Zagueiros', pos: ['ZAG'] },
  { id: 'LAT', n: 'Laterais', pos: ['LD', 'LE'] },
  { id: 'VOL', n: 'Volantes e meio-campistas', pos: ['VOL', 'MC'] },
  { id: 'MEI', n: 'Meias', pos: ['MEI'] },
  { id: 'PONTA', n: 'Pontas', pos: ['PD', 'PE', 'MD', 'ME'] },
  { id: 'ATA', n: 'Atacantes', pos: ['ATA'] },
];
/** Peso dos setores (ataque, meio, defesa) na força de cada posição. */
const MIX: Record<Grupo, [number, number, number]> = { GOL: [0, 0, 0], ZAG: [0, .1, .9], LAT: [.3, .2, .5], VOL: [.1, .55, .35], MEI: [.45, .55, 0], PONTA: [.75, .25, 0], ATA: [.9, .1, 0] };

/** Força real do jogador na posição: atributos, estilos de jogo e Fora de Série (a mesma conta do motor). */
export function forcaNaPosicao(P: BasePlayer, g: Grupo): number {
  const e = { pos: P.pos, eff: P.ovr, P };
  if (g === 'GOL') return gkEff(e);
  const [a, m, d] = MIX[g], s = (k: Sector) => sectorEff(e, k);
  return a * s('att') + m * s('mid') + d * s('def');
}

export type Fonte = 'todos' | 'atuais' | 'lendas' | 'eventos';
export function ranking(g: Grupo, fonte: Fonte = 'todos', n = 10): { P: BasePlayer; v: number }[] {
  const pos = GRUPOS.find(x => x.id === g)!.pos;
  const src = fonte === 'atuais' ? W.pool : fonte === 'lendas' ? W.legends : fonte === 'eventos' ? W.events : [...W.pool, ...W.legends, ...W.events];
  return src.filter(P => !P.filler && pos.includes(P.pos)).map(P => ({ P, v: forcaNaPosicao(P, g) })).sort((a, b) => b.v - a.v).slice(0, n);
}

// ---------- Guia tático ----------
export const GUIA_FORMS: FormationId[] = (['4-3-3', '4-4-2', '4-2-3-1', '4-1-2-1-2', '3-5-2', '3-4-3', '5-3-2', '4-2-4'] as FormationId[]).filter(f => FORM_IDS.includes(f));
export interface TaticaRes { form: FormationId; style: StyleId; ment: number; gf: number; ga: number }

/**
 * Simula o seu elenco (melhor time em cada formação) contra um adversário do mesmo nível, com a mesma sorte em todas
 * as combinações: a diferença vem só da tática. `ment` segue a escala do jogo (0 muito defensivo … 4 muito ofensivo).
 */
export async function guiaTatico(S: GameState, n = 30, onProgress?: (feito: number, total: number) => Promise<void> | void): Promise<{ lista: TaticaRes[]; rival: string }> {
  const base = JSON.parse(JSON.stringify(S)) as GameState;
  const forca = teamStrength(teamInfo(base));
  const rival = allClubs().filter(c => c.id !== S.career?.club).sort((a, b) => Math.abs(clubStrength(a.id) - forca) - Math.abs(clubStrength(b.id) - forca))[0];
  const combos: [FormationId, StyleId, number][] = [];
  for (const f of GUIA_FORMS) for (const st of STYLE_IDS) combos.push([f, st, 2]);
  // Extremos: tudo ao ataque e ferrolho
  combos.push(['4-2-4', 'pressao', 4], ['3-4-3', 'pressao', 4], ['5-3-2', 'retranca', 0], ['4-4-2', 'retranca', 0]);
  const times = new Map<FormationId, GameState>();
  const lista: TaticaRes[] = [];
  try {
    for (let i = 0; i < combos.length; i++) {
      const [f, st, ment] = combos[i];
      let C = times.get(f);
      if (!C) { C = JSON.parse(JSON.stringify(base)) as GameState; setFormation(C, f); autoLineup(C); times.set(f, C); }
      const T = teamInfo(C);
      seedRng(777);
      let gf = 0, ga = 0;
      for (let k = 0; k < n; k++) {
        const A = sideFromTeam(T, { name: 'Você', form: f, style: st, ment, bench: [], ord: T.slots.map((sl, j) => suggestOrder(T.xi[j], sl.p)) });
        const m = new Match(A, sideOpp(oppFromClub(rival)));
        for (;;) { const r = await m.step(); if (r === 'ht') m.secondHalf(); else if (r === 'end') break; }
        gf += m.A.goals; ga += m.B.goals;
      }
      lista.push({ form: f, style: st, ment, gf: gf / n, ga: ga / n });
      if (i % 4 === 3) await onProgress?.(i + 1, combos.length);
    }
  } finally { resetRng(); }
  return { lista, rival: rival.n };
}
