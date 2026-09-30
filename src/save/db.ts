// Save em IndexedDB (um registro por slot), mais exportação/importação em JSON.
import { SAVE_VERSION, newGame, sanitizeState, type GameState } from '../engine/state';

const DB_NAME = 'esquadrao-fc';
const STORE = 'saves';
const SLOT = 'principal';
/** Loja com as ligas editadas no Editor de elencos (chave = id da liga). */
export const STORE_DADOS = 'dados';
/** Fotos de jogadores escolhidas por você (chave = id do jogador, valor = data URL JPEG). */
export const STORE_FOTOS = 'fotos';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 3);
    rq.onupgradeneeded = () => {
      for (const s of [STORE, STORE_DADOS, STORE_FOTOS]) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s);
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((res, rej) => {
      const t = db.transaction(store, mode);
      const rq = fn(t.objectStore(store));
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

/** Atualiza saves antigos. Saves das versões 1 e 2 usavam jogadores fictícios:
 *  mantém nome, moedas, campanha e troféus, e começa um elenco novo com jogadores reais. */
export function migrate(S: GameState): GameState {
  if (!S.v || S.v < 3 || S.cards.some(c => typeof c.p !== 'string')) {
    const N = newGame();
    Object.assign(N, { name: S.name || N.name, coins: S.coins ?? N.coins, rec: S.rec ?? N.rec, titles: S.titles ?? 0, lastFree: S.lastFree ?? '', moments: S.moments ?? true });
    N.aviso = 'Seu save era da versão com jogadores fictícios. Mantivemos nome, moedas e campanha, e o elenco agora tem jogadores reais.';
    return N;
  }
  if (S.v < 4 || !('career' in S)) {
    // Saves antes do modo carreira: mantém a coleção, mas pede para escolher o clube.
    delete (S as { season?: unknown }).season;
    S.career = null; S.v = SAVE_VERSION;
    S.aviso = 'Novo modo carreira! Escolha o seu clube para começar.';
  }
  const n = sanitizeState(S);
  if (n) S.aviso = `${n} carta(s) de jogadores removidos no editor saíram da coleção.`;
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

/** Grava com atraso para não escrever a cada clique, mas nunca adia mais que MAX_WAIT (cliques seguidos). */
const MAX_WAIT = 1500;
let timer: ReturnType<typeof setTimeout> | undefined;
let firstPending = 0;
let chain: Promise<void> = Promise.resolve();
export function scheduleSave(S: GameState, delay = 400): void {
  const now = Date.now();
  if (!firstPending) firstPending = now;
  clearTimeout(timer);
  const wait = Math.max(0, Math.min(delay, firstPending + MAX_WAIT - now));
  timer = setTimeout(() => {
    firstPending = 0;
    chain = chain.catch(() => {}).then(() => writeSave(S)).catch(e => console.warn('Falha ao salvar', e));
  }, wait);
}
export async function flushSave(S: GameState): Promise<void> {
  clearTimeout(timer); firstPending = 0;
  chain = chain.catch(() => {}).then(() => writeSave(S));
  await chain;
}
