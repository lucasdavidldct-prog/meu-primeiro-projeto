// Arrastar cartas no campo/reservas para trocar de posição.
// Celular: segure a carta (~0,3 s) e arraste. Mouse: clique e arraste.
import { haptic } from './sfx';

export interface DropTarget { kind: 'xi' | 'bench'; i: number }

const HOLD_MS = 280;

interface DragState {
  u: number; src: HTMLElement; id: number; mouse: boolean;
  x0: number; y0: number; timer?: ReturnType<typeof setTimeout>;
  active: boolean; ghost?: HTMLElement; dx: number; dy: number; over?: HTMLElement | null;
}

function targetOf(el: HTMLElement | null): DropTarget | null {
  const a = el?.dataset.act;
  if (a === 'slot') return { kind: 'xi', i: +el!.dataset.i! };
  if (a === 'bslot') return { kind: 'bench', i: +el!.dataset.i! };
  return null;
}

/** Liga o arrastar dentro de `root` (delegado: vale para qualquer renderização da tela Time). */
export function initSquadDrag(root: HTMLElement, onDrop: (to: DropTarget, u: number) => void): void {
  let st: DragState | null = null;
  let swallowClick = false;

  const cleanup = () => {
    if (!st) return;
    clearTimeout(st.timer);
    st.ghost?.remove();
    st.src.classList.remove('dragging');
    st.over?.classList.remove('drop-over');
    document.body.classList.remove('is-dragging');
    st = null;
  };

  const activate = () => {
    if (!st || st.active) return;
    const card = st.src.querySelector<HTMLElement>('.card');
    if (!card) { cleanup(); return; }
    const r = card.getBoundingClientRect();
    const g = card.cloneNode(true) as HTMLElement;
    g.classList.add('drag-ghost');
    g.style.setProperty('--w', `${r.width}px`);
    st.dx = st.x0 - r.left; st.dy = st.y0 - r.top;
    g.style.left = `${r.left}px`; g.style.top = `${r.top}px`;
    document.body.appendChild(g);
    st.ghost = g; st.active = true;
    st.src.classList.add('dragging');
    document.body.classList.add('is-dragging');
    haptic('leve');
  };

  const slotAt = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const s = el?.closest<HTMLElement>('.slot');
    return s && root.contains(s) && s !== st?.src ? s : null;
  };

  root.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot[data-u]');
    if (!slot || !root.contains(slot)) return;
    cleanup();
    const mouse = e.pointerType === 'mouse';
    st = { u: +slot.dataset.u!, src: slot, id: e.pointerId, mouse, x0: e.clientX, y0: e.clientY, active: false, dx: 0, dy: 0 };
    if (!mouse) st.timer = setTimeout(activate, HOLD_MS);
  });

  window.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    const d = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
    if (!st.active) {
      if (st.mouse && d > 6) activate();
      else if (!st.mouse && d > 10) { cleanup(); return; } // mexeu antes de segurar: é rolagem da tela
      if (!st?.active) return;
    }
    st.ghost!.style.left = `${e.clientX - st.dx}px`;
    st.ghost!.style.top = `${e.clientY - st.dy}px`;
    const over = slotAt(e.clientX, e.clientY);
    if (over !== st.over) { st.over?.classList.remove('drop-over'); over?.classList.add('drop-over'); st.over = over; }
  });

  window.addEventListener('pointerup', e => {
    if (!st || e.pointerId !== st.id) return;
    if (st.active) {
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); // o clique sai logo após soltar, na mesma rodada
      const to = targetOf(slotAt(e.clientX, e.clientY)), u = st.u;
      cleanup();
      if (to) onDrop(to, u);
    } else cleanup();
  });
  window.addEventListener('pointercancel', e => { if (st && e.pointerId === st.id) cleanup(); });

  // Durante o arrasto a tela não rola; o clique que vem depois de soltar não abre a lista de jogadores.
  window.addEventListener('touchmove', e => { if (st?.active) e.preventDefault(); }, { passive: false });
  document.addEventListener('click', e => { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  root.addEventListener('contextmenu', e => { if (st) e.preventDefault(); });
}
