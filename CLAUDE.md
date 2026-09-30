# Esquadrão FC

Jogo de futebol de cartas com modo carreira (pt-BR), feito em Vite + TypeScript + Three.js, empacotado para Android com Capacitor.
O APK sai pelo GitHub Actions a cada push e é publicado na release `esquadrao-apk`.

## Comandos

- `npm run dev`: servidor de desenvolvimento
- `npm run checar`: typecheck, testes e validação dos dados. **Rode antes de todo commit.**
- `npm test`: Vitest (`tests/`)
- `npm run calibrar [-- --n=500 --seed=2026]`: simulação em massa. Rode antes e depois de mexer no motor.
- `npm run validar-dados`: consistência de `data/`
- `npm run formatar-dados`: reescreve `data/` no formato de um jogador por linha
- `npm run playtest [-- --url=...]`: navegador real (desktop e celular), passa por todas as abas, tira prints em `playtest-out/` e falha se houver erro no console
- `npm run build`: build web. O APK só é gerado no CI.

## Arquitetura

- `src/engine/`: lógica pura, sem DOM.
  - `match.ts`: simulação minuto a minuto.
  - `lance.ts` e `lanceScene.ts`: lances jogáveis.
  - `chemistry.ts`: setores, química e `power()`.
  - `playstyles.ts`: efeitos `FX` como [nenhum, prata, dourado].
  - `career.ts`: carreira. `market.ts`: leilão. `evolution.ts`: evolução dos jogadores. `keeper.ts`: lance de goleiro.
- `src/engine/data/`: esquema (`schema.ts`), validação e formato dos JSON.
- `src/ui/`: telas (HTML em string, ações via `data-act`). `src/three/` é o 3D, carregado sob demanda.
- `data/`:
  - `ligas/*.json` e `lendas.json` (categorias `idolo` | `heroi` | `hall`), mais `nacoes.json`.
  - `eventos.json`: cartas de evento semanais (o usuário manda a lista toda semana; veja a skill `editar-jogadores`).
  - `fotos.json` é mantido pelo CI (`npm run fotos`); não edite à mão.
- Save em IndexedDB (`src/save/db.ts`). Jogadores removidos saem do save via `sanitizeState`; lendas removidas devolvem moedas.

## Regras do projeto

- **Converse sempre em português do Brasil**, inclusive nas mensagens curtas de progresso entre os comandos ("Rodando os testes…", "Agora vou…"), nos resumos finais e nas descrições das ferramentas. O usuário acompanha pelo celular e não quer nada em inglês.
- Textos da interface em **pt-BR**.
- Notas e atributos dos jogadores são **estimativas próprias**.
- **Visual próprio**: não copie arte, ícones ou layout de cartas de jogos comerciais (EA FC etc.). Pode se inspirar na ideia, mas o desenho é nosso.
- **Galo (CAM) é prioridade.** Ídolos do Atlético Mineiro nunca saem da lista de lendas.
- **Motor determinístico nos testes**: use `R()` (de `rng.ts`), nunca `Math.random` direto no motor; testes usam `seedRng`.
- **Calibragem**: ~2,45 gols por jogo entre iguais, mandante vence ~53%. Mudou o motor? Compare `calibrar` antes e depois com a mesma seed.
- **Desempenho**: `rate()` roda a cada minuto de cada jogo. A parte fixa por jogador fica em cache em `chemistry.ts` (`offsets`).
  Quem mudar dados de jogador em memória deve trocar os objetos `st`/`ps` (e não mutar no lugar) e chamar `clearCardCache()` / `clearStrengthCache()`.
- **Dados**: depois de editar `data/`, rode `npm run formatar-dados` e `npm run validar-dados`. Nação nova precisa entrar em `nacoes.json`.
- **Estilos de jogo**: no máximo 6 por jogador; `id+` é a versão dourada. Todo estilo precisa de uma entrada em `LAB` (`src/engine/lab.ts`) com dica e efeitos; o teste `tests/lab.test.ts` cobra isso.

## Git e CI

- Branch de trabalho: `ccr-cb341374-5fzvcp`. Só abra PR se pedirem.
- O CI grava um commit do bot com fotos novas (`data/fotos.json`). Antes de dar push, faça `git fetch` e um merge (não rebase) se a branch remota andou.
- Nova versão: suba `version` no `package.json` (o `versionName` do Android vem dele) e adicione uma seção no README. Veja a skill `lancar-versao`.
