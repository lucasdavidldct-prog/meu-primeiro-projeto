import { describe, expect, it } from 'vitest';
import { FUNCS, orderFx, suggestOrder, ROLE_SWAPS } from '../src/engine/orders';
import { rate, sectorEff } from '../src/engine/chemistry';
import { FORM_IDS, slotsOf } from '../src/engine/positions';
import type { BasePlayer, Pos } from '../src/engine/types';
import { newGame, setFormation, setOrder, setRole, squadSlots, teamInfo } from '../src/engine/state';

const pl = (pos: Pos, st: number[], ps: string[] = [], ovr = 80): BasePlayer =>
  ({ id: pos + st.join(''), name: 'X', short: 'X', nat: 'BRA', pos, alt: [], ovr, lg: 'l', club: 'C', age: 25, st, foot: 'D', ps });

describe('orientações e funções', () => {
  it('toda posição tem funções e a primeira é o padrão', () => {
    for (const g of Object.values(FUNCS)) expect(g.length).toBeGreaterThanOrEqual(2);
  });
  it('"fica no ataque" aumenta o ataque e tira da defesa; "volta para defender" faz o contrário', () => {
    const a = orderFx('MC', { f: 'box-to-box', p: 1 }), d = orderFx('MC', { f: 'box-to-box', p: -1 });
    expect(a.att).toBeGreaterThan(d.att);
    expect(a.def).toBeLessThan(d.def);
    expect(a.expose).toBeGreaterThan(d.expose);
  });
  it('mudar a função de um volante para armador reforça o meio do time', () => {
    const xi = slotsOf('4-3-3').map(s => ({ pos: s.p, eff: 78 }));
    const base = rate(xi).mid;
    const withReg = rate(xi.map(e => (e.pos === 'VOL' ? { ...e, ofx: orderFx('VOL', { f: 'regista' }) } : e))).mid;
    expect(withReg).toBeGreaterThan(base);
  });
  it('atributos pesam: atacante com FIN alto vale mais no ataque que outro de mesmo overall', () => {
    const fin = pl('ATA', [80, 92, 70, 80, 35, 75]), weak = pl('ATA', [80, 70, 78, 80, 35, 85]);
    expect(sectorEff({ pos: 'ATA', eff: 80, P: fin }, 'att')).toBeGreaterThan(sectorEff({ pos: 'ATA', eff: 80, P: weak }, 'att') + 3);
  });
  it('playstyle + vale bem mais que o normal no setor', () => {
    const n = pl('ZAG', [70, 40, 65, 55, 82, 80], ['desarme']), p = pl('ZAG', [70, 40, 65, 55, 82, 80], ['desarme+']);
    const e = (P: BasePlayer) => sectorEff({ pos: 'ZAG', eff: 80, P }, 'def');
    expect(e(p) - e(n)).toBeGreaterThanOrEqual(1.5);
  });
  it('sugestão pelos atributos: pivô, falso 9, velocista', () => {
    expect(suggestOrder(pl('ATA', [70, 82, 72, 70, 40, 88], ['cabeceio']), 'ATA').f).toBe('pivo');
    expect(suggestOrder(pl('ATA', [90, 84, 70, 86, 30, 70]), 'ATA').f).toBe('velocista');
    expect(suggestOrder(pl('ATA', [75, 80, 86, 88, 35, 65]), 'ATA').f).toBe('falso-9');
  });
});

describe('funções no time do usuário', () => {
  it('trocar VOL por MC muda a vaga; trocar a formação volta ao padrão', () => {
    const S = newGame();
    setFormation(S, '4-3-3');
    const i = slotsOf('4-3-3').findIndex(s => s.p === 'VOL');
    expect(ROLE_SWAPS.VOL).toContain('MC');
    setRole(S, i, 'MC');
    expect(squadSlots(S)[i].p).toBe('MC');
    setOrder(S, i, { f: 'armador', p: 1 });
    expect(teamInfo(S).slots[i].p).toBe('MC');
    setFormation(S, '4-4-2');
    expect(S.squad.roles).toBeUndefined();
    expect(S.squad.ord).toBeUndefined();
  });
  it('há pelo menos 18 formações, todas com 11 vagas e 1 goleiro', () => {
    expect(FORM_IDS.length).toBeGreaterThanOrEqual(18);
    for (const f of FORM_IDS) { const s = slotsOf(f); expect(s).toHaveLength(11); expect(s.filter(x => x.p === 'GOL')).toHaveLength(1); }
  });
});

import { Match, sideFromTeam, sideOpp } from '../src/engine/match';
import { oppFromId } from '../src/engine/season';
import { orderAt, newCareerGame } from '../src/engine/state';

describe('por onde nascem os lances', () => {
  const origem = (alas: boolean) => {
    const S = newCareerGame('CAM', {});
    if (alas) slotsOf(S.squad.form).forEach((sl, i) => { if (sl.p === 'LD' || sl.p === 'LE') setOrder(S, i, { f: 'ala' }); if (sl.p === 'PD' || sl.p === 'PE') setOrder(S, i, { f: 'aberto' }); });
    const T = teamInfo(S), ord = T.slots.map((sl, i) => orderAt(S, i, T.xi[i], sl.p));
    const A = sideFromTeam(T, { name: 'CAM', form: S.squad.form, style: 'equilibrado', ment: 2, bench: [], ord });
    const m = new Match(A, sideOpp(oppFromId('FLA')));
    let lados = 0;
    for (let k = 0; k < 1500; k++) if (m.origin(A).lado !== 'meio') lados++;
    return lados / 1500;
  };
  it('boa parte das jogadas sai pelas pontas, e mais ainda com alas e pontas abertos', () => {
    const normal = origem(false), abertos = origem(true);
    expect(normal).toBeGreaterThan(.4);
    expect(abertos).toBeGreaterThan(normal);
  });
});

import { addCard, autoLineup, teamStrength } from '../src/engine/state';
import { packContents } from '../src/engine/packs';
describe('escalar melhor time', () => {
  it('não perde Força para a escalação por posição exata e mantém química alta', () => {
    const S = newCareerGame('CAM', {});
    for (let k = 0; k < 4; k++) for (const x of packContents('ouro')) addCard(S, x.p, x.v);
    const base = teamStrength(teamInfo(S));
    autoLineup(S);
    const T = teamInfo(S);
    expect(teamStrength(T)).toBeGreaterThanOrEqual(base);
    expect(T.full).toBe(true);
    const ids = T.xi.map(P => P!.id);
    expect(new Set(ids).size).toBe(11);
  });
});
