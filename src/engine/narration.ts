import { pick } from './rng';

const TX: Record<string, string[]> = {
  miss: ['{p} arrisca de fora da área e manda por cima.', '{p} finaliza cruzado, a bola passa raspando a trave.', '{p} sobe de cabeça, mas sem direção.', 'Chute fraco de {p}, a zaga afasta.', '{p} tenta a finta e bate torto.'],
  save: ['{p} chuta forte e {gk} espalma!', 'Defesaça de {gk} no chute de {p}!', '{p} bate colocado, {gk} segura firme.', '{gk} sai bem e abafa {p}.'],
  post: ['NA TRAVE! {p} quase marca!', '{p} acerta o travessão!'],
  goal: ['GOL! {p} desloca o goleiro e marca!', 'GOOOL! {p} bate no canto, sem chance para {gk}!', 'GOL! {p} aparece na área e empurra pro fundo da rede!', 'GOLAÇO de {p}! Bomba de fora da área!', 'GOL! {p} tira do goleiro com categoria!'],
  pen: ['PÊNALTI! Falta em {p} dentro da área.'],
  penGoal: ['{p} cobra com frieza. GOL!'], penMiss: ['{gk} defende o pênalti de {p}!', '{p} isola a cobrança!'],
  goalLong: ['GOLAÇO! {p} solta a bomba de fora da área e {gk} só olha!', 'De longe! {p} acerta um chutaço no ângulo!', 'GOL! {p} arrisca da intermediária e a bola morre na rede!'],
  goalHead: ['GOL DE CABEÇA! {p} sobe mais que todo mundo!', 'GOL! {p} testa firme e não dá chance para {gk}!', 'Cabeçada certeira de {p}. GOL!'],
  missLong: ['{p} tenta de longe, mas a bola sobe demais.', 'Chute de fora da área de {p}, sem perigo.'],
  missHead: ['{p} cabeceia por cima do gol.', '{p} sobe, mas a cabeçada sai fraca.'],
  saveHead: ['{p} cabeceia e {gk} faz grande defesa!', '{gk} sai do gol e tira a bola da cabeça de {p}.'],
  block: ['{d} se joga na frente e bloqueia o chute de {p}!', 'Bloqueio de {d} no chute de {p}.'],
  tackle: ['{d} dá um carrinho preciso e desarma {p}.', 'Desarme limpo de {d} em cima de {p}.', '{d} lê a jogada e rouba a bola de {p}.'],
  fk: ['Falta perigosa na entrada da área. {p} ajeita a bola…'],
  fkGoal: ['GOL DE FALTA! {p} bate com curva, por cima da barreira, no ângulo!', 'Que cobrança! {p} coloca a falta onde {gk} não alcança!'],
  fkSave: ['{p} cobra bem, mas {gk} voa e espalma!'],
  fkMiss: ['{p} cobra e a bola explode na barreira.', 'A falta de {p} passa por cima do gol.'],
  penSaved: ['{gk} adivinha o canto e defende o pênalti de {p}!'],
  yc: ['Amarelo para {p} por falta dura.', '{p} leva cartão amarelo por reclamação.'],
  rc: ['Segundo amarelo para {p}. Expulso!'], rc2: ['Vermelho direto! {p} está expulso.'],
};

export const tx = (k: keyof typeof TX, o: Record<string, string>): string =>
  pick(TX[k]).replace(/\{(\w+)\}/g, (_, x: string) => o[x] || '');
