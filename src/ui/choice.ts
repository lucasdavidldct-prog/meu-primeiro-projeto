// Menu de escolha dos lances (3D e 2D): depois de traçar a linha do chute, ou de tocar num companheiro,
// aparece um botão por opção com a chance e os estilos de jogo do jogador que ajudam naquela opção.
import type { PsTag } from '../engine/lanceScene';

/** Item do menu: nome, dica, chance e estilos que ajudam. */
export interface ItemMenu { nome: string; dica: string; p: number; ps: PsTag[] }
import { esc } from './dom';
import { haptic } from './sfx';

/** Cor da chance: verde (boa), amarelo (média), vermelho (ruim). */
export const probColor = (p: number): string => (p >= .6 ? '#56d086' : p >= .35 ? '#f2b640' : '#f06a5a');

export const choiceHTML = (): string => '<div class="m3d-choice" id="mChoice" hidden></div>';

/** Etiquetas de estilo (seu = dourado; da defesa rival = vermelho). */
export const psChips = (ps: PsTag[]): string => ps.map(t => `<span class="psc${t.rival ? ' riv' : ''}">${t.icone} ${esc(t.nome)}</span>`).join('');

/**
 * Abre o menu. `onPick` recebe a opção escolhida; tocar em Cancelar (ou fora) chama `onCancel`.
 * Devolve uma função para fechar o menu por fora.
 */
export function openChoice<T extends ItemMenu>(root: HTMLElement, title: string, ops: T[], onPick: (o: T) => void, onCancel: () => void, onFocus?: (o: T) => void): () => void {
  const box = root.querySelector<HTMLElement>('#mChoice')!;
  box.innerHTML = `<div class="ch-t">${esc(title)}</div><div class="ch-ops">${ops.map((o, i) => `<button data-i="${i}" style="--pc:${probColor(o.p)}">
      <b>${esc(o.nome)}</b><span class="ch-p">${Math.round(o.p * 100)}%</span>
      <small>${esc(o.dica)}</small>${o.ps.length ? `<span class="ch-ps">${psChips(o.ps)}</span>` : ''}</button>`).join('')}</div>
    <button class="ch-x" data-x="1">Cancelar</button>`;
  box.hidden = false;
  const close = () => { box.hidden = true; box.innerHTML = ''; box.onclick = null; };
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart'] as const) box.addEventListener(ev, e => e.stopPropagation());
  box.querySelectorAll<HTMLButtonElement>('button[data-i]').forEach(b => {
    b.addEventListener('pointerenter', () => onFocus?.(ops[+b.dataset.i!]));
    b.addEventListener('focus', () => onFocus?.(ops[+b.dataset.i!]));
  });
  box.onclick = e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    close();
    if (b.dataset.x) { onCancel(); return; }
    haptic('leve');
    onPick(ops[+b.dataset.i!]);
  };
  return close;
}
