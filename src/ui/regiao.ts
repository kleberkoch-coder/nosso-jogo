/* País, moeda e fuso na tela (KAN-162): nomes vindos do navegador no idioma do app, bandeiras e os combos
   usados no cadastro, em "Meu país", no formulário do grupo e no campo de telefone.
   As regras (tabela de países, telefone) ficam em dominio/paises.ts. */
import { MOEDAS, PAISES, detectarPais, paisPor } from '../dominio/paises.ts';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import CIDADES from '../i18n/cidades.ts';

const nomes = (tipo: 'region' | 'currency') => {
  try {
    return new Intl.DisplayNames([LOCAL], { type: tipo });
  } catch (e) {
    return null;
  }
};
let NP: Intl.DisplayNames | null | undefined, NM: Intl.DisplayNames | null | undefined;
export const nomePais = (iso: string) => {
  if (NP === undefined) NP = nomes('region');
  return (NP && NP.of(iso)) || iso;
};
export const nomeMoeda = (m: string) => {
  if (NM === undefined) NM = nomes('currency');
  return (NM && NM.of(m)) || m;
};
/* Bandeira em emoji. No Windows aparecem as duas letras (BR), que também identificam o país. */
export const bandeira = (iso: string) =>
  iso ? String.fromCodePoint(...[...iso].map(c => 127397 + c.charCodeAt(0))) : '';

export const fusoAparelho = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    return '';
  }
};
/* País sugerido pelo aparelho (celular ou computador): o fuso primeiro, porque o idioma do computador muitas vezes é inglês. */
export const paisAparelho = () =>
  detectarPais(fusoAparelho(), typeof navigator !== 'undefined' ? navigator.language : '');

/* País e formato da conta (gravados em usuarios/{uid}): o escolhido ao criar a conta ou, sem escolha, o do aparelho. */
export function contaRegiao(iso?: string) {
  const p = paisPor(iso) || paisPor(paisAparelho())!;
  return { pais: p.iso, formato: p.formato };
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
type Opcao = { v: string; t: string };
const ordenados = () => PAISES.map(p => ({ p, n: nomePais(p.iso) })).sort((a, b) => a.n.localeCompare(b.n, LOCAL));

/* Listas dos combos. País: "🇧🇷 Brasil". Telefone: "🇧🇷 +55 Brasil" (bandeira e código primeiro, porque o combo é
   estreito) e "Outro país". Moeda: "Real brasileiro (BRL)". */
export const listaPais = (): Opcao[] => ordenados().map(({ p, n }) => ({ v: p.iso, t: bandeira(p.iso) + ' ' + n }));
export const listaDdi = (): Opcao[] =>
  ordenados()
    .map(({ p, n }) => ({ v: p.iso, t: `${bandeira(p.iso)} +${p.ddi} ${n}` }))
    .concat({ v: '', t: tx('regiao.outroPais') });
export function listaMoeda(atual: string): Opcao[] {
  const lista = MOEDAS.includes(atual) ? MOEDAS : MOEDAS.concat(atual);
  return lista.map(m => ({ v: m, t: `${nomeMoeda(m)} (${m})` })).sort((a, b) => a.t.localeCompare(b.t, LOCAL));
}

/* Opções em texto, para os formulários montados como texto. */
export const opcoes = (lista: Opcao[], atual: string) =>
  lista.map(o => `<option value="${esc(o.v)}"${o.v === atual ? ' selected' : ''}>${esc(o.t)}</option>`).join('');
/* Troca as opções de um combo já na tela (sem montar HTML). */
export function preencher(sel: HTMLSelectElement, lista: Opcao[], atual: string) {
  sel.replaceChildren(...lista.map(o => new Option(o.t, o.v, false, o.v === atual)));
  sel.value = atual;
}
export const opcoesPais = (atual: string) => opcoes(listaPais(), atual);
export const opcoesDdi = (atual: string) => opcoes(listaDdi(), atual);
export const opcoesMoeda = (atual: string) => opcoes(listaMoeda(atual), atual);

/* Nome do fuso para o combo: a cidade e a diferença para o horário de Greenwich ("Manaus (GMT-4)"). */
export function nomeFuso(f: string): string {
  const cidade = (CIDADES as Record<string, string>)[f] || f.split('/').pop()!.replace(/_/g, ' ');
  try {
    const dif = new Intl.DateTimeFormat('en-US', { timeZone: f, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find(x => x.type === 'timeZoneName');
    return dif ? `${cidade} (${dif.value})` : cidade;
  } catch (e) {
    return cidade;
  }
}
export function listaFuso(iso: string, atual: string): Opcao[] {
  const p = paisPor(iso) || paisPor('BR')!;
  const lista = p.fusos.includes(atual) || !atual ? p.fusos : [atual].concat(p.fusos);
  return lista.map(f => ({ v: f, t: nomeFuso(f) }));
}
export const opcoesFuso = (iso: string, atual: string) => {
  const p = paisPor(iso) || paisPor('BR')!;
  return opcoes(listaFuso(iso, atual), atual || p.fusos[0]);
};
