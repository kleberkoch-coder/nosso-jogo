/* Janelas "Mínimo e vagas" e "Abrir vagas" da aba Rodada (KAN-179, KAN-63), que baixam só quando abertas (KAN-261,
   pelada-v104: a gestão estava no limite de 90 KB). Por fora, as mesmas janelas: os mesmos ids e data-a
   (salvarMinimos, salvarVagas, close), que acoes/rodada.js já conhece.
   Tudo o que vem do app (valores, o tx, a trava do plano) chega de quem chama: importar aqui qualquer pedaço da
   gestão faria o montador repartir o código comum em mais arquivos e pesar mais do que economiza (ver D52). */
import type { ComponentChildren } from 'preact';
import textos from '../i18n/pt-BR-vagas';

/* Os textos desta parte: quem abre a janela junta ao dicionário (acoes/rodada.js). */
export { textos };

type Tx = (k: string, o?: Record<string, unknown>) => string;
export type DadosMinimos = {
  tx: Tx;
  total: string;
  campoTotal: string;
  posicoes: { k: string; sigla: string; nome: string; v: string }[];
  controle: boolean;
  travado: boolean;
  trava: ComponentChildren;
};

function Campo({ k, rotulo, titulo, v }: { k: string; rotulo: string; titulo?: string; v: string }) {
  return (
    <label class="f minpos" title={titulo}>
      <span>{rotulo}</span>
      <input class="inp minp" type="number" inputmode="numeric" min="0" max="99" step="1" data-k={k} value={v} />
    </label>
  );
}

export function Minimos({ d }: { d: DadosMinimos }) {
  const tx = d.tx;
  return (
    <>
      <h3 id="minTitulo">{tx('minimo.dlgTitulo')}</h3>
      <p class="small muted">{tx('minimo.dlgAjuda')}</p>
      <Campo k={d.campoTotal} rotulo={tx('minimo.campoTotal')} v={d.total} />
      {d.posicoes.length ? (
        <>
          <p class="small muted" style="margin:10px 0 4px">
            {tx('minimo.porPosicao')}
          </p>
          <div class="minpos-grade">
            {d.posicoes.map(p => (
              <Campo key={p.k} k={p.k} rotulo={p.sigla} titulo={p.nome} v={p.v} />
            ))}
          </div>
        </>
      ) : null}
      <p class="small muted" style="margin:14px 0 4px">
        {tx('vagas.titulo')}
      </p>
      <label class="chk-linha">
        <input type="checkbox" id="vagasCtrl" checked={d.controle} disabled={!d.controle && d.travado} />
        <span>{tx('vagas.controle')}</span>
      </label>
      {!d.controle && d.travado ? d.trava : null}
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarMinimos">
          {tx('comum.salvar')}
        </button>
      </div>
    </>
  );
}

/* "Abrir vagas": já vem com o que falta para o mínimo do jogo (v58); vazio = sem limite. */
export function AbrirVagas({ tx, aberta, sug }: { tx: Tx; aberta: boolean; sug: number }) {
  return (
    <>
      <h3 id="vagasTitulo">{tx(aberta ? 'vagas.mudar' : 'vagas.abrir')}</h3>
      <p class="small muted">{tx('vagas.ajuda')}</p>
      <label class="f">
        <span>{tx('vagas.quantas')}</span>
        <input
          class="inp"
          id="vagasN"
          type="number"
          inputmode="numeric"
          min="0"
          max="99"
          step="1"
          placeholder={tx('vagas.semLimite')}
          value={sug ? String(sug) : ''}
          style="max-width:140px"
        />
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarVagas">
          {tx(aberta ? 'comum.salvar' : 'vagas.abrir')}
        </button>
      </div>
    </>
  );
}
