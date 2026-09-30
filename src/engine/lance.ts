// Modelo dos lances jogáveis, independente da interface (usado pelo lance 2D e, depois, pelo 3D).
// Coordenadas do campo em metros: x de 0 a 68 (largura), y = distância da linha de fundo (gol em y = 0).
import { FX, psLevel } from './playstyles';
import { clamp } from './rng';
import type { BasePlayer } from './types';

export const GOAL = { left: 30.34, right: 37.66, center: 34, half: 3.66 };

export interface AttackMods {
  passRadius: number; longPass: number; dribbleLoss: number; dribbleReach: number;
  shotMiss: number; shotDist: number; curve: number; fkSpread: number; fkSkill: number;
}
export function attackMods(P: BasePlayer): AttackMods {
  return {
    passRadius: FX.passeRaio[psLevel(P, 'passe-preciso')],
    longPass: FX.passeLongo[psLevel(P, 'passe-em-profundidade')],
    dribbleLoss: FX.dribleMarcador[psLevel(P, 'drible-rapido')] * (psLevel(P, 'primeiro-toque') ? .93 : 1),
    dribbleReach: FX.dribleAlcance[psLevel(P, 'velocista')],
    shotMiss: FX.chuteErro[psLevel(P, 'finalizacao-precisa')],
    shotDist: FX.chuteDistancia[psLevel(P, 'chute-de-longe')],
    curve: FX.curva[psLevel(P, 'cobranca-de-falta')],
    fkSpread: FX.faltaDispersao[psLevel(P, 'cobranca-de-falta')],
    fkSkill: psLevel(P, 'cobranca-de-falta'),
  };
}
export interface KeeperMods { save: number; penSave: number; claim: number }
export function keeperMods(P: BasePlayer | null | undefined): KeeperMods {
  return {
    save: FX.defesaGoleiro[psLevel(P, 'reflexos')],
    penSave: FX.defesaPenalti[psLevel(P, 'pegador-de-penalti')],
    claim: FX.saidaGol[psLevel(P, 'saida-do-gol')],
  };
}

// ---------- Gesto de chute ----------
export interface Pt { x: number; y: number; t?: number }
export interface Gesture { angle: number; power: number; curve: number }

/**
 * Lê um gesto de arrastar: a direção (do início ao fim) mira, o comprimento dá a força
 * e o quanto o traço se curva para um lado dá o efeito (-1 a 1, com o mesmo sinal usado em fkControl).
 * `fullLen` é o comprimento de gesto que corresponde à força máxima.
 */
export function analyzeGesture(pts: Pt[], fullLen: number): Gesture | null {
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  if (L < fullLen * .08) return null;
  // Desvio perpendicular com sinal (maior valor absoluto) em relação à corda
  let dev = 0;
  for (const p of pts) {
    const d = ((p.x - a.x) * dy - (p.y - a.y) * dx) / L;
    if (Math.abs(d) > Math.abs(dev)) dev = d;
  }
  // d > 0: o traço se afastou para o lado do vetor (dy, -dx) em relação à reta do gesto
  return { angle: Math.atan2(dy, dx), power: clamp(L / fullLen, 0, 1), curve: clamp((dev / L) / .22, -1, 1) };
}

// ---------- Falta ----------
export interface FkSetup { ball: Pt; wall: { x: number; y: number; half: number }; gkX: number }
export interface FkShot { targetX: number; power: number; curve: number }
export interface FkOdds { goal: number; wall: number; bar: number; wide: number; onTarget: number; save: number; endX: number; wallX: number }

/** Monta uma falta a uma distância e ângulo plausíveis, com barreira a 9,15 m. */
export function fkSetup(r: () => number): FkSetup {
  const y = 19 + r() * 8, x = 34 + (r() - .5) * 22;
  const d = Math.hypot(x - 34, y), k = 9.15 / d;
  const wall = { x: x + (34 - x) * k, y: y - y * k, half: 1.9 + (d < 23 ? .4 : 0) };
  return { ball: { x, y }, wall, gkX: 34 + (x - 34) * .12 };
}

/** Converte o gesto (em coordenadas do campo) no chute: ponto mirado na linha do gol, força e curva. */
export function fkShotFromGesture(setup: FkSetup, g: Gesture): FkShot | null {
  const dx = Math.cos(g.angle), dy = Math.sin(g.angle);
  if (dy >= -.15) return null; // precisa ir em direção ao gol
  const t = -setup.ball.y / dy;
  return { targetX: setup.ball.x + dx * t, power: g.power, curve: g.curve };
}

/**
 * Pontos de controle da trajetória: a bola termina no ponto mirado e faz a "barriga" para o mesmo lado
 * em que o traço do gesto se curvou (como no desenho). `reach` limita o efeito (Cobrança de Falta aumenta).
 */
export function fkControl(setup: FkSetup, shot: FkShot, reach: number): { c: Pt; end: Pt } {
  const end = { x: shot.targetX, y: 0 };
  const dx = end.x - setup.ball.x, dy = end.y - setup.ball.y, L = Math.hypot(dx, dy) || 1;
  const n = { x: dy / L, y: -dx / L };
  const bulge = shot.curve * reach * 4.5 * 2; // o ponto de controle fica ao dobro do desvio máximo
  return { c: { x: (setup.ball.x + end.x) / 2 + n.x * bulge, y: (setup.ball.y + end.y) / 2 + n.y * bulge }, end };
}
export function bezier(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
export function fkPath(setup: FkSetup, shot: FkShot, reach: number, n = 24): Pt[] {
  const { c, end } = fkControl(setup, shot, reach);
  return Array.from({ length: n + 1 }, (_, i) => bezier(setup.ball, c, end, i / n));
}

const phi = (z: number) => .5 * (1 + erf(z / Math.SQRT2));
function erf(x: number): number {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + .3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-a * a));
}

/** Probabilidades da cobrança (sem sorteio): usadas para mostrar a % e para resolver o lance. */
export function fkOdds(setup: FkSetup, shot: FkShot, taker: BasePlayer, gk: BasePlayer | null | undefined): FkOdds {
  const m = attackMods(taker), km = keeperMods(gk);
  const { c, end } = fkControl(setup, shot, m.curve);
  // Onde a bola passa na altura da barreira
  let wallX = setup.ball.x;
  for (let i = 0; i <= 40; i++) { const p = bezier(setup.ball, c, end, i / 40); if (p.y <= setup.wall.y) { wallX = p.x; break; } }
  const inWall = Math.abs(wallX - setup.wall.x) < setup.wall.half + .25;
  const over = clamp((shot.power - .42) / .3 + .08 * m.fkSkill, 0, .93);
  const wall = inWall ? 1 - over : 0;
  const bar = clamp((shot.power - .8) / .2, 0, 1) * (.85 - .15 * m.fkSkill);
  const sd = m.fkSpread * (.6 + .6 * shot.power);
  const onT = phi((GOAL.right - .15 - end.x) / sd) - phi((GOAL.left + .15 - end.x) / sd);
  const edge = Math.min(1, Math.abs(end.x - GOAL.center) / GOAL.half);
  const reach = Math.abs(end.x - setup.gkX) / GOAL.half;
  const save = clamp(.62 * km.save * (1 - .5 * edge) * (1 - .3 * Math.abs(shot.curve)) * (1.15 - .45 * shot.power) * clamp(1.2 - .35 * reach, .5, 1.2) - .05 * m.fkSkill, .05, .9);
  const pass = (1 - wall) * (1 - bar);
  return { goal: pass * onT * (1 - save), wall, bar, wide: pass * (1 - onT), onTarget: onT, save, endX: end.x, wallX };
}

export type FkResult = 'gol' | 'barreira' | 'travessao' | 'fora' | 'trave' | 'defesa';
export function fkResolve(o: FkOdds, r: () => number): FkResult {
  if (r() < o.wall) return 'barreira';
  if (r() < o.bar) return 'travessao';
  if (r() > o.onTarget) return Math.abs(o.endX - GOAL.center) < GOAL.half + .6 ? 'trave' : 'fora';
  return r() < o.save ? 'defesa' : 'gol';
}
