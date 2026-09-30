# Esquadrão FC

Jogo de futebol de cartas com escalação, química, táticas, partida simulada e lances jogáveis.
Evolução do `legacy/esquadrao.html` para um projeto Vite + TypeScript + Three.js, para uso pessoal.

## Como rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173 (no celular, use o endereço "Network" na mesma rede Wi-Fi)
```

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm test` | testes do motor de partida, da química e dos dados (Vitest) |
| `npm run validar-dados` | confere se os JSON de `data/` estão consistentes (`-- --avisos` mostra todos os avisos) |
| `npm run typecheck` | checagem de tipos |
| `npm run build` | build de produção em `dist/` |

## Estrutura

```
data/ligas/      um JSON por liga: clubes (nome, sigla, cidade, cores) e elencos reais
data/lendas.json ícones históricos, com destaque para os ídolos do Galo
data/nacoes.json nações e cores das bandeiras
legacy/          esquadrao.html original, para referência
public/escudos/  seus escudos em PNG: <SIGLA>.png substitui o escudo gerado
src/engine/      regras e simulação, sem interface (química, pacotes, temporada, partida)
src/save/        save em IndexedDB, exportar e importar JSON
src/ui/          telas, cartas, walkout, partida e lance 2D
src/three/       cenas 3D dos lances (etapa 5)
tests/           testes
```

## Dados reais e Editor de elencos

Os ratings são estimativas próprias, baseadas no nível real de cada jogador (não copiam nenhum jogo comercial).
Elencos conferidos até setembro de 2026. O Atlético Mineiro foi pesquisado jogador a jogador; nos demais clubes
as principais transferências da janela de 2026 foram aplicadas, mas pode haver defasagem, e clubes menores
(especialmente da Saudi Pro League e da MLS) têm elencos parciais — o jogo completa com "Reservas" genéricos.

Para corrigir: **Clube → Editor de elencos**. Com `npm run dev` rodando, cada correção é gravada direto em
`data/ligas/<liga>.json`. Sem o servidor (celular, build), as correções ficam no navegador e podem ser
baixadas em JSON para substituir o arquivo.

Escudos: o jogo gera escudos com as cores e a sigla. Para usar uma imagem sua, salve `public/escudos/<SIGLA>.png`
(ex.: `CAM.png`).

## Playstyles

Cada jogador tem de 0 a 4 playstyles; craques (overall 80+) podem ter a versão **+**. Eles aparecem como ícones
na carta e com nome e descrição no detalhe do jogador, e mudam o jogo:

- **Simulação:** chute de longe, finalização, cabeceio (e zagueiros que cortam pelo alto), cobrança de falta,
  cruzamento e passe em profundidade (quem dá a assistência), desarme e interceptação (tiram chances do rival),
  bloqueio, incansável (menos cansaço), velocista (contra-ataque), goleiros com reflexos, saída do gol e
  pegador de pênalti.
- **Lances jogáveis:** precisão do passe, alcance e chance de vencer o marcador no drible, erro e distância do
  chute, curva e dispersão na falta, defesa do goleiro.
- **Lance de falta:** só aparece quando o seu time tem um cobrador com Cobrança de Falta. Arraste em direção ao
  gol: a direção mira, o comprimento dá a força e a curva do traço dá o efeito.

Os números de cada efeito ficam em `src/engine/playstyles.ts` (tabela `FX`).

## Save

O progresso fica no IndexedDB do navegador. Em **Clube → Save** dá para exportar o save em JSON e importar de volta,
inclusive em outro aparelho.

## Etapas

1. ✅ Estrutura do projeto e migração do jogo atual
2. ✅ Base de dados real e editor de elencos
3. ✅ Playstyles
4. Carreira e competições
5. Lances 3D
6. Polimento
