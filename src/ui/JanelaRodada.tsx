/* Nova rodada / Editar rodada (pelada-v109: baixa só quando aberta, com o Campo de horário, para a gestão caber nos
   90 KB). Por fora, a mesma janela, com os mesmos ids (rdt, rtm, rfm, rpl) e o data-a saveRod. */
import { cfg } from '../dominio/caixa.js';
import { relogio12 } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-novarodada';
import { nextSat } from '../nucleo/util.js';
import { openDlg } from './dialogos.js';
import { HoraCampo } from './HoraCampo';

juntarTextos(textos);

const Cancelar = () => (
  <button class="btn" data-a="close">
    {tx('comum.cancelar')}
  </button>
);

export function rodDlg(r: any) {
  const c = cfg(),
    ini = tx('novaRodada.inicio'),
    fim = tx('novaRodada.termino'),
    doze = relogio12();
  openDlg(
    <>
      <h3>{tx(r ? 'novaRodada.editar' : 'novaRodada.titulo')}</h3>
      <div class="row">
        <label class="f" style="flex:1 1 100%">
          <span>{tx('novaRodada.data')}</span>
          <input class="inp" type="date" id="rdt" value={r?.date || nextSat()} />
        </label>
        <label class="f" style="width:auto">
          <span>{ini}</span>
          <span>
            <HoraCampo id="rtm" valor={r?.time || c.time} rotulo={ini} doze={doze} />
          </span>
        </label>
        <label class="f" style="width:auto">
          <span>{fim}</span>
          <span>
            <HoraCampo id="rfm" valor={r?.fim || ''} opcional rotulo={fim} doze={doze} />
          </span>
        </label>
      </div>
      <label class="f">
        <span>{tx('novaRodada.local')}</span>
        <input
          class="inp"
          id="rpl"
          value={r?.place ?? c.place}
          maxLength={200}
          placeholder={tx('novaRodada.localEx')}
        />
      </label>
      <p class="small muted">{tx('novaRodada.ajuda')}</p>
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="saveRod" data-v={r ? r.id : ''}>
          {tx(r ? 'comum.salvar' : 'novaRodada.criar')}
        </button>
      </div>
    </>
  );
}
