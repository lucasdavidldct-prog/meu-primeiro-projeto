import { QUALITY_N, quality } from '../../three/qualityLevel';
import { isSpecial, sellValue } from '../../engine/cards';
import { ROLE } from '../../engine/positions';
import { allCards, cardByUid, duplicates } from '../../engine/state';
import { cardCaption, cardHTML } from '../card';
import { app } from '../ctx';
import { webglAvailable } from '../../three/support';
import { esc, fmt } from '../dom';
import { isNative } from '../native';
import { DIF_NAMES } from '../matchView';
import { kitsDoClube } from '../../engine/kits';
import { CLIMAS, CLIMA_I, CLIMA_N, GRAMADOS, GRAMADO_N } from '../../engine/clima';
import { userClub } from '../ctx';
import { kitSVG } from '../kitSvg';
import { musicaHTML } from '../musica';

export function viewClub(): string {
  const S = app.S, all = allCards(S);
  const inSq = new Set([...S.squad.xi, ...S.squad.bench].filter(Boolean));
  const f = app.clubFilter;
  const list = all.filter(P => f === 'todos' ? true : f === 'esp' ? isSpecial(P.tier) : f === 'GOL' ? P.pos === 'GOL'
    : f === 'DEF' ? ROLE(P.pos) === 'D' : f === 'MEI' ? ROLE(P.pos) === 'M' : ROLE(P.pos) === 'A');
  list.sort(app.clubSort === 'ovr' ? (a, b) => b.ovr - a.ovr || b.u - a.u : (a, b) => b.u - a.u);
  const dups = duplicates(S), dupV = dups.reduce((s, u) => s + sellValue(cardByUid(S, u)!), 0);
  const rec = S.rec;
  const v = app.clubView;
  const abas = `<div class="chips seg">${([['colecao', '🃏 Coleção'], ['ajustes', '⚙️ Ajustes'], ['extras', '🧰 Extras']] as const).map(([k, n]) => `<button class="chip" data-act="clubV" data-v="${k}" aria-pressed="${k === v}">${n}</button>`).join('')}</div>`;
  const linha = (rot: string, ctl: string) => `<div class="opt-row"><span>${rot}</span>${ctl}</div>`;
  const tog = (act: string, on: boolean, sim = 'Ligado', nao = 'Desligado') => `<button class="chip" data-act="${act}" aria-pressed="${on}">${on ? sim : nao}</button>`;
  const colecao = `<div class="panel"><label class="small muted" for="nameIn">Nome do clube</label>
    <div class="row" style="margin-top:4px"><input id="nameIn" maxlength="24" value="${esc(S.name)}" style="flex:1;min-width:0"><button class="btn" data-act="rename">Salvar</button></div>
    <div class="summary" style="margin-top:12px">
      <div class="stat"><small>Cartas</small><b>${S.cards.length}</b></div>
      <div class="stat"><small>V–E–D</small><b style="font-size:21px">${rec.w}–${rec.d}–${rec.l}</b></div>
      <div class="stat"><small>Pacotes</small><b>${rec.packs}</b></div>
    </div></div>
  ${dups.length ? `<button class="btn block" style="margin-top:12px" data-act="sellDups">Vender ${dups.length} repetida${dups.length > 1 ? 's' : ''} por ${fmt(dupV)} moedas</button>` : ''}
  <h3>Cartas</h3>
  <div class="chips">${[['todos', 'Todos'], ['GOL', 'Goleiros'], ['DEF', 'Defesa'], ['MEI', 'Meio'], ['ATA', 'Ataque'], ['esp', 'Especiais']].map(([k, n]) => `<button class="chip" data-act="cf" data-f="${k}" aria-pressed="${k === f}">${n}</button>`).join('')}
   <button class="chip" data-act="cs" aria-pressed="false">Ordem: ${app.clubSort === 'ovr' ? 'Geral' : 'Recentes'}</button></div>
  <div class="grid" style="margin-top:12px">${list.map(P => `<button class="rv-item" data-act="card" data-u="${P.u}"><div style="position:relative">${cardHTML(P, 'md', inSq.has(P.u) ? '<span class="dup" style="background:var(--good);color:#082014">TIME</span>' : '')}</div>${cardCaption(P)}</button>`).join('') || '<p class="empty-note">Nenhuma carta aqui.</p>'}</div>`;
  const ajustes = `<h3>Partida</h3><div class="panel">
    ${linha('Lances jogáveis', tog('togMom', S.moments, 'Ligados', 'Desligados'))}
    ${linha('Lances de defesa (goleiro e zaga)', tog('togGk', S.goleiro !== false))}
    <div style="margin-top:10px"><span class="small muted">Dificuldade</span>
      <div class="chips" style="margin-top:4px">${DIF_NAMES.map((n, k) => `<button class="chip" data-act="dif" data-d="${k}" aria-pressed="${(S.dif ?? 1) === k}">${n}</button>`).join('')}</div>
      <p class="small muted" style="margin:4px 0 0">${['Adversários mais fracos e goleiros mais fáceis nos lances.', 'Equilibrado. Fora de casa você tem um lance a menos e o goleiro rival fica mais difícil.', 'Adversários mais fortes e goleiros melhores nos lances.', 'Para quem quer sofrer: rivais bem mais fortes e só 2 lances por jogo.'][S.dif ?? 1]}</p></div>
    ${uniformes()}</div>
  ${webglAvailable() ? `<h3>Visual dos lances</h3><div class="panel">
    <div class="opt-row"><span>Gráficos 3D</span><div class="chips">${(['alta', 'media', 'leve'] as const).map(q => `<button class="chip" data-act="graficos" data-q="${q}" aria-pressed="${quality() === q}">${QUALITY_N[q]}</button>`).join('')}</div></div>
    <p class="small muted" style="margin:4px 0 0">Alta: sombras, brilho dos refletores e torcida cheia (celulares topo de linha). Leve: mais rápido.</p>
    ${ambienteOpts()}</div>` : ''}
  <h3>Som</h3><div class="panel">
    ${linha('Sons do jogo', tog('togSom', S.som !== false, 'Ligados', 'Desligados'))}
    ${linha('Vibração', tog('togVib', S.vibrar !== false, 'Ligada', 'Desligada'))}
    ${musicaHTML()}</div>
  <h3>Internet</h3><div class="panel">${linha('Fotos dos jogadores (Wikimedia Commons)', tog('togFotos', S.fotos !== false, 'Ligadas', 'Desligadas'))}</div>`;
  const extras = `<h3>Aprender</h3><div class="panel"><div class="btn-grid">
      <button class="btn" data-act="help">📖 Como jogar</button><button class="btn" data-act="treino" data-k="ataque">🎯 Treino de lances</button>
      <button class="btn" data-act="openRanking">🏆 Melhores por posição</button><button class="btn" data-act="openTaticas">🧠 Guia tático</button>
      <button class="btn" data-act="openLab">🧪 Laboratório de estilos</button><button class="btn" data-act="openEditor">✏️ Editor de elencos</button></div>
    <p class="small muted" style="margin:10px 0 0">Laboratório: o mesmo jogador sem o estilo, com prata e com +, no lance e na simulação. Editor: corrija transferências e notas de <code>data/ligas</code>.</p></div>
  <h3>Save</h3>
  <div class="panel">
    <p class="small muted" style="margin:0">O progresso fica salvo ${isNative() ? 'neste aparelho' : 'neste navegador (IndexedDB)'}. Exporte um arquivo para guardar uma cópia ou levar para outro aparelho.</p>
    <div class="file-row"><button class="btn" data-act="exportSave">Exportar save</button><button class="btn" data-act="importSave">Importar save</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
  </div>
  <h3>Modo teste</h3>
  <div class="panel"><p class="small muted" style="margin:0 0 10px">Para testar pacotes e o jogo sem precisar juntar moedas.</p><button class="btn block" data-act="testCoins">+1.000.000 moedas</button></div>
  <div class="row" style="margin-top:24px"><button class="btn danger" data-act="reset">Recomeçar do zero</button></div>
  <p class="small muted" style="margin-top:18px;text-align:center">Esquadrão FC · versão ${__APP_VERSION__}</p>`;
  return `<h2>Clube</h2>${abas}<div style="margin-top:12px">${v === 'ajustes' ? ajustes : v === 'extras' ? extras : colecao}</div>`;
}

/** Escolha do uniforme: automático (titular; fora de casa troca se confundir com o rival) ou um fixo. */
function uniformes(): string {
  const S = app.S, uc = userClub(), ks = kitsDoClube(S.career?.club, uc.c1, uc.c2), sel = S.uniforme;
  return `<div style="margin-top:12px"><span class="small muted">Uniforme</span>
    <div class="kits">
      <button class="kit-op" data-act="uniforme" data-k="-1" aria-pressed="${sel === undefined}">${kitSVG(ks[0], 52)}<b>Automático</b><small>Troca se confundir</small></button>
      ${ks.map((k, i) => `<button class="kit-op" data-act="uniforme" data-k="${i}" aria-pressed="${sel === i}">${kitSVG(k, 52)}<b>${k.n}</b><small>Sempre este</small></button>`).join('')}
    </div></div>`;
}

/** Câmera, clima e gramado dos lances 3D. */
function ambienteOpts(): string {
  const S = app.S, chips = (act: string, sel: string, ops: [string, string][]) => ops.map(([k, n]) => `<button class="chip" data-act="${act}" data-v="${k}" aria-pressed="${sel === k}">${n}</button>`).join('');
  return `<div style="margin-top:10px"><span class="small muted">Câmera dos lances (dá para trocar e girar 360° durante o lance)</span>
      <div class="chips" style="margin-top:4px">${chips('setCamera', S.camera && S.camera !== 'aerea' ? S.camera : 'padrao', [['padrao', 'Padrão (atrás da jogada)'], ['tv', 'TV (de lado)'], ['atras', 'Atrás do jogador']])}</div></div>
    <div style="margin-top:10px"><span class="small muted">Clima das partidas</span>
      <div class="chips" style="margin-top:4px">${chips('setClima', S.clima ?? 'auto', [['auto', '🎲 Variado'], ...CLIMAS.map(c => [c, `${CLIMA_I[c]} ${CLIMA_N[c]}`] as [string, string])])}</div>
      <p class="small muted" style="margin:4px 0 0">Variado: cada jogo tem o seu (no Brasil não neva). Chuva e neve deixam passes e chutes um pouco mais difíceis.</p></div>
    <div style="margin-top:10px"><span class="small muted">Gramado</span>
      <div class="chips" style="margin-top:4px">${chips('setGramado', S.gramado ?? 'faixas', GRAMADOS.map(g => [g, GRAMADO_N[g]]))}</div></div>`;
}
