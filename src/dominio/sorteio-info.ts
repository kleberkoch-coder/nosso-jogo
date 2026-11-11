/* Hora e número do sorteio (KAN-246, pelada-v109). Regra pura, com teste em testes/regras/sorteio-info.test.mjs.
   Cada sorteio grava na rodada sor = {n, em, aj}: n sobe de 1 em 1 a cada "Sortear" (e zera aj), em é a hora do
   sorteio no aparelho (a hora do toque, mesmo que a gravação vá depois, sem sinal) e aj conta os ajustes manuais
   depois do sorteio (mover, pôr no time, tirar do time), sem dizer quem. As regras do Firebase só aceitam o n subindo
   de 1 em 1 ou o aj subindo de 1 em 1 (com o mesmo n e a mesma hora). */
export type Sorteio = { n: number; em: number; aj?: number };

export function novoSorteio(antes: Partial<Sorteio> | null | undefined, agora: number): Sorteio {
  return { n: ((antes && antes.n) || 0) + 1, em: agora, aj: 0 };
}

/* Ajuste manual depois do sorteio: só conta se a rodada já tem sorteio registrado. */
export function comAjuste(s: Partial<Sorteio> | null | undefined): Sorteio | null {
  if (!s || !s.n || typeof s.em !== 'number') return null;
  return { n: s.n, em: s.em, aj: (s.aj || 0) + 1 };
}

/* "19:42" no fuso do grupo (vazio: o relógio do aparelho). */
export function horaDoSorteio(em: number, fuso?: string): string {
  const f = (tz?: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(em)
    );
  try {
    return f(fuso || undefined);
  } catch (e) {
    return f(undefined);
  }
}

/* Sorteio que vale mostrar: com número e hora. Rodadas de antes da pelada-v109 não têm. */
export const sorteioValido = (s: unknown): s is Sorteio =>
  !!s && typeof (s as Sorteio).n === 'number' && (s as Sorteio).n > 0 && typeof (s as Sorteio).em === 'number';
