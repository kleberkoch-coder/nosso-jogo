/* Contato dos jogadores (KAN-156): link do WhatsApp e e-mail. O telefone (com a regra de cada país) fica em
   dominio/telefone.ts, para o link do jogador não baixar a tabela de países (KAN-162). */

/* Link do WhatsApp. Aceita também os números gravados antes da v44 (sem "+": brasileiros). */
export function linkWhatsApp(tel: string): string {
  const t = String(tel || '').trim();
  let d = t.replace(/\D/g, '');
  if (!d) return '';
  if (!t.startsWith('+') && d.length <= 11) d = '55' + d;
  return 'https://wa.me/' + d;
}

/* E-mail: um nome, "@", um domínio e uma terminação de pelo menos 2 letras (ex.: ana@clube.com.br). */
export function emailValido(texto: string): boolean {
  const t = String(texto || '').trim();
  if (!t) return true;
  return t.length <= 100 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(t);
}
