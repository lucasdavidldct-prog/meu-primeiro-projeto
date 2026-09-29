# Troco Certo

**Desafio do Dia**: um minijogo diário, igual para todo o Brasil, em que você devolve o troco com notas e moedas de Real o mais rápido possível. O ranking compara jogadores e estados.

## Rodar no seu computador

Precisa só do [Node.js](https://nodejs.org) 18 ou mais novo. Não há dependências para instalar.

```bash
npm start          # abre em http://localhost:3000
npm test           # roda os testes do servidor
```

## Como o jogo funciona

- 5 clientes por dia. O desafio vira à meia-noite de Brasília e é o mesmo para todo mundo (gerado a partir da data). Dá para jogar quantas vezes quiser: no ranking fica o melhor tempo do dia.
- Troco errado: +5s. Cada peça além do mínimo possível: +2s.
- O resultado sai em quadradinhos (🟩 perfeito, 🟨 com erro ou peça a mais) para compartilhar no WhatsApp.
- "Treinar" gera clientes aleatórios e não conta para o ranking.

## Desafio do dia em 3 dificuldades

🐣 Fácil, 🦊 Médio e 🦁 Difícil: cada um com os mesmos 5 clientes para todo o Brasil e o seu próprio ranking (o difícil é o desafio original). No fácil não aparece relógio (o tempo continua contando) e há dica após erro.

## Para voltar todo dia

- **Sequência 🔥:** cada dia jogando o desafio aumenta a sequência e dá moedinhas extras (até +14).
- **Conquistas 🏅:** 16 conquistas (100 clientes, 5 perfeitos seguidos, amigo dos vovós, uma semana seguida…), cada uma com moedinhas.
- **Clientes especiais:** apressado ⏱️, famoso ⭐, aniversariante 🎂 e desconfiado 🧐 aparecem em 1 de cada 3 clientes e dão bônus.
- **Comentários:** os clientes elogiam a decoração da lojinha.
- **⚡ Relâmpago:** quantos clientes você atende em 60 segundos (recorde no aparelho).

## Níveis

Fora do ranking, a criança joga quantas vezes quiser em 3 níveis. Terminar um nível libera o próximo, e o recorde de estrelas fica salvo no aparelho.

| Nível | Como é |
|---|---|
| 🐣 Iniciante | Preços redondos (de 50 em 50 centavos), trocos pequenos e dica do valor do troco depois de um erro |
| 🦊 Intermediário | Centavos quebrados e notas de até R$ 50 |
| 🦁 Avançado | Valores até R$ 200 e clientes que dão moedas a mais para facilitar o troco |

## Para quem ainda não sabe ler

- A Moedinha **fala**: as instruções da tela inicial, o pedido de cada cliente (com o preço e quanto ele pagou), os erros e acertos, e as mensagens da lojinha. Tocar num balão repete a fala. No app Android usa a voz do próprio celular; no navegador, a voz do navegador.
- O menu inicial usa ícones grandes e cores: a Moedinha explica "botão verde, amarelo e branco".
- O jogo abre direto no menu. O estado e o apelido só são pedidos na primeira vez que a criança entra no **Desafio do dia** (o que tem ranking); quem só joga os níveis nunca vê essas telas. Depois, os dois só mudam na **Área dos pais**, que abre segurando o botão por 2 segundos.

## Minha lojinha

Cada cliente atendido rende moedinhas 🪙: 2 por troco certo, mais 2 se for perfeito, mais 3 por estrela e 10 de bônus no desafio do dia. Com elas a criança compra decoração para a loja onde atende os clientes: parede, balcão, prateleira, bichinho e enfeite (33 itens, de 15 a 90 moedinhas). A carteira e a decoração ficam salvas no aparelho.

Duas categorias especiais, em `public/regional.js`:
- **Brasil:** 53 coisas gostosas e famosas do país (pão de queijo, acarajé, chimarrão, frevo…), todas juntas e sem dizer de qual estado: cada um reconhece a sua.
- **Antigamente:** 11 brinquedos da infância dos pais e avós (peão, bolinha de gude, peteca, bilboquê, carrinho de rolimã, bichinho virtual…).

Os itens que não existem em emoji são desenhados em SVG no mesmo arquivo.

## Música e sons

A música de fundo e os efeitos ficam em `public/sons/`. Eles são compostos em código, no estilo de videogame antigo (chiptune), por `tools/gerar-audio.mjs`. Para mudar e gerar de novo:

```bash
npm install
npm run audio
```

## Ícone

A Moedinha é desenhada em `tools/gerar-icone.py`, que gera o ícone do Android (`android/app/src/main/res/drawable/ic_launcher_*.xml`), `arte/icone.svg` e o favicon. A imagem de 512×512 para a Play Store é `arte/icone-play-store-512.png` (gerada por `tools/gerar-icone-png.cjs`).

## Como o ranking funciona

| Arquivo | O que faz |
|---|---|
| `public/index.html` | O jogo. |
| `public/regras.js` | As regras (desafio do dia, pontuação, apelidos). Usado pelo jogo **e** pelo servidor. |
| `server.js` | Serve o jogo, a API do ranking, o painel do dono e os códigos de recuperação. Guarda tudo em `dados/`. |
| `integridade.js` | Verificação do Play Integrity (desligada até a publicação). |
| `admin/index.html` | Painel do dono, em `/admin`. |

**Sem login e sem nome.** Cada aparelho ganha um código aleatório. No ranking aparece só um **apelido sorteado** de listas prontas (ex.: "🐆 Onça Veloz 7"); o servidor recusa qualquer outra combinação. A criança troca o apelido no 🎲.

**Contra trapaça:**
- O servidor refaz os 5 clientes do dia, confere cada troco e calcula a pontuação ele mesmo.
- **Tempo medido no servidor:** o jogo avisa quando cada cliente aparece, quando o troco é entregue e quando pausa. Vale o **maior** entre o tempo que o celular diz e o tempo medido (com 1,5 s de folga para a internet). Declarar um tempo menor não adianta.
- Pode jogar o desafio do dia várias vezes: o servidor guarda só o melhor resultado de cada jogador; limites de pedidos por minuto.
- **Play Integrity** (quando ligado): prova que o resultado veio do app original da Play Store num celular de verdade.
- **Painel do dono** para remover resultados suspeitos.

**Placar dos estados:** média de tempo dos jogadores do estado. Um estado só entra no placar com pelo menos 3 jogadores.

API principal:
- `POST /api/resultado`: `{ day, uf, playerId, nick, rounds: [{ pieces, ms, wrong }], integrity? }`
- `POST /api/evento`: `{ day, playerId, round, tipo: inicio|fim|pausa|volta }`
- `GET /api/ranking?day=AAAA-MM-DD&uf=SP&playerId=...`
- `POST /api/apelido`, `POST /api/nonce`, `POST /api/backup`, `GET /api/backup/:codigo`, `GET /api/saude`

## Painel do dono

Abra `https://SEU-SERVIDOR/admin` e digite a senha (`ADMIN_TOKEN`). No Render ela é gerada sozinha: veja em **Environment**. O painel lista os resultados do dia com tempo declarado × medido, erros e alertas (rápido demais, sem medição, integridade), e permite **remover** ou **devolver** um resultado.

## Código de recuperação

Na Área dos pais, "Criar código de recuperação" gera algo como `pipa-caju-sapo-42`. Ele guarda moedinhas, decoração, níveis, apelido e estado (nada pessoal) e é atualizado sozinho depois de cada partida. No celular novo, "Já tem um código?" restaura tudo. Só o aparelho que criou o código consegue atualizá-lo; tentativas de adivinhar são limitadas a 10 por minuto.

## Play Integrity (ligar na publicação)

Tudo já está no código; falta a configuração, que depende da conta na Play Store:

1. No **Google Cloud**, crie um projeto e ative a **Play Integrity API**. Anote o **número do projeto**.
2. Na **Play Console**, em *Integridade do app*, vincule esse projeto.
3. No Google Cloud, crie uma **conta de serviço**, gere uma chave JSON.
4. No GitHub, em *Settings > Secrets and variables > Actions > Variables*, crie `PLAY_CLOUD_PROJECT` com o número do projeto (o próximo APK já pede o token).
5. No Render, adicione `GOOGLE_SERVICE_ACCOUNT` com o conteúdo do JSON e mude `INTEGRITY_MODE` para `log`. Olhe o painel por alguns dias: resultados legítimos devem aparecer como "app original".
6. Quando estiver tudo certo, mude `INTEGRITY_MODE` para `require`: resultados sem prova do Google passam a ser recusados.

## Colocar no ar de graça (Render + Neon + cron-job.org)

Três serviços gratuitos, sem cartão de crédito:

| Peça | Serviço | Para quê |
|---|---|---|
| Servidor | [Render](https://render.com) | Roda o `server.js` |
| Banco de dados | [Neon](https://neon.tech) | Guarda ranking e códigos de recuperação sem apagar (0,5 GB grátis) |
| Despertador | [cron-job.org](https://cron-job.org) | Visita o servidor a cada 10 minutos para ele não dormir |

**1. Banco de dados (Neon)**
1. Entre em neon.tech com a conta do GitHub e crie um projeto (região: São Paulo, se houver; senão, a mais próxima).
2. Na tela do projeto, copie a **Connection string**. Ela começa com `postgresql://` e termina com `?sslmode=require`.

**2. Servidor (Render)**
1. Entre em render.com com a conta do GitHub.
2. **New > Blueprint**, escolha este repositório e o branch com o código.
3. Quando o Render pedir `DATABASE_URL`, cole a Connection string do Neon.
4. Pronto: o Render cria o serviço, gera a senha do painel (`ADMIN_TOKEN`, em *Environment*) e o jogo fica em `https://troco-certo.onrender.com` (ou nome parecido).
5. Para conferir, abra `https://SEU-SERVIDOR/api/saude`: deve aparecer `"armazenamento":"postgres"`.

As tabelas do banco são criadas sozinhas na primeira vez.

**3. Despertador (cron-job.org)**
1. Crie a conta em cron-job.org.
2. **Create cronjob**: URL `https://SEU-SERVIDOR/api/saude`, a cada **10 minutos**.

O Render grátis dá 750 horas por mês, e um mês tem no máximo 744: dá para ficar acordado o mês todo sem pagar.

**Rodar no computador:** `npm install` e `npm start`. Sem `DATABASE_URL`, os dados ficam na pasta `dados/`. Também há um `Dockerfile` (com volume em `/data`) para quem preferir um VPS.

Variáveis de ambiente: `PORT` (padrão 3000), `DATABASE_URL` (PostgreSQL; sem ela usa arquivos), `DATA_DIR` (padrão `./dados`), `ADMIN_TOKEN` (senha do painel, mínimo 12 caracteres), `INTEGRITY_MODE` (`off`, `log` ou `require`), `GOOGLE_SERVICE_ACCOUNT` (JSON da conta de serviço) e `PLAY_PACKAGE` (padrão `app.trococerto`).

Testes: `npm test`. Para incluir o teste com PostgreSQL de verdade: `TEST_DATABASE_URL=postgresql://... npm test` (o banco de teste é apagado).

## App Android (APK)

O GitHub gera o APK sozinho a cada mudança em `public/` ou `android/` (workflow `.github/workflows/apk.yml`) e publica na página de Releases, com o nome **Troco Certo (teste)**.

- O jogo vai dentro do APK e abre na hora, mesmo sem internet. Só o ranking usa o servidor.
- O endereço do servidor vem de `TROCO_API_URL`. Se o Render der outro nome, crie essa variável em *Settings > Secrets and variables > Actions > Variables* e rode o workflow de novo.
- O APK é assinado com uma chave de teste (`android/app/teste.keystore`), então versões novas instalam por cima. Para a Play Store, será preciso uma chave própria, guardada fora do repositório.

Para gerar no computador: copie o conteúdo de `public/` (com a pasta `fonts/`) para `android/app/src/main/assets/` e rode `gradle assembleRelease` dentro de `android/` (precisa do Android SDK).

## Próximos passos

- Ranking por cidade.
- Empacotar como app Android (PWA/TWA) para publicar na Play Store.
- Quando passar de alguns milhares de jogadores por dia: trocar o arquivo por um banco de dados (SQLite ou Postgres).
