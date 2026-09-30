// Seletor do tipo de chute nos lances (3D e 2D): Auto, Normal, Colocado, Forte, Rasteiro e Cavadinha.
// O traço continua mirando e dando força; o tipo escolhido decide como a bola vai. Lembra a última escolha.
import { SHOT_N, type LanceScene, type ShotType } from '../engine/lanceScene';
import { haptic } from './sfx';

const KEY = 'esq-chute';
const TIPOS: ShotType[] = ['auto', 'normal', 'colocado', 'forte', 'rasteiro', 'cavadinha'];
const DICA: Record<ShotType, string> = {
  auto: 'O traço decide: curvo = colocado, rápido = forte, curto e lento perto do gol = cavadinha.',
  normal: 'Chute firme, sem efeito especial.',
  colocado: 'Bola curva no canto: erra menos e engana o goleiro. Melhor de dentro e da entrada da área.',
  forte: 'Bomba: o goleiro defende menos, mas pode subir. Bom de fora da área.',
  rasteiro: 'Bola rente à grama: passa por baixo do goleiro e trava menos. Perde precisão de longe.',
  cavadinha: 'Por cima do goleiro que sai. Só de perto do gol.',
};

function saved(): ShotType {
  try { const v = localStorage.getItem(KEY) as ShotType | null; return v && TIPOS.includes(v) ? v : 'auto'; } catch { return 'auto'; }
}

export function shotBarHTML(): string {
  const cur = saved();
  return `<div class="shot-bar" id="shotBar" role="group" aria-label="Tipo de chute"><span>Chute</span>${TIPOS.map(t => `<button data-t="${t}" aria-pressed="${t === cur}">${SHOT_N[t]}</button>`).join('')}</div>`;
}

/** Liga o seletor à cena; `onChange` mostra a dica do tipo escolhido. */
export function bindShotBar(root: HTMLElement, sc: LanceScene, onChange?: (dica: string) => void): void {
  const bar = root.querySelector<HTMLElement>('#shotBar');
  if (!bar) return;
  sc.shotType = saved();
  // Tocar no seletor não pode começar um traço de chute no campo
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart'] as const) bar.addEventListener(ev, e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-t]');
    if (!b) return;
    const t = b.dataset.t as ShotType;
    sc.shotType = t;
    try { localStorage.setItem(KEY, t); } catch { /* sem armazenamento: vale só neste lance */ }
    bar.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    haptic('leve');
    onChange?.(`<b>${SHOT_N[t]}</b> · ${DICA[t]}`);
  });
}
