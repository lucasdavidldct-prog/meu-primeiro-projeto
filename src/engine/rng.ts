// Gerador aleatório compartilhado pelo motor. Os testes trocam por um gerador com semente.

export type Rng = () => number;

export function mulberry32(a: number): Rng {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let current: Rng = Math.random;
/** Gerador padrão do motor. */
export const R: Rng = () => current();
export function setRng(r: Rng): void { current = r; }
export function seedRng(seed: number): void { current = mulberry32(seed); }
export function resetRng(): void { current = Math.random; }

export const pick = <T>(a: readonly T[], r: Rng = R): T => a[Math.floor(r() * a.length)];
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const rn = (a: number, b: number, r: Rng = R): number => a + r() * (b - a);
export const ri = (a: number, b: number, r: Rng = R): number => Math.floor(a + r() * (b - a + 1));

export function wpick<T>(list: readonly (readonly [T, number])[], r: Rng = R): T {
  let s = 0;
  for (const x of list) s += x[1];
  let t = r() * s;
  for (const x of list) { t -= x[1]; if (t <= 0) return x[0]; }
  return list[list.length - 1][0];
}

export function shuffle<T>(a: readonly T[], r: Rng = R): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function poisson(l: number, r: Rng = R): number {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
