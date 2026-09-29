// Itens especiais da lojinha: coisas de cada estado e brinquedos de antigamente.
// Ícones desenhados em SVG (viewBox 0 0 40 40) para o que não existe em emoji.
(function (root) {
  "use strict";
  const I = {
    paoqueijo: `<circle cx="12" cy="26" r="9" fill="#f2c14e" stroke="#c8912a" stroke-width="1.5"/><circle cx="28" cy="26" r="9" fill="#f2c14e" stroke="#c8912a" stroke-width="1.5"/><circle cx="20" cy="15" r="9" fill="#f6cd5f" stroke="#c8912a" stroke-width="1.5"/><path d="M15 12 Q18 9 21 10 M8 23 Q10 21 12 21 M24 23 Q26 21 28 21" stroke="#fff4c7" stroke-width="1.8" fill="none" stroke-linecap="round"/><g fill="#d9a53a"><circle cx="22" cy="18" r=".9"/><circle cx="13" cy="29" r=".9"/><circle cx="30" cy="29" r=".9"/></g>`,
    queijo: `<path d="M5 24 L20 12 L35 20 L35 30 L5 32 Z" fill="#fff3c2" stroke="#d9b75a" stroke-width="1.5"/><path d="M5 24 L35 20" stroke="#d9b75a" stroke-width="1.2"/><circle cx="14" cy="27" r="1.8" fill="#f0dc98"/><circle cx="26" cy="26" r="1.4" fill="#f0dc98"/>`,
    tapioca: `<path d="M3 27 A17 17 0 0 1 37 27 Z" fill="#fffaf0" stroke="#e3cfa8" stroke-width="1.5"/><path d="M8 26 Q20 18 32 26" stroke="#e05a4f" stroke-width="3" fill="none"/><path d="M10 26 Q20 21 30 26" stroke="#f4c542" stroke-width="2" fill="none"/>`,
    acai: `<path d="M5 18 H35 Q33 34 20 34 Q7 34 5 18 Z" fill="#8b5a2b"/><ellipse cx="20" cy="18" rx="15" ry="5" fill="#5b2a86"/><circle cx="14" cy="17" r="2.6" fill="#fff3b0" stroke="#e8d27a"/><circle cx="24" cy="16" r="2.6" fill="#fff3b0" stroke="#e8d27a"/><g fill="#d9a55b"><circle cx="19" cy="19" r=".9"/><circle cx="28" cy="19" r=".9"/><circle cx="10" cy="19" r=".9"/></g>`,
    acaraje: `<ellipse cx="20" cy="24" rx="15" ry="10" fill="#c9772e" stroke="#9c5419" stroke-width="1.5"/><path d="M8 22 Q20 14 32 22 Q20 28 8 22 Z" fill="#f7c948"/><circle cx="15" cy="20" r="2.2" fill="#ff8a80"/><circle cx="24" cy="20" r="2.2" fill="#ff8a80"/><circle cx="20" cy="22" r="1.4" fill="#3aa35b"/>`,
    berimbau: `<path d="M12 3 Q4 20 12 37" stroke="#8d5a2b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 3 L12 37" stroke="#9aa0a6" stroke-width="1"/><circle cx="16" cy="30" r="6" fill="#f08a3c" stroke="#b85f1f" stroke-width="1.5"/><path d="M26 8 L30 24" stroke="#8d5a2b" stroke-width="2" stroke-linecap="round"/><ellipse cx="31" cy="27" rx="3" ry="4" fill="#d9a55b"/>`,
    caju: `<path d="M12 16 Q8 30 18 36 Q30 38 30 26 Q30 16 22 14 Q15 12 12 16 Z" fill="#f4511e"/><path d="M14 18 Q12 26 17 32" stroke="#ffb74d" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M14 14 Q12 4 20 5 Q27 6 24 12 Q21 10 18 12 Q16 14 14 14 Z" fill="#9e8e7e"/>`,
    rede: `<path d="M4 6 L4 36 M36 6 L36 36" stroke="#8d5a2b" stroke-width="3" stroke-linecap="round"/><path d="M4 12 Q20 34 36 12" stroke="#e53935" stroke-width="4" fill="none"/><path d="M6 14 Q20 30 34 14" stroke="#fdd835" stroke-width="3" fill="none"/><path d="M8 16 Q20 27 32 16" stroke="#43a047" stroke-width="3" fill="none"/>`,
    pequi: `<circle cx="14" cy="22" r="10" fill="#6a8f2c"/><circle cx="14" cy="22" r="6.5" fill="#ffc400"/><circle cx="28" cy="22" r="9" fill="#ffca28" stroke="#e0a800" stroke-width="1.5"/><circle cx="26" cy="19" r="2" fill="#fff3b0"/>`,
    chimarrao: `<path d="M10 16 Q6 36 20 36 Q34 36 30 16 Z" fill="#6d8b3a" stroke="#4a6325" stroke-width="1.5"/><ellipse cx="20" cy="16" rx="10" ry="3.5" fill="#4caf50"/><path d="M22 16 L30 3" stroke="#c0c6cc" stroke-width="2.5" stroke-linecap="round"/><path d="M12 24 Q20 27 28 24" stroke="#c9a36b" stroke-width="2" fill="none"/>`,
    bolorolo: `<rect x="6" y="12" width="28" height="18" rx="3" fill="#f3c98b" stroke="#c99a57" stroke-width="1.5"/><circle cx="12" cy="21" r="6.5" fill="#fbe3b8" stroke="#b5651d" stroke-width="1.2"/><path d="M12 21 m-4 0 a4 4 0 1 1 4 4 a2.5 2.5 0 1 1 -2 -3" stroke="#b5651d" stroke-width="1.6" fill="none"/>`,
    frevo: `<path d="M4 20 A16 16 0 0 1 36 20 Z" fill="#e53935"/><path d="M4 20 A16 16 0 0 1 12 7 L20 20 Z" fill="#fdd835"/><path d="M20 4 A16 16 0 0 1 28 6 L20 20 Z" fill="#43a047"/><path d="M28 6 A16 16 0 0 1 36 20 L20 20 Z" fill="#1e88e5"/><path d="M20 20 L20 35" stroke="#555" stroke-width="2"/>`,
    pinhao: `<path d="M12 6 Q20 16 16 32 Q8 30 7 20 Q7 12 12 6 Z" fill="#8d4e2a" stroke="#5d3018" stroke-width="1.2"/><path d="M26 8 Q34 18 30 34 Q22 32 21 22 Q21 14 26 8 Z" fill="#a0592f" stroke="#5d3018" stroke-width="1.2"/>`,
    capim: `<circle cx="20" cy="20" r="14" fill="none" stroke="#e0a82e" stroke-width="6"/><circle cx="20" cy="20" r="14" fill="none" stroke="#b7811a" stroke-width="1" stroke-dasharray="2 3"/><circle cx="20" cy="20" r="6" fill="none" stroke="#e0a82e" stroke-width="3"/>`,
    biscoitoglobo: `<circle cx="20" cy="20" r="14" fill="#f5e6c8" stroke="#d9c39a" stroke-width="1.5"/><circle cx="20" cy="20" r="6" fill="#dff2ff"/><g fill="#e8d4ad"><circle cx="12" cy="14" r="1"/><circle cx="29" cy="16" r="1"/><circle cx="25" cy="30" r="1"/></g>`,
    peao: `<path d="M7 15 Q20 5 33 15 L20 37 Z" fill="#e53935"/><path d="M9 18 Q20 11 31 18" stroke="#fdd835" stroke-width="3" fill="none"/><path d="M13 25 Q20 21 27 25" stroke="#1e88e5" stroke-width="3" fill="none"/><path d="M20 37 L20 39" stroke="#555" stroke-width="2"/><path d="M20 8 L20 3 Q28 1 30 6" stroke="#8d6e63" stroke-width="1.5" fill="none"/>`,
    gude: `<circle cx="11" cy="26" r="7" fill="#4fc3f7"/><path d="M6 25 Q11 20 16 27" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/><circle cx="26" cy="27" r="7" fill="#81c784"/><path d="M21 28 Q26 22 31 26" stroke="#fdd835" stroke-width="1.5" fill="none"/><circle cx="19" cy="13" r="7" fill="#e57373"/><path d="M14 12 Q19 8 24 14" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/>`,
    peteca: `<path d="M20 22 L10 4 M20 22 L20 2 M20 22 L30 4" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M20 22 L10 4" stroke="#e53935" stroke-width="3" stroke-linecap="round"/><path d="M20 22 L20 2" stroke="#fdd835" stroke-width="3" stroke-linecap="round"/><path d="M20 22 L30 4" stroke="#1e88e5" stroke-width="3" stroke-linecap="round"/><ellipse cx="20" cy="29" rx="10" ry="8" fill="#a1887f" stroke="#6d4c41" stroke-width="1.5"/>`,
    bilboque: `<path d="M12 38 L14 18" stroke="#8d6e63" stroke-width="3" stroke-linecap="round"/><path d="M8 18 Q14 24 20 18 Z" fill="#c62828"/><path d="M14 18 Q24 8 28 22" stroke="#9e9e9e" stroke-width="1" fill="none"/><circle cx="28" cy="25" r="5" fill="#c62828"/><circle cx="26.5" cy="23.5" r="1.3" fill="#fff" opacity=".7"/>`,
    rolima: `<rect x="3" y="18" width="34" height="6" rx="2" fill="#c68b59" stroke="#8d5a2b" stroke-width="1.2"/><path d="M8 18 L8 12 M8 12 L14 12" stroke="#8d5a2b" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="29" r="4" fill="#9e9e9e" stroke="#616161"/><circle cx="32" cy="29" r="4" fill="#9e9e9e" stroke="#616161"/><circle cx="20" cy="29" r="4" fill="#9e9e9e" stroke="#616161"/>`,
    virtual: `<path d="M20 4 Q34 6 33 22 Q32 36 20 36 Q8 36 7 22 Q6 6 20 4 Z" fill="#f48fb1" stroke="#c2185b" stroke-width="1.5"/><rect x="12" y="11" width="16" height="12" rx="2" fill="#c5e1a5"/><circle cx="20" cy="17" r="2.5" fill="#33691e"/><circle cx="14" cy="29" r="2" fill="#fff"/><circle cx="20" cy="30" r="2" fill="#fff"/><circle cx="26" cy="29" r="2" fill="#fff"/>`,
    bolameia: `<circle cx="20" cy="21" r="14" fill="#fafafa" stroke="#9e9e9e" stroke-width="1.5"/><path d="M7 16 Q20 22 33 16 M7 26 Q20 32 33 26" stroke="#e53935" stroke-width="3" fill="none"/>`,
  };
  const svg = (k) => `<svg viewBox="0 0 40 40" aria-hidden="true">${I[k]}</svg>`;

  // [nome, ícone (chave de I ou emoji), preço]
  const ESTADOS = {
    AC: [["Castanha-do-brasil", "🌰", 30], ["Canoa no rio Acre", "🛶", 40]],
    AL: [["Tapioca", "tapioca", 30], ["Jangada", "⛵", 40]],
    AP: [["Camarão no bafo", "🦐", 30], ["Marco Zero do Equador", "🧭", 40]],
    AM: [["Tacacá", "🥣", 30], ["Boi-bumbá de Parintins", "🐂", 45]],
    BA: [["Acarajé", "acaraje", 35], ["Berimbau", "berimbau", 45]],
    CE: [["Caju", "caju", 30], ["Rede de dormir", "rede", 40]],
    DF: [["Pastel com caldo de cana", "🥟", 30], ["Ipê amarelo", "🌼", 35]],
    ES: [["Moqueca capixaba", "🍲", 35], ["Tambor do congo", "🥁", 40]],
    GO: [["Pamonha", "🌽", 30], ["Pequi", "pequi", 35]],
    MA: [["Guaraná Jesus", "🥤", 30], ["Lençóis Maranhenses", "🏜️", 45]],
    MT: [["Pacu assado", "🐟", 35], ["Onça do Pantanal", "🐆", 45]],
    MS: [["Sobá", "🍜", 35], ["Jacaré do Pantanal", "🐊", 45]],
    MG: [["Pão de queijo", "paoqueijo", 30], ["Queijo minas", "queijo", 35], ["Trem de ferro", "🚂", 45]],
    PA: [["Açaí na tigela", "acai", 30], ["Vaso marajoara", "🏺", 45]],
    PB: [["Queijo coalho no espeto", "🍢", 30], ["Sanfona de forró", "🪗", 45]],
    PR: [["Pinhão", "pinhao", 30], ["Araucária", "🌲", 40]],
    PE: [["Bolo de rolo", "bolorolo", 35], ["Sombrinha de frevo", "frevo", 45]],
    PI: [["Cajuína", "🧃", 30], ["Pedra Furada", "🪨", 40]],
    RJ: [["Biscoito de polvilho", "biscoitoglobo", 30], ["Bondinho", "🚡", 45]],
    RN: [["Camarão", "🦐", 30], ["Dunas de Genipabu", "🐪", 40]],
    RS: [["Chimarrão", "chimarrao", 35], ["Churrasco", "🍖", 40]],
    RO: [["Tambaqui", "🐟", 30], ["Castanheira", "🌳", 40]],
    RR: [["Damorida", "🌶️", 30], ["Monte Roraima", "⛰️", 45]],
    SC: [["Ostras", "🦪", 35], ["Pretzel da Oktoberfest", "🥨", 35]],
    SP: [["Pastel de feira", "🥟", 30], ["Metrô", "🚇", 40]],
    SE: [["Caranguejo", "🦀", 30], ["Cocada", "🥥", 30]],
    TO: [["Capim dourado", "capim", 40], ["Fervedouro do Jalapão", "💧", 35]],
  };
  const ANTIGAMENTE = [
    ["Peão", "peao", 30], ["Bolinhas de gude", "gude", 25], ["Pipa", "🪁", 25], ["Ioiô", "🪀", 25],
    ["Peteca", "peteca", 30], ["Bilboquê", "bilboque", 35], ["Bola de meia", "bolameia", 25],
    ["Carrinho de rolimã", "rolima", 50], ["Bichinho virtual", "virtual", 50], ["Videogame antigo", "🕹️", 60], ["Fita cassete", "📼", 40],
  ];
  const icon = (k) => (I[k] ? svg(k) : k);

  root.Regional = {
    icon,
    estadoItems: [{ id: "x-nada", name: "Nenhum", price: 0, text: "" }].concat(
      Object.entries(ESTADOS).flatMap(([uf, list]) => list.map(([name, ic, price], i) => ({ id: `x-${uf}-${i}`, uf, name, price, text: icon(ic) })))),
    antigoItems: [{ id: "t-nada", name: "Nenhum", price: 0, text: "" }].concat(
      ANTIGAMENTE.map(([name, ic, price], i) => ({ id: `t-${i}`, name, price, text: icon(ic) }))),
  };
})(typeof self !== "undefined" ? self : this);
