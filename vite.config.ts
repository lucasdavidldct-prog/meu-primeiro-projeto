import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vitest/config';

const ROOT = import.meta.dirname;
const ESCUDOS = join(ROOT, 'public', 'escudos');

/** virtual:escudos lista as siglas com imagem própria em public/escudos/<SIGLA>.png. */
function escudos(): Plugin {
  const ID = 'virtual:escudos', RID = '\0' + ID;
  const list = () => (existsSync(ESCUDOS) ? readdirSync(ESCUDOS) : [])
    .filter(f => /^[A-Za-z0-9]{2,4}\.png$/.test(f)).map(f => f.slice(0, -4).toUpperCase());
  return {
    name: 'escudos',
    resolveId: id => (id === ID ? RID : undefined),
    load: id => (id === RID ? `export default ${JSON.stringify(list())};` : undefined),
    configureServer(server) {
      server.watcher.add(ESCUDOS);
      const reload = (f: string) => {
        if (!f.startsWith(ESCUDOS)) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

const readBody = (req: IncomingMessage) => new Promise<string>((res, rej) => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 20e6) rej(new Error('grande demais')); });
  req.on('end', () => res(b));
  req.on('error', rej);
});

/** Só no npm run dev: o editor de elencos grava direto em data/ligas/<id>.json. */
function gravarDados(): Plugin {
  return {
    name: 'gravar-dados',
    configureServer(server) {
      server.middlewares.use('/__dados', async (req, res) => {
        const send = (code: number, o: unknown) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
        if (req.method === 'GET' && req.url === '/ping') return send(200, { ok: true });
        const m = req.url?.match(/^\/ligas\/([a-z-]+)$/);
        if (req.method !== 'POST' || !m) return send(404, { erro: 'rota desconhecida' });
        const id = m[1];
        try {
          // Carrega pelo próprio Vite para reaproveitar o código do jogo (TypeScript).
          const { ALL_LIGA_IDS } = await server.ssrLoadModule('/src/engine/data/schema.ts') as typeof import('./src/engine/data/schema');
          const { formatLiga } = await server.ssrLoadModule('/src/engine/data/format.ts') as typeof import('./src/engine/data/format');
          if (!ALL_LIGA_IDS.includes(id)) return send(400, { erro: `liga desconhecida: ${id}` });
          const liga = JSON.parse(await readBody(req)) as import('./src/engine/data/schema').LigaData;
          if (liga.id !== id || !Array.isArray(liga.clubes)) return send(400, { erro: 'conteúdo inválido' });
          writeFileSync(join(ROOT, 'data', 'ligas', id + '.json'), formatLiga(liga));
          send(200, { ok: true });
        } catch (e) { send(500, { erro: (e as Error).message }); }
      });
    },
  };
}

export default defineConfig({
  plugins: [escudos(), gravarDados()],
  server: { host: true, port: 5173 },
  // Os dados reais das 7 ligas vão no bundle.
  build: { chunkSizeWarningLimit: 2500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
