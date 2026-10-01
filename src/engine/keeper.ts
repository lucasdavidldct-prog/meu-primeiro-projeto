// Lance de goleiro: o rival vai chutar e você escolhe onde defender.
// Só 3 chutes possíveis: alto no canto esquerdo, no meio e alto no canto direito (esquerda/direita da SUA tela,
// com a câmera atrás do gol). Acertou o lado = o goleiro defende. Errou = gol, com duas exceções visíveis:
// o batedor pode mandar para fora, e o goleiro com Reflexos ainda salva com o pé o chute no meio.
import { psLevel } from './playstyles';
import { R, clamp, type Rng } from './rng';
import type { BasePlayer } from './types';

/** 0 = alto esquerdo (da tela), 1 = meio, 2 = alto direito. */
export type Canto = 0 | 1 | 2;
export const CANTO_N: Record<Canto, string> = { 0: 'alto no canto esquerdo', 1: 'no meio', 2: 'alto no canto direito' };

/** Chance do Reflexos salvar com o pé o chute no meio quando você pulou para o lado. */
export const REFLEXO_PE = [0, .35, .6] as const;

/** Onde o batedor vai chutar: bons finalizadores procuram mais os cantos. */
export function pickCanto(shooter: BasePlayer, pen: boolean, r: Rng = R): Canto {
  const fin = shooter.st?.[1] ?? 70, canto = clamp(.64 + (fin - 70) * .012 + (pen ? .06 : 0), .5, .9);
  return r() < canto ? (r() < .5 ? 0 : 2) : 1;
}

/** A pista que o batedor dá (corrida e corpo): o lado verdadeiro na maior parte das vezes; craques disfarçam melhor.
 *  O goleiro com Pegador de Pênalti lê melhor o batedor (a pista mente menos). */
export function pistaCanto(shot: Canto, shooter: BasePlayer, r: Rng = R, gk?: BasePlayer, pen = false): Canto {
  const ler = pen ? .06 * psLevel(gk, 'pegador-de-penalti') : .03 * psLevel(gk, 'pegador-de-penalti');
  const verdade = clamp(.8 - ((shooter.st?.[1] ?? 70) - 70) * .006 - .05 * psLevel(shooter, 'finalizacao-precisa') + ler, .6, .92);
  if (r() < verdade) return shot;
  const others = ([0, 1, 2] as const).filter(c => c !== shot);
  return others[Math.floor(r() * others.length)];
}

/** Chance do batedor errar o gol (fora ou trave). Saída do Gol fecha o ângulo; Finalização Precisa erra menos. */
export function missChance(shooter: BasePlayer, gk: BasePlayer | undefined, pen: boolean): number {
  const fin = shooter.st?.[1] ?? 70;
  let p = (pen ? .07 : .1) - (fin - 75) * .004;
  p *= [1, .75, .55][psLevel(shooter, 'finalizacao-precisa')];
  if (!pen) p += .05 * psLevel(gk, 'saida-do-gol');
  if (shooter.fs) p *= .6;
  return clamp(p, .02, .22);
}

export type KeeperRes = 'defesa' | 'pe' | 'fora' | 'gol';
/**
 * Resultado do lance. `dive` = onde você defendeu (null = não escolheu: fica no meio).
 * Acertou o lado: defende sempre. Errou: gol, salvo o chute para fora e a defesa com o pé (Reflexos, chute no meio).
 */
export function keeperResolve(shot: Canto, dive: Canto | null, gk: BasePlayer | undefined, shooter: BasePlayer, pen: boolean, r: Rng = R): KeeperRes {
  const d = dive ?? 1;
  if (r() < missChance(shooter, gk, pen)) return 'fora';
  if (d === shot) return 'defesa';
  if (shot === 1 && r() < REFLEXO_PE[psLevel(gk, 'reflexos')] * (gk?.fs ? 1.2 : 1)) return 'pe';
  return 'gol';
}

/** Tempo para escolher antes do batedor correr (ms): Pegador de Pênalti dá mais tempo no pênalti. */
export function tempoEscolha(gk: BasePlayer | undefined, pen: boolean): number {
  return 5000 + (pen ? 1000 * psLevel(gk, 'pegador-de-penalti') : 0);
}

/** Gesto → canto: arrastar para a esquerda/direita (ou para cima em diagonal) = alto naquele lado; toque = meio. */
export function cantoDoGesto(dx: number, dy: number, limiar = 30): Canto {
  if (Math.hypot(dx, dy) < limiar) return 1;
  // Vale a direção: qualquer arrasto que puxe para um lado (mesmo subindo bastante) é aquele canto;
  // só o traço quase reto para cima ou para baixo é meio
  if (Math.abs(dx) < Math.abs(dy) * .3) return 1;
  return dx < 0 ? 0 : 2;
}
