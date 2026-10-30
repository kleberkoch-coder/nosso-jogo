/* Janela "Importar jogadores" (KAN-159): colar da planilha ou enviar .xlsx/.csv, com prévia antes de salvar.
   Quem grava é a ação "importarJogadores" (acoes/jogadores.js), que lê a prévia daqui. */
import estilo from '../estilos/importar.css' with { type: 'text' };
import { usarEstilo } from './estilo';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { posLabel, sport } from '../dominio/esportes.js';
import { fmtL, normName } from '../dominio/grupo.js';
import { excedentes, interpretar, LIMITE_IMPORTACAO, type Item } from '../dominio/planilha.ts';
import { telefoneParaLer } from '../dominio/telefone.ts';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import textosImportar from '../i18n/pt-BR-importar';
import { S as estado } from '../nucleo/estado.js';
import { PAIS } from '../i18n/formatos.js';
import { ErroPlanilha, lerArquivo } from './arquivo-planilha.ts';
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textosImportar);
import { lerTexto } from '../dominio/planilha.ts';
usarEstilo('importar', estilo);

const st = (): any => estado;
let previa: Item[] = [];
/* Os jogadores que a ação vai gravar: só os novos (os que já existem ou se repetem ficam de fora). */
export const paraImportar = () => previa.filter(i => i.situacao === 'novo');

function Linha({ it }: { it: Item }) {
  const fora = it.situacao !== 'novo';
  const partes = [
    it.pos ? posLabel(it.pos) : '',
    it.nota != null ? tx('importar.nota', { n: fmtL(it.nota) }) : '',
    tx('tipo.' + it.tipo),
    it.tel ? telefoneParaLer(it.tel) : '',
    it.email || '',
  ].filter(Boolean);
  return (
    <li class={fora ? 'imp-fora' : ''}>
      <span class={'imp-ic' + (!fora && it.avisos.length ? ' imp-alerta' : '')} aria-hidden="true">
        {fora ? '↺' : it.avisos.length ? '⚠' : '✓'}
      </span>
      <span class="pn">
        <b>{it.nome}</b>
        {fora ? (
          <>
            {' '}
            <span class="tag">· {tx(it.situacao === 'existe' ? 'importar.existe' : 'importar.repetido')}</span>
          </>
        ) : null}
        <br />
        <span class="tag">{partes.join(' · ')}</span>
        {it.avisos.length ? (
          <span class="small imp-aviso">
            <br />
            {it.avisos.map(a => tx('importar.aviso.' + a)).join(' ')}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function Importar() {
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [arquivo, setArquivo] = useState('');
  const [erro, setErro] = useState('');
  const S = st();
  const ctx = {
    posicoes: (sport() as unknown as { pos: [string, string][] }).pos,
    existentes: new Set(Object.values(S.jog || {}).map((p: any) => normName(p.name) as string)),
    normalizar: (n: string) => normName(n) as string,
    pais: PAIS,
  };
  const { itens, semNome } = interpretar(linhas, ctx);
  previa = itens;
  const novos = itens.filter(i => i.situacao === 'novo').length,
    fora = itens.length - novos,
    comAviso = itens.filter(i => i.situacao === 'novo' && i.avisos.length).length,
    alem = excedentes(linhas);
  const colar = (t: string) => {
    setArquivo('');
    setErro('');
    setLinhas(lerTexto(t));
  };
  const escolher = async (e: Event) => {
    const input = e.target as HTMLInputElement,
      arq = input.files && input.files[0];
    if (!arq) return;
    setErro('');
    try {
      setLinhas(await lerArquivo(arq));
      setArquivo(arq.name);
    } catch (x) {
      setLinhas([]);
      setArquivo('');
      setErro(
        tx(x instanceof ErroPlanilha && x.message === 'navegador' ? 'importar.erroNavegador' : 'importar.erroArquivo')
      );
    }
    input.value = '';
  };
  return (
    <>
      <h3>{tx('importar.titulo')}</h3>
      <p class="small muted" style="margin-top:-4px">
        {tx('importar.ajuda')}
      </p>
      <label class="f">
        <span>{tx('importar.colar')}</span>
        <textarea
          class="inp"
          id="impTexto"
          rows={5}
          placeholder={tx('importar.exemplo')}
          onInput={e => colar((e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </label>
      <div class="row imp-arquivo">
        <label class="btn sm" for="impArq">
          {tx('importar.escolherArquivo')}
        </label>
        <input type="file" id="impArq" accept=".xlsx,.csv,text/csv" hidden onChange={escolher} />
        <span class="small muted">{arquivo || tx('importar.formatos')}</span>
      </div>
      {erro ? (
        <p class="err" role="alert">
          {erro}
        </p>
      ) : null}
      {itens.length ? (
        <div class="imp-previa" aria-live="polite">
          <p class="small" id="impResumo">
            <b>{tp('importar.novos', novos)}</b>
            {fora ? ' · ' + tp('importar.fora', fora) : ''}
            {comAviso ? ' · ' + tp('importar.comAviso', comAviso) : ''}
            {semNome ? ' · ' + tp('importar.semNome', semNome) : ''}
          </p>
          {alem ? <p class="small imp-aviso">{tx('importar.limite', { n: LIMITE_IMPORTACAO, mais: alem })}</p> : null}
          <ul class="plist" id="impLista">
            {itens.map(it => (
              <Linha key={it.linha} it={it} />
            ))}
          </ul>
        </div>
      ) : null}
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="importarJogadores" disabled={!novos}>
          {novos ? tp('importar.botao', novos) : tx('importar.botaoVazio')}
        </button>
      </div>
    </>
  );
}

/* Desenha a janela dentro do lugar reservado pela ação que a abriu. */
export function montarImportar(el: HTMLElement) {
  previa = [];
  render(<Importar />, el);
}
