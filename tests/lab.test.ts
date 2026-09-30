import { describe, expect, it } from 'vitest';
import { PLAYSTYLES } from '../src/engine/data/schema';
import { defenseMods } from '../src/engine/lance';
import { LanceScene } from '../src/engine/lanceScene';
import { LAB, fmtEfeito, labMatch, labSetup, labSim, type Lvl } from '../src/engine/lab';
import { psLevel } from '../src/engine/playstyles';
import { mulberry32 } from '../src/engine/rng';

describe('laboratório de estilos', () => {
  it('cobre todos os estilos de jogo, com dica e efeitos coerentes', () => {
    for (const p of PLAYSTYLES) {
      const info = LAB[p.id];
      expect(info, p.id).toBeTruthy();
      expect(info.dica.length).toBeGreaterThan(10);
      for (const e of info.efeitos) { expect(e.v).toHaveLength(3); expect(fmtEfeito(e, 2)).not.toBe(''); }
    }
  });

  it('só o jogador testado tem o estilo, no nível pedido', () => {
    for (const lvl of [0, 1, 2] as Lvl[]) {
      const s = labSetup('chute-colocado', lvl);
      expect(psLevel(s.tested.P, 'chute-colocado')).toBe(lvl);
      const outros = [...s.A.xi, ...s.B.xi].filter(e => e !== s.tested);
      expect(outros.every(e => e.P.ps.length === 0 && e.P.ovr === 80)).toBe(true);
    }
  });

  it('defesa: três marcadores rivais; goleiro: o rival quando você chuta e o seu no lance de goleiro', () => {
    const d = labSetup('desarme', 2);
    expect(d.B.xi.filter(e => psLevel(e.P, 'desarme') === 2)).toHaveLength(3);
    expect(d.A.xi.some(e => e.P.ps.length)).toBe(false);
    expect(labSetup('reflexos', 1, undefined, 'ataque').B.xi.find(e => e.pos === 'GOL')!.P.ps).toEqual(['reflexos']);
    expect(labSetup('reflexos', 1, undefined, 'goleiro').A.xi.find(e => e.pos === 'GOL')!.P.ps).toEqual(['reflexos']);
  });

  it('estilos de defesa agora pesam no lance jogável: driblar, passar e chutar ficam mais difíceis', () => {
    const cena = (ps: string, lvl: Lvl) => {
      const s = labSetup(ps, lvl), m = labMatch(s);
      return new LanceScene(m, { kind: 'ataque', lado: 'meio', creator: s.A.xi.find(e => e.pos === 'MC')! }, mulberry32(7));
    };
    expect(defenseMods(labSetup('desarme', 0).B.xi).tackle).toBe(1);
    expect(defenseMods(labSetup('desarme', 1).B.xi).tackle).toBeCloseTo(1.15);
    expect(defenseMods(labSetup('desarme', 2).B.xi).tackle).toBeCloseTo(1.3);
    const alvo = { x: 34, y: 14 };
    const [d0, d1, d2] = ([0, 1, 2] as Lvl[]).map(l => cena('desarme', l).dribP(alvo));
    expect(d1).toBeLessThanOrEqual(d0); expect(d2).toBeLessThanOrEqual(d1); expect(d2).toBeLessThan(d0);
    const [b0, b2] = ([0, 2] as Lvl[]).map(l => cena('bloqueio', l).shotOdds(34, .65, 0).block);
    expect(b2).toBeGreaterThanOrEqual(b0);
  });

  it('simulação: com o estilo dourado o finalizador testado marca mais do que sem', async () => {
    const [sem, , mais] = await labSim('finalizacao-precisa', 150);
    expect(mais.tg).toBeGreaterThan(sem.tg);
  });
});
