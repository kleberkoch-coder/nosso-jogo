/* Janela "Gol — Time 1" da Partida (KAN-218, v84): quem marcou, gol contra e "sem autor". Componente; antes era montada
   como texto em acoes/partida.js. Baixa junto com a Partida. */
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
