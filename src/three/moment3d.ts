// Lance jogável em 3D (Three.js): câmera atrás do ataque olhando para o gol.
// Toque num companheiro = passe · toque no campo = conduzir · arraste em direção ao gol = chute
// (a direção mira, o comprimento dá a força e a curva do traço dá o efeito). Replay em câmera lenta no gol.
import * as THREE from 'three';
import { analyzeGesture, type Pt } from '../engine/lance';
import { LanceScene, TITLES, type Actor, type BallKey, type Plan, type Target } from '../engine/lanceScene';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { clamp } from '../engine/rng';
import { esc } from '../ui/dom';
import { probColor } from '../ui/moment2d';
import { carrierRing, makeBall, makePlayer, type PlayerMesh } from './players';
import { addLights, buildGoal, buildPitch, buildStadium } from './stadium';
import { endSound, planSound } from '../ui/sfx';

const HELP3D = {
  ataque: 'Toque num <b>companheiro</b> para passar · no <b>campo</b> para conduzir · <b>arraste em direção ao gol</b> para chutar: a direção mira, o comprimento dá a força e a curva do traço dá o efeito.',
  penalti: '<b>Arraste em direção ao gol</b>: a direção escolhe o canto e o comprimento dá a força. Forte demais vai por cima.',
  falta: '<b>Arraste em direção ao gol</b>: a direção mira, o comprimento dá a força e a <b>curva do traço</b> dá o efeito. Passe por cima ou em volta da barreira.',
};


const V = (x: number, y: number, h = 0) => new THREE.Vector3(x - 34, h, y);

interface Snap { ball: THREE.Vector3; actors: [number, number, number, number, number][] }

export function runMoment3D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const sc = new LanceScene(M, req), A = M.A, B = M.B, kind = req.kind, fk = kind === 'falta', pen = kind === 'penalti';
    // ---------- DOM ----------
    const ov = document.createElement('div');
    ov.className = 'moment m3d';
    ov.innerHTML = `<div class="mo-head"><span class="mo-tag">${M.label}</span><b>${TITLES[kind]}</b><span class="acts" id="moActs"></span></div>
      <div class="m3d-wrap" id="m3dWrap"><div class="m3d-label" id="m3dLabel"></div><div class="m3d-power" id="m3dPower"><i></i></div><div class="m3d-replay" id="m3dReplay">REPLAY</div></div>
      <div class="mo-help">${HELP3D[kind === 'contra' ? 'ataque' : kind]}</div>
      <div class="mo-msg" id="moMsg"></div>`;
    document.body.appendChild(ov);
    const wrap = ov.querySelector<HTMLElement>('#m3dWrap')!, labelEl = ov.querySelector<HTMLElement>('#m3dLabel')!, powerEl = ov.querySelector<HTMLElement>('#m3dPower')!;
    const replayEl = ov.querySelector<HTMLElement>('#m3dReplay')!, msgEl = ov.querySelector<HTMLElement>('#moMsg')!, actsEl = ov.querySelector<HTMLElement>('#moActs')!;
    const W = Math.min(ov.clientWidth - 24, 960), H = Math.round(Math.min(window.innerHeight * .64, W * .8, 640));
    wrap.style.width = W + 'px'; wrap.style.height = H + 'px';

    // ---------- Three.js ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Celular: resolução um pouco menor deixa o lance fluido sem perder nitidez perceptível
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    renderer.setSize(W, H);
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.Fog(0x070b12, 70, 150);
    addLights(scene);
    scene.add(buildPitch(), buildGoal(), buildStadium());
    const camera = new THREE.PerspectiveCamera(pen ? 42 : 50, W / H, .1, 400);

    const meshes = new Map<number, PlayerMesh>();
    const gkCol = ['#c6f432', '#111111'];
    const addActor = (a: Actor) => {
      const colors = a.team === 0 ? [A.c1, A.c2] : a.gk ? gkCol : [B.c1, B.c2];
      const pm = makePlayer(colors[0], colors[1], a.num || 9, { gk: a.gk, facing: a.team === 0 ? -1 : 1, seed: a.id });
      pm.root.position.copy(V(a.x, a.y));
      scene.add(pm.root);
      meshes.set(a.id, pm);
    };
    [...sc.mates, ...sc.foes].forEach(addActor);
    // Nomes dos companheiros (ajuda a escolher o passe)
    const names = new Map<number, HTMLElement>();
    for (const m of sc.mates) {
      const el = document.createElement('div');
      el.className = 'm3d-name'; el.innerHTML = `<b>${m.e!.P.ovr}</b> ${esc(m.e!.name)}`;
      wrap.appendChild(el); names.set(m.id, el);
    }
    const ring = carrierRing(); scene.add(ring);
    const { ball: ballM, shadow: ballSh } = makeBall(); scene.add(ballM, ballSh);
    let preview: THREE.Mesh | null = null;
    const pvMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthTest: false });

    // ---------- Estado ----------
    let ball: BallKey = sc.ballAt, anim: { plan: Plan; t0: number } | null = null, finished = false;
    const gkState = { dive: 0 as -1 | 0 | 1, t0: 0, h: 0 };
    const frames: Snap[] = [];
    let replay: { frames: Snap[]; i: number; res: MomentResult } | null = null;
    let raf = 0;

    function flash(text: string, color: string) { msgEl.textContent = text; msgEl.style.color = color; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); }
    function cleanup(res: MomentResult) {
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
      ov.remove();
      resolve(res);
    }
    function run(plan: Plan) {
      clearPreview();
      planSound(plan); anim = { plan, t0: performance.now() };
      if (plan.gk) { const g = sc.goalie(); g.tx = plan.gk.x; g.ty = plan.gk.y; gkState.dive = plan.gk.dive; gkState.t0 = performance.now() + plan.dur * .45; gkState.h = plan.gk.h; }
    }
    function endAnim(plan: Plan) {
      anim = null;
      plan.commit();
      if (plan.end && !finished) {
        finished = true;
        flash(plan.end.text, plan.end.color); endSound(plan.end);
        if (plan.end.goal) {
          const res = plan.end.res;
          setTimeout(() => { msgEl.textContent = ''; replay = { frames: frames.slice(-Math.min(frames.length, 150)), i: 0, res }; replayEl.classList.add('on'); }, 1300);
        } else setTimeout(() => cleanup(plan.end!.res), 1400);
      }
    }
    const busy = () => !!anim || finished;

    // ---------- Entrada ----------
    const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    const toField = (e: PointerEvent): Pt | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(ground, hit) ? { x: hit.x + 34, y: hit.z } : null;
    };
    const pickMate = (): Actor | null => {
      const objs = sc.mates.filter(m => m !== sc.carrier).map(m => meshes.get(m.id)!.root);
      const h = ray.intersectObjects(objs, true)[0];
      if (!h) return null;
      return sc.mates.find(m => { let o: THREE.Object3D | null = h.object; while (o) { if (o === meshes.get(m.id)!.root) return true; o = o.parent; } return false; }) ?? null;
    };
    let press: { pts: Pt[]; sx: number; sy: number; drag: boolean } | null = null;
    let lastSx = 0, lastSy = 0;
    function dragTarget(p: NonNullable<typeof press>): { t?: Target; fkShot?: ReturnType<LanceScene['fkFromGesture']>; power: number } | null {
      const g = analyzeGesture(p.pts, 1);
      if (!g) return null;
      const power = clamp(Math.hypot(lastSx - p.sx, lastSy - p.sy) / (H * .55), 0, 1);
      if (fk) return { fkShot: sc.fkFromGesture({ ...g, power }), power };
      const s = sc.shotFromGesture({ ...g, power });
      if (s) return { t: s, power };
      if (pen) return null;
      const e = p.pts[p.pts.length - 1];
      return { t: sc.target(e.x, e.y) ?? undefined, power };
    }
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      if (busy()) return;
      el.setPointerCapture(e.pointerId);
      const p = toField(e);
      lastSx = e.clientX; lastSy = e.clientY;
      press = { pts: p ? [p] : [], sx: e.clientX, sy: e.clientY, drag: false };
    });
    el.addEventListener('pointermove', e => {
      if (busy()) return;
      const p = toField(e);
      lastSx = e.clientX; lastSy = e.clientY;
      if (press) {
        if (p) press.pts.push(p);
        if (!press.drag && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 14) press.drag = true;
        if (press.drag) {
          const d = dragTarget(press);
          if (d?.fkShot) showFk(d.fkShot.shot, d.fkShot.goal, d.power);
          else if (d?.t) showTarget(d.t, d.t.kind === 'shot' ? d.power : undefined);
          else clearPreview();
        }
      } else if (e.pointerType === 'mouse' && p && !fk && !pen) {
        const mate = pickMate();
        const t = mate ? { kind: 'pass' as const, m: mate } : sc.target(p.x, p.y);
        if (t) showTarget(t); else clearPreview();
      }
    });
    el.addEventListener('pointerup', e => {
      if (busy() || !press) { press = null; return; }
      const p = toField(e);
      lastSx = e.clientX; lastSy = e.clientY;
      if (p) press.pts.push(p);
      const pr = press; press = null;
      if (pr.drag) {
        const d = dragTarget(pr);
        if (d?.fkShot) run(sc.performFk(d.fkShot.shot));
        else if (d?.t) run(sc.perform(d.t));
        else clearPreview();
        return;
      }
      if (fk || pen) return;
      const mate = pickMate();
      const t = mate ? { kind: 'pass' as const, m: mate } : p ? sc.target(p.x, p.y) : null;
      if (t) run(sc.perform(t));
    });
    el.addEventListener('pointerleave', () => { if (!press) clearPreview(); });

    // ---------- Linha prevista ----------
    function clearPreview() {
      if (preview) { scene.remove(preview); preview.geometry.dispose(); preview = null; }
      labelEl.style.display = 'none'; powerEl.style.display = 'none';
    }
    function drawPath(pts: THREE.Vector3[], prob: number, text: string, power?: number) {
      clearPreview();
      const curve = new THREE.CatmullRomCurve3(pts);
      preview = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .07, 6, false), pvMat);
      pvMat.color.set(probColor(prob));
      preview.renderOrder = 10;
      scene.add(preview);
      const end = pts[pts.length - 1].clone().project(camera);
      labelEl.style.display = 'block';
      labelEl.style.left = `${clamp((end.x + 1) / 2 * W, 60, W - 60)}px`;
      labelEl.style.top = `${clamp((1 - end.y) / 2 * H - 34, 8, H - 40)}px`;
      labelEl.style.color = probColor(prob);
      labelEl.textContent = text;
      if (power != null) {
        powerEl.style.display = 'block';
        const bar = powerEl.firstElementChild as HTMLElement;
        bar.style.width = `${power * 100}%`;
        bar.style.background = power > .88 ? '#f06a5a' : power >= .45 ? '#56d086' : '#f2b640';
      }
    }
    function showTarget(t: Target, power?: number) {
      const c = sc.carrier, p = sc.prob(t), from = V(c.x, c.y - .5, .15);
      if (t.kind === 'pass') drawPath([from, V((c.x + t.m.x) / 2, (c.y + t.m.y) / 2, .6), V(t.m.x, t.m.y, .15)], p, `Passe ${Math.round(p * 100)}%`);
      else if (t.kind === 'drib') drawPath([from, V((c.x + t.x) / 2, (c.y + t.y) / 2, .1), V(t.x, t.y, .1)], p, `Conduzir ${Math.round(p * 100)}%`);
      else {
        const path = pen ? [{ x: c.x, y: c.y }, { x: t.ax, y: 0 }] : sc.shotPath(t.ax, t.curve, 20);
        const hEnd = .25 + t.power * 1.9;
        const pts = path.map((q, i) => { const k = i / (path.length - 1); return V(q.x, q.y, .15 + hEnd * k + 1.2 * t.power * k * (1 - k)); });
        if (pts.length === 2) pts.splice(1, 0, pts[0].clone().lerp(pts[1], .5).setY(.15 + hEnd * .6));
        drawPath(pts, p, `Chute · gol ${Math.round(p * 100)}%`, power);
      }
    }
    function showFk(shot: { targetX: number; power: number; curve: number }, goal: number, power: number) {
      const path = sc.fkPath(shot, 24), hEnd = clamp(.6 + shot.power * 1.5, .5, 2.2), peak = 1.2 + shot.power * .8;
      drawPath(path.map((q, i) => { const k = i / (path.length - 1); return V(q.x, q.y, .15 + hEnd * k + 4 * peak * k * (1 - k)); }), goal * 1.6, `Falta · gol ${Math.round(goal * 100)}%`, power);
    }

    // ---------- Câmera ----------
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    function camTarget(): [THREE.Vector3, THREE.Vector3] {
      const c = sc.carrier;
      if (pen) return [V(34, 12 + 8.5, 2.6), V(34, 0, 1.1)];
      if (fk && sc.setup) {
        const b = sc.setup.ball, dx = b.x - 34, dy = b.y, L = Math.hypot(dx, dy);
        return [V(b.x + dx / L * 8, b.y + dy / L * 8, 4.4), V(34 + dx * .15, 0, .8)];
      }
      return [V(c.x + (c.x - 34) * .25, c.y + 12, 7.5), V(34 + (c.x - 34) * .45, Math.max(0, c.y - 14), 0)];
    }
    { const [p, l] = camTarget(); camPos.copy(p); camLook.copy(l); }

    // ---------- Laço de animação ----------
    let lastT = performance.now();
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000);
      lastT = now;
      if (replay) { playReplay(); return; }
      for (const a of [...sc.mates, ...sc.foes]) {
        const pm = meshes.get(a.id)!, px = a.x, py = a.y;
        a.x += (a.tx - a.x) * .12; a.y += (a.ty - a.y) * .12;
        const sp = Math.hypot(a.x - px, a.y - py) / Math.max(dt, .001);
        pm.root.position.set(a.x - 34, 0, a.y);
        const sw = Math.sin(now / 70 + a.id) * Math.min(.7, sp * .12);
        pm.legL.rotation.x = sw; pm.legR.rotation.x = -sw;
        // Todos olham para a bola (atacantes sempre de frente para o gol)
        const dx = ball.x - a.x, dz = ball.y - a.y;
        const want = a.team === 0 ? Math.atan2(-(34 - a.x), a.y) : Math.atan2(-dx, -dz);
        pm.body.rotation.y += (want - pm.body.rotation.y) * .15;
      }
      // Goleiro: mergulho simples
      const gk = meshes.get(sc.goalie().id)!;
      if (gkState.dive && now > gkState.t0) {
        const k = Math.min(1, (now - gkState.t0) / 260);
        gk.body.rotation.z = -gkState.dive * k * 1.25;
        gk.body.position.y = Math.sin(k * Math.PI) * .25 + (gkState.h > 1.2 ? k * .35 : 0);
        gk.body.position.x = gkState.dive * k * .6;
      }
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / anim.plan.dur), keys = anim.plan.ball, f = k * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(f)), u = f - i;
        ball = { x: keys[i].x + (keys[i + 1].x - keys[i].x) * u, y: keys[i].y + (keys[i + 1].y - keys[i].y) * u, h: keys[i].h + (keys[i + 1].h - keys[i].h) * u };
        if (k >= 1) endAnim(anim.plan);
      } else if (!finished) ball = sc.ballAt;
      ballM.position.copy(V(ball.x, ball.y, .16 + ball.h));
      ballM.rotation.x -= anim ? .35 : .02;
      ballSh.position.set(ball.x - 34, .016, ball.y);
      ballSh.scale.setScalar(1 / (1 + ball.h * .5));
      ring.position.set(sc.carrier.x - 34, .02, sc.carrier.y);
      ring.visible = !finished;
      const [tp, tl] = camTarget();
      camPos.lerp(tp, .05); camLook.lerp(tl, .06);
      camera.position.copy(camPos); camera.lookAt(camLook);
      for (const [id, elN] of names) {
        const a = sc.mates.find(m => m.id === id)!, s = V(a.x, a.y, 2.25).project(camera);
        elN.style.display = s.z < 1 && !finished ? 'block' : 'none';
        elN.style.left = `${(s.x + 1) / 2 * W}px`; elN.style.top = `${(1 - s.y) / 2 * H}px`;
        elN.classList.toggle('on', a === sc.carrier);
      }
      actsEl.textContent = pen ? 'Cobrança' : fk ? `Cobrador: ${sc.carrier.e!.name}` : `${sc.actions} ações`;
      // Grava para o replay
      frames.push({ ball: ballM.position.clone(), actors: [...sc.mates, ...sc.foes].map(a => { const pm = meshes.get(a.id)!; return [a.id, pm.root.position.x, pm.root.position.z, pm.body.rotation.y, pm.body.rotation.z]; }) });
      if (frames.length > 240) frames.shift();
      renderer.render(scene, camera);
    }
    // Replay: câmera lateral, perto do gol, em câmera lenta
    function playReplay() {
      const R = replay!, f = R.frames[Math.min(R.frames.length - 1, Math.floor(R.i))];
      R.i += .35;
      ballM.position.copy(f.ball);
      ballSh.position.set(f.ball.x, .016, f.ball.z);
      for (const [id, x, z, ry, rz] of f.actors) { const pm = meshes.get(id)!; pm.root.position.set(x, 0, z); pm.body.rotation.y = ry; pm.body.rotation.z = rz; }
      for (const n of names.values()) n.style.display = 'none';
      ring.visible = false;
      const side = f.ball.x >= 0 ? 1 : -1;
      camera.position.set(side * 11, 2.4, 6.5);
      camera.lookAt(f.ball.x * .5, .9, Math.max(-1, f.ball.z * .6));
      renderer.render(scene, camera);
      if (R.i >= R.frames.length + 25) { replay = null; replayEl.classList.remove('on'); cleanup(R.res); }
    }
    frame();
  });
}
