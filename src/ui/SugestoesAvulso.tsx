/* "Já jogou aqui? Toque no seu nome": avulsos já cadastrados que parecem com o nome digitado na janela
   "Adicionar meu nome" do link (eventos.js). Componente desde a v84 (KAN-218), antes era HTML em texto. */
import { render } from 'preact';
import { tx } from '../i18n/index.js';
import { Pos } from './componentes';

function Sugestoes({ lista }: { lista: [string, { nome: string }][] }) {
  if (!lista.length) return null;
  return (
    <>
      <p class="small muted" style="margin:-4px 0 6px">
        {tx('publico.jaJogou')}
      </p>
      <div class="vgrid" style="margin-bottom:12px">
        {lista.map(([id, a]) => (
          <button key={id} class="opt" data-a="pubPick" data-p={id}>
            <Pos id={id} />
            <span>{a.nome}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function mostrarSugestoes(onde: HTMLElement, lista: [string, { nome: string }][]) {
  render(<Sugestoes lista={lista} />, onde);
}
