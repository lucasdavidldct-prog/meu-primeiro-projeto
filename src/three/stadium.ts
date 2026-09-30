// Estádio à noite: gramado com textura de corte, marcações oficiais, gol com rede, arquibancadas em degraus com cobertura,
// torcida que se mexe, placas de LED, refletores e céu. O nível de detalhe segue a qualidade gráfica (quality.ts).
// Coordenadas 3D: X = largura (0 no meio do gol), Z = distância da linha de fundo (gol em Z = 0), Y = altura.
import * as THREE from 'three';
import { quality } from './qualityLevel';
import type { Ambiente, Clima, Gramado } from '../engine/clima';

const AMB0: Ambiente = { clima: 'noite', gramado: 'faixas' };

const LINE = new THREE.MeshBasicMaterial({ color: 0xd9ddd9, transparent: true, opacity: .9 });

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

/**
 * Textura do gramado (76 × 126 m; o topo da imagem é a linha de fundo): o desenho do corte escolhido, granulado
 * e, na neve, manchas brancas. O centro do campo fica a 45% da altura.
 */
function grassTexture(g: Gramado, clima: Clima): THREE.CanvasTexture {
  const q = quality(), W = q === 'alta' ? 1024 : 512, H = W * 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  // Verde de gramado de TV: faixas claras e escuras bem marcadas (mais escuro na chuva)
  const [cA, cB] = clima === 'chuva' ? ['#2b7a40', '#215f33'] : clima === 'sol' ? ['#4a9e4c', '#36833c'] : clima === 'noite' ? ['#3a8a45', '#2b7037'] : ['#3f9147', '#2e7639'];
  const px = W / 76, cx = W / 2, cy = H * (56.5 / 126);
  x.fillStyle = cB; x.fillRect(0, 0, W, H);
  x.fillStyle = cA;
  if (g === 'faixas') {
    const bands = 24, bh = H / bands;
    for (let i = 0; i < bands; i++) if (i % 2) x.fillRect(0, i * bh, W, bh);
    x.globalAlpha = .05; x.fillStyle = '#000'; for (let i = 0; i < 12; i += 2) x.fillRect(i * W / 12, 0, W / 12, H); x.globalAlpha = 1;
  } else if (g === 'xadrez') {
    const bh = H / 24, bw = W / 8;
    for (let i = 0; i < 24; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(j * bw, i * bh, bw, bh);
  } else if (g === 'circulos') {
    for (let r = Math.ceil(Math.hypot(W, H) / (5.25 * px)); r > 0; r--) { x.fillStyle = r % 2 ? cA : cB; x.beginPath(); x.arc(cx, cy, r * 5.25 * px, 0, Math.PI * 2); x.fill(); }
  } else if (g === 'diagonal') {
    x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
    const step = 6 * px, L = Math.hypot(W, H);
    for (let k = -Math.ceil(L / step); k < L / step; k += 2) x.fillRect(k * step, -L, step, 2 * L);
    x.restore();
  } else { x.fillStyle = cA; x.globalAlpha = .5; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
  // Manchas grandes e suaves (o gramado nunca é uniforme) e o brilho do corte em cada faixa
  for (let i = 0; i < 260; i++) {
    const ex = Math.random() * W, ey = Math.random() * H, r = (4 + Math.random() * 14) * px;
    const g2 = x.createRadialGradient(ex, ey, 0, ex, ey, r);
    const claro = Math.random() < .5;
    g2.addColorStop(0, claro ? 'rgba(170,220,120,.10)' : 'rgba(10,40,15,.12)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g2; x.fillRect(ex - r, ey - r, r * 2, r * 2);
  }
  // Desgaste: pequena área, marca do pênalti e meio de campo (grama mais rala, puxando para o marrom)
  const gasto = (gx: number, gy: number, rx: number, ry: number, a: number) => {
    const cx2 = cx + gx * px, cy2 = cy - (56.5 - gy) * (H / 126) * (126 / 126);
    const g3 = x.createRadialGradient(cx2, cy2, 0, cx2, cy2, rx * px);
    g3.addColorStop(0, `rgba(120,105,60,${a})`); g3.addColorStop(.6, `rgba(110,110,60,${a * .45})`); g3.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(cx2, cy2); x.scale(1, ry / rx); x.translate(-cx2, -cy2); x.fillStyle = g3; x.fillRect(cx2 - rx * px, cy2 - rx * px, rx * 2 * px, rx * 2 * px); x.restore();
  };
  if (clima !== 'neve') { gasto(0, 2.2, 5.5, 2.4, .32); gasto(0, 11, 1.6, 1.4, .25); gasto(0, 52.5, 2.2, 2, .12); gasto(-3.2, .8, 1.4, .9, .3); gasto(3.2, .8, 1.4, .9, .3); }
  // Granulado: fios de grama claros e escuros
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - .5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + n * .6)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * .5));
  }
  x.putImageData(img, 0, 0);
  if (clima === 'neve') {
    // Neve fina por cima da grama e acumulada perto das laterais
    x.fillStyle = '#eef3f7'; x.globalAlpha = .14; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * 6; i++) {
      const ex = Math.random() * W, ey = Math.random() * H, edge = Math.min(ex, W - ex) / W;
      x.globalAlpha = (.12 + Math.random() * .22) * (edge < .08 ? 2.2 : 1);
      x.beginPath(); x.arc(ex, ey, .6 + Math.random() * 1.8, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = q === 'leve' ? 1 : 16;
  return t;
}

export function buildPitch(amb: Ambiente = AMB0): THREE.Group {
  const g = new THREE.Group();
  // Entorno do campo: grama mais escura e a pista
  const base = new THREE.Mesh(new THREE.PlaneGeometry(140, 150), new THREE.MeshStandardMaterial({ color: amb.clima === 'neve' ? 0xc9d2d6 : 0x2a6a36, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.set(0, -.02, 35); base.receiveShadow = true;
  g.add(base);
  // Pista atrás das placas (terracota, como nos estádios com pista de atletismo)
  const track = new THREE.MeshStandardMaterial({ color: amb.mrv ? 0x2a2d33 : 0x8a4a36, roughness: .95 });
  for (const [w, h, x, z] of [[92, 6, 0, -9], [6, 90, -42, 38], [6, 90, 42, 38]] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), track); m.rotation.x = -Math.PI / 2; m.position.set(x, -.01, z); m.receiveShadow = true; g.add(m);
  }
  // Campo: 68 × 126 (de 0 até além do meio de campo) com a textura de corte
  const field = new THREE.Mesh(new THREE.PlaneGeometry(76, 126), new THREE.MeshStandardMaterial({ map: grassTexture(amb.gramado, amb.clima), roughness: amb.clima === 'chuva' ? .5 : .92, metalness: amb.clima === 'chuva' ? .08 : 0 }));
  field.rotation.x = -Math.PI / 2; field.position.set(0, 0, 59); field.receiveShadow = true;
  g.add(field);
  // Linhas: laterais, fundo, meio de campo, grande área, pequena área, marca do pênalti e meia-lua
  strip(g, -34, 0, 34, 0); strip(g, -34, 0, -34, 63); strip(g, 34, 0, 34, 63); strip(g, -34, 52.5, 34, 52.5);
  ring(g, 0, 52.5, 9.15); ring(g, 0, 52.5, .15, 0, Math.PI * 2, .3);
  strip(g, -20.16, 0, -20.16, 16.5); strip(g, 20.16, 0, 20.16, 16.5); strip(g, -20.16, 16.5, 20.16, 16.5);
  strip(g, -9.16, 0, -9.16, 5.5); strip(g, 9.16, 0, 9.16, 5.5); strip(g, -9.16, 5.5, 9.16, 5.5);
  ring(g, 0, 11, .14, 0, Math.PI * 2, .28);
  const ang = Math.acos(5.5 / 9.15);
  ring(g, 0, 11, 9.15, -Math.PI / 2 - ang, 2 * ang); // meia-lua: só a parte fora da grande área
  ring(g, -34, 0, 1, -Math.PI / 2, Math.PI / 2); ring(g, 34, 0, 1, Math.PI, Math.PI / 2);
  // Bandeirinhas de escanteio
  for (const x of [-34, 34]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pole.position.set(x, .75, 0); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.4, .3), new THREE.MeshStandardMaterial({ color: 0xf2b640, side: THREE.DoubleSide }));
    flag.position.set(x + (x < 0 ? .2 : -.2), 1.35, 0); g.add(flag);
  }
  g.add(adBoards(amb), beiraDoCampo());
  return g;
}

/** Texturas das placas de LED (andam devagar, como nos estádios). */
const ledTex: THREE.Texture[] = [];
/** Placas de LED em volta do campo inteiro (texto próprio do jogo). */
function adBoards(amb: Ambiente): THREE.Group {
  const g = new THREE.Group();
  ledTex.length = 0;
  const mk = (texts: [string, string, string][]) => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 64;
    const x = c.getContext('2d')!, w = 2048 / texts.length;
    texts.forEach(([text, a, b], i) => {
      const gr = x.createLinearGradient(i * w, 0, (i + 1) * w, 0); gr.addColorStop(0, a); gr.addColorStop(1, b);
      x.fillStyle = gr; x.fillRect(i * w, 0, w, 64);
      x.fillStyle = 'rgba(255,255,255,.95)'; x.font = '800 42px "Saira Extra Condensed", Impact, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center';
      x.fillText(text, i * w + w / 2, 34);
    });
    // Pontinhos do LED
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = 0; yy < 64; yy += 4) x.fillRect(0, yy, 2048, 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
    ledTex.push(t);
    return t;
  };
  const textos: [string, string, string][] = amb.mrv
    ? [['ARENA MRV', '#0b0b0b', '#2b2b2b'], ['GALO', '#f2f2f2', '#9a9a9a'], ['ESQUADRÃO FC', '#0b0b0b', '#3a3a3a'], ['CASA DO GALO', '#1a1a1a', '#6b5a2a']]
    : [['ESQUADRÃO FC', '#0d3b2a', '#1d7a4f'], ['TEMPORADA 2026', '#1b1f5c', '#3a44b8'], ['FUTEBOL DE CARTAS', '#5c1b1b', '#b8433a'], ['GALO', '#101010', '#3a3a3a']];
  const faixa = (L: number, x: number, z: number, ry: number, h = .95, y = h / 2) => {
    const t = mk(textos).clone(); t.needsUpdate = true; t.repeat.set(L / 60, 1); ledTex.push(t);
    const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .8, roughness: .55 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(L, h, .16), m);
    b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = quality() === 'alta';
    g.add(b);
  };
  // Linha de fundo (atrás do gol) e as duas laterais, sem buracos
  faixa(32, -22, -5, 0); faixa(32, 22, -5, 0); // vão atrás do gol: não tapa a câmera do goleiro
  faixa(66, -38.5, 28, Math.PI / 2); faixa(66, 38.5, 28, -Math.PI / 2);
  return g;
}

/** Gente na beira do campo: fotógrafos atrás do gol e staff de colete nas laterais, e os bancos de reservas. */
function beiraDoCampo(): THREE.Group {
  const g = new THREE.Group(), q = quality();
  if (q === 'leve') return g;
  const pele = [0xf3d0b0, 0xe0ac84, 0xb97c52, 0x8a5634, 0x5e3a22];
  const pessoa = (x: number, z: number, cor: number, sentado = false, ry = 0) => {
    const p = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(.2, sentado ? .35 : .7, 3, 8), new THREE.MeshStandardMaterial({ color: cor, roughness: .7 }));
    corpo.position.y = sentado ? .55 : .75; p.add(corpo);
    const cab = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshStandardMaterial({ color: pele[Math.floor(Math.random() * pele.length)], roughness: .6 }));
    cab.position.y = sentado ? 1.05 : 1.45; p.add(cab);
    const perna = new THREE.Mesh(new THREE.BoxGeometry(.3, sentado ? .4 : .7, .2), new THREE.MeshStandardMaterial({ color: 0x1b1f2a }));
    perna.position.y = sentado ? .2 : .35; p.add(perna);
    p.position.set(x, 0, z); p.rotation.y = ry; p.traverse(o => { o.castShadow = q === 'alta'; });
    g.add(p);
  };
  // Fotógrafos agachados atrás da linha de fundo (colete laranja) e stewards de amarelo nas laterais
  for (const x of [-26, -21, -16, -12, 12, 16, 21, 26]) pessoa(x + (Math.random() - .5), -3.4, 0xff7a1a, true, Math.PI);
  for (const z of [4, 16, 30, 44]) { pessoa(-40.2, z, 0xf2d21b, false, Math.PI / 2); pessoa(40.2, z + 6, 0xf2d21b, false, -Math.PI / 2); }
  // Bancos de reservas com cobertura transparente
  const vidro = new THREE.MeshStandardMaterial({ color: 0xbfd7e6, transparent: true, opacity: .35, roughness: .1, metalness: .2 });
  const banco = new THREE.MeshStandardMaterial({ color: 0x1d2330, roughness: .6 });
  for (const z of [44, 56]) {
    const cob = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 16, 1, true, 0, Math.PI), vidro);
    cob.rotation.z = Math.PI / 2; cob.rotation.y = Math.PI / 2; cob.position.set(-41.2, .6, z); g.add(cob);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, 6.6), banco); b.position.set(-41.6, .25, z); g.add(b);
    for (let k = 0; k < 5; k++) pessoa(-41.6, z - 2.6 + k * 1.3, [0x2a5bd7, 0x1d7a4f, 0xc93b30][k % 3], true, Math.PI / 2);
  }
  return g;
}

export function buildGoal(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, metalness: .1 });
  const post = new THREE.CylinderGeometry(.06, .06, 2.44, 16);
  for (const x of [-3.66, 3.66]) { const p = new THREE.Mesh(post, white); p.position.set(x, 1.22, 0); p.castShadow = true; g.add(p); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 7.44, 16), white);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.44, 0); bar.castShadow = true; g.add(bar);
  // Estrutura de trás
  const back = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: .5, metalness: .4 });
  for (const x of [-3.66, 3.66]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2.9, 8), back);
    s.position.set(x, 1.3, -1); s.rotation.x = -.72; g.add(s);
  }
  // Rede em malha (linhas): fundo, teto e laterais, com a barriga caindo um pouco
  const pts: number[] = [], D = 2, step = .18;
  const sag = (u: number, v: number) => .12 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  for (let x = -3.66; x <= 3.661; x += step) { pts.push(x, 0, -D - sag((x + 3.66) / 7.32, 0), x, 2.44, -D); pts.push(x, 2.44, 0, x, 2.44, -D); }
  for (let y = 0; y <= 2.441; y += step) pts.push(-3.66, y, -D, 3.66, y, -D);
  for (let z = 0; z >= -D - .001; z -= step) { pts.push(-3.66, 2.44, z, 3.66, 2.44, z); for (const x of [-3.66, 3.66]) pts.push(x, 0, z, x, 2.44, z); }
  for (let y = 0; y <= 2.441; y += step) for (const x of [-3.66, 3.66]) pts.push(x, y, 0, x, y, -D);
  // Rede mais fina na qualidade Alta (a malha deforma melhor quando a bola entra)
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(subdivide(pts, quality() === 'leve' ? 1 : 4), 3));
  (geo.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xe6e6e6, transparent: true, opacity: .42 })));
  net = { geo, base: Float32Array.from(geo.getAttribute('position').array as Float32Array), hit: null, off: g.position };
  return g;
}

/** Quebra cada fio em `n` pedaços para a rede poder dobrar. */
function subdivide(pts: number[], n: number): number[] {
  if (n <= 1) return pts;
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 6) for (let k = 0; k < n; k++) {
    const a = k / n, b = (k + 1) / n;
    for (const f of [a, b]) out.push(pts[i] + (pts[i + 3] - pts[i]) * f, pts[i + 1] + (pts[i + 4] - pts[i + 1]) * f, pts[i + 2] + (pts[i + 5] - pts[i + 2]) * f);
  }
  return out;
}

/** Rede parada de novo (para o replay mostrar o balanço outra vez). */
export function resetNet(): void { if (net) net.hit = null; }
let netForce = 1;
/** Força com que a bola estufa a rede (superchute = mais). */
export function setNetForce(f: number): void { netForce = f; }

let net: { geo: THREE.BufferGeometry; base: Float32Array; hit: { x: number; y: number; t0: number } | null; off: THREE.Vector3 } | null = null;
/**
 * Rede que balança: quando a bola entra no gol, a malha estufa em volta do ponto onde ela bate e oscila até parar.
 * Chame a cada quadro com a posição da bola (coordenadas do mundo).
 */
export function tickNet(ball: THREE.Vector3, now = performance.now()): void {
  if (!net) return;
  const bx = ball.x - net.off.x, by = ball.y, bz = ball.z - net.off.z;
  if (!net.hit && bz < -.25 && bz > -2.2 && Math.abs(bx) < 3.7 && by < 2.5) net.hit = { x: bx, y: Math.max(.3, by), t0: now };
  if (!net.hit) return;
  const t = (now - net.hit.t0) / 1000;
  if (t > 3.2) return;
  // Estufa rápido (a bola empurra), volta e ainda balança um pouco
  const amp = .55 * netForce * (1 - Math.exp(-t * 14)) * Math.exp(-t * 1.6) + .12 * Math.exp(-t * 1.2) * Math.sin(t * 13);
  const pos = net.geo.getAttribute('position') as THREE.BufferAttribute, a = pos.array as Float32Array, b = net.base, { x: hx, y: hy } = net.hit;
  for (let i = 0; i < a.length; i += 3) {
    const x = b[i], y = b[i + 1], z = b[i + 2];
    const fundo = Math.min(1, -z / 2); // os fios do fundo mexem mais; os presos às traves quase nada
    const w = Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / 1.3) * fundo;
    a[i + 2] = z - amp * w; a[i + 1] = y - amp * .25 * w * Math.max(0, y - .1) / 2.44;
  }
  pos.needsUpdate = true;
}

let crowdShaders: { uniforms: { uTime: { value: number }; uAmp: { value: number } } }[] = [];

const SKY: Record<Clima, [number, number, number]> = {
  noite: [0x03060d, 0x0b1830, 0x24324a], dia: [0x5b7fa8, 0x9db6cf, 0xdfe6ea], sol: [0x1f63c6, 0x5d9be0, 0xcfe6f7],
  chuva: [0x262c34, 0x3d454f, 0x646c76], neve: [0x7d8794, 0xaab3bd, 0xd9dee3],
};
/** Fundo e neblina da cena conforme o clima. */
export function ambientScene(scene: THREE.Scene, clima: Clima): void {
  const [bg, fog, near, far] = ({ noite: [0x070b12, 0x0b1424, 110, 260], dia: [0x9db6cf, 0xc9d4de, 120, 320], sol: [0x5d9be0, 0xcfe6f7, 150, 380], chuva: [0x3d454f, 0x59616b, 45, 170], neve: [0xaab3bd, 0xd0d6dc, 40, 160] } as const)[clima];
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(fog, near, far);
}
const dark = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

export function buildStadium(amb: Ambiente = AMB0): THREE.Group {
  const g = new THREE.Group(), q = quality(), noite = amb.clima === 'noite', luzes = amb.clima !== 'dia' && amb.clima !== 'sol';
  // Céu com degradê (estrelas só à noite; sol no céu limpo)
  const [cTop, cMid, cHor] = SKY[amb.clima];
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(cTop) }, mid: { value: new THREE.Color(cMid) }, hor: { value: new THREE.Color(cHor) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, mid, smoothstep(0.0,0.18,h)); c = mix(c, top, smoothstep(0.18,0.7,h)); gl_FragColor = vec4(c,1.0); }',
  }));
  g.add(sky);
  if (amb.clima === 'sol') {
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff3c4, transparent: true, depthWrite: false, fog: false }));
    sun.scale.set(60, 60, 1); sun.position.set(-120, 150, -180); g.add(sun);
  }
  if (noite && q !== 'leve') {
    const sp: number[] = [];
    for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, e = .25 + Math.random() * 1.2; sp.push(Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .7 })));
  }
  // Arquibancadas em degraus: atrás do gol e nas duas laterais
  // Cadeiras nas cores da casa (Arena MRV: preto e branco); cobertura branca na Arena MRV
  const concrete = new THREE.MeshStandardMaterial({ color: amb.mrv ? 0x2a2a2a : 0x1f2631, roughness: .9 });
  const seatA = new THREE.MeshStandardMaterial({ color: amb.mrv ? 0x141414 : amb.casa ? dark(amb.casa.c1, .55) : 0x2b3444, roughness: .8 });
  const seatB = new THREE.MeshStandardMaterial({ color: amb.mrv ? 0xd8d8d8 : amb.casa ? dark(amb.casa.c2, .45) : 0x232b38, roughness: .8 });
  const STEPS = 16, stepH = 1.05, stepD = 1.25;
  const sides: { x: number; z: number; w: number; ry: number }[] = [{ x: 0, z: -9, w: 96, ry: 0 }, { x: -45, z: 30, w: 76, ry: Math.PI / 2 }, { x: 45, z: 30, w: 76, ry: -Math.PI / 2 }, { x: 0, z: 112, w: 96, ry: Math.PI }];
  const seatSpots: { p: THREE.Vector3; ry: number }[] = [];
  for (const s of sides) {
    const stand = new THREE.Group();
    stand.position.set(s.x, 0, s.z); stand.rotation.y = s.ry;
    for (let i = 0; i < STEPS; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, stepH, stepD), i % 2 ? seatA : seatB);
      m.position.set(0, .6 + i * stepH, -i * stepD); m.receiveShadow = q !== 'leve';
      stand.add(m);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(s.w, STEPS * stepH + 4, 1), concrete);
    back.position.set(0, (STEPS * stepH + 4) / 2, -STEPS * stepD - .5); stand.add(back);
    // Cobertura com faixa de luz por baixo
    const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 4, .4, STEPS * stepD + 6), amb.mrv
      ? new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .5, metalness: .1, transparent: true, opacity: .92 })
      : new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: .7, metalness: .3 }));
    roof.position.set(0, STEPS * stepH + 5, -STEPS * stepD / 2 + 1); roof.rotation.x = -.08; stand.add(roof);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(s.w, .12, .3), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
    strip.position.set(0, STEPS * stepH + 4.7, 3.5); stand.add(strip);
    g.add(stand);
    stand.updateMatrixWorld(true);
    for (let i = 0; i < STEPS; i++) for (let k = 0; k < s.w / .56; k++) {
      const v = new THREE.Vector3(-s.w / 2 + .3 + k * .56, 1.1 + i * stepH + .35, -i * stepD);
      seatSpots.push({ p: v.applyMatrix4(stand.matrixWorld), ry: s.ry });
    }
  }
  // Torcida: bonecos com cores variadas (instanced), balançando de leve; na qualidade leve, só pontos
  const N = Math.min(seatSpots.length, q === 'alta' ? 10500 : q === 'media' ? 6000 : 2800);
  // Torcida: na Arena MRV quase toda de preto e branco; nos outros estádios, maioria nas cores do mandante
  const col = new THREE.Color(), outras = [0x111111, 0xf2f2f2, 0x1f1f1f, 0xe8e8e8, 0xe8c35f, 0x2a5bd7, 0xc93b30, 0x2f8f55];
  const casa = amb.mrv ? [0x111111, 0xf2f2f2, 0x161616, 0xeaeaea, 0x111111] : amb.casa ? [new THREE.Color(amb.casa.c1).getHex(), new THREE.Color(amb.casa.c2).getHex(), new THREE.Color(amb.casa.c1).getHex()] : [];
  const shirts = [...casa, ...casa, ...outras.slice(0, amb.mrv ? 2 : 8)];
  if (q === 'leve') {
    const pts: number[] = [], cols: number[] = [];
    for (let i = 0; i < N; i++) { const s = seatSpots[Math.floor(Math.random() * seatSpots.length)]; pts.push(s.p.x, s.p.y, s.p.z); col.setHex(shirts[i % shirts.length]); cols.push(col.r, col.g, col.b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: .55, vertexColors: true })));
  } else {
    crowdShaders = [];
    // O mesmo balanço para corpo e cabeça (mesmo índice de instância = mesma fase)
    const bounce = (m: THREE.MeshStandardMaterial) => {
      m.onBeforeCompile = sh => {
        sh.uniforms.uTime = { value: 0 }; sh.uniforms.uAmp = { value: .05 };
        crowdShaders.push(sh as unknown as typeof crowdShaders[number]);
        sh.vertexShader = 'uniform float uTime; uniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n  float ph = float(gl_InstanceID) * 1.618;\n  transformed.y += max(0.0, sin(uTime * 5.0 + ph)) * uAmp * (1.0 + mod(ph, 1.0));');
      };
      return m;
    };
    // Torcedor: tronco com a camisa (ombros arredondados) e cabeça com tom de pele
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.2, .42, 2, 6), bounce(new THREE.MeshStandardMaterial({ roughness: .85 })), N);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(.12, 7, 5), bounce(new THREE.MeshStandardMaterial({ roughness: .7 })), N);
    const peles = [0xf3d0b0, 0xe0ac84, 0xb97c52, 0x8a5634, 0x5e3a22];
    const m4 = new THREE.Matrix4(), h4 = new THREE.Matrix4(), used = new Set<number>();
    for (let i = 0; i < N; i++) {
      let j = Math.floor(Math.random() * seatSpots.length);
      for (let t = 0; t < 4 && used.has(j); t++) j = Math.floor(Math.random() * seatSpots.length);
      used.add(j);
      const s = seatSpots[j], alt = (Math.random() - .5) * .12;
      m4.makeRotationY(s.ry + (Math.random() - .5) * .3); m4.setPosition(s.p.x + (Math.random() - .5) * .2, s.p.y + alt, s.p.z);
      body.setMatrixAt(i, m4);
      h4.copy(m4); h4.setPosition(s.p.x + (Math.random() - .5) * .2, s.p.y + .5 + alt, s.p.z);
      head.setMatrixAt(i, h4);
      col.setHex(shirts[Math.floor(Math.random() * shirts.length)]).offsetHSL(0, 0, (Math.random() - .5) * .12);
      body.setColorAt(i, col);
      head.setColorAt(i, col.setHex(peles[Math.floor(Math.random() * peles.length)]));
    }
    g.add(body, head);
  }
  // Torres de refletores: painel que brilha (bloom na qualidade Alta) e halo
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: .6, metalness: .5 });
  const glow = new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff6d8, transparent: true, opacity: luzes ? (noite ? (q === 'alta' ? .55 : .85) : .45) : 0, depthWrite: false });
  for (const [x, z] of [[-50, -16], [50, -16], [-50, 62], [50, 62]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, 34, 10), steel); pole.position.set(x, 17, z); g.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, .5), new THREE.MeshBasicMaterial({ color: luzes ? 0xfffbe8 : 0x9aa3ad }));
    panel.position.set(x, 34, z); panel.lookAt(0, 0, 25); g.add(panel);
    if (luzes) { const s = new THREE.Sprite(glow); s.scale.set(20, 20, 1); s.position.set(x, 34, z); g.add(s); }
  }
  if (amb.mrv) g.add(arenaMRV());
  return g;
}

let glowT: THREE.Texture | null = null;
/** Halo redondo e suave (refletores e sol). */
function glowTex(): THREE.Texture {
  if (glowT) return glowT;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  glowT = new THREE.CanvasTexture(c);
  return glowT;
}

/**
 * Arena MRV estilizada (desenho próprio): arcos brancos sobre a arquibancada de trás do gol, telão com o nome
 * e faixas pretas e brancas nas laterais da cobertura.
 */
function arenaMRV(): THREE.Group {
  const g = new THREE.Group();
  const branco = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: .45, metalness: .2 });
  // Arcos da cobertura
  for (const [x, z, ry, w] of [[0, -16, 0, 110], [-52, 30, Math.PI / 2, 90], [52, 30, Math.PI / 2, 90]] as const) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(w / 2, .55, 8, 48, Math.PI), branco);
    arc.position.set(x, 14, z); arc.rotation.y = ry; arc.scale.y = .32; g.add(arc);
  }
  // Telão atrás do gol
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d')!;
  const gr = x.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#0b0b0b'); gr.addColorStop(.5, '#1d1d1d'); gr.addColorStop(1, '#0b0b0b');
  x.fillStyle = gr; x.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 1024; i += 64) { x.fillStyle = (i / 64) % 2 ? '#f2f2f2' : '#111'; x.fillRect(i, 226, 64, 30); }
  x.fillStyle = '#f4f4f4'; x.font = '900 128px "Saira Extra Condensed", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ARENA MRV', 512, 108);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  tela.position.set(0, 22, -24); g.add(tela);
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(27, 7.4, .6), new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
  moldura.position.set(0, 22, -24.4); g.add(moldura);
  return g;
}

/** Chuva (riscos caindo) ou neve (flocos flutuando) em volta de onde a câmera olha. */
export function buildWeather(clima: Clima): { obj: THREE.Object3D; tick: (dt: number, at: THREE.Vector3) => void } | null {
  if (clima !== 'chuva' && clima !== 'neve') return null;
  const q = quality(), N = (q === 'alta' ? 3200 : q === 'media' ? 1800 : 800) * (clima === 'neve' ? .7 : 1), BX = 70, BY = 30;
  const p = new Float32Array(N * (clima === 'chuva' ? 6 : 3)), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (Math.random() - .5) * BX, y = Math.random() * BY, z = (Math.random() - .5) * BX;
    seed[i] = Math.random() * 10;
    if (clima === 'chuva') p.set([x, y, z, x + .08, y + .75, z], i * 6); else p.set([x, y, z], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  (geo.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const obj = clima === 'chuva'
    ? new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb8c4d2, transparent: true, opacity: .42, depthWrite: false }))
    : new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: .34, map: glowTex(), transparent: true, opacity: .95, depthWrite: false }));
  obj.frustumCulled = false;
  let t = 0;
  const tick = (dt: number, at: THREE.Vector3) => {
    t += dt; obj.position.set(at.x, 0, at.z);
    const a = geo.getAttribute('position') as THREE.BufferAttribute, arr = a.array as Float32Array;
    for (let i = 0; i < N; i++) {
      if (clima === 'chuva') {
        const k = i * 6; let y = arr[k + 1] - 34 * dt; if (y < 0) y += BY;
        arr[k + 1] = y; arr[k + 4] = y + .75;
      } else {
        const k = i * 3; let y = arr[k + 1] - 1.6 * dt; if (y < 0) y += BY;
        arr[k + 1] = y; arr[k] += Math.sin(t * .9 + seed[i]) * .6 * dt; arr[k + 2] += Math.cos(t * .7 + seed[i]) * .4 * dt;
      }
    }
    a.needsUpdate = true;
  };
  return { obj, tick };
}

/** Anima a torcida (chame a cada quadro). `festa` = torcida pulando (gol, lance perigoso). */
export function tickStadium(timeMs: number, festa = false): void {
  for (const t of ledTex) t.offset.x = (timeMs / 60000) % 1;
  for (const sh of crowdShaders) {
    sh.uniforms.uTime.value = timeMs / 1000;
    sh.uniforms.uAmp.value += ((festa ? .45 : .05) - sh.uniforms.uAmp.value) * .08;
  }
}

export function addLights(scene: THREE.Scene, clima: Clima = 'noite'): void {
  const q = quality();
  // [céu, chão, intensidade do céu, cor da luz principal, intensidade, luzes de apoio]
  const L = ({
    noite: [0xa8bddc, 0x0d1f14, q === 'leve' ? .75 : .55, 0xfff1d6, q === 'leve' ? 1 : 1.55, 1],
    dia: [0xdfe9f5, 0x3a5a3a, 1.05, 0xffffff, 1.25, .5],
    sol: [0xcfe3ff, 0x3f6a3a, .8, 0xfff0d0, 2.4, .25],
    chuva: [0x9aa6b4, 0x1c2a20, .8, 0xe6ecf5, .95, .9],
    neve: [0xe6edf5, 0x8894a0, 1.1, 0xf2f6ff, 1.05, .6],
  } as const)[clima];
  scene.add(new THREE.HemisphereLight(L[0], L[1], L[2]));
  scene.add(new THREE.AmbientLight(0xffffff, .12));
  // Luz principal (refletores à noite, sol de dia), com sombra (Alta/Média)
  const key = new THREE.DirectionalLight(L[3], L[4]);
  if (clima === 'sol' || clima === 'dia') key.position.set(-40, 60, 20); else key.position.set(-26, 42, 58);
  key.target.position.set(0, 0, 18);
  if (q !== 'leve') {
    key.castShadow = true;
    key.shadow.mapSize.set(q === 'alta' ? 2048 : 1024, q === 'alta' ? 2048 : 1024);
    const c = key.shadow.camera; c.left = -42; c.right = 42; c.top = 40; c.bottom = -40; c.near = 5; c.far = 140;
    key.shadow.bias = -.0005; key.shadow.normalBias = .03; key.shadow.radius = 3;
  }
  scene.add(key, key.target);
  for (const [x, z, i] of [[40, -12, .5], [-40, -12, .45], [42, 58, .4]] as const) {
    const d = new THREE.DirectionalLight(0xe8efff, i * L[5]);
    d.position.set(x, 35, z); d.target.position.set(0, 0, 20);
    scene.add(d, d.target);
  }
}

/** Sombra simples (disco escuro): na qualidade Leve é a única; nas outras, complementa a sombra real. */
export function blobShadow(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: quality() === 'leve' ? .38 : .22, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = .015;
  return m;
}
