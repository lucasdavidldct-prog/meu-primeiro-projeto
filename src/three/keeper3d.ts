// Lance de goleiro em 3D: câmera atrás do gol, o batedor corre e chuta; você desliza para o lado do pulo.
// Deslize para a esquerda/direita (e para cima = bola alta); um toque = fica no meio.
import * as THREE from 'three';
import { pickShotZone, saveChance, tellOf, type Zone } from '../engine/keeper';
import { awayKit } from '../engine/kits';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { R, clamp } from '../engine/rng';
import { esc } from '../ui/dom';
import { haptic, sfx } from '../ui/sfx';
import { makeBall, makePlayer } from './players';
import { createView } from './quality';
import { addLights, buildGoal, buildPitch, buildStadium, tickStadium } from './stadium';

const V = (x: number, y: number, h = 0) => new THREE.Vector3(x - 34, h, y);
/** Centro de cada zona na linha do gol: coluna 0 = esquerda da tela (lado +x do mundo, visto de trás do gol). */
const zoneX = (c: 0 | 1 | 2) => 34 + (c === 0 ? 2.6 : c === 2 ? -2.6 : 0);
const zoneH = (r: 0 | 1) => (r ? 1.85 : .45);

export function runKeeper3D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const pen = !!req.pen, shooterE = req.taker!, shooter = shooterE.P;
    const gkE = M.A.xi.find(e => e.pos === 'GOL' && !e.red), gk = gkE?.P;
    const shot = pickShotZone(shooter, pen, R), tell = tellOf(shot, shooter, R);
    const ov = document.createElement('div');
    ov.className = 'moment m3d m3d-full';
    ov.innerHTML = `<div class="m3d-wrap" id="kWrap">
      <div class="m3d-top"><span class="mo-tag">${M.label}</span><b>${pen ? 'Pênalti contra!' : 'Defenda!'}</b><span class="acts">${esc(shooterE.name)} vai chutar</span></div>
      <div class="m3d-help show">Você é o goleiro${gkE ? ` (${esc(gkE.name)})` : ''}. <b>Deslize</b> para o lado do pulo (para <b>cima</b> = bola alta) antes da bola chegar. Um <b>toque</b> = fica no meio. Olhe a corrida do batedor.</div>
    </div><div class="mo-msg" id="kMsg"></div>`;
    document.body.appendChild(ov);
    const wrap = ov.querySelector<HTMLElement>('#kWrap')!, msg = ov.querySelector<HTMLElement>('#kMsg')!;
    const W = ov.clientWidth, H = ov.clientHeight;
    const view = createView(W, H), renderer = view.renderer;
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    addLights(scene);
    const goal = buildGoal();
    // Câmera atrás do gol: a rede fica bem na frente, então ela fica mais transparente aqui
    goal.traverse(o => { const l = o as THREE.LineSegments; if (l.isLineSegments) (l.material as THREE.LineBasicMaterial).opacity = .16; });
    scene.add(buildPitch(), goal, buildStadium());
    const portrait = W / H < 1;
    const camera = new THREE.PerspectiveCamera(portrait ? 62 : 50, W / H, .1, 400);
    camera.position.copy(V(34, -6.5, 2.6)); camera.lookAt(V(34, 12, .8));

    const kit = awayKit([M.A.c1, M.A.c2], [M.B.c1, M.B.c2]);
    const gkMesh = makePlayer('#c6f432', '#111111', (gk as { num?: number } | undefined)?.num ?? 1, { gk: true, facing: 1, seed: 3 });
    gkMesh.root.position.copy(V(34, .6)); gkMesh.root.scale.setScalar(1.15);
    // Goleiro de costas para a câmera, olhando o batedor
    gkMesh.body.rotation.y = Math.PI;
    const sh = makePlayer(kit[0], kit[1], 9, { facing: -1, seed: 7 });
    const sx = pen ? 34 : clamp(34 + (R() - .5) * 18, 20, 48), sy = pen ? 11 : 13 + R() * 7;
    // A pista: a corrida vem de um lado e o corpo gira para o canto "anunciado" (nem sempre verdadeiro)
    const tellDir = tell === 0 ? 1 : tell === 2 ? -1 : 0;
    const start = { x: sx - tellDir * 2.4, y: sy + 4 };
    sh.root.position.copy(V(start.x, start.y));
    const { ball, shadow } = makeBall();
    ball.position.copy(V(sx, sy - .6, .16)); shadow.position.set(sx - 34, .016, sy - .6);
    scene.add(gkMesh.root, sh.root, ball, shadow);

    let dive: Zone | null = null, locked = false, t0 = performance.now(), done = false;
    const RUN = 1300, FLY = pen ? 620 : 760;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    let p0: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', e => { p0 = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', e => {
      if (!p0 || locked) return;
      const dx = e.clientX - p0.x, dy = e.clientY - p0.y; p0 = null;
      const col: 0 | 1 | 2 = dx < -30 ? 0 : dx > 30 ? 2 : 1, row: 0 | 1 = dy < -30 ? 1 : 0;
      dive = { col, row }; locked = true; haptic('leve');
      ov.querySelector('.m3d-help')?.classList.remove('show');
    });

    const target = { x: zoneX(shot.col) + (R() - .5) * 1.1, h: zoneH(shot.row) + (R() - .5) * .3 };
    let saved: boolean | null = null;
    function finish(res: MomentResult, text: string, color: string) {
      done = true;
      msg.textContent = text; msg.style.color = color; msg.classList.add('show');
      setTimeout(() => { view.dispose(); ov.remove(); resolve(res); }, 1500);
    }
    function frame() {
      if (!ov.isConnected) return;
      requestAnimationFrame(frame);
      const t = performance.now() - t0;
      // Corrida do batedor até a bola
      const k = Math.min(1, t / RUN);
      sh.root.position.copy(V(start.x + (sx - start.x) * k, start.y + (sy - start.y) * k));
      sh.body.rotation.y = -tellDir * .45 * k; // corpo virando para o canto anunciado
      const sw = Math.sin(t / 70) * (k < 1 ? .6 : 0); sh.legL.rotation.x = sw; sh.legR.rotation.x = -sw;
      // Voo da bola
      if (t > RUN) {
        const f = Math.min(1, (t - RUN) / FLY);
        const bx = sx + (target.x - sx) * f, by = (sy - .6) * (1 - f), bh = .16 + target.h * f + (pen ? .1 : .6) * 4 * f * (1 - f);
        ball.position.copy(V(bx, by, bh)); shadow.position.set(bx - 34, .016, by);
        ball.rotation.x -= .4;
        if (!locked && f > .82) { locked = true; } // tarde demais: fica onde está
        if (f >= 1 && saved === null) {
          saved = R() < saveChance(shot, dive, gk, shooter, pen);
          if (saved) { sfx.ooh(); haptic('forte'); finish({ goal: false, shot: true, onTarget: true, text: 'defesa' }, 'DEFENDEU!', '#9ec9ec'); }
          else { sfx.groan(); finish({ goal: true, shot: true, onTarget: true }, 'GOL…', '#f06a5a'); }
        }
        if (saved !== null && f >= 1) {
          // depois do desfecho: bola rebatida para fora ou dentro da rede
          const tt = Math.min(1, (t - RUN - FLY) / 500);
          if (saved) ball.position.copy(V(target.x + (target.x > 34 ? 3 : -3) * tt, 1.5 * tt, target.h * (1 - tt * .6)));
          else ball.position.copy(V(target.x, -1.6 * tt, target.h * (1 - tt * .3)));
        }
      }
      // Mergulho do goleiro (começa quando o batedor chuta; ou na hora, se você escolheu tarde)
      if (dive && t > RUN * .9) {
        const g = Math.min(1, (t - RUN * .9) / 320), dirX = dive.col === 0 ? 1 : dive.col === 2 ? -1 : 0;
        gkMesh.root.position.copy(V(34 + dirX * 1.6 * g, .6, dive.row && dirX === 0 ? .8 * Math.sin(g * Math.PI) : 0));
        gkMesh.body.rotation.z = -dirX * g * (dive.row ? .9 : 1.35);
        gkMesh.body.position.y = dive.row ? g * .5 : Math.sin(g * Math.PI) * .2;
      }
      tickStadium(performance.now(), saved === false);
      view.render(scene, camera);
      if (done && t > RUN + FLY + 1600) return;
    }
    frame();
  });
}
