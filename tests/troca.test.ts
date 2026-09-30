import { describe, expect, it } from 'vitest';
import { Match, sideOpp } from '../src/engine/match';
import { oppFromClub } from '../src/engine/season';
import { W } from '../src/engine/world';

const jogo = () => new Match(sideOpp(oppFromClub(W.clubs.get('CAM')!)), sideOpp(oppFromClub(W.clubs.get('FLA')!)));

describe('sugestão de troca rápida', () => {
  it('não sugere nada no começo do jogo', () => {
    expect(jogo().suggestSub()).toBeNull();
  });
  it('no fim do jogo sugere tirar o mais cansado e pôr um reserva; recusado, não repete o mesmo', () => {
    const m = jogo();
    m.min = 86;
    // Reservas do mesmo nível dos titulares: trocar o cansado vale a pena
    m.A.bench = m.A.xi.filter(e => e.pos !== 'GOL').map(e => ({ ...e.P, id: e.P.id + '-reserva', short: e.P.short + ' II' }));
    const s = m.suggestSub()!;
    expect(s).not.toBeNull();
    expect(s.folego).toBeLessThan(70);
    expect(m.A.xi[s.out].pos).not.toBe('GOL');
    const nome = m.A.xi[s.out].name;
    const s2 = m.suggestSub(70, new Set([nome]));
    if (s2) expect(m.A.xi[s2.out].name).not.toBe(nome);
    // A troca sugerida é válida
    expect(m.substitute(s.out, s.inIdx).ok).toBe(true);
  });
  it('não sugere se o reserva renderia bem menos que o titular cansado', () => {
    const m = jogo(); m.min = 86;
    m.A.bench = m.A.bench.map(P => ({ ...P, ovr: 45 }));
    expect(m.suggestSub()).toBeNull();
  });
  it('sem substituições restantes, não sugere', () => {
    const m = jogo(); m.min = 86; m.A.subs = 0;
    expect(m.suggestSub()).toBeNull();
  });
});
