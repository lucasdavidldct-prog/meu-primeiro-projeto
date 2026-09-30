// Editor de elencos: corrige jogador, clube, rating e playstyles.
// Com npm run dev, grava direto em data/ligas/<liga>.json; sem servidor, guarda as edições no IndexedDB.
import { clearCardCache } from '../engine/cards';
import { blankPlayer, findClub, findPlayer, newPlayerId, transferPlayer } from '../engine/data/edit';
import { formatLiga } from '../engine/data/format';
import { ATR_GOL, ATR_LINHA, PLAYSTYLES, PLUS_MIN_OVR, PS_BY_ID, parsePs, type JogadorData, type LigaData } from '../engine/data/schema';
import { validarDados, validarJogador } from '../engine/data/validate';
import { POSS, PROFILE } from '../engine/positions';
import { clearStrengthCache } from '../engine/squads';
import { sanitizeState } from '../engine/state';
import type { Pos } from '../engine/types';
import { NACOES, W, loadWorld } from '../engine/world';
import { discardEditedLiga, loadEditedLigas, saveEditedLiga } from '../save/dados';
import { crestHTML } from './crest';
import { app, render, save } from './ctx';
import { closeSheet, esc, openSheet, toast } from './dom';

const ed = {
  liga: 'brasileirao',
  club: null as string | null,
  q: '',
  dev: null as boolean | null,
  local: new Set<string>(),
  working: [] as LigaData[],
  draft: null as (JogadorData & { _club: string; _new: boolean }) | null,
};
const RETURN_KEY = 'esquadrao-editor-voltar';
const POS_NOME: Record<string, string> = { GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lateral direito', LE: 'Lateral esquerdo', VOL: 'Volante', MC: 'Meio-campo', MEI: 'Meia', MD: 'Meia direita', ME: 'Meia esquerda', PD: 'Ponta direita', PE: 'Ponta esquerda', ATA: 'Atacante' };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function openEditor(): Promise<void> {
  ed.working = structuredClone(W.ligas);
  try { ed.local = new Set(Object.keys(await loadEditedLigas())); } catch { ed.local = new Set(); }
  if (ed.dev === null) {
    try { ed.dev = (await fetch('/__dados/ping')).ok; } catch { ed.dev = false; }
  }
  app.tab = 'editor';
  render();
  window.scrollTo(0, 0);
}

/** Depois de um reload causado pela gravação do arquivo, volta para o clube que estava sendo editado. */
export function resumeEditorIfNeeded(): void {
  let v: string | null = null;
  try { v = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* sem sessionStorage */ }
  if (!v) return;
  try { const o = JSON.parse(v) as { liga: string; club: string | null; msg?: string }; ed.liga = o.liga; ed.club = o.club; void openEditor().then(() => o.msg && toast(o.msg)); } catch { /* ignora */ }
}

const liga = () => ed.working.find(l => l.id === ed.liga) ?? ed.working[0];

export function viewEditor(): string {
  const L = liga();
  const status = `<div class="panel small">
    ${ed.dev ? '<p style="margin:0">✅ <b>Servidor local ativo</b>: cada correção é gravada direto em <code>data/ligas/*.json</code>.</p>'
      : '<p style="margin:0">💾 Sem servidor local (rode <code>npm run dev</code> no computador para gravar nos arquivos). As correções ficam salvas neste navegador e podem ser baixadas em JSON.</p>'}
    ${ed.local.size ? `<p class="muted" style="margin:8px 0 0">Edições locais em: ${[...ed.local].map(id => `<b>${esc(ed.working.find(l => l.id === id)?.nome ?? id)}</b> <button class="chip" data-act="edDiscard" data-l="${id}">Descartar</button>`).join(' ')}</p>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn" data-act="edDownload" data-l="${L.id}">Baixar ${esc(L.id)}.json</button><button class="btn" data-act="edCheck">Validar tudo</button></div>
  </div>`;
  const head = `<div class="row" style="justify-content:space-between;margin-top:14px"><h2 style="margin:0">Editor de elencos</h2><button class="btn" data-act="edBack">${ed.club ? 'Voltar à liga' : 'Fechar'}</button></div>`;
  if (ed.club) return head + viewClub() ;
  const q = ed.q.trim();
  let results = '';
  if (q.length >= 2) {
    const nq = norm(q), out: { j: JogadorData; c: string; l: string }[] = [];
    for (const l of ed.working) for (const c of l.clubes) for (const j of c.elenco) if (norm(j.nome).includes(nq) || norm(j.nomeCurto).includes(nq)) out.push({ j, c: c.id, l: l.nome });
    results = `<div class="plist" style="margin-top:8px">${out.slice(0, 40).map(r => rowHTML(r.j, `${r.c} · ${esc(r.l)}`)).join('') || '<p class="empty-note">Ninguém encontrado.</p>'}</div>`;
  }
  return `${head}
  <p class="small muted" style="margin:4px 0 10px">Corrija transferências, ratings e playstyles. Os dados vêm de <code>data/ligas</code>.</p>
  ${status}
  <h3>Buscar jogador</h3>
  <input id="edQ" type="search" placeholder="Nome do jogador…" value="${esc(ed.q)}" style="width:100%" autocomplete="off">
  <div id="edResults">${results}</div>
  <h3>Ligas</h3>
  <div class="chips">${ed.working.map(l => `<button class="chip" data-act="edLiga" data-l="${l.id}" aria-pressed="${l.id === L.id}">${esc(l.nome)}</button>`).join('')}</div>
  <div class="club-grid">${L.clubes.map(c => `<button class="club-tile" data-act="edClub" data-c="${c.id}">${crestHTML({ n: c.nome, s: c.sigla, c1: c.cores[0], c2: c.cores[1] }, 'mid')}<b>${esc(c.nome)}</b><span class="muted small">${c.elenco.length} jogadores</span></button>`).join('')}</div>`;
}

function rowHTML(j: JogadorData, meta: string): string {
  return `<button class="prow" data-act="edPlayer" data-id="${esc(j.id)}"><span class="pos-pill">${j.posicao}</span><div style="min-width:0"><div class="nm">${esc(j.nome)}</div><div class="meta">${esc(j.nomeCurto)} · ${esc(NACOES[j.nacionalidade]?.nome ?? j.nacionalidade)} · ${j.idade} anos · ${meta}</div></div><div class="right"><b>${j.overall}</b><div>${j.playstyles.length ? j.playstyles.map(p => PS_BY_ID.get(parsePs(p).id)?.icone ?? '').join('') : ''}</div></div></button>`;
}

function viewClub(): string {
  const f = findClub(ed.working, ed.club!);
  if (!f) { ed.club = null; return viewEditor(); }
  const c = f.clube, order = POSS;
  const el = [...c.elenco].sort((a, b) => order.indexOf(a.posicao) - order.indexOf(b.posicao) || b.overall - a.overall);
  return `<div class="panel" style="margin-top:10px">
    <div class="row" style="gap:12px;align-items:flex-start">${crestHTML({ n: c.nome, s: c.sigla, c1: c.cores[0], c2: c.cores[1] }, 'mid')}
      <div style="flex:1;min-width:0;display:grid;gap:8px">
        <label class="small muted">Nome<input id="edCNome" value="${esc(c.nome)}" style="width:100%"></label>
        <label class="small muted">Cidade<input id="edCCidade" value="${esc(c.cidade)}" style="width:100%"></label>
        <div class="row"><label class="small muted">Cor 1 <input id="edCor1" type="color" value="${c.cores[0]}"></label><label class="small muted">Cor 2 <input id="edCor2" type="color" value="${c.cores[1]}"></label><span class="small muted">Sigla: <b>${c.sigla}</b></span></div>
      </div></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="edSaveClub">Salvar clube</button><button class="btn pri" data-act="edNew">+ Adicionar jogador</button></div>
    <p class="small muted" style="margin:8px 0 0">Escudo próprio: coloque <code>public/escudos/${c.sigla}.png</code>.</p>
  </div>
  <h3>Elenco (${c.elenco.length})</h3>
  <div class="plist">${el.map(j => rowHTML(j, POS_NOME[j.posicao])).join('') || '<p class="empty-note">Elenco vazio.</p>'}</div>`;
}

// ---------- Ficha do jogador ----------
function openPlayer(id: string | null): void {
  let j: JogadorData, club: string, isNew = false;
  if (id) {
    const loc = findPlayer(ed.working, id);
    if (!loc) { toast('Jogador não encontrado'); return; }
    j = structuredClone(loc.clube.elenco[loc.idx]); club = loc.clube.id;
  } else {
    club = ed.club!; isNew = true;
    j = blankPlayer(newPlayerId(ed.working, club, 'novo'));
  }
  ed.draft = { ...j, _club: club, _new: isNew };
  drawSheet();
}

function drawSheet(errs: string[] = []): void {
  const d = ed.draft!;
  const keys = d.posicao === 'GOL' ? ATR_GOL : ATR_LINHA;
  const nac = Object.entries(NACOES).sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
  const clubs = ed.working.map(l => `<optgroup label="${esc(l.nome)}">${l.clubes.map(c => `<option value="${c.id}" ${c.id === d._club ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('');
  const psState = (id: string) => d.playstyles.includes(id + '+') ? 2 : d.playstyles.includes(id) ? 1 : 0;
  const psList = PLAYSTYLES.filter(p => p.gol === (d.posicao === 'GOL'));
  openSheet(`<h2>${d._new ? 'Novo jogador' : esc(d.nome || d.nomeCurto)}</h2>
   ${errs.length ? `<div class="tip" style="border-color:var(--bad)">${errs.map(esc).join('<br>')}</div>` : ''}
   <div class="form-grid">
    <label>Nome completo<input id="fNome" value="${esc(d.nome)}"></label>
    <label>Nome curto (carta)<input id="fCurto" value="${esc(d.nomeCurto)}" maxlength="16"></label>
    <label>Nacionalidade<select id="fNac">${nac.map(([k, v]) => `<option value="${k}" ${k === d.nacionalidade ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select></label>
    <label>Idade<input id="fIdade" type="number" min="15" max="45" value="${d.idade}"></label>
    <label>Posição<select id="fPos">${POSS.map(p => `<option value="${p}" ${p === d.posicao ? 'selected' : ''}>${p} · ${POS_NOME[p]}</option>`).join('')}</select></label>
    <label>Pé bom<select id="fPe">${[['D', 'Direito'], ['E', 'Esquerdo'], ['A', 'Ambidestro']].map(([k, n]) => `<option value="${k}" ${k === d.pe ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Overall<input id="fOvr" type="number" min="40" max="99" value="${d.overall}"></label>
   </div>
   ${d.posicao === 'GOL' ? '' : `<div class="small muted" style="margin-top:10px">Posições alternativas</div><div class="chips" style="flex-wrap:wrap">${POSS.filter(p => p !== 'GOL' && p !== d.posicao).map(p => `<button class="chip" data-act="edAlt" data-p="${p}" aria-pressed="${d.posicoesAlt.includes(p)}">${p}</button>`).join('')}</div>`}
   <div class="row" style="justify-content:space-between;margin-top:12px"><span class="small muted">Atributos</span><button class="chip" data-act="edAuto">Estimar pelo overall</button></div>
   <div class="attr-grid">${keys.map(k => `<label>${k}<input id="fA${k}" type="number" min="1" max="99" value="${d.atributos[k] ?? 50}"></label>`).join('')}</div>
   <div class="small muted" style="margin-top:12px">Playstyles (até 4). Toque para alternar: desligado → normal → <b>+</b> (só overall ${PLUS_MIN_OVR}+).</div>
   <div class="chips" style="flex-wrap:wrap">${psList.map(p => { const s = psState(p.id); return `<button class="chip ps-chip s${s}" data-act="edPs" data-id="${p.id}" aria-pressed="${s > 0}" title="${esc(p.desc)}">${p.icone} ${esc(p.nome)}${s === 2 ? ' +' : ''}</button>`; }).join('')}</div>
   <div class="row" style="margin-top:16px"><button class="btn pri" style="flex:1" data-act="edSave">Salvar</button></div>
   ${d._new ? '' : `<h3>Transferência</h3><div class="row"><select id="fDest" style="flex:1;min-width:0">${clubs}</select><button class="btn" data-act="edTransfer">Transferir</button></div>
   <div class="row" style="margin-top:14px"><button class="btn danger" data-act="edRemove">Remover jogador</button></div>`}`);
  document.getElementById('fPos')?.addEventListener('change', () => { readForm(); drawSheet(); });
}

function readForm(): void {
  const d = ed.draft!;
  const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
  const oldKeys = d.posicao === 'GOL' ? ATR_GOL : ATR_LINHA;
  const vals = oldKeys.map(k => +v('fA' + k) || d.atributos[k] || 50);
  d.nome = v('fNome').trim(); d.nomeCurto = v('fCurto').trim(); d.nacionalidade = v('fNac');
  d.idade = Math.round(+v('fIdade')); d.pe = v('fPe') as JogadorData['pe']; d.overall = Math.round(+v('fOvr'));
  const newPos = v('fPos') as Pos;
  if ((newPos === 'GOL') !== (d.posicao === 'GOL')) {
    d.posicoesAlt = []; d.playstyles = [];
    d.posicao = newPos; d.atributos = estimate(newPos, d.overall);
  } else {
    d.posicao = newPos;
    d.posicoesAlt = d.posicoesAlt.filter(p => p !== newPos);
    d.atributos = Object.fromEntries(oldKeys.map((k, i) => [k, Math.round(vals[i])]));
  }
}

/** Atributos coerentes com a posição e o overall (mesma regra usada para gerar os dados). */
function estimate(pos: Pos, ovr: number): Record<string, number> {
  const keys = pos === 'GOL' ? ATR_GOL : ATR_LINHA;
  return Object.fromEntries(PROFILE[pos].map((w, i) => [keys[i], Math.max(25, Math.min(99, Math.round(ovr + (w - .9) * 40 - Math.max(0, .6 - w) * 50)))]));
}

async function persist(changed: LigaData[], msg: string): Promise<void> {
  // Mundo em memória sempre reflete a cópia de trabalho.
  loadWorld(structuredClone(ed.working));
  clearCardCache(); clearStrengthCache();
  const lost = sanitizeState(app.S);
  if (lost) toast(`${lost} carta(s) saíram da coleção`);
  save();
  let wrote = 0;
  for (const l of changed) {
    if (ed.dev) {
      try {
        const r = await fetch(`/__dados/ligas/${l.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(l) });
        if (r.ok) { wrote++; await discardEditedLiga(l.id).catch(() => {}); ed.local.delete(l.id); continue; }
      } catch { /* cai para o IndexedDB */ }
    }
    await saveEditedLiga(l); ed.local.add(l.id);
  }
  if (wrote) {
    // O Vite recarrega a página ao ver o arquivo mudar; volta direto para cá.
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ liga: ed.liga, club: ed.club, msg: msg + ' · gravado em data/ligas' })); } catch { /* ignora */ }
  }
  toast(msg + (wrote ? ' · gravado no arquivo' : ' · salvo neste navegador'));
  render();
}

function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

type Handler = (d: DOMStringMap, el: HTMLElement) => void;
export const editorActions: Record<string, Handler> = {
  openEditor() { void openEditor(); },
  edBack() { if (ed.club) { ed.club = null; render(); } else { app.tab = 'club'; render(); } window.scrollTo(0, 0); },
  edLiga(d) { ed.liga = d.l!; render(); },
  edClub(d) { ed.club = d.c!; ed.liga = findClub(ed.working, d.c!)?.liga.id ?? ed.liga; render(); window.scrollTo(0, 0); },
  edPlayer(d) { openPlayer(d.id!); },
  edNew() { openPlayer(null); },
  edAlt(d) { readForm(); const a = ed.draft!.posicoesAlt, p = d.p as Pos; ed.draft!.posicoesAlt = a.includes(p) ? a.filter(x => x !== p) : [...a, p]; drawSheet(); },
  edAuto() { readForm(); ed.draft!.atributos = estimate(ed.draft!.posicao, ed.draft!.overall); drawSheet(); },
  edPs(d) {
    readForm();
    const dr = ed.draft!, id = d.id!, has = dr.playstyles.includes(id), plus = dr.playstyles.includes(id + '+');
    dr.playstyles = dr.playstyles.filter(x => parsePs(x).id !== id);
    if (!has && !plus) {
      if (dr.playstyles.length >= 4) { toast('Máximo de 4 playstyles'); drawSheet(); return; }
      dr.playstyles.push(id);
    } else if (has && dr.overall >= PLUS_MIN_OVR) dr.playstyles.push(id + '+');
    drawSheet();
  },
  async edSave() {
    readForm();
    const { _club, _new, ...j } = ed.draft!;
    if (_new && j.nomeCurto) j.id = newPlayerId(ed.working, _club, j.nomeCurto);
    if (!j.nome) j.nome = j.nomeCurto;
    const r = { erros: [] as string[], avisos: [] as string[] };
    validarJogador(j, j.nomeCurto || 'jogador', NACOES, r);
    if (r.erros.length) { drawSheet(r.erros.map(e => e.replace(/^[^:]*: /, ''))); return; }
    const f = findClub(ed.working, _club)!;
    if (_new) f.clube.elenco.push(j);
    else { const loc = findPlayer(ed.working, j.id)!; loc.clube.elenco[loc.idx] = j; }
    closeSheet();
    await persist([f.liga], `${j.nomeCurto} salvo`);
  },
  async edTransfer() {
    readForm();
    const dest = (document.getElementById('fDest') as HTMLSelectElement).value, d = ed.draft!;
    if (dest === d._club) { toast('Escolha outro clube'); return; }
    const changed = transferPlayer(ed.working, d.id, dest);
    if (!changed.length) return;
    closeSheet();
    await persist(changed, `${d.nomeCurto} transferido para ${findClub(ed.working, dest)?.clube.nome}`);
  },
  async edRemove(_d, el) {
    if (!el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Toque de novo para remover'; return; }
    const loc = findPlayer(ed.working, ed.draft!.id);
    if (!loc) return;
    const [j] = loc.clube.elenco.splice(loc.idx, 1);
    closeSheet();
    await persist([loc.liga], `${j.nomeCurto} removido`);
  },
  async edSaveClub() {
    const f = findClub(ed.working, ed.club!);
    if (!f) return;
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
    if (!v('edCNome') || !v('edCCidade')) { toast('Preencha nome e cidade'); return; }
    Object.assign(f.clube, { nome: v('edCNome'), cidade: v('edCCidade'), cores: [v('edCor1'), v('edCor2')] });
    await persist([f.liga], `${f.clube.nome} salvo`);
  },
  edDownload(d) { const l = ed.working.find(x => x.id === d.l); if (l) download(`${l.id}.json`, formatLiga(l)); },
  async edDiscard(d) {
    await discardEditedLiga(d.l!); ed.local.delete(d.l!);
    const edits = await loadEditedLigas().catch(() => ({}));
    const { applyEdits } = await import('../engine/world');
    applyEdits(edits); clearCardCache(); clearStrengthCache(); sanitizeState(app.S); save();
    ed.working = structuredClone(W.ligas);
    toast('Edições descartadas'); render();
  },
  edCheck() {
    const r = validarDados({ ligas: ed.working, lendas: W.lendas, nacoes: NACOES });
    openSheet(`<h2>Validação</h2><p>${r.erros.length ? `<b class="down">${r.erros.length} erro(s)</b>` : '<b class="up">Nenhum erro</b>'} · ${r.avisos.length} aviso(s)</p>
      <div class="small" style="display:grid;gap:4px">${[...r.erros.map(e => `<div class="down">✗ ${esc(e)}</div>`), ...r.avisos.slice(0, 120).map(a => `<div class="muted">· ${esc(a)}</div>`)].join('')}</div>`);
  },
};

/** Busca com atualização parcial para não perder o foco do campo. */
export function bindEditorInputs(root: HTMLElement): void {
  const q = root.querySelector<HTMLInputElement>('#edQ');
  if (!q) return;
  let t: ReturnType<typeof setTimeout>;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      ed.q = q.value;
      const tmp = document.createElement('div');
      tmp.innerHTML = viewEditor();
      const res = tmp.querySelector('#edResults'), cur = root.querySelector('#edResults');
      if (res && cur) cur.innerHTML = res.innerHTML;
    }, 150);
  });
}
