/* Janelas de times e pares (KAN-261, pelada-v104) e do sorteio (KAN-262, pelada-v106): Mover, Escolher o time, Pôr no time,
   Separar dois jogadores e Sortear.
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

/* Sortear times (ou duplas): quantos times, posições fora, variar parceiros e quem entra. */
export function janelaSorteio(
  u: U,
  o: {
    n: number;
    nov: number;
    fora: Set<string>;
    inn: string[];
    dentro: number;
    T: number;
  }
) {
  const { tx, sport, hasPos, posKeys, posLabel, siglaTela, ppos, pname, openDlg } = u;
  const pares = sport().pairs,
    k = o.inn.length;
  openDlg(
    <div id="drawBox" data-n={o.n} data-nov={o.nov} data-fora={[...o.fora].join(',')}>
      <h3>{tx(pares ? 'sorteio.tituloDuplas' : 'sorteio.titulo')}</h3>
      <p class="small muted" style="margin-top:-6px">
        {pares ? tx('sorteio.infoDuplas') : tx('sorteio.info', { n: o.T })}
      </p>
      <div class="f" hidden={pares}>
        <span class="lbl">{tx('sorteio.quantos')}</span>
        <span class="seg">
          {[2, 3, 4, 5, 6, 7, 8]
            .filter(x => x * 2 <= k)
            .map(x => (
              <button key={x} data-a="dN" data-v={x}>
                {x}
              </button>
            ))}
        </span>
      </div>
      {hasPos() ? (
        <div class="f" style="margin-top:12px">
          <span class="lbl">{tx('sorteio.foraPos')}</span>
          <span class="seg seg-wrap">
            {(posKeys() as string[]).map(p => (
              <button key={p} data-a="dFora" data-v={p} aria-pressed={o.fora.has(p)} title={posLabel(p)}>
                {siglaTela(p)}
              </button>
            ))}
          </span>
          <p class="small muted" style="margin:6px 0 0">
            {tx('sorteio.foraPosAjuda')}
          </p>
        </div>
      ) : null}
      <p id="drawPrev" style="font-weight:600"></p>
      <div class="f">
        <span class="lbl">{tx('sorteio.variar')}</span>
        <span class="seg">
          {[0, 1, 2, 3].map(i => (
            <button key={i} data-a="dNov" data-v={i}>
              {tx('sorteio.variar' + i)}
            </button>
          ))}
        </span>
      </div>
      <details>
        <summary>
          {tx('sorteio.quemEntraAntes')}
          <span id="drawK">{o.dentro}</span>
          {tx('sorteio.quemEntraDepois', { total: k })}
        </summary>
        <div class="chk">
          {o.inn.map(id => (
            <label key={id}>
              <input
                type="checkbox"
                class="dp"
                value={id}
                data-pos={ppos(id) || ''}
                checked={!(hasPos() && o.fora.has(ppos(id)))}
              />
              {pname(id) + (hasPos() && ppos(id) ? ' ' : '')}
              {hasPos() && ppos(id) ? <span class="tag">{'· ' + siglaTela(ppos(id))}</span> : null}
            </label>
          ))}
        </div>
      </details>
      <div class="dlg-f">
        <Cancelar tx={tx} />
        <button class="btn bib" id="drawGo" data-a="doDraw">
          {tx('sorteio.sortear')}
        </button>
      </div>
    </div>
  );
  drawPreview(u);
}

/* Prévia do sorteio: quantos jogadores, quantos times e quem fica de reserva; liga ou desliga o Sortear. */
export function drawPreview(u: U) {
  const { tx, tp, sport, porTime, resumo, $ } = u;
  const box = $('#drawBox') as HTMLElement | null;
  if (!box) return;
  const k = box.querySelectorAll('.dp:checked').length;
  if (sport().pairs) box.dataset.n = String(Math.max(1, Math.floor(k / 2)));
  const n = +box.dataset.n!,
    T = porTime();
  const kEl = $('#drawK');
  if (kEl) kEl.textContent = String(k);
  let txt: string;
  if (sport().pairs)
    txt = k < 4 ? tx('sorteio.minDuplas') : tx(k % 2 ? 'sorteio.prevDuplasReserva' : 'sorteio.prevDuplas', { k, n });
  else if (k < n * 2) txt = tx('sorteio.poucos', { n });
  else {
    const r = resumo(k, n, T);
    txt = r.reservas
      ? tx('sorteio.prevReservas', { k, n, t: T, r: tp('sorteio.reservas', r.reservas) })
      : r.completos
        ? tx('sorteio.prevCompletos', { k, n, t: T })
        : tx('sorteio.prevIncompletos', { k, n, tam: [...new Set(r.porTimeReal)].join(' e '), t: T });
  }
  $('#drawPrev')!.textContent = txt;
  ($('#drawGo') as HTMLButtonElement).disabled = sport().pairs ? k < 4 : k < n * 2;
  box
    .querySelectorAll<HTMLElement>('[data-a=dN]')
    .forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v! === n)));
  box
    .querySelectorAll<HTMLElement>('[data-a=dNov]')
    .forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v! === +box.dataset.nov!)));
}
