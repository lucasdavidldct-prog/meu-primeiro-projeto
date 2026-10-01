import { describe, expect, it } from 'vitest';
import { draftForca, draftPlayers, draftPremio, draftSide, escolherCapitao, escolherFormacao, escolherJogador, novoDraft, registrarJogo } from '../src/engine/draft';
import { mulberry32 } from '../src/engine/rng';
import { slotsOf } from '../src/engine/positions';

const montar = (seed: number) => {
  const r = mulberry32(seed), D = novoDraft(r);
  escolherFormacao(D, D.formOps[0], r);
  escolherCapitao(D, D.capOps[0], r);
  while (D.fase === 'escolha') escolherJogador(D, D.ops[0], r);
  return D;
};

describe('Draft dos Craques', () => {
  it('monta 11 jogadores diferentes, cada um numa posição que ele joga, e sorteia 4 rivais', () => {
    for (let s = 1; s <= 20; s++) {
      const D = montar(s), xi = draftPlayers(D), slots = slotsOf(D.form!);
      expect(D.fase).toBe('jogos');
      expect(new Set(D.picks).size).toBe(11);
      // Todo mundo joga numa posição que sabe jogar (o capitão vai para a vaga dele)
      xi.forEach((P, i) => expect(P!.pos === slots[i].p || P!.alt.includes(slots[i].p)).toBe(true));
      expect(D.rivais).toHaveLength(4);
      expect(draftForca(D).forca).toBeGreaterThan(70);
      expect(draftSide(D, 'Teste').xi).toHaveLength(11);
    }
  });
  it('cada escolha oferece 5 cartas da posição, sem repetir quem já está no time', () => {
    const r = mulberry32(7), D = novoDraft(r);
    escolherFormacao(D, D.formOps[0], r);
    expect(D.capOps.length).toBeGreaterThanOrEqual(3);
    escolherCapitao(D, D.capOps[0], r);
    expect(D.ops).toHaveLength(5);
    expect(D.ops).not.toContain(D.capOps[0]);
  });
  it('vitória avança, derrota encerra; 4 vitórias = campeão com a carta de prêmio', () => {
    const D = montar(3);
    expect(registrarJogo(D, 2, 1)).toBe('avancou');
    expect(registrarJogo(D, 1, 1, [4, 3])).toBe('avancou');
    expect(registrarJogo(D, 0, 1)).toBe('eliminado');
    expect(D.fase).toBe('fim');
    const C = montar(4);
    for (let k = 0; k < 3; k++) registrarJogo(C, 1, 0);
    expect(registrarJogo(C, 3, 0)).toBe('campeao');
    expect(draftPremio(4).carta).toBe(true);
    expect(draftPremio(4).coins).toBeGreaterThan(draftPremio(2).coins);
  });
});
