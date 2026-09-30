// Nível da qualidade gráfica (sem importar o Three.js: a interface usa isto sem carregar o 3D).
export type Quality = 'alta' | 'media' | 'leve';
export const QUALITY_N: Record<Quality, string> = { alta: 'Alta', media: 'Média', leve: 'Leve' };

/** Aparelho forte (tela densa e muitos núcleos, como os topo de linha): começa na Alta. */
export function defaultQuality(): Quality {
  const cores = navigator.hardwareConcurrency || 4, dpr = window.devicePixelRatio || 1;
  return cores >= 8 && dpr >= 2 ? 'alta' : cores >= 6 ? 'media' : 'leve';
}

let current: Quality = 'media';
export const setQuality = (q: Quality): void => { current = q; };
export const quality = (): Quality => current;
