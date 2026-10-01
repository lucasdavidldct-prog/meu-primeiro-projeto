// Enquadramento automático das câmeras dos lances: dada a direção de onde a câmera olha (giro e inclinação),
// calcula a distância mínima para que todos os pontos importantes (quem tem a bola, a bola, o gol, os companheiros
// por perto) caibam na tela com folga. Assim nenhuma câmera fica "perto demais" nem corta quem está jogando.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Direção para onde a câmera olha. `giro` em radianos (0 = olhando para o gol, -Z do mundo; +π/2 = olhando para +X,
 * isto é, câmera do lado esquerdo do campo), `incl` = quanto aponta para baixo (radianos).
 */
export function direcao(giro: number, incl: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(giro) * Math.cos(incl), -Math.sin(incl), -Math.cos(giro) * Math.cos(incl)).normalize();
}

/**
 * Posição e alvo da câmera que mostram todos os `pts` olhando na direção `f`, centrada em `foco`.
 * `fovV` em graus (vertical), `aspect` = largura/altura, `folga` < 1 deixa margem nas bordas.
 */
export function enquadrar(pts: THREE.Vector3[], foco: THREE.Vector3, f: THREE.Vector3, fovV: number, aspect: number,
  o: { folga?: number; dMin?: number; dMax?: number } = {}): [THREE.Vector3, THREE.Vector3] {
  const folga = o.folga ?? .8, ty = Math.tan(THREE.MathUtils.degToRad(fovV) / 2) * folga, tx = ty * aspect;
  const r = new THREE.Vector3().crossVectors(f, UP).normalize(), u = new THREE.Vector3().crossVectors(r, f).normalize();
  let d = o.dMin ?? 8;
  const q = new THREE.Vector3();
  for (const p of pts) {
    q.subVectors(p, foco);
    const x = q.dot(r), y = q.dot(u), z = q.dot(f);
    d = Math.max(d, Math.abs(x) / tx - z, Math.abs(y) / ty - z);
  }
  d = Math.min(d, o.dMax ?? 90);
  // A câmera não sai do estádio (atrás da arquibancada ela veria o telhado): se não couber, ela chega mais perto
  const pos = foco.clone().addScaledVector(f, -d);
  while (d > (o.dMin ?? 8) && !dentro(pos)) { d *= .94; pos.copy(foco).addScaledVector(f, -d); }
  return [pos, foco.clone()];
}

/** Dentro do estádio: entre as arquibancadas laterais, na frente da de trás do gol e abaixo da cobertura. */
export const dentro = (p: THREE.Vector3): boolean => Math.abs(p.x) < 43 && p.z > -8 && p.z < 108 && p.y < 19.5;

/** Centro ponderado (o primeiro ponto, normalmente quem tem a bola, pesa `pesoPrimeiro`). */
export function centro(pts: THREE.Vector3[], pesoPrimeiro = 2): THREE.Vector3 {
  const c = new THREE.Vector3();
  let w = 0;
  pts.forEach((p, i) => { const k = i ? 1 : pesoPrimeiro; c.addScaledVector(p, k); w += k; });
  return c.multiplyScalar(1 / Math.max(w, 1e-6));
}
