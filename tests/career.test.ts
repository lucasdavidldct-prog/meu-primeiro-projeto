import { afterEach, describe, expect, it } from 'vitest';
import { endSeason, leagueStandings, needsPens, newCareer, nextFixture, recordResult, seasonOver, type Career } from '../src/engine/career';
import { penaltyShootout, sideOpp } from '../src/engine/match';
import { R, resetRng, seedRng } from '../src/engine/rng';
import { oppFromId } from '../src/engine/season';
import { aiTactics, clubStrength } from '../src/engine/squads';
import { newCareerGame, teamInfo } from '../src/engine/state';

afterEach(() => resetRng());

/** Joga a temporada inteira com um placar escolhido para o usuário. */
function playSeason(C: Career, score: () => [number, number]): number {
  let games = 0;
  for (let f = nextFixture(C); f; f = nextFixture(C)) {
    const [gf, ga] = score();
    recordResult(C, gf, ga, needsPens(f, gf, ga) ? [5, 4] : undefined);
    games++;
  }
  return games;
}

describe('carreira', () => {
  it('começa com o Galo na Série A, Brasileirão de 38 rodadas e Libertadores', () => {
    seedRng(1);
    const C = newCareer('CAM');
    expect(C.div).toBe('A');
    expect(C.league.teams).toHaveLength(20);
    expect(C.league.teams).toContain('CAM');
    expect(C.league.rounds).toHaveLength(38);
    expect(C.lib).not.toBeNull();
    expect(C.lib!.groups.flatMap(g => g.teams)).toHaveLength(16);
    expect(C.lib!.groups.flatMap(g => g.teams)).toContain('CAM');
    expect(C.cal.filter(x => x.c === 'liga')).toHaveLength(38);
    expect(C.cal.filter(x => x.c === 'lib')).toHaveLength(11);
  });

  it('temporada curta tem só o turno (19 rodadas)', () => {
    seedRng(2);
    const C = newCareer('CAM', { short: true });
    expect(C.league.rounds).toHaveLength(19);
  });

  it('turno e returno: cada time joga 38 vezes, contra todos, em casa e fora', () => {
    seedRng(3);
    const C = newCareer('CAM');
    const games = playSeason(C, () => [Math.floor(R() * 3), Math.floor(R() * 3)]);
    expect(games).toBeGreaterThanOrEqual(38 + 6);
    expect(seasonOver(C)).toBe(true);
    const st = leagueStandings(C.league);
    expect(st.every(s => s.P === 38)).toBe(true);
    expect(st.reduce((s, t) => s + t.GF, 0)).toBe(st.reduce((s, t) => s + t.GA, 0));
    const ui = C.league.teams.indexOf('CAM');
    const opp = new Map<number, number>();
    C.league.rounds.flat().filter(p => p.includes(ui)).forEach(([h, a]) => opp.set(h === ui ? a : h, (opp.get(h === ui ? a : h) ?? 0) + (h === ui ? 1 : 10)));
    expect([...opp.values()].every(v => v === 11)).toBe(true);
    expect(C.lib!.phase).toBe('fim');
    expect(C.lib!.champion).toBeTruthy();
  });

  it('as outras ligas avançam junto com o Brasileirão e ficam completas no fim', () => {
    seedRng(4);
    const C = newCareer('CAM', { libNow: false });
    while (C.league.round < 19) { const f = nextFixture(C)!; recordResult(C, 1, 1, needsPens(f, 1, 1) ? [5, 4] : undefined); }
    const pl = C.others.find(o => o.id === 'premier-league')!;
    expect(pl.round).toBe(19);
    const mls = C.others.find(o => o.id === 'mls')!;
    expect(mls.round).toBeGreaterThanOrEqual(14);
    playSeason(C, () => [1, 0]);
    const others = C.others;
    endSeason(C);
    expect(others.every(o => o.round === o.rounds.length)).toBe(true);
  });

  it('ganhando tudo: campeão brasileiro e da Libertadores, troféus e prêmios', () => {
    seedRng(5);
    const C = newCareer('CAM');
    playSeason(C, () => [3, 0]);
    const r = endSeason(C);
    expect(r.pos).toBe(1);
    expect(C.trophies.map(t => t.comp).sort()).toEqual(['brasileirao', 'copa-do-brasil', 'libertadores', 'mundial']);
    expect(r.coins).toBeGreaterThan(100000);
    expect(C.year).toBe(2027);
    expect(C.history).toHaveLength(1);
    expect(C.lib!.groups.flatMap(g => g.teams)).toContain('CAM'); // classificado de novo
    expect(new Set(C.brTeams).size).toBe(20);
  });

  it('perdendo tudo: rebaixado para a Série B, que troca 4 clubes com a Série A', () => {
    seedRng(6);
    const C = newCareer('CAM');
    const before = [...C.brTeams];
    playSeason(C, () => [0, 2]);
    const r = endSeason(C);
    expect(r.pos).toBe(20);
    expect(r.newDiv).toBe('B');
    expect(C.div).toBe('B');
    expect(C.league.id).toBe('serie-b');
    expect(C.league.teams).toContain('CAM');
    expect(C.lib).toBeNull();
    expect(C.brTeams).not.toContain('CAM');
    expect(C.brTeams.filter(id => !before.includes(id))).toHaveLength(4);
    expect(C.sbTeams).toHaveLength(20);
    expect(C.others.some(o => o.id === 'brasileirao')).toBe(true);
    // Campeão da Série B sobe
    playSeason(C, () => [2, 0]);
    expect(endSeason(C).newDiv).toBe('A');
    expect(C.brTeams).toContain('CAM');
  });

  it('clube da Série B começa na Série B, sem Libertadores', () => {
    seedRng(7);
    const C = newCareer('CEA');
    expect(C.div).toBe('B');
    expect(C.lib).toBeNull();
    expect(C.league.id).toBe('serie-b');
  });

  it('mata-mata: agregado empatado no jogo decisivo pede pênaltis', () => {
    seedRng(8);
    const C = newCareer('CAM');
    let saw = false;
    for (let f = nextFixture(C); f; f = nextFixture(C)) {
      if (f.ko?.decisive) { expect(needsPens(f, f.ko.agg[1], f.ko.agg[0])).toBe(true); saw = true; }
      recordResult(C, 2, 0);
    }
    expect(saw).toBe(true);
  });
});

describe('pênaltis e IA', () => {
  it('disputa de pênaltis sempre tem vencedor', () => {
    seedRng(9);
    for (let i = 0; i < 200; i++) {
      const s = penaltyShootout(sideOpp(oppFromId('CAM')), sideOpp(oppFromId('CRU')));
      expect(s.a).not.toBe(s.b);
      expect(s.winner).toBe(s.a > s.b ? 0 : 1);
      expect(Math.max(s.a, s.b)).toBeLessThanOrEqual(12);
    }
  });
  it('IA fecha o time contra adversário muito mais forte e toma a iniciativa contra fraco', () => {
    const fraco = aiTactics('REM', clubStrength('RMA'));
    expect(['retranca', 'contra']).toContain(fraco.style);
    const forte = aiTactics('RMA', clubStrength('REM'));
    expect(['posse', 'pressao']).toContain(forte.style);
  });
  it('o elenco real do clube vira as cartas iniciais', () => {
    seedRng(10);
    const S = newCareerGame('CAM');
    expect(S.cards.length).toBeGreaterThanOrEqual(30);
    expect(teamInfo(S).full).toBe(true);
    expect(S.name).toBe('Atlético Mineiro');
    const B = newCareerGame('GOI');
    expect(B.cards.length).toBeGreaterThanOrEqual(18);
    expect(teamInfo(B).full).toBe(true);
  });

  it('Copa do Brasil todo ano (32 clubes, mata-mata) e Super Mundial para quem se classifica', () => {
    seedRng(11);
    const C = newCareer('CAM');
    const cdb = C.copas!.find(x => x.id === 'cdb')!, mun = C.copas!.find(x => x.id === 'mundial')!;
    expect(cdb.rounds[0].ties).toHaveLength(16);
    expect(cdb.rounds[0].ties.some(t => t.a === 'CAM' || t.b === 'CAM')).toBe(true);
    expect(mun.groups).toHaveLength(8);
    expect(new Set(mun.groups.flatMap(g => g.teams)).size).toBe(32);
    expect(mun.groups.flatMap(g => g.teams)).toContain('CAM');
    // Perdendo tudo: cai cedo nas copas, mas elas terminam com campeão
    playSeason(C, () => [0, 1]);
    expect(cdb.champion).toBeTruthy();
    expect(mun.champion).toBeTruthy();
    const r = endSeason(C);
    expect(r.msgs.some(m => m.includes('Copa do Brasil'))).toBe(true);
    expect(C.mundialNext).toBe(false);
    // Na temporada seguinte só há a Copa do Brasil
    expect(C.copas!.map(x => x.id)).toEqual(['cdb']);
  });

  it('sem a vaga inicial, não joga o Mundial; jogos da Copa do Brasil aparecem no calendário', () => {
    seedRng(12);
    const C = newCareer('CAM', { libNow: false });
    expect(C.copas!.map(x => x.id)).toEqual(['cdb']);
    let copa = 0;
    for (let f = nextFixture(C); f; f = nextFixture(C)) { if (f.comp === 'copa') copa++; recordResult(C, 2, 0); }
    expect(copa).toBe(9); // 1ª fase + 4 fases de ida e volta (ganhando todas)
    expect(C.copas![0].champion).toBe('CAM');
  });
});
