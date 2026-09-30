import { describe, expect, it } from 'vitest';
import { labMatch, labSetup, type Lvl } from '../src/engine/lab';
import { LanceScene } from '../src/engine/lanceScene';
import { mulberry32 } from '../src/engine/rng';

/** Cena com o jogador testado (estilo no nível pedido) com a bola num ponto fixo. */
function cena(ps: string, lvl: Lvl, x: number, y: number) {
  const s = labSetup(ps, lvl), sc = new LanceScene(labMatch(s), { kind: 'ataque', lado: 'meio', creator: s.tested }, mulberry32(3));
  sc.carrier.x = x; sc.carrier.y = y;
  sc.foes.forEach((f, i) => { if (!f.gk) { f.x = 5 + i; f.y = 40; } });
  return sc;
}

describe('tipo de chute escolhido no lance', () => {
  it('rasteiro de perto: o goleiro defende menos que no chute normal; com Chute Rasteiro+, menos ainda', () => {
    const n = cena('chute-rasteiro', 0, 34, 14).shotOdds(36, .65, 0, 'normal').save;
    const r = cena('chute-rasteiro', 0, 34, 14).shotOdds(36, .65, 0, 'rasteiro').save;
    const r2 = cena('chute-rasteiro', 2, 34, 14).shotOdds(36, .65, 0, 'rasteiro').save;
    expect(r).toBeLessThan(n);
    expect(r2).toBeLessThan(r);
  });
  it('rasteiro de longe perde precisão; cavadinha de longe quase sempre erra', () => {
    const perto = cena('chute-rasteiro', 0, 34, 14).shotOdds(36, .65, 0, 'rasteiro').miss;
    const longe = cena('chute-rasteiro', 0, 34, 30).shotOdds(36, .65, 0, 'rasteiro').miss;
    expect(longe).toBeGreaterThan(perto);
    expect(cena('cavadinha', 1, 34, 28).shotOdds(34, .3, 0, 'cavadinha').miss).toBeGreaterThan(.4);
  });
  it('escolher Colocado com traço reto dá curva para dentro do gol; Forte bate forte mesmo com traço lento', () => {
    const sc = cena('chute-colocado', 1, 34, 16);
    sc.shotType = 'colocado';
    const t = sc.shotFromGesture({ angle: Math.atan2(-16, 4), power: .5, curve: 0 });
    expect(t && t.kind === 'shot' && Math.abs(t.curve)).toBeGreaterThanOrEqual(.3);
    const k = sc.shotKind(.4, 0, 'forte');
    expect(k).toEqual({ colocado: false, forte: true, cav: false, rasteiro: false });
  });
  it('modo Auto continua lendo o gesto como antes', () => {
    const sc = cena('chute-colocado', 0, 34, 16);
    expect(sc.shotKind(.8, .5, 'auto')).toMatchObject({ colocado: true, forte: true });
    expect(sc.shotKind(.3, 0, 'auto').cav).toBe(true);
  });
});
