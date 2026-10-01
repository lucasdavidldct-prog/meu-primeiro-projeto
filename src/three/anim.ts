// Poses e animações dos jogadores 3D (corrida, chute, cabeçada, carrinho e as defesas do goleiro).
// Tudo trabalha no referencial do próprio jogador: -Z é a frente, +X é a direita dele.
// Convenções de giro: perna/braço com rotation.x > 0 vai para a frente; joelho/cotovelo com rotation.x < 0 dobra para trás.
import { HIP, restPose, type PlayerMesh } from './players';

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const ease = (k: number) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Sobe de 0 a 1 e volta a 0 (arco do pulo). */
const bump = (k: number) => Math.sin(Math.PI * clamp01(k));

/** Corrida: pernas e braços alternados; o joelho dobra quando a perna volta. `amp` 0 = parado, 1 = sprint. */
export function runPose(pm: PlayerMesh, t: number, amp: number): void {
  restPose(pm);
  const a = Math.min(1, amp), s = Math.sin(t), c = Math.cos(t);
  pm.legL.rotation.x = s * .75 * a; pm.legR.rotation.x = -s * .75 * a;
  pm.shinL.rotation.x = -Math.max(0, -s) * 1.1 * a - .05; pm.shinR.rotation.x = -Math.max(0, s) * 1.1 * a - .05;
  pm.armL.rotation.x = -s * .7 * a; pm.armR.rotation.x = s * .7 * a;
  pm.foreL.rotation.x = .3 + .9 * a; pm.foreR.rotation.x = .3 + .9 * a;
  pm.core.rotation.x = -.14 * a; // corpo inclinado para a frente
  pm.core.position.y = HIP + Math.abs(c) * .05 * a;
}

/** Chute com a perna direita: `k` de 0 a 1 (0–.45 preparo, .45–.6 batida, depois o acompanhamento). `forca` 0–1 exagera o gesto. */
export function kickPose(pm: PlayerMesh, k: number, forca = .6): void {
  restPose(pm);
  const f = .7 + .5 * forca;
  if (k < .45) {
    const u = ease(k / .45);
    pm.legR.rotation.x = -.95 * f * u; pm.shinR.rotation.x = -1.35 * u;
    pm.legL.rotation.x = .12 * u; pm.shinL.rotation.x = -.25 * u;
    pm.armL.rotation.z = -.12 - 1.05 * u; pm.armR.rotation.z = .12 + .55 * u; pm.armR.rotation.x = .5 * u;
    pm.core.rotation.x = .1 * u; pm.core.rotation.z = .12 * u;
  } else {
    const u = ease((k - .45) / .15), v = ease((k - .6) / .4);
    pm.legR.rotation.x = lerp(-.95 * f, 1.25 * f, u) - .35 * v; pm.shinR.rotation.x = lerp(-1.35, -.05, u) - .25 * v;
    pm.legL.rotation.x = .12; pm.shinL.rotation.x = -.25 - .1 * v;
    pm.armL.rotation.z = -1.17 + .6 * v; pm.armR.rotation.z = .67 - .3 * v; pm.armR.rotation.x = .5 - .8 * u;
    pm.core.rotation.x = lerp(.1, -.22 * f, u); pm.core.rotation.z = .12 - .2 * u;
    pm.core.position.y = HIP + .08 * u * (1 - v); // o corpo sobe na batida forte
  }
}

/** Cabeçada: impulsão, braços abertos, o tronco vai para trás e bate para a frente no alto do pulo. */
export function headerPose(pm: PlayerMesh, k: number): void {
  restPose(pm);
  const up = bump(k), crouch = k < .15 ? ease(k / .15) * (1 - ease(k / .15)) : 0;
  pm.core.position.y = HIP + up * .62 - crouch * .25;
  pm.legL.rotation.x = .35 * up; pm.shinL.rotation.x = -1 * up; pm.legR.rotation.x = -.2 * up; pm.shinR.rotation.x = -.6 * up;
  pm.armL.rotation.z = -.12 - 1.35 * up; pm.armR.rotation.z = .12 + 1.35 * up;
  pm.foreL.rotation.x = .6 * up; pm.foreR.rotation.x = .6 * up;
  // Tronco: arma para trás e bate na bola no alto do pulo
  pm.core.rotation.x = k < .5 ? .38 * ease(k / .5) : lerp(.38, -.55, ease((k - .5) / .2));
}

/** Carrinho: o corpo desce e desliza de lado, perna da frente esticada. */
export function tacklePose(pm: PlayerMesh, k: number): void {
  restPose(pm);
  const u = ease(k / .4);
  pm.core.position.y = HIP - .62 * u; pm.core.rotation.x = .75 * u; pm.core.rotation.z = -.35 * u;
  pm.legR.rotation.x = 1.35 * u; pm.shinR.rotation.x = 0;
  pm.legL.rotation.x = .35 * u; pm.shinL.rotation.x = -1.5 * u;
  pm.armL.rotation.z = -.12 - 1 * u; pm.armR.rotation.z = .12 + .4 * u; pm.armR.rotation.x = -.6 * u;
}

/** Bote em pé (desarme): passo à frente com a perna esticada para cutucar a bola. */
export function pokePose(pm: PlayerMesh, k: number): void {
  restPose(pm);
  const u = bump(k);
  pm.legR.rotation.x = 1.05 * u; pm.shinR.rotation.x = -.1; pm.legL.rotation.x = -.35 * u; pm.shinL.rotation.x = -.6 * u;
  pm.core.rotation.x = -.25 * u; pm.core.position.y = HIP - .12 * u;
  pm.armL.rotation.z = -.12 - .7 * u; pm.armR.rotation.z = .12 + .5 * u;
}

/** Goleiro pronto: agachado, joelhos dobrados, braços abertos à frente. `t` faz o balanço nos pés. */
export function keeperReady(pm: PlayerMesh, t = 0): void {
  restPose(pm);
  const b = Math.sin(t * 6) * .025;
  pm.core.position.y = HIP - .16 + b; pm.core.rotation.x = -.22;
  pm.legL.rotation.x = .5; pm.legR.rotation.x = .5; pm.legL.rotation.z = -.14; pm.legR.rotation.z = .14;
  pm.shinL.rotation.x = -.85; pm.shinR.rotation.x = -.85;
  pm.armL.rotation.set(.75, 0, -.55); pm.armR.rotation.set(.75, 0, .55);
  pm.foreL.rotation.x = .5; pm.foreR.rotation.x = .5;
}

/**
 * Mergulho do goleiro para o lado (`lado` = +1 direita dele, -1 esquerda). `alto` = voa até o ângulo, com os dois braços
 * esticados por cima da cabeça; baixo = cai rente à grama com a mão de baixo na bola. `k` 0–1 (.0–.2 impulsão, .2–.6 voo, depois a queda).
 */
export function keeperDive(pm: PlayerMesh, lado: 1 | -1, alto: boolean, k: number): void {
  restPose(pm);
  const push = ease(k / .2), fly = ease((k - .12) / .45), land = ease((k - .72) / .28);
  const ang = (alto ? 1.28 : 1.5) * fly;
  pm.core.rotation.z = -lado * ang;
  pm.core.rotation.x = -.15 * push;
  pm.core.position.x = lado * 2.1 * fly;
  pm.core.position.y = HIP - .2 * push * (1 - fly) + (alto ? .95 : .15) * bump(Math.min(1, k * 1.15)) - (alto ? .55 : .5) * land;
  // Braços: por cima da cabeça, na direção do voo (no referencial do corpo, "para cima")
  const reach = ease((k - .08) / .3);
  const near = lado > 0 ? pm.armR : pm.armL, far = lado > 0 ? pm.armL : pm.armR;
  near.rotation.set(-.1 * reach, 0, lado * lerp(.12, alto ? 2.95 : 2.75, reach));
  far.rotation.set(.1 * reach, 0, lado * lerp(-.12, alto ? 2.7 : 2.35, reach));
  pm.foreL.rotation.x = .05; pm.foreR.rotation.x = .05;
  // Pernas: a de impulsão estica, a outra dobra e acompanha
  const pushLeg = lado > 0 ? pm.legL : pm.legR, other = lado > 0 ? pm.legR : pm.legL;
  const pushShin = lado > 0 ? pm.shinL : pm.shinR, otherShin = lado > 0 ? pm.shinR : pm.shinL;
  pushLeg.rotation.z = lado * .35 * fly; pushShin.rotation.x = -.15;
  other.rotation.x = .55 * fly; other.rotation.z = lado * .2 * fly; otherShin.rotation.x = -1.1 * fly;
}

/**
 * Defesa no meio. `alto`: pula reto com os braços esticados (espalma por cima); baixo/meio: fecha o corpo,
 * junta as pernas e segura com as duas mãos na altura do peito.
 */
export function keeperCenter(pm: PlayerMesh, alto: boolean, k: number): void {
  restPose(pm);
  const u = ease(k / .3);
  if (alto) {
    const up = bump(Math.min(1, k * 1.2));
    pm.core.position.y = HIP + .75 * up - .15 * (1 - u);
    pm.armL.rotation.set(0, 0, lerp(-.12, -2.75, u)); pm.armR.rotation.set(0, 0, lerp(.12, 2.75, u));
    pm.foreL.rotation.x = .1; pm.foreR.rotation.x = .1;
    pm.legL.rotation.x = .3 * up; pm.shinL.rotation.x = -.8 * up; pm.shinR.rotation.x = -.3 * up;
    return;
  }
  // Bloqueio com o corpo: agacha, joelhos juntos, braços para a frente e mãos juntas na frente do peito
  pm.core.position.y = HIP - .28 * u; pm.core.rotation.x = -.35 * u;
  pm.legL.rotation.set(.75 * u, 0, .08 * u); pm.legR.rotation.set(.75 * u, 0, -.08 * u);
  pm.shinL.rotation.x = -1.35 * u; pm.shinR.rotation.x = -1.35 * u;
  pm.armL.rotation.set(1.25 * u, 0, lerp(-.12, .22, u)); pm.armR.rotation.set(1.25 * u, 0, lerp(.12, -.22, u));
  pm.foreL.rotation.x = .9 * u; pm.foreR.rotation.x = .9 * u;
}

/** Defesa com o pé (meio, depois de pular para o lado errado): a perna estica para trás no meio do voo. */
export function keeperFootSave(pm: PlayerMesh, lado: 1 | -1, k: number): void {
  keeperDive(pm, lado, false, Math.min(k, .5));
  const leg = lado > 0 ? pm.legL : pm.legR, shin = lado > 0 ? pm.shinL : pm.shinR, u = ease((k - .2) / .3);
  leg.rotation.z = -lado * .9 * u; shin.rotation.x = 0;
}

/** Comemoração simples: braços para cima e pulinhos. */
export function celebratePose(pm: PlayerMesh, t: number): void {
  restPose(pm);
  pm.core.position.y = HIP + Math.abs(Math.sin(t * 7)) * .18;
  pm.armL.rotation.z = -2.6; pm.armR.rotation.z = 2.6;
}
