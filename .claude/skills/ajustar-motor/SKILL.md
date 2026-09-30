---
name: ajustar-motor
description: Muda o motor de partida do Esquadrão FC (simulação, lances, playstyles, química, dificuldade) sem quebrar o equilíbrio — mede antes e depois com npm run calibrar e testes determinísticos. Use para pedidos como "jogo muito fácil", "poucos gols", "playstyle X não faz diferença" ou otimização de desempenho do motor.
---

# Ajustar o motor

## Antes de mudar
1. Guarde a linha de base com uma seed fixa:
   ```bash
   npm run calibrar -- --n=500 --seed=2026 > "$SCRATCH/cal-antes.txt"
   ```
2. Localize onde a regra vive:
   - Chance de gol, posse e mando: `CALIB` em `src/engine/match.ts`.
   - Efeito de playstyle: `FX` em `src/engine/playstyles.ts`, no formato `[sem, prata, dourado]`.
     - Na simulação, os efeitos são usados em `match.ts`.
     - Nos lances jogáveis, em `lance.ts` e `lanceScene.ts`.
   - Força do time: `rate()`, `power()` e `PS_SECTOR` em `src/engine/chemistry.ts`.
   - Dificuldade: `difficulty()` em `src/ui/matchView.ts`.

## Regras
- O motor é puro e determinístico: sorteios só com `R()`, nada de DOM em `src/engine/`.
- Todo playstyle novo precisa de efeito real e testável, com dourado > prata > nada.
- Alvos da calibragem:
  - ~2,45 gols/jogo entre times do mesmo nível;
  - mandante vence ~53% e perde ~24%;
  - diferença de +15 de força dá ~85% de vitórias.
- **Desempenho**: `rate()` roda a cada minuto de cada jogo.
  - Não coloque trabalho pesado por jogador ali; use o cache `offsets()` de `chemistry.ts`.
  - Meça com um script que simula 400 jogos e imprime ms/jogo (hoje ~3 ms).
  - Para achar o gargalo: `node --cpu-prof --import tsx`, lendo o perfil da thread principal (`*.0.001.cpuprofile`).

## Depois de mudar
1. Rode de novo e compare:
   ```bash
   npm run calibrar -- --n=500 --seed=2026 > "$SCRATCH/cal-depois.txt"
   diff "$SCRATCH/cal-antes.txt" "$SCRATCH/cal-depois.txt"
   ```
   Otimização pura tem que dar resultado **idêntico**; só o tempo muda.
2. Rode `npm run checar`. Crie ou ajuste um teste em `tests/` provando o efeito, comparando séries com `seedRng`.
3. Resuma para o usuário os números antes e depois, em linguagem de jogo ("gols por jogo subiram de 2,3 para 2,5").
