// Detecção de WebGL sem carregar o Three.js (o módulo 3D é carregado só quando um lance abre).
let webgl: boolean | null = null;
export function webglAvailable(): boolean {
  if (webgl !== null) return webgl;
  try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { webgl = false; }
  return webgl;
}
