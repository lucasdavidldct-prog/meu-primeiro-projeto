import { describe, expect, it } from 'vitest';
import { detail, skillStars, sub, weakFoot } from '../src/engine/attrs';
import { cardData } from '../src/engine/cards';
import { chemBoost, withChem } from '../src/engine/chemStyles';
import { addCard, blankGame, cardByUid, mergePs } from '../src/engine/state';
import { W } from '../src/engine/world';

const ronaldinho = () => cardData('lenda-ronaldinho', 'lenda');

describe('atributos detalhados', () => {
  it('a média de cada grupo é o atributo principal (±1 pelo arredondamento)', () => {
    for (const P of W.pool.slice(0, 300)) {
      if (P.pos === 'GOL') continue;
      for (const g of detail(P).groups) {
        const m = g.subs.reduce((a, s) => a + s.v, 0) / g.subs.length;
        expect(Math.abs(m - g.main)).toBeLessThanOrEqual(1.5);
      }
    }
  });
  it('estilos puxam os subatributos ligados a eles', () => {
    const P = ronaldinho();
    // Bola Parada + → Precisão na falta acima do Passe
    expect(sub(P, 'Precisão na falta')).toBeGreaterThan(P.st[2]);
    // Sem o estilo, a precisão na falta cai
    expect(sub({ ...P, ps: [] }, 'Precisão na falta')).toBeLessThan(sub(P, 'Precisão na falta'));
  });
  it('estrelas de drible e perna ruim ficam entre 1 e 5; ambidestro tem perna ruim 5', () => {
    for (const P of W.pool.slice(0, 200)) {
      expect(skillStars(P)).toBeGreaterThanOrEqual(1); expect(skillStars(P)).toBeLessThanOrEqual(5);
      expect(weakFoot(P)).toBeGreaterThanOrEqual(2); expect(weakFoot(P)).toBeLessThanOrEqual(5);
    }
    expect(weakFoot({ ...ronaldinho(), foot: 'A' })).toBe(5);
    expect(skillStars(ronaldinho())).toBe(5);
  });
});

describe('personalização da carta', () => {
  it('estilo + substitui o prata do mesmo estilo; o prata não rebaixa um +', () => {
    expect(mergePs(['velocista'], 'velocista')).toEqual(['velocista+']);
    expect(mergePs(['velocista+'], undefined, 'velocista')).toEqual(['velocista+']);
    expect(mergePs([], 'chute-rasteiro', 'tiki-taka')).toEqual(['chute-rasteiro+', 'tiki-taka']);
  });
  it('a carta do usuário recebe os estilos extras e guarda a química escolhida', () => {
    const S = blankGame(), c = addCard(S, 'lenda-ronaldinho', 'lenda');
    c.ex = { plus: 'chute-rasteiro', prata: 'velocista', quim: 'maestro' };
    const P = cardByUid(S, c.u)!;
    expect(P.ps).toContain('chute-rasteiro+');
    expect(P.ps).toContain('velocista');
    expect(P.quim).toBe('maestro');
  });
  it('química: bônus cheio com química 3, proporcional abaixo, nada com 0', () => {
    expect(chemBoost('maestro', 3)).toEqual([0, 0, 5, 5, 0, 0]);
    expect(chemBoost('maestro', 0)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(chemBoost('artilheiro', 2)).toEqual([3, 3, 0, 0, 0, 0]);
    const P = ronaldinho(), Q = withChem(P, 'maestro', 3);
    expect(Q.st[2]).toBe(Math.min(99, P.st[2] + 5));
    expect(Q).not.toBe(P);
    expect(withChem(P, 'maestro', 0)).toBe(P);
  });
});
