// Jogadores low-poly com cara de gente: altura e porte pelo jogador (posição, físico), tom de pele e cabelo próprios
// (alguns craques têm o visual marcante), camisa com o desenho do uniforme, nome e número nas costas. E a bola de gomos.
import * as THREE from 'three';
import type { Kit } from '../engine/kits';
import type { BasePlayer } from '../engine/types';
import { quality } from './qualityLevel';
import { blobShadow } from './stadium';

const SKIN = [0xf3d0b0, 0xe0ac84, 0xb97c52, 0x8a5634, 0x5e3a22, 0x44291a];
const HAIR = { preto: 0x120c08, castanho: 0x3b2616, escuro: 0x23170e, ruivo: 0x8a3f1c, loiro: 0xd9b36a, platinado: 0xe9dfc8 };
type Cabelo = 'curto' | 'raspado' | 'careca' | 'afro' | 'comprido' | 'coque' | 'moicano' | 'cacheado';
export interface Look { h: number; w: number; skin: number; cab: Cabelo; hairC: number; barba: boolean; faixa: boolean }

/** Visual marcante de alguns craques (estilizado, sem copiar arte de ninguém). */
const FAMOSOS: Record<string, Partial<Look>> = {
  'ronaldinho': { cab: 'comprido', faixa: true, skin: 3, hairC: HAIR.preto },
  'ronaldo': { cab: 'raspado', skin: 2 },
  'zidane': { cab: 'careca', skin: 1 },
  'roberto carlos': { cab: 'careca', skin: 3 },
  'haaland': { cab: 'coque', skin: 0, hairC: HAIR.loiro },
  'pele': { cab: 'curto', skin: 4 },
  'maradona': { cab: 'cacheado', skin: 1, hairC: HAIR.preto },
  'valderrama': { cab: 'afro', skin: 2, hairC: HAIR.loiro },
  'ibrahimovic': { cab: 'coque', skin: 1, barba: true },
  'reinaldo': { cab: 'afro', skin: 3 },
  'hulk': { cab: 'raspado', skin: 2 },
  'mbappe': { cab: 'raspado', skin: 3 },
  'messi': { cab: 'curto', skin: 1, barba: true },
  'cristiano ronaldo': { cab: 'curto', skin: 1 },
  'socrates': { cab: 'cacheado', skin: 2, barba: true },
  'gullit': { cab: 'comprido', skin: 4 },
  'puyol': { cab: 'cacheado', skin: 1, hairC: HAIR.castanho },
  'marcelo': { cab: 'afro', skin: 3 },
  'david luiz': { cab: 'afro', skin: 2, hairC: HAIR.castanho },
  'pirlo': { cab: 'comprido', skin: 1, barba: true },
  'beckham': { cab: 'curto', skin: 0, hairC: HAIR.loiro },
  'neymar': { cab: 'curto', skin: 2, hairC: HAIR.loiro },
  'vini jr': { cab: 'curto', skin: 4 },
  'romario': { cab: 'raspado', skin: 3 },
  'ronaldo nazario': { cab: 'raspado', skin: 2 },
  'cafu': { cab: 'careca', skin: 4 },
  'hulk paraibano': { cab: 'raspado', skin: 2 },
};

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.]/g, '').trim();

/** Aparência do jogador: sempre a mesma para o mesmo jogador. */
export function lookOf(P: BasePlayer | undefined, seed: number): Look {
  const h0 = hash(P?.id ?? String(seed)), r = (k: number) => ((h0 >>> k) & 255) / 255;
  const pos = P?.pos ?? 'MC', fis = P?.st?.[5] ?? 70;
  const alt = pos === 'GOL' ? .09 : pos === 'ZAG' ? .07 : pos === 'ATA' ? .02 : pos === 'VOL' ? .02 : pos === 'MEI' || pos === 'PD' || pos === 'PE' ? -.03 : 0;
  const gk = pos === 'GOL';
  const h = Math.max(1.66, Math.min(1.97, 1.80 + alt + (gk ? 0 : (fis - 72) * .0025) + (r(0) - .5) * .09));
  const w = Math.max(.9, Math.min(1.14, 1 + (fis - 72) * .005 + (r(8) - .5) * .06));
  const cabs: Cabelo[] = ['curto', 'curto', 'curto', 'raspado', 'raspado', 'careca', 'afro', 'comprido', 'coque', 'moicano', 'cacheado', 'cacheado'];
  const cores = [HAIR.preto, HAIR.preto, HAIR.escuro, HAIR.castanho, HAIR.castanho, HAIR.loiro, HAIR.ruivo, HAIR.platinado];
  const base: Look = { h, w, skin: Math.floor(r(16) * SKIN.length) % SKIN.length, cab: cabs[Math.floor(r(24) * cabs.length) % cabs.length], hairC: cores[h0 % cores.length], barba: (h0 & 7) === 3, faixa: false };
  const f = P ? FAMOSOS[norm(P.short)] ?? FAMOSOS[norm(P.name)] : undefined;
  return f ? { ...base, ...f } : base;
}

// ---------- Texturas da camisa e do número ----------
const texCache = new Map<string, THREE.Texture>();
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

/** Camisa desenhada em volta do tronco: u = volta (0 = costas), v = altura (0 = barra). */
function shirtTexture(k: Kit): THREE.Texture {
  const key = [k.s, k.t, k.p].join('|');
  const hit = texCache.get(key);
  if (hit) return hit;
  const W = 256, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = k.s; x.fillRect(0, 0, W, H);
  x.fillStyle = k.t;
  if (k.p === 'listras') for (let i = 0; i < 10; i++) x.fillRect(i * W / 10 + W / 40, 0, W / 20, H);
  else if (k.p === 'aros') for (let i = 0; i < 5; i++) x.fillRect(0, i * H / 5 + H / 10, W, H / 10);
  else if (k.p === 'faixa') { x.fillRect(0, H * .26, W, H * .16); x.globalAlpha = .6; x.fillRect(0, H * .45, W, H * .03); x.globalAlpha = 1; }
  else if (k.p === 'metade') x.fillRect(0, 0, W / 2, H);
  else if (k.p === 'diagonal') {
    // Faixa em diagonal só na frente (u de .25 a .75 é a frente)
    x.beginPath(); x.moveTo(W * .3, 0); x.lineTo(W * .42, 0); x.lineTo(W * .72, H); x.lineTo(W * .6, H); x.closePath(); x.fill();
  } else {
    // Lisa: vivos laterais no detalhe
    for (const u of [.25, .75]) x.fillRect(u * W - 3, 0, 6, H);
  }
  // Gola em V na frente e barra
  x.fillStyle = k.t; x.beginPath(); x.moveTo(W * .44, 0); x.lineTo(W * .5, H * .14); x.lineTo(W * .56, 0); x.closePath(); x.fill();
  // Trama do tecido
  x.globalAlpha = .06; x.fillStyle = '#000';
  for (let i = 0; i < H; i += 3) x.fillRect(0, i, W, 1);
  x.globalAlpha = 1;
  const t = tex(c);
  texCache.set(key, t);
  return t;
}

const lumHex = (hex: string) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return .299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255); };
/** Número (e nome, nas costas) com contorno para ler em cima de listras. */
function backTexture(n: number, name: string, k: Kit): THREE.Texture {
  const key = `${n}|${name}|${k.s}|${k.t}|${k.p}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const x = c.getContext('2d')!;
  // Em camisa listrada o número vai numa placa lisa
  const listrada = k.p === 'listras' || k.p === 'aros' || k.p === 'metade';
  const fg = listrada ? (lumHex(k.s) < 128 ? '#f4f4f4' : '#111111') : k.t;
  const bg = listrada ? (lumHex(k.s) < 128 ? '#111111' : '#f4f4f4') : null;
  if (bg) { x.fillStyle = bg; x.globalAlpha = .92; x.beginPath(); x.roundRect(14, 30, 100, 118, 14); x.fill(); x.globalAlpha = 1; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = fg;
  x.lineWidth = 4; x.strokeStyle = lumHex(fg) > 128 ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.35)';
  if (name) { x.font = '800 22px "Saira Extra Condensed", Impact, sans-serif'; x.fillText(name.toUpperCase().slice(0, 12), 64, 16); }
  x.font = '900 92px "Saira Extra Condensed", Impact, sans-serif';
  x.strokeText(String(n), 64, 94); x.fillText(String(n), 64, 94);
  const t = tex(c);
  texCache.set(key, t);
  return t;
}

export interface PlayerMesh {
  root: THREE.Group;
  /** Gira para onde o jogador olha (rotation.y). */
  body: THREE.Group;
  /** Pivô no quadril: inclina, pula e mergulha o corpo inteiro (goleiro, cabeçada, carrinho). */
  core: THREE.Group;
  /** Quadril (coxa) e joelho de cada perna. */
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  shinL: THREE.Object3D;
  shinR: THREE.Object3D;
  /** Ombro e cotovelo de cada braço. */
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  foreL: THREE.Object3D;
  foreR: THREE.Object3D;
  shadow: THREE.Mesh;
  ring?: THREE.Mesh;
}

/** Altura do quadril, onde fica o pivô do corpo. */
export const HIP = 1;

/** Cria um jogador olhando para -Z (em direção ao gol) ou +Z (defensores), com braços e pernas articulados. */
export function makePlayer(kit: Kit, num: number, opts: { gk?: boolean; facing?: 1 | -1; seed?: number; P?: BasePlayer } = {}): PlayerMesh {
  const q = quality(), seg = q === 'alta' ? 14 : q === 'media' ? 9 : 6;
  const root = new THREE.Group(), body = new THREE.Group(), core = new THREE.Group(), inner = new THREE.Group();
  // body (direção) → core (pivô no quadril) → inner (volta para a altura dos pés) → partes do corpo
  core.position.y = HIP; inner.position.y = -HIP;
  root.add(body); body.add(core); core.add(inner);
  const L = lookOf(opts.P, opts.seed ?? num);
  const mat = (c: string | number, rough = .75) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 });
  const shirtMap = shirtTexture(kit);
  const shirtM = new THREE.MeshStandardMaterial({ map: shirtMap, roughness: .6 });
  const plainM = mat(kit.s, .6), trimM = mat(kit.t, .6), shorts = mat(kit.sh, .7), sock = mat(kit.so ?? kit.s, .8), skin = mat(SKIN[L.skin], .55);
  const seed = hash(opts.P?.id ?? String(opts.seed ?? num));
  const boots = mat([0x101010, 0xf2f2f2, 0xe8c35f, 0x2a5bd7, 0xc93b30, 0x21c7a8, 0xff5a1f][seed % 7], .35);
  const glove = mat(0xf0f0f0, .5), gloveTrim = mat(kit.t, .5);
  const cap = (r: number, len: number, m: THREE.Material) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, seg), m);
  const leg = (x: number): [THREE.Group, THREE.Group] => {
    const pivot = new THREE.Group(); pivot.position.set(x, .86, 0);
    const thigh = cap(.088, .28, skin); thigh.position.y = -.22; pivot.add(thigh);
    // Perna do calção cobrindo a coxa de cima
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(.108, .12, .26, seg), shorts); sl.position.y = -.1; pivot.add(sl);
    // Joelho articulado: canela, meião e chuteira dobram juntos
    const knee = new THREE.Group(); knee.position.y = -.44; pivot.add(knee);
    const kc = cap(.074, .02, skin); knee.add(kc);
    const shin = cap(.072, .27, sock); shin.position.y = -.19; knee.add(shin);
    const calf = new THREE.Mesh(new THREE.SphereGeometry(.07, seg, seg / 2), sock); calf.position.set(0, -.12, .025); calf.scale.set(1, 1.5, 1); knee.add(calf);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.12, .08, .27), boots); boot.position.set(0, -.4, -.05); knee.add(boot);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(.062, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI / 2), boots); toe.position.set(0, -.44, -.17); toe.scale.set(1, .9, 1.1); knee.add(toe);
    inner.add(pivot);
    return [pivot, knee];
  };
  const [legL, shinL] = leg(-.11), [legR, shinR] = leg(.11);
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(.2, .215, .2, seg * 2), shorts); hip.position.y = .98; hip.scale.z = .72; inner.add(hip);
  // Tronco com a camisa desenhada (e peito arredondado alinhado à mesma textura)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.25, .2, .6, seg * 2), shirtM); torso.position.y = 1.32; torso.scale.z = .75; inner.add(torso);
  const uChest = kit.p === 'listras' || kit.p === 'metade';
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.25, seg * 2, seg / 2, Math.PI / 2, Math.PI * 2, 0, Math.PI / 2), uChest ? shirtM : plainM);
  chest.position.y = 1.6; chest.scale.set(1, .45, .75); inner.add(chest);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.075, .02, 6, seg), trimM); collar.rotation.x = Math.PI / 2; collar.position.y = 1.7; inner.add(collar);
  // Braços: ombro → braço (manga) → cotovelo → antebraço → mão (goleiro de manga comprida e luvas grandes)
  const arm = (x: number): [THREE.Group, THREE.Group] => {
    const sh = new THREE.Group(); sh.position.set(x * .98, 1.55, 0);
    const sleeve = cap(.072, .1, kit.p === 'metade' && x > 0 ? trimM : plainM); sleeve.position.y = -.05; sh.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(.068, .014, 5, seg), trimM); cuff.position.y = -.13; cuff.rotation.x = Math.PI / 2; sh.add(cuff);
    const up = cap(.052, .14, opts.gk ? plainM : skin); up.position.y = -.17; sh.add(up);
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
    const fore = cap(.047, .15, opts.gk ? plainM : skin); fore.position.y = -.11; el.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(opts.gk ? .082 : .05, 10, 8), opts.gk ? glove : skin); hand.position.y = -.25; hand.scale.set(1, 1.15, .7); el.add(hand);
    if (opts.gk) { const w = new THREE.Mesh(new THREE.TorusGeometry(.06, .016, 5, seg), gloveTrim); w.position.y = -.19; w.rotation.x = Math.PI / 2; el.add(w); }
    inner.add(sh);
    return [sh, el];
  };
  const [armL, foreL] = arm(-.31), [armR, foreR] = arm(.31);
  const neck = cap(.052, .06, skin); neck.position.y = 1.72; inner.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.13, seg + 4, seg), skin); head.position.y = 1.86; head.scale.set(.92, 1.08, 1); inner.add(head);
  // Rosto: olhos, sobrancelhas e orelhas (a frente é -Z)
  if (q !== 'leve') {
    const eyeM = mat(0x16100c, .4);
    for (const ex of [-.045, .045]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 4), eyeM); eye.position.set(ex, 1.885, -.118); inner.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(.04, .009, .01), mat(L.hairC, .9)); brow.position.set(ex, 1.915, -.12); inner.add(brow);
    }
    for (const ex of [-.122, .122]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(.028, 6, 4), skin); ear.position.set(ex, 1.87, 0); ear.scale.set(.5, 1, .8); inner.add(ear); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.018, .045, 6), skin); nose.position.set(0, 1.86, -.13); nose.rotation.x = -Math.PI / 2; inner.add(nose);
  }
  addHair(inner, L, seg, mat);
  // Nome e número nas costas, número pequeno no peito
  const nm = new THREE.MeshBasicMaterial({ map: backTexture(num, q === 'leve' ? '' : opts.P?.short ?? '', kit), transparent: true });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.34, .425), nm); back.position.set(0, 1.38, .193); inner.add(back);
  const fm = new THREE.MeshBasicMaterial({ map: backTexture(num, '', kit), transparent: true });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(.13, .16), fm); front.position.set(.1, 1.46, -.193); front.rotation.y = Math.PI; inner.add(front);
  body.rotation.y = opts.facing === 1 ? Math.PI : 0;
  // Altura e porte do jogador (a referência é 1,80 m)
  body.scale.set(L.w, L.h / 1.8, L.w);
  if (q !== 'leve') body.traverse(o => { if ((o as THREE.Mesh).isMesh && o !== back && o !== front) o.castShadow = true; });
  const shadow = blobShadow(.42 * L.w); root.add(shadow);
  const pm: PlayerMesh = { root, body, core, legL, legR, shinL, shinR, armL, armR, foreL, foreR, shadow };
  restPose(pm);
  return pm;
}

/** Postura parada: braços soltos ao lado do corpo, joelhos quase retos. */
export function restPose(pm: PlayerMesh): void {
  pm.core.position.set(0, HIP, 0); pm.core.rotation.set(0, 0, 0);
  pm.legL.rotation.set(0, 0, 0); pm.legR.rotation.set(0, 0, 0);
  pm.shinL.rotation.set(0, 0, 0); pm.shinR.rotation.set(0, 0, 0);
  pm.armL.rotation.set(0, 0, -.12); pm.armR.rotation.set(0, 0, .12);
  pm.foreL.rotation.set(.15, 0, 0); pm.foreR.rotation.set(.15, 0, 0);
}

function addHair(body: THREE.Group, L: Look, seg: number, mat: (c: string | number, r?: number) => THREE.MeshStandardMaterial): void {
  const hm = mat(L.hairC, .92);
  const add = (m: THREE.Mesh, x: number, y: number, z: number, s?: [number, number, number]) => { m.position.set(x, y, z); if (s) m.scale.set(...s); body.add(m); return m; };
  const capa = (ang: number, r = .137) => new THREE.Mesh(new THREE.SphereGeometry(r, seg + 4, seg / 2, 0, Math.PI * 2, 0, ang), hm);
  switch (L.cab) {
    case 'careca': break;
    case 'raspado': { const m = capa(Math.PI / 2.1, .133); m.material = mat(L.hairC, .98); (m.material as THREE.MeshStandardMaterial).transparent = true; (m.material as THREE.MeshStandardMaterial).opacity = .75; add(m, 0, 1.87, 0, [.95, 1.05, 1.02]); break; }
    case 'afro': add(new THREE.Mesh(new THREE.IcosahedronGeometry(.185, 2), hm), 0, 1.95, .02, [1.02, .88, 1]); break;
    case 'cacheado': { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.155, 1), mat(L.hairC, .95)); (m.material as THREE.MeshStandardMaterial).flatShading = true; add(m, 0, 1.92, .015, [1, .82, 1]); break; }
    case 'comprido': {
      add(capa(Math.PI / 1.8), 0, 1.88, 0, [.97, 1.05, 1.03]);
      const cauda = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .2, 4, seg), hm); add(cauda, 0, 1.73, .075, [1.25, 1, .55]);
      break;
    }
    case 'coque': add(capa(Math.PI / 2), 0, 1.88, 0, [.95, 1.05, 1.02]); add(new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), hm), 0, 1.99, .09); break;
    case 'moicano': add(new THREE.Mesh(new THREE.BoxGeometry(.05, .08, .26), hm), 0, 1.99, .01); add(capa(Math.PI / 2.4, .132), 0, 1.87, 0, [.94, 1.02, 1]); break;
    default: add(capa(Math.PI / 2), 0, 1.88, 0, [.95, 1.05, 1.02]);
  }
  if (L.faixa) { const f = new THREE.Mesh(new THREE.TorusGeometry(.135, .016, 6, seg + 4), mat(0xf4f4f4, .6)); f.rotation.x = Math.PI / 2 - .12; add(f, 0, 1.935, 0); }
  if (L.barba) add(new THREE.Mesh(new THREE.SphereGeometry(.105, seg, seg / 2, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.4), mat(L.hairC, .95)), 0, 1.85, -.012, [.92, 1.05, 1]);
}

/** Anel dourado aos pés de quem está com a bola. */
export function carrierRing(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.RingGeometry(.55, .7, 32), new THREE.MeshBasicMaterial({ color: 0xe8c35f, transparent: true, opacity: .85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .02;
  return m;
}

// ---------- Bola ----------
let ballTex: THREE.Texture | null = null;
/**
 * Bola de gomos desenhada na esfera de verdade: cada pixel acha o centro de gomo mais perto (12 pentágonos do
 * icosaedro e 20 hexágonos); pentágonos em azul-marinho com filete dourado, costuras finas entre os gomos.
 */
function ballTexture(): THREE.Texture {
  if (ballTex) return ballTex;
  const W = quality() === 'leve' ? 256 : 512, H = W / 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!, img = x.createImageData(W, H), d = img.data;
  const t = (1 + Math.sqrt(5)) / 2;
  const ico = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(k => k / l); });
  const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const hex = faces.map(f => { const v = [0, 1, 2].map(k => f.reduce((s, i) => s + ico[i][k], 0)); const l = Math.hypot(...v); return v.map(k => k / l); });
  const centers = [...ico.map(v => ({ v, p: true })), ...hex.map(v => ({ v, p: false }))];
  for (let j = 0; j < H; j++) {
    const lat = Math.PI * (j + .5) / H, sy = Math.cos(lat), sr = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = 2 * Math.PI * (i + .5) / W, px = -Math.cos(lon) * sr, pz = Math.sin(lon) * sr;
      let b1 = -2, b2 = -2, pent = false;
      for (const cc of centers) {
        const dot = px * cc.v[0] + sy * cc.v[1] + pz * cc.v[2];
        if (dot > b1) { b2 = b1; b1 = dot; pent = cc.p; } else if (dot > b2) b2 = dot;
      }
      const edge = b1 - b2; // perto de 0 = costura
      let r = 246, g = 246, b = 242;
      if (pent) {
        if (edge > .035) { r = 22; g = 36; b = 74; } else { r = 232; g = 195; b = 95; }
      } else if (edge < .05) { r = 214; g = 218; b = 222; }
      if (edge < .01) { r *= .55; g *= .55; b *= .55; }
      const k = (j * W + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  ballTex = tex(c);
  return ballTex;
}

export function makeBall(): { ball: THREE.Mesh; shadow: THREE.Mesh } {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.16, 40, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: .32, metalness: .02 }));
  ball.castShadow = quality() !== 'leve';
  return { ball, shadow: blobShadow(.2) };
}
