import { describe, expect, it } from 'vitest';
import { applyIncidents, type Career } from '../src/engine/career';
import { sideOpp, simulate } from '../src/engine/match';
import { resetRng, seedRng } from '../src/engine/rng';
import { oppFromClub } from '../src/engine/season';
import { autoLineup, cardByUid, newCareerGame, outOf, replaceUnavailable } from '../src/engine/state';
import { W } from '../src/engine/world';

const car = () => ({}) as Career;

describe('cartões, suspensão e lesões', () => {
  it('expulsão suspende o próximo jogo e o jogador volta depois de cumprir', () => {
    const C = car();
    applyIncidents(C, { y: [], r: ['p1'], les: [] });
    expect(C.fora!.p1).toEqual({ t: 'susp', n: 1 });
    applyIncidents(C, { y: [], r: [], les: [] }); // cumpriu
    expect(C.fora!.p1).toBeUndefined();
  });
  it('3 amarelos = suspensão de 1 jogo e zera a contagem', () => {
    const C = car();
    for (let i = 0; i < 2; i++) applyIncidents(C, { y: ['p2'], r: [], les: [] });
    expect(C.fora?.p2).toBeUndefined();
    applyIncidents(C, { y: ['p2'], r: [], les: [] });
    expect(C.fora!.p2.t).toBe('susp');
    expect(C.amarelos!.p2).toBeUndefined();
  });
  it('lesão tira o jogador pelo número de jogos', () => {
    const C = car();
    applyIncidents(C, { y: [], r: [], les: [{ id: 'p3', jogos: 2 }] });
    applyIncidents(C, { y: [], r: [], les: [] });
    expect(C.fora!.p3.n).toBe(1);
    applyIncidents(C, { y: [], r: [], les: [] });
    expect(C.fora!.p3).toBeUndefined();
  });
  it('na hora de jogar, suspenso sai do time e entra outro; a escalação automática ignora quem está fora', () => {
    const S = newCareerGame('CAM');
    autoLineup(S);
    const P = cardByUid(S, S.squad.xi[5])!;
    S.career!.fora = { [P.id]: { t: 'susp', n: 1 } };
    const trocas = replaceUnavailable(S);
    expect(trocas.length).toBe(1);
    expect(S.squad.xi.map(u => cardByUid(S, u)!.id)).not.toContain(P.id);
    autoLineup(S);
    expect(S.squad.xi.every(u => !outOf(S, cardByUid(S, u)!.id))).toBe(true);
  });
  it('expulsões são raras (≈0,2 por jogo) e 2 no mesmo time quase nunca', async () => {
    seedRng(11);
    let reds = 0, dois = 0;
    const s = (id: string) => sideOpp(oppFromClub(W.clubs.get(id)!));
    for (let i = 0; i < 400; i++) {
      const m = await simulate(s('CAM'), s('FLA'));
      const a = m.A.xi.filter(e => e.red).length, b = m.B.xi.filter(e => e.red).length;
      reds += a + b; if (a >= 2 || b >= 2) dois++;
    }
    resetRng();
    expect(reds / 400).toBeLessThan(.35);
    expect(dois / 400).toBeLessThan(.03);
  });
});
