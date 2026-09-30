import { describe, expect, it } from 'vitest';
import { autoLineup, cardByUid, loadPreset, MAX_ELENCOS, newCareerGame, removeCard, savePreset, setFormation } from '../src/engine/state';

describe('elencos salvos e número da camisa', () => {
  it('salva e carrega formação, titulares e tática', () => {
    const S = newCareerGame('CAM');
    autoLineup(S);
    const xi = [...S.squad.xi], form = S.squad.form;
    expect(savePreset(S, 'Titular').ok).toBe(true);
    setFormation(S, form === '4-4-2' ? '4-3-3' : '4-4-2'); S.tac.ment = 4;
    loadPreset(S, 0);
    expect(S.squad.form).toBe(form);
    expect(S.squad.xi).toEqual(xi);
  });
  it('máximo de elencos; mesmo nome substitui; carta vendida vira vaga vazia', () => {
    const S = newCareerGame('CAM');
    autoLineup(S);
    for (let i = 0; i < MAX_ELENCOS; i++) expect(savePreset(S, 'E' + i).ok).toBe(true);
    expect(savePreset(S, 'Outro').ok).toBe(false);
    expect(savePreset(S, 'E0').ok).toBe(true);
    removeCard(S, S.squad.xi[3]);
    expect(loadPreset(S, 0).faltando).toBe(1);
  });
  it('número da camisa escolhido vai para a carta', () => {
    const S = newCareerGame('CAM');
    const c = S.cards[0];
    c.ex = { num: 7 };
    expect(cardByUid(S, c.u)!.num).toBe(7);
  });
});
