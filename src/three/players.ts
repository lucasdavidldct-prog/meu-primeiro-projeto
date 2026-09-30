// Jogadores low-poly: pernas, calção, camisa nas cores do clube com número, braços e cabeça.
import * as THREE from 'three';
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
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const mat = (c: string | number) => new THREE.MeshLambertMaterial({ color: c });
  const shirtM = mat(shirt), trimM = mat(trim), shorts = mat(opts.gk ? 0x111111 : trim), sock = mat(shirt), skin = mat(SKIN[(opts.seed ?? num) % SKIN.length]);
  const leg = (x: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x, .86, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(.17, .5, .2), skin); thigh.position.y = -.25; pivot.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(.15, .42, .17), sock); shin.position.y = -.62; pivot.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .28), mat(0x101010)); boot.position.set(0, -.85, -.04); pivot.add(boot);
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-.12), legR = leg(.12);
  const hip = new THREE.Mesh(new THREE.BoxGeometry(.44, .24, .26), shorts); hip.position.y = .92; body.add(hip);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.27, .22, .62, 8), shirtM); torso.position.y = 1.33; body.add(torso);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.275, .26, .1, 8), trimM); band.position.y = 1.5; body.add(band);
  for (const x of [-.34, .34]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .52, .14), shirtM);
    arm.position.set(x, 1.3, 0); arm.rotation.z = x < 0 ? .15 : -.15; body.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .1), opts.gk ? mat(0xf0f0f0) : skin); hand.position.set(x * 1.06, 1.0, 0); body.add(hand);
  }
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.15, 1), skin); head.position.y = 1.8; body.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.155, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1a120b)); hair.position.y = 1.82; body.add(hair);
  // Número nas costas e no peito
  const nm = new THREE.MeshBasicMaterial({ map: numberTexture(num, trim), transparent: true });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.34, .34), nm); back.position.set(0, 1.36, .245); body.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(.18, .18), nm); front.position.set(.1, 1.44, -.245); front.rotation.y = Math.PI; body.add(front);
  body.rotation.y = opts.facing === 1 ? Math.PI : 0;
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
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#1b1b1b';
  for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(8 + i * 16, i % 2 ? 18 : 46, 6, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 2), new THREE.MeshStandardMaterial({ map: t, roughness: .5 }));
  return { ball, shadow: blobShadow(.2) };
}
