// Mundo do jogo: nações, ligas, clubes e jogadores.
// Etapa 1: ainda são os dados gerados do esquadrao.html original (mesma semente),
// para manter compatibilidade. Na etapa 2 isto passa a ler data/ligas/*.json.
import { PROFILE, POS_ALT } from './positions';
import { clamp, mulberry32, pick, ri, wpick } from './rng';
import type { BasePlayer, Club, Nation, Pos } from './types';

export const NATIONS: Record<string, Nation> = {
  BRA: { n: 'Brasil', f: ['#1f9d55', '#f5d000', '#1f4fbf'], g: 'pt' }, ARG: { n: 'Argentina', f: ['#75aadb', '#ffffff', '#75aadb'], g: 'es' },
  POR: { n: 'Portugal', f: ['#046a38', '#da291c', '#da291c'], g: 'pt' }, ESP: { n: 'Espanha', f: ['#aa151b', '#f1bf00', '#aa151b'], g: 'es' },
  FRA: { n: 'França', f: ['#002395', '#ffffff', '#ed2939'], g: 'fr' }, ING: { n: 'Inglaterra', f: ['#ffffff', '#ce1124', '#ffffff'], g: 'en' },
  ALE: { n: 'Alemanha', f: ['#111111', '#dd0000', '#ffce00'], g: 'de' }, ITA: { n: 'Itália', f: ['#009246', '#ffffff', '#ce2b37'], g: 'it' },
  HOL: { n: 'Holanda', f: ['#ae1c28', '#ffffff', '#21468b'], g: 'nl' }, URU: { n: 'Uruguai', f: ['#ffffff', '#0038a8', '#ffffff'], g: 'es' },
  COL: { n: 'Colômbia', f: ['#fcd116', '#003893', '#ce1126'], g: 'es' }, BEL: { n: 'Bélgica', f: ['#111111', '#fdda24', '#ef3340'], g: 'fr' },
  CRO: { n: 'Croácia', f: ['#ff0000', '#ffffff', '#171796'], g: 'hr' }, NGA: { n: 'Nigéria', f: ['#008751', '#ffffff', '#008751'], g: 'ng' },
  JAP: { n: 'Japão', f: ['#ffffff', '#bc002d', '#ffffff'], g: 'jp' }, EUA: { n: 'EUA', f: ['#b22234', '#ffffff', '#3c3b6e'], g: 'en' },
  MAR: { n: 'Marrocos', f: ['#c1272d', '#006233', '#c1272d'], g: 'ar' }, SEN: { n: 'Senegal', f: ['#00853f', '#fdef42', '#e31b23'], g: 'sn' },
};
const NAT_W: [string, number][] = [['BRA', 18], ['ARG', 8], ['POR', 6], ['ESP', 8], ['FRA', 8], ['ING', 8], ['ALE', 7], ['ITA', 7], ['HOL', 5], ['URU', 3], ['COL', 3], ['BEL', 3], ['CRO', 2], ['NGA', 3], ['JAP', 3], ['EUA', 2], ['MAR', 3], ['SEN', 3]];
const NAMES: Record<string, { f: string[]; l: string[]; nick?: string[] }> = {
  pt: { f: ['Lucas', 'Gabriel', 'Pedro', 'Rafael', 'Matheus', 'Thiago', 'Bruno', 'Felipe', 'Diego', 'André', 'Caio', 'Vitor', 'Igor', 'Renan', 'Danilo', 'Rodrigo', 'Leandro', 'Fábio', 'Marcos', 'João', 'Tiago', 'Rui', 'Nuno', 'Gonçalo', 'Diogo', 'Wesley', 'Everton', 'Alisson'],
    l: ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Rocha', 'Carvalho', 'Ribeiro', 'Martins', 'Barbosa', 'Moura', 'Teixeira', 'Mendes', 'Cardoso', 'Nogueira', 'Pacheco', 'Figueira', 'Lopes', 'Brandão', 'Sampaio', 'Queiroz', 'Aguiar', 'Valadares', 'Guimarães', 'Prado'],
    nick: ['Pedrinho', 'Juninho', 'Dudu', 'Tetê', 'Rafinha', 'Biel', 'Marquinhos', 'Tinga', 'Cacá', 'Paulinho', 'Serginho', 'Toninho', 'Luizão', 'Netinho', 'Bruninho', 'Dedé', 'Zezinho', 'Lelê', 'Tuta', 'Caju', 'Bigode', 'Ferrugem', 'Canhoto', 'Pintinho', 'Baiano', 'Chiquinho', 'Fuminho', 'Xandão'] },
  es: { f: ['Mateo', 'Santiago', 'Joaquín', 'Nicolás', 'Facundo', 'Álvaro', 'Sergio', 'Iker', 'Pablo', 'Diego', 'Gonzalo', 'Martín', 'Julián', 'Rodrigo', 'Emiliano', 'Luis', 'Andrés', 'Camilo', 'Tomás', 'Agustín'],
    l: ['García', 'Fernández', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Gómez', 'Díaz', 'Álvarez', 'Romero', 'Suárez', 'Torres', 'Herrera', 'Castro', 'Vargas', 'Ortega', 'Molina', 'Navarro', 'Acosta', 'Pereyra', 'Ibáñez', 'Cabrera'] },
  fr: { f: ['Lucas', 'Hugo', 'Théo', 'Antoine', 'Mathis', 'Adrien', 'Julien', 'Maxime', 'Baptiste', 'Clément', 'Yanis', 'Enzo', 'Nathan', 'Rayan', 'Axel', 'Loïc'],
    l: ['Martin', 'Bernard', 'Dubois', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Roux', 'Fournier', 'Morel', 'Mercier', 'Blanc', 'Garnier', 'Chevalier', 'Perrin', 'Lambert', 'Vasseur', 'Janssens'] },
  sn: { f: ['Moussa', 'Cheikh', 'Ibrahima', 'Pape', 'Mamadou', 'Abdou', 'Lamine', 'Ousmane', 'Aliou'], l: ['Diallo', 'Ndiaye', 'Sarr', 'Diop', 'Faye', 'Cissé', 'Mbaye', 'Gueye', 'Sow', 'Ba', 'Thiam'] },
  en: { f: ['Jack', 'Harry', 'Oliver', 'George', 'Charlie', 'Mason', 'Tyler', 'Ethan', 'Callum', 'Reece', 'Liam', 'Josh', 'Ben', 'Owen', 'Aaron'],
    l: ['Smith', 'Walker', 'Hughes', 'Turner', 'Cooper', 'Ward', 'Bennett', 'Fletcher', 'Harris', 'Mitchell', 'Carter', 'Palmer', 'Barnes', 'Wright', 'Collins', 'Fisher', 'Doyle', 'Marsh'] },
  de: { f: ['Lukas', 'Jonas', 'Leon', 'Felix', 'Maximilian', 'Niklas', 'Tim', 'Jan', 'Florian', 'Moritz', 'Paul', 'Erik'], l: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Krause', 'Wolf', 'Vogel', 'Lange'] },
  nl: { f: ['Daan', 'Sem', 'Milan', 'Thijs', 'Bram', 'Lars', 'Ruben', 'Jesse', 'Stijn', 'Joost'], l: ['de Jong', 'Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Hendriks', 'van Leeuwen'] },
  it: { f: ['Lorenzo', 'Matteo', 'Alessandro', 'Andrea', 'Federico', 'Nicolò', 'Davide', 'Riccardo', 'Giacomo', 'Simone', 'Marco', 'Luca'], l: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Gallo', 'Conti', 'De Luca', 'Fontana', 'Moretti'] },
  hr: { f: ['Luka', 'Ivan', 'Marko', 'Josip', 'Ante', 'Mateo', 'Domagoj', 'Nikola'], l: ['Horvat', 'Kovač', 'Babić', 'Marić', 'Jurić', 'Novak', 'Knežević', 'Vuković', 'Petrović', 'Matić'] },
  ng: { f: ['Chidi', 'Emeka', 'Tunde', 'Ayo', 'Samuel', 'Victor', 'Kelechi', 'Obinna', 'Wilfred', 'Femi'], l: ['Okafor', 'Adebayo', 'Eze', 'Nwosu', 'Okonkwo', 'Balogun', 'Uche', 'Ogunleye', 'Onyeka', 'Adeyemi'] },
  jp: { f: ['Haruto', 'Yuto', 'Sota', 'Ren', 'Kaito', 'Takumi', 'Daiki', 'Shun', 'Riku', 'Kenta'], l: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Morita', 'Ueda'] },
  ar: { f: ['Youssef', 'Hamza', 'Ayoub', 'Anas', 'Ilias', 'Soufiane', 'Adam', 'Zakaria', 'Bilal'], l: ['El Amrani', 'Benali', 'Idrissi', 'Alaoui', 'Tazi', 'Bennani', 'Chakir', 'Ouahbi', 'Haddad', 'Mansouri'] },
};

export interface League { id: string; n: string; home: string[]; clubs: [string, string, string, string][] }
export const LEAGUES: League[] = [
  { id: 'BR', n: 'Liga Brasil', home: ['BRA'], clubs: [['Atlético Serrano', 'ATS', '#c8102e', '#141414'], ['Porto Verde FC', 'PVF', '#0f8a4b', '#ffffff'], ['Real Cerrado', 'RCE', '#e0a800', '#1d5d2c'], ['União Litorânea', 'ULI', '#1d4fa3', '#ffffff'], ['Tupã EC', 'TUP', '#f07f1a', '#141414'], ['Aurora Paulista', 'AUP', '#16275c', '#d62828']] },
  { id: 'IB', n: 'Liga Ibérica', home: ['ESP', 'POR', 'ARG', 'URU', 'COL'], clubs: [['Deportivo Castilla', 'DCA', '#6b1e8f', '#ffffff'], ['Sporting Atlântico', 'SPA', '#0a7a54', '#ffffff'], ['Real Valverde', 'RVA', '#f2f2f2', '#b8963e'], ['CD Almenara', 'ALM', '#d31f3a', '#f2c500'], ['Oporto Norte', 'OPN', '#1f3f9e', '#ffffff'], ['Levante Azul', 'LAZ', '#2a6fd6', '#0b1f4a']] },
  { id: 'EN', n: 'Premier Insular', home: ['ING', 'EUA', 'NGA'], clubs: [['Northbridge United', 'NBU', '#b3121d', '#ffffff'], ['Kingsford City', 'KFC', '#6cabdd', '#1c2c5b'], ['Redmoor Rovers', 'RMR', '#7a1f2b', '#9ec9ec'], ['Ashton Athletic', 'ASH', '#1b1b1b', '#f2f2f2'], ['Harbour Town', 'HBT', '#f0c419', '#0c2340'], ['Whitecliff FC', 'WCF', '#e8e8e8', '#0b3d91']] },
  { id: 'IT', n: 'Serie Azzurra', home: ['ITA', 'CRO'], clubs: [['AC Ventura', 'ACV', '#9c1b2e', '#141414'], ['Inter Laguna', 'INL', '#0b3e91', '#141414'], ['Virtus Brenta', 'VBR', '#f2f2f2', '#141414'], ['Rondine Calcio', 'RON', '#5b2c83', '#f2f2f2'], ['Castello FC', 'CAS', '#e2231a', '#f7d117'], ['Sporting Lucca', 'SLU', '#1c8fd6', '#ffffff']] },
  { id: 'NO', n: 'Liga Norte', home: ['ALE', 'HOL', 'FRA', 'BEL', 'SEN', 'MAR', 'JAP'], clubs: [['FC Rheinwald', 'RHW', '#d8102e', '#ffffff'], ['Eintracht Nordsee', 'EIN', '#141414', '#e30613'], ['SV Eisenberg', 'SVE', '#f5d400', '#141414'], ['Olympique Rive', 'OLR', '#0093d0', '#ffffff'], ['Stade Lumière', 'STL', '#15285b', '#e2b53d'], ['Vitesse Oranje', 'VIO', '#f36c21', '#ffffff']] },
];
export const LG: Record<string, League> = Object.fromEntries(LEAGUES.map(l => [l.id, l]));
export interface ClubRef extends Club { lg: string; i: number }
export const ALL_CLUBS: ClubRef[] = LEAGUES.flatMap(l => l.clubs.map((c, i) => ({ n: c[0], s: c[1], c1: c[2], c2: c[3], lg: l.id, i })));
export const LEGEND_CLUB: Club = { n: 'Ícones', s: 'ICO', c1: '#d9c28a', c2: '#3a2a08' };

export function clubOf(P: BasePlayer): Club {
  if (P.leg) return LEGEND_CLUB;
  const c = LG[P.lg].clubs[P.club];
  return { n: c[0], s: c[1], c1: c[2], c2: c[3] };
}
export const leagueName = (P: BasePlayer): string => (P.leg ? 'Ícones' : LG[P.lg].n);

function genPlayers(): BasePlayer[] {
  const r = mulberry32(2027), out: BasePlayer[] = [], used = new Set<string>();
  const posQ: [Pos, number][] = [['GOL', 10], ['ZAG', 16], ['LD', 7], ['LE', 7], ['VOL', 9], ['MC', 12], ['MEI', 8], ['MD', 4], ['ME', 4], ['PD', 7], ['PE', 7], ['ATA', 9]];
  for (let i = 0; i < 680; i++) {
    const nat = wpick(NAT_W, r), pool = NAMES[NATIONS[nat].g];
    let name: string, short: string, tries = 0;
    do {
      if (nat === 'BRA' && r() < .42) { name = short = pick(pool.nick!, r); }
      else { const f = pick(pool.f, r), l = pick(pool.l, r); name = f + ' ' + l; short = l; }
    } while (used.has(name) && ++tries < 20);
    used.add(name);
    const pos = wpick(posQ, r);
    const ovr = Math.round(47 + 45 * Math.pow(r(), 2.3));
    let lg = LEAGUES.find(L => L.home.includes(nat));
    if (!lg || r() < .42) lg = pick(LEAGUES, r);
    const club = Math.floor(r() * 6), age = ri(17, 35, r);
    const alt = POS_ALT[pos].filter(() => r() < .45).slice(0, 2);
    const st = PROFILE[pos].map(w => clamp(Math.round(ovr + (w - .9) * 40 + (r() * 8 - 4)), 20, 99));
    out.push({ id: i, name, short, nat, pos, alt, ovr, lg: lg.id, club, age, st });
  }
  return out;
}

export const POOL: BasePlayer[] = genPlayers();

const LEGEND_DEFS: [string, string, string, Pos, number, Pos[]][] = [
  ['Zeca Maravilha', 'Zeca', 'BRA', 'ATA', 93, ['MEI']], ['Don Ramiro', 'Ramiro', 'ARG', 'MEI', 92, ['MC']], ['Klaus Brandt', 'Brandt', 'ALE', 'ZAG', 91, ['VOL']],
  ['Tommaso Vella', 'Vella', 'ITA', 'GOL', 90, []], ['Jean-Luc Moreau', 'Moreau', 'FRA', 'MC', 91, ['MEI', 'VOL']], ['Bento Fumaça', 'Fumaça', 'BRA', 'PE', 92, ['ME', 'ATA']],
  ['Arthur Hale', 'Hale', 'ING', 'ATA', 90, []], ['Dirk van Aalst', 'van Aalst', 'HOL', 'MEI', 91, ['ATA']], ['Nando Lusitano', 'Lusitano', 'POR', 'PD', 90, ['MD']],
  ['Kofi Adeyemi', 'Adeyemi', 'NGA', 'VOL', 89, ['MC']], ['Dadá Relâmpago', 'Dadá', 'BRA', 'LD', 89, ['MD']], ['Hideo Sakamura', 'Sakamura', 'JAP', 'MC', 88, ['MEI']],
  ['Santiago Ferro', 'Ferro', 'URU', 'ZAG', 90, []], ['Marius Voclain', 'Voclain', 'BEL', 'LE', 88, ['ME']],
];
export const LEGENDS: BasePlayer[] = LEGEND_DEFS.map((l, i) => {
  const [name, short, nat, pos, ovr, alt] = l;
  const r = mulberry32(900 + i);
  return { id: 1000 + i, name, short, nat, pos, alt, ovr, lg: 'ICO', club: -1, age: ri(38, 55, r), leg: true,
    st: PROFILE[pos].map(w => clamp(Math.round(ovr + (w - .9) * 34 + (r() * 6 - 2)), 40, 99)) };
});

export const PBYID = new Map<number, BasePlayer>([...POOL, ...LEGENDS].map(p => [p.id, p]));
