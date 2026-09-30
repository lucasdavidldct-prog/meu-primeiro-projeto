import { describe, expect, it } from 'vitest';
import { cantoDoGesto, keeperResolve, missChance, pickCanto, pistaCanto, tempoEscolha, type Canto } from '../src/engine/keeper';
import { R, seedRng } from '../src/engine/rng';
import { W } from '../src/engine/world';
import type { BasePlayer } from '../src/engine/types';

const gk = [...W.players.values()].find(p => p.pos === 'GOL' && p.ovr >= 80)!;
const atk = [...W.players.values()].find(p => p.pos === 'ATA' && p.ovr >= 82)!;
const semPs = (P: BasePlayer): BasePlayer => ({ ...P, ps: [] });
const com = (P: BasePlayer, ps: string): BasePlayer => ({ ...P, ps: [ps] });

describe('lance de goleiro (3 chutes: alto esquerdo, meio, alto direito)', () => {
  it('acertou o lado = defende sempre (a não ser que o batedor erre o gol)', () => {
    seedRng(1);
    for (const c of [0, 1, 2] as Canto[]) for (let k = 0; k < 200; k++) {
      const r = keeperResolve(c, c, semPs(gk), semPs(atk), false, R);
      expect(['defesa', 'fora']).toContain(r);
    }
  });
  it('errou o lado = gol ou fora; Reflexos salva com o pé só o chute no meio', () => {
    seedRng(2);
    let pe = 0;
    for (let k = 0; k < 400; k++) {
      expect(['gol', 'fora']).toContain(keeperResolve(0, 2, semPs(gk), semPs(atk), false, R));
      expect(['gol', 'fora']).toContain(keeperResolve(1, 0, semPs(gk), semPs(atk), false, R));
      if (keeperResolve(1, 0, com(gk, 'reflexos+'), semPs(atk), false, R) === 'pe') pe++;
    }
    expect(pe).toBeGreaterThan(150);
  });
  it('não escolher = fica no meio', () => {
    seedRng(3);
    expect(['defesa', 'fora']).toContain(keeperResolve(1, null, semPs(gk), semPs(atk), true, R));
  });
  it('seguir a pista do batedor defende mais do que chutar um lado; Pegador de Pênalti lê melhor e tem mais tempo', () => {
    seedRng(4);
    let pista = 0, azar = 0, pistaPeg = 0;
    for (let k = 0; k < 3000; k++) {
      const shot = pickCanto(atk, true);
      if (keeperResolve(shot, pistaCanto(shot, atk), gk, atk, true) !== 'gol') pista++;
      if (keeperResolve(shot, pistaCanto(shot, atk, R, com(gk, 'pegador-de-penalti+'), true), gk, atk, true) !== 'gol') pistaPeg++;
      if (keeperResolve(shot, (k % 3) as Canto, gk, atk, true) !== 'gol') azar++;
    }
    expect(pista).toBeGreaterThan(azar + 500);
    expect(pistaPeg).toBeGreaterThan(pista);
    expect(tempoEscolha(com(gk, 'pegador-de-penalti+'), true)).toBeGreaterThan(tempoEscolha(semPs(gk), true));
  });
  it('Saída do Gol faz o batedor errar mais (fora do pênalti)', () => {
    expect(missChance(atk, com(gk, 'saida-do-gol+'), false)).toBeGreaterThan(missChance(atk, semPs(gk), false));
  });
  it('gesto: arrastar para a esquerda/direita escolhe o canto alto; toque ou traço reto para cima = meio', () => {
    expect(cantoDoGesto(-120, -60)).toBe(0);
    expect(cantoDoGesto(140, -20)).toBe(2);
    expect(cantoDoGesto(3, 2)).toBe(1);
    expect(cantoDoGesto(5, -150)).toBe(1);
  });
});
