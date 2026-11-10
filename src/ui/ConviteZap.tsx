/* Janela "Mandar link no WhatsApp" da rodada (KAN-255, pelada-v103): a mensagem de sempre (data, local, link e
   confirmados) e, depois, quem não vai, quem ainda não respondeu e o que falta para fechar o time. Duas caixas de
   marcar tiram as listas; a escolha fica no aparelho. Regra em dominio/zap-lista.ts.
   Baixa só quando a janela é aberta (sob demanda), com os textos dela. As listas, a janela de compartilhar, o tx e o
   render vêm de quem chama (acoes/rodada.js): importar aqui qualquer pedaço do app faria o montador repartir o código
   do link e da gestão em mais arquivos (+0,5 KB no link e +0,8 KB na gestão, medido na v103). */
import type { ComponentType, ComponentChildren } from 'preact';
import { blocoLista, lerOpcoes, type OpcoesLista } from '../dominio/zap-lista';
import textos from '../i18n/pt-BR-zaplista';

/* Os textos desta parte: quem abre a janela junta ao dicionário (acoes/rodada.js). */
export { textos };

const CHAVE = 'nj-zap-lista';
/* A escolha também fica na memória, para valer mesmo sem armazenamento no aparelho (aba anônima). */
let mem: OpcoesLista | null = null;
const guardar = (o: OpcoesLista) => {
  mem = o;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(o));
  } catch {
    /* sem armazenamento: vale só agora */
  }
};
const ler = () => {
  if (mem) return mem;
  try {
    return lerOpcoes(localStorage.getItem(CHAVE));
  } catch {
    return lerOpcoes(null);
  }
};

export type Convite = {
  titulo: string;
  texto: string;
  naoVao: string[];
  sem: string[];
  faltas: string[];
  local: string;
  tx: (k: string, o?: Record<string, unknown>) => string;
  render: (v: unknown, el: HTMLElement) => void;
  Compartilhar: ComponentType<{ titulo: string; texto: string; opcoes?: ComponentChildren }>;
};

/* Sem hooks: marcar uma caixa guarda a escolha e desenha a janela de novo. */
function ConviteZap({ c, el }: { c: Convite; el: HTMLElement }) {
  const op = ler(),
    tx = c.tx;
  const muda = (k: keyof OpcoesLista) => (e: Event) => {
    guardar({ ...op, [k]: (e.currentTarget as HTMLInputElement).checked });
    mandarConvite(c, el);
  };
  const texto =
    c.texto +
    blocoLista(
      c.naoVao,
      c.sem,
      c.faltas,
      op,
      { naoVao: n => tx('zaplista.naoVao', { n }), semResposta: n => tx('zaplista.semResposta', { n }) },
      c.local
    );
  const opcoes =
    c.naoVao.length || c.sem.length ? (
      <fieldset class="chk-lista zap-lista">
        <legend class="lbl">{tx('zaplista.incluirTitulo')}</legend>
        {c.naoVao.length ? (
          <label class="chk-linha">
            <input type="checkbox" id="zapNaoVao" checked={op.naoVao} onChange={muda('naoVao')} />
            <span>{tx('zaplista.incluirNaoVao', { n: c.naoVao.length })}</span>
          </label>
        ) : null}
        {c.sem.length ? (
          <label class="chk-linha">
            <input type="checkbox" id="zapSemResposta" checked={op.semResposta} onChange={muda('semResposta')} />
            <span>{tx('zaplista.incluirSemResposta', { n: c.sem.length })}</span>
          </label>
        ) : null}
      </fieldset>
    ) : null;
  const C = c.Compartilhar;
  return <C titulo={c.titulo} texto={texto} opcoes={opcoes} />;
}

export function mandarConvite(c: Convite, el: HTMLElement | null) {
  if (el) c.render(<ConviteZap c={c} el={el} />, el);
}
