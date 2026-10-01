// Lance de defesa: o rival ataca o SEU gol e você comanda a zaga.
// A cada rodada o atacante com a bola vai passar, driblar ou chutar. Você escolhe um defensor e o que ele faz:
//  · Bote (desarme em pé) contra o drible · Carrinho (alcance maior, risco de falta sem o estilo Carrinho)
//  · Cortar o passe (fica na linha do passe) · Fechar o chute (se joga na frente da bola).
// Acertou a leitura: boa chance de roubar a bola, com os estilos de defesa pesando (e aparecendo na tela).
// Errou: o defensor fica para trás (Contenção evita o bote errado) e a jogada do rival segue.
// Coordenadas iguais às do lance de ataque: x 0–68, y = distância da SUA linha de fundo (seu gol em y = 0).
import { sub, type SubName } from './attrs';
import type { Match, MomentResult, SideEntry } from './match';
import { psLevel, type PsId } from './playstyles';
import { R, clamp, rn, type Rng } from './rng';
import { psTag, segD, type PsTag } from './lanceScene';

export type DefAcao = 'bote' | 'carrinho' | 'cortar' | 'fechar';
export type AtqAcao = 'passe' | 'drible' | 'chute';
export const DEF_N: Record<DefAcao, string> = { bote: 'Bote', carrinho: 'Carrinho', cortar: 'Cortar o passe', fechar: 'Fechar o chute' };
const CONTRA: Record<DefAcao, AtqAcao[]> = { bote: ['drible'], carrinho: ['drible', 'passe'], cortar: ['passe'], fechar: ['chute'] };

export interface DActor { id: number; x: number; y: number; tx: number; ty: number; e?: SideEntry; gk?: boolean; team: 0 | 1; num: number; batido?: boolean }
/** O que o rival vai fazer nesta rodada (a IA decide antes; a Antecipação pode revelar). */
export interface Intencao { a: AtqAcao; para?: DActor; alto?: boolean; x: number; y: number }
export interface DefOpcao { d: DActor; acao: DefAcao; p: number; ps: PsTag[]; falta: number; dica: string }
export interface DefPlano {
  /** Movimento: para onde vão o defensor escolhido, a bola e o portador. */
  def: { d: DActor; x: number; y: number; anim: 'bote' | 'carrinho' | 'corte' | 'bloqueio' | 'parado' };
  ball: { x: number; y: number; h: number }[];
  dur: number;
  intencao: Intencao;
  ok: boolean;
  say: string;
  color: string;
  ps: PsTag[];
  end?: { res: MomentResult; text: string; color: string; goal: boolean };
  commit: () => void;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const sb = (e: SideEntry | undefined, n: SubName, k: number) => (e?.P.st && e.P.pos !== 'GOL' ? sub(e.P, n) : e?.P.st?.[k] ?? e?.base ?? 70);

export class DefesaScene {
  atk: DActor[] = [];
  def: DActor[] = [];
  carrier!: DActor;
  actions = 3;
  done = false;
  intencao!: Intencao;
  /** Leitura da Antecipação: a intenção do rival fica visível nesta rodada. */
  lida = false;
  readonly gkE?: SideEntry;
  private nid = 1;
  private r: Rng;
  constructor(readonly M: Match, shooter: SideEntry, helper?: SideEntry | null, r: Rng = R) {
    this.r = r;
    const A = M.A, B = M.B;
    const mk = (x: number, y: number, team: 0 | 1, e?: SideEntry, gk = false, num = 0): DActor => ({ id: this.nid++, x, y, tx: x, ty: y, e, gk, team, num: num || ((e?.P as { num?: number })?.num ?? ((team ? B : A).xi.indexOf(e!) + 1)) });
    // Sua zaga: zagueiros, laterais e volantes em campo (até 5), numa linha na frente da área
    this.gkE = A.xi.find(e => e.pos === 'GOL' && !e.red);
    const zaga = A.xi.filter(e => !e.red && ['ZAG', 'LD', 'LE', 'VOL'].includes(e.pos)).slice(0, 5);
    if (zaga.length < 3) zaga.push(...A.xi.filter(e => !e.red && e.pos !== 'GOL' && !zaga.includes(e)).slice(0, 3 - zaga.length));
    const lineY = rn(13, 17, r), zags = zaga.filter(e => e.pos === 'ZAG'), vols = zaga.filter(e => e.pos === 'VOL');
    zaga.forEach(e => {
      const p = e.pos, i = zags.indexOf(e), v = vols.indexOf(e);
      const x = p === 'LE' ? rn(12, 17, r) : p === 'LD' ? rn(51, 56, r) : p === 'VOL' ? 34 + (v - (vols.length - 1) / 2) * 10 : p === 'ZAG' ? 34 + (i - (zags.length - 1) / 2) * 9 : rn(24, 44, r);
      this.def.push(mk(x, p === 'VOL' ? lineY + rn(6, 9, r) : lineY + rn(-1, 1, r), 0, e));
    });
    this.def.push(mk(34, .8, 0, this.gkE, true, 1));
    // Ataque rival: o portador vem pelo meio ou pela ponta, com 2 ou 3 companheiros
    const outros = B.xi.filter(e => !e.red && e.pos !== 'GOL' && e !== shooter && e !== helper).sort((a, b) => sb(b, 'Posicionamento', 1) - sb(a, 'Posicionamento', 1));
    const porta = helper && !helper.red ? helper : shooter;
    const lado = r() < .5 ? -1 : 1, bx = 34 + lado * rn(0, 14, r), by = rn(27, 33, r);
    this.carrier = mk(bx, by, 1, porta);
    this.atk.push(this.carrier);
    const rec = [porta === shooter ? outros[0] : shooter, outros[1], r() < .5 ? outros[2] : undefined].filter((e): e is SideEntry => !!e);
    rec.forEach((e, k) => this.atk.push(mk(clamp(34 - lado * (k === 0 ? rn(2, 8, r) : rn(10, 20, r)) * (k === 2 ? -1 : 1), 6, 62), clamp(lineY + rn(1, 6, r), 10, 30), 1, e)));
    this.decidir();
  }

  get ballAt() { return { x: this.carrier.x + (this.carrier.x < 34 ? .4 : -.4), y: this.carrier.y - .7, h: 0 }; }
  campo(): DActor[] { return this.def.filter(d => !d.gk); }
  private lv(d: DActor, id: PsId) { return psLevel(d.e?.P, id); }

  /** A IA do rival escolhe a jogada: chuta de perto com espaço, dribla com campo livre, senão procura o passe mais limpo. */
  decidir(): void {
    const r = this.r, c = this.carrier, D = Math.hypot(c.x - 34, c.y), livres = this.campo().filter(d => !d.batido);
    const perto = Math.min(99, ...livres.map(d => dist(d, c)));
    const lane = (to: { x: number; y: number }) => Math.min(99, ...livres.map(d => segD(d, c, to)));
    const recs = this.atk.filter(a => a !== c).map(a => ({ a, q: lane(a) + (a.y < c.y ? 2 : 0) - dist(a, c) * .05 })).sort((p, q) => q.q - p.q);
    const wChute = this.actions <= 1 ? 99 : D < 24 ? (lane({ x: 34, y: 0 }) > 2 ? 2.4 : 1) * (1.4 - D / 30) : .05;
    const wDrib = perto > 4 ? 1.6 : .8, wPasse = recs.length ? 1.2 + (recs[0].q > 3 ? .6 : 0) : 0;
    const tot = wChute + wDrib + wPasse, k = r() * tot;
    if (k < wChute) this.intencao = { a: 'chute', x: clamp(34 + rn(-3, 3, r), 31, 37), y: 0 };
    else if (k < wChute + wDrib) { const gx = 34 - c.x, gy = -c.y, L = Math.hypot(gx, gy) || 1; this.intencao = { a: 'drible', x: clamp(c.x + gx / L * 7, 3, 65), y: clamp(c.y + gy / L * 7, 6, 44) }; }
    else { const alvo = recs[Math.min(recs.length - 1, r() < .7 ? 0 : 1)].a; this.intencao = { a: 'passe', para: alvo, alto: (c.x < 16 || c.x > 52) && alvo.y < 16, x: alvo.x, y: alvo.y }; }
    // Antecipação na sua zaga: lê a jogada antes (prata às vezes, dourado sempre)
    const ant = Math.max(0, ...this.campo().map(d => this.lv(d, 'antecipacao')));
    this.lida = ant === 2 || (ant === 1 && r() < .6);
  }
  /** Quem tem Antecipação na sua zaga (para mostrar a leitura). */
  antecipador(): DActor | undefined { return this.campo().find(d => this.lv(d, 'antecipacao')); }

  /** Opções de cada defensor: só as que dão para fazer de onde ele está. */
  /** O defensor mais bem colocado para responder à jogada que o rival vai fazer (o que a Antecipação destaca). */
  resposta(): DActor | undefined {
    const c = this.carrier, it = this.intencao, livres = this.campo().filter(d => !d.batido);
    const k = (d: DActor) => (it.a === 'drible' ? dist(d, c) : it.a === 'passe' && it.para ? segD(d, c, it.para) : segD(d, c, { x: 34, y: 0 }));
    return livres.sort((p, q) => k(p) - k(q))[0];
  }

  opcoes(d: DActor): DefOpcao[] {
    if (d.gk || d.batido) return [];
    // Quem está mais bem colocado sempre tem a ação certa contra a jogada (a leitura da Antecipação nunca fica sem resposta)
    const chave = this.resposta() === d ? this.intencao.a : null;
    const c = this.carrier, D = dist(d, c), out: DefOpcao[] = [], P = d.e?.P;
    const def = d.e?.P.st?.[4] ?? 70, fis = d.e?.P.st?.[5] ?? 70, atkDri = sb(c.e, 'Drible', 3);
    const tag = (ids: PsId[]) => ids.map(id => psTag(id, psLevel(P, id))).filter((x): x is PsTag => !!x);
    // O mais perto da bola sempre pode dar o bote (mesmo de longe, com chance menor): o lance nunca trava
    const maisPerto = this.campo().filter(x => !x.batido).sort((p, q) => dist(p, c) - dist(q, c))[0] === d;
    if (D < 7 || maisPerto || chave === 'drible') {
      const p = clamp((.5 + (sb(d.e, 'Desarme em pé', 4) - atkDri) * .012 - Math.min(.3, Math.max(0, D - 2.5) * .06)) * [1, 1.12, 1.25][this.lv(d, 'desarme')] * [1, 1.15, 1.3][this.lv(d, 'contencao')] * [1, 1.06, 1.12][this.lv(d, 'imposicao-fisica')] * (fis > 80 ? 1.05 : 1), .1, .92);
      out.push({ d, acao: 'bote', p, ps: tag(['desarme', 'contencao', 'imposicao-fisica']), falta: .04, dica: this.lv(d, 'contencao') ? 'Contra o drible. Com Contenção, se errar ele não fica para trás.' : 'Contra o drible. Se ele passar ou chutar, você fica para trás.' });
    }
    if (D < 10) {
      const lv = this.lv(d, 'desarme');
      const p = clamp((.58 + (sb(d.e, 'Carrinho', 4) - atkDri) * .012 - Math.max(0, D - 4) * .04) * [1, 1.2, 1.35][lv], .1, .93);
      out.push({ d, acao: 'carrinho', p, ps: tag(['desarme']), falta: [.3, .12, .05][lv], dica: lv ? 'Pega de longe o drible e o passe. Com o estilo Carrinho, quase nunca é falta.' : 'Pega de longe o drible e o passe, mas pode ser falta (e cartão).' });
    }
    const it = this.intencao, alvo = it.para ?? this.atk.filter(a => a !== c).sort((p, q) => dist(p, d) - dist(q, d))[0];
    if (alvo && (segD(d, c, alvo) < 11 || chave === 'passe')) {
      const p = clamp((.45 + (sb(d.e, 'Interceptação', 4) - 70) * .012 - Math.min(.3, segD(d, c, alvo) * .025)) * [1, 1.25, 1.45][this.lv(d, 'interceptacao')] * [1, 1.1, 1.2][this.lv(d, 'antecipacao')]
        * (it.alto ? [1, 1.15, 1.3][this.lv(d, 'cabeceio')] * [1, 1.08, 1.15][this.lv(d, 'imposicao-fisica')] : 1), .1, .92);
      out.push({ d, acao: 'cortar', p, ps: tag(['interceptacao', 'antecipacao', ...(it.alto ? ['cabeceio', 'imposicao-fisica'] as PsId[] : [])]), falta: 0, dica: `Fica na linha do passe para ${alvo.e?.name ?? 'o companheiro'}.` });
    }
    if ((segD(d, c, { x: 34, y: 0 }) < 8 && c.y < 34) || chave === 'chute') {
      const p = clamp((.5 + (def - 70) * .01 - Math.min(.3, segD(d, c, { x: 34, y: 0 }) * .04)) * [1, 1.3, 1.55][this.lv(d, 'bloqueio')], .1, .92);
      out.push({ d, acao: 'fechar', p, ps: tag(['bloqueio']), falta: 0, dica: 'Se joga na frente do chute.' });
    }
    return out;
  }

  /** Executa a rodada: sua escolha contra a jogada do rival. */
  jogar(o: DefOpcao): DefPlano {
    const r = this.r, c = this.carrier, it = this.intencao, d = o.d, nm = d.e?.name ?? 'o zagueiro', an = c.e?.name ?? 'o atacante';
    this.actions--;
    const acertou = CONTRA[o.acao].includes(it.a);
    const from = this.ballAt;
    const defPos = o.acao === 'cortar' ? (() => { const to = it.para ?? it; const mx = (c.x + to.x) / 2, my = (c.y + to.y) / 2; return { x: d.x + (mx - d.x) * .8, y: d.y + (my - d.y) * .8 }; })()
      : o.acao === 'fechar' ? { x: c.x + (34 - c.x) * .18, y: c.y * .82 } : { x: c.x + (d.x - c.x) * .15, y: c.y - .6 };
    const anim = o.acao === 'bote' ? 'bote' : o.acao === 'carrinho' ? 'carrinho' : o.acao === 'cortar' ? 'corte' : 'bloqueio';
    d.tx = defPos.x; d.ty = defPos.y;
    // Falta no carrinho (sem o estilo é comum): o lance para com a falta e o cartão
    if (o.acao === 'carrinho' && r() < o.falta) {
      this.done = true;
      const gol = c.y < 26 && r() < .1;
      return { def: { d, ...defPos, anim }, ball: [from, { x: c.x, y: c.y - .5, h: 0 }], dur: 600, intencao: it, ok: false, say: 'Falta!', color: '#f2b640', ps: o.ps, commit: () => {},
        end: { res: gol ? { goal: true, shot: true, onTarget: true, scorer: an, amarelo: d.e?.name } : { goal: false, shot: true, onTarget: false, amarelo: d.e?.name, text: `${nm} fez falta no carrinho e levou amarelo; a cobrança de ${an} passou por cima.` }, text: gol ? 'Falta… e gol deles' : 'Falta e amarelo!', color: '#f2b640', goal: gol } };
    }
    if (acertou && r() < o.p) {
      this.done = true;
      const say = o.acao === 'cortar' ? (it.alto ? 'Cortou de cabeça!' : 'Interceptou!') : o.acao === 'fechar' ? 'Bloqueou!' : o.acao === 'carrinho' ? 'Carrinho perfeito!' : 'Desarmou!';
      const bx = o.acao === 'cortar' ? defPos.x : c.x, by = o.acao === 'cortar' ? defPos.y : c.y - .4;
      const ball = o.acao === 'fechar' ? [from, { x: defPos.x, y: defPos.y + .4, h: .6 }, { x: defPos.x + rn(-8, 8, r), y: defPos.y + 9, h: .3 }] : [from, { x: bx, y: by, h: it.alto && o.acao === 'cortar' ? 2 : 0 }, { x: bx + rn(-6, 6, r), y: by + 8, h: 0 }];
      return { def: { d, ...defPos, anim }, ball, dur: 800, intencao: it, ok: true, say, color: '#56d086', ps: o.ps, commit: () => {},
        end: { res: { goal: false, shot: it.a === 'chute', onTarget: false, text: `${nm} ${o.acao === 'fechar' ? 'bloqueou o chute' : o.acao === 'cortar' ? 'cortou o passe' : 'roubou a bola'} de ${an}.`, defensor: d.e?.name }, text: say, color: '#56d086', goal: false } };
    }
    // Errou a leitura (ou perdeu a dividida): o defensor fica para trás, a não ser no bote com Contenção
    if (!(o.acao === 'bote' && this.lv(d, 'contencao'))) d.batido = true;
    return this.rival(o, defPos, anim, acertou);
  }

  /** A jogada do rival acontece. */
  private rival(o: DefOpcao, defPos: { x: number; y: number }, anim: DefPlano['def']['anim'], quase: boolean): DefPlano {
    const r = this.r, c = this.carrier, it = this.intencao, an = c.e?.name ?? 'o atacante', from = this.ballAt;
    const livres = this.campo().filter(d => !d.batido);
    const say0 = quase ? 'Quase!' : 'Passou!';
    if (it.a === 'chute') {
      this.done = true;
      const D = Math.hypot(c.x - 34, c.y), fin = sb(c.e, 'Finalização', 1), gk = this.gkE?.P.st?.[3] ?? 70;
      const tampa = livres.some(d => segD(d, c, { x: 34, y: 0 }) < 1.5) ? .6 : 1;
      const pg = clamp((.36 - D * .011 + (fin - 75) * .006 - (gk - 75) * .006) * tampa * [1, .9, .8][psLevel(this.gkE?.P, 'reflexos')], .05, .45);
      const gol = r() < pg, fora = !gol && r() < .45;
      const ex = gol ? it.x : fora ? it.x + (it.x > 34 ? 4.5 : -4.5) : it.x;
      return { def: { d: o.d, ...defPos, anim }, ball: [from, { x: ex, y: gol ? -1.5 : fora ? -2.5 : 1.2, h: gol ? 1.1 : fora ? .8 : 1.2 }], dur: 700, intencao: it, ok: false, say: say0, color: '#f06a5a', ps: [], commit: () => {},
        end: gol ? { res: { goal: true, shot: true, onTarget: true, scorer: an }, text: 'Gol deles…', color: '#f06a5a', goal: true }
          : { res: { goal: false, shot: true, onTarget: !fora, text: fora ? `${an} chutou para fora.` : `${this.gkE?.name ?? 'o goleiro'} defendeu o chute de ${an}.` }, text: fora ? 'Pra fora!' : 'O goleiro pegou!', color: '#9ec9ec', goal: false } };
    }
    if (it.a === 'passe' && it.para) {
      const to = it.para, perto = Math.min(99, ...livres.map(d => segD(d, c, to)));
      const p = clamp((it.alto ? .72 : .86) - (perto < 1.5 ? .25 : 0), .2, .95);
      if (r() < p) {
        const passer = c;
        return { def: { d: o.d, ...defPos, anim }, ball: [from, { x: to.x, y: to.y - .6, h: it.alto ? 2.5 : 0 }, { x: to.x, y: to.y - .6, h: 0 }], dur: it.alto ? 1000 : 600, intencao: it, ok: false, say: say0, color: '#f06a5a', ps: [],
          commit: () => { this.carrier = to; this.avanca(passer); } };
      }
      this.done = true;
      return { def: { d: o.d, ...defPos, anim }, ball: [from, { x: (c.x + to.x) / 2, y: (c.y + to.y) / 2, h: 0 }, { x: (c.x + to.x) / 2 + 4, y: (c.y + to.y) / 2 + 6, h: 0 }], dur: 700, intencao: it, ok: false, say: 'Passe errado!', color: '#56d086', ps: [], commit: () => {},
        end: { res: { goal: false, shot: false, text: `${an} errou o passe.` }, text: 'Passe errado!', color: '#56d086', goal: false } };
    }
    // Drible/condução
    const colados = livres.filter(d => dist(d, c) < 2.8).length, p = clamp(.78 - colados * .18, .2, .95);
    if (r() < p) {
      return { def: { d: o.d, ...defPos, anim }, ball: [from, { x: it.x, y: it.y - .6, h: 0 }], dur: 700, intencao: it, ok: false, say: say0, color: '#f06a5a', ps: [],
        commit: () => { c.x = c.tx = it.x; c.y = c.ty = it.y; this.avanca(); } };
    }
    this.done = true;
    return { def: { d: o.d, ...defPos, anim }, ball: [from, { x: c.x + 1, y: c.y - 1.5, h: 0 }, { x: c.x + 3, y: c.y + 4, h: 0 }], dur: 600, intencao: it, ok: false, say: 'Perdeu a bola!', color: '#56d086', ps: [], commit: () => {},
      end: { res: { goal: false, shot: false, text: `${an} se enrolou com a bola.` }, text: 'Bola sua!', color: '#56d086', goal: false } };
  }
  /** Depois da jogada do rival: todo mundo anda, seus defensores recompõem e a IA decide a próxima. */
  private avanca(passer?: DActor): void {
    const r = this.r, c = this.carrier;
    for (const a of this.atk) if (a !== c) { a.tx = clamp(a.x + rn(-3, 3, r), 5, 63); a.ty = clamp(a.y - rn(2, 5, r), 7, 40); if (a === passer) a.ty = clamp(a.y - rn(4, 8, r), 8, 40); }
    for (const d of this.campo()) {
      d.batido = false;
      // A linha recua e fecha o meio; o mais perto sai no portador
      const alvo = this.atk.filter(a => a !== c).sort((p, q) => dist(p, d) - dist(q, d))[0];
      d.tx = alvo && dist(alvo, d) < 8 ? alvo.tx + (34 - alvo.tx) * .1 : d.x + (c.x - d.x) * .2; d.ty = clamp(Math.min(d.y, (alvo?.ty ?? d.y) - 1.2), 4, 40);
    }
    const perto = this.campo().sort((p, q) => dist(p, c) - dist(q, c))[0];
    if (perto) { perto.tx = c.x + (34 - c.x) * .08; perto.ty = Math.max(3, c.y - 3); }
    for (const a of [...this.atk, ...this.def]) { a.x = a.tx; a.y = a.ty; }
    this.decidir();
  }
}
