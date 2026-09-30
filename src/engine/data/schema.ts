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
  /** Força estimada (40–95) para completar elencos incompletos com reservas genéricos. */
  forca?: number;
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
/** Arquivos extras: Série B (acesso/rebaixamento) e clubes sul-americanos (Libertadores). */
export const EXTRA_IDS = ['serie-b', 'conmebol'] as const;
export const ALL_LIGA_IDS: readonly string[] = [...LIGA_IDS, ...EXTRA_IDS];
export const CLUBES_ESPERADOS: Record<string, number> = {
  brasileirao: 20, 'premier-league': 20, 'serie-a': 20, laliga: 20, bundesliga: 18, 'saudi-pro-league': 18, mls: 30, 'serie-b': 20,
};

export type PsCat = 'finalizacao' | 'passe' | 'controle' | 'defesa' | 'fisico' | 'goleiro';
export const PS_CATS: Record<PsCat, string> = { finalizacao: 'Finalização', passe: 'Passe', controle: 'Controle de bola', defesa: 'Defesa', fisico: 'Físico', goleiro: 'Goleiro' };
export interface PlaystyleDef { id: string; nome: string; gol: boolean; cat: PsCat; desc: string; descPlus: string; icone: string }

export const PLAYSTYLES: PlaystyleDef[] = [
  // Finalização
  { id: 'finalizacao-precisa', cat: 'finalizacao', nome: 'Finalização Precisa', gol: false, icone: '⚽', desc: 'Erra menos o alvo e finaliza melhor dentro da área.', descPlus: 'Quase não erra o alvo dentro da área.' },
  { id: 'chute-colocado', cat: 'finalizacao', nome: 'Chute Colocado', gol: false, icone: '🎯', desc: 'Chutes com curva (traço curvo) no canto: erra menos e engana o goleiro.', descPlus: 'Colocado no ângulo: o chute curvo vira quase gol certo.' },
  { id: 'chute-de-longe', cat: 'finalizacao', nome: 'Super Chute', gol: false, icone: '💥', desc: 'Chute forte (traço rápido) e de longe: mais potência, o goleiro defende menos.', descPlus: 'Bomba: gols de fora da área com frequência.' },
  { id: 'cavadinha', cat: 'finalizacao', nome: 'Cavadinha', gol: false, icone: '🪂', desc: 'Traço curto e lento perto do gol vira cavadinha por cima do goleiro.', descPlus: 'Cavadinha de craque: o goleiro só olha.' },
  { id: 'cobranca-de-falta', cat: 'finalizacao', nome: 'Bola Parada', gol: false, icone: '🌀', desc: 'Bate faltas com curva e precisão. Libera o lance de falta.', descPlus: 'Especialista: faltas perigosas de qualquer distância.' },
  { id: 'cabeceio', cat: 'finalizacao', nome: 'Cabeçada Forte', gol: false, icone: '🗣️', desc: 'Ganha pelo alto: finaliza melhor de cabeça depois do cruzamento.', descPlus: 'Dominante no jogo aéreo, nos dois lados do campo.' },
  // Passe
  { id: 'passe-preciso', cat: 'passe', nome: 'Passe Preciso', gol: false, icone: '📐', desc: 'Passes curtos e médios mais certeiros.', descPlus: 'Raramente perde a bola no passe.' },
  { id: 'passe-tenso', cat: 'passe', nome: 'Passe Tenso', gol: false, icone: '➡️', desc: 'Passe rasteiro forte: chega antes do marcador cortar.', descPlus: 'Passe à queima-roupa que ninguém intercepta.' },
  { id: 'passe-em-profundidade', cat: 'passe', nome: 'Passe Incisivo', gol: false, icone: '🔑', desc: 'Enxerga o passe que quebra a linha: lançamentos no espaço melhores.', descPlus: 'Deixa o atacante na cara do gol.' },
  { id: 'lancamento', cat: 'passe', nome: 'Lançamento', gol: false, icone: '🏹', desc: 'Passe alto longo com precisão (2 toques).', descPlus: 'Lança de campo a campo no pé do companheiro.' },
  { id: 'tiki-taka', cat: 'passe', nome: 'Tiki-Taka', gol: false, icone: '🔁', desc: 'Toques curtos de primeira quase sem erro.', descPlus: 'Tabelinhas perfeitas: a bola não para.' },
  { id: 'cruzamento', cat: 'passe', nome: 'Cruzamento', gol: false, icone: '↪️', desc: 'Cruzamentos na medida para a área.', descPlus: 'Cruzamentos que viram gol com frequência.' },
  // Controle de bola
  { id: 'primeiro-toque', cat: 'controle', nome: 'Primeiro Toque', gol: false, icone: '🪶', desc: 'Domina bem e ganha tempo para a jogada.', descPlus: 'Domínio perfeito mesmo sob pressão.' },
  { id: 'drible-rapido', cat: 'controle', nome: 'Drible Rápido', gol: false, icone: '💨', desc: 'Vence o marcador no um contra um com mais facilidade.', descPlus: 'Quase impossível de parar no mano a mano.' },
  { id: 'firula', cat: 'controle', nome: 'Firula', gol: false, icone: '✨', desc: 'Dribles de efeito que deixam o marcador no chão.', descPlus: 'Humilha a defesa com a bola no pé.' },
  { id: 'tecnico', cat: 'controle', nome: 'Técnico', gol: false, icone: '🎩', desc: 'Conduz com a bola colada: perde menos e vai mais longe.', descPlus: 'A bola parece presa no pé.' },
  { id: 'resistente-pressao', cat: 'controle', nome: 'Resistente à Pressão', gol: false, icone: '🛡️', desc: 'Não perde a bola com marcador colado.', descPlus: 'Pressão alta não funciona contra ele.' },
  { id: 'velocista', cat: 'controle', nome: 'Velocista', gol: false, icone: '⚡', desc: 'Arranque forte, ótimo no contra-ataque.', descPlus: 'Ninguém alcança na corrida.' },
  // Defesa
  { id: 'desarme', cat: 'defesa', nome: 'Carrinho', gol: false, icone: '🦶', desc: 'Rouba a bola com mais frequência.', descPlus: 'Desarmes limpos e decisivos.' },
  { id: 'interceptacao', cat: 'defesa', nome: 'Interceptação', gol: false, icone: '✋', desc: 'Lê o jogo e corta passes.', descPlus: 'Antecipa quase todos os passes pelo seu setor.' },
  { id: 'antecipacao', cat: 'defesa', nome: 'Antecipação', gol: false, icone: '👁️', desc: 'Chega antes do atacante na bola.', descPlus: 'Rouba a bola antes do domínio.' },
  { id: 'contencao', cat: 'defesa', nome: 'Contenção', gol: false, icone: '🧲', desc: 'Acompanha o driblador sem dar o bote errado.', descPlus: 'Não passa ninguém por ele.' },
  { id: 'bloqueio', cat: 'defesa', nome: 'Bloqueio', gol: false, icone: '🧱', desc: 'Se joga na frente dos chutes.', descPlus: 'Bloqueia até chute à queima-roupa.' },
  // Físico
  { id: 'imposicao-fisica', cat: 'fisico', nome: 'Trombador', gol: false, icone: '💪', desc: 'Ganha as divididas no corpo.', descPlus: 'Parede: não perde disputa física.' },
  { id: 'acrobatico', cat: 'fisico', nome: 'Acrobático', gol: false, icone: '🤸', desc: 'Voleios e bicicletas: finaliza melhor de primeira.', descPlus: 'Gols de bicicleta viram rotina.' },
  { id: 'trivela', cat: 'fisico', nome: 'Trivela', gol: false, icone: '🔀', desc: 'Curva com o lado de fora do pé: mais efeito nos chutes e faltas.', descPlus: 'Trivela de mestre: a bola faz a curva impossível.' },
  { id: 'explosao', cat: 'fisico', nome: 'Explosão', gol: false, icone: '🔥', desc: 'Arrancada curta: conduz mais longe e escapa do bote.', descPlus: 'Some na frente do marcador em dois passos.' },
  { id: 'incansavel', cat: 'fisico', nome: 'Incansável', gol: false, icone: '🔋', desc: 'Cansa menos no segundo tempo.', descPlus: 'Joga os 90 minutos no mesmo ritmo.' },
  // Goleiro
  { id: 'reflexos', cat: 'goleiro', nome: 'Reflexos', gol: true, icone: '🧤', desc: 'Defesas difíceis à queima-roupa.', descPlus: 'Reflexos felinos: defende o indefensável.' },
  { id: 'saida-do-gol', cat: 'goleiro', nome: 'Saída do Gol', gol: true, icone: '🏃', desc: 'Sai bem nos cruzamentos e no um contra um.', descPlus: 'Domina a área inteira.' },
  { id: 'pegador-de-penalti', cat: 'goleiro', nome: 'Pegador de Pênalti', gol: true, icone: '🥅', desc: 'Adivinha o canto com mais frequência.', descPlus: 'Pesadelo dos cobradores.' },
  { id: 'reposicao-longa', cat: 'goleiro', nome: 'Reposição Longa', gol: true, icone: '🚀', desc: 'Lança o contra-ataque com a mão ou o pé.', descPlus: 'Reposição que vira assistência.' },
];
export const PS_BY_ID = new Map(PLAYSTYLES.map(p => [p.id, p]));
/** Overall mínimo para ter playstyle "+". */
export const PLUS_MIN_OVR = 80;
export const MAX_PLAYSTYLES = 6;

export const parsePs = (s: string): { id: string; plus: boolean } =>
  s.endsWith('+') ? { id: s.slice(0, -1), plus: true } : { id: s, plus: false };

export const slug = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
