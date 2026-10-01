// Lance jogável em 3D (Three.js), em tela cheia.
// Controles: toque num companheiro = menu do passe (Rasteiro, Alto/Cruzamento, Enfiado) · toque no campo = conduzir ·
// toque no seu jogador = finta · trace uma linha até o gol = menu do chute (Rasteiro, Superchute, Colocado; na bola alta,
// Cabeçada ou Voleio) · traço para o espaço = lançamento para quem estiver mais perto.
// Câmeras: Padrão (atrás da jogada, como na transmissão de trás do gol), TV (de lado, da arquibancada) e Atrás do jogador.
import * as THREE from 'three';
import { createView } from './quality';
import { analyzeGesture, type Pt } from '../engine/lance';
import { LanceScene, type Actor, type BallKey, type Opcao, type Plan, type PsTag, type Target } from '../engine/lanceScene';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { clamp } from '../engine/rng';
import { goleiroKit, kitDe } from '../engine/kits';
import { esc } from '../ui/dom';
import { choiceHTML, openChoice, probColor, psChips } from '../ui/choice';
import { carrierRing, makeBall, makePlayer, restPose, type PlayerMesh } from './players';
import { headerPose, keeperCenter, keeperDive, keeperReady, kickPose, runPose, tacklePose } from './anim';
import { addLights, ambientScene, buildGoal, buildPitch, buildStadium, buildWeather, resetNet, setNetForce, tickNet, tickStadium } from './stadium';
import { ambienteDaPartida } from '../engine/clima';
import { app, saveNow } from '../ui/ctx';
import { endSound, haptic, planSound, sfx } from '../ui/sfx';
import { PS_BY_ID, parsePs } from '../engine/data/schema';

const HELP3D = {
  escanteio: '<b>Escanteio:</b> toque num companheiro na área para cruzar. A bola chega na cabeça: <b>trace a linha até o gol</b> e escolha <b>Cabeçada</b> ou <b>Voleio</b>. Na cobrança não tem impedimento.',
  lateral: '<b>Lateral:</b> toque num companheiro perto para cobrar com a mão. Depois o lance segue normal. Cuidado com o <b>impedimento</b> (linha amarela).',
  ataque: 'Toque no <b>companheiro</b> e escolha o passe: <b>Rasteiro</b>, <b>Alto</b> ou <b>Enfiado</b> · toque no <b>campo</b>: conduzir · toque no <b>seu jogador</b>: finta · <b>trace a linha até o gol</b> e escolha o chute: <b>Rasteiro</b>, <b>Superchute</b> ou <b>Colocado</b> (só ele faz curva) · traço para o <b>espaço</b>: lançamento',
  penalti: '<b>Desenhe um traço</b> da bola até o canto: a direção escolhe o canto, a velocidade dá a força. Rápido demais vai por cima.',
  falta: '<b>Desenhe o traço</b> da bola até o gol: a direção mira, a <b>curva do traço</b> dá o efeito e a <b>velocidade</b> dá a força. Por cima ou em volta da barreira.',
};

const V = (x: number, y: number, h = 0) => new THREE.Vector3(x - 34, h, y);
type CamMode = 'padrao' | 'tv' | 'atras';
const CAMS: CamMode[] = ['padrao', 'tv', 'atras'];
const CAM_N: Record<CamMode, string> = { padrao: 'Padrão', tv: 'TV', atras: 'Atrás' };
/** Câmera salva (a antiga "Aérea" virou a Padrão). */
export const camSalva = (c: string | undefined): CamMode => (CAMS.includes(c as CamMode) ? c as CamMode : 'padrao');

/** Pose gravada para o replay: posição, direção, pivô do corpo e as juntas. */
type Snap = { ball: THREE.Vector3; actors: number[][] };
const JOINTS = (pm: PlayerMesh): THREE.Object3D[] => [pm.core, pm.legL, pm.legR, pm.shinL, pm.shinR, pm.armL, pm.armR, pm.foreL, pm.foreR];

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
        <div class="m3d-replay" id="m3dReplay">REPLAY · toque para pular</div>
        <div class="ps-flash" id="psFlash"></div>
        <div class="ps-hud" id="psHud"></div>
        ${choiceHTML()}
        <div class="m3d-cam"><button id="camL" aria-label="Girar a câmera para a esquerda">⟲</button><button id="camM" aria-label="Trocar câmera">🎥 <span id="camN"></span></button><button id="camR" aria-label="Girar a câmera para a direita">⟳</button></div>
      </div>
      <div class="mo-msg" id="moMsg"></div>`;
    document.body.appendChild(ov);
    const $ = <T extends HTMLElement>(id: string) => ov.querySelector<T>('#' + id)!;
    const wrap = $('m3dWrap'), labelEl = $('m3dLabel'), replayEl = $('m3dReplay'), msgEl = $('moMsg'), actsEl = $('moActs'), helpEl = $('m3dHelp');
    const psFlash = $('psFlash'), psHud = $('psHud');
    const trail = $<HTMLCanvasElement>('m3dTrail'), tctx = trail.getContext('2d')!;
    const W = ov.clientWidth, H = ov.clientHeight, portrait = W / H < 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    trail.width = W * dpr; trail.height = H * dpr; tctx.scale(dpr, dpr);
    // Treino guiado: passo a passo, a dica fica na tela até você fazer a ação pedida
    const COACH = [
      '<b>Treino 1/3</b> · Toque num <b>companheiro</b> e escolha <b>Rasteiro</b> no menu. O número é a chance de dar certo.',
      '<b>Treino 2/3</b> · Agora toque em outro companheiro e escolha <b>Alto</b> (por cima) ou <b>Enfiado</b> (no espaço, na frente dele).',
      '<b>Treino 3/3</b> · Conduza (toque no campo) até perto da área. <b>Trace uma linha</b> da bola até o canto do gol e escolha o chute: <b>Rasteiro</b>, <b>Superchute</b> ou <b>Colocado</b> (curve o traço).',
    ];
    let coach = req.treino ? 0 : -1;
    const showCoach = () => { if (coach >= 0) { helpEl.innerHTML = COACH[coach]; helpEl.classList.add('show'); } };
    const coachAct = (t: Target) => {
      if (coach === 0 && t.kind === 'pass' && !t.alto) coach = 1;
      else if (coach === 1 && (t.kind === 'lanc' || t.kind === 'pass' && t.alto)) coach = 2;
      setTimeout(showCoach, 900);
    };
    let helpTimer = setTimeout(() => { if (coach < 0) helpEl.classList.remove('show'); }, 5000);
    showCoach();
    $('m3dQ').addEventListener('click', () => { clearTimeout(helpTimer); helpEl.classList.toggle('show'); });

    // Estilos de jogo de quem está com a bola (embaixo): quais ele tem e o que fazem no lance
    let hudFor = -1;
    function updateHud() {
      const c = sc.carrier;
      if (hudFor === c.id) return;
      hudFor = c.id;
      const ps = c.e!.P.ps.map(parsePs).map(p => ({ ...p, d: PS_BY_ID.get(p.id) })).filter(p => p.d && !p.d.gol);
      psHud.innerHTML = ps.length ? `<b>${esc(c.e!.name)}</b> ${ps.map(p => `<span class="psc">${p.d!.icone} ${esc(p.d!.nome)}${p.plus ? '+' : ''}</span>`).join('')}` : '';
      psHud.classList.toggle('on', ps.length > 0);
    }
    // Aviso na tela quando um estilo agiu na jogada (dourado = seu, vermelho = da defesa rival)
    let psTimer: ReturnType<typeof setTimeout> | undefined;
    function showPs(tags: PsTag[] | undefined, bonus?: string) {
      if (!tags?.length && !bonus) return;
      psFlash.innerHTML = `${psChips(tags ?? [])}${bonus ? `<span class="psc bonus">${esc(bonus)}</span>` : ''}`;
      psFlash.classList.remove('show'); void psFlash.offsetWidth; psFlash.classList.add('show');
      clearTimeout(psTimer); psTimer = setTimeout(() => psFlash.classList.remove('show'), 2600);
    }

    // ---------- Three.js ----------
    const view = createView(W, H), renderer = view.renderer;
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    // Cenário: clima do jogo, gramado escolhido e o estádio do mandante (Galo em casa = Arena MRV)
    const amb = ambienteDaPartida(M, app.S.gramado);
    ambientScene(scene, amb.clima);
    addLights(scene, amb.clima);
    scene.add(buildPitch(amb), buildGoal(), buildStadium(amb));
    const weather = buildWeather(amb.clima);
    if (weather) scene.add(weather.obj);
    const camera = new THREE.PerspectiveCamera(50, W / H, .1, 500);
    const SCALE = portrait ? 1.22 : 1.08;

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
    // Rastro de fogo do superchute: bolinhas brilhantes atrás da bola
    const trailN = 16, fire: THREE.Mesh[] = [];
    for (let i = 0; i < trailN; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.16 * (1 - i / trailN * .75), 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(.08 - i * .004, 1, .62 - i * .018), transparent: true, opacity: .85 * (1 - i / trailN), depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false; scene.add(m); fire.push(m);
    }
    const ballHist: THREE.Vector3[] = [];
    let previews: THREE.Mesh[] = [];
    const pvMat = (c: string, o = .85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false });

    // ---------- Estado ----------
    let ball: BallKey = sc.ballAt, anim: { plan: Plan; t0: number; wind: number } | null = null, finished = false, menu = false;
    const gkState = { dive: 0 as -1 | 0 | 1, t0: 0, h: 0, dur: 700 };
    /** Animação especial de um jogador (chute, cabeçada, carrinho) até `t1`. */
    const acting = new Map<number, { k: 'kick' | 'super' | 'head' | 'tackle'; t0: number; t1: number }>();
    const frames: Snap[] = [];
    let replay: { frames: Snap[]; i: number; res: MomentResult } | null = null;
    let raf = 0, shake = 0, fovKick = 0;
    const baseFov = () => (pen ? (portrait ? 52 : 40) : fk ? (portrait ? 56 : 44) : camMode === 'tv' ? (portrait ? 58 : 38) : camMode === 'atras' ? (portrait ? 64 : 50) : (portrait ? 62 : 46));

    function flash(text: string, color: string) { msgEl.textContent = text; msgEl.style.color = color; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); }
    function cleanup(res: MomentResult) {
      cancelAnimationFrame(raf); clearTimeout(helpTimer); clearTimeout(psTimer);
      setNetForce(1);
      view.dispose();
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
      ov.remove();
      resolve(res);
    }
    function act(t: Target) { if (coach >= 0) coachAct(t); run(sc.perform(t)); }
    function run(plan: Plan) {
      clearPreview();
      helpEl.classList.remove('show');
      const now = performance.now(), c = sc.carrier;
      // Preparo do chute: o jogador arma a perna antes de a bola sair (no superchute, com mais força e um instante a mais)
      const wind = plan.anim === 'super' ? 380 : plan.anim === 'chute' || plan.anim === 'voleio' ? 240 : plan.anim === 'cabeca' ? 260 : plan.anim === 'passe' ? 140 : 0;
      if (plan.anim && plan.anim !== 'drible') acting.set(c.id, { k: plan.anim === 'super' ? 'super' : plan.anim === 'cabeca' ? 'head' : 'kick', t0: now, t1: now + wind * 2.2 });
      anim = { plan, t0: now + wind, wind };
      setTimeout(() => { planSound(plan); if (plan.anim === 'super') { sfx.superKick(); shake = 1; fovKick = 1; setNetForce(1.8); } if (plan.anim === 'cabeca') sfx.head(); }, wind);
      if (plan.anim === 'super') flash('SUPERCHUTE!', '#ff9a3c');
      else if (plan.say) flash(plan.say, plan.ok ? '#e8c35f' : '#f06a5a');
      showPs(plan.ps, plan.bonus);
      if (plan.gk) { const g = sc.goalie(); g.tx = plan.gk.x; g.ty = plan.gk.y; gkState.dive = plan.gk.dive; gkState.h = plan.gk.h; gkState.dur = Math.max(420, plan.dur * .9); gkState.t0 = now + wind + plan.dur * (plan.anim === 'super' ? .22 : .35); }
    }
    function endAnim(plan: Plan) {
      anim = null;
      plan.commit();
      updateHud();
      if (sc.firstTime && !plan.end) { labelEl.style.display = 'block'; labelEl.style.left = `${W / 2}px`; labelEl.style.top = `${H * .4}px`; labelEl.style.color = '#e8c35f'; labelEl.textContent = 'Bola na cabeça! Trace a linha até o gol: Cabeçada ou Voleio'; }
      // Desarme: o marcador mais perto da bola dá o carrinho/bote
      if (!plan.ok && plan.kind === 'drib') {
        const b = plan.ball[plan.ball.length - 1], f = sc.field().sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
        if (f) { const now = performance.now(); acting.set(f.id, { k: 'tackle', t0: now, t1: now + 900 }); sfx.tackle(); }
      }
      if (plan.end && !finished) {
        finished = true;
        flash(plan.end.text, plan.end.color); endSound(plan.end);
        if (plan.end.goal) {
          const res = plan.end.res;
          // Replay só do finalzinho (o chute e a bola entrando); toque na tela pula
          setTimeout(() => { msgEl.textContent = ''; replay = { frames: frames.slice(-Math.min(frames.length, 100)), i: 0, res }; replayEl.classList.add('on'); }, 1300);
        } else setTimeout(() => cleanup(plan.end!.res), 2300);
      }
    }
    const busy = () => !!anim || finished || menu;

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

    /** Abre um menu (passe ou chute): o lance espera a escolha. */
    function escolher(title: string, ops: Opcao[], preview: (o?: Opcao) => void) {
      menu = true; preview();
      helpEl.classList.remove('show');
      openChoice(ov, title, ops, o => { menu = false; act(o.t); }, () => { menu = false; clearPreview(); }, o => preview(o));
    }
    function tapMate(m: Actor) {
      if (busy()) return;
      // Na cobrança de escanteio/lateral, o toque já cobra
      if (sc.setPiece) { act({ kind: 'pass', m, alto: kind === 'escanteio' }); return; }
      const ops = sc.passOptions(m);
      escolher(`Passe para ${m.e!.name}`, ops, o => showPassPreview(m, ops, o));
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
    /** Força pela velocidade do gesto (em alturas de tela por segundo): vale na falta e no pênalti. */
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
        if (!stroke.drag && Math.hypot(e.clientX - stroke.scr[0].x, e.clientY - stroke.scr[0].y) > 16) { stroke.drag = true; clearPreview(); helpEl.classList.remove('show'); }
        if (stroke.drag) drawTrail(stroke);
      } else if (e.pointerType === 'mouse' && !fk && !pen) {
        // Mouse: passar por cima mostra a chance de cada ação
        const p = toField(e.clientX, e.clientY), m = nearMate(p);
        const t = m ? null : p ? sc.target(p.x, p.y) : null;
        if (t && t.kind !== 'shot' && t.kind !== 'pass') showTarget(t); else clearPreview();
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
      const t = p ? sc.target(p.x, p.y) : null;
      if (t && t.kind !== 'shot' && t.kind !== 'pass') act(t);
    });
    el.addEventListener('pointercancel', () => { stroke = null; tctx.clearRect(0, 0, W, H); });
    el.addEventListener('pointerleave', () => { if (!stroke && !menu) clearPreview(); });

    function executeStroke(s: Stroke) {
      const g = analyzeGesture(s.pts, 1);
      if (!g) return;
      const power = strokePower(s);
      if (fk) { const r = sc.fkFromGesture({ ...g, power }); if (r) run(sc.performFk(r.shot)); return; }
      const shot = sc.shotFromGesture({ ...g, power });
      if (shot && shot.kind === 'shot') {
        // Pênalti: o traço já é o chute. No lance: aparece o menu do tipo de chute
        if (pen) { act(shot); return; }
        const ops = sc.shotOptions(shot);
        escolher(sc.firstTime ? 'Bola alta: como finalizar?' : 'Tipo de chute', ops, o => showShotPreview(shot, ops, o));
        return;
      }
      if (pen) return;
      const end = s.pts[s.pts.length - 1];
      const t = end ? sc.throughTarget(end.x, end.y) : null;
      if (t && t.kind !== 'shot') act(t);
    }

    // ---------- Linhas previstas ----------
    function clearPreview() {
      for (const p of previews) { scene.remove(p); p.geometry.dispose(); }
      previews = [];
      labelEl.style.display = 'none';
    }
    function tube(pts: THREE.Vector3[], color: string, r = .09, o = .85) {
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 6, false), pvMat(color, o));
      m.renderOrder = 10; scene.add(m); previews.push(m);
    }
    function label(at: THREE.Vector3, text: string, color: string) {
      const end = at.clone().project(camera);
      labelEl.style.display = 'block';
      labelEl.style.left = `${clamp((end.x + 1) / 2 * W, 60, W - 60)}px`;
      labelEl.style.top = `${clamp((1 - end.y) / 2 * H - 40, 50, H - 60)}px`;
      labelEl.style.color = color; labelEl.textContent = text;
    }
    /** Passe: linha rasteira até o pé, arco alto por cima, e o ponto do enfiado na frente dele. Destaca a opção em foco. */
    function showPassPreview(m: Actor, ops: Opcao[], foco?: Opcao) {
      clearPreview();
      const c = sc.carrier, from = V(c.x, c.y - .5, .15);
      for (const o of ops) {
        const on = !foco || foco === o, t = o.t, col = on ? probColor(o.p) : '#ffffff', op = on ? .9 : .25;
        if (t.kind === 'pass' && !t.alto) tube([from, V((c.x + m.x) / 2, (c.y + m.y) / 2, .2), V(m.x, m.y, .15)], col, .08, op);
        else if (t.kind === 'pass') tube([from, V((c.x + m.x) / 2, (c.y + m.y) / 2, 3 + Math.hypot(c.x - m.x, c.y - m.y) * .08), V(m.x, m.y, 1.4)], col, .06, op);
        else if (t.kind === 'lanc') tube([from, V((c.x + t.x) / 2, (c.y + t.y) / 2, .3), V(t.x, t.y, .1)], col, .06, op);
      }
      if (foco) label(V(m.x, m.y, 1.5), `${foco.nome} ${Math.round(foco.p * 100)}%`, probColor(foco.p));
    }
    /** Chute: Rasteiro e Superchute em linha reta; o Colocado mostra a curva do traço. */
    function showShotPreview(base: Target & { kind: 'shot' }, ops: Opcao[], foco?: Opcao) {
      clearPreview();
      const c = sc.carrier, h0 = sc.ballAt.h;
      for (const o of ops) {
        if (o.t.kind !== 'shot') continue;
        const on = !foco || foco === o, col = on ? probColor(o.p) : '#ffffff';
        const pts = o.t.curve ? sc.shotPath(o.t.ax, o.t.curve, 18) : [c, { x: o.t.ax, y: 0 }];
        tube(pts.map((p, i) => V(p.x, p.y, h0 + (.35 + (o.t.kind === 'shot' && o.t.tipo === 'forte' ? .9 : .4) * i / (pts.length - 1)) * (1 - h0 / 3))), col, .06, on ? .9 : .22);
      }
      label(V(base.ax, 0, 2.6), foco ? `${foco.nome} ${Math.round(foco.p * 100)}%` : 'Escolha o chute', foco ? probColor(foco.p) : '#ffffff');
    }
    function showTarget(t: Target) {
      clearPreview();
      const c = sc.carrier, p = sc.prob(t), from = V(c.x, c.y - .5, .15);
      if (t.kind === 'drib') {
        tube([from, V((c.x + t.x) / 2, (c.y + t.y) / 2, .1), V(t.x, t.y, .1)], probColor(p));
        const alc = sc.tags(['velocista', 'explosao', 'tecnico']);
        label(V(t.x, t.y, .1), `Conduzir ${Math.round(p * 100)}%${alc.length ? ' · ' + alc.map(a => a.icone).join('') + ' mais longe' : ''}`, probColor(p));
      } else if (t.kind === 'finta') { tube([from, V(c.x + .8, c.y - 1.5, .1), V(c.x, c.y - 3.5, .1)], probColor(p)); label(V(c.x, c.y - 3.5, .1), `Finta (drible) ${Math.round(p * 100)}%`, probColor(p)); }
    }

    // ---------- Câmera ----------
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    let camMode: CamMode = camSalva(app.S.camera), yaw = 0, yawVel = 0;
    const camN = $('camN'); camN.textContent = CAM_N[camMode];
    $('camM').addEventListener('click', () => {
      camMode = CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]; yaw = 0; camN.textContent = CAM_N[camMode];
      app.S.camera = camMode; saveNow();
    });
    for (const [id, dir] of [['camL', 1], ['camR', -1]] as const) {
      const b = $(id);
      b.addEventListener('pointerdown', e => { e.preventDefault(); yawVel = dir * 1.7; b.setPointerCapture(e.pointerId); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(ev, () => { yawVel = 0; });
    }
    function camTarget(): [THREE.Vector3, THREE.Vector3] {
      const [p, l] = camBase();
      if (!yaw) return [p, l];
      return [l.clone().add(p.clone().sub(l).applyAxisAngle(UP, yaw)), l];
    }
    /** Onde a jogada acontece: segue a bola quando ela está no ar. */
    const foco = () => (anim ? { x: ball.x, y: ball.y } : sc.carrier);
    function camBase(): [THREE.Vector3, THREE.Vector3] {
      const c = foco();
      // Pênalti: atrás do batedor, baixa, como na transmissão
      if (pen) return portrait ? [V(34, 12 + 6.8, 3.4), V(34, 0, 1.25)] : [V(34, 12 + 7.5, 2.8), V(34, 0, 1.1)];
      if (fk && sc.setup) {
        const b = sc.setup.ball, dx = b.x - 34, dy = b.y, L = Math.hypot(dx, dy), back = portrait ? 8 : 7;
        return portrait ? [V(b.x + dx / L * back, b.y + dy / L * back, 4.6), V(34 + dx * .15, 2, .9)]
          : [V(b.x + dx / L * back, b.y + dy / L * back, 3.4), V(34 + dx * .12, 0, .9)];
      }
      // Bola parada (escanteio/lateral): alta atrás da cobrança, olhando para a área
      if (sc.setPiece) {
        const side = c.x < 34 ? -1 : 1;
        return portrait ? [V(34 + side * 12, c.y + 16, 15), V(34 + side * 3, Math.max(6, c.y - 6), 0)]
          : [V(34 + side * 16, c.y + 15, 10), V(34 + side * 3, Math.max(6, c.y - 4), 0)];
      }
      const depth = Math.max(c.y, 12); // perto do gol a câmera não avança mais
      // TV: de lado, do alto da arquibancada, como na transmissão (o gol fica de um lado da tela)
      if (camMode === 'tv') return portrait ? [V(-15, depth * .6 + 2, 19), V(c.x * .5 + 34 * .5, depth * .6, 0)] : [V(-13, depth * .65 + 2, 15), V(c.x * .6 + 34 * .4, depth * .65, 0)];
      // Atrás do jogador: baixa, por cima do ombro, olhando para o gol
      if (camMode === 'atras') return portrait ? [V(c.x + (c.x - 34) * .08, depth + 7, 3.6), V(34 + (c.x - 34) * .35, Math.max(0, depth - 13), 1)] : [V(c.x + (c.x - 34) * .08, depth + 7.5, 3), V(34 + (c.x - 34) * .35, Math.max(0, depth - 14), 1)];
      // Padrão: atrás da jogada, a meia altura (vê o gol, a área e os jogadores em pé, com a torcida ao fundo)
      // Tela em pé (visão estreita): a câmera fica atrás de quem tem a bola, mesmo na ponta, e só gira um pouco para o gol
      if (portrait) return [V(c.x * .92 + 34 * .08, depth + 14, 12.5), V(c.x * .85 + 34 * .15, depth - 5, 0)];
      const cx = c.x * .75 + 34 * .25;
      return [V(cx, depth + 15, 9.5), V(cx * .7 + 34 * .3, depth - 9, 0)];
    }
    // Abertura: a câmera começa no alto, mostrando o estádio e a torcida, e desce até a jogada
    const introAte = performance.now() + (pen || fk ? 1100 : 1700);
    camPos.copy(V(34 + 46, -12, 30)); camLook.copy(V(34, 26, 2));

    // ---------- Laço de animação ----------
    let lastT = performance.now(), pcTick = 11;
    updateHud();
    function poseActor(a: Actor, pm: PlayerMesh, sp: number, now: number) {
      const ac = acting.get(a.id);
      if (ac && now < ac.t1) {
        const k = (now - ac.t0) / (ac.t1 - ac.t0);
        if (ac.k === 'head') headerPose(pm, k);
        else if (ac.k === 'tackle') tacklePose(pm, Math.min(1, k * 1.4));
        else kickPose(pm, k, ac.k === 'super' ? 1 : .55);
        return;
      }
      if (ac) acting.delete(a.id);
      if (a.gk) {
        if (gkState.t0 > 0 && now > gkState.t0) {
          const k = Math.min(1, (now - gkState.t0) / gkState.dur), alto = gkState.h > 1.2;
          // O goleiro olha para a bola (de frente para o jogo): a direita dele é o -X do mundo
          if (gkState.dive) keeperDive(pm, gkState.dive > 0 ? -1 : 1, alto, k); else keeperCenter(pm, alto, k);
        } else keeperReady(pm, now / 1000);
        return;
      }
      if (sp > .4) runPose(pm, now / 85 + a.id, Math.min(1, sp * .16));
      else { restPose(pm); pm.core.position.y += Math.sin(now / 500 + a.id) * .006; pm.armL.rotation.z = -.2; pm.armR.rotation.z = .2; }
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000), cdt = Math.min(.25, (now - lastT) / 1000);
      lastT = now;
      if (replay) { playReplay(); return; }
      for (const a of [...sc.mates, ...sc.foes]) {
        const pm = meshes.get(a.id)!, px = a.x, py = a.y;
        a.x += (a.tx - a.x) * .1; a.y += (a.ty - a.y) * .1;
        const sp = Math.hypot(a.x - px, a.y - py) / Math.max(dt, .001);
        pm.root.position.set(a.x - 34, 0, a.y);
        const dx = ball.x - a.x, dz = ball.y - a.y;
        const want = a.team === 0 ? (a === sc.carrier || sp < .4 ? Math.atan2(-(34 - a.x), a.y) : Math.atan2(-(a.tx - a.x), -(a.ty - a.y))) : Math.atan2(-dx, -dz);
        let d = want - pm.body.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        pm.body.rotation.y += d * .15;
        poseActor(a, pm, sp, now);
      }
      if (anim) {
        const k = Math.max(0, Math.min(1, (now - anim.t0) / anim.plan.dur)), keys = anim.plan.ball, f = k * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(f)), u = f - i;
        ball = { x: keys[i].x + (keys[i + 1].x - keys[i].x) * u, y: keys[i].y + (keys[i + 1].y - keys[i].y) * u, h: keys[i].h + (keys[i + 1].h - keys[i].h) * u };
        if (k >= 1) endAnim(anim.plan);
      } else if (!finished) ball = sc.ballAt;
      ballM.position.copy(V(ball.x, ball.y, .16 + ball.h));
      ballM.scale.setScalar(portrait ? 1.3 : 1.1);
      const superOn = !!anim && anim.plan.anim === 'super' && now > anim.t0;
      ballM.rotation.x -= anim ? (superOn ? .8 : .35) : .02;
      ballSh.position.set(ball.x - 34, .016, ball.y);
      ballSh.scale.setScalar((portrait ? 1.3 : 1) / (1 + ball.h * .5));
      // Rastro do superchute
      ballHist.unshift(ballM.position.clone()); if (ballHist.length > trailN * 2) ballHist.pop();
      fire.forEach((m, i) => { const p = ballHist[i * 2]; m.visible = superOn && !!p; if (p) m.position.copy(p); });
      ring.position.set(sc.carrier.x - 34, .02, sc.carrier.y);
      ring.visible = !finished;
      yaw += yawVel * cdt;
      const [tp, tl] = camTarget(), intro = now < introAte;
      // Suavização por tempo (igual em qualquer FPS)
      camPos.lerp(tp, 1 - Math.exp(-cdt * (intro ? 2.2 : 4))); camLook.lerp(tl, 1 - Math.exp(-cdt * (intro ? 2.5 : 4.6)));
      camera.position.copy(camPos);
      // Tremida e "soco" na lente no superchute
      if (shake > 0) { camera.position.x += (Math.random() - .5) * .5 * shake; camera.position.y += (Math.random() - .5) * .35 * shake; shake = Math.max(0, shake - cdt * 2.6); }
      camera.lookAt(camLook);
      fovKick = Math.max(0, fovKick - cdt * 2.2);
      const fov = baseFov() + 9 * fovKick * fovKick;
      if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      weather?.tick(dt, camLook);
      // Nomes: presos na borda quando fora da tela, e empurrados para não ficarem um em cima do outro
      const tags: { el: HTMLElement; x: number; y: number }[] = [];
      for (const [id, elN] of names) {
        const a = sc.mates.find(m => m.id === id)!, s = V(a.x, a.y, 2.3 * SCALE).project(camera);
        let x = (s.x + 1) / 2 * W, y = (1 - s.y) / 2 * H;
        const off = x < 8 || x > W - 8 || y < 56 || y > H - 8, hw = elN.offsetWidth / 2 + 4;
        // Preso na borda: seta para o lado em que o companheiro está
        elN.classList.toggle('eL', x < hw); elN.classList.toggle('eR', x > W - hw);
        x = clamp(x, hw, W - hw); y = clamp(y, 76, H - 120); // embaixo ficam os estilos e os botões de câmera
        // Pênalti e falta: o nome do cobrador ficaria em cima do goleiro/barreira, então some
        elN.style.display = s.z < 1 && !finished && !pen && !fk ? 'block' : 'none';
        elN.classList.toggle('on', a === sc.carrier);
        elN.classList.toggle('edge', off);
        tags.push({ el: elN, x, y });
      }
      offLine.visible = !fk && !pen && !sc.setPiece && !finished;
      if (offLine.visible) offLine.position.z = sc.offsideLine();
      // Chance do passe ao lado de cada nome (a melhor entre rasteiro e alto; ↑ = alto)
      if (!anim && !finished && !fk && !pen && (++pcTick % 12 === 0)) for (const [id, elN] of names) {
        const a = sc.mates.find(m => m.id === id)!, pc = elN.querySelector<HTMLElement>('.pc')!;
        if (a === sc.carrier) { pc.textContent = ''; continue; }
        if (sc.isOffside(a)) { pc.textContent = ' impedido'; pc.style.color = '#f2b640'; continue; }
        const p = sc.passP(a), pa = sc.passP(a, true), alto = pa > p + .08, v = alto ? pa : p;
        pc.textContent = ` ${Math.round(v * 100)}%${alto ? '↑' : ''}`; pc.style.color = probColor(v);
      }
      tags.sort((p, q) => p.y - q.y);
      for (let i = 1; i < tags.length; i++) for (let j = 0; j < i; j++)
        if (Math.abs(tags[i].x - tags[j].x) < 110 && tags[i].y - tags[j].y < 30) tags[i].y = tags[j].y + 30;
      for (const t of tags) { t.el.style.left = `${t.x}px`; t.el.style.top = `${t.y}px`; }
      actsEl.textContent = pen ? 'Cobrança' : fk ? `Cobrador: ${sc.carrier.e!.name}` : `${sc.actions} ações`;
      frames.push({ ball: ballM.position.clone(), actors: [...sc.mates, ...sc.foes].map(a => { const pm = meshes.get(a.id)!; return [a.id, pm.root.position.x, pm.root.position.z, pm.body.rotation.y, ...JOINTS(pm).flatMap(j => [j.rotation.x, j.rotation.z]), pm.core.position.x, pm.core.position.y]; }) });
      if (frames.length > 260) frames.shift();
      tickStadium(performance.now());
      tickNet(ballM.position);
      view.render(scene, camera);
    }
    // Replay: câmera lateral, perto do gol, em câmera lenta
    function playReplay() {
      const R = replay!, f = R.frames[Math.min(R.frames.length - 1, Math.floor(R.i))];
      R.i += .4;
      ballM.position.copy(f.ball);
      ballSh.position.set(f.ball.x, .016, f.ball.z);
      for (const row of f.actors) {
        const pm = meshes.get(row[0])!; pm.root.position.set(row[1], 0, row[2]); pm.body.rotation.y = row[3];
        JOINTS(pm).forEach((j, k) => { j.rotation.x = row[4 + k * 2]; j.rotation.z = row[5 + k * 2]; });
        pm.core.position.x = row[row.length - 2]; pm.core.position.y = row[row.length - 1];
      }
      for (const n of names.values()) n.style.display = 'none';
      ring.visible = false; fire.forEach(m => { m.visible = false; });
      const side = f.ball.x >= 0 ? 1 : -1;
      camera.fov = portrait ? 55 : 42; camera.updateProjectionMatrix();
      camera.position.set(side * (portrait ? 13 : 11), portrait ? 3 : 2.4, portrait ? 9 : 6.5);
      camera.lookAt(f.ball.x * .5, .9, Math.max(-1, f.ball.z * .6));
      // No replay do gol a torcida pula
      tickStadium(performance.now(), R.res.goal);
      if (R.i < 1) resetNet();
      tickNet(ballM.position);
      view.render(scene, camera);
      if (R.i >= R.frames.length + 25) { replay = null; replayEl.classList.remove('on'); cleanup(R.res); }
    }
    // Toque em qualquer lugar durante o replay: pula
    ov.addEventListener('pointerdown', () => { if (!replay) return; const r = replay.res; replay = null; replayEl.classList.remove('on'); cleanup(r); }, true);
    haptic('leve');
    frame();
  });
}
