// Ligas editadas no Editor de elencos, guardadas no IndexedDB (usadas quando não há servidor local).
import type { LigaData } from '../engine/data/schema';
import { STORE_DADOS, openDb, tx } from './db';

export async function loadEditedLigas(): Promise<Record<string, LigaData>> {
  const db = await openDb();
  try {
    return await new Promise((res, rej) => {
      const out: Record<string, LigaData> = {};
      const t = db.transaction(STORE_DADOS, 'readonly');
      const rq = t.objectStore(STORE_DADOS).openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { out[String(c.key)] = c.value as LigaData; c.continue(); } };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  } finally { db.close(); }
}
export const saveEditedLiga = (l: LigaData): Promise<IDBValidKey> => tx('readwrite', s => s.put(structuredClone(l), l.id), STORE_DADOS);
export const discardEditedLiga = (id: string): Promise<undefined> => tx('readwrite', s => s.delete(id), STORE_DADOS);
