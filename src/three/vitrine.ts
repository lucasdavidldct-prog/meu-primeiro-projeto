// Vitrine de desenvolvimento: jogadores, uniformes, bola e rede de perto (só no modo dev, para conferir o visual).
import * as THREE from 'three';
import { kitsDoClube, goleiroKit } from '../engine/kits';
import type { BasePlayer } from '../engine/types';
import { W } from '../engine/world';
import { makeBall, makePlayer } from './players';
import { createView } from './quality';
import { addLights, buildGoal, buildPitch, buildStadium, tickNet, tickStadium } from './stadium';

export function vitrine(): () => void {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000';
  document.body.appendChild(el);
  const Wd = el.clientWidth, H = el.clientHeight, view = createView(Wd, H);
  el.appendChild(view.renderer.domElement);
  const scene = new THREE.Scene();
  addLights(scene);
  scene.add(buildPitch(), buildGoal(), buildStadium());
  const cam = kitsDoClube('CAM', '#000', '#fff'), fla = kitsDoClube('FLA', '#c8102e', '#000');
  const find = (s: string) => [...W.legends, ...W.pool].find(p => p.short === s) as BasePlayer | undefined;
  const gente: [string, number, THREE.ColorRepresentation?][] = [['Ronaldinho', 0], ['Hulk', 0], ['Reinaldo', 1], ['Haaland', 2], ['Zidane', 2], ['Valderrama', 1]];
  gente.forEach(([nome, k], i) => {
    const P = find(nome);
    const pm = makePlayer(cam[k as number], 10 + i, { P, seed: i, facing: 1 });
    pm.root.position.set(-4 + i * 1.6, 0, 6.5);
    pm.body.rotation.y = i % 2 ? Math.PI * .85 : Math.PI * 1.15;
    scene.add(pm.root);
  });
  const back = makePlayer(fla[0], 9, { seed: 99, P: find('Pedro') });
  back.root.position.set(3.6, 0, 3.4); back.body.rotation.y = .2; scene.add(back.root);
  const gk = makePlayer(goleiroKit(cam[0], fla[0]), 1, { gk: true, seed: 5, facing: 1, P: find('Everson') });
  gk.root.position.set(-1.5, 0, .8); gk.body.rotation.z = .9; gk.body.position.y = .5; scene.add(gk.root);
  const { ball } = makeBall(); ball.position.set(1.8, 1.3, -1.7); scene.add(ball);
  const camera = new THREE.PerspectiveCamera(46, Wd / H, .1, 500);
  camera.position.set(1.5, 2.6, 12.5); camera.lookAt(0, 1.2, 2);
  const t0 = performance.now();
  let raf = 0;
  const loop = () => { raf = requestAnimationFrame(loop); tickStadium(performance.now()); tickNet(ball.position, t0 + Math.min(350, performance.now() - t0)); view.render(scene, camera); };
  loop();
  return () => { cancelAnimationFrame(raf); view.dispose(); el.remove(); };
}
