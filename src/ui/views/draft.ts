// Aba Desafios: o Draft dos Craques (monte o time carta por carta e encare um mata-mata de 4 jogos).
import { cardData } from '../../engine/cards';
import { DRAFT_CUSTO, FASES_DRAFT, draftForca, draftPlayers, draftPremio } from '../../engine/draft';
import { slotsOf } from '../../engine/positions';
import { clubStrength } from '../../engine/squads';
import { today } from '../../engine/state';
import { W } from '../../engine/world';
import type { BasePlayer } from '../../engine/types';
import { cardHTML } from '../card';
import { app } from '../ctx';
import { crestHTML } from '../crest';
import { esc, fmt } from '../dom';

const carta = (P: BasePlayer, size = 'md') => cardHTML(cardData(P.id, P.leg ? 'lenda' : 'base'), size);
const clube = (id: string) => { const c = W.clubs.get(id); return c ? { n: c.n, s: c.s, c1: c.c1, c2: c.c2 } : { n: id, s: id, c1: '#555', c2: '#ddd' }; };

function premios(): string {
  return `<div class="dr-premios">${[0, 1, 2, 3, 4].map(w => { const p = draftPremio(w); return `<div class="${w === 4 ? 'top' : ''}"><b>${w === 4 ? '🏆 Campeão' : `${w} vitória${w === 1 ? '' : 's'}`}</b><span>${fmt(p.coins)} moedas${p.pack ? ` + pacote ${p.pack === 'premium' ? 'Premium' : 'Ouro'}` : ''}${p.carta ? ' + 1 carta do seu draft' : ''}</span></div>`; }).join('')}</div>`;
}

/** Campinho com as vagas: escolhidas mostram o nome; a vaga da vez pisca. */
function campinho(): string {
  const D = app.S.draft!, slots = slotsOf(D.form!), xi = draftPlayers(D);
  return `<div class="dr-campo">${slots.map((s, i) => { const P = xi[i]; return `<span class="dr-vaga ${P ? 'ok' : ''} ${D.fase === 'escolha' && i === D.slot ? 'agora' : ''}" style="left:${s.x}%;top:${100 - s.y}%"><b>${P ? P.ovr : s.p}</b>${P ? `<i>${esc(P.short)}</i>` : ''}</span>`; }).join('')}</div>`;
}

export function viewDraft(): string {
  const S = app.S, D = S.draft, rec = S.draftRec ?? { jogos: 0, titulos: 0, melhor: 0, vitorias: 0 };
  const gratis = S.draftDia !== today();
  if (!D) {
    return `<h2>Desafios</h2>
    <div class="panel dr-hero"><h3 style="margin-top:0">⚡ Draft dos Craques</h3>
      <p>Monte um time do zero: escolha a formação, o capitão e, em cada posição, <b>1 entre 5 cartas</b> (jogadores, lendas e Fora de Série). Química conta!</p>
      <p>Depois, mata-mata de <b>4 jogos</b> com rivais cada vez mais fortes. <b>Perdeu, acabou.</b> Ganhou os 4: leva uma carta do seu draft para o clube.</p>
      ${premios()}
      <button class="btn pri block" data-act="draftNovo">${gratis ? 'Começar draft · grátis hoje' : `Começar draft · ${fmt(DRAFT_CUSTO)} moedas`}</button>
      ${gratis ? '' : '<p class="small muted" style="text-align:center;margin:6px 0 0">Amanhã tem entrada grátis de novo.</p>'}
    </div>
    <h3>Seus recordes</h3>
    <div class="summary"><div class="stat"><small>Drafts</small><b>${rec.jogos}</b></div><div class="stat"><small>Títulos</small><b>${rec.titulos}</b></div><div class="stat"><small>Melhor campanha</small><b>${rec.melhor === 4 ? '🏆' : rec.melhor + 'V'}</b></div></div>`;
  }
  const f = draftForca(D);
  const topo = `<div class="row" style="justify-content:space-between;align-items:baseline"><h2>Draft dos Craques</h2>${D.form ? `<span class="small muted">${D.form} · Força <b>${f.forca}</b> · Química <b>${f.quim}</b>/33</span>` : ''}</div>`;
  if (D.fase === 'formacao') return `${topo}<p class="small muted">Escolha a formação do seu time.</p>
    <div class="dr-ops">${D.formOps.map(fo => `<button class="btn dr-form" data-act="draftForm" data-f="${fo}"><b>${fo}</b></button>`).join('')}</div>`;
  if (D.fase === 'capitao') return `${topo}<p class="small muted">Escolha o <b>capitão</b>: ele já entra no time, na posição dele.</p>
    <div class="dr-cards">${D.capOps.map(id => `<button class="dr-card" data-act="draftCap" data-id="${id}">${carta(W.players.get(id)!)}</button>`).join('')}</div>`;
  if (D.fase === 'escolha') {
    const pos = slotsOf(D.form!)[D.slot].p, faltam = D.picks.filter(p => !p).length;
    return `${topo}${campinho()}<p class="small" style="margin:10px 0 6px">Escolha o <b>${pos}</b> · faltam ${faltam}</p>
    <div class="dr-cards">${D.ops.map(id => `<button class="dr-card" data-act="draftPick" data-id="${id}">${carta(W.players.get(id)!)}</button>`).join('')}</div>`;
  }
  // Jogos e fim
  const etapas = FASES_DRAFT.map((n, i) => {
    const j = D.jogos[i], rival = D.rivais[i], st = j ? ((j.gf > j.ga || (j.pens && j.pens[0] > j.pens[1])) ? 'ok' : 'x') : i === D.jogos.length && D.fase === 'jogos' ? 'agora' : '';
    return `<div class="dr-etapa ${st}"><small>${n}</small>${crestHTML(clube(rival), 'row')}<span>${esc(clube(rival).n)} <em class="muted">${clubStrength(rival)}</em></span><b>${j ? `${j.gf} × ${j.ga}${j.pens ? ` <small>(${j.pens[0]}–${j.pens[1]})</small>` : ''}` : '—'}</b></div>`;
  }).join('');
  if (D.fase === 'jogos') {
    const i = D.jogos.length, rival = D.rivais[i];
    return `${topo}${campinho()}<div class="panel" style="margin-top:12px">${etapas}</div>
    <div class="panel" style="margin-top:12px;text-align:center"><div class="small muted" style="text-transform:uppercase;letter-spacing:.06em">${FASES_DRAFT[i]}</div>
      <div style="margin:8px 0">${crestHTML(clube(rival), 'team')}<div class="nm">${esc(clube(rival).n)}</div><div class="small muted">Força ${clubStrength(rival)}</div></div>
      <div class="row" style="gap:8px"><button class="btn pri" style="flex:1" data-act="draftJogar">Jogar</button><button class="btn" data-act="draftSimular">Simular</button></div>
      <p class="small muted" style="margin:8px 0 0">Valendo agora: ${fmt(draftPremio(D.wins + 1).coins)} moedas se passar. Perdeu, leva ${fmt(draftPremio(D.wins).coins)}.</p></div>
    <button class="btn block" style="margin-top:12px" data-act="draftDesistir">Desistir e receber o prêmio atual</button>`;
  }
  const p = draftPremio(D.wins), campeao = D.wins >= 4;
  return `${topo}<div class="panel dr-fim ${campeao ? 'campeao' : ''}"><h3 style="margin-top:0">${campeao ? '🏆 Campeão do Draft!' : `Fim da linha: ${D.wins} vitória${D.wins === 1 ? '' : 's'}`}</h3>
    <p>+${fmt(p.coins)} moedas${p.pack ? ` e um pacote ${p.pack === 'premium' ? 'Premium' : 'Ouro'}` : ''}.</p>
    ${campeao && !D.levou ? `<p><b>Escolha 1 carta do seu draft para levar para o clube:</b></p><div class="dr-cards">${draftPlayers(D).map(P => `<button class="dr-card" data-act="draftLevar" data-id="${P!.id}">${carta(P!, 'sm')}</button>`).join('')}</div>` : ''}
    ${!campeao || D.levou ? `<div class="row" style="gap:8px;margin-top:10px">${p.pack && !D.abriu ? `<button class="btn" style="flex:1" data-act="draftPacote">Abrir pacote</button>` : ''}<button class="btn pri" style="flex:1" data-act="draftFechar">Novo draft</button></div>` : ''}
  </div><div class="panel" style="margin-top:12px">${etapas}</div>`;
}
