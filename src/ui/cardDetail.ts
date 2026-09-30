// Detalhes da carta em abas: Atributos (detalhados), Estilos (+ e prata), Personalizar (estilos extras e química) e Info.
import { detail, type Detail } from '../engine/attrs';
import { TIER_N, VAR, sellValue } from '../engine/cards';
import { CHEM_BY_ID, chemBoost, chemStylesFor } from '../engine/chemStyles';
import { LEG_CATS, PLAYSTYLES, PS_BY_ID, PS_CATS, parsePs, type PsCat } from '../engine/data/schema';
import { STAT_G, STAT_L } from '../engine/positions';
import { cardByUid, teamInfo } from '../engine/state';
import type { OwnedCard } from '../engine/types';
import { clubOf, leagueName, nationOf } from '../engine/world';
import { cardHTML, flagHTML } from './card';
import { app, save } from './ctx';
import { esc, fmt, openSheet, toast } from './dom';
import { fotoDe, temFotoCommons } from './fotos';
import { psIcon } from './psIcons';

type CardTab = 'atr' | 'ps' | 'custom' | 'info';
let tab: CardTab = 'atr';
let cur = 0;

const tone = (v: number) => (v >= 80 ? 'hi' : v >= 65 ? 'md' : 'lo');
const stars = (n: number) => `<span class="stars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

/** Química atual da carta, se estiver entre os titulares. */
function chemOf(u: number): number | null {
  const S = app.S, i = S.squad.xi.indexOf(u);
  return i >= 0 ? teamInfo(S).chem.per[i] : null;
}

export function showCard(u: number): void {
  const S = app.S, P = cardByUid(S, u);
  if (!P) return;
  if (cur !== u) { cur = u; tab = 'atr'; }
  const d = detail(P);
  // Trocar de aba não refaz a animação de abrir a janela
  const reopen = !!document.querySelector('#sheet .cd-head');
  const tabs: [CardTab, string][] = [['atr', 'Atributos'], ['ps', 'Estilos'], ['custom', 'Personalizar'], ['info', 'Info']];
  const bg = openSheet(`<div class="cd-head">${cardHTML(P, 'lg')}
     <div class="cd-meta">
       <h2>${esc(P.short)}</h2>
       <div class="small muted">${esc(P.name)}</div>
       <div class="cd-kv">
         <span>Versão</span><b>${P.v === 'base' || P.leg ? TIER_N[P.tier] : VAR[P.v].n}</b>
         <span>Posição</span><b>${P.pos}${P.alt.length ? ' · ' + P.alt.join(' ') : ''}</b>
         <span>Dribles</span><b>${stars(d.skills)}</b>
         <span>Perna ruim</span><b>${stars(d.weak)}</b>
         ${P.num ? `<span>Camisa</span><b>${P.num}</b>` : ''}
         <span>Pé</span><b>${{ D: 'Direito', E: 'Esquerdo', A: 'Ambidestro' }[P.foot]}</b>
         ${P.fs ? '<span>Raridade</span><b class="fs-txt">⚡ Fora de Série</b>' : ''}
         ${P.quim ? `<span>Química</span><b>${esc(CHEM_BY_ID.get(P.quim)?.n ?? '')}</b>` : ''}
       </div>
     </div></div>
   <div class="cd-tabs">${tabs.map(([k, n]) => `<button data-act="cardTab" data-t="${k}" aria-current="${k === tab}">${n}</button>`).join('')}</div>
   <div class="cd-body">${tab === 'atr' ? attrsHTML(P, d) : tab === 'ps' ? stylesHTML(P) : tab === 'custom' ? customHTML(P) : infoHTML(P)}</div>`);
  if (reopen) { bg.style.animation = 'none'; const sh = bg.querySelector<HTMLElement>('.sheet'); if (sh) sh.style.animation = 'none'; }
}

function attrsHTML(P: OwnedCard, d: Detail): string {
  const L = P.pos === 'GOL' ? STAT_G : STAT_L;
  const q = chemOf(P.u), boost = P.quim && q != null ? chemBoost(P.quim, q) : null;
  const main = `<div class="cd-main">${P.st.map((s, i) => `<div class="cd-m ${tone(s)}"><b>${s}</b><span>${L[i]}</span>${boost?.[i] ? `<em>+${boost[i]}</em>` : ''}</div>`).join('')}</div>
    ${boost ? `<p class="small muted" style="margin:6px 0 0">Com o estilo de química e química ${q}/3 no seu time, os atributos em campo ganham os pontos em verde.</p>` : ''}`;
  return main + `<div class="cd-groups">${d.groups.map(g => `<section class="cd-g"><header><span>${g.n}</span><b class="${tone(g.main)}">${g.main}</b></header>
      <i class="cd-bar ${tone(g.main)}"><b style="width:${g.main}%"></b></i>
      ${g.subs.map(s => `<div class="cd-s"><span>${s.n}</span><b class="${tone(s.v)}">${s.v}</b></div>`).join('')}</section>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">Os detalhes derivam dos 6 atributos principais, da posição e dos estilos de jogo. Eles pesam nos lances: chute de longe, voleio, pênalti, falta, cruzamento, passe curto e longo, drible e pique.</p>`;
}

/** Estilos agrupados por categoria, com o nível e o que fazem. */
export function psDetail(list: string[]): string {
  const items = list.map(x => { const { id, plus } = parsePs(x); return { d: PS_BY_ID.get(id), plus }; }).filter(x => x.d);
  return (Object.keys(PS_CATS) as PsCat[]).map(cat => {
    const g = items.filter(x => x.d!.cat === cat);
    return g.length ? `<div class="ps-cat">${PS_CATS[cat]}</div><div class="ps-list">${g.map(({ d, plus }) => `<div class="ps-item ${plus ? 'plus' : ''}"><span class="ic">${psIcon(d!.id)}</span><div><b>${d!.nome}<span class="lvl">${plus ? '+ dourado' : 'prata'}</span></b><span class="muted">${plus ? d!.descPlus + ' ' + d!.desc : d!.desc}</span></div></div>`).join('')}</div>` : '';
  }).join('');
}

function stylesHTML(P: OwnedCard): string {
  const fs = P.fs ? '<div class="fs-box"><b>⚡ Fora de Série</b><span>Um dos 3 melhores da posição na história. Quase impossível de desarmar, quase não erra o chute (o goleiro defende menos) e pesa mais na força do time. Raríssimo: 3% no pacote Lenda e quase nunca à venda no mercado.</span></div>' : '';
  const plus = P.ps.filter(x => x.endsWith('+')), prata = P.ps.filter(x => !x.endsWith('+'));
  return `${fs}<p class="small muted" style="margin-top:0">Na carta aparecem só os estilos <b>+</b> (dourados). Os pratas ficam aqui.</p>
    ${plus.length ? `<h3>Estilos + (${plus.length})</h3>${psDetail(plus)}` : ''}
    ${prata.length ? `<h3>Estilos prata (${prata.length})</h3>${psDetail(prata)}` : ''}
    ${P.ps.length ? '' : '<p class="empty-note">Sem estilos de jogo. Dá para dar um + e um prata em Personalizar.</p>'}`;
}

function customHTML(P: OwnedCard): string {
  const ex = app.S.cards.find(c => c.u === P.u)?.ex ?? {};
  const gk = P.pos === 'GOL', list = PLAYSTYLES.filter(p => p.gol === gk);
  const chip = (act: string, id: string, on: boolean, label: string) => `<button class="chip" data-act="${act}" data-u="${P.u}" data-id="${id}" aria-pressed="${on}">${id ? psIcon(id) : ''} ${esc(label)}</button>`;
  const q = chemOf(P.u);
  return `<h3 style="margin-top:0">Número da camisa</h3>
    <div class="row" style="gap:8px"><input id="cdNum" type="number" inputmode="numeric" min="1" max="99" value="${ex.num ?? ''}" placeholder="—" style="width:90px"><button class="btn" data-act="exNum" data-u="${P.u}">Salvar número</button>${ex.num ? `<button class="btn" data-act="exNum" data-u="${P.u}" data-clear="1">Tirar</button>` : ''}</div>
    <p class="small muted">Aparece nas costas do jogador nos lances 3D.</p>
    <p class="small muted">Escolha <b>um estilo +</b>, <b>um prata</b> e o <b>estilo de química</b> desta carta. Pode trocar quando quiser, de graça.</p>
    <h3>Estilo + (dourado)</h3><div class="chips cd-chips">${chip('exPlus', '', !ex.plus, 'Nenhum')}${list.map(p => chip('exPlus', p.id, ex.plus === p.id, p.nome)).join('')}</div>
    <h3>Estilo prata</h3><div class="chips cd-chips">${chip('exPrata', '', !ex.prata, 'Nenhum')}${list.filter(p => p.id !== ex.plus).map(p => chip('exPrata', p.id, ex.prata === p.id, p.nome)).join('')}</div>
    <h3>Estilo de química</h3>
    <p class="small muted" style="margin-top:-4px">${q != null ? `Química atual no time: <b>${q}/3</b>.` : 'Fora dos titulares: o bônus vale quando ele jogar.'} O bônus cheio é com química 3; com 2 vale 2/3, com 1 vale 1/3.</p>
    <div class="chem-list">${[{ id: '', n: 'Nenhum', d: 'Sem bônus.', b: [0, 0, 0, 0, 0, 0] }, ...chemStylesFor(P)].map(c => `<button class="chem-it" data-act="exQuim" data-u="${P.u}" data-id="${c.id}" aria-pressed="${(ex.quim ?? '') === c.id}">
        <b>${esc(c.n)}</b><span class="muted">${esc(c.d)}</span>
        <span class="chem-b">${c.b.map((v, i) => (v ? `<em>${(gk ? STAT_G : STAT_L)[i]} +${v}</em>` : '')).join('')}</span></button>`).join('')}</div>`;
}

function infoHTML(P: OwnedCard): string {
  const S = app.S, inSq = S.squad.xi.includes(P.u) || S.squad.bench.includes(P.u);
  return `<div class="cd-info">
      <div>${flagHTML(P.nat)} ${esc(nationOf(P.nat).n)}</div>
      <div>${P.leg ? `<b>${LEG_CATS[P.legCat ?? 'idolo']}</b> · ${esc(P.hist ?? 'Lendas')}${P.epoca ? ' (' + esc(P.epoca) + ')' : ''}` : `${esc(leagueName(P))} · ${esc(clubOf(P).n)}`}</div>
      ${P.leg ? '' : `<div>${P.age} anos</div>`}
      ${P.legClub === 'CAM' ? '<div>Ídolo do Atlético Mineiro</div>' : ''}
    </div>
    ${photoPanel(P.id)}
    ${S.career?.mercado ? `<p class="small muted" style="margin:10px 0 0">${P.tr ? '🔓 Negociável no mercado de leilão' : '🔒 Intransferível (veio de pacote): não vai ao leilão, mas pode ser vendida rápido abaixo.'}</p>` : ''}
    <div style="margin-top:16px">${inSq ? '<p class="small muted">Está no seu elenco. Tire do time para poder vender.</p>' : `<button class="btn danger block" data-act="sell" data-u="${P.u}">Vender por ${fmt(sellValue(P))} moedas</button>`}</div>`;
}

function photoPanel(id: string): string {
  const f = fotoDe(id);
  const credit = f?.fonte === 'commons' ? `<a href="${esc(f.pagina!)}" target="_blank" rel="noopener">Foto: Wikimedia Commons (licença livre)</a>` : f?.fonte === 'minha' ? 'Foto escolhida por você' : temFotoCommons(id) && app.S.fotos === false ? 'Fotos da internet desligadas em Clube' : 'Sem foto';
  return `<h3>Foto</h3><div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted" style="flex:1 1 100%">${credit}</span>
    <button class="btn" data-act="photoPick" data-id="${esc(id)}">${f?.fonte === 'minha' ? 'Trocar minha foto' : 'Escolher foto'}</button>
    ${f?.fonte === 'minha' ? `<button class="btn" data-act="photoDel" data-id="${esc(id)}">Remover minha foto</button>` : ''}</div>`;
}

function setEx(u: number, k: 'plus' | 'prata' | 'quim', id: string): void {
  const c = app.S.cards.find(c => c.u === u);
  if (!c) return;
  const ex = { ...(c.ex ?? {}) };
  if (id) ex[k] = id; else delete ex[k];
  if (k === 'plus' && ex.prata === id) delete ex.prata;
  c.ex = Object.keys(ex).length ? ex : undefined;
  if (!c.ex) delete c.ex;
  save();
  const sh = document.querySelector<HTMLElement>('#sheet .sheet'), y = sh?.scrollTop ?? 0;
  showCard(u);
  document.querySelector<HTMLElement>('#sheet .sheet')?.scrollTo(0, y);
}

export const cardDetailActions = {
  exNum(d: DOMStringMap) {
    const c = app.S.cards.find(c => c.u === +d.u!); if (!c) return;
    const n = d.clear ? 0 : Math.round(Number((document.getElementById('cdNum') as HTMLInputElement | null)?.value));
    if (!d.clear && !(n >= 1 && n <= 99)) { toast('Escolha um número de 1 a 99'); return; }
    c.ex = { ...(c.ex ?? {}) };
    if (n) c.ex.num = n; else delete c.ex.num;
    if (!Object.keys(c.ex).length) delete c.ex;
    save(); showCard(c.u); toast(n ? `Camisa ${n}` : 'Número removido');
  },
  cardTab(d: DOMStringMap) { tab = d.t as CardTab; showCard(cur); },
  exPlus(d: DOMStringMap) { setEx(+d.u!, 'plus', d.id ?? ''); },
  exPrata(d: DOMStringMap) { setEx(+d.u!, 'prata', d.id ?? ''); },
  exQuim(d: DOMStringMap) { setEx(+d.u!, 'quim', d.id ?? ''); },
};
