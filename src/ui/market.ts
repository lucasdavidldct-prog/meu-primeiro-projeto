// Tela do mercado de leilão: buscar por nome, dar lance contra a CPU, comprar já e vender as suas cartas.
import { TIER_N, cardData } from '../engine/cards';
import { bid, buyNow, committed, listMine, marketValue, netOf, newMarket, nextBid, roundPrice, search, tick, TAXA, variantName, type Listing } from '../engine/market';
import { addCard, allCards, cardByUid, removeCard } from '../engine/state';
import { cardHTML } from './card';
import { app, render, saveNow } from './ctx';
import { closeSheet, esc, fmt, openSheet, toast } from './dom';
import { sfx } from './sfx';

const M = newMarket();
let results: Listing[] = [];
let query = '';
let timer: ReturnType<typeof setInterval> | undefined;

const left = (l: Listing) => { const s = Math.max(0, Math.round((l.ends - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function row(l: Listing): string {
  const P = cardData(l.p, l.v), mine = l.seller === 'voce', val = marketValue(P);
  const lead = l.bidder === 'voce' ? '<b class="up">você</b>' : l.bidder === 'cpu' ? (mine ? '<b class="up">comprador</b>' : '<b class="down">CPU</b>') : '—';
  const status = l.done ? (l.done === 'comprado-ja' ? (mine ? 'Vendido (compre já)' : l.bidder === 'voce' ? 'Comprado' : 'Vendido') : l.done === 'vendido' ? (mine ? 'Vendido' : l.bidder === 'voce' ? 'Você venceu!' : 'Encerrado') : 'Sem lances') : `⏱ ${left(l)}`;
  const acts = l.done || mine ? '' : `<div class="mk-acts">
      <button class="btn pri" data-act="mkBid" data-id="${l.id}" ${l.bidder === 'voce' ? 'disabled' : ''}>${l.bidder === 'voce' ? 'Ganhando' : 'Lance ' + fmt(nextBid(l.bid, l.start))}</button>
      <button class="btn" data-act="mkBuy" data-id="${l.id}">Compre já ${fmt(l.buyNow)}</button></div>`;
  return `<div class="mk-row ${l.done ? 'done' : ''}">${cardHTML(P)}
    <div class="mk-info"><div class="nm">${esc(P.short)}${l.v !== 'base' ? ` <small class="muted">· ${esc(P.leg ? TIER_N[P.tier] : variantName(l.v))}</small>` : ''}</div>
      <div class="meta">${esc(P.name)} · ${P.pos} · ${P.ovr} · valor ~${fmt(val)}</div>
      <div class="meta">Lance: <b>${l.bid ? fmt(l.bid) : 'inicial ' + fmt(l.start)}</b> (${lead}) · <span class="mk-t">${status}</span></div>${acts}</div></div>`;
}

function listHTML(): string {
  const mineBids = M.list.filter(l => l.seller === 'cpu' && l.you);
  const mineSales = M.list.filter(l => l.seller === 'voce');
  const livre = app.S.coins - committed(M);
  return `<p class="small muted" style="margin:6px 0">Disponível para lances: <b>${fmt(livre)}</b> moedas${committed(M) ? ` (${fmt(committed(M))} presas em lances que você está ganhando)` : ''}.</p>
   ${mineBids.length ? `<h3>Meus lances</h3>${mineBids.map(row).join('')}` : ''}
   ${results.some(l => !l.you) ? `<h3>Resultados para “${esc(query)}”</h3>${results.filter(l => !l.you).map(row).join('')}` : query ? '<p class="empty-note">Ninguém anunciando esse jogador agora. Tente outro nome.</p>' : ''}
   <h3>Vender</h3>
   <p class="small muted" style="margin-top:-4px">Só cartas negociáveis (elenco inicial e compradas aqui). Cartas de pacote são intransferíveis. Taxa de ${Math.round(TAXA * 100)}% sobre a venda.</p>
   <button class="btn block" data-act="mkSell">Anunciar uma carta</button>
   ${mineSales.length ? `<h3>Minhas vendas</h3>${mineSales.map(row).join('')}` : ''}`;
}

export function viewMarket(): string {
  ensureTicker();
  return `<div class="row" style="gap:8px;margin-top:8px"><input id="mkQ" placeholder="Buscar jogador (ex.: Ronaldinho, Hulk)" value="${esc(query)}" style="flex:1;min-width:0"><button class="btn pri" data-act="mkSearch">Buscar</button></div>
    <div id="mkList">${listHTML()}</div>`;
}
export function bindMarket(root: HTMLElement): void {
  const q = root.querySelector<HTMLInputElement>('#mkQ');
  if (q) q.onkeydown = e => { if (e.key === 'Enter') doSearch(q.value); };
}
function refresh(): void {
  const el = document.getElementById('mkList');
  if (el) el.innerHTML = listHTML();
  const c = document.getElementById('coins');
  if (c) c.textContent = fmt(app.S.coins);
}
function doSearch(q: string): void {
  query = q.trim();
  if (query.length < 3) { toast('Digite pelo menos 3 letras'); return; }
  results = search(M, query, Date.now());
  refresh();
}

function ensureTicker(): void {
  if (timer) return;
  timer = setInterval(() => {
    const ev = tick(M, Date.now());
    let changed = false;
    for (const { l, kind } of ev) {
      const P = cardData(l.p, l.v);
      if (kind === 'ganhou') { app.S.coins -= l.bid; addCard(app.S, l.p, l.v, true); toast(`Você venceu o leilão: ${P.short} por ${fmt(l.bid)}!`); sfx.coin(); changed = true; }
      else if (kind === 'superado') toast(`Seu lance em ${P.short} foi coberto pela CPU`);
      else if (kind === 'vendeu' && l.seller === 'voce') { removeCard(app.S, l.uid!); app.S.coins += netOf(l.bid); toast(`${P.short} vendido por ${fmt(l.bid)} (+${fmt(netOf(l.bid))} após a taxa)`); sfx.coin(); changed = true; }
      else if (kind === 'nao-vendeu') toast(`${P.short} não recebeu lances e voltou para o clube`);
    }
    if (changed) { saveNow(); if (app.tab !== 'store') render(); }
    refresh();
    if (!M.list.some(l => !l.done) && app.tab !== 'store') { clearInterval(timer); timer = undefined; }
  }, 1000);
}

const byId = (id: string | undefined) => M.list.find(l => l.id === Number(id));
export const marketActions = {
  mkSearch() { doSearch(document.querySelector<HTMLInputElement>('#mkQ')?.value ?? ''); },
  mkBid(d: DOMStringMap) {
    const l = byId(d.id); if (!l) return;
    const r = bid(M, l, app.S.coins, Date.now());
    if (!r.ok) { toast(r.msg!); return; }
    toast(`Lance de ${fmt(l.bid)} em ${cardData(l.p, l.v).short}`); refresh();
  },
  mkBuy(d: DOMStringMap, el: HTMLElement) {
    const l = byId(d.id); if (!l) return;
    if (!el.dataset.ok) { el.dataset.ok = '1'; el.textContent = `Confirmar ${fmt(l.buyNow)}?`; return; }
    const r = buyNow(M, l, app.S.coins, Date.now());
    if (!r.ok) { toast(r.msg!); return; }
    app.S.coins -= r.cost!; addCard(app.S, l.p, l.v, true); saveNow(); sfx.coin();
    toast(`${cardData(l.p, l.v).short} é seu!`); refresh();
  },
  mkSell() {
    const S = app.S, inSq = new Set([...S.squad.xi, ...S.squad.bench]), listed = new Set(M.list.filter(l => l.seller === 'voce' && !l.done).map(l => l.uid));
    const cards = allCards(S).filter(P => P.tr && !inSq.has(P.u) && !listed.has(P.u)).sort((a, b) => b.ovr - a.ovr);
    openSheet(`<h2>Anunciar carta</h2><p class="small muted" style="margin-top:-4px">Titulares e reservas não aparecem: tire do time antes de vender.</p>
      <div class="plist">${cards.map(P => `<button class="prow" data-act="mkSellCard" data-u="${P.u}">${cardHTML(P)}<div><div class="nm">${esc(P.short)}</div><div class="meta">${P.pos} · valor ~${fmt(marketValue(P))}</div></div><div class="right"><b>${P.ovr}</b></div></button>`).join('') || '<p class="empty-note">Nenhuma carta negociável fora do time.</p>'}</div>`);
  },
  mkSellCard(d: DOMStringMap) {
    const P = cardByUid(app.S, +d.u!); if (!P) return;
    const val = marketValue(P);
    openSheet(`<h2>Vender ${esc(P.short)}</h2><p class="small muted" style="margin-top:-4px">Valor de mercado ~${fmt(val)}. Preço alto demais pode não vender.</p>
      <label class="small muted">Lance inicial</label><input id="mkStart" type="number" inputmode="numeric" value="${roundPrice(val * .85)}">
      <label class="small muted" style="margin-top:8px;display:block">Compre já</label><input id="mkBuyNow" type="number" inputmode="numeric" value="${roundPrice(val * 1.25)}">
      <label class="small muted" style="margin-top:8px;display:block">Duração</label>
      <div class="chips" id="mkDur">${[1, 3, 5].map(m => `<button class="chip" data-m="${m}" aria-pressed="${m === 3}" onclick="this.parentElement.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed','false'));this.setAttribute('aria-pressed','true')">${m} min</button>`).join('')}</div>
      <button class="btn pri block" style="margin-top:14px" data-act="mkListIt" data-u="${P.u}">Anunciar</button>`);
  },
  mkListIt(d: DOMStringMap) {
    const P = cardByUid(app.S, +d.u!); if (!P) return;
    const start = Math.max(100, Number((document.getElementById('mkStart') as HTMLInputElement).value) || 0);
    const bn = Math.max(start, Number((document.getElementById('mkBuyNow') as HTMLInputElement).value) || start);
    const min = Number(document.querySelector<HTMLElement>('#mkDur [aria-pressed="true"]')?.dataset.m ?? 3);
    listMine(M, P.u, P.id, P.v, start, bn, min, Date.now());
    ensureTicker(); closeSheet(); toast(`${P.short} anunciado por ${min} min`); refresh();
  },
};
