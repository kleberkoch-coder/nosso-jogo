/* Janela de compartilhar no WhatsApp (KAN-131: virou componente; antes, HTML montado como texto em dominio/whatsapp.js).
   A caixa de texto tem rótulo para o leitor de tela. Os botões usam data-a (close, copy; copiar fica em acoes/conta.js). */
import { render } from 'preact';
import { tx } from '../i18n/index.js';
import { dlg, openDlg } from './dialogos.js';

function Compartilhar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <h3 id="shTitulo">{titulo}</h3>
      <label class="f">
        <span>{tx('compartilhar.rotulo')}</span>
        <textarea class="inp" id="shtxt" value={texto}></textarea>
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('compartilhar.fechar')}
        </button>
        <button class="btn" data-a="copy">
          {tx('compartilhar.copiar')}
        </button>
        <a class="btn primary" target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(texto)}>
          {tx('compartilhar.whatsapp')}
        </a>
      </div>
    </>
  );
}

export function shareDlg(titulo: string, texto: string) {
  openDlg('<div id="shRaiz"></div>');
  dlg.setAttribute('aria-labelledby', 'shTitulo');
  const el = document.getElementById('shRaiz');
  if (el) render(<Compartilhar titulo={titulo} texto={texto} />, el);
}
