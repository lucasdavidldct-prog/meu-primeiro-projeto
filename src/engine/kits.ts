// Uniformes: quando as cores dos dois times se confundem (ex.: Galo x Botafogo), o adversário joga de reserva.

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}
/** Distância perceptiva aproximada entre duas cores (0 a ~765). */
export function colorDist(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b), rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
}
/** Quão parecidos são dois uniformes (camisa pesa mais que o detalhe). */
const kitDist = (a: [string, string], b: [string, string]) => colorDist(a[0], b[0]);

const RESERVAS: [string, string][] = [['#f4f4f4', '#1b1b1b'], ['#1d4fd8', '#ffffff'], ['#f2c21b', '#15306b'], ['#c62828', '#ffffff'], ['#1b1b1b', '#f2c21b'], ['#0f8a5f', '#ffffff']];
const LIMITE = 200;

/** Cores do adversário na partida: o uniforme dele, o invertido (detalhe vira camisa) ou um reserva bem diferente do seu. */
export function awayKit(mine: [string, string], theirs: [string, string]): [string, string] {
  if (kitDist(mine, theirs) >= LIMITE) return theirs;
  const inv: [string, string] = [theirs[1], theirs[0]];
  if (kitDist(mine, inv) >= LIMITE) return inv;
  return RESERVAS.reduce((best, k) => (kitDist(mine, k) > kitDist(mine, best) ? k : best));
}
