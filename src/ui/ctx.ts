// Estado da interface compartilhado entre as telas.
import type { GameState } from '../engine/state';
import { flushSave, scheduleSave } from '../save/db';
import { W } from '../engine/world';

export type Tab = 'squad' | 'store' | 'club' | 'season' | 'editor' | 'start';
export const app = {
  S: null as unknown as GameState,
  tab: 'squad' as Tab,
  sel: null as { kind: 'xi' | 'bench'; i: number } | null,
  clubFilter: 'todos',
  clubSort: 'ovr' as 'ovr' | 'rec',
  /** Aba interna da tela da carreira. */
  careerView: 'tabela' as 'tabela' | 'lib' | 'outras' | 'trofeus',
  otherLeague: 'premier-league',
  startLiga: 'brasileirao',
  startClub: 'CAM',
  startShort: false,
  startLib: true,
  /** Começar a carreira com muitas moedas (para testar). */
  startRich: true,
};

let renderFn: () => void = () => {};
export const setRender = (f: () => void): void => { renderFn = f; };
export const render = (): void => renderFn();
export const save = (): void => scheduleSave(app.S);
/** Grava imediatamente (momentos importantes: fim de jogo, fim de temporada, pacotes). */
export const saveNow = (): void => { void flushSave(app.S).catch(e => console.warn('Falha ao salvar', e)); };

/** Clube do usuário para escudo e placar: o clube real da carreira (com o nome que você escolheu). */
export function userClub(): { n: string; s: string; c1: string; c2: string } {
  const c = app.S.career ? W.clubs.get(app.S.career.club) : undefined;
  const name = app.S.name.trim() || c?.n || 'Esquadrão FC';
  if (c) return { n: name, s: c.s, c1: c.c1, c2: c.c2 };
  const words = name.split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,3}$/.test(w));
  const s = (words.length > 1 ? words.slice(0, 3).map(w => w[0]).join('') : name.slice(0, 3)).toUpperCase();
  return { n: name, s, c1: '#e8c35f', c2: '#1d1403' };
}
