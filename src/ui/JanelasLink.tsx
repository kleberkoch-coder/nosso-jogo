/* Janelas do link do jogador (KAN-218, v84): "Adicionar meu nome" e "Instalar no celular". Componentes; antes eram
   montadas como texto (acoes/publico.ts e pwa.js). Os mesmos ids e data-a de antes.
   KAN-262 (pelada-v106): parte sob demanda, com os próprios textos. O link abre sem ela; o service worker a guarda na
   primeira visita (PARTES_LINK em site/sw.js), para abrir também sem internet. */
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-janelaslink';
import { openDlg } from './dialogos.js';
import { CampoPosicao, ComNegrito } from './componentes';

juntarTextos(textos);

export function janelaMeuNome(nome: string) {
  openDlg(
    <>
      <h3>{tx('publico.addTitulo')}</h3>
      <label class="f">
        <span>{tx('publico.addNome')}</span>
        <input class="inp" id="anm" maxLength={40} autocomplete="off" value={nome} />
      </label>
      <div id="avsug"></div>
      <div id="avnew">
        <CampoPosicao id="apos" />
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="pubSaveAdd">
          {tx('publico.addConfirmar')}
        </button>
      </div>
    </>
  );
}

export function janelaInstalar(ios: boolean) {
  const passos = ios ? ['pwa.ios1', 'pwa.ios2', 'pwa.ios3'] : ['pwa.and1', 'pwa.and2'];
  openDlg(
    <>
      <h3>{tx('pwa.titulo')}</h3>
      <ol class="small" style="padding-left:18px;line-height:1.8">
        {passos.map(k => (
          <li key={k}>
            <ComNegrito texto={tx(k)} />
          </li>
        ))}
      </ol>
      <p class="small muted">{tx('pwa.icone')}</p>
      <div class="dlg-f">
        <button class="btn primary" data-a="close">
          {tx('comum.entendi')}
        </button>
      </div>
    </>
  );
}
