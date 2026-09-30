// Lance de goleiro: quando o rival vai marcar, você escolhe o canto para pular.
// 6 zonas do gol: coluna (0 esquerda, 1 meio, 2 direita, do ponto de vista do goleiro) × linha (0 baixo, 1 alto).
import { psLevel } from './playstyles';
import { R, clamp, type Rng } from './rng';
import type { BasePlayer } from './types';

export interface Zone { col: 0 | 1 | 2; row: 0 | 1 }
export const ZONES: Zone[] = [0, 1, 2].flatMap(col => [0, 1].map(row => ({ col, row }) as Zone));

/** Onde o batedor vai chutar: bons finalizadores procuram mais os cantos. */
export function pickShotZone(shooter: BasePlayer, pen: boolean, r: Rng = R): Zone {
  const fin = shooter.st?.[1] ?? 70, canto = clamp(.62 + (fin - 70) * .012 + (pen ? .08 : 0), .5, .9);
  const col: 0 | 1 | 2 = r() < canto ? (r() < .5 ? 0 : 2) : 1;
  const row: 0 | 1 = r() < (col === 1 ? .55 : .42) ? 1 : 0;
  return { col, row };
}

/** A pista que o batedor dá (corrida/corpo): lado verdadeiro na maior parte das vezes; craques disfarçam melhor. */
export function tellOf(shot: Zone, shooter: BasePlayer, r: Rng = R): 0 | 1 | 2 {
  const disfarce = clamp(.82 - ((shooter.st?.[1] ?? 70) - 70) * .006 - .05 * psLevel(shooter, 'finalizacao-precisa'), .6, .85);
  if (r() < disfarce) return shot.col;
  const others = ([0, 1, 2] as const).filter(c => c !== shot.col);
  return others[Math.floor(r() * others.length)];
}

/** Chance de defender: acertar a zona é o que mais importa; reflexos do goleiro e qualidade do batedor pesam. */
export function saveChance(shot: Zone, dive: Zone | null, gk: BasePlayer | undefined, shooter: BasePlayer, pen: boolean): number {
  const d = dive ?? { col: 1, row: 0 };
  let p: number;
  if (d.col === shot.col) p = d.row === shot.row ? (shot.row ? .6 : .68) : .38;
  else if (Math.abs(d.col - shot.col) === 1) p = shot.col === 1 ? .3 : .16;
  else p = .03;
  if (pen) p *= .92;
  const ref = gk?.st?.[3] ?? 70, fin = shooter.st?.[1] ?? 70;
  p += (ref - 75) * .008 - (fin - 75) * .006;
  p *= 1 + .1 * psLevel(gk, 'reflexos') + (pen ? .12 * psLevel(gk, 'pegador-de-penalti') : 0);
  p *= 1 - .08 * psLevel(shooter, 'finalizacao-precisa') - .06 * psLevel(shooter, 'chute-colocado');
  if (gk?.fs) p *= 1.12;
  if (shooter.fs) p *= .85;
  return clamp(p, .02, .9);
}
