/* Telefone (WhatsApp) dos jogadores (KAN-156, KAN-162). Guardado no formato internacional (E.164):
   "+" + código do país + número, até 15 dígitos. Sem "+", vale o país do combo ao lado do campo (o do grupo, por padrão;
   Brasil se não houver). Com "+" (ou "00"), vale o código digitado. As regras de cada país ficam em dominio/paises.ts.
   O link do WhatsApp fica em dominio/contato.ts (o link do jogador usa e não precisa da tabela de países). */
import { PAISES, telefonePais, type Telefone } from './paises.ts';

export type { Telefone };

export function normalizarTelefone(texto: string, pais = 'BR'): Telefone {
  return telefonePais(texto, pais);
}

/* Mostra o telefone de um jeito fácil de ler: brasileiro como (11) 98765-4321, outros países como +351 912345678. */
export function telefoneParaLer(tel: string): string {
  const t = String(tel || '').trim();
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(t);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  if (!t.startsWith('+')) return t;
  const ddi = PAISES.map(p => p.ddi)
    .filter(d => t.startsWith('+' + d))
    .sort((a, b) => b.length - a.length)[0];
  return ddi ? '+' + ddi + ' ' + t.slice(1 + ddi.length) : t;
}

/* Número do campo, sem o código do país, como a pessoa costuma escrever: (11) 98765-4321 no Brasil. */
export function numeroParaCampo(numero: string, pais: string): string {
  const d = String(numero || '');
  if (pais === 'BR') {
    const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(d);
    if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  }
  return d;
}
