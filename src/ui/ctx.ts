// Estado da interface compartilhado entre as telas.
import type { GameState } from '../engine/state';
import { scheduleSave } from '../save/db';

export type Tab = 'squad' | 'store' | 'club' | 'season' | 'editor';
export const app = {
  S: null as unknown as GameState,
  tab: 'squad' as Tab,
  sel: null as { kind: 'xi' | 'bench'; i: number } | null,
  clubFilter: 'todos',
  clubSort: 'ovr' as 'ovr' | 'rec',
};

let renderFn: () => void = () => {};
export const setRender = (f: () => void): void => { renderFn = f; };
export const render = (): void => renderFn();
export const save = (): void => scheduleSave(app.S);

/** Clube do usuário para escudo e placar (sigla com as iniciais do nome). */
export function userClub(): { n: string; s: string; c1: string; c2: string } {
  const name = app.S.name.trim() || 'Esquadrão FC';
  const words = name.split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,3}$/.test(w));
  const s = (words.length > 1 ? words.slice(0, 3).map(w => w[0]).join('') : name.slice(0, 3)).toUpperCase();
  return { n: name, s, c1: '#e8c35f', c2: '#1d1403' };
}
