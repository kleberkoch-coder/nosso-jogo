/* Janelas da gestão (KAN-149): jogador, rodada, avulso, sorteio, mover e escolher time. Vão na parte de gestão, que o
   link público não baixa. Componentes desde a v84 (KAN-218); antes eram montadas como texto (ui/dialogos-gestao.js).
   Por fora, os mesmos ids, classes e data-a, que as ações (acoes/rodada.js, acoes/jogadores.js) e os testes leem. */
import { HoraCampo } from './HoraCampo';
import { cfg, ptipo, recebePorJogo } from '../dominio/caixa.js';
import { relogio12 } from '../i18n/formatos.js';
import { col, hasPos, porTime, posKeys, posLabel, sport, tn } from '../dominio/esportes.js';
import { resumo } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { fdia, fmtL, lvl, normName, pname, posso, ppos, recurso } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { $, nextSat } from '../nucleo/util.js';
import { openDlg } from './dialogos.js';
import { CampoPosicao, Pos } from './componentes';
import { CampoNota, CampoTelefone, CampoTipo, LinhaAfastamento } from './Campos';

const st = S;
const Cancelar = () => (
  <button class="btn" data-a="close">
    {tx('comum.cancelar')}
  </button>
);

/* Novo jogador / Editar jogador. */
export function playerDlg(id: string | null, prefill?: any) {
  const p = id ? st.jog[id] : null,
    cid = id || prefill?.id,
    nota = cid ? lvl(cid) : 5,
    ct = (st.cont || {})[cid] || {};
  openDlg(
    <>
      <h3>{tx(p ? 'jogador.editar' : 'jogador.novo')}</h3>
      <label class="f">
        <span>{tx('jogador.nome')}</span>
        <input class="inp" id="pnm" value={p?.name || prefill?.name || ''} maxLength={40} />
      </label>
      <CampoPosicao id="ppos" valor={p?.pos || prefill?.pos} />
      {posso('notas') ? <CampoNota rotulo={tx('jogador.nota')} valor={nota} /> : null}
      {posso('caixa') && recurso('caixa') ? (
        <CampoTipo tipo={p ? ptipo(id) : prefill?.tipo} recebe={cid ? recebePorJogo(cid) : null} />
      ) : null}
      <CampoTelefone valor={ct.tel || ''} rotulo={tx('contato.telRotulo')} />
      <label class="f">
        <span>{tx('contato.emailRotulo')}</span>
        <input
          class="inp"
          id="pmail"
          type="email"
          autocomplete="email"
          maxLength={100}
          value={ct.email || ''}
          placeholder={tx('contato.emailExemplo')}
        />
      </label>
      {p ? (
        <p class="small muted" style="margin-top:-4px">
          {p.ativo === false ? (
            <>
              {tx('jogador.cadastradoEm', { data: fdia(p.criado) }) + ' · '}
              <b style="color:var(--out)">{tx('jogador.inativo')}</b>
            </>
          ) : (
            tx('jogador.cadastradoEm', { data: fdia(p.criado) }) + ' · ' + tx('jogador.ativo')
          )}
        </p>
      ) : null}
      {p && p.ativo !== false ? <LinhaAfastamento id={id!} /> : null}
      <div class="dlg-f">
        {p ? (
          <>
            <button class="btn ghost danger" data-a="delPlayer" data-p={id}>
              {tx('jogador.excluir')}
            </button>
            <button class="btn" data-a="toggleJog" data-p={id}>
              {tx(p.ativo === false ? 'jogador.reativar' : 'jogador.inativar')}
            </button>
          </>
        ) : null}
        <Cancelar />
        <button class="btn primary" data-a="savePlayer" data-p={id || ''}>
          {tx('jogador.salvar')}
        </button>
      </div>
    </>
  );
  setTimeout(() => ($('#pnm') as HTMLInputElement | null)?.focus(), 50);
}

/* Nova rodada / Editar rodada. */
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

/* "Não colocar no mesmo time": escolher o par. */
export function janelaSeparar(lista: { id: string; name: string }[]) {
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
        <Cancelar />
        <button class="btn primary" data-a="saveSep">
          {tx('jogadores.adicionarPar')}
        </button>
      </div>
    </>
  );
}

const Bolinha = ({ c }: { c: number }) => <span class="dot" style={{ background: col(c).c }}></span>;

/* Escolher o time de quem confirmou depois do sorteio. */
export function janelaEscolherTime(pid: string, times: any[]) {
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
        <Cancelar />
      </div>
    </>
  );
}

/* Adicionar avulso: quem já jogou aqui (para escolher) ou um avulso novo. */
export function janelaAvulso(regs: [string, { nome: string }][]) {
  openDlg(
    <>
      <h3>{tx('avulso.adicionar')}</h3>
      {regs.length ? (
        <>
          <div class="f">
            <span class="lbl">{tx('avulso.jaJogou')}</span>
            {regs.length > 8 ? (
              <input class="inp" id="avq" placeholder={tx('avulso.buscar')} style="margin-bottom:8px" />
            ) : null}
            <div class="vgrid" id="avlist">
              {regs.map(([id, a]) => (
                <button key={id} class="opt" data-a="pickAvulso" data-p={id} data-n={normName(a.nome)}>
                  <Pos id={id} />
                  <span>{a.nome}</span>
                  {posso('notas') ? (
                    <span class="tag" style="margin-left:auto">
                      {fmtL(lvl(id))}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <p class="small muted" style="margin:4px 0 10px">
            {tx('avulso.ouNovo')}
          </p>
        </>
      ) : null}
      <label class="f">
        <span>{tx('avulso.nome')}</span>
        <input class="inp" id="anm" maxLength={40} />
      </label>
      <CampoPosicao id="apos" />
      {posso('notas') ? <CampoNota rotulo={tx('nota.titulo')} valor={5} /> : null}
      {posso('elenco') ? <CampoTelefone valor="" rotulo={tx('contato.telOpcional')} /> : null}
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="saveAvulso">
          {tx('avulso.adicionarConfirmado')}
        </button>
      </div>
    </>
  );
}

/* Editar avulso (nome, posição, nota e telefone) ou esquecê-lo. */
export function janelaEditarAvulso(id: string, a: { nome: string; pos?: string; criado?: number }, tel: string) {
  openDlg(
    <>
      <h3>{tx('avulso.titulo', { nome: a.nome })}</h3>
      <label class="f">
        <span>{tx('avulso.nome')}</span>
        <input class="inp" id="anm" maxLength={40} value={a.nome} />
      </label>
      <CampoPosicao id="apos" valor={a.pos} />
      {posso('notas') ? <CampoNota rotulo={tx('jogador.nota')} valor={lvl(id)} /> : null}
      {posso('elenco') ? <CampoTelefone valor={tel} rotulo={tx('contato.telRotulo')} /> : null}
      <p class="small muted" style="margin-top:-4px">
        {tx('avulso.registradoEm', { data: fdia(a.criado) })}
      </p>
      <div class="dlg-f">
        <button class="btn ghost danger" data-a="delAvulso" data-p={id}>
          {tx('avulso.esquecer')}
        </button>
        <Cancelar />
        <button class="btn primary" data-a="saveAvEdit" data-p={id}>
          {tx('comum.salvar')}
        </button>
      </div>
    </>
  );
}

/* Sortear times (ou duplas): quantos times, posições fora, variar parceiros e quem entra. */
export function janelaSorteio(o: {
  n: number;
  nov: number;
  fora: Set<string>;
  inn: string[];
  dentro: number;
  T: number;
}) {
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
                {p}
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
              {hasPos() && ppos(id) ? <span class="tag">{'· ' + ppos(id)}</span> : null}
            </label>
          ))}
        </div>
      </details>
      <div class="dlg-f">
        <Cancelar />
        <button class="btn bib" id="drawGo" data-a="doDraw">
          {tx('sorteio.sortear')}
        </button>
      </div>
    </div>
  );
  drawPreview();
}

/* Mover para outro time (ou marcar como reserva/titular). */
export function janelaMover(pid: string, f: number, times: any[]) {
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
        <Cancelar />
        <button class="btn" data-a="toggleRes" data-v={f} data-p={pid}>
          {(times[f].res || []).includes(pid) ? tx('times.marcarTitular') : tx('times.marcarReserva')}
        </button>
      </div>
    </>
  );
}

/* Pôr alguém num time: confirmados fora dos times, outros do elenco ou um avulso. */
export function janelaPorTime(ti: number, t: any, conf: string[], outros: string[]) {
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
        <Cancelar />
        <button class="btn" data-a="addAvulso" data-t={ti}>
          {tx('porTime.avulso')}
        </button>
      </div>
    </>
  );
}

/* Prévia do sorteio: quantos jogadores, quantos times e quem fica de reserva; liga ou desliga o Sortear. */
export function drawPreview() {
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
