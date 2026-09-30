// npm run formatar-dados — reescreve data/lendas.json e data/ligas/*.json no formato do projeto
// (um jogador por linha), para que edições à mão ou por script fiquem fáceis de comparar no git.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatLendas, formatLiga } from '../src/engine/data/format';

const DATA = join(import.meta.dirname, '..', 'data');
const fmt = (p: string, f: (o: never) => string) => {
  const antes = readFileSync(p, 'utf8'), depois = f(JSON.parse(antes) as never);
  if (antes !== depois) { writeFileSync(p, depois); console.log('formatado:', p); }
};
fmt(join(DATA, 'lendas.json'), formatLendas);
for (const f of readdirSync(join(DATA, 'ligas')).filter(f => f.endsWith('.json'))) fmt(join(DATA, 'ligas', f), formatLiga);
console.log('✓ Dados no formato do projeto.');
