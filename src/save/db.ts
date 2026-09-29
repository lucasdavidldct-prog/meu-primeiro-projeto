// Save em IndexedDB (um registro por slot), mais exportação/importação em JSON.
import { SAVE_VERSION, type GameState } from '../engine/state';

const DB_NAME = 'esquadrao-fc';
const STORE = 'saves';
const SLOT = 'principal';

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((res, rej) => {
      const t = db.transaction(STORE, mode);
      const rq = fn(t.objectStore(STORE));
      t.oncomplete = () => res(rq.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  } finally { db.close(); }
}

export async function loadSave(): Promise<GameState | null> {
  const v = await tx<unknown>('readonly', s => s.get(SLOT));
  return isGameState(v) ? migrate(v) : null;
}

export async function writeSave(S: GameState): Promise<void> {
  S.t = Date.now();
  // structuredClone evita guardar referências vivas do estado em memória
  await tx('readwrite', s => s.put(structuredClone(S), SLOT));
}

export async function clearSave(): Promise<void> { await tx('readwrite', s => s.delete(SLOT)); }

export function isGameState(o: unknown): o is GameState {
  const g = o as GameState;
  return !!g && typeof g === 'object' && Array.isArray(g.cards) && !!g.squad && Array.isArray(g.squad.xi) && typeof g.coins === 'number';
}

/** Atualiza saves antigos (inclusive o do esquadrao.html, versão 1). */
export function migrate(S: GameState): GameState {
  if (!S.v || S.v < 2) S.v = SAVE_VERSION;
  return S;
}

export function exportJson(S: GameState): string {
  return JSON.stringify({ app: 'esquadrao-fc', exportado: new Date().toISOString(), save: S }, null, 1);
}

export function importJson(text: string): GameState {
  let o: unknown;
  try { o = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  const cand = (o as { save?: unknown })?.save ?? o;
  if (!isGameState(cand)) throw new Error('Esse JSON não parece um save do Esquadrão FC.');
  return migrate(cand);
}

/** Grava com atraso para não escrever a cada clique. */
let timer: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<void> = Promise.resolve();
export function scheduleSave(S: GameState, delay = 400): void {
  clearTimeout(timer);
  timer = setTimeout(() => { chain = chain.catch(() => {}).then(() => writeSave(S)).catch(e => console.warn('Falha ao salvar', e)); }, delay);
}
export async function flushSave(S: GameState): Promise<void> {
  clearTimeout(timer);
  chain = chain.catch(() => {}).then(() => writeSave(S));
  await chain;
}
