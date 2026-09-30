// Telas de guia: melhores por posição (os mais "roubados") e guia tático do seu elenco.
import { cardData } from '../engine/cards';
import { GRUPOS, guiaTatico, ranking, type Fonte, type Grupo, type TaticaRes } from '../engine/guides';
import { SCALE_OFFSET } from '../engine/chemistry';
import { MENT, STYLES } from '../engine/tactics';
import type { Variant } from '../engine/types';
import { cardHTML } from './card';
import { app, render } from './ctx';
import { esc } from './dom';

const g = { grupo: 'ATA' as Grupo, fonte: 'todos' as Fonte, guia: null as { lista: TaticaRes[]; rival: string } | null, rodando: 0 };
const variante = (P: { leg?: boolean; ev?: unknown }): Variant => (P.ev ? 'evento' : P.leg ? 'lenda' : 'base');
const f1 = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function viewRanking(): string {
  const lista = ranking(g.grupo, g.fonte, 12);
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-top:8px"><h2 style="margin:0">🏆 Melhores por posição</h2><button class="btn" data-act="guiaBack">Voltar</button></div>
    <p class="small muted">Os mais "roubados" do jogo: a força real de cada um na posição, com a mesma conta do motor (atributos, estilos de jogo e selo ⚡ Fora de Série).</p>
    <div class="chips cd-chips">${GRUPOS.map(x => `<button class="chip" data-act="rkGrupo" data-g="${x.id}" aria-pressed="${x.id === g.grupo}">${x.n}</button>`).join('')}</div>
    <div class="chips" style="margin-top:8px">${([['todos', 'Todos'], ['atuais', 'Atuais'], ['lendas', 'Lendas'], ['eventos', 'Eventos']] as const).map(([k, n]) => `<button class="chip" data-act="rkFonte" data-f="${k}" aria-pressed="${k === g.fonte}">${n}</button>`).join('')}</div>
    <div class="panel ranks" style="margin-top:12px">${lista.map((x, i) => {
      const P = cardData(x.P.id, variante(x.P));
      return `<div class="rk-row"><i>${i + 1}</i>${cardHTML(P, 'sm')}<div><b>${esc(P.short)}</b>${P.fs ? ' <span class="fs-txt">⚡</span>' : ''}<div class="small muted">${P.pos} · ${P.ovr} · ${esc(P.leg ? (P.hist ?? 'Lenda') : P.ev ? P.ev.n : P.club)}</div></div><em>${Math.round(x.v - SCALE_OFFSET)}</em></div>`;
    }).join('')}</div>
    <p class="small muted">O número à direita é a força na posição (mesma escala da Força do time).</p>`;
}

export function viewTaticas(): string {
  const G = g.guia;
  const linha = (r: TaticaRes) => `<div class="tt-row"><div><b>${r.form}</b> · ${STYLES[r.style].n}${r.ment !== 2 ? ` · ${MENT[r.ment]}` : ''}</div><span class="up">${f1(r.gf)}</span><span class="down">${f1(r.ga)}</span><span>${r.gf - r.ga >= 0 ? '+' : ''}${f1(r.gf - r.ga)}</span></div>`;
  const bloco = (t: string, d: string, l: TaticaRes[]) => `<h3>${t}</h3><p class="small muted" style="margin-top:-4px">${d}</p><div class="panel tt"><div class="tt-row tt-h"><div>Tática</div><span>Gols feitos</span><span>Sofridos</span><span>Saldo</span></div>${l.map(linha).join('')}</div>`;
  let corpo = '';
  if (G) {
    const L = G.lista, norm = L.filter(r => r.ment === 2);
    corpo = `<p class="small muted">Seu elenco (melhor time em cada formação) contra o <b>${esc(G.rival)}</b>, de força parecida, com a mesma sorte em todas as táticas.</p>
      ${bloco('⚽ As que mais fazem gols', 'Boas para buscar a virada.', [...norm].sort((a, b) => b.gf - a.gf).slice(0, 5))}
      ${bloco('🧱 As que menos sofrem gols', 'Boas para segurar resultado.', [...norm].sort((a, b) => a.ga - b.ga).slice(0, 5))}
      ${bloco('⚖️ Melhor saldo', 'O melhor equilíbrio para o dia a dia.', [...norm].sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga)).slice(0, 5))}
      ${bloco('🎲 Extremos', 'Tudo ao ataque faz mais gols, mas deixa espaço atrás; o ferrolho sofre menos, mas quase não ataca.', L.filter(r => r.ment !== 2))}
      <div class="tip">Não existe tática em que seja impossível tomar gol: mesmo a retranca mais fechada sofre às vezes (e ataca pouco). A tática que mais faz gols também costuma sofrer mais — por isso ela é ótima para virar jogo, mas arriscada para segurar vitória.</div>`;
  }
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-top:8px"><h2 style="margin:0">🧠 Guia tático</h2><button class="btn" data-act="guiaBack">Voltar</button></div>
    <p class="small muted">Descubra quais formações e estilos funcionam melhor com o <b>seu</b> elenco: o jogo simula centenas de partidas de cada combinação.</p>
    <button class="btn pri block" data-act="runGuia" ${g.rodando ? 'disabled' : ''}>${g.rodando ? `Simulando… ${g.rodando}%` : G ? 'Simular de novo' : 'Analisar minhas táticas (~15 s)'}</button>
    ${corpo}`;
}

export const guiaActions = {
  openRanking() { app.tab = 'ranking'; render(); window.scrollTo(0, 0); },
  openTaticas() { app.tab = 'taticas'; render(); window.scrollTo(0, 0); },
  guiaBack() { app.tab = 'club'; render(); window.scrollTo(0, 0); },
  rkGrupo(d: DOMStringMap) { g.grupo = d.g as Grupo; render(); },
  rkFonte(d: DOMStringMap) { g.fonte = d.f as Fonte; render(); },
  async runGuia() {
    if (g.rodando) return;
    g.rodando = 1; render();
    g.guia = await guiaTatico(app.S, 30, async (feito, total) => { g.rodando = Math.max(1, Math.round(feito / total * 100)); if (app.tab === 'taticas') render(); await new Promise(r => setTimeout(r, 0)); });
    g.rodando = 0;
    if (app.tab === 'taticas') render();
  },
};
