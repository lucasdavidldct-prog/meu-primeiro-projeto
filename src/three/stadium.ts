// Estádio à noite: gramado com textura de corte, marcações oficiais, gol com rede, arquibancadas em degraus com cobertura,
// torcida que se mexe, placas de LED, refletores e céu. O nível de detalhe segue a qualidade gráfica (quality.ts).
// Coordenadas 3D: X = largura (0 no meio do gol), Z = distância da linha de fundo (gol em Z = 0), Y = altura.
import * as THREE from 'three';
import { quality } from './qualityLevel';

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

/** Textura do gramado: faixas de corte de 5,25 m, granulado e um leve xadrez do corte cruzado. */
function grassTexture(): THREE.CanvasTexture {
  const q = quality(), W = q === 'alta' ? 1024 : 512, H = W * 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const bands = 24, bh = H / bands;
  for (let i = 0; i < bands; i++) { x.fillStyle = i % 2 ? '#2c7d47' : '#256d3d'; x.fillRect(0, i * bh, W, bh); }
  // Corte cruzado bem suave
  x.globalAlpha = .05; x.fillStyle = '#000';
  for (let i = 0; i < 12; i += 2) x.fillRect(i * W / 12, 0, W / 12, H);
  x.globalAlpha = 1;
  // Granulado: fios de grama claros e escuros
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - .5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + n * .6)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * .5));
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = q === 'leve' ? 1 : 8;
  return t;
}

export function buildPitch(): THREE.Group {
  const g = new THREE.Group();
  // Entorno do campo: grama mais escura e a pista
  const base = new THREE.Mesh(new THREE.PlaneGeometry(140, 150), new THREE.MeshStandardMaterial({ color: 0x14361f, roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.set(0, -.02, 35); base.receiveShadow = true;
  g.add(base);
  const track = new THREE.MeshStandardMaterial({ color: 0x1b2330, roughness: .95 });
  for (const [w, h, x, z] of [[84, 6, 0, -7], [6, 80, -41, 36], [6, 80, 41, 36]] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), track); m.rotation.x = -Math.PI / 2; m.position.set(x, -.01, z); m.receiveShadow = true; g.add(m);
  }
  // Campo: 68 × 126 (de 0 até além do meio de campo) com a textura de corte
  const field = new THREE.Mesh(new THREE.PlaneGeometry(76, 126), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: .92, metalness: 0 }));
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
  g.add(adBoards());
  return g;
}

/** Placas de LED em volta do campo (texto próprio do jogo). */
function adBoards(): THREE.Group {
  const g = new THREE.Group();
  const mk = (text: string, a: string, b: string) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
    const x = c.getContext('2d')!;
    const gr = x.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, a); gr.addColorStop(1, b);
    x.fillStyle = gr; x.fillRect(0, 0, 1024, 64);
    x.fillStyle = 'rgba(255,255,255,.95)'; x.font = '800 40px "Saira Extra Condensed", Impact, sans-serif'; x.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) x.fillText(text, 20 + i * 345, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .75, roughness: .6 });
  };
  const mats = [mk('ESQUADRÃO FC', '#0d3b2a', '#1d7a4f'), mk('TEMPORADA 2026', '#1b1f5c', '#3a44b8'), mk('FUTEBOL DE CARTAS', '#5c1b1b', '#b8433a'), mk('GALO', '#101010', '#3a3a3a')];
  let k = 0;
  // Atrás do gol (com vão no meio para a rede) e nas laterais
  for (const [x, z, w, ry] of [[-22, -5, 26, 0], [22, -5, 26, 0], [-38.5, 12, 24, Math.PI / 2], [-38.5, 38, 24, Math.PI / 2], [38.5, 12, 24, -Math.PI / 2], [38.5, 38, 24, -Math.PI / 2]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, .9, .15), mats[k++ % mats.length]);
    b.position.set(x, .45, z); b.rotation.y = ry; b.castShadow = quality() === 'alta';
    g.add(b);
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
  const amp = .55 * (1 - Math.exp(-t * 14)) * Math.exp(-t * 1.6) + .12 * Math.exp(-t * 1.2) * Math.sin(t * 13);
  const pos = net.geo.getAttribute('position') as THREE.BufferAttribute, a = pos.array as Float32Array, b = net.base, { x: hx, y: hy } = net.hit;
  for (let i = 0; i < a.length; i += 3) {
    const x = b[i], y = b[i + 1], z = b[i + 2];
    const fundo = Math.min(1, -z / 2); // os fios do fundo mexem mais; os presos às traves quase nada
    const w = Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / 1.3) * fundo;
    a[i + 2] = z - amp * w; a[i + 1] = y - amp * .25 * w * Math.max(0, y - .1) / 2.44;
  }
  pos.needsUpdate = true;
}

let crowdMat: THREE.MeshStandardMaterial | null = null;
let crowdShader: { uniforms: { uTime: { value: number }; uAmp: { value: number } } } | null = null;

export function buildStadium(): THREE.Group {
  const g = new THREE.Group(), q = quality();
  // Céu noturno com degradê e estrelas
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x03060d) }, mid: { value: new THREE.Color(0x0b1830) }, hor: { value: new THREE.Color(0x24324a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, mid, smoothstep(0.0,0.18,h)); c = mix(c, top, smoothstep(0.18,0.7,h)); gl_FragColor = vec4(c,1.0); }',
  }));
  g.add(sky);
  if (q !== 'leve') {
    const sp: number[] = [];
    for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, e = .25 + Math.random() * 1.2; sp.push(Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .7 })));
  }
  // Arquibancadas em degraus: atrás do gol e nas duas laterais
  const concrete = new THREE.MeshStandardMaterial({ color: 0x1f2631, roughness: .9 });
  const seatA = new THREE.MeshStandardMaterial({ color: 0x2b3444, roughness: .8 }), seatB = new THREE.MeshStandardMaterial({ color: 0x232b38, roughness: .8 });
  const STEPS = 12, stepH = 1.05, stepD = 1.25;
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
    const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 4, .4, STEPS * stepD + 6), new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: .7, metalness: .3 }));
    roof.position.set(0, STEPS * stepH + 5, -STEPS * stepD / 2 + 1); roof.rotation.x = -.08; stand.add(roof);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(s.w, .12, .3), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
    strip.position.set(0, STEPS * stepH + 4.7, 3.5); stand.add(strip);
    g.add(stand);
    stand.updateMatrixWorld(true);
    for (let i = 0; i < STEPS; i++) for (let k = 0; k < s.w / .7; k++) {
      const v = new THREE.Vector3(-s.w / 2 + .35 + k * .7, 1.1 + i * stepH + .35, -i * stepD);
      seatSpots.push({ p: v.applyMatrix4(stand.matrixWorld), ry: s.ry });
    }
  }
  // Torcida: bonecos com cores variadas (instanced), balançando de leve; na qualidade leve, só pontos
  const N = Math.min(seatSpots.length, q === 'alta' ? 9000 : q === 'media' ? 4200 : 2400);
  const col = new THREE.Color(), shirts = [0x111111, 0xf2f2f2, 0x1f1f1f, 0xe8e8e8, 0xe8c35f, 0x2a5bd7, 0xc93b30, 0x2f8f55];
  if (q === 'leve') {
    const pts: number[] = [], cols: number[] = [];
    for (let i = 0; i < N; i++) { const s = seatSpots[Math.floor(Math.random() * seatSpots.length)]; pts.push(s.p.x, s.p.y, s.p.z); col.setHex(shirts[i % shirts.length]); cols.push(col.r, col.g, col.b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: .55, vertexColors: true })));
  } else {
    crowdMat = new THREE.MeshStandardMaterial({ roughness: .85 });
    crowdMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = { value: 0 }; sh.uniforms.uAmp = { value: .05 };
      crowdShader = sh as unknown as typeof crowdShader;
      sh.vertexShader = 'uniform float uTime; uniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  float ph = float(gl_InstanceID) * 1.618;\n  transformed.y += max(0.0, sin(uTime * 5.0 + ph)) * uAmp * (1.0 + mod(ph, 1.0));');
    };
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(.42, .72, .28), crowdMat, N);
    const m4 = new THREE.Matrix4(), used = new Set<number>();
    for (let i = 0; i < N; i++) {
      let j = Math.floor(Math.random() * seatSpots.length);
      for (let t = 0; t < 4 && used.has(j); t++) j = Math.floor(Math.random() * seatSpots.length);
      used.add(j);
      const s = seatSpots[j];
      m4.makeRotationY(s.ry + (Math.random() - .5) * .3); m4.setPosition(s.p.x + (Math.random() - .5) * .2, s.p.y, s.p.z);
      body.setMatrixAt(i, m4);
      col.setHex(shirts[Math.floor(Math.random() * shirts.length)]).offsetHSL(0, 0, (Math.random() - .5) * .12);
      body.setColorAt(i, col);
    }
    g.add(body);
  }
  // Torres de refletores: painel que brilha (bloom na qualidade Alta) e halo
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: .6, metalness: .5 });
  const glow = new THREE.SpriteMaterial({ color: 0xfff6d8, transparent: true, opacity: q === 'alta' ? .55 : .85, depthWrite: false });
  for (const [x, z] of [[-50, -16], [50, -16], [-50, 62], [50, 62]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, 34, 10), steel); pole.position.set(x, 17, z); g.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, .5), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }));
    panel.position.set(x, 34, z); panel.lookAt(0, 0, 25); g.add(panel);
    const s = new THREE.Sprite(glow); s.scale.set(20, 20, 1); s.position.set(x, 34, z); g.add(s);
  }
  return g;
}

/** Anima a torcida (chame a cada quadro). `festa` = torcida pulando (gol, lance perigoso). */
export function tickStadium(timeMs: number, festa = false): void {
  if (!crowdShader) return;
  crowdShader.uniforms.uTime.value = timeMs / 1000;
  crowdShader.uniforms.uAmp.value += ((festa ? .45 : .05) - crowdShader.uniforms.uAmp.value) * .08;
}

export function addLights(scene: THREE.Scene): void {
  const q = quality();
  scene.add(new THREE.HemisphereLight(0xa8bddc, 0x0d1f14, q === 'leve' ? .75 : .55));
  scene.add(new THREE.AmbientLight(0xffffff, .12));
  // Luz principal dos refletores, com sombra (Alta/Média)
  const key = new THREE.DirectionalLight(0xfff1d6, q === 'leve' ? 1 : 1.55);
  key.position.set(-26, 42, 58); key.target.position.set(0, 0, 18);
  if (q !== 'leve') {
    key.castShadow = true;
    key.shadow.mapSize.set(q === 'alta' ? 2048 : 1024, q === 'alta' ? 2048 : 1024);
    const c = key.shadow.camera; c.left = -42; c.right = 42; c.top = 40; c.bottom = -40; c.near = 5; c.far = 140;
    key.shadow.bias = -.0005; key.shadow.normalBias = .03; key.shadow.radius = 3;
  }
  scene.add(key, key.target);
  for (const [x, z, i] of [[40, -12, .5], [-40, -12, .45], [42, 58, .4]] as const) {
    const d = new THREE.DirectionalLight(0xe8efff, i);
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
