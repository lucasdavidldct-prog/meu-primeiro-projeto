// Fotos dos jogadores: a sua (escolhida no celular, fica no aparelho) ou a livre da Wikimedia Commons (precisa de internet).
import FOTOS from '../../data/fotos.json';
import { paginaFoto, urlFoto, urlFotoDireta, type FotoRef } from '../engine/data/fotos';
import { STORE_FOTOS, openDb, tx } from '../save/db';
import { app } from './ctx';

const commons = FOTOS as Record<string, FotoRef>;
const minhas = new Map<string, string>();

/** Carrega as fotos escolhidas por você (uma vez, ao abrir o jogo). */
export async function loadMinhasFotos(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((res, rej) => {
      const rq = db.transaction(STORE_FOTOS, 'readonly').objectStore(STORE_FOTOS).openCursor();
      rq.onsuccess = () => { const c = rq.result; if (!c) { res(); return; } minhas.set(String(c.key), c.value as string); c.continue(); };
      rq.onerror = () => rej(rq.error);
    });
  } finally { db.close(); }
}

export type FonteFoto = 'minha' | 'commons';
export function fotoDe(id: string): { url: string; fonte: FonteFoto; pagina?: string; alt?: string } | null {
  const m = minhas.get(id);
  if (m) return { url: m, fonte: 'minha' };
  const c = commons[id];
  if (c && app.S?.fotos !== false) return { url: urlFotoDireta(c.f), alt: urlFoto(c.f), fonte: 'commons', pagina: paginaFoto(c.f) };
  return null;
}
export const temFotoCommons = (id: string): boolean => !!commons[id];
export const totalFotosCommons = (): number => Object.values(commons).filter(Boolean).length;

/** Recorta a imagem em quadrado (priorizando a parte de cima, onde fica o rosto) e reduz para 256 px. */
async function reduzir(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = img.height > img.width ? (img.height - s) * .15 : 0;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  cv.getContext('2d')!.drawImage(img, sx, sy, s, s, 0, 0, 256, 256);
  img.close();
  return cv.toDataURL('image/jpeg', .85);
}

export async function definirMinhaFoto(id: string, file: File): Promise<void> {
  const url = await reduzir(file);
  await tx('readwrite', s => s.put(url, id), STORE_FOTOS);
  minhas.set(id, url);
}
export async function removerMinhaFoto(id: string): Promise<void> {
  await tx('readwrite', s => s.delete(id), STORE_FOTOS);
  minhas.delete(id);
}
