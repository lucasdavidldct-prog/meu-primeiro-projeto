import { STAT_G, STAT_L } from '../engine/positions';
import { VAR, TIER_N, sellValue } from '../engine/cards';
import { packById, type PackId } from '../engine/packs';
import { pick } from '../engine/rng';
import { allClubs, clubOf, leagueName, nationOf } from '../engine/world';
import { clubStrength } from '../engine/squads';
import { PS_BY_ID, parsePs } from '../engine/data/schema';
import { newSeason, nextOpponent, oppFromClub, seasonEnd } from '../engine/season';
import { applyPick, autoLineup, cardByUid, duplicates, newGame, removeCard, teamInfo, today, type GameState } from '../engine/state';
import type { FormationId, StyleId } from '../engine/types';
import { exportJson, flushSave, importJson } from '../save/db';
import { cardHTML } from './card';
import { app, render, save, setRender, type Tab } from './ctx';
import { closeSheet, esc, fmt, openSheet, toast } from './dom';
import { matchActions, startMatch } from './matchView';
import { openPack } from './packOpen';
import { openPicker } from './picker';
import { viewClub } from './views/club';
import { viewSeason } from './views/season';
import { viewSquad } from './views/squad';
import { viewStore } from './views/store';
import { bindEditorInputs, editorActions, resumeEditorIfNeeded, viewEditor } from './editor';

function renderApp(): void {
  const S = app.S;
  document.getElementById('coins')!.textContent = fmt(S.coins);
  document.getElementById('clubName')!.textContent = S.name;
  document.getElementById('crest')!.textContent = (S.name.trim()[0] || 'E').toUpperCase();
  const tabNow = app.tab === 'editor' ? 'club' : app.tab;
  document.querySelectorAll<HTMLElement>('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.t === tabNow ? 'true' : 'false'));
  const v = document.getElementById('view')!;
  v.innerHTML = app.tab === 'squad' ? viewSquad() : app.tab === 'store' ? viewStore() : app.tab === 'club' ? viewClub() : app.tab === 'editor' ? viewEditor() : viewSeason();
  if (app.tab === 'editor') bindEditorInputs(v);
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
   <div style="margin-top:16px">${inSq ? '<p class="small muted">Está no seu elenco. Tire do time para poder vender.</p>' : `<button class="btn danger block" data-act="sell" data-u="${P.u}">Vender por ${fmt(sellValue(P))} moedas</button>`}</div>`);
}

function replaceState(S: GameState): void { app.S = S; app.sel = null; }

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
    app.S.coins += v; save(); render(); toast(`+${fmt(v)} moedas`); el.remove();
  },
  sellDups() {
    const S = app.S, us = duplicates(S);
    let v = 0;
    for (const u of us) { v += sellValue(cardByUid(S, u)!); removeCard(S, u); }
    S.coins += v; save(); render(); toast(`${us.length} vendidas: +${fmt(v)} moedas`);
  },
  card(d) { showCard(+d.u!); },
  sell(d, el) {
    if (!el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Toque de novo para confirmar'; return; }
    const P = cardByUid(app.S, +d.u!);
    if (!P) return;
    app.S.coins += sellValue(P); removeCard(app.S, P.u); closeSheet(); save(); render(); toast(`${P.short} vendido`);
  },
  cf(d) { app.clubFilter = d.f!; render(); },
  cs() { app.clubSort = app.clubSort === 'ovr' ? 'rec' : 'ovr'; render(); },
  rename() {
    const v = (document.getElementById('nameIn') as HTMLInputElement).value.trim();
    if (v) { app.S.name = v.slice(0, 24); save(); render(); toast('Nome salvo'); }
  },
  togMom() { app.S.moments = !app.S.moments; save(); render(); },
  reset(_d, el) {
    if (!el.dataset.ok) { el.dataset.ok = '1'; el.textContent = 'Tem certeza? Toque de novo para apagar tudo'; return; }
    replaceState(newGame()); save(); app.tab = 'squad'; render(); toast('Novo clube criado');
  },
  exportSave() {
    const blob = new Blob([exportJson(app.S)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `esquadrao-save-${new Date().toISOString().slice(0, 10)}.json`;
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
  play() { startMatch(nextOpponent(app.S.season), true); },
  friendly() {
    const T = teamInfo(app.S);
    // Um clube real de nível parecido com o seu time
    const near = allClubs().map(c => ({ c, d: Math.abs(clubStrength(c.id) - T.ovr) })).sort((a, b) => a.d - b.d).slice(0, 12);
    startMatch(oppFromClub(pick(near).c), false);
  },
  endSeason() {
    const S = app.S, r = seasonEnd(S.season, S.name);
    S.coins += r.coins;
    if (r.title) S.titles++;
    S.season = newSeason(r.newDiv, S.season.num + 1);
    save(); render();
    openSheet(`<h2>Fim de temporada</h2><p>${r.msg}</p>${r.pack ? `<p>Prêmio extra: pacote <b>${packById(r.pack).n}</b>.</p><button class="btn pri block" data-act="freePack" data-p="${r.pack}">Abrir pacote</button>` : '<button class="btn block" data-act="closeSheet">Fechar</button>'}`);
  },
  closeSheet() { closeSheet(); },
  ...matchActions,
  ...editorActions,
};

export function startApp(S: GameState): void {
  app.S = S;
  setRender(renderApp);
  document.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    if (t.getAttribute('aria-disabled') === 'true' && t.dataset.act !== 'buy') return;
    ACT[t.dataset.act!]?.(t.dataset, t);
  });
  // Garante que o último estado vá para o disco ao fechar/ocultar a aba
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flushSave(app.S); });
  render();
  if (S.aviso) { setTimeout(() => toast(S.aviso!), 400); delete S.aviso; save(); }
  resumeEditorIfNeeded();
}
