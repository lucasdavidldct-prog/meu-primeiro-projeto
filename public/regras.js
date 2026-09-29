// Regras do Troco Certo, compartilhadas entre o jogo (navegador) e o servidor.
// O servidor usa estas mesmas funções para refazer o desafio do dia e conferir cada resultado.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Regras = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  // Valores em centavos. Sem a nota de 200: o troco máximo é menor que isso.
  const VALORES = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5];

  const WRONG_PENALTY = 5000; // 5s por troco errado
  const EXTRA_PENALTY = 2000; // 2s por peça além do mínimo

  const TIERS = [
    { min: 150,  max: 900,   pays: [1000, 2000],  extraCoins: false },
    { min: 600,  max: 1900,  pays: [2000, 5000],  extraCoins: true },
    { min: 1200, max: 4600,  pays: [5000, 10000], extraCoins: true },
    { min: 3000, max: 9600,  pays: [10000],       extraCoins: true },
    { min: 6000, max: 18900, pays: [20000],       extraCoins: false },
  ];

  // RNG determinístico: mesma semente => mesmo desafio para todo mundo
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Apelidos do ranking: só combinações destas listas (nada de nome de verdade nem palavrão).
  // Os adjetivos não mudam com masculino/feminino ("Onça Veloz", "Tatu Veloz").
  const APELIDO_NOMES = ["🐆 Onça", "🦜 Arara", "🐦 Tucano", "🦫 Capivara", "🦔 Tatu", "🐬 Boto", "🐒 Mico", "🐢 Jabuti", "🐺 Lobo-guará",
    "🐜 Tamanduá", "🦩 Flamingo", "🐸 Perereca", "🦉 Coruja", "🐝 Abelha", "🦋 Borboleta", "🐊 Jacaré",
    "🧀 Pão de Queijo", "🍫 Brigadeiro", "🍿 Pipoca", "🥟 Pastel", "🌽 Pamonha", "🥥 Cocada",
    "☄️ Cometa", "🚀 Foguete", "🪁 Pipa", "🌟 Estrela", "⚡ Raio", "🌈 Arco-íris"];
  const APELIDO_ADJ = ["Veloz", "Feliz", "Genial", "Incrível", "Ágil", "Valente", "Gentil", "Sagaz",
    "Brilhante", "Elegante", "Imbatível", "Sorridente", "Radiante", "Craque", "Nota 10", "do Troco"];
  function validNick(n) {
    return !!n && Number.isInteger(n.n) && n.n >= 0 && n.n < APELIDO_NOMES.length
      && Number.isInteger(n.a) && n.a >= 0 && n.a < APELIDO_ADJ.length
      && Number.isInteger(n.num) && n.num >= 1 && n.num <= 99;
  }
  function nickName(n) { return validNick(n) ? `${APELIDO_NOMES[n.n]} ${APELIDO_ADJ[n.a]} ${n.num}` : "Jogador"; }
  function randomNick() {
    const r = (k) => Math.floor(Math.random() * k);
    return { n: r(APELIDO_NOMES.length), a: r(APELIDO_ADJ.length), num: 1 + r(99) };
  }

  // Níveis (fora do ranking). "step" é o menor passo do preço, em centavos.
  const LEVELS = {
    iniciante: {
      name: "Iniciante", emoji: "🐣", desc: "Preços redondos e trocos pequenos. Com dicas!",
      tiers: [
        { min: 100, max: 400, step: 50, pays: [500] },
        { min: 200, max: 800, step: 50, pays: [1000] },
        { min: 150, max: 900, step: 50, pays: [1000] },
        { min: 500, max: 1500, step: 100, pays: [2000] },
        { min: 300, max: 1800, step: 50, pays: [2000] },
      ],
    },
    intermediario: {
      name: "Intermediário", emoji: "🦊", desc: "Centavos quebrados e notas de até R$ 50.",
      tiers: [
        { min: 150, max: 900, pays: [1000, 2000] },
        { min: 600, max: 1900, pays: [2000, 5000] },
        { min: 1200, max: 4600, pays: [5000] },
        { min: 1000, max: 4500, pays: [5000], extraCoins: true },
        { min: 2000, max: 4800, pays: [5000, 10000] },
      ],
    },
    avancado: {
      name: "Avançado", emoji: "🦁", desc: "Valores altos e clientes espertinhos que dão moedas a mais.",
      tiers: [
        { min: 600, max: 1900, pays: [2000], extraCoins: true },
        { min: 3000, max: 9600, pays: [10000], extraCoins: true },
        { min: 6000, max: 18900, pays: [20000] },
        { min: 4000, max: 9900, pays: [10000], extraCoins: true },
        { min: 11000, max: 19900, pays: [20000], extraCoins: true },
      ],
    },
  };
  const LEVEL_ORDER = ["iniciante", "intermediario", "avancado"];

  function makeRounds(seedStr, tiers = TIERS) {
    const rng = mulberry32(hashStr(seedStr));
    const randInt = (a, b) => a + Math.floor(rng() * (b - a + 1));
    return tiers.map((t) => {
      const step = t.step || 5;
      const price = step * randInt(Math.ceil(t.min / step), Math.floor(t.max / step));
      const options = t.pays.filter((p) => p > price);
      let paid = options[randInt(0, options.length - 1)];
      // Às vezes o cliente "facilita" e completa com as moedas dos centavos
      const cents = price % 100;
      if (t.extraCoins && cents !== 0 && rng() < (t.extraChance || 0.45)) paid += cents;
      return { price, paid, change: paid - price };
    });
  }

  const dailySeed = (day) => "troco-" + day;

  // O dia do desafio vira à meia-noite de Brasília para todo o Brasil.
  // Brasília é UTC-3 fixo desde o fim do horário de verão (2019).
  const BRT_OFFSET = -3 * 3600000, DAY_MS = 86400000;
  const LAUNCH_DAY = "2026-09-28"; // desafio nº 1

  function dayKey(date = new Date()) { return new Date(date.getTime() + BRT_OFFSET).toISOString().slice(0, 10); }
  function msToNextDay(date = new Date()) { return DAY_MS - ((date.getTime() + BRT_OFFSET) % DAY_MS); }
  function challengeNumber(day) { return Math.max(1, Math.round((Date.parse(day) - Date.parse(LAUNCH_DAY)) / DAY_MS) + 1); }

  // Menor número de peças para um valor (programação dinâmica)
  function minPieces(amount) {
    const n = amount / 5, dp = new Array(n + 1).fill(Infinity); dp[0] = 0;
    for (let i = 1; i <= n; i++) for (const v of VALORES) { const k = v / 5; if (k <= i && dp[i - k] + 1 < dp[i]) dp[i] = dp[i - k] + 1; }
    return dp[n];
  }

  // results: [{ ms, pieces, best, wrong }]
  function scoreOf(results) {
    const raw = results.reduce((a, r) => a + r.ms, 0);
    const wrong = results.reduce((a, r) => a + r.wrong, 0);
    const extra = results.reduce((a, r) => a + (r.pieces - r.best), 0);
    return { raw, wrong, extra, total: raw + wrong * WRONG_PENALTY + extra * EXTRA_PENALTY };
  }

  return { UFS, VALORES, LEVELS, LEVEL_ORDER, validNick, nickName, randomNick, WRONG_PENALTY, EXTRA_PENALTY, makeRounds, dailySeed, dayKey, msToNextDay, challengeNumber, minPieces, scoreOf };
});
