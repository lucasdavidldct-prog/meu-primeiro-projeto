// Jogadores low-poly: pernas, calção, camisa nas cores do clube com número, braços e cabeça.
import * as THREE from 'three';
import { quality } from './qualityLevel';
import { blobShadow } from './stadium';

const SKIN = [0xf1c9a5, 0xd9a47a, 0xa8714a, 0x7a4c2e, 0x5a3620];
const numTex = new Map<string, THREE.Texture>();

function numberTexture(n: number, fg: string): THREE.Texture {
  const k = n + fg;
  const hit = numTex.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = fg; x.font = '900 46px "Saira Extra Condensed", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeText(String(n), 32, 35); x.fillText(String(n), 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  numTex.set(k, t);
  return t;
}

export interface PlayerMesh {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  shadow: THREE.Mesh;
  ring?: THREE.Mesh;
}

/** Cria um jogador olhando para -Z (em direção ao gol) ou +Z (defensores). */
export function makePlayer(shirt: string, trim: string, num: number, opts: { gk?: boolean; facing?: 1 | -1; seed?: number } = {}): PlayerMesh {
  const q = quality(), seg = q === 'alta' ? 12 : q === 'media' ? 8 : 6;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const mat = (c: string | number, rough = .75) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 });
  const seed = opts.seed ?? num;
  const shirtM = mat(shirt, .62), trimM = mat(trim, .62), shorts = mat(opts.gk ? 0x111111 : trim, .7), sock = mat(shirt, .8), skin = mat(SKIN[seed % SKIN.length], .6);
  const boots = mat([0x101010, 0xf2f2f2, 0xe8c35f, 0x2a5bd7, 0xc93b30][seed % 5], .35);
  const cap = (r: number, len: number, m: THREE.Material) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, seg), m);
  const leg = (x: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x, .86, 0);
    const thigh = cap(.085, .32, skin); thigh.position.y = -.24; pivot.add(thigh);
    const shin = cap(.075, .3, sock); shin.position.y = -.62; pivot.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.14, .09, .27), boots); boot.position.set(0, -.84, -.05); pivot.add(boot);
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-.11), legR = leg(.11);
  const hip = cap(.17, .12, shorts); hip.rotation.z = Math.PI / 2; hip.scale.set(1, 1.25, .85); hip.position.y = .93; body.add(hip);
  // Tronco: camisa com gola e mangas
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.25, .2, .6, seg), shirtM); torso.position.y = 1.32; torso.scale.z = .75; body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.25, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI / 2), shirtM); chest.position.y = 1.6; chest.scale.set(1, .45, .75); body.add(chest);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.075, .02, 6, seg), trimM); collar.rotation.x = Math.PI / 2; collar.position.y = 1.7; body.add(collar);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.205, .205, .05, seg), trimM); band.position.y = 1.03; band.scale.z = .75; body.add(band);
  for (const x of [-.31, .31]) {
    const sleeve = cap(.07, .12, shirtM); sleeve.position.set(x, 1.52, 0); sleeve.rotation.z = x < 0 ? .25 : -.25; body.add(sleeve);
    const arm = cap(.05, .3, opts.gk ? shirtM : skin); arm.position.set(x * 1.1, 1.24, 0); arm.rotation.z = x < 0 ? .12 : -.12; body.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(opts.gk ? .07 : .05, 8, 6), opts.gk ? mat(0xf0f0f0) : skin); hand.position.set(x * 1.16, 1.02, 0); body.add(hand);
  }
  const neck = cap(.05, .06, skin); neck.position.y = 1.72; body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.13, seg + 4, seg), skin); head.position.y = 1.86; head.scale.set(.92, 1.08, 1); body.add(head);
  const hairC = [0x1a120b, 0x3b2616, 0x0d0d0d, 0x6b4a2a, 0xc9a25a][seed % 5];
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.137, seg + 4, seg / 2, 0, Math.PI * 2, 0, Math.PI / (seed % 3 ? 2 : 1.7)), mat(hairC, .9)); hair.position.y = 1.88; hair.scale.set(.95, 1.05, 1.02); body.add(hair);
  // Número nas costas e no peito
  const nm = new THREE.MeshBasicMaterial({ map: numberTexture(num, trim), transparent: true });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.32, .32), nm); back.position.set(0, 1.36, .192); body.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(.16, .16), nm); front.position.set(.09, 1.46, -.192); front.rotation.y = Math.PI; body.add(front);
  body.rotation.y = opts.facing === 1 ? Math.PI : 0;
  if (q !== 'leve') body.traverse(o => { if ((o as THREE.Mesh).isMesh && o !== back && o !== front) o.castShadow = true; });
  const shadow = blobShadow(.42); root.add(shadow);
  return { root, body, legL, legR, shadow };
}

/** Anel dourado aos pés de quem está com a bola. */
export function carrierRing(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.RingGeometry(.55, .7, 32), new THREE.MeshBasicMaterial({ color: 0xe8c35f, transparent: true, opacity: .85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .02;
  return m;
}

export function makeBall(): { ball: THREE.Mesh; shadow: THREE.Mesh } {
  // Bola com gomos: fundo branco, desenho de painéis e costuras
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#f7f7f5'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
  for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 64); x.lineTo(i * 32, 128); x.stroke(); }
  x.fillStyle = '#1b1b1b';
  const pent = (cx: number, cy: number, r: number) => { x.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill(); };
  for (let i = 0; i < 8; i++) pent(16 + i * 32, i % 2 ? 34 : 94, 10);
  x.fillStyle = '#e8c35f';
  for (let i = 0; i < 8; i++) x.fillRect(i * 32 + 4, 62, 24, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 3), new THREE.MeshStandardMaterial({ map: t, roughness: .38, metalness: .02 }));
  ball.castShadow = quality() !== 'leve';
  return { ball, shadow: blobShadow(.2) };
}
