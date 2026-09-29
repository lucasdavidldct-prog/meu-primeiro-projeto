import type { FormationId, Pos, Role, SlotDef } from './types';

export const POSS: Pos[] = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'MD', 'ME', 'PD', 'PE', 'ATA'];

export const POS_ALT: Record<Pos, Pos[]> = {
  GOL: [], ZAG: ['VOL', 'LD', 'LE'], LD: ['MD', 'ZAG'], LE: ['ME', 'ZAG'], VOL: ['MC', 'ZAG'], MC: ['VOL', 'MEI'],
  MEI: ['MC', 'ATA'], MD: ['PD', 'LD'], ME: ['PE', 'LE'], PD: ['MD', 'ATA'], PE: ['ME', 'ATA'], ATA: ['MEI', 'PD', 'PE'],
};

/** Peso de cada atributo por posição: RIT FIN PAS DRI DEF FIS. */
export const PROFILE: Record<Pos, number[]> = {
  ATA: [.85, 1.1, .72, .95, .3, .9], PD: [1.1, .85, .85, 1.05, .35, .7], PE: [1.1, .85, .85, 1.05, .35, .7], MEI: [.8, .85, 1.1, 1.05, .4, .65],
  MC: [.75, .72, 1.05, .95, .75, .85], VOL: [.7, .55, .92, .8, 1.05, 1.02], MD: [1.05, .72, .95, .97, .55, .75], ME: [1.05, .72, .95, .97, .55, .75],
  LD: [1.0, .45, .85, .85, .97, .85], LE: [1.0, .45, .85, .85, .97, .85], ZAG: [.65, .35, .7, .6, 1.12, 1.06], GOL: [1.02, 1, .8, 1.06, .55, 1],
};

export const ROLE = (p: Pos): Role =>
  p === 'GOL' ? 'G' : (p === 'ZAG' || p === 'LD' || p === 'LE') ? 'D' : (p === 'ATA' || p === 'PD' || p === 'PE') ? 'A' : 'M';

export const STAT_L = ['RIT', 'FIN', 'PAS', 'DRI', 'DEF', 'FIS'];
export const STAT_G = ['MER', 'MAN', 'CHU', 'REF', 'VEL', 'POS'];

export const FORMS: Record<FormationId, [Pos, number, number][]> = {
  '4-3-3': [['GOL', 50, 6], ['LE', 14, 27], ['ZAG', 37, 21], ['ZAG', 63, 21], ['LD', 86, 27], ['MC', 28, 50], ['VOL', 50, 43], ['MC', 72, 50], ['PE', 17, 76], ['ATA', 50, 83], ['PD', 83, 76]],
  '4-4-2': [['GOL', 50, 6], ['LE', 14, 27], ['ZAG', 37, 21], ['ZAG', 63, 21], ['LD', 86, 27], ['ME', 13, 53], ['MC', 38, 47], ['MC', 62, 47], ['MD', 87, 53], ['ATA', 37, 81], ['ATA', 63, 81]],
  '4-2-3-1': [['GOL', 50, 6], ['LE', 14, 27], ['ZAG', 37, 21], ['ZAG', 63, 21], ['LD', 86, 27], ['VOL', 36, 43], ['VOL', 64, 43], ['PE', 16, 65], ['MEI', 50, 62], ['PD', 84, 65], ['ATA', 50, 84]],
  '4-1-2-1-2': [['GOL', 50, 6], ['LE', 14, 27], ['ZAG', 37, 21], ['ZAG', 63, 21], ['LD', 86, 27], ['VOL', 50, 40], ['MC', 25, 51], ['MC', 75, 51], ['MEI', 50, 62], ['ATA', 36, 82], ['ATA', 64, 82]],
  '3-5-2': [['GOL', 50, 6], ['ZAG', 26, 22], ['ZAG', 50, 19], ['ZAG', 74, 22], ['ME', 10, 52], ['MC', 33, 45], ['MC', 67, 45], ['MD', 90, 52], ['MEI', 50, 60], ['ATA', 36, 82], ['ATA', 64, 82]],
  '3-4-3': [['GOL', 50, 6], ['ZAG', 26, 22], ['ZAG', 50, 19], ['ZAG', 74, 22], ['ME', 12, 49], ['MC', 37, 45], ['MC', 63, 45], ['MD', 88, 49], ['PE', 17, 75], ['ATA', 50, 83], ['PD', 83, 75]],
  '5-3-2': [['GOL', 50, 6], ['LE', 9, 33], ['ZAG', 29, 21], ['ZAG', 50, 19], ['ZAG', 71, 21], ['LD', 91, 33], ['MC', 27, 51], ['VOL', 50, 45], ['MC', 73, 51], ['ATA', 37, 81], ['ATA', 63, 81]],
};
export const FORM_IDS = Object.keys(FORMS) as FormationId[];
export const slotsOf = (f: FormationId): SlotDef[] => FORMS[f].map(([p, x, y]) => ({ p, x, y }));
