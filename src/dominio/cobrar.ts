/* Cobrar quem ainda não respondeu (KAN-64). O jogador não tem conta nem app: a cobrança vai pelo WhatsApp,
   pelo aparelho do administrador (os telefones continuam visíveis só para administradores). */
export type Pres = Record<string, { s?: 'in' | 'out' } | undefined>;

/* Elenco ativo sem resposta nesta rodada, na ordem do elenco. */
export function semResposta(elenco: string[], pres: Pres): string[] {
  return elenco.filter(id => !(pres[id] && pres[id]!.s));
}

/* Link do WhatsApp com a mensagem pronta; sem telefone, nada. */
export function linkCobrar(linkWa: string, mensagem: string): string {
  return linkWa ? linkWa + '?text=' + encodeURIComponent(mensagem) : '';
}
