// Suas músicas no jogo: você escolhe arquivos de áudio do aparelho (MP3, M4A, OGG…) e o jogo toca a playlist
// (embaralhada) nos menus e, se quiser, durante as partidas. Os arquivos ficam no IndexedDB, só neste aparelho.
import { app, render, save } from './ctx';
import { esc, toast } from './dom';

interface Faixa { id: string; nome: string; blob: Blob }
const DB = 'esq-musicas', ST = 'faixas';
let faixas: { id: string; nome: string }[] = [];
let carregou = false;
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
let fila: string[] = [], atual: string | null = null, url: string | null = null, contexto: 'menu' | 'jogo' = 'menu', liberado = false;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, erro) => { const r = f(db.transaction(ST, modo).objectStore(ST)); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
}

const opcoes = () => (app.S.musica ??= { menu: true, jogo: false, vol: .6 });

/** Carrega a lista de faixas (só os nomes) ao abrir o jogo. */
export async function initMusica(): Promise<void> {
  try {
    const todas = await tx<Faixa[]>('readonly', s => s.getAll() as IDBRequest<Faixa[]>);
    faixas = todas.map(f => ({ id: f.id, nome: f.nome }));
  } catch { faixas = []; }
  carregou = true;
  // O navegador só deixa tocar depois do primeiro toque na tela
  const solta = () => { liberado = true; tocarSePuder(); window.removeEventListener('pointerdown', solta, true); };
  window.addEventListener('pointerdown', solta, true);
  if (audio) audio.onended = () => { atual = null; tocarSePuder(); };
}

/** Menus ou partida: a música toca conforme o que você ligou para cada um. */
export function musicaContexto(c: 'menu' | 'jogo'): void { contexto = c; tocarSePuder(); }

async function tocarSePuder(): Promise<void> {
  if (!audio) return;
  const o = opcoes(), quer = faixas.length > 0 && (contexto === 'menu' ? o.menu : o.jogo);
  audio.volume = Math.max(0, Math.min(1, o.vol));
  if (!quer) { audio.pause(); return; }
  if (!liberado) return;
  if (atual && audio.src) { if (audio.paused) void audio.play().catch(() => {}); return; }
  if (!fila.length) fila = faixas.map(f => f.id).sort(() => Math.random() - .5);
  const id = fila.shift()!;
  try {
    const f = await tx<Faixa | undefined>('readonly', s => s.get(id) as IDBRequest<Faixa | undefined>);
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f.blob); atual = id;
    audio.src = url;
    await audio.play();
  } catch { atual = null; }
}

const tocandoNome = () => faixas.find(f => f.id === atual)?.nome;

export function musicaHTML(): string {
  const o = opcoes();
  if (!carregou) return '<p class="small muted">Carregando suas músicas…</p>';
  return `<div class="mus">
    <div class="opt-row"><span>🎵 Suas músicas</span><button class="btn" data-act="musAdd">+ Adicionar</button></div>
    <input type="file" id="musFile" accept="audio/*" multiple hidden>
    <p class="small muted" style="margin:2px 0 8px">Escolha arquivos de música do seu celular (MP3, M4A…). Eles ficam guardados só neste aparelho.</p>
    ${faixas.length ? `<div class="mus-list">${faixas.map(f => `<div class="mus-item ${f.id === atual ? 'on' : ''}"><span>${f.id === atual ? '▶ ' : ''}${esc(f.nome)}</span><button class="chip x" data-act="musDel" data-id="${f.id}" aria-label="Remover ${esc(f.nome)}">×</button></div>`).join('')}</div>
    <div class="opt-row"><span>Tocar nos menus</span><button class="chip" data-act="musTog" data-k="menu" aria-pressed="${o.menu}">${o.menu ? 'Sim' : 'Não'}</button></div>
    <div class="opt-row"><span>Tocar nas partidas</span><button class="chip" data-act="musTog" data-k="jogo" aria-pressed="${o.jogo}">${o.jogo ? 'Sim' : 'Não'}</button></div>
    <div class="opt-row"><span>Volume</span><input type="range" id="musVol" min="0" max="100" value="${Math.round(o.vol * 100)}" style="width:140px"></div>
    <div class="row" style="gap:8px;margin-top:6px"><button class="btn" style="flex:1" data-act="musPlay">${audio && !audio.paused ? '⏸ Pausar' : '▶ Tocar'}</button><button class="btn" style="flex:1" data-act="musNext">⏭ Próxima</button></div>
    ${tocandoNome() ? `<p class="small muted" style="margin:6px 0 0">Tocando: <b>${esc(tocandoNome()!)}</b></p>` : ''}` : '<p class="small muted" style="margin:0">Nenhuma música ainda.</p>'}
  </div>`;
}

/** Liga o seletor de arquivos e o volume (chame depois de desenhar a tela). */
export function bindMusica(root: HTMLElement): void {
  const inp = root.querySelector<HTMLInputElement>('#musFile');
  if (inp) inp.onchange = async () => {
    const files = [...(inp.files ?? [])].filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|wav|flac|opus)$/i.test(f.name));
    if (!files.length) return;
    try {
      for (const f of files) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nome = f.name.replace(/\.[^.]+$/, '');
        await tx('readwrite', s => s.put({ id, nome, blob: f }));
        faixas.push({ id, nome });
      }
      toast(`${files.length} música${files.length > 1 ? 's' : ''} adicionada${files.length > 1 ? 's' : ''}`);
      fila = []; liberado = true; void tocarSePuder();
    } catch { toast('Não deu para guardar a música (espaço cheio?)'); }
    render();
  };
  const vol = root.querySelector<HTMLInputElement>('#musVol');
  if (vol) vol.oninput = () => { opcoes().vol = +vol.value / 100; if (audio) audio.volume = opcoes().vol; save(); };
}

export const musicaActions: Record<string, (d: DOMStringMap) => void> = {
  musAdd() { document.querySelector<HTMLInputElement>('#musFile')?.click(); },
  async musDel(d) {
    const id = d.id!;
    try { await tx('readwrite', s => s.delete(id)); } catch { /* já não existia */ }
    faixas = faixas.filter(f => f.id !== id); fila = fila.filter(x => x !== id);
    if (atual === id && audio) { audio.pause(); audio.removeAttribute('src'); atual = null; void tocarSePuder(); }
    render();
  },
  musTog(d) { const o = opcoes(), k = d.k as 'menu' | 'jogo'; o[k] = !o[k]; save(); void tocarSePuder(); render(); },
  musPlay() {
    if (!audio) return;
    liberado = true;
    if (!audio.paused) audio.pause(); else if (atual) void audio.play().catch(() => {}); else void tocarSePuder();
    setTimeout(render, 50);
  },
  musNext() { if (!audio) return; liberado = true; audio.pause(); atual = null; void tocarSePuder().then(render); },
};
