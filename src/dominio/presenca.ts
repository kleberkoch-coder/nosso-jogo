/* Resposta de presença: o que grava quando alguém marca Vou ou Não vou (KAN-262, pelada-v106: a regra saiu de
   nucleo/edicoes para ter teste próprio). As regras do Firebase conferem o mesmo (firestore.rules).
   - KAN-78: a ordem da lista é a hora em que a pessoa confirmou; só muda quando a resposta muda, e nunca volta.
   - Pelo link, o nome, a marca de avulso e a posição ficam como estavam.
   - dev: o aparelho que respondeu primeiro pelo link (administrador não vira dono da resposta).
   - KAN-89: avulso novo pelo link soma 1 no contador de avulsos da rodada.
   - KAN-63: com o controle de vagas ligado, quem precisa de vaga e entra soma 1; quem sai devolve (nunca abaixo de 0). */
import { contaComoAvulso } from './limites.ts';
import { movimento, precisaVaga } from './vagas.ts';

export type Presenca = {
  s: string;
  t?: number;
  by?: string;
  dev?: string;
  nome?: string;
  avulso?: boolean;
  pos?: string;
  [k: string]: unknown;
};
export type Contexto = {
  /* Resposta que já está gravada (ou null). */
  atual: Presenca | null;
  /* Quem grava (uid deste aparelho). */
  eu: string;
  admin: boolean;
  /* O jogador está no elenco (e a marca de vaga dele, se tiver). */
  jogador: { vaga?: boolean } | null | undefined;
  vagasCtrl: boolean;
  /* Quantos entraram pelas vagas abertas até agora. */
  vagasOcupadas: number;
  agora: number;
};
export type Gravacao = {
  pres: Presenca;
  /* +1 no contador de avulsos da rodada. */
  avulsoNovo: boolean;
  /* Quanto mexe no contador de vagas (+1, -1 ou 0). */
  vaga: number;
};

export function respostaDePresenca(dados: Partial<Presenca> & { s: string }, c: Contexto): Gravacao {
  const cur = c.atual;
  const d: Presenca = Object.assign({ t: c.agora }, dados, { by: c.eu });
  delete d.dev;
  if (cur) {
    if (cur.s === d.s && cur.t != null) d.t = cur.t;
    else if (cur.t != null && (d.t as number) < cur.t) d.t = cur.t;
    if (!c.admin)
      (['nome', 'avulso', 'pos'] as const).forEach(k => {
        if (k in cur) (d as Record<string, unknown>)[k] = cur[k];
        else delete d[k];
      });
  }
  const dev = (cur && cur.dev) || (c.admin ? null : c.eu);
  if (dev) d.dev = dev;
  const avulsoNovo = contaComoAvulso({ admin: c.admin, jogador: !!c.jogador, jaNaLista: !!cur });
  const mov = !c.admin && c.vagasCtrl && precisaVaga(c.jogador) ? movimento(cur ? cur.s : undefined, d.s) : 0;
  const vaga = mov > 0 || (mov < 0 && c.vagasOcupadas > 0) ? mov : 0;
  return { pres: d, avulsoNovo, vaga };
}
