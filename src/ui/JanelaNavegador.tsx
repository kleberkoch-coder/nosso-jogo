/* Janela "Abra no navegador" (KAN-218, v84): o Google não deixa entrar por dentro de apps como Instagram.
   Componente; antes era montada como texto em acoes/entrar.ts. Baixa junto com a tela de entrar. */
import { tx } from '../i18n/index.js';
import { openDlg } from './dialogos.js';
import { ComNegrito } from './componentes';

export function janelaNavegador() {
  openDlg(
    <>
      <h3>{tx('auth.abraNavTitulo')}</h3>
      <p>
        <ComNegrito texto={tx('auth.abraNavTexto')} />
      </p>
      <p class="small muted">
        <ComNegrito texto={tx('auth.abraNavDica')} />
      </p>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('auth.fechar')}
        </button>
        <button class="btn primary" data-a="copyHere">
          {tx('auth.copiarLink')}
        </button>
      </div>
    </>
  );
}
