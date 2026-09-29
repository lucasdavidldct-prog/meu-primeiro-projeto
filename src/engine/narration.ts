import { pick } from './rng';

const TX: Record<string, string[]> = {
  miss: ['{p} arrisca de fora da área e manda por cima.', '{p} finaliza cruzado, a bola passa raspando a trave.', '{p} sobe de cabeça, mas sem direção.', 'Chute fraco de {p}, a zaga afasta.', '{p} tenta a finta e bate torto.'],
  save: ['{p} chuta forte e {gk} espalma!', 'Defesaça de {gk} no chute de {p}!', '{p} bate colocado, {gk} segura firme.', '{gk} sai bem e abafa {p}.'],
  post: ['NA TRAVE! {p} quase marca!', '{p} acerta o travessão!'],
  goal: ['GOL! {p} desloca o goleiro e marca!', 'GOOOL! {p} bate no canto, sem chance para {gk}!', 'GOL! {p} aparece na área e empurra pro fundo da rede!', 'GOLAÇO de {p}! Bomba de fora da área!', 'GOL! {p} tira do goleiro com categoria!'],
  pen: ['PÊNALTI! Falta em {p} dentro da área.'],
  penGoal: ['{p} cobra com frieza. GOL!'], penMiss: ['{gk} defende o pênalti de {p}!', '{p} isola a cobrança!'],
  yc: ['Amarelo para {p} por falta dura.', '{p} leva cartão amarelo por reclamação.'],
  rc: ['Segundo amarelo para {p}. Expulso!'], rc2: ['Vermelho direto! {p} está expulso.'],
};

export const tx = (k: keyof typeof TX, o: Record<string, string>): string =>
  pick(TX[k]).replace(/\{(\w+)\}/g, (_, x: string) => o[x] || '');
