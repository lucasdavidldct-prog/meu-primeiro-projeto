import { describe, expect, it } from 'vitest';
import { FUTEBOLISTA, escolherFoto, nomesDeBusca, urlFoto, type Candidato } from '../src/engine/data/fotos';
import FOTOS from '../data/fotos.json';
import { W } from '../src/engine/world';

const jog = (q: string, nasc?: number, img = 'X.jpg', occ = [FUTEBOLISTA]): Candidato => ({ q, ocupacoes: occ, nascimento: nasc, imagem: img });

describe('fotos dos jogadores', () => {
  it('escolhe o jogador de futebol com foto e ano de nascimento certo', () => {
    const cands = [jog('Q1', 1990, 'Politico.jpg', ['Q82955']), jog('Q2', 1970), jog('Q3', 1994, ''), jog('Q4', 1995, 'Certo.jpg')];
    expect(escolherFoto(cands, { idade: 31 }, 2026)).toEqual({ f: 'Certo.jpg', q: 'Q4' });
  });
  it('não aceita homônimo de outra idade nem sem data de nascimento', () => {
    expect(escolherFoto([jog('Q1', 1980), jog('Q2')], { idade: 22 }, 2026)).toBeNull();
  });
  it('lendas: aceita nascidos antes de 1995 mesmo com a idade da época', () => {
    expect(escolherFoto([jog('Q9', 2004), jog('Q7', 1957, 'Reinaldo.jpg')], { idade: 24, lenda: true }, 2026)?.q).toBe('Q7');
  });
  it('tenta nome completo, depois primeiro + último nome e o apelido', () => {
    expect(nomesDeBusca('Everson Felipe Marques Pires', 'Everson')).toEqual(['Everson Felipe Marques Pires', 'Everson Pires', 'Everson']);
    expect(nomesDeBusca('Gabriel Delfim', 'Gabriel Delfim')).toEqual(['Gabriel Delfim']);
  });
  it('monta a URL da miniatura na Commons', () => {
    expect(urlFoto('Hulk no Atlético 2023.jpg', 200)).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Hulk_no_Atl%C3%A9tico_2023.jpg?width=200');
  });
  it('data/fotos.json só tem jogadores que existem', () => {
    const ids = Object.keys(FOTOS as object);
    expect(ids.filter(id => !W.players.has(id) && !id.startsWith('lenda-'))).toEqual([]);
  });
});
