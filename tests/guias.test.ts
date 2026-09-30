import { describe, expect, it } from 'vitest';
import { recordResult } from '../src/engine/career';
import { guiaTatico, ranking } from '../src/engine/guides';
import { autoLineup, newCareerGame } from '../src/engine/state';

describe('guias e estatísticas', () => {
  it('ranking por posição em ordem de força; Fora de Série aparecem no topo das lendas', () => {
    const r = ranking('MEI', 'lendas', 10);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].v).toBeGreaterThanOrEqual(r[i].v);
    expect(r.slice(0, 5).some(x => x.P.fs)).toBe(true);
    expect(ranking('GOL', 'atuais', 5).every(x => x.P.pos === 'GOL')).toBe(true);
  });
  it('guia tático devolve todas as combinações (formações × estilos + extremos)', async () => {
    const S = newCareerGame('CAM'); autoLineup(S);
    const g = await guiaTatico(S, 2);
    expect(g.lista.length).toBeGreaterThan(40);
    expect(g.lista.every(x => x.gf >= 0 && x.ga >= 0)).toBe(true);
    expect(g.rival).toBeTruthy();
  });
  it('artilharia da liga: jogos da IA distribuem gols pelos elencos; os seus gols entram pelos seus números', () => {
    const S = newCareerGame('CAM'); const C = S.career!;
    recordResult(C, 2, 0, undefined, [{ id: 'cam-hulk', g: 2, a: 0 }]);
    const art = C.league.art!;
    expect(Object.values(art).reduce((s, r) => s + r.g, 0)).toBeGreaterThan(2);
    if (art['cam-hulk']) expect(art['cam-hulk'].g).toBe(2);
  });
  it('temporada inteira simulada sem erro, inclusive clubes com elenco curto', () => {
    for (const club of ['CAM', 'CHA', 'REM']) {
      const S = newCareerGame(club); const C = S.career!;
      for (let i = 0; i < 60 && C.idx < C.cal.length; i++) expect(() => recordResult(C, 1, 1, [4, 3], [])).not.toThrow();
    }
  });
});
