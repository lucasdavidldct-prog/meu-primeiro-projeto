// Lance de goleiro em 3D: câmera afastada atrás do gol; o batedor ajeita a bola e ESPERA você escolher.
// Arraste para a esquerda = alto no canto esquerdo · para a direita = alto no canto direito · um toque = meio.
// Acertou o lado, o goleiro defende (mergulho com as mãos, pulo, ou bloqueio com o corpo no meio).
import * as THREE from 'three';
import { CANTO_N, cantoDoGesto, keeperResolve, pickCanto, pistaCanto, tempoEscolha, type Canto, type KeeperRes } from '../engine/keeper';
import { goleiroKit, kitDe } from '../engine/kits';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { psLevel } from '../engine/playstyles';
import { R, clamp } from '../engine/rng';
import { esc } from '../ui/dom';
import { haptic, sfx } from '../ui/sfx';
import { celebratePose, keeperCenter, keeperDive, keeperFootSave, keeperReady, kickPose, runPose } from './anim';
import { makeBall, makePlayer, restPose } from './players';
import { createView } from './quality';
import { addLights, ambientScene, buildGoal, buildPitch, buildStadium, buildWeather, resetNet, tickNet, tickStadium } from './stadium';
import { ambienteDaPartida } from '../engine/clima';
import { app } from '../ui/ctx';

const V = (x: number, y: number, h = 0) => new THREE.Vector3(x - 34, h, y);
/** Ponto de chegada de cada canto na linha do gol (a tela esquerda é o +X do mundo, vista de trás do gol). */
const ALVO: Record<Canto, { x: number; h: number }> = { 0: { x: 34 + 2.95, h: 1.95 }, 1: { x: 34, h: 1.05 }, 2: { x: 34 - 2.95, h: 1.95 } };
/** Lado do mergulho no referencial do goleiro (ele olha para o batedor, então a direita dele é a direita da tela). */
const LADO: Record<Canto, 1 | -1> = { 0: -1, 1: 1, 2: 1 };

export function runKeeper3D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const pen = !!req.pen, shooterE = req.taker!, shooter = shooterE.P;
    const gkE = M.A.xi.find(e => e.pos === 'GOL' && !e.red), gk = gkE?.P;
    const shot = pickCanto(shooter, pen, R), tell = pistaCanto(shot, shooter, R, gk, pen);
    const pegador = psLevel(gk, 'pegador-de-penalti'), reflexos = psLevel(gk, 'reflexos'), saida = psLevel(gk, 'saida-do-gol');
    const LIMITE = tempoEscolha(gk, pen);
    const estilos = [pegador ? `🥅 Pegador de Pênalti${pegador > 1 ? '+' : ''}: ${pen ? 'lê melhor o batedor e tem mais tempo' : 'lê melhor o batedor'}` : '',
      reflexos ? `🧤 Reflexos${reflexos > 1 ? '+' : ''}: salva com o pé o chute no meio` : '', saida && !pen ? `🏃 Saída do Gol${saida > 1 ? '+' : ''}: fecha o ângulo (o batedor erra mais)` : ''].filter(Boolean);
    const ov = document.createElement('div');
    ov.className = 'moment m3d m3d-full';
    ov.innerHTML = `<div class="m3d-wrap" id="kWrap">
      <canvas class="m3d-trail" id="kTrail"></canvas>
      <div class="m3d-top"><span class="mo-tag">${M.label}</span><b>${pen ? 'Pênalti contra!' : 'Defenda!'}</b><span class="acts">${esc(shooterE.name)} vai chutar</span></div>
      <div class="m3d-help show" id="kHelp">Você é o goleiro${gkE ? ` (<b>${esc(gkE.name)}</b>)` : ''}. Ele só chuta em 3 lugares:<br>
        <b>arraste para a esquerda</b> = alto no canto esquerdo · <b>para a direita</b> = alto no canto direito · <b>um toque</b> = meio.<br>Acertou o lado, você defende. Olhe o corpo do batedor.</div>
      <div class="k3-timer" id="kTimer"><i></i></div>
      <div class="k3-zones" aria-hidden="true"><span>⬉ alto esq.</span><span>● meio</span><span>alto dir. ⬈</span></div>
      ${estilos.length ? `<div class="ps-hud">${estilos.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      ${pegador ? `<div class="k3-read" id="kRead">🥅 Leitura: ele deve bater <b>${CANTO_N[tell]}</b></div>` : ''}
    </div><div class="mo-msg" id="kMsg"></div>`;
    document.body.appendChild(ov);
    const $ = <T extends HTMLElement>(id: string) => ov.querySelector<T>('#' + id)!;
    const wrap = $('kWrap'), msg = $('kMsg'), help = $('kHelp'), timerEl = $('kTimer'), timerBar = timerEl.querySelector('i')!;
    const W = ov.clientWidth, H = ov.clientHeight, portrait = W / H < 1;
    const trail = $<HTMLCanvasElement>('kTrail'), tctx = trail.getContext('2d')!, dpr = Math.min(window.devicePixelRatio || 1, 2);
    trail.width = W * dpr; trail.height = H * dpr; tctx.scale(dpr, dpr);
    const view = createView(W, H), renderer = view.renderer;
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const amb = ambienteDaPartida(M, app.S.gramado);
    ambientScene(scene, amb.clima);
    addLights(scene, amb.clima);
    const weather = buildWeather(amb.clima);
    if (weather) scene.add(weather.obj);
    const goal = buildGoal();
    // Câmera atrás do gol: a rede fica na frente, então aqui ela é quase transparente
    goal.traverse(o => { const l = o as THREE.LineSegments; if (l.isLineSegments) (l.material as THREE.LineBasicMaterial).opacity = .1; });
    scene.add(buildPitch(amb), goal, buildStadium(amb));
    // Câmera afastada e mais alta: dá para ver o goleiro inteiro, o gol todo e a corrida do batedor
    const camera = new THREE.PerspectiveCamera(portrait ? 58 : 44, W / H, .1, 400);
    const camPos = portrait ? V(34, -11.5, 4.6) : V(34, -10, 3.8), camLook = V(34, 9, .9);
    camera.position.copy(camPos); camera.lookAt(camLook);

    const kA = kitDe(M.A), kit = kitDe(M.B);
    const gkMesh = makePlayer(goleiroKit(kA, kit), (gk as { num?: number } | undefined)?.num ?? 1, { gk: true, facing: 1, seed: 3, P: gk });
    gkMesh.root.position.copy(V(34, .5));
    const sh = makePlayer(kit, (shooter as { num?: number }).num ?? 9, { facing: -1, seed: 7, P: shooter });
    const sx = pen ? 34 : clamp(34 + (R() - .5) * 16, 22, 46), sy = pen ? 11 : 15 + R() * 6;
    // A pista: o corpo aberto para o canto "anunciado" (nem sempre verdadeiro) e a corrida vem do outro lado
    const tellDir = tell === 0 ? 1 : tell === 2 ? -1 : 0;
    const start = { x: sx - tellDir * 2.2 - .9, y: sy + 3.4 };
    sh.root.position.copy(V(start.x, start.y));
    const { ball, shadow } = makeBall();
    const b0 = V(sx, sy - .5, .16);
    ball.position.copy(b0); shadow.position.set(b0.x, .016, b0.z);
    scene.add(gkMesh.root, sh.root, ball, shadow);

    // ---------- Escolha ----------
    let dive: Canto | null = null, fase: 'espera' | 'corrida' | 'voo' | 'fim' = 'espera';
    // O tempo só começa a contar quando o 3D já está na tela (celular lento não perde a escolha carregando)
    let t0 = 0;
    let tCorrida = 0, desfecho: KeeperRes | null = null;
    const RUN = 850, KICK = 360, FLY = pen ? 520 : 600;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    let p0: { x: number; y: number } | null = null, pts: { x: number; y: number }[] = [];
    const drawTrail = (a = 1) => {
      tctx.clearRect(0, 0, W, H);
      if (pts.length < 2) return;
      tctx.lineCap = 'round'; tctx.lineJoin = 'round';
      for (const [w, c] of [[14, `rgba(158,201,236,${.3 * a})`], [5, `rgba(255,255,255,${.95 * a})`]] as const) {
        tctx.lineWidth = w; tctx.strokeStyle = c; tctx.beginPath(); pts.forEach((p, i) => (i ? tctx.lineTo(p.x, p.y) : tctx.moveTo(p.x, p.y))); tctx.stroke();
      }
    };
    const escolher = (c: Canto) => {
      if (dive !== null || fase !== 'espera') return;
      dive = c; haptic('leve');
      help.classList.remove('show'); timerEl.classList.add('ok');
      flash(c === 1 ? 'Fica no meio!' : c === 0 ? '⬉ Alto esquerdo' : 'Alto direito ⬈', '#9ec9ec', true);
      correr();
    };
    el.addEventListener('pointerdown', e => { if (dive !== null) return; el.setPointerCapture(e.pointerId); p0 = { x: e.clientX, y: e.clientY }; pts = [p0]; });
    el.addEventListener('pointermove', e => { if (!p0) return; pts.push({ x: e.clientX, y: e.clientY }); drawTrail(); });
    el.addEventListener('pointerup', e => {
      if (!p0) return;
      const c = cantoDoGesto(e.clientX - p0.x, e.clientY - p0.y);
      p0 = null;
      let a = 1; const fade = () => { a -= .1; if (a <= 0) { tctx.clearRect(0, 0, W, H); return; } drawTrail(a); requestAnimationFrame(fade); }; fade();
      escolher(c);
    });
    function correr() { if (fase !== 'espera') return; fase = 'corrida'; tCorrida = performance.now(); timerEl.classList.add('ok'); }

    function flash(text: string, color: string, small = false) {
      msg.textContent = text; msg.style.color = color; msg.classList.toggle('small', small);
      msg.classList.remove('show'); void msg.offsetWidth; msg.classList.add('show');
    }
    let fimT = 0;
    function finish(r: KeeperRes) {
      fase = 'fim'; fimT = performance.now();
      const nm = gkE ? gkE.name : 'o goleiro';
      if (r === 'gol') { sfx.groan(); flash('GOL…', '#f06a5a'); }
      else { sfx.ooh(); haptic('forte'); flash(r === 'fora' ? 'PRA FORA!' : r === 'pe' ? 'DEFENDEU COM O PÉ!' : 'DEFENDEU!', r === 'fora' ? '#f2b640' : '#9ec9ec'); }
      const text = r === 'fora' ? `${shooterE.name} chutou para fora` : r === 'pe' ? `${nm} salvou com o pé (Reflexos)` : `${nm} defendeu`;
      setTimeout(() => { cancelAnimationFrame(raf); view.dispose(); ov.remove(); resolve(r === 'gol' ? { goal: true, shot: true, onTarget: true } : { goal: false, shot: true, onTarget: r !== 'fora', text }); }, 1700);
    }

    // Onde a bola termina (no canto escolhido pelo batedor, ou para fora dele se errar)
    const alvo = { ...ALVO[shot] };
    alvo.x += (R() - .5) * .5; alvo.h += (R() - .5) * .25;
    const foraX = shot === 1 ? 34 + (R() < .5 ? 1 : -1) * 4.4 : shot === 0 ? 34 + 4.3 : 34 - 4.3, foraH = shot === 1 ? 2.9 : 2.2;
    resetNet();

    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      if (!t0) t0 = now + 400;
      const t = Math.max(0, now - t0);
      // ---------- Espera: o batedor ajeita a bola, o goleiro balança nas pernas ----------
      if (fase === 'espera') {
        const left = Math.max(0, 1 - t / LIMITE);
        timerBar.style.width = `${left * 100}%`;
        if (left <= 0) { flash('Ficou no meio', '#dddddd', true); dive = 1; correr(); }
        restPose(sh); sh.body.rotation.y = -tellDir * .35 + Math.sin(t / 900) * .04;
        sh.core.rotation.x = -.08; sh.armL.rotation.z = -.35; sh.armR.rotation.z = .35;
        keeperReady(gkMesh, t / 1000);
      }
      // ---------- Corrida e chute ----------
      const tc = fase === 'espera' ? -1 : now - tCorrida;
      if (tc >= 0 && tc < RUN) {
        const k = tc / RUN;
        sh.root.position.copy(V(start.x + (sx - .35 - start.x) * k, start.y + (sy - start.y) * k));
        sh.body.rotation.y = -tellDir * .35 * (1 - k) + Math.atan2(-(sx - start.x), -(sy - start.y)) * .3;
        runPose(sh, tc / 75, .9);
        keeperReady(gkMesh, tc / 1000);
      } else if (tc >= RUN) {
        const kk = Math.min(1, (tc - RUN) / KICK);
        sh.body.rotation.y = shot === 0 ? .3 : shot === 2 ? -.3 : 0;
        kickPose(sh, kk, .75);
        if (kk > .5 && fase === 'corrida') { fase = 'voo'; sfx.kick(.8); }
      }
      // ---------- Voo da bola e defesa ----------
      const tv = tc - RUN - KICK * .5;
      if (tv >= 0) {
        const f = Math.min(1, tv / FLY);
        if (desfecho === null) desfecho = keeperResolve(shot, dive, gk, shooter, pen, R);
        const miss = desfecho === 'fora', ex = miss ? foraX : alvo.x, eh = miss ? foraH : alvo.h;
        if (f < 1) {
          const bx = sx + (ex - sx) * f, by = (sy - .5) * (1 - f), bh = .16 + (eh - .16) * f + .35 * 4 * f * (1 - f);
          ball.position.copy(V(bx, by, bh)); shadow.position.set(bx - 34, .016, by);
          ball.rotation.x -= .45;
        } else {
          // Depois da chegada: espalmada para fora, rebote no pé, rede (gol) ou fora
          const tt = Math.min(1, (tv - FLY) / 650), side = ex > 34 ? 1 : -1;
          if (desfecho === 'defesa' || desfecho === 'pe') {
            const up = shot === 1 && desfecho === 'defesa' ? 0 : 1;
            ball.position.copy(V(ex + side * 3.5 * tt * up, 1.2 + 6 * tt * (shot === 1 ? .15 : 1), Math.max(.16, eh + (shot === 1 ? -.8 * tt : 1.2 * tt - 2.2 * tt * tt))));
          } else if (desfecho === 'gol') ball.position.copy(V(ex, -1.7 * tt, Math.max(.16, eh * (1 - tt * .5))));
          else ball.position.copy(V(ex + side * 2 * tt, -3 * tt, eh + .6 * tt));
          shadow.position.set(ball.position.x, .016, ball.position.z);
          if (fase === 'voo') finish(desfecho);
        }
        // Goleiro: reage na batida; a animação chega no ponto alto quando a bola chega
        const k = clamp((tv + 60) / (FLY / .55), 0, 1);
        const d = dive ?? 1;
        if (desfecho === 'pe') keeperFootSave(gkMesh, LADO[d], k);
        else if (d === 1) keeperCenter(gkMesh, false, k);
        else keeperDive(gkMesh, LADO[d], true, k);
        // Encaixe no meio: a bola vai junto com o goleiro
        if (d === 1 && shot === 1 && desfecho === 'defesa' && f >= 1) ball.position.copy(V(34, .9, 1.2));
      }
      if (fase === 'fim' && desfecho === 'gol' && now - fimT > 300) celebratePose(sh, now / 1000);
      tickStadium(now, desfecho === 'gol' && fase === 'fim');
      tickNet(ball.position);
      weather?.tick(1 / 60, camLook);
      view.render(scene, camera);
    }
    frame();
  });
}
