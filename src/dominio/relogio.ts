/* Relógio de 12 ou 24 horas e primeiro dia da semana conforme o país do grupo (KAN-163).
   O horário continua gravado em 24h ("20:00"); só a exibição e o campo de horário mudam.
   Se o país usa 12h, vem do formato do grupo (Intl, em i18n/formatos.js); aqui ficam as contas, sem tela.
   Testada em testes/regras/relogio.test.mjs. */
export type Periodo = { am: string; pm: string };

/* "20:05" → [20, 5]; texto fora do formato → null. */
export function partes(v: string | undefined | null): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  if (!m) return null;
  const h = +m[1],
    mi = +m[2];
  return h < 24 && mi < 60 ? [h, mi] : null;
}

/* Hora de 0 a 23 → hora do relógio de 12h (1 a 12) e se é da tarde. Meia-noite = 12 AM; meio-dia = 12 PM. */
export function para12(h: number): { h: number; pm: boolean } {
  return { h: h % 12 || 12, pm: h >= 12 };
}

/* Hora do relógio de 12h (1 a 12) com AM/PM → hora de 0 a 23. */
export function para24(h12: number, pm: boolean): number {
  return (h12 % 12) + (pm ? 12 : 0);
}

const dois = (n: number) => String(n).padStart(2, '0');

/* Horário para mostrar: "20:00" (24h) ou "8:00 PM" (12h). Sem período, quando a faixa já mostra no fim. */
export function mostrarHora(v: string, doze: boolean, p: Periodo, comPeriodo = true): string {
  const x = partes(v);
  if (!x || !doze) return v || '';
  const t = para12(x[0]);
  return t.h + ':' + dois(x[1]) + (comPeriodo ? ' ' + (t.pm ? p.pm : p.am) : '');
}

/* Início e término: "20:00–22:00", "7:00–9:00 PM" (mesmo período) ou "11:00 PM–1:00 AM" (jogo que passa da meia-noite). */
export function faixa(ini: string, fim: string | undefined, doze: boolean, p: Periodo): string {
  if (!ini) return '';
  if (!fim) return mostrarHora(ini, doze, p);
  const a = partes(ini),
    b = partes(fim),
    mesmo = !!(a && b) && a[0] >= 12 === b[0] >= 12 && fim >= ini;
  return mostrarHora(ini, doze, p, !mesmo) + '–' + mostrarHora(fim, doze, p);
}

/* Países em que a semana começa no domingo (padrão internacional CLDR, o mesmo dos navegadores).
   Fica numa lista porque nem todo navegador informa isso (o Firefox não). Nos outros, começa na segunda. */
const DOMINGO = 'BR US CA MX PT MZ CO PE PY VE PA GT DO ZA IL IN JP'.split(' ');

/* Ordem dos dias da semana (0 = domingo … 6 = sábado) nas listas, conforme o país. */
export function ordemDias(pais: string | undefined): number[] {
  return DOMINGO.includes(pais || 'BR') ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
}
