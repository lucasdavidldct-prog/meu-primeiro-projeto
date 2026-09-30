import { QUALITY_N, defaultQuality, setQuality, type Quality } from '../three/qualityLevel';
import { STAT_G, STAT_L } from '../engine/positions';
import { psIcon } from './psIcons';
import { VAR, TIER_N, sellValue } from '../engine/cards';
import { packById, type PackId } from '../engine/packs';
import { pick } from '../engine/rng';
import { allClubs, clubOf, leagueName, nationOf } from '../engine/world';
import { clubStrength } from '../engine/squads';
import { PS_BY_ID, PS_CATS, parsePs, type PsCat, LEG_CATS } from '../engine/data/schema';
import { oppFromClub, oppFromId } from '../engine/season';
import { endSeason as careerEnd, nextFixture } from '../engine/career';
import { loadPreset, savePreset, teamStrength, setFormation, setOrder, setRole, applyPick, autoLineup, blankGame, cardByUid, duplicates, newCareerGame, removeCard, teamInfo, today, type GameState } from '../engine/state';
import type { FormationId, Pos, StyleId } from '../engine/types';
import { exportJson, flushSave, importJson } from '../save/db';
import { cardHTML } from './card';
import { app, render, save, saveNow, setRender, userClub, type Tab } from './ctx';
import { closeSheet, esc, fmt, openSheet, toast } from './dom';
import { matchActions, quickPlay, startMatch } from './matchView';
import { viewStart } from './views/start';
import { crestHTML } from './crest';
import { W, getPlayer } from '../engine/world';
import { openPack } from './packOpen';
import { openPicker } from './picker';
import { viewClub } from './views/club';
import { viewSeason } from './views/season';
import { viewSquad } from './views/squad';
import { viewStore } from './views/store';
import { sfx, unlockAudio } from './sfx';
import { applyEvolution, evolveSeason } from '../engine/evolution';
import { initNative, isNative, shareFile } from './native';
import { initSquadDrag } from './squadDrag';
import { bindMarket, marketActions } from './market';
import { labActions, viewLab } from './lab';
import { guiaActions, viewRanking, viewTaticas } from './guias';
import { cardDetailActions, showCard } from './cardDetail';
import { slotMenuHTML } from './slotMenu';
import { definirMinhaFoto, fotoDe, removerMinhaFoto, temFotoCommons } from './fotos';
import { bindEditorInputs, editorActions, resumeEditorIfNeeded, viewEditor } from './editor';

function renderApp(): void {
  const S = app.S;
  document.getElementById('coins')!.textContent = fmt(S.coins);
  document.getElementById('clubName')!.textContent = S.name;
  if (!S.career && app.tab !== 'editor' && app.tab !== 'lab' && app.tab !== 'ranking') app.tab = 'start';
  document.getElementById('crest')!.outerHTML = `<span id="crest" class="crest-head">${crestHTML(userClub())}</span>`;
  const tabNow = app.tab === 'editor' || app.tab === 'lab' || app.tab === 'ranking' || app.tab === 'taticas' ? 'club' : app.tab;
  document.querySelectorAll<HTMLElement>('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.t === tabNow ? 'true' : 'false'));
  const v = document.getElementById('view')!;
  v.innerHTML = app.tab === 'squad' ? viewSquad() : app.tab === 'store' ? viewStore() : app.tab === 'club' ? viewClub() : app.tab === 'editor' ? viewEditor() : app.tab === 'lab' ? viewLab() : app.tab === 'ranking' ? viewRanking() : app.tab === 'taticas' ? viewTaticas() : app.tab === 'start' ? viewStart() : viewSeason();
  if (app.tab === 'editor') bindEditorInputs(v);
  if (app.tab === 'store') bindMarket(v);
}

/** Redesenha a tela e reabre o detalhe da carta aberta (após trocar a foto). */
function refreshCard(id: string): void {
  render();
  const u = app.S.cards.find(c => c.p === id)?.u;
  if (u && document.getElementById('sheet')) showCard(u);
}

/** Guia rápido: aparece na primeira carreira e fica em Clube → Como jogar. */
function showHelp(): void {
  openSheet(`<h2>Como jogar</h2>
  <div class="help">
   <h3>Carreira</h3><p>Na aba <b>Temporada</b> você joga a próxima partida do Brasileirão ou da Libertadores. <b>Jogar</b> abre a partida com narração e lances; <b>Simular</b> resolve na hora. Terminar entre os 5 primeiros leva à Libertadores; os 4 últimos caem.</p>
   <h3>Time e química</h3><p>Em <b>Time</b>, toque numa carta para abrir o menu: <b>Substituir</b>, <b>Detalhes</b>, <b>Função no campo</b> (ex.: VOL jogando de MC) e <b>Orientação</b> (pivô, falso 9, armador, box-to-box, ala… e se ele fica no ataque ou volta para defender). Tudo isso muda a partida. Segure e arraste uma carta para trocar dois jogadores de lugar. Jogadores do mesmo clube, liga ou país ligados na formação somam química; fora de posição, o rendimento cai. <b>Melhor time</b> escala automaticamente.</p>
   <h3>Pacotes</h3><p>Ganhe moedas nos jogos e compre pacotes em <b>Pacotes</b>. Todo dia há um pacote grátis. Repetidas podem ser vendidas.</p>
   <h3>Lances jogáveis</h3><p><b>1 toque</b> num companheiro: passe rasteiro. <b>2 toques</b>: passe alto, por cima da marcação. Toque no <b>campo</b>: conduzir a bola. O número ao lado de cada nome é a chance do passe (com ↑ quando o passe alto é melhor, como no cruzamento para a área).</p><p><b>Desenhe um traço</b> da bola em direção ao gol para chutar: a direção mira, a <b>curva do traço</b> dá o efeito e a <b>velocidade</b> do gesto dá a força (rápido demais vai por cima). Traço para o espaço vazio: <b>lançamento</b> para quem estiver mais perto. Falta e pênalti: também com o traço.</p>
   <h3>Mando e dificuldade</h3><p>Jogar em casa ajuda (torcida, mais chances); fora é mais difícil e você tem um lance a menos. A dificuldade fica em <b>Clube</b>.</p>
   <h3>Playstyles</h3><p>Os ícones na carta são habilidades (Chute de Longe, Velocista…). As versões <b>+</b> são mais fortes. Elas pesam na simulação e nos lances.</p>
  </div>
  <div class="row" style="gap:8px;margin-top:14px"><button class="btn pri" style="flex:1" data-act="treino" data-k="ataque">Fazer o treino de lances</button><button class="btn" style="flex:1" data-act="closeSheet">Entendi</button></div>`);
}

function openSlotMenu(i: number): void {
  const h = slotMenuHTML(i);
  if (!h) return;
  // Reabre no mesmo ponto de rolagem (as opções mudam na hora)
  const old = document.querySelector<HTMLElement>('#sheet .sheet'), reopen = !!old?.querySelector('.slot-menu'), prev = old?.scrollTop ?? 0;
  const bg = openSheet(h), sh = bg.querySelector<HTMLElement>('.sheet')!;
  if (reopen) { bg.style.animation = 'none'; sh.style.animation = 'none'; sh.scrollTop = prev; }
}

/** Campanha na liga (V-E-D, gols) antes de virar a temporada. */
function seasonRecord(S: GameState): string {
  const C = S.career!, row = C.league.table[C.league.teams.indexOf(C.club)];
  return row ? `<p class="small muted" style="margin-top:-4px">Campanha no ${esc(C.div === 'A' ? 'Brasileirão' : 'Série B')}: ${row.W}V ${row.D}E ${row.L}D · ${row.GF} gols marcados, ${row.GA} sofridos.</p>` : '';
}

function replaceState(S: GameState): void { app.S = S; app.sel = null; applyEvolution(S.evo); setQuality(S.graficos ?? defaultQuality()); }

const TEST_COINS = 1_000_000;

type Handler = (d: DOMStringMap, el: HTMLElement) => void;
const ACT: Record<string, Handler> = {
  tab(d) { app.tab = d.t as Tab; app.sel = null; render(); window.scrollTo(0, 0); },
  slot(d) { if (app.S.squad.xi[+d.i!]) openSlotMenu(+d.i!); else openPicker('xi', +d.i!); },
  slotSub(d) { openPicker('xi', +d.i!); },
  slotRole(d) { setRole(app.S, +d.i!, d.p as Pos); save(); render(); openSlotMenu(+d.i!); },
  slotFunc(d) { setOrder(app.S, +d.i!, { f: d.f }); save(); render(); openSlotMenu(+d.i!); },
  slotPart(d) { setOrder(app.S, +d.i!, { p: +d.p! as -1 | 0 | 1 }); save(); render(); openSlotMenu(+d.i!); },
  bslot(d) { openPicker('bench', +d.i!); },
  pickP(d) {
    if (!app.sel) return;
    const r = applyPick(app.S, app.sel.kind, app.sel.i, +d.u!);
    if (!r.ok) { if (r.msg) toast(r.msg); return; }
    app.sel = null; closeSheet(); save(); render();
  },
  benchClear(d) { app.S.squad.bench[+d.i!] = 0; app.sel = null; closeSheet(); save(); render(); },
  auto() { autoLineup(app.S); save(); render(); toast('Melhor time escalado'); },
  presetSave() {
    openSheet(`<h2>Salvar elenco</h2><p class="small muted" style="margin-top:-4px">Guarda formação, titulares, reservas, funções, orientações e tática. Mesmo nome = substitui.</p>
      <input id="presetNome" maxlength="24" placeholder="Ex.: Titular, Copa, Poupando" style="width:100%">
      <button class="btn pri block" style="margin-top:12px" data-act="presetSaveOk">Salvar</button>`);
    setTimeout(() => document.getElementById('presetNome')?.focus(), 50);
  },
  presetSaveOk() {
    const r = savePreset(app.S, (document.getElementById('presetNome') as HTMLInputElement | null)?.value ?? '');
    if (!r.ok) { toast(r.msg!); return; }
    closeSheet(); save(); render(); toast('Elenco salvo');
  },
  presetLoad(d) {
    const r = loadPreset(app.S, +d.i!);
    if (!r.ok) return;
    save(); render(); toast(r.faltando ? `Elenco carregado (${r.faltando} vaga(s) vazia(s): carta vendida)` : `Elenco "${app.S.elencos![+d.i!].nome}" carregado`);
  },
  statSort(d) { app.statSort = d.k ?? 'g'; render(); },
  presetDel(d) { app.S.elencos?.splice(+d.i!, 1); save(); render(); },
  form(d) { setFormation(app.S, d.f as FormationId); save(); render(); },
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
  graficos(d) { const q = d.q as Quality; app.S.graficos = q; setQuality(q); save(); render(); toast(`Gráficos: ${QUALITY_N[q]}`); },
  setCamera(d) { app.S.camera = d.v as GameState['camera']; save(); render(); },
  setClima(d) { app.S.clima = d.v as GameState['clima']; save(); render(); },
  setGramado(d) { app.S.gramado = d.v as GameState['gramado']; save(); render(); },
  uniforme(d) { const k = Number(d.k); app.S.uniforme = k < 0 ? undefined : k; save(); render(); toast(k < 0 ? 'Uniforme automático' : 'Uniforme escolhido'); },
  togSom() { app.S.som = app.S.som === false; save(); render(); if (app.S.som) sfx.coin(); },
  togVib() { app.S.vibrar = app.S.vibrar === false; save(); render(); },
  help() { showHelp(); },
  dif(d) { app.S.dif = +d.d! as 0 | 1 | 2 | 3; save(); render(); },
  togGk() { app.S.goleiro = app.S.goleiro === false; save(); render(); },
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
    if (f) startMatch(oppFromId(f.opp, teamStrength(teamInfo(app.S))), f);
  },
  simPlay() {
    const C = app.S.career!, f = nextFixture(C);
    if (f) void quickPlay(oppFromId(f.opp, teamStrength(teamInfo(app.S))), f);
  },
  friendly() {
    const T = teamInfo(app.S);
    // Um clube real de nível parecido com o seu time
    const my = teamStrength(T);
    const near = allClubs().filter(c => c.id !== app.S.career?.club).map(c => ({ c, d: Math.abs(clubStrength(c.id) - my) })).sort((a, b) => a.d - b.d).slice(0, 12);
    startMatch(oppFromClub(pick(near).c, my), null);
  },
  endSeason() {
    const S = app.S, st = Object.entries(S.career!.stats ?? {}), rec0 = seasonRecord(S);
    const top = (f: (x: typeof st[number][1]) => number, min = 0) => st.filter(([, x]) => x.j >= min).sort((a, b) => f(b[1]) - f(a[1]))[0];
    const art = top(x => x.g), gar = top(x => x.a), craque = top(x => x.n / x.j, 8);
    const awards = [
      art && art[1].g ? `⚽ Artilheiro: <b>${esc(art[0])}</b> (${art[1].g} gol${art[1].g > 1 ? 's' : ''})` : '',
      gar && gar[1].a ? `🎯 Garçom: <b>${esc(gar[0])}</b> (${gar[1].a} assist.)` : '',
      craque ? `⭐ Craque da temporada: <b>${esc(craque[0])}</b> (média ${(craque[1].n / craque[1].j).toFixed(1)} em ${craque[1].j} jogos)` : '',
    ].filter(Boolean);
    // Evolução: todos envelhecem e o overall muda (antes do calendário da próxima temporada)
    let evoHTML = '';
    if (S.career!.evo) {
      const mine = new Set(S.cards.map(c => c.p));
      const ch = evolveSeason(S.evo ??= {}).filter(x => mine.has(x.id));
      applyEvolution(S.evo);
      const up = ch.filter(x => x.para > x.de).sort((a, b) => (b.para - b.de) - (a.para - a.de)).slice(0, 5);
      const down = ch.filter(x => x.para < x.de).sort((a, b) => (a.para - a.de) - (b.para - b.de)).slice(0, 5);
      const nm = (id: string) => esc(getPlayer(id)?.short ?? id);
      if (up.length || down.length) evoHTML = `<h3>Evolução do seu elenco</h3><div class="notas">${up.map(x => `<span>${nm(x.id)} <i>${x.idade} anos</i><b class="up">${x.de}→${x.para}</b></span>`).join('')}${down.map(x => `<span>${nm(x.id)} <i>${x.idade} anos</i><b class="down">${x.de}→${x.para}</b></span>`).join('')}</div>`;
    }
    const r = careerEnd(S.career!);
    const last = S.career!.history[S.career!.history.length - 1];
    if (last && art && art[1].g) last.art = `${art[0]} (${art[1].g})`;
    S.career!.stats = {};
    S.coins += r.coins;
    S.titles += r.trophies.length;
    app.careerView = 'tabela';
    saveNow(); render();
    openSheet(`<h2>Fim de temporada</h2>${rec0}${awards.length ? `<div class="awards">${awards.map(a => `<p>${a}</p>`).join('')}</div>` : ''}${r.msgs.map(m => `<p>${esc(m)}</p>`).join('')}${evoHTML}<p class="small muted">Total: +${fmt(r.coins)} moedas.</p>${r.pack ? `<p>Prêmio extra: pacote <b>${packById(r.pack).n}</b>.</p><button class="btn pri block" data-act="freePack" data-p="${r.pack}">Abrir pacote</button>` : '<button class="btn block" data-act="closeSheet">Fechar</button>'}`);
  },
  cv(d) { app.careerView = d.v as typeof app.careerView; render(); },
  cvLeague(d) { app.otherLeague = d.l!; render(); },
  stLiga(d) { app.startLiga = d.l!; render(); },
  stClub(d) { app.startClub = d.c!; render(); },
  stShort() { app.startShort = !app.startShort; render(); },
  stLib() { app.startLib = !app.startLib; render(); },
  stRich() { app.startRich = !app.startRich; render(); },
  stEvo() { app.startEvo = !app.startEvo; render(); },
  stMercado() { app.startMercado = !app.startMercado; render(); },
  testCoins() { app.S.coins += TEST_COINS; saveNow(); render(); sfx.coin(); toast(`+${fmt(TEST_COINS)} moedas`); },
  stGo(_d, el) {
    if (app.S.cards.length && !el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Toque de novo para confirmar'; return; }
    const c = W.clubs.get(app.startClub)!;
    applyEvolution({});
    replaceState(newCareerGame(c.id, { short: app.startShort, libNow: app.startLib && c.lg !== 'serie-b', evo: app.startEvo, mercado: app.startMercado }));
    if (app.startRich) app.S.coins += TEST_COINS;
    app.tab = 'squad'; saveNow(); render(); window.scrollTo(0, 0);
    toast(`Bem-vindo ao ${c.n}! Temporada ${app.S.career!.year}.`);
    if (!app.S.dicasVistas) { app.S.dicasVistas = true; save(); setTimeout(showHelp, 600); }
  },
  closeSheet() { closeSheet(); },
  ...matchActions,
  ...(marketActions as unknown as Record<string, Handler>),
  storeTab(d) { app.storeTab = d.t as 'pacotes' | 'mercado'; render(); },
  ...editorActions,
  ...(labActions as unknown as Record<string, Handler>),
  ...(guiaActions as unknown as Record<string, Handler>),
  ...(cardDetailActions as unknown as Record<string, Handler>),
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
