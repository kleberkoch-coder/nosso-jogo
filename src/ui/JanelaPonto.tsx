/* Janela "Gol — Time 1" da Partida (KAN-218, v84): quem marcou, gol contra e "sem autor". Componente; antes era montada
   como texto em acoes/partida.js. Baixa junto com a Partida. */
import { sport } from '../dominio/esportes.js';
import { pname } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { openDlg } from './dialogos.js';

export function janelaPonto(o: { titulo: string; t: string; pts: number; atuais: string[]; contra: string[] | null }) {
  const botao = (id: string, og?: boolean) => (
    <button
      key={id}
      class="opt"
      data-a="addGoal"
      data-v={o.t}
      data-p={id}
      data-og={og ? '1' : undefined}
      data-pts={o.pts}
    >
      {pname(id)}
    </button>
  );
  openDlg(
    <>
      <h3>{o.titulo}</h3>
      <p class="small muted">{tx('partida.quemMarcou')}</p>
      <div class="vgrid">{o.atuais.map(id => botao(id))}</div>
      {o.contra ? (
        <>
          <p class="small muted" style="margin-top:14px">
            {tx('partida.contra')}
          </p>
          <div class="vgrid">{o.contra.map(id => botao(id, true))}</div>
        </>
      ) : null}
      <div class="dlg-f">
        <button class="btn" data-a="addGoal" data-v={o.t} data-pts={o.pts}>
          {tx('partida.semAutor')}
        </button>
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
      </div>
    </>
  );
}

/* "Gol", "Ponto": a palavra do catálogo, com maiúscula. */
export const unidade = () => {
  const u = String((sport() as { unit: string }).unit);
  return u.charAt(0).toUpperCase() + u.slice(1);
};
/* KAN-66 (pelada-v107): passo 2 da mesma janela, depois do autor: quem deu a assistência. "Sem assistência" vem
   primeiro e com o foco; o título é anunciado ao trocar de passo. O gol já está contado. */
export function janelaAssistencia(o: { i: number; autor: string; colegas: string[] }) {
  openDlg(
    <>
      <h3 id="astTitulo" aria-live="polite">
        {tx('partida.assistDe')}
      </h3>
      <p class="small muted">{tx('partida.assistDoGol', { ponto: unidade(), nome: pname(o.autor) })}</p>
      <div class="vgrid" id="astOpcoes">
        <button class="opt" data-a="addAssist" data-v={o.i} data-foco>
          {tx('partida.semAssist')}
        </button>
        {o.colegas.map(id => (
          <button key={id} class="opt" data-a="addAssist" data-v={o.i} data-p={id}>
            {pname(id)}
          </button>
        ))}
      </div>
    </>
  );
}
