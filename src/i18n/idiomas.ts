/* Idiomas do app (KAN-164). Cada pessoa escolhe o seu no menu da conta (fica na conta e no aparelho); o link do
   jogador segue o idioma do celular. O português vem embutido; inglês e espanhol baixam em dois pedaços sob demanda:
   "base" (link, apresentação, entrar, convite, avaliação e catálogo) e "gestao" (o resto, só para quem administra).
   O idioma muda só os textos: moeda, formato das datas e fuso continuam os do grupo. */
import { definirLocal } from './formatos.js';
import { juntarIdioma } from './index.js';

export type Idioma = 'pt-BR' | 'en' | 'es';
export type Parte = 'base' | 'gestao';
export const IDIOMAS: { id: Idioma; nome: string }[] = [
  { id: 'pt-BR', nome: 'Português' },
  { id: 'en', nome: 'English' },
  { id: 'es', nome: 'Español' },
];
type Dic = { default: Record<string, string> };
const PEDACOS: Record<Exclude<Idioma, 'pt-BR'>, Record<Parte, () => Promise<Dic>>> = {
  en: { base: () => import('./en/base'), gestao: () => import('./en/gestao') },
  es: { base: () => import('./es/base'), gestao: () => import('./es/gestao') },
};
export const CHAVE_IDIOMA = 'nj-idioma';

/* "en-US" → "en"; "es-AR" → "es"; o resto → português. */
export function idiomaDe(codigo: string | null | undefined): Idioma {
  const c = String(codigo || '').toLowerCase();
  if (c === 'pt-br' || c.startsWith('pt')) return 'pt-BR';
  if (c.startsWith('en')) return 'en';
  if (c.startsWith('es')) return 'es';
  return 'pt-BR';
}
export const idiomaValido = (x: unknown): x is Idioma => x === 'pt-BR' || x === 'en' || x === 'es';

/* Idioma do aparelho: o escolhido antes neste aparelho; sem escolha, o do navegador (o primeiro que o app tem). */
export function idiomaInicial(): Idioma {
  try {
    const v = localStorage.getItem(CHAVE_IDIOMA);
    if (idiomaValido(v)) return v;
  } catch (e) {
    /* sem armazenamento */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
  for (const l of nav) {
    const c = String(l || '').toLowerCase();
    if (c.startsWith('pt') || c.startsWith('en') || c.startsWith('es')) return idiomaDe(c);
  }
  return 'pt-BR';
}

const pronto: Record<string, Promise<void>> = {};
/* Baixa (uma vez) a parte do idioma e passa a usá-lo. Sem internet e sem cópia, fica no português. */
export function carregarIdioma(id: Idioma, partes: Parte[]): Promise<void> {
  if (id === 'pt-BR') {
    definirLocal('pt-BR');
    return Promise.resolve();
  }
  return Promise.all(
    partes.map(
      p =>
        (pronto[id + p] =
          pronto[id + p] ||
          PEDACOS[id][p]()
            .then(m => juntarIdioma(id, m.default))
            .catch(e => {
              delete pronto[id + p];
              throw e;
            }))
    )
  ).then(() => definirLocal(id));
}
