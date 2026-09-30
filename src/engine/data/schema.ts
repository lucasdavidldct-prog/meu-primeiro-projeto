// Formato dos arquivos em data/. Este módulo é puro: usado pelo jogo, pelo editor e pelo npm run validar-dados.
import type { Pos } from '../types';

export const ATR_LINHA = ['RIT', 'FIN', 'PAS', 'DRI', 'DEF', 'FIS'] as const;
export const ATR_GOL = ['MER', 'MAN', 'CHU', 'REF', 'VEL', 'POS'] as const;
export type AtrLinha = typeof ATR_LINHA[number];
export type AtrGol = typeof ATR_GOL[number];
export type Pe = 'D' | 'E' | 'A';

export interface JogadorData {
  id: string;
  nome: string;
  nomeCurto: string;
  nacionalidade: string;
  idade: number;
  posicao: Pos;
  posicoesAlt: Pos[];
  pe: Pe;
  overall: number;
  atributos: Record<string, number>;
  /** Ids de playstyle; o sufixo "+" marca a versão mais forte. */
  playstyles: string[];
}

export interface ClubeData {
  id: string;
  nome: string;
  sigla: string;
  cidade: string;
  cores: [string, string];
  elenco: JogadorData[];
}

export interface LigaData {
  id: string;
  nome: string;
  pais: string;
  temporada: string;
  atualizadoEm: string;
  clubes: ClubeData[];
}

export interface LendaData extends JogadorData {
  /** Clube em que o ídolo marcou época (texto livre). */
  clubeHistorico: string;
  /** Sigla do clube atual ligado ao ídolo, se houver (ex.: CAM). */
  clube?: string;
  epoca: string;
}
export interface LendasData { atualizadoEm: string; lendas: LendaData[] }

export interface NacaoData { nome: string; cores: [string, string, string]; horizontal?: boolean }
export type NacoesData = Record<string, NacaoData>;

export const LIGA_IDS = ['brasileirao', 'premier-league', 'serie-a', 'laliga', 'bundesliga', 'saudi-pro-league', 'mls'] as const;
export const CLUBES_ESPERADOS: Record<string, number> = {
  brasileirao: 20, 'premier-league': 20, 'serie-a': 20, laliga: 20, bundesliga: 18, 'saudi-pro-league': 18, mls: 30,
};

export interface PlaystyleDef { id: string; nome: string; gol: boolean; desc: string; descPlus: string; icone: string }

export const PLAYSTYLES: PlaystyleDef[] = [
  { id: 'chute-de-longe', nome: 'Chute de Longe', gol: false, icone: '🎯', desc: 'Finaliza bem de fora da área.', descPlus: 'Chutes de fora da área viram arma: muito mais gols de longe.' },
  { id: 'finalizacao-precisa', nome: 'Finalização Precisa', gol: false, icone: '⚽', desc: 'Coloca a bola no canto com mais frequência.', descPlus: 'Quase não erra o alvo dentro da área.' },
  { id: 'cobranca-de-falta', nome: 'Cobrança de Falta', gol: false, icone: '🌀', desc: 'Bate faltas com curva e precisão. Libera o lance de falta.', descPlus: 'Especialista: faltas perigosas de qualquer distância.' },
  { id: 'cabeceio', nome: 'Cabeceio', gol: false, icone: '🗣️', desc: 'Ganha pelo alto e marca de cabeça em escanteios.', descPlus: 'Dominante no jogo aéreo, nos dois lados do campo.' },
  { id: 'passe-preciso', nome: 'Passe Preciso', gol: false, icone: '📐', desc: 'Passes curtos e médios mais certeiros.', descPlus: 'Raramente perde a bola no passe.' },
  { id: 'passe-em-profundidade', nome: 'Passe em Profundidade', gol: false, icone: '🔑', desc: 'Enxerga o passe que quebra a linha de defesa.', descPlus: 'Lançamentos longos que deixam o atacante na cara do gol.' },
  { id: 'cruzamento', nome: 'Cruzamento', gol: false, icone: '↪️', desc: 'Cruzamentos na medida para a área.', descPlus: 'Cruzamentos que viram gol com frequência.' },
  { id: 'drible-rapido', nome: 'Drible Rápido', gol: false, icone: '💨', desc: 'Vence o marcador no um contra um com mais facilidade.', descPlus: 'Quase impossível de parar no mano a mano.' },
  { id: 'velocista', nome: 'Velocista', gol: false, icone: '⚡', desc: 'Arranque forte, ótimo no contra-ataque.', descPlus: 'Ninguém alcança na corrida.' },
  { id: 'primeiro-toque', nome: 'Primeiro Toque', gol: false, icone: '🪶', desc: 'Domina bem e ganha tempo para a jogada.', descPlus: 'Domínio perfeito mesmo sob pressão.' },
  { id: 'desarme', nome: 'Desarme', gol: false, icone: '🦶', desc: 'Rouba a bola com mais frequência.', descPlus: 'Desarmes limpos e decisivos.' },
  { id: 'interceptacao', nome: 'Interceptação', gol: false, icone: '✋', desc: 'Lê o jogo e corta passes.', descPlus: 'Antecipa quase todos os passes pelo seu setor.' },
  { id: 'bloqueio', nome: 'Bloqueio', gol: false, icone: '🧱', desc: 'Se joga na frente dos chutes.', descPlus: 'Bloqueia até chute à queima-roupa.' },
  { id: 'imposicao-fisica', nome: 'Imposição Física', gol: false, icone: '💪', desc: 'Ganha as divididas no corpo.', descPlus: 'Parede: não perde disputa física.' },
  { id: 'incansavel', nome: 'Incansável', gol: false, icone: '🔋', desc: 'Cansa menos no segundo tempo.', descPlus: 'Joga os 90 minutos no mesmo ritmo.' },
  { id: 'reflexos', nome: 'Reflexos', gol: true, icone: '🧤', desc: 'Defesas difíceis à queima-roupa.', descPlus: 'Reflexos felinos: defende o indefensável.' },
  { id: 'saida-do-gol', nome: 'Saída do Gol', gol: true, icone: '🏃', desc: 'Sai bem nos cruzamentos e no um contra um.', descPlus: 'Domina a área inteira.' },
  { id: 'pegador-de-penalti', nome: 'Pegador de Pênalti', gol: true, icone: '🥅', desc: 'Adivinha o canto com mais frequência.', descPlus: 'Pesadelo dos cobradores.' },
  { id: 'reposicao-longa', nome: 'Reposição Longa', gol: true, icone: '🚀', desc: 'Lança o contra-ataque com a mão ou o pé.', descPlus: 'Reposição que vira assistência.' },
];
export const PS_BY_ID = new Map(PLAYSTYLES.map(p => [p.id, p]));
/** Overall mínimo para ter playstyle "+". */
export const PLUS_MIN_OVR = 80;
export const MAX_PLAYSTYLES = 4;

export const parsePs = (s: string): { id: string; plus: boolean } =>
  s.endsWith('+') ? { id: s.slice(0, -1), plus: true } : { id: s, plus: false };

export const slug = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
