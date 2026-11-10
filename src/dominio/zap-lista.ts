/* KAN-255 (pelada-v103): a mensagem da rodada no WhatsApp também mostra quem não vai, quem ainda não respondeu e o
   que falta para fechar o time, porque "no 👍 a galera se cobra mais" (retorno da turma em 09/11). Só nomes: nada de
   notas, tipo, caixa ou contato. Regra pura, testada em testes/regras/zap-lista.test.mjs; os textos vêm de quem chama. */
export type OpcoesLista = { naoVao: boolean; semResposta: boolean };
export const OPCOES_PADRAO: OpcoesLista = { naoVao: true, semResposta: true };

/* A escolha guardada no aparelho; qualquer coisa estranha volta ao padrão (as duas marcadas). */
export function lerOpcoes(texto: string | null): OpcoesLista {
  try {
    const o = texto ? JSON.parse(texto) : null;
    return o && typeof o === 'object'
      ? { naoVao: o.naoVao !== false, semResposta: o.semResposta !== false }
      : { ...OPCOES_PADRAO };
  } catch {
    return { ...OPCOES_PADRAO };
  }
}

/* O bloco que vai depois dos confirmados. Nomes em ordem alfabética, separados por vírgula. */
export function blocoLista(
  naoVao: string[],
  semResposta: string[],
  faltas: string[],
  op: OpcoesLista,
  t: { naoVao: (n: number) => string; semResposta: (n: number) => string },
  local = 'pt-BR'
): string {
  const ord = (l: string[]) =>
    l
      .slice()
      .sort((a, b) => a.localeCompare(b, local))
      .join(', ');
  let s = '';
  if (op.naoVao && naoVao.length) s += `\n\n❌ *${t.naoVao(naoVao.length)}*\n` + ord(naoVao);
  if (op.semResposta && semResposta.length) s += `\n\n⏳ *${t.semResposta(semResposta.length)}*\n` + ord(semResposta);
  if (faltas.length) s += '\n\n⚠️ ' + faltas.join(' · ');
  return s;
}
