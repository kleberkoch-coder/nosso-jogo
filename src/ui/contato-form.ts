/* Lê telefone e e-mail das janelas de jogador e avulso (KAN-156). Com erro, avisa, põe o cursor no campo e devolve null. */
import { emailValido, normalizarTelefone, telefoneParaLer } from '../dominio/contato';
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

const campo = (id: string) => document.getElementById(id) as HTMLInputElement | null;
function erro(id: string, msg: string) { toast(msg, 6000); const c = campo(id); if (c) { c.focus(); c.select(); } return null; }

export function lerContato(telId: string, mailId?: string): { tel: string; email: string } | null {
  const t = normalizarTelefone(campo(telId)?.value || '');
  if (!t.ok) return erro(telId, tx(t.erro === 'curto' ? 'contato.telCurto' : t.erro === 'longo' ? 'contato.telLongo' : 'contato.telInvalido'));
  const email = mailId ? (campo(mailId)?.value || '').trim() : '';
  if (mailId && !emailValido(email)) return erro(mailId, tx('contato.emailInvalido'));
  return { tel: t.valor, email };
}

/* Campo de telefone das janelas, com a dica para números de outro país. */
export function campoTelefone(valor: string, rotulo: string): string {
  const v = telefoneParaLer(valor).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  return `<label class="f"><span>${rotulo}</span><input class="inp" id="ptel" type="tel" inputmode="tel" autocomplete="tel" maxlength="22" value="${v}" placeholder="${tx('contato.telExemplo')}"><span class="small muted dica">${tx('contato.telDica')}</span></label>`;
}
