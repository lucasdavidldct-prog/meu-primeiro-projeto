import { STAT_G, STAT_L } from '../engine/positions';
import { VAR, TIER_N, sellValue } from '../engine/cards';
import { packById, type PackId } from '../engine/packs';
import { pick } from '../engine/rng';
import { allClubs, clubOf, leagueName, nationOf } from '../engine/world';
import { clubStrength } from '../engine/squads';
import { PS_BY_ID, parsePs } from '../engine/data/schema';
import { oppFromClub, oppFromId } from '../engine/season';
import { endSeason as careerEnd, nextFixture } from '../engine/career';
import { applyPick, autoLineup, blankGame, cardByUid, duplicates, newCareerGame, removeCard, teamInfo, today, type GameState } from '../engine/state';
import type { FormationId, StyleId } from '../engine/types';
import { exportJson, flushSave, importJson } from '../save/db';
import { cardHTML } from './card';
import { app, render, save, saveNow, setRender, userClub, type Tab } from './ctx';
import { closeSheet, esc, fmt, openSheet, toast } from './dom';
import { matchActions, quickPlay, startMatch } from './matchView';
import { viewStart } from './views/start';
import { crestHTML } from './crest';
import { W } from '../engine/world';
import { openPack } from './packOpen';
import { openPicker } from './picker';
import { viewClub } from './views/club';
import { viewSeason } from './views/season';
import { viewSquad } from './views/squad';
import { viewStore } from './views/store';
import { sfx, unlockAudio } from './sfx';
import { initNative, isNative, shareFile } from './native';
import { HELP } from './moment2d';
import { initSquadDrag } from './squadDrag';
import { definirMinhaFoto, fotoDe, removerMinhaFoto, temFotoCommons } from './fotos';
import { bindEditorInputs, editorActions, resumeEditorIfNeeded, viewEditor } from './editor';

function renderApp(): void {
  const S = app.S;
  document.getElementById('coins')!.textContent = fmt(S.coins);
  document.getElementById('clubName')!.textContent = S.name;
  if (!S.career && app.tab !== 'editor') app.tab = 'start';
  document.getElementById('crest')!.outerHTML = `<span id="crest" class="crest-head">${crestHTML(userClub())}</span>`;
  const tabNow = app.tab === 'editor' ? 'club' : app.tab;
  document.querySelectorAll<HTMLElement>('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.t === tabNow ? 'true' : 'false'));
  const v = document.getElementById('view')!;
  v.innerHTML = app.tab === 'squad' ? viewSquad() : app.tab === 'store' ? viewStore() : app.tab === 'club' ? viewClub() : app.tab === 'editor' ? viewEditor() : app.tab === 'start' ? viewStart() : viewSeason();
  if (app.tab === 'editor') bindEditorInputs(v);
}

/** Redesenha a tela e reabre o detalhe da carta aberta (após trocar a foto). */
function refreshCard(id: string): void {
  render();
  const u = app.S.cards.find(c => c.p === id)?.u;
  if (u && document.getElementById('sheet')) showCard(u);
}

function showCard(u: number): void {
  const S = app.S, P = cardByUid(S, u);
  if (!P) return;
  const inSq = S.squad.xi.includes(P.u) || S.squad.bench.includes(P.u);
  const L = P.pos === 'GOL' ? STAT_G : STAT_L;
  openSheet(`<div style="display:grid;justify-items:center;gap:12px">${cardHTML(P, 'lg')}</div>
   <h2 style="margin-top:14px">${esc(P.name)}</h2>
   <div class="small muted">${P.v === 'base' ? TIER_N[P.tier] : VAR[P.v].n} · ${P.pos}${P.alt.length ? ' (também ' + P.alt.join(', ') + ')' : ''} · ${P.age} anos</div>
   <div class="small muted">${nationOf(P.nat).n} · ${P.leg ? esc(P.hist ?? 'Ícones') + (P.epoca ? ' (' + esc(P.epoca) + ')' : '') : esc(leagueName(P)) + ' · ' + esc(clubOf(P).n)}</div>
   <dl class="kv"><dt>Pé bom</dt><dd>${{ D: 'Direito', E: 'Esquerdo', A: 'Ambidestro' }[P.foot]}</dd>${P.leg ? '' : `<dt>Idade</dt><dd>${P.age} anos</dd>`}${P.legClub === 'CAM' ? '<dt>Ídolo</dt><dd>Atlético Mineiro</dd>' : ''}</dl>
   <div class="bars" style="margin-top:12px">${P.st.map((s, i) => `<div class="bar">${L[i]}<i><b style="width:${s}%"></b></i><span>${s}</span></div>`).join('')}</div>
   ${P.ps.length ? `<h3>Playstyles</h3><div class="ps-list">${P.ps.map(x => { const { id, plus } = parsePs(x), d = PS_BY_ID.get(id); return d ? `<div class="ps-item ${plus ? 'plus' : ''}"><span class="ic">${d.icone}</span><div><b>${d.nome}</b><span class="muted">${plus ? d.descPlus : d.desc}</span></div></div>` : ''; }).join('')}</div>` : ''}
   ${photoPanel(P.id)}
   <div style="margin-top:16px">${inSq ? '<p class="small muted">Está no seu elenco. Tire do time para poder vender.</p>' : `<button class="btn danger block" data-act="sell" data-u="${P.u}">Vender por ${fmt(sellValue(P))} moedas</button>`}</div>`);
}

/** Guia rápido: aparece na primeira carreira e fica em Clube → Como jogar. */
function showHelp(): void {
  openSheet(`<h2>Como jogar</h2>
  <div class="help">
   <h3>Carreira</h3><p>Na aba <b>Temporada</b> você joga a próxima partida do Brasileirão ou da Libertadores. <b>Jogar</b> abre a partida com narração e lances; <b>Simular</b> resolve na hora. Terminar entre os 5 primeiros leva à Libertadores; os 4 últimos caem.</p>
   <h3>Time e química</h3><p>Em <b>Time</b>, toque numa posição para trocar o jogador. Jogadores do mesmo clube, liga ou país ligados na formação somam química; fora de posição, o rendimento cai. <b>Melhor time</b> escala automaticamente.</p>
   <h3>Pacotes</h3><p>Ganhe moedas nos jogos e compre pacotes em <b>Pacotes</b>. Todo dia há um pacote grátis. Repetidas podem ser vendidas.</p>
   <h3>Lances jogáveis</h3><p>${HELP.ataque}</p><p>${HELP.falta}</p><p>${HELP.penalti}</p>
   <h3>Playstyles</h3><p>Os ícones na carta são habilidades (Chute de Longe, Velocista…). As versões <b>+</b> são mais fortes. Elas pesam na simulação e nos lances.</p>
  </div>
  <button class="btn pri block" style="margin-top:14px" data-act="closeSheet">Entendi</button>`);
}

function photoPanel(id: string): string {
  const f = fotoDe(id);
  const credit = f?.fonte === 'commons' ? `<a href="${esc(f.pagina!)}" target="_blank" rel="noopener">Foto: Wikimedia Commons (licença livre)</a>` : f?.fonte === 'minha' ? 'Foto escolhida por você' : temFotoCommons(id) && app.S.fotos === false ? 'Fotos da internet desligadas em Clube' : 'Sem foto';
  return `<h3>Foto</h3><div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted" style="flex:1 1 100%">${credit}</span>
    <button class="btn" data-act="photoPick" data-id="${esc(id)}">${f?.fonte === 'minha' ? 'Trocar minha foto' : 'Escolher foto'}</button>
    ${f?.fonte === 'minha' ? `<button class="btn" data-act="photoDel" data-id="${esc(id)}">Remover minha foto</button>` : ''}</div>`;
}

function replaceState(S: GameState): void { app.S = S; app.sel = null; }

const TEST_COINS = 1_000_000;

type Handler = (d: DOMStringMap, el: HTMLElement) => void;
const ACT: Record<string, Handler> = {
  tab(d) { app.tab = d.t as Tab; app.sel = null; render(); window.scrollTo(0, 0); },
  slot(d) { openPicker('xi', +d.i!); },
  bslot(d) { openPicker('bench', +d.i!); },
  pickP(d) {
    if (!app.sel) return;
    const r = applyPick(app.S, app.sel.kind, app.sel.i, +d.u!);
    if (!r.ok) { if (r.msg) toast(r.msg); return; }
    app.sel = null; closeSheet(); save(); render();
  },
  benchClear(d) { app.S.squad.bench[+d.i!] = 0; app.sel = null; closeSheet(); save(); render(); },
  auto() { autoLineup(app.S); save(); render(); toast('Melhor time escalado'); },
  form(d) { app.S.squad.form = d.f as FormationId; save(); render(); },
  style(d) { app.S.tac.style = d.s as StyleId; save(); render(); },
  ment(d) { app.S.tac.ment = +d.m!; save(); render(); },
  buy(d) {
    const p = packById(d.p as PackId);
    if (app.S.coins < p.price) { toast(`Faltam ${fmt(p.price - app.S.coins)} moedas`); return; }
    app.S.coins -= p.price; openPack(p.id);
  },
  free() { if (app.S.lastFree === today()) return; app.S.lastFree = today(); openPack('prata'); },
  freePack(d) { closeSheet(); openPack(d.p as PackId); },
  closeReveal() { document.getElementById('reveal')?.remove(); render(); },
  sellPackDups(d, el) {
    let v = 0;
    for (const u of d.u!.split(',').map(Number)) { const P = cardByUid(app.S, u); if (P) { v += sellValue(P); removeCard(app.S, u); } }
    app.S.coins += v; save(); render(); sfx.coin(); toast(`+${fmt(v)} moedas`); el.remove();
  },
  sellDups() {
    const S = app.S, us = duplicates(S);
    let v = 0;
    for (const u of us) { v += sellValue(cardByUid(S, u)!); removeCard(S, u); }
    S.coins += v; save(); render(); sfx.coin(); toast(`${us.length} vendidas: +${fmt(v)} moedas`);
  },
  card(d) { showCard(+d.u!); },
  sell(d, el) {
    if (!el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Toque de novo para confirmar'; return; }
    const P = cardByUid(app.S, +d.u!);
    if (!P) return;
    app.S.coins += sellValue(P); removeCard(app.S, P.u); closeSheet(); save(); render(); sfx.coin(); toast(`${P.short} vendido`);
  },
  cf(d) { app.clubFilter = d.f!; render(); },
  cs() { app.clubSort = app.clubSort === 'ovr' ? 'rec' : 'ovr'; render(); },
  rename() {
    const v = (document.getElementById('nameIn') as HTMLInputElement).value.trim();
    if (v) { app.S.name = v.slice(0, 24); save(); render(); toast('Nome salvo'); }
  },
  togMom() { app.S.moments = !app.S.moments; save(); render(); },
  lance3d(d) { app.S.lance3d = d.v === '1'; save(); render(); toast(app.S.lance3d ? 'Lances em 3D' : 'Lances em 2D (modo leve)'); },
  togSom() { app.S.som = app.S.som === false; save(); render(); if (app.S.som) sfx.coin(); },
  togVib() { app.S.vibrar = app.S.vibrar === false; save(); render(); },
  help() { showHelp(); },
  togFotos() { app.S.fotos = app.S.fotos === false; save(); render(); },
  photoPick(d) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try { await definirMinhaFoto(d.id!, f); refreshCard(d.id!); toast('Foto salva'); }
      catch (e) { toast('Não foi possível usar essa imagem'); console.warn(e); }
    };
    inp.click();
  },
  async photoDel(d) { await removerMinhaFoto(d.id!); refreshCard(d.id!); toast('Foto removida'); },
  reset(_d, el) {
    if (!el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Tem certeza? Toque de novo para apagar tudo'; return; }
    replaceState(blankGame()); save(); app.tab = 'start'; render(); window.scrollTo(0, 0);
  },
  exportSave() {
    const name = `esquadrao-save-${new Date().toISOString().slice(0, 10)}.json`;
    if (isNative()) { void shareFile(name, exportJson(app.S)).catch(e => toast('Não foi possível exportar: ' + (e as Error).message)); return; }
    const blob = new Blob([exportJson(app.S)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Save exportado');
  },
  importSave() {
    const inp = document.getElementById('importFile') as HTMLInputElement;
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      try {
        replaceState(importJson(await f.text()));
        await flushSave(app.S); render(); toast('Save importado');
      } catch (e) { toast((e as Error).message); }
    };
    inp.click();
  },
  play() {
    const C = app.S.career!, f = nextFixture(C);
    if (f) startMatch(oppFromId(f.opp, teamInfo(app.S).ovr), f);
  },
  simPlay() {
    const C = app.S.career!, f = nextFixture(C);
    if (f) void quickPlay(oppFromId(f.opp, teamInfo(app.S).ovr), f);
  },
  friendly() {
    const T = teamInfo(app.S);
    // Um clube real de nível parecido com o seu time
    const near = allClubs().filter(c => c.id !== app.S.career?.club).map(c => ({ c, d: Math.abs(clubStrength(c.id) - T.ovr) })).sort((a, b) => a.d - b.d).slice(0, 12);
    startMatch(oppFromClub(pick(near).c, T.ovr), null);
  },
  endSeason() {
    const S = app.S, r = careerEnd(S.career!);
    S.coins += r.coins;
    S.titles += r.trophies.length;
    app.careerView = 'tabela';
    saveNow(); render();
    openSheet(`<h2>Fim de temporada</h2>${r.msgs.map(m => `<p>${esc(m)}</p>`).join('')}<p class="small muted">Total: +${fmt(r.coins)} moedas.</p>${r.pack ? `<p>Prêmio extra: pacote <b>${packById(r.pack).n}</b>.</p><button class="btn pri block" data-act="freePack" data-p="${r.pack}">Abrir pacote</button>` : '<button class="btn block" data-act="closeSheet">Fechar</button>'}`);
  },
  cv(d) { app.careerView = d.v as typeof app.careerView; render(); },
  cvLeague(d) { app.otherLeague = d.l!; render(); },
  stLiga(d) { app.startLiga = d.l!; render(); },
  stClub(d) { app.startClub = d.c!; render(); },
  stShort() { app.startShort = !app.startShort; render(); },
  stLib() { app.startLib = !app.startLib; render(); },
  stRich() { app.startRich = !app.startRich; render(); },
  testCoins() { app.S.coins += TEST_COINS; saveNow(); render(); sfx.coin(); toast(`+${fmt(TEST_COINS)} moedas`); },
  stGo(_d, el) {
    if (app.S.cards.length && !el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Toque de novo para confirmar'; return; }
    const c = W.clubs.get(app.startClub)!;
    replaceState(newCareerGame(c.id, { short: app.startShort, libNow: app.startLib && c.lg !== 'serie-b' }));
    if (app.startRich) app.S.coins += TEST_COINS;
    app.tab = 'squad'; saveNow(); render(); window.scrollTo(0, 0);
    toast(`Bem-vindo ao ${c.n}! Temporada ${app.S.career!.year}.`);
    if (!app.S.dicasVistas) { app.S.dicasVistas = true; save(); setTimeout(showHelp, 600); }
  },
  closeSheet() { closeSheet(); },
  ...matchActions,
  ...editorActions,
};

export function startApp(S: GameState): void {
  app.S = S;
  unlockAudio();
  initSquadDrag(document.getElementById('view')!, (to, u) => {
    const r = applyPick(app.S, to.kind, to.i, u);
    if (!r.ok) { if (r.msg) toast(r.msg); return; }
    app.sel = null; save(); render();
  });
  void initNative(() => { void flushSave(app.S); });
  // Erros inesperados: avisa em vez de deixar a tela travada sem explicação
  window.addEventListener('error', e => { console.error(e.error ?? e.message); toast('Ops, algo deu errado. Seu progresso está salvo.'); });
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); toast('Ops, algo deu errado. Seu progresso está salvo.'); });
  setRender(renderApp);
  document.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    if (t.getAttribute('aria-disabled') === 'true' && t.dataset.act !== 'buy') return;
    ACT[t.dataset.act!]?.(t.dataset, t);
  });
  // Garante que o último estado vá para o disco ao fechar/ocultar a aba
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flushSave(app.S); });
  window.addEventListener('pagehide', () => { void flushSave(app.S); });
  render();
  if (S.aviso) { setTimeout(() => toast(S.aviso!), 400); delete S.aviso; save(); }
  resumeEditorIfNeeded();
}
