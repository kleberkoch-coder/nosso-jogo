/* Lê telefone e e-mail das janelas de jogador e avulso (KAN-156). Com erro, avisa, põe o cursor no campo e devolve null.
   Desde a KAN-162, o telefone tem um combo de país ao lado, que já vem com o país do grupo. */
import { emailValido } from '../dominio/contato';
import { normalizarTelefone } from '../dominio/telefone.ts';
import { paisPor } from '../dominio/paises.ts';
import { PAIS } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';
import { nomePais } from './regiao.ts';

const campo = (id: string) => document.getElementById(id) as HTMLInputElement | null;
function erro(id: string, msg: string) {
  toast(msg, 6000);
  const c = campo(id);
  if (c) {
    c.focus();
    c.select();
  }
  return null;
}
const digitos = (iso: string) => {
  const p = paisPor(iso);
  return !p ? '' : p.min === p.max ? String(p.min) : p.min + '–' + p.max;
};
function msgTelefone(e: string, iso: string) {
  if (e === 'semPais') return tx('contato.telSemPais');
  if (iso === 'BR' || !paisPor(iso) || e === 'invalido')
    return tx(e === 'curto' ? 'contato.telCurto' : e === 'longo' ? 'contato.telLongo' : 'contato.telInvalido');
  return tx(e === 'curto' ? 'contato.telCurtoPais' : 'contato.telLongoPais', {
    pais: nomePais(iso),
    n: digitos(iso),
  });
}

export function lerContato(telId: string, mailId?: string): { tel: string; email: string } | null {
  const pais = (document.getElementById('ppais') as HTMLSelectElement | null)?.value ?? PAIS;
  const t = normalizarTelefone(campo(telId)?.value || '', pais);
  if (!t.ok) return erro(telId, msgTelefone(t.erro, pais));
  const email = mailId ? (campo(mailId)?.value || '').trim() : '';
  if (mailId && !emailValido(email)) return erro(mailId, tx('contato.emailInvalido'));
  return { tel: t.valor, email };
}

/* Exemplo dentro do campo: o número brasileiro de sempre ou quantos dígitos tem o número no país escolhido. */
export const exemploTelefone = (iso: string) =>
  iso === 'BR'
    ? tx('contato.telExemplo')
    : paisPor(iso)
      ? tx('contato.telExemploPais', { n: digitos(iso) })
      : tx('contato.telExemploOutro');

/* Trocou o país do telefone: o exemplo do campo acompanha. */
export function trocarPaisTelefone() {
  const s = document.getElementById('ppais') as HTMLSelectElement | null,
    c = campo('ptel');
  if (s && c) c.placeholder = exemploTelefone(s.value);
}
