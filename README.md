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
| `npm run calibrar` | 500 partidas simuladas: média de gols (~2,6), pênaltis, mando e resultados por diferença de força |
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

## Modo carreira

Ao começar, escolha um clube real da Série A ou da Série B (o padrão é o Atlético Mineiro). O elenco real
vira as suas cartas; os pacotes trazem jogadores de qualquer liga.

- **Brasileirão** com 20 clubes em turno e returno (ou temporada curta, só turno). 5 primeiros vão para a
  Libertadores, 4 últimos caem. A Série B é simulada de forma simples (4 sobem, 4 caem; clubes reais com
  força estimada e elencos completados por reservas).
- **Libertadores** com 16 clubes: 5 brasileiros + sul-americanos reais (`data/ligas/conmebol.json`),
  4 grupos, quartas e semis em ida e volta, final em jogo único, pênaltis no empate.
- **Outras ligas** (Premier League, LaLiga, Serie A, Bundesliga, Saudi Pro League, MLS) simuladas em
  segundo plano, com tabela visível.
- Moedas por jogo e por colocação/título, **sala de troféus** e histórico de temporadas.
- A IA escolhe formação e estilo pelo elenco e pelo adversário, e muda no intervalo e no fim do jogo conforme o placar.

## Lances 3D

Quando o motor cria uma chance para o seu time, a partida pausa e abre uma cena 3D (Three.js) com a câmera
atrás do ataque: estádio à noite, gramado listrado com as marcações oficiais, gol com rede, jogadores low-poly
com a camisa do clube e número, bola com sombra.

- **Toque num companheiro** = passe · **toque no campo** = conduzir · **arraste em direção ao gol** = chute
  (a direção mira, o comprimento dá a força e a curva do traço dá o efeito). A linha prevista mostra a chance em %.
- A defesa reage a cada ação e o goleiro se posiciona e mergulha.
- Tipos: ataque posicional, contra-ataque, pênalti e falta (com barreira e chute com curva).
- Gol tem replay curto em câmera lenta, com câmera lateral.
- Aparelho fraco? Em **Clube → Visual dos lances** escolha **2D (leve)**. Sem WebGL, o 2D é usado automaticamente.
- A lógica dos lances fica em `src/engine/lanceScene.ts` (a mesma para 2D e 3D); o desenho 3D em `src/three/`.

## Save

O progresso fica no IndexedDB do navegador (ou do app, no APK). Em **Clube → Save** dá para exportar o save em JSON e importar de volta,
inclusive em outro aparelho. No APK, "Exportar save" abre o menu de compartilhar do Android (Drive, Arquivos, WhatsApp…).

## APK Android

O app Android é o mesmo jogo empacotado com [Capacitor](https://capacitorjs.com) (pasta `android/`).

**Sem instalar nada (recomendado):** a cada push, o GitHub Actions (`.github/workflows/apk.yml`) roda os testes,
gera o APK e publica em **Releases → "Esquadrão FC — APK mais recente"** (tag `esquadrao-apk`). Abra essa página no celular,
baixe `esquadrao-fc.apk` e instale (o Android pede para permitir "instalar apps desconhecidos" do navegador).
O APK também fica como artefato da execução em **Actions**.

**No seu computador:** instale o Android Studio (traz o Android SDK) e o Java 21, depois:

```bash
npm run apk       # gera apk/esquadrao-fc.apk
npm run android   # ou abre o projeto no Android Studio para rodar num aparelho/emulador
```

- O APK é assinado com uma chave fixa de uso pessoal (`android/app/esquadrao.keystore`): versões novas instalam
  por cima da antiga e **o save continua**. Não use essa chave para publicar na Play Store.
- No app: botão voltar do Android fecha janelas/pausa a partida, vibração nos gols e aberturas de pacote,
  tela sempre em pé (retrato).
- Ícone e tela de abertura vêm de `assets/` (regerar com `npx capacitor-assets generate --android`).

## Menu da carta, funções e orientações

- Toque numa carta do time: **Substituir**, **Detalhes**, **Função no campo** (ex.: VOL ↔ MC ↔ ZAG) e **Orientação**.
- Orientações por setor (`src/engine/orders.ts`): goleiro tradicional/líbero; zagueiro marcador/construtor/de cobertura;
  lateral de apoio/ala/invertido/defensivo; volante cabeça de área/construtor/box-to-box; meio-campista box-to-box/
  armador/marcador/infiltrador; meia armador/meia-atacante/flutuante; ponta aberto/invertido/de profundidade;
  atacante centroavante/pivô/falso 9/veloz. Mais a participação: volta para defender · equilibrado · fica no ataque.
- Isso muda o peso de cada jogador no ataque, meio e defesa, quem finaliza, cruza e dá assistência, o cansaço e o espaço
  que o time deixa atrás (contra-ataques do rival). A IA escolhe as funções pelos atributos; as suas cartas começam com a
  mesma sugestão.
- **Atributos** (RIT, FIN, PAS, DRI, DEF, FIS; goleiro REF/MER/POS) pesam na força de cada setor e na finalização.
  **Playstyles** somam força ao setor e as versões **+** valem bem mais.
- 18 formações: 4-3-3, 4-4-2, 4-2-3-1, 4-1-2-1-2, 3-5-2, 3-4-3, 5-3-2, 4-1-4-1, 4-5-1, 4-2-2-2, 4-3-1-2, 4-3-2-1,
  4-4-1-1, 4-2-4, 3-4-2-1, 3-4-1-2, 5-4-1, 5-2-3.

## Partida, mando e dificuldade

- Calibragem (`npm run calibrar`): ~2,5 gols por jogo entre times do mesmo nível; mandante vence ~53% e perde ~24%;
  goleada só com diferença grande (+15 de força: 85% de vitórias, 3 gols por jogo).
- Narração mais viva: construção das jogadas com os nomes e funções (pivô ajeita, falso 9 recua, ala cruza…),
  escanteios, impedimentos, pressão; a IA lê o jogo aos 30 minutos e muda o plano.
- **Dificuldade** em Clube (Fácil, Normal, Difícil, Lenda): força do rival, goleiro nos lances e quantos lances você joga.
  Fora de casa você tem um lance a menos e o goleiro rival fica mais difícil.

## Versão 1.8.0

- **Uniformes**: cada clube tem titular e reserva com desenho (listras, aros, faixa, diagonal); o **Galo tem 3** (listrado, branco e o terceiro preto e dourado). O visitante troca quando as camisas se confundem, e os goleiros ganham cor própria. Dá para fixar o uniforme no Clube.
- **Jogadores 3D com cara de gente**: altura e porte pelo jogador (zagueiro e goleiro mais altos, físico mais largo), tons de pele, cabelos variados e visual marcante de alguns craques; nome e número nas costas.
- **Bola nova** de gomos e **rede que balança** quando entra o gol.
- **Câmeras** Padrão, TV, Aérea e Atrás do jogador, com botões para **girar 360°** durante o lance.
- **Clima**: dia, sol, noite, chuva e neve (no Brasil não neva). Chuva e neve deixam passe e chute um pouco mais difíceis. **Gramados** em faixas, xadrez, círculos, diagonal ou liso.
- **Estádio à vista**: o lance começa mostrando a torcida; arquibancada e torcida nas cores do mandante. **Galo em casa joga na Arena MRV** (estilizada, desenho nosso).
- **Cartas**: design novo com visual próprio, **cartas de evento semanais** (esta semana: Destinado à Glória · Time 2) e **Hall da Fama atualizado**.
- **Fora de Série**: no máximo 3 por posição (Ronaldinho, Ronaldo, Reinaldo…), muito difíceis de parar, raríssimos nos pacotes e caros no mercado.
- **Regras**: impedimento de verdade, escanteio e lateral jogáveis e **finta** (drible de habilidade).
- **Cartões e lesões**: vermelho bem mais raro e com peso (um a menos custa caro); suspensão por vermelho e por 3 amarelos; lesões que tiram o jogador de algumas partidas.
- **Clássicos**: jogo de rivalidade mais difícil e mais pegado, com prêmio maior. Perdeu? **Revanche**.
- **Elencos salvos** (até 5, com formação e tática) e **número da camisa** editável.
- **Estatísticas** do time (gols, assistências, finalizações, desarmes, erros, defesas) e da liga (artilharia e assistências), **melhores por posição** e **guia tático** que simula o seu elenco.
- Fotos: lendas que estavam sem foto são procuradas de novo automaticamente.

## Versão 1.7

- **Atributos detalhados** em cada jogador (Aceleração, Pique, Chute de longe, Voleio, Pênalti, Precisão na falta, Curva…),
  derivados dos 6 atributos, da posição e dos estilos; **estrelas de drible e de perna ruim**. Eles pesam nos lances.
- **Carta mostra só os estilos +**; os pratas ficam nos detalhes. Detalhes em abas: Atributos, Estilos, Personalizar e Info.
- **Personalizar a carta**: escolha um estilo +, um prata e o **estilo de química** (Artilheiro, Maestro, Âncora…),
  que soma atributos conforme a química do jogador no time (cheio com 3/3).
- **Seletor do tipo de chute** nos lances: Auto, Normal, Colocado, Forte, Rasteiro e Cavadinha. Novo estilo **Chute Rasteiro**.
- **Troca rápida**: durante a partida, o jogo avisa quem está cansado e sugere o reserva; um toque troca.
- **Gráficos 3D novos** com qualidade Alta/Média/Leve (Clube): sombras, brilho dos refletores, gramado texturizado,
  arquibancadas com cobertura, torcida que pula no gol, placas de LED e jogadores mais detalhados. Menus com acabamento novo.

## Versão 1.6

- **Laboratório de estilos** (Clube → Modo teste): escolha um estilo de jogo e um jogador (neutro 80 ou do seu elenco),
  alterne entre **Sem**, **Prata** e **+** e jogue o lance certo para sentir a diferença (placar dos seus lances por nível).
  Mostra a tabela de efeitos de cada nível e compara 3 × 300 partidas simuladas com a mesma sorte.
- Estilos de **defesa** agora pesam também no lance jogável: marcadores com Carrinho/Contenção tomam mais a bola,
  Interceptação/Antecipação cortam mais passes, Bloqueio trava mais chutes e Trombador ganha mais pelo alto.

## Versão 1.5.2

- Motor de partida ~2,7× mais rápido (mesmos resultados): simular rodadas e temporadas fica mais leve no celular.
- APK menor: só as fontes com os caracteres usados (latin e latin-ext).
- Ferramentas de desenvolvimento: `npm run checar`, `npm run playtest` (navegador real, prints e erros de console)
  e `npm run formatar-dados`; instruções do projeto em `CLAUDE.md`, skills e agentes em `.claude/`.

## Versão 1.5.1

- **Lendas em 3 categorias**, cada uma com carta própria: **Ídolo** (clara), **Herói** (laranja) e **Hall da Fama** (roxa).
  Ídolos: a lista masculina de ícones por país (Brasil, Argentina, França, Alemanha, Holanda, Itália, Espanha, Inglaterra…)
  mais todos os ídolos do Galo. Heróis: a lista por liga (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 e outras); Yaya Touré, Nakata e Lúcio têm carta de Ídolo e de Herói. Hall da Fama conforme a lista enviada.
- Pacote Lenda: Ídolo 30%, Herói 35%, Hall da Fama 35%. Preço no mercado: Ídolo > Herói > Hall da Fama.
- Lendas que saíram da lista somem da coleção e devolvem 60.000 moedas cada.
- A versão especial "Herói" das cartas atuais passou a se chamar "Craque do Mês" (para não confundir com as lendas).
- Ícones próprios em SVG para os 32 estilos de jogo.

## Versão 1.5

- **Opções ao iniciar a carreira**: ligar/desligar a *evolução dos jogadores* e o *mercado de leilão*.
- **Evolução dos jogadores**: no fim de cada temporada as cartas mudam conforme a idade (jovens sobem, veteranos caem;
  quem já é elite cresce menos). A tela de fim de temporada mostra a evolução do seu elenco.
- **Mercado de leilão** (na Loja, aba Mercado): busque qualquer jogador pelo nome, dispute lances com a CPU
  (lance nos últimos 15 s prorroga) ou use o "Compre já". Venda as suas cartas negociáveis com taxa de 5%.
  Só cartas do elenco inicial e compradas no mercado são negociáveis; cartas de pacote são intransferíveis
  (evita lucrar revendendo pacotes).
- **Lance de goleiro**: quando o rival vai marcar (ou num pênalti contra), você controla o goleiro. Deslize para o canto
  (para cima = bola alta) observando a corrida do batedor; craques disfarçam melhor. Pode desligar em Clube.
- **32 estilos de jogo** em 6 categorias (Finalização, Passe, Controle, Defesa, Físico, Goleiro), com ícones nas cartas:
  prata = normal, dourado = + (efeito bem maior). Cada um muda o jogo: Chute Colocado facilita o chute com curva,
  Super Chute o chute forte de longe, Cavadinha, Cabeçada Forte, Passe Tenso, Tiki-Taka, Lançamento, Firula,
  Resistente à Pressão, Explosão, Trivela, Antecipação, Contenção… tanto nos lances jogados quanto na simulação.

## Versão 1.4.1

- **Escalar melhor time** agora maximiza a Força (posição, química e funções), testando trocas vaga a vaga:
  não deixa mais cartas melhores no banco por causa da posição exata.
- Histórico de temporadas mostra o artilheiro do seu time em cada ano.

## Versão 1.4

- **Jogadas pelas pontas**: o lance nasce de quem criou a jogada. Alas, pontas abertos e laterais que apoiam puxam o
  lance para a lateral ("Jogada pela esquerda/direita!"), com marcador em cima e dois companheiros atacando a área.
  Com o 4-3-3 padrão ~60% dos lances saem pelos lados; com alas e pontas abertos, mais ainda.
- **Cruzamento e finalização de primeira**: passe alto (2 toques) para quem está na área deixa o chute de primeira
  (defesa fora de posição, goleiro reage tarde; mais difícil de acertar). Playstyle Cruzamento acerta mais.
- A chance ao lado de cada nome mostra a melhor opção (↑ = passe alto é melhor).
- **Fim de temporada** com campanha (V-E-D, gols), artilheiro, garçom e craque da temporada (média das notas).
- Substituições com nomes curtos (não cortam mais na tela); artilharia e notas mais realistas
  (artilheiro ~20 gols por Brasileirão; goleiro não domina as notas).

## Versão 1.3

- **Treino de lances** (Clube → Treino de lances, ou no guia inicial): lance guiado em 3 passos (passe rasteiro,
  passe alto, conduzir e chutar com o traço), com defesa mais leve; também dá para treinar falta e pênalti. Não vale nada.
- **Força numa escala só**: seu time e os clubes usam a mesma conta (setores com atributos, playstyles, química e
  funções), recentralizada no overall dos jogadores. As barras ATA/MEI/DEF/GOL estão na mesma escala da Força.
- **Modo 2D** com os controles novos: 1 toque = passe rasteiro, 2 toques = passe alto, traço até o gol = chute
  (velocidade = força, curva = efeito), traço para o espaço = lançamento; tocar dentro do gol também chuta.
- **Um pouco mais de gols**: ~2,5 por jogo entre times do mesmo nível; goleada só com diferença grande.

## Ajustes da primeira jogada de teste (1.2)

- Uniforme reserva automático quando as cores se confundem (ex.: Galo x Botafogo), no 3D e no 2D (`src/engine/kits.ts`).
- Narração: todo evento do adversário leva a sigla dele; nota de 0 a 10 para cada jogador e **Craque do jogo**.
- Próximo jogo mostra a **Força** dos dois times na mesma escala.
- Campinho do Time com o goleiro visível (não fica atrás dos zagueiros).
- Lance 3D: chance do passe ao lado de cada nome, ajuda no topo (não cobre o jogador), falta e pênalti enquadrados
  na tela em pé, sem jogador repetido na falta.
- Mando mais forte (mandante ~50% V, 28% E, 22% D entre times iguais) e calibragem determinística.

## Lance 3D (controles estilo Score)

- Tela cheia, câmera alta atrás do ataque. Nomes dos companheiros fora da tela ficam na borda e também podem ser tocados.
- **1 toque** no companheiro = passe rasteiro · **2 toques** = passe alto · toque no campo = conduzir.
- **Desenhe um traço** em direção ao gol = chute: direção mira, curva do traço dá o efeito, velocidade do gesto dá a força.
- Traço para o espaço = lançamento em profundidade (o companheiro mais perto corre até a bola).

## Escalação e modo teste

- Em **Time**, toque numa carta para escolher outro jogador, ou **segure e arraste** a carta para outra posição
  (ex.: ponta direita ↔ ponta esquerda) ou para as reservas; os dois trocam de lugar.
- Pacotes e coleção mostram país e clube por extenso embaixo de cada carta.
- **Modo teste:** a carreira começa com +1.000.000 moedas (opção na tela de escolha do clube) e em **Clube → Modo teste**
  dá para somar mais 1.000.000 a qualquer momento.

## Fotos dos jogadores

- As cartas mostram a foto do jogador quando existe uma **foto livre na Wikimedia Commons** (achada pelo Wikidata:
  precisa ser jogador de futebol e ter o ano de nascimento compatível com a idade, para não pegar homônimo).
  A lista fica em `data/fotos.json` e é preenchida por `npm run fotos` (roda sozinho no GitHub Actions a cada push).
- As fotos carregam da internet; sem conexão a carta mostra a silhueta com a camisa do clube.
- **Sua foto:** abra a carta e toque em **Escolher foto** (galeria ou câmera). Ela fica salva no aparelho e tem
  prioridade sobre a da Commons. Dá para desligar as fotos da internet em **Clube**.

## Sons, vibração e dicas

- Efeitos sintetizados com Web Audio (sem arquivos): apito de início/intervalo/fim, torcida no gol, lamento no gol
  sofrido, chute, "uuuh" na defesa, revelação de cartas e moedas.
- Em **Clube**: ligar/desligar sons e vibração, e **Como jogar** (o guia também aparece ao começar a primeira carreira).

## Etapas

1. ✅ Estrutura do projeto e migração do jogo atual
2. ✅ Base de dados real e editor de elencos
3. ✅ Playstyles
4. ✅ Carreira e competições
5. ✅ Lances 3D
6. ✅ Polimento e APK Android
