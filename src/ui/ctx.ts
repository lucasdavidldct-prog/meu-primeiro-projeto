// Estado da interface compartilhado entre as telas.
import type { GameState } from '../engine/state';
import { scheduleSave } from '../save/db';

export type Tab = 'squad' | 'store' | 'club' | 'season';
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
