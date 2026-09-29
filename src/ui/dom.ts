export const fmt = (n: number): string => Math.round(n).toLocaleString('pt-BR');
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

export function openSheet(html: string, cls = '', onDismiss?: () => void): HTMLDivElement {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.id = 'sheet';
  bg.innerHTML = `<div class="sheet ${cls}" role="dialog">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) { closeSheet(); onDismiss?.(); } });
  document.body.appendChild(bg);
  return bg;
}
export function closeSheet(): void { document.getElementById('sheet')?.remove(); }
