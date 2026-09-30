// Lance jogável em 3D (Three.js), em tela cheia, com a câmera atrás do ataque.
// Controles (estilo Score): 1 toque num companheiro = passe rasteiro · 2 toques = passe alto ·
// toque no campo = conduzir · desenhe um traço em direção ao gol = chute (a direção mira, a curva do traço dá o efeito
// e a velocidade do gesto dá a força) · traço para o espaço = lançamento para quem estiver mais perto.
import * as THREE from 'three';
import { bindShotBar, shotBarHTML } from '../ui/shotPicker';
import { createView } from './quality';
import { analyzeGesture, type Pt } from '../engine/lance';
import { LanceScene, TITLES, type Actor, type BallKey, type Plan, type Target } from '../engine/lanceScene';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { clamp } from '../engine/rng';
import { goleiroKit, kitDe } from '../engine/kits';
import { esc } from '../ui/dom';
import { probColor } from '../ui/moment2d';
import { carrierRing, makeBall, makePlayer, type PlayerMesh } from './players';
import { addLights, buildGoal, buildPitch, buildStadium, resetNet, tickNet, tickStadium } from './stadium';
import { endSound, planSound } from '../ui/sfx';

const HELP3D = {
  escanteio: '<b>Escanteio:</b> toque num companheiro na área para cruzar (bola alta). Depois, <b>desenhe o traço</b> para cabecear ou pegar de primeira. Na cobrança não tem impedimento.',
  lateral: '<b>Lateral:</b> toque num companheiro perto para cobrar com a mão. Depois o lance segue normal. Cuidado com o <b>impedimento</b> (linha amarela).',
  ataque: '<b>1 toque</b> no companheiro: passe rasteiro · <b>2 toques</b>: passe alto · toque no <b>campo</b>: conduzir · toque no <b>seu jogador</b>: finta (drible) · <b>desenhe um traço</b> até o gol para chutar · escolha o <b>tipo de chute</b> embaixo (Colocado, Forte, Rasteiro, Cavadinha) ou deixe no Auto · traço para o <b>espaço</b>: lançamento',
  penalti: '<b>Desenhe um traço</b> da bola até o canto: a direção escolhe o canto, a velocidade dá a força. Rápido demais vai por cima.',
  falta: '<b>Desenhe o traço</b> da bola até o gol: a direção mira, a <b>curva do traço</b> dá o efeito e a <b>velocidade</b> dá a força. Por cima ou em volta da barreira.',
};

const V = (x: number, y: number, h = 0) => new THREE.Vector3(x - 34, h, y);
const DOUBLE_TAP_MS = 280;

interface Snap { ball: THREE.Vector3; actors: [number, number, number, number, number][] }

export function runMoment3D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const sc = new LanceScene(M, req), A = M.A, B = M.B, kind = req.kind, fk = kind === 'falta', pen = kind === 'penalti';
    // ---------- DOM (tela cheia) ----------
    const ov = document.createElement('div');
    ov.className = 'moment m3d m3d-full';
    ov.innerHTML = `<div class="m3d-wrap" id="m3dWrap">
        <canvas class="m3d-trail" id="m3dTrail"></canvas>
        <div class="m3d-top"><span class="mo-tag">${M.label}</span><b>${req.treino ? 'Treino de lances' : sc.title}</b><span class="acts" id="moActs"></span><button class="m3d-q" id="m3dQ" aria-label="Ajuda">?</button></div>
        <div class="m3d-label" id="m3dLabel"></div>
        <div class="m3d-help show" id="m3dHelp">${HELP3D[kind === 'contra' || kind === 'goleiro' ? 'ataque' : kind as keyof typeof HELP3D]}</div>
        <div class="m3d-replay" id="m3dReplay">REPLAY</div>
        ${!fk && !pen ? shotBarHTML() : ''}
      </div>
      <div class="mo-msg" id="moMsg"></div>`;
    document.body.appendChild(ov);
    const $ = <T extends HTMLElement>(id: string) => ov.querySelector<T>('#' + id)!;
    const wrap = $('m3dWrap'), labelEl = $('m3dLabel'), replayEl = $('m3dReplay'), msgEl = $('moMsg'), actsEl = $('moActs'), helpEl = $('m3dHelp');
    const trail = $<HTMLCanvasElement>('m3dTrail'), tctx = trail.getContext('2d')!;
    const W = ov.clientWidth, H = ov.clientHeight, portrait = W / H < 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    trail.width = W * dpr; trail.height = H * dpr; tctx.scale(dpr, dpr);
    // Treino guiado: passo a passo, a dica fica na tela até você fazer a ação pedida
    const COACH = [
      '<b>Treino 1/3</b> · Toque <b>1 vez</b> num companheiro: <b>passe rasteiro</b>. O número verde ao lado do nome é a chance de dar certo.',
      '<b>Treino 2/3</b> · Agora toque <b>2 vezes rápido</b> num companheiro: <b>passe alto</b>, por cima da marcação.',
      '<b>Treino 3/3</b> · Toque no <b>campo</b> para conduzir até perto da área. Depois <b>desenhe um traço rápido</b> da bola até o canto do gol. Curve o traço para dar efeito.',
    ];
    let coach = req.treino ? 0 : -1;
    const showCoach = () => { if (coach >= 0) { helpEl.innerHTML = COACH[coach]; helpEl.classList.add('show'); } };
    const coachAct = (t: Target) => {
      if (coach === 0 && t.kind === 'pass' && !t.alto) coach = 1;
      else if (coach === 1 && t.kind === 'pass' && t.alto) coach = 2;
      setTimeout(showCoach, 900);
    };
    let helpTimer = setTimeout(() => { if (coach < 0) helpEl.classList.remove('show'); }, 4500);
    showCoach();
    $('m3dQ').addEventListener('click', () => { clearTimeout(helpTimer); helpEl.classList.toggle('show'); });
    // Seletor do tipo de chute: mostra a dica do tipo por alguns segundos
    bindShotBar(ov, sc, d => { clearTimeout(helpTimer); helpEl.innerHTML = d; helpEl.classList.add('show'); helpTimer = setTimeout(() => helpEl.classList.remove('show'), 3500); });

    // ---------- Three.js ----------
    // Renderizador conforme a qualidade gráfica (Alta: sombras e brilho; Leve: o mais rápido)
    const view = createView(W, H), renderer = view.renderer;
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.Fog(0x0b1424, 110, 260);
    addLights(scene);
    scene.add(buildPitch(), buildGoal(), buildStadium());
    // Tela em pé: lente mais fechada na falta e no pênalti (enquadra gol e barreira sem mostrar céu)
    const camera = new THREE.PerspectiveCamera(portrait ? (pen ? 50 : fk ? 52 : 64) : 48, W / H, .1, 500);
    // Na tela em pé os jogadores ficam um pouco maiores para serem fáceis de tocar
    const SCALE = portrait ? 1.3 : 1.1;

    const meshes = new Map<number, PlayerMesh>();
    // Uniformes da partida (o rival troca se confundir) e goleiros com cor própria
    const aKit = kitDe(A), bKit = kitDe(B), gkA = goleiroKit(aKit, bKit, 0), gkB = goleiroKit(aKit, bKit, 1);
    const addActor = (a: Actor) => {
      const kit = a.team === 0 ? (a.gk ? gkA : aKit) : a.gk ? gkB : bKit;
      const pm = makePlayer(kit, a.num || 9, { gk: a.gk, facing: a.team === 0 ? -1 : 1, seed: a.id, P: a.e?.P });
      pm.root.position.copy(V(a.x, a.y));
      pm.root.scale.setScalar(SCALE);
      scene.add(pm.root);
      meshes.set(a.id, pm);
    };
    [...sc.mates, ...sc.foes].forEach(addActor);
    // Nomes dos companheiros: também são alvos de toque (e ficam presos na borda quando o jogador está fora da tela)
    const names = new Map<number, HTMLElement>();
    for (const m of sc.mates) {
      const el = document.createElement('button');
      el.className = 'm3d-name'; el.innerHTML = `<b>${m.e!.P.ovr}</b> ${esc(m.e!.name)}<i class="pc"></i>`;
      el.dataset.id = String(m.id);
      wrap.appendChild(el); names.set(m.id, el);
    }
    const ring = carrierRing(); ring.scale.setScalar(SCALE); scene.add(ring);
    // Linha de impedimento: faixa amarela na altura do penúltimo defensor
    const offLine = new THREE.Mesh(new THREE.PlaneGeometry(68, .14), new THREE.MeshBasicMaterial({ color: 0xf2b640, transparent: true, opacity: .55, depthWrite: false }));
    offLine.rotation.x = -Math.PI / 2; offLine.position.y = .025; offLine.renderOrder = 5; scene.add(offLine);
    const { ball: ballM, shadow: ballSh } = makeBall(); scene.add(ballM, ballSh);
    let preview: THREE.Mesh | null = null;
    const pvMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, depthTest: false });

    // ---------- Estado ----------
    let ball: BallKey = sc.ballAt, anim: { plan: Plan; t0: number } | null = null, finished = false;
    const gkState = { dive: 0 as -1 | 0 | 1, t0: 0, h: 0 };
    const frames: Snap[] = [];
    let replay: { frames: Snap[]; i: number; res: MomentResult } | null = null;
    let raf = 0;

    function flash(text: string, color: string) { msgEl.textContent = text; msgEl.style.color = color; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); }
    function cleanup(res: MomentResult) {
      cancelAnimationFrame(raf); clearTimeout(helpTimer);
      view.dispose();
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
      ov.remove();
      resolve(res);
    }
    function act(t: Target) { if (coach >= 0) coachAct(t); run(sc.perform(t)); }
    function run(plan: Plan) {
      clearPreview(); cancelTap();
      helpEl.classList.remove('show');
      planSound(plan); anim = { plan, t0: performance.now() };
      if (plan.say) flash(plan.say, plan.ok ? '#e8c35f' : '#f06a5a');
      if (plan.gk) { const g = sc.goalie(); g.tx = plan.gk.x; g.ty = plan.gk.y; gkState.dive = plan.gk.dive; gkState.t0 = performance.now() + plan.dur * .45; gkState.h = plan.gk.h; }
    }
    function endAnim(plan: Plan) {
      anim = null;
      plan.commit();
      if (sc.firstTime && !plan.end) { labelEl.style.display = 'block'; labelEl.style.left = `${W / 2}px`; labelEl.style.top = `${H * .42}px`; labelEl.style.color = '#e8c35f'; labelEl.textContent = 'Cruzamento na área! Chute de primeira: desenhe o traço'; }
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
    const toField = (cx: number, cy: number): Pt | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(ground, hit) ? { x: hit.x + 34, y: hit.z } : null;
    };
    const pickMate = (): Actor | null => {
      const objs = sc.mates.filter(m => m !== sc.carrier).map(m => meshes.get(m.id)!.root);
      const h = ray.intersectObjects(objs, true)[0];
      if (!h) return null;
      return sc.mates.find(m => { let o: THREE.Object3D | null = h.object; while (o) { if (o === meshes.get(m.id)!.root) return true; o = o.parent; } return false; }) ?? null;
    };
    /** Companheiro mais perto do ponto tocado (tolerância maior que o corpo, para dedos). */
    const nearMate = (p: Pt | null): Actor | null => {
      const m = pickMate();
      if (m) return m;
      if (!p) return null;
      let best: Actor | null = null, bd = 3.2;
      for (const a of sc.mates) { if (a === sc.carrier) continue; const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = a; } }
      return best;
    };

    // Toque simples x duplo no companheiro
    let pendingTap: { m: Actor; t: number; timer: ReturnType<typeof setTimeout> } | null = null;
    function cancelTap() { if (pendingTap) { clearTimeout(pendingTap.timer); pendingTap = null; } }
    function tapMate(m: Actor) {
      if (busy()) return;
      if (pendingTap && pendingTap.m === m && performance.now() - pendingTap.t < DOUBLE_TAP_MS + 60) {
        cancelTap(); act({ kind: 'pass', m, alto: true }); return;
      }
      cancelTap();
      showTarget({ kind: 'pass', m });
      pendingTap = { m, t: performance.now(), timer: setTimeout(() => { pendingTap = null; if (!busy()) act({ kind: 'pass', m }); }, DOUBLE_TAP_MS) };
    }
    for (const [id, el] of names) el.addEventListener('click', e => { e.stopPropagation(); const m = sc.mates.find(a => a.id === id)!; if (m !== sc.carrier) tapMate(m); });

    interface Stroke { pts: Pt[]; scr: { x: number; y: number; t: number }[]; drag: boolean }
    let stroke: Stroke | null = null;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    function drawTrail(s: Stroke, alpha = 1) {
      tctx.clearRect(0, 0, W, H);
      if (s.scr.length < 2) return;
      tctx.lineCap = 'round'; tctx.lineJoin = 'round';
      for (const [w, c] of [[14, `rgba(232,195,95,${.25 * alpha})`], [5, `rgba(255,255,255,${.95 * alpha})`]] as const) {
        tctx.lineWidth = w; tctx.strokeStyle = c; tctx.beginPath();
        s.scr.forEach((p, i) => (i ? tctx.lineTo(p.x, p.y) : tctx.moveTo(p.x, p.y)));
        tctx.stroke();
      }
    }
    function fadeTrail(s: Stroke) {
      let a = 1;
      const f = () => { a -= .08; if (a <= 0) { tctx.clearRect(0, 0, W, H); return; } drawTrail(s, a); requestAnimationFrame(f); };
      f();
    }
    /** Força pela velocidade do gesto (em alturas de tela por segundo): devagar = fraco, rápido demais = por cima. */
    function strokePower(s: Stroke): number {
      let len = 0;
      for (let i = 1; i < s.scr.length; i++) len += Math.hypot(s.scr[i].x - s.scr[i - 1].x, s.scr[i].y - s.scr[i - 1].y);
      const ms = Math.max(60, s.scr[s.scr.length - 1].t - s.scr[0].t);
      const v = len / H / (ms / 1000);
      return clamp((v - .5) / 3.6, .12, 1);
    }
    el.addEventListener('pointerdown', e => {
      if (busy()) return;
      el.setPointerCapture(e.pointerId);
      const p = toField(e.clientX, e.clientY);
      stroke = { pts: p ? [p] : [], scr: [{ x: e.clientX, y: e.clientY, t: performance.now() }], drag: false };
    });
    el.addEventListener('pointermove', e => {
      if (busy()) return;
      if (stroke) {
        const p = toField(e.clientX, e.clientY);
        if (p) stroke.pts.push(p);
        stroke.scr.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (!stroke.drag && Math.hypot(e.clientX - stroke.scr[0].x, e.clientY - stroke.scr[0].y) > 16) { stroke.drag = true; cancelTap(); clearPreview(); helpEl.classList.remove('show'); }
        if (stroke.drag) drawTrail(stroke);
      } else if (e.pointerType === 'mouse' && !fk && !pen) {
        // Mouse: passar por cima mostra a chance de cada ação
        const p = toField(e.clientX, e.clientY), m = nearMate(p);
        const t = m ? { kind: 'pass' as const, m } : p ? sc.target(p.x, p.y) : null;
        if (t) showTarget(t); else clearPreview();
      }
    });
    el.addEventListener('pointerup', e => {
      if (busy() || !stroke) { stroke = null; return; }
      const s = stroke; stroke = null;
      const p = toField(e.clientX, e.clientY);
      if (p) s.pts.push(p);
      s.scr.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (s.drag) { fadeTrail(s); executeStroke(s); return; }
      if (fk || pen) return;
      const m = nearMate(p);
      if (m) { tapMate(m); return; }
      cancelTap();
      const t = p ? sc.target(p.x, p.y) : null;
      if (t && t.kind !== 'shot') act(t);
    });
    el.addEventListener('pointercancel', () => { stroke = null; tctx.clearRect(0, 0, W, H); });
    el.addEventListener('pointerleave', () => { if (!stroke && !pendingTap) clearPreview(); });

    function executeStroke(s: Stroke) {
      const g = analyzeGesture(s.pts, 1);
      if (!g) return;
      const power = strokePower(s);
      if (fk) { const r = sc.fkFromGesture({ ...g, power }); if (r) run(sc.performFk(r.shot)); return; }
      const shot = sc.shotFromGesture({ ...g, power });
      if (shot) { act(shot); return; }
      if (pen) return;
      const end = s.pts[s.pts.length - 1];
      const t = end ? sc.throughTarget(end.x, end.y) : null;
      if (t && t.kind !== 'shot') act(t);
    }

    // ---------- Linha prevista (toque no companheiro / mouse) ----------
    function clearPreview() {
      if (preview) { scene.remove(preview); preview.geometry.dispose(); preview = null; }
      labelEl.style.display = 'none';
    }
    function drawPath(pts: THREE.Vector3[], prob: number, text: string) {
      clearPreview();
      const curve = new THREE.CatmullRomCurve3(pts);
      preview = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .09, 6, false), pvMat);
      pvMat.color.set(probColor(prob));
      preview.renderOrder = 10;
      scene.add(preview);
      const end = pts[pts.length - 1].clone().project(camera);
      labelEl.style.display = 'block';
      labelEl.style.left = `${clamp((end.x + 1) / 2 * W, 60, W - 60)}px`;
      labelEl.style.top = `${clamp((1 - end.y) / 2 * H - 40, 50, H - 60)}px`;
      labelEl.style.color = probColor(prob);
      labelEl.textContent = text;
    }
    function showTarget(t: Target) {
      const c = sc.carrier, p = sc.prob(t), from = V(c.x, c.y - .5, .15);
      if (t.kind === 'pass') drawPath([from, V((c.x + t.m.x) / 2, (c.y + t.m.y) / 2, .6), V(t.m.x, t.m.y, .15)], p, `Passe ${Math.round(p * 100)}% · 2 toques = alto ${Math.round(sc.passP(t.m, true) * 100)}%`);
      else if (t.kind === 'drib') drawPath([from, V((c.x + t.x) / 2, (c.y + t.y) / 2, .1), V(t.x, t.y, .1)], p, `Conduzir ${Math.round(p * 100)}%`);
      else if (t.kind === 'finta') drawPath([from, V(c.x + .8, c.y - 1.5, .1), V(c.x, c.y - 3.5, .1)], p, `Finta (drible) ${Math.round(p * 100)}%`);
    }

    // ---------- Câmera ----------
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    function camTarget(): [THREE.Vector3, THREE.Vector3] {
      const c = sc.carrier;
      if (pen) return portrait ? [V(34, 12 + 8, 8), V(34, 1.5, 0)] : [V(34, 12 + 8.5, 2.6), V(34, 0, 1.1)];
      if (fk && sc.setup) {
        const b = sc.setup.ball, dx = b.x - 34, dy = b.y, L = Math.hypot(dx, dy), back = portrait ? 10 : 8;
        return portrait ? [V(b.x + dx / L * back, b.y + dy / L * back, 13), V(34 + dx * .2, 5, 0)]
          : [V(b.x + dx / L * back, b.y + dy / L * back, 4.4), V(34 + dx * .15, 0, .8)];
      }
      // Bola parada (escanteio/lateral): câmera alta atrás da cobrança, olhando para a área
      if (sc.setPiece) {
        const side = c.x < 34 ? -1 : 1;
        return portrait ? [V(34 + side * 10, c.y + 18, 24), V(34 + side * 4, Math.max(6, c.y - 6), 0)]
          : [V(34 + side * 16, c.y + 16, 12), V(34 + side * 3, Math.max(6, c.y - 4), 0)];
      }
      // Enquadra o portador, o gol e o meio do caminho; mais alto na tela em pé para ver os lados
      const cx = c.x * .8 + 34 * .2, depth = Math.max(c.y, 15); // perto do gol a câmera não avança mais (sem céu)
      // Tela em pé: câmera alta e inclinada (~56°) para o gramado ocupar a tela toda, sem céu
      if (portrait) return [V(cx, depth + 6, 28), V(cx * .85 + 34 * .15, depth - 13, 0)];
      return [V(c.x + (c.x - 34) * .25, c.y + 13, 8.5), V(34 + (c.x - 34) * .45, Math.max(0, c.y - 14), 0)];
    }
    { const [p, l] = camTarget(); camPos.copy(p); camLook.copy(l); }

    // ---------- Laço de animação ----------
    let lastT = performance.now(), pcTick = 11;
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
        const dx = ball.x - a.x, dz = ball.y - a.y;
        const want = a.team === 0 ? Math.atan2(-(34 - a.x), a.y) : Math.atan2(-dx, -dz);
        pm.body.rotation.y += (want - pm.body.rotation.y) * .15;
      }
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
      ballM.scale.setScalar(portrait ? 1.35 : 1.1);
      ballM.rotation.x -= anim ? .35 : .02;
      ballSh.position.set(ball.x - 34, .016, ball.y);
      ballSh.scale.setScalar((portrait ? 1.3 : 1) / (1 + ball.h * .5));
      ring.position.set(sc.carrier.x - 34, .02, sc.carrier.y);
      ring.visible = !finished;
      const [tp, tl] = camTarget();
      camPos.lerp(tp, .08); camLook.lerp(tl, .09);
      camera.position.copy(camPos); camera.lookAt(camLook);
      // Nomes: presos na borda quando fora da tela, e empurrados para não ficarem um em cima do outro
      const tags: { el: HTMLElement; x: number; y: number }[] = [];
      for (const [id, elN] of names) {
        const a = sc.mates.find(m => m.id === id)!, s = V(a.x, a.y, 2.3 * SCALE).project(camera);
        let x = (s.x + 1) / 2 * W, y = (1 - s.y) / 2 * H;
        const off = x < 8 || x > W - 8 || y < 56 || y > H - 8;
        x = clamp(x, 50, W - 50); y = clamp(y, 76, H - 16);
        elN.style.display = s.z < 1 && !finished ? 'block' : 'none';
        elN.classList.toggle('on', a === sc.carrier);
        elN.classList.toggle('edge', off);
        tags.push({ el: elN, x, y });
      }
      offLine.visible = !fk && !pen && !sc.setPiece && !finished;
      if (offLine.visible) offLine.position.z = sc.offsideLine();
      // Chance do passe rasteiro ao lado de cada nome (atualiza quando a jogada para)
      if (!anim && !finished && !fk && !pen && (++pcTick % 12 === 0)) for (const [id, elN] of names) {
        const a = sc.mates.find(m => m.id === id)!, pc = elN.querySelector<HTMLElement>('.pc')!;
        if (a === sc.carrier) { pc.textContent = ''; continue; }
        if (sc.isOffside(a)) { pc.textContent = ' impedido'; pc.style.color = '#f2b640'; continue; }
        // Mostra a melhor opção: rasteiro ou alto (↑ = com 2 toques, por cima)
        const p = sc.passP(a), pa = sc.passP(a, true), alto = pa > p + .08, v = alto ? pa : p;
        pc.textContent = ` ${Math.round(v * 100)}%${alto ? '↑' : ''}`; pc.style.color = probColor(v);
      }
      tags.sort((p, q) => p.y - q.y);
      for (let i = 1; i < tags.length; i++) for (let j = 0; j < i; j++)
        if (Math.abs(tags[i].x - tags[j].x) < 110 && tags[i].y - tags[j].y < 30) tags[i].y = tags[j].y + 30;
      for (const t of tags) { t.el.style.left = `${t.x}px`; t.el.style.top = `${t.y}px`; }
      actsEl.textContent = pen ? 'Cobrança' : fk ? `Cobrador: ${sc.carrier.e!.name}` : `${sc.actions} ações`;
      frames.push({ ball: ballM.position.clone(), actors: [...sc.mates, ...sc.foes].map(a => { const pm = meshes.get(a.id)!; return [a.id, pm.root.position.x, pm.root.position.z, pm.body.rotation.y, pm.body.rotation.z]; }) });
      if (frames.length > 240) frames.shift();
      tickStadium(performance.now());
      tickNet(ballM.position);
      view.render(scene, camera);
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
      camera.position.set(side * (portrait ? 14 : 11), portrait ? 3.4 : 2.4, portrait ? 9 : 6.5);
      camera.lookAt(f.ball.x * .5, .9, Math.max(-1, f.ball.z * .6));
      // No replay do gol a torcida pula
      tickStadium(performance.now(), R.res.goal);
      if (R.i < 1) resetNet();
      tickNet(ballM.position);
      view.render(scene, camera);
      if (R.i >= R.frames.length + 25) { replay = null; replayEl.classList.remove('on'); cleanup(R.res); }
    }
    frame();
  });
}
