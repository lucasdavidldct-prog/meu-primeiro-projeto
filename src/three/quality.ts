// Qualidade gráfica dos lances 3D: Alta (sombras, bloom, torcida densa), Média e Leve.
// Um só lugar cria o renderizador e decide o que ligar; estádio, jogadores e bola leem o nível daqui.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export { QUALITY_N, defaultQuality, quality, setQuality, type Quality } from './qualityLevel';
import { quality } from './qualityLevel';

export interface View {
  renderer: THREE.WebGLRenderer;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  dispose: () => void;
}

/** Cria o renderizador conforme a qualidade: tone mapping de cinema, sombras suaves e brilho nos refletores (Alta). */
export function createView(W: number, H: number): View {
  const q = quality();
  const renderer = new THREE.WebGLRenderer({ antialias: q !== 'leve', powerPreference: 'high-performance' });
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, q === 'alta' ? 2.25 : q === 'media' ? 1.6 : 1.2));
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = q === 'leve' ? 1.05 : 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (q !== 'leve') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = q === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  }
  let composer: EffectComposer | null = null;
  const render = (scene: THREE.Scene, camera: THREE.Camera) => {
    if (q !== 'alta') { renderer.render(scene, camera); return; }
    if (!composer) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Brilho só nas partes muito claras (refletores, placas de LED, linhas sob a luz)
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .55, .5, .88));
      composer.addPass(new OutputPass());
    }
    composer.render();
  };
  return { renderer, render, dispose: () => { composer?.dispose(); renderer.dispose(); } };
}
