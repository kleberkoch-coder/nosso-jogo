/* Janelas de times e pares (KAN-261, pelada-v104): Mover, Escolher o time, Pôr no time e Separar dois jogadores.
   Baixam só quando abertas, para a gestão caber nos 90 KB. Por fora, as mesmas janelas, com os mesmos ids e data-a
   (doMove, toggleRes, doPorTime, addAvulso, saveSep, close), que acoes/rodada.js e acoes/jogadores.js já conhecem.
   O que vem do app (tx, nomes, cores, a abertura da janela) chega de quem chama (ui/JanelasGestao.tsx: comJanelasTimes),
   em vez de importar, para não repartir o código comum em mais arquivos (ver D52). */
import type { UtilJanelas as U } from './JanelasGestao';
import textos from '../i18n/pt-BR-times';

/* Os textos desta parte: quem abre a janela junta ao dicionário. */
export { textos };

const Cancelar = ({ tx }: { tx: U['tx'] }) => (
  <button class="btn" data-a="close">
    {tx('comum.cancelar')}
  </button>
);
const bolinha =
  (u: U) =>
  ({ c }: { c: number | string }) => <span class="dot" style={{ background: u.col(c).c }}></span>;

export function janelaSeparar(u: U, lista: { id: string; name: string }[]) {
  const { tx, openDlg } = u;
  const opcoes = lista.map(p => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ));
  openDlg(
    <>
      <h3>{tx('jogadores.separarTitulo')}</h3>
      <label class="f">
        <span>{tx('jogador.jogador')}</span>
        <select class="sel" id="sa">
          {opcoes}
        </select>
      </label>
      <label class="f">
        <span>{tx('jogadores.e')}</span>
        <select class="sel" id="sb">
          {opcoes}
        </select>
      </label>
      <div class="dlg-f">
        <Cancelar tx={u.tx} />
        <button class="btn primary" data-a="saveSep">
          {tx('jogadores.adicionarPar')}
        </button>
      </div>
    </>
  );
}

/* Escolher o time de quem confirmou depois do sorteio. */
export function janelaEscolherTime(u: U, pid: string, times: any[]) {
  const { tx, tp, pname, tn, openDlg } = u,
    Bolinha = bolinha(u);
  openDlg(
    <>
      <h3>{tx('porTime.qualTime', { nome: pname(pid) })}</h3>
      <div class="vgrid">
        {times.map((t, i) => (
          <button key={i} class="opt" data-a="doPorTime" data-v={i} data-p={pid}>
            <Bolinha c={t.c} />
            {tn(i)}
            <span class="tag" style="margin-left:auto">
              {tp('porTime.jogadores', t.players.length)}
            </span>
          </button>
        ))}
      </div>
      <div class="dlg-f">
        <Cancelar tx={u.tx} />
      </div>
    </>
  );
}

/* Mover para outro time (ou marcar como reserva/titular). */
export function janelaMover(u: U, pid: string, f: number, times: any[]) {
  const { tx, pname, tn, openDlg } = u,
    Bolinha = bolinha(u);
  openDlg(
    <>
      <h3>{tx('times.moverRotulo', { nome: pname(pid) })}</h3>
      <div class="vgrid">
        {times.map((t, i) =>
          i === f ? null : (
            <button key={i} class="opt" data-a="doMove" data-v={i} data-f={f} data-p={pid}>
              <Bolinha c={t.c} />
              {tn(i)}
            </button>
          )
        )}
      </div>
      <div class="dlg-f">
        <Cancelar tx={u.tx} />
        <button class="btn" data-a="toggleRes" data-v={f} data-p={pid}>
          {(times[f].res || []).includes(pid) ? tx('times.marcarTitular') : tx('times.marcarReserva')}
        </button>
      </div>
    </>
  );
}

/* Pôr alguém num time: confirmados fora dos times, outros do elenco ou um avulso. */
export function janelaPorTime(u: U, ti: number, t: any, conf: string[], outros: string[]) {
  const { tx, pname, tn, openDlg, Pos } = u,
    Bolinha = bolinha(u);
  const opc = (id: string) => (
    <button key={id} class="opt" data-a="doPorTime" data-v={ti} data-p={id}>
      <Pos id={id} />
      <span>{pname(id)}</span>
    </button>
  );
  openDlg(
    <>
      <h3>
        <Bolinha c={t.c} />
        {' ' + tx('porTime.titulo', { time: tn(ti) })}
      </h3>
      <p class="small muted">{tx('porTime.ajuda')}</p>
      {conf.length ? (
        <div class="f">
          <span class="lbl">{tx('porTime.confirmados')}</span>
          <div class="vgrid">{conf.map(opc)}</div>
        </div>
      ) : null}
      {outros.length ? (
        <div class="f">
          <span class="lbl">{tx('porTime.outros')}</span>
          <div class="vgrid">{outros.map(opc)}</div>
        </div>
      ) : conf.length ? null : (
        <p class="muted small">{tx('porTime.ninguem')}</p>
      )}
      <div class="dlg-f">
        <Cancelar tx={u.tx} />
        <button class="btn" data-a="addAvulso" data-t={ti}>
          {tx('porTime.avulso')}
        </button>
      </div>
    </>
  );
}
