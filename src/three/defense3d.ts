// Lance de defesa em 3D: o rival ataca o seu gol e você comanda a zaga.
// Toque num defensor (nome embaixo dele) e escolha: Bote, Carrinho, Cortar o passe ou Fechar o chute.
// As linhas vermelhas mostram as opções do atacante; com Antecipação na zaga, a jogada dele fica marcada.
import * as THREE from 'three';
import { DEF_N, DefesaScene, type DActor, type DefOpcao, type DefPlano } from '../engine/defesa';
import { goleiroKit, kitDe } from '../engine/kits';
import type { Match, MomentRequest, MomentResult } from '../engine/match';
import { PS_BY_ID, parsePs } from '../engine/data/schema';
import { clamp } from '../engine/rng';
import { choiceHTML, openChoice, psChips } from '../ui/choice';
import { esc } from '../ui/dom';
import { endSound, haptic, sfx } from '../ui/sfx';
import { app } from '../ui/ctx';
import { ambienteDaPartida } from '../engine/clima';
import { headerPose, keeperReady, kickPose, pokePose, runPose, tacklePose } from './anim';
import { makeBall, makePlayer, restPose, type PlayerMesh } from './players';
import { createView } from './quality';
import { addLights, ambientScene, buildGoal, buildPitch, buildStadium, buildWeather, tickNet, tickStadium } from './stadium';

const V = (x: number, y: number, h = 0) => new THREE.Vector3(x - 34, h, y);
const DEF_PS = new Set(['desarme', 'interceptacao', 'antecipacao', 'contencao', 'bloqueio', 'imposicao-fisica', 'cabeceio']);

export function runDefense3D(M: Match, req: MomentRequest): Promise<MomentResult> {
  return new Promise(resolve => {
    const sc = new DefesaScene(M, req.taker!, req.creator);
    const ov = document.createElement('div');
    ov.className = 'moment m3d m3d-full';
    ov.innerHTML = `<div class="m3d-wrap" id="dWrap">
      <div class="m3d-top"><span class="mo-tag">${M.label}</span><b>Defenda com a zaga!</b><span class="acts" id="dActs"></span></div>
      <div class="m3d-help show" id="dHelp">O <b>${esc(M.B.name)}</b> ataca o seu gol. Toque num <b>defensor seu</b> (nome dourado) e escolha:
        <b>Bote</b> ou <b>Carrinho</b> contra o drible · <b>Cortar o passe</b> · <b>Fechar o chute</b>. As linhas vermelhas são as opções do atacante: leia a jogada.</div>
      <div class="m3d-label" id="dLabel"></div>
      <div class="k3-read" id="dRead" hidden></div>
      <div class="ps-flash" id="dFlash"></div>
      ${choiceHTML()}
    </div><div class="mo-msg" id="dMsg"></div>`;
    document.body.appendChild(ov);
    const $ = <T extends HTMLElement>(id: string) => ov.querySelector<T>('#' + id)!;
    const wrap = $('dWrap'), msg = $('dMsg'), help = $('dHelp'), acts = $('dActs'), read = $('dRead'), flashPs = $('dFlash'), labelEl = $('dLabel');
    const W = ov.clientWidth, H = ov.clientHeight, portrait = W / H < 1;
    const view = createView(W, H), renderer = view.renderer;
    wrap.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const amb = ambienteDaPartida(M, app.S.gramado);
    ambientScene(scene, amb.clima); addLights(scene, amb.clima);
    scene.add(buildPitch(amb), buildGoal(), buildStadium(amb));
    const weather = buildWeather(amb.clima);
    if (weather) scene.add(weather.obj);
    // Câmera atrás do seu gol, alta: dá para ver a linha da zaga inteira e o ataque chegando
    const camera = new THREE.PerspectiveCamera(portrait ? 58 : 44, W / H, .1, 500);
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    const camAlvo = (): [THREE.Vector3, THREE.Vector3] => {
      // Segue quem tem a bola (posição na tela, que anda suave), mais aberta no celular em pé
      const v = view3.get(sc.carrier.id) ?? sc.carrier, x = 34 + (v.x - 34) * (portrait ? .75 : .5);
      return portrait ? [V(x, v.y * .2 - 12, 16), V(34 + (v.x - 34) * .85, v.y * .7 + 2, 0)] : [V(x, v.y * .15 - 9, 11), V(x, v.y * .72 + 2, 0)];
    };
    const SCALE = portrait ? 1.22 : 1.08;

    const aKit = kitDe(M.A), bKit = kitDe(M.B), gk = goleiroKit(aKit, bKit, 0);
    const meshes = new Map<number, PlayerMesh>();
    const view3 = new Map<number, { x: number; y: number }>();
    for (const a of [...sc.def, ...sc.atk]) {
      const pm = makePlayer(a.team === 0 ? (a.gk ? gk : aKit) : bKit, a.num || 5, { gk: a.gk, facing: a.team === 0 ? 1 : -1, seed: a.id, P: a.e?.P });
      pm.root.scale.setScalar(SCALE); pm.root.position.copy(V(a.x, a.y)); scene.add(pm.root);
      meshes.set(a.id, pm); view3.set(a.id, { x: a.x, y: a.y });
    }
    const { ball: ballM, shadow: ballSh } = makeBall(); scene.add(ballM, ballSh);
    [camPos, camLook].forEach((v, i) => v.copy(camAlvo()[i]));
    // Nomes dos seus defensores (alvos de toque), com os estilos de defesa de cada um
    const names = new Map<number, HTMLButtonElement>();
    for (const d of sc.campo()) {
      const ps = (d.e?.P.ps ?? []).map(parsePs).filter(p => DEF_PS.has(p.id)).map(p => PS_BY_ID.get(p.id)?.icone ?? '').join('');
      const b = document.createElement('button');
      b.className = 'm3d-name def'; b.innerHTML = `<b>${d.e?.P.ovr ?? ''}</b> ${esc(d.e?.name ?? '')}${ps ? ` <i>${ps}</i>` : ''}`;
      b.addEventListener('click', e => { e.stopPropagation(); escolher(d); });
      wrap.appendChild(b); names.set(d.id, b);
    }
    const atkTag = document.createElement('div');
    atkTag.className = 'm3d-name atk'; wrap.appendChild(atkTag);
    // Linhas das opções do atacante (passe para cada companheiro e chute)
    const lines: THREE.Mesh[] = [];
    const lineMat = (strong: boolean) => new THREE.MeshBasicMaterial({ color: strong ? 0xff4d3d : 0xf06a5a, transparent: true, opacity: strong ? .9 : .32, depthTest: false });
    function drawLines() {
      for (const l of lines) { scene.remove(l); l.geometry.dispose(); }
      lines.length = 0;
      if (plano || fim) return;
      const c = sc.carrier, from = V(c.x, c.y, .1), it = sc.intencao;
      const add = (to: THREE.Vector3, strong: boolean) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(from, to), 1, strong ? .09 : .05, 5, false), lineMat(strong)); m.renderOrder = 9; scene.add(m); lines.push(m); };
      for (const a of sc.atk) if (a !== c) add(V(a.x, a.y, .1), sc.lida && it.a === 'passe' && it.para === a);
      if (c.y < 30) add(V(34 + (c.x - 34) * .15, 5.5, .1), sc.lida && it.a === 'chute');
      if (sc.lida && it.a === 'drible') add(V(it.x, it.y, .1), true);
      const who = sc.antecipador();
      read.hidden = !sc.lida;
      const resp = sc.lida ? sc.resposta() : undefined;
      if (sc.lida) read.innerHTML = `👁️ Antecipação${who?.e ? ` (${esc(who.e.name)})` : ''}: ele vai <b>${it.a === 'chute' ? 'chutar' : it.a === 'drible' ? 'driblar' : `passar para ${esc(it.para?.e?.name ?? 'o companheiro')}`}</b>${resp?.e ? ` · use <b>${esc(resp.e.name)}</b>: ${it.a === 'chute' ? 'Fechar o chute' : it.a === 'drible' ? 'Bote' : 'Cortar o passe'}` : ''}`;
      for (const [id, el] of names) el.classList.toggle('alvo', !!resp && resp.id === id);
    }

    let plano: { p: DefPlano; t0: number } | null = null, fim = false, menu = false;
    const acting = new Map<number, { k: DefPlano['def']['anim'] | 'kick' | 'head'; t0: number; t1: number }>();
    function flash(text: string, color: string, small = false) { msg.textContent = text; msg.style.color = color; msg.classList.toggle('small', small); msg.classList.remove('show'); void msg.offsetWidth; msg.classList.add('show'); }
    function escolher(d: DActor) {
      if (plano || fim || menu) return;
      const ops = sc.opcoes(d);
      if (!ops.length) { flash(d.batido ? 'Ele ficou para trás' : 'Longe da jogada', '#dddddd', true); return; }
      menu = true; help.classList.remove('show');
      const itens = ops.map(o => ({ ...o, nome: DEF_N[o.acao], dica: o.dica + (o.falta >= .1 ? ` Falta: ${Math.round(o.falta * 100)}%.` : '') }));
      openChoice(ov, `${d.e?.name ?? 'Defensor'}: o que fazer?`, itens, o => { menu = false; jogar(o); }, () => { menu = false; });
    }
    function jogar(o: DefOpcao) {
      const p = sc.jogar(o), now = performance.now(), c = sc.carrier;
      plano = { p, t0: now };
      drawLines();
      acting.set(o.d.id, { k: p.def.anim, t0: now + 80, t1: now + 80 + Math.max(700, p.dur) });
      if (p.intencao.a !== 'drible') acting.set(c.id, { k: p.intencao.alto && p.intencao.a === 'passe' ? 'kick' : 'kick', t0: now, t1: now + 520 });
      haptic('leve');
      if (p.ps.length) { flashPs.innerHTML = psChips(p.ps); flashPs.classList.remove('show'); void flashPs.offsetWidth; flashPs.classList.add('show'); }
    }
    function endPlano(p: DefPlano) {
      plano = null;
      p.commit();
      if (p.ok) { sfx.tackle(); haptic('forte'); }
      if (p.end) {
        fim = true;
        flash(p.end.text, p.end.color);
        if (p.end.goal) sfx.groan(); else endSound({ goal: false, res: { shot: p.end.res.shot } });
        drawLines();
        setTimeout(() => { cancelAnimationFrame(raf); view.dispose(); ov.remove(); resolve(p.end!.res); }, 1700);
        return;
      }
      flash(p.say, p.color);
      drawLines();
    }

    let raf = 0, last = performance.now();
    drawLines();
    function pose(a: DActor, pm: PlayerMesh, sp: number, now: number) {
      const ac = acting.get(a.id);
      if (ac && now >= ac.t0 && now < ac.t1) {
        const k = (now - ac.t0) / (ac.t1 - ac.t0);
        if (ac.k === 'carrinho') tacklePose(pm, Math.min(1, k * 1.5));
        else if (ac.k === 'bote' || ac.k === 'bloqueio') pokePose(pm, Math.min(1, k * 1.3));
        else if (ac.k === 'corte' && plano?.p.intencao.alto) headerPose(pm, k);
        else if (ac.k === 'kick' || ac.k === 'head') kickPose(pm, k, .6);
        else runPose(pm, now / 80, 1);
        return;
      }
      if (a.gk) { keeperReady(pm, now / 1000); return; }
      if (sp > .4) runPose(pm, now / 85 + a.id, Math.min(1, sp * .16)); else { restPose(pm); pm.armL.rotation.z = -.25; pm.armR.rotation.z = .25; }
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
      // Jogadores andam até o lugar (o defensor escolhido vai à bola durante a jogada)
      for (const a of [...sc.def, ...sc.atk]) {
        const pm = meshes.get(a.id)!, v = view3.get(a.id)!, px = v.x, py = v.y;
        const tx = plano && plano.p.def.d === a ? plano.p.def.x : a.tx, ty = plano && plano.p.def.d === a ? plano.p.def.y : a.ty;
        const k = plano && plano.p.def.d === a ? .16 : .09;
        v.x += (tx - v.x) * k; v.y += (ty - v.y) * k;
        const sp = Math.hypot(v.x - px, v.y - py) / Math.max(dt, .001);
        pm.root.position.set(v.x - 34, 0, v.y);
        const b = ballM.position, want = Math.atan2(-(b.x - (v.x - 34)), -(b.z - v.y));
        let d = want - pm.body.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); pm.body.rotation.y += d * .15;
        pose(a, pm, sp, now);
      }
      // Bola: segue o plano da jogada, ou fica no pé do portador
      let bx: number, by: number, bh: number;
      if (plano) {
        const keys = plano.p.ball, k = Math.min(1, (now - plano.t0 - 180) / plano.p.dur), f = Math.max(0, k) * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(f)), u = f - i;
        bx = keys[i].x + (keys[i + 1].x - keys[i].x) * u; by = keys[i].y + (keys[i + 1].y - keys[i].y) * u; bh = keys[i].h + (keys[i + 1].h - keys[i].h) * u + (keys.length === 2 && keys[1].h > 1.5 ? 2 * u * (1 - u) : 0);
        if (k >= 1) endPlano(plano.p);
      } else { const v = view3.get(sc.carrier.id)!, bb = sc.ballAt; bx = v.x + (bb.x - sc.carrier.x); by = v.y + (bb.y - sc.carrier.y); bh = 0; }
      ballM.position.copy(V(bx, by, .16 + bh)); ballSh.position.set(bx - 34, .016, by);
      ballM.rotation.x -= plano ? .3 : .02;
      const [tp, tl] = camAlvo();
      camPos.lerp(tp, 1 - Math.exp(-dt * 3)); camLook.lerp(tl, 1 - Math.exp(-dt * 3.4));
      camera.position.copy(camPos); camera.lookAt(camLook);
      weather?.tick(dt, camLook);
      // Nomes na tela (seus defensores clicáveis; o atacante com a bola marcado em vermelho)
      const tags: { el: HTMLElement; x: number; y: number }[] = [];
      for (const [id, el] of names) {
        const a = sc.def.find(x => x.id === id)!, v = view3.get(id)!, s = V(v.x, v.y, 2.3 * SCALE).project(camera);
        el.style.display = s.z < 1 && !fim ? 'block' : 'none';
        const x0 = (s.x + 1) / 2 * W, hw = el.offsetWidth / 2 + 4;
        el.classList.toggle('eL', x0 < hw); el.classList.toggle('eR', x0 > W - hw);
        tags.push({ el, x: clamp(x0, hw, W - hw), y: clamp((1 - s.y) / 2 * H, 76, H - 60) });
        el.classList.toggle('off', !!a.batido);
      }
      // Empurra os nomes para não ficarem um em cima do outro (senão um tapa o toque do outro)
      tags.sort((p, q) => p.y - q.y);
      for (let i = 1; i < tags.length; i++) for (let j = 0; j < i; j++)
        if (Math.abs(tags[i].x - tags[j].x) < 120 && tags[i].y - tags[j].y < 32) tags[i].y = tags[j].y + 32;
      for (const t of tags) { t.el.style.left = `${t.x}px`; t.el.style.top = `${t.y}px`; }
      const cv = view3.get(sc.carrier.id)!, cs = V(cv.x, cv.y, 2.4 * SCALE).project(camera);
      atkTag.textContent = `⚽ ${sc.carrier.e?.name ?? ''}`;
      const ahw = atkTag.offsetWidth / 2 + 4;
      atkTag.style.left = `${clamp((cs.x + 1) / 2 * W, ahw, W - ahw)}px`; atkTag.style.top = `${clamp((1 - cs.y) / 2 * H, 76, H - 16)}px`;
      atkTag.style.display = fim ? 'none' : 'block';
      labelEl.style.display = 'none';
      acts.textContent = `Rodada ${Math.min(3, 4 - sc.actions)}/3`;
      tickStadium(now, fim && !!plano);
      tickNet(ballM.position);
      view.render(scene, camera);
    }
    frame();
  });
}
