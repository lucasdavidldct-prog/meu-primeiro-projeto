import { isSpecial, sellValue } from '../../engine/cards';
import { ROLE } from '../../engine/positions';
import { allCards, cardByUid, duplicates } from '../../engine/state';
import { cardHTML } from '../card';
import { app } from '../ctx';
import { webglAvailable } from '../../three/support';
import { esc, fmt } from '../dom';

export function viewClub(): string {
  const S = app.S, all = allCards(S);
  const inSq = new Set([...S.squad.xi, ...S.squad.bench].filter(Boolean));
  const f = app.clubFilter;
  const list = all.filter(P => f === 'todos' ? true : f === 'esp' ? isSpecial(P.tier) : f === 'GOL' ? P.pos === 'GOL'
    : f === 'DEF' ? ROLE(P.pos) === 'D' : f === 'MEI' ? ROLE(P.pos) === 'M' : ROLE(P.pos) === 'A');
  list.sort(app.clubSort === 'ovr' ? (a, b) => b.ovr - a.ovr || b.u - a.u : (a, b) => b.u - a.u);
  const dups = duplicates(S), dupV = dups.reduce((s, u) => s + sellValue(cardByUid(S, u)!), 0);
  const rec = S.rec;
  return `<h2>Clube</h2>
  <div class="panel"><label class="small muted" for="nameIn">Nome do clube</label>
    <div class="row" style="margin-top:4px"><input id="nameIn" maxlength="24" value="${esc(S.name)}" style="flex:1;min-width:0"><button class="btn" data-act="rename">Salvar</button></div>
    <div class="summary" style="margin-top:12px">
      <div class="stat"><small>Cartas</small><b>${S.cards.length}</b></div>
      <div class="stat"><small>V–E–D</small><b style="font-size:21px">${rec.w}–${rec.d}–${rec.l}</b></div>
      <div class="stat"><small>Pacotes</small><b>${rec.packs}</b></div>
    </div>
    <div class="row" style="margin-top:12px;justify-content:space-between"><span class="small muted">Lances jogáveis nas partidas</span><button class="chip" data-act="togMom" aria-pressed="${S.moments}">${S.moments ? 'Ligados' : 'Desligados'}</button></div>
    <div class="row" style="margin-top:8px;justify-content:space-between"><span class="small muted">Visual dos lances${webglAvailable() ? '' : ' (sem 3D neste aparelho)'}</span><div class="chips"><button class="chip" data-act="lance3d" data-v="1" aria-pressed="${S.lance3d !== false && webglAvailable()}" ${webglAvailable() ? '' : 'disabled'}>3D</button><button class="chip" data-act="lance3d" data-v="0" aria-pressed="${S.lance3d === false || !webglAvailable()}">2D (leve)</button></div></div>
  </div>
  ${dups.length ? `<button class="btn block" style="margin-top:12px" data-act="sellDups">Vender ${dups.length} repetida${dups.length > 1 ? 's' : ''} por ${fmt(dupV)} moedas</button>` : ''}
  <h3>Coleção</h3>
  <div class="chips">${[['todos', 'Todos'], ['GOL', 'Goleiros'], ['DEF', 'Defesa'], ['MEI', 'Meio'], ['ATA', 'Ataque'], ['esp', 'Especiais']].map(([k, n]) => `<button class="chip" data-act="cf" data-f="${k}" aria-pressed="${k === f}">${n}</button>`).join('')}
   <button class="chip" data-act="cs" aria-pressed="false">Ordem: ${app.clubSort === 'ovr' ? 'Geral' : 'Recentes'}</button></div>
  <div class="grid" style="margin-top:12px">${list.map(P => `<button data-act="card" data-u="${P.u}" style="position:relative">${cardHTML(P, 'md', inSq.has(P.u) ? '<span class="dup" style="background:var(--good);color:#082014">TIME</span>' : '')}</button>`).join('') || '<p class="empty-note">Nenhuma carta aqui.</p>'}</div>
  <h3>Dados</h3>
  <div class="panel"><p class="small muted" style="margin:0 0 10px">Jogadores e clubes reais vêm de <code>data/ligas</code>. Transferências e ratings podem estar desatualizados: corrija no editor.</p>
    <button class="btn block" data-act="openEditor">Editor de elencos</button></div>
  <h3>Save</h3>
  <div class="panel">
    <p class="small muted" style="margin:0">O progresso fica salvo neste navegador (IndexedDB). Exporte um arquivo para guardar uma cópia ou levar para outro aparelho.</p>
    <div class="file-row"><button class="btn" data-act="exportSave">Exportar save</button><button class="btn" data-act="importSave">Importar save</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
  </div>
  <div class="row" style="margin-top:24px"><button class="btn danger" data-act="reset">Recomeçar do zero</button></div>`;
}
