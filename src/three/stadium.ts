// Estádio à noite: gramado listrado com marcações oficiais, gol com rede, arquibancadas e refletores.
// Coordenadas 3D: X = largura (0 no meio do gol), Z = distância da linha de fundo (gol em Z = 0), Y = altura.
import * as THREE from 'three';

const LINE = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: .85 });

function strip(g: THREE.Group, x1: number, z1: number, x2: number, z2: number, w = .12): void {
  const L = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L, w), LINE);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
  m.position.set((x1 + x2) / 2, .012, (z1 + z2) / 2);
  g.add(m);
}
function ring(g: THREE.Group, x: number, z: number, r: number, start = 0, len = Math.PI * 2, w = .12): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 64, 1, start, len), LINE);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, .012, z);
  g.add(m);
}

export function buildPitch(): THREE.Group {
  const g = new THREE.Group();
  // Listras de corte do gramado (5,25 m) e área além das linhas
  const base = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshLambertMaterial({ color: 0x173f27 }));
  base.rotation.x = -Math.PI / 2; base.position.set(0, -.01, 30);
  g.add(base);
  const a = new THREE.MeshLambertMaterial({ color: 0x2a7a45 }), b = new THREE.MeshLambertMaterial({ color: 0x246b3c });
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(68, 5.25), i % 2 ? a : b);
    s.rotation.x = -Math.PI / 2; s.position.set(0, 0, i * 5.25 + 2.625);
    g.add(s);
  }
  // Linhas: laterais, fundo, meio de campo, grande área, pequena área, marca do pênalti e meia-lua
  strip(g, -34, 0, 34, 0); strip(g, -34, 0, -34, 63); strip(g, 34, 0, 34, 63); strip(g, -34, 52.5, 34, 52.5);
  ring(g, 0, 52.5, 9.15); ring(g, 0, 52.5, .15, 0, Math.PI * 2, .3);
  strip(g, -20.16, 0, -20.16, 16.5); strip(g, 20.16, 0, 20.16, 16.5); strip(g, -20.16, 16.5, 20.16, 16.5);
  strip(g, -9.16, 0, -9.16, 5.5); strip(g, 9.16, 0, 9.16, 5.5); strip(g, -9.16, 5.5, 9.16, 5.5);
  ring(g, 0, 11, .14, 0, Math.PI * 2, .28);
  const ang = Math.acos(5.5 / 9.15);
  ring(g, 0, 11, 9.15, -Math.PI / 2 - ang, 2 * ang); // meia-lua: só a parte fora da grande área
  // Escanteios
  ring(g, -34, 0, 1, -Math.PI / 2, Math.PI / 2); ring(g, 34, 0, 1, Math.PI, Math.PI / 2);
  return g;
}

export function buildGoal(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4 });
  const post = new THREE.CylinderGeometry(.06, .06, 2.44, 12);
  for (const x of [-3.66, 3.66]) { const p = new THREE.Mesh(post, white); p.position.set(x, 1.22, 0); g.add(p); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 7.44, 12), white);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.44, 0); g.add(bar);
  const net = new THREE.MeshBasicMaterial({ color: 0xdddddd, wireframe: true, transparent: true, opacity: .35 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44, 36, 12), net); back.position.set(0, 1.22, -2); g.add(back);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2, 36, 10), net); top.rotation.x = -Math.PI / 2; top.position.set(0, 2.44, -1); g.add(top);
  for (const x of [-3.66, 3.66]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.44, 10, 12), net); s.rotation.y = Math.PI / 2; s.position.set(x, 1.22, -1); g.add(s); }
  return g;
}

export function buildStadium(): THREE.Group {
  const g = new THREE.Group();
  const standMat = new THREE.MeshLambertMaterial({ color: 0x151b24 });
  const rows: [number, number, number, number, number][] = [[0, -16, 110, 14, 0], [-52, 30, 70, 14, Math.PI / 2], [52, 30, 70, 14, -Math.PI / 2]];
  for (const [x, z, w, h, ry] of rows) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 12), standMat);
    s.position.set(x, h / 2 - 1, z); s.rotation.y = ry; g.add(s);
  }
  // Torcida: pontinhos coloridos nas arquibancadas
  const pts: number[] = [], cols: number[] = [];
  const col = new THREE.Color();
  for (let i = 0; i < 2600; i++) {
    const side = i % 3;
    const u = Math.random(), v = Math.random();
    let x: number, y: number, z: number;
    if (side === 0) { x = -55 + u * 110; y = 1 + v * 12; z = -10 - v * 6; }
    else { x = (side === 1 ? -46 : 46) + (side === 1 ? -1 : 1) * v * 6; y = 1 + v * 12; z = -4 + u * 68; }
    pts.push(x, y, z);
    col.setHSL(Math.random(), .5, .35 + Math.random() * .3);
    cols.push(col.r, col.g, col.b);
  }
  const crowd = new THREE.BufferGeometry();
  crowd.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  crowd.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.add(new THREE.Points(crowd, new THREE.PointsMaterial({ size: .5, vertexColors: true })));
  // Torres de refletores com brilho
  const glow = new THREE.SpriteMaterial({ color: 0xfff6d8, transparent: true, opacity: .9, depthWrite: false });
  for (const [x, z] of [[-48, -14], [48, -14], [-48, 58], [48, 58]]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(.8, 30, .8), standMat); pole.position.set(x, 15, z); g.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6, 3, .5), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }));
    panel.position.set(x, 30, z); panel.lookAt(0, 0, 25); g.add(panel);
    const s = new THREE.Sprite(glow); s.scale.set(16, 16, 1); s.position.set(x, 30, z); g.add(s);
  }
  return g;
}

export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0x9fb4d0, 0x0d1f14, .55));
  scene.add(new THREE.AmbientLight(0xffffff, .18));
  for (const [x, z] of [[-40, -10], [40, -10], [-40, 55], [40, 55]]) {
    const d = new THREE.DirectionalLight(0xfff3dc, .42);
    d.position.set(x, 35, z); d.target.position.set(0, 0, 20);
    scene.add(d, d.target);
  }
}

/** Sombra simples (disco escuro) — barata e boa para celular. */
export function blobShadow(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .38, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = .015;
  return m;
}
