/* Telefone (WhatsApp) e e-mail dos jogadores (KAN-156).
   O telefone é guardado no formato internacional (E.164): "+" + código do país + número, até 15 dígitos.
   Sem "+", o número é tratado como brasileiro (DDD + número). Com "+" (ou "00"), vale qualquer país. */

export type Telefone = { ok: true; valor: string } | { ok: false; erro: 'invalido' | 'curto' | 'longo' };

export function normalizarTelefone(texto: string): Telefone {
  const t = String(texto || '').trim();
  if (!t) return { ok: true, valor: '' };
  if (/[^\d\s()+.\-]/.test(t)) return { ok: false, erro: 'invalido' };
  const internacional = t.startsWith('+') || t.startsWith('00');
  let d = t.replace(/\D/g, '');
  if (internacional) {
    if (t.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) return { ok: false, erro: 'invalido' };
    if (d.length < 8) return { ok: false, erro: 'curto' };
    if (d.length > 15) return { ok: false, erro: 'longo' };
    return { ok: true, valor: '+' + d };
  }
  // Brasil: DDD (11 a 99) + número de 8 ou 9 dígitos; aceita também quem já digitou o 55 sem o "+".
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return { ok: false, erro: 'curto' };
  if (d.length > 11) return { ok: false, erro: 'longo' };
  if (d[0] === '0') return { ok: false, erro: 'invalido' };
  return { ok: true, valor: '+55' + d };
}

/* Link do WhatsApp. Aceita também os números gravados antes da v44 (sem "+": brasileiros). */
export function linkWhatsApp(tel: string): string {
  const t = String(tel || '').trim();
  let d = t.replace(/\D/g, '');
  if (!d) return '';
  if (!t.startsWith('+') && d.length <= 11) d = '55' + d;
  return 'https://wa.me/' + d;
}

/* Mostra o telefone de um jeito fácil de ler: brasileiro como (11) 98765-4321, outros países como +351 912345678. */
export function telefoneParaLer(tel: string): string {
  const t = String(tel || '').trim();
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(t);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  return t;
}

/* E-mail: um nome, "@", um domínio e uma terminação de pelo menos 2 letras (ex.: ana@clube.com.br). */
export function emailValido(texto: string): boolean {
  const t = String(texto || '').trim();
  if (!t) return true;
  return t.length <= 100 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(t);
}
