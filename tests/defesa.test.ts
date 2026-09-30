import { afterEach, describe, expect, it } from 'vitest';
import { DefesaScene } from '../src/engine/defesa';
import { Match, sideOpp } from '../src/engine/match';
import { mulberry32, resetRng } from '../src/engine/rng';
import { oppFromId } from '../src/engine/season';

afterEach(() => resetRng());
const match = () => { const A = sideOpp(oppFromId('CAM')); A.you = true; return new Match(A, sideOpp(oppFromId('CRU'))); };
const cena = (s: number, ps?: string[]) => {
  const m = match();
  if (ps) m.A.xi.forEach(e => { if (['ZAG', 'LD', 'LE', 'VOL'].includes(e.pos)) e.P = { ...e.P, ps }; });
  const sh = m.B.xi.find(e => e.pos === 'ATA')!;
  return new DefesaScene(m, sh, m.B.xi.find(e => e.pos === 'MC' || e.pos === 'MEI'), mulberry32(s));
};

describe('lance de defesa (você comanda a zaga)', () => {
  it('monta a zaga, o goleiro e o ataque rival, e a IA já sabe o que vai fazer', () => {
    const sc = cena(1);
    expect(sc.campo().length).toBeGreaterThanOrEqual(3);
    expect(sc.def.filter(d => d.gk)).toHaveLength(1);
    expect(sc.atk.length).toBeGreaterThanOrEqual(3);
    expect(['passe', 'drible', 'chute']).toContain(sc.intencao.a);
  });

  it('acertar a leitura rouba a bola muito mais do que errar', () => {
    let certo = 0, errado = 0, nC = 0, nE = 0;
    for (let s = 1; s <= 300; s++) {
      const sc = cena(s), it = sc.intencao.a;
      const ops = sc.campo().flatMap(d => sc.opcoes(d));
      const contra = ops.filter(o => (it === 'drible' && o.acao === 'bote') || (it === 'passe' && o.acao === 'cortar') || (it === 'chute' && o.acao === 'fechar')).sort((a, b) => b.p - a.p)[0];
      const outra = ops.find(o => !((it === 'drible' && (o.acao === 'bote' || o.acao === 'carrinho')) || (it === 'passe' && (o.acao === 'cortar' || o.acao === 'carrinho')) || (it === 'chute' && o.acao === 'fechar')));
      if (contra) { nC++; if (sc.jogar(contra).ok) certo++; }
      const sc2 = cena(s), ops2 = sc2.campo().flatMap(d => sc2.opcoes(d)), o2 = outra && ops2.find(o => o.acao === outra.acao && o.d.e === outra.d.e);
      if (o2) { nE++; if (sc2.jogar(o2).ok) errado++; }
    }
    expect(certo / nC).toBeGreaterThan(.35);
    expect(errado / Math.max(1, nE)).toBeLessThan(.05);
  });

  it('estilos de defesa aumentam a chance de cada ação; Carrinho quase não faz falta; Antecipação lê a jogada', () => {
    const p = (ps?: string[]) => { const sc = cena(5, ps); return sc.campo().flatMap(d => sc.opcoes(d)); };
    const sem = p(), com = p(['desarme+', 'interceptacao+', 'bloqueio+', 'contencao+']);
    for (const o of sem) {
      const c = com.find(x => x.acao === o.acao && x.d.e?.name === o.d.e?.name);
      if (c) expect(c.p).toBeGreaterThanOrEqual(o.p);
    }
    const carr = com.find(o => o.acao === 'carrinho'), carr0 = sem.find(o => o.acao === 'carrinho');
    if (carr && carr0) expect(carr.falta).toBeLessThan(carr0.falta);
    let lidas = 0;
    for (let s = 1; s <= 30; s++) if (cena(s, ['antecipacao+']).lida) lidas++;
    expect(lidas).toBe(30);
    expect(cena(3).lida).toBe(false);
  });

  it('o lance sempre termina em até 3 rodadas', () => {
    for (let s = 1; s <= 80; s++) {
      const sc = cena(s);
      let fim = false;
      for (let k = 0; k < 3 && !fim; k++) {
        const ops = sc.campo().flatMap(d => sc.opcoes(d));
        expect(ops.length).toBeGreaterThan(0);
        const pl = sc.jogar(ops[s % ops.length]);
        pl.commit();
        fim = !!pl.end;
      }
      expect(fim).toBe(true);
    }
  });
});
