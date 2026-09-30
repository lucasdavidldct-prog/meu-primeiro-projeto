// Serializa os JSON de dados com um jogador por linha, para ficarem fáceis de ler e de comparar no git.
import type { LendasData, LigaData } from './schema';

const one = (o: unknown) => JSON.stringify(o);

export function formatLiga(l: LigaData): string {
  const { clubes, ...head } = l;
  const headStr = JSON.stringify(head, null, 2).slice(0, -2);
  const cl = clubes.map(c => {
    const { elenco, ...ch } = c;
    const inner = Object.entries(ch).map(([k, v]) => `      ${JSON.stringify(k)}: ${one(v)}`).join(',\n');
    return `    {\n${inner},\n      "elenco": [\n${elenco.map(j => '        ' + one(j)).join(',\n')}\n      ]\n    }`;
  });
  return `${headStr},\n  "clubes": [\n${cl.join(',\n')}\n  ]\n}\n`;
}

export function formatLendas(d: LendasData): string {
  return `{\n  "atualizadoEm": ${one(d.atualizadoEm)},\n  "lendas": [\n${d.lendas.map(j => '    ' + one(j)).join(',\n')}\n  ]\n}\n`;
}
