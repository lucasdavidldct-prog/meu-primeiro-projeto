import { describe, expect, it } from 'vitest';
import { cardData } from '../src/engine/cards';
import { findPlayer, newPlayerId, transferPlayer } from '../src/engine/data/edit';
import { formatLiga } from '../src/engine/data/format';
import { validarDados, validarJogador } from '../src/engine/data/validate';
import { packContents } from '../src/engine/packs';
import { seedRng } from '../src/engine/rng';
import { autoLineup, newGame, sanitizeState, teamInfo } from '../src/engine/state';
import { BUNDLED_LIGAS, NACOES, W, getPlayer, loadWorld } from '../src/engine/world';

describe('base de dados real', () => {
  it('passa na validação sem erros', () => {
    const r = validarDados({ ligas: BUNDLED_LIGAS, lendas: W.lendas, nacoes: NACOES });
    expect(r.erros).toEqual([]);
  });
  it('tem as 7 ligas com o número certo de clubes', () => {
    const n = Object.fromEntries(W.leagues.map(l => [l.id, l.clubs.length]));
    expect(n).toEqual({ brasileirao: 20, 'serie-b': 20, 'premier-league': 20, laliga: 20, 'serie-a': 20, bundesliga: 18, 'saudi-pro-league': 18, mls: 30, conmebol: 18 });
  });
  it('Cristiano Ronaldo no Al-Nassr e Messi no Inter Miami', () => {
    expect(W.pool.find(p => p.name.startsWith('Cristiano Ronaldo'))!.club).toBe('NAS');
    expect(W.pool.find(p => p.name.startsWith('Lionel Andrés Messi'))!.club).toBe('MIA');
  });
  it('o Galo tem elenco completo e atualizado', () => {
    const galo = W.byClub.get('CAM')!;
    expect(galo.length).toBeGreaterThanOrEqual(30);
    const nomes = galo.map(p => p.short);
    for (const n of ['Everson', 'Renan Lodi', 'Fred', 'Scarpa', 'Cuello', 'Mateo Cassierra', 'Castaño'].map(x => x.replace('Mateo ', ''))) expect(nomes.some(s => s.includes(n))).toBe(true);
    expect(nomes).not.toContain('Hulk'); // foi para o Fluminense em 2026
    expect(W.byClub.get('FLU')!.some(p => p.short === 'Hulk')).toBe(true);
  });
  it('lendas incluem ídolos do Galo', () => {
    const galo = W.legends.filter(l => l.legClub === 'CAM').map(l => l.short);
    for (const n of ['Reinaldo', 'Dadá Maravilha', 'Toninho Cerezo', 'Victor', 'Ronaldinho']) expect(galo).toContain(n);
  });
});

describe('cartas e pacotes com jogadores reais', () => {
  it('especiais são geradas de jogadores reais e sobem o overall', () => {
    const hulk = W.pool.find(p => p.short === 'Hulk')!;
    const h = cardData(hulk.id, 'heroi');
    expect(h.ovr).toBe(Math.min(99, hulk.ovr + 6));
    expect(h.tier).toBe('heroi');
    expect(h.name).toBe(hulk.name);
  });
  it('pacotes só trazem jogadores existentes', () => {
    seedRng(8);
    for (const id of ['bronze', 'prata', 'ouro', 'premium', 'especial', 'lenda'] as const) {
      for (const d of packContents(id)) expect(getPlayer(d.p)).toBeTruthy();
    }
  });
  it('novo jogo escala 11 titulares com jogadores reais', () => {
    seedRng(1);
    const S = newGame();
    autoLineup(S);
    expect(teamInfo(S).full).toBe(true);
    expect(S.cards.every(c => getPlayer(c.p))).toBe(true);
  });
});

describe('edição de dados', () => {
  it('transfere jogador entre ligas e valida a ficha', () => {
    const ligas = structuredClone(BUNDLED_LIGAS);
    const ronaldo = ligas.flatMap(l => l.clubes.flatMap(c => c.elenco)).find(j => j.nome.startsWith('Cristiano Ronaldo'))!;
    const changed = transferPlayer(ligas, ronaldo.id, 'CAM');
    expect(changed.map(l => l.id).sort()).toEqual(['brasileirao', 'saudi-pro-league']);
    expect(findPlayer(ligas, ronaldo.id)!.clube.id).toBe('CAM');
    const r = { erros: [] as string[], avisos: [] as string[] };
    validarJogador({ ...ronaldo, overall: 120, playstyles: ['reflexos'] }, 'x', NACOES, r);
    expect(r.erros.length).toBeGreaterThanOrEqual(2);
  });
  it('ids novos não colidem e o JSON formatado volta igual', () => {
    const ligas = structuredClone(BUNDLED_LIGAS);
    const id = newPlayerId(ligas, 'CAM', 'Everson');
    expect(id).not.toBe('cam-everson');
    const br = ligas.find(l => l.id === 'brasileirao')!;
    expect(JSON.parse(formatLiga(br))).toEqual(br);
  });
  it('cartas de jogadores removidos saem da coleção', () => {
    seedRng(2);
    const S = newGame();
    const victim = S.cards[0].p;
    const ligas = structuredClone(BUNDLED_LIGAS);
    const loc = findPlayer(ligas, victim)!;
    loc.clube.elenco.splice(loc.idx, 1);
    loadWorld(ligas);
    expect(sanitizeState(S)).toBeGreaterThanOrEqual(1);
    loadWorld(BUNDLED_LIGAS);
  });
});
