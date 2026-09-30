import { describe, expect, it } from 'vitest';
import { Match, sideOpp } from '../src/engine/match';
import { LanceScene } from '../src/engine/lanceScene';
import { oppFromClub } from '../src/engine/season';
import { W } from '../src/engine/world';
import { seedRng } from '../src/engine/rng';
import { PLAYSTYLES } from '../src/engine/data/schema';

function cena() {
  seedRng(11);
  const m = new Match(sideOpp(oppFromClub(W.clubs.get('CAM')!)), sideOpp(oppFromClub(W.clubs.get('FLA')!)));
  const sc = new LanceScene(m, { kind: 'ataque' });
  const c = sc.carrier; c.x = 30; c.y = 17; sc.react(); for (const a of sc.foes) { a.x = a.tx; a.y = a.ty; }
  const P0 = c.e!.P;
  const com = (ps: string[]) => { c.e!.P = { ...P0, ps }; };
  return { sc, com };
}
const gol = (sc: LanceScene, power: number, curve: number) => Math.max(...[31.2, 36.8].map(ax => sc.shotOdds(ax, power, curve).goal));

describe('playstyles novos no lance', () => {
  it('Chute Colocado: o chute curvo entra mais, e o + mais ainda', () => {
    const { sc, com } = cena();
    com([]); const sem = gol(sc, .6, .6);
    com(['chute-colocado']); const normal = gol(sc, .6, .6);
    com(['chute-colocado+']); const plus = gol(sc, .6, .6);
    expect(normal).toBeGreaterThan(sem * 1.15);
    expect(plus).toBeGreaterThan(normal * 1.1);
  });
  it('Super Chute: o chute forte entra mais e demora mais para ir por cima', () => {
    const { sc, com } = cena();
    com([]); const sem = gol(sc, .9, 0);
    com(['chute-de-longe+']); const plus = gol(sc, .9, 0);
    expect(plus).toBeGreaterThan(sem * 1.3);
  });
  it('Cavadinha: sem o playstyle o toque lento é defendido; com ele passa por cima do goleiro', () => {
    const { sc, com } = cena();
    com([]); const sem = gol(sc, .25, 0);
    com(['cavadinha']); const com1 = gol(sc, .25, 0);
    expect(com1).toBeGreaterThan(sem * 1.5);
  });
  it('Tiki-Taka deixa o passe curto quase garantido', () => {
    const { sc, com } = cena();
    const perto = sc.mates.filter(m => m !== sc.carrier).sort((a, b) => Math.hypot(a.x - 30, a.y - 17) - Math.hypot(b.x - 30, b.y - 17))[0];
    perto.x = 36; perto.y = 20;
    com([]); const sem = sc.passP(perto);
    com(['tiki-taka+']); const tt = sc.passP(perto);
    expect(tt).toBeGreaterThanOrEqual(Math.min(.95, Math.max(sem, .76)));
  });
  it('todo playstyle tem categoria, ícone e descrição', () => {
    for (const p of PLAYSTYLES) { expect(p.cat).toBeTruthy(); expect(p.icone).toBeTruthy(); expect(p.desc.length).toBeGreaterThan(10); }
    expect(new Set(PLAYSTYLES.map(p => p.icone)).size).toBe(PLAYSTYLES.length);
  });
});
