/* Extra da rodada na gestão (KAN-228): ligar e editar (nome e valor por pessoa), ver quem vai com os convidados,
   adicionar alguém do elenco ou de fora, tirar, e criar o rateio do extra. Baixa sob demanda, só quando usado. */
import { comConvidado as _comConvidado, participantesDoRateio, resumoExtra } from '../dominio/extra';
import { curRodada, players, pname, posso, recurso } from '../dominio/grupo.js';
import estilo from '../estilos/extra.css' with { type: 'text' };
import { simboloMoeda } from '../i18n/formatos.js';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-extra';
import * as banco from '../nucleo/backend.js';
import { adm } from '../nucleo/carga-admin.js';
import { editRod } from '../nucleo/edicoes.js';
import { GB, S, w } from '../nucleo/estado';
import type { Extra, RespostaExtra } from '../nucleo/tipos';
import { $, fdate, toast } from '../nucleo/util.js';
import { ACT } from '../acoes.js';
import { closeDlg, confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { usarEstilo } from '../ui/estilo';
import { prepararRateio } from '../nucleo/rateio-preparo';

juntarTextos(textos);
usarEstilo('extra', estilo);
void _comConvidado;

type El = HTMLElement & { dataset: DOMStringMap };
const bk = (): any => (banco as any).B;
const PRESETS = ['churrasco', 'pizzada', 'happy'];

function Janela({ e }: { e: Extra | null }) {
  const nomes = PRESETS.map(p => tx('extra.p.' + p)),
    atual = e ? e.n : nomes[0],
    outro = !!e && !nomes.includes(e.n);
  return (
    <div id="extraRaiz">
      <h3 id="extraTitulo">{tx('extra.dlgTitulo')}</h3>
      <p class="small muted">{tx('extra.dlgAjuda')}</p>
      <label class="f">
        <span>{tx('extra.oQue')}</span>
        <select
          class="inp"
          id="exN"
          onChange={ev => {
            const o = $('#exOutroF') as HTMLElement | null;
            if (o) o.hidden = (ev.target as HTMLSelectElement).value !== '_';
          }}
        >
          {nomes.map(n => (
            <option key={n} value={n} selected={!outro && atual === n}>
              {n}
            </option>
          ))}
          <option value="_" selected={outro}>
            {tx('extra.p.outro')}
          </option>
        </select>
      </label>
      <label class="f" id="exOutroF" hidden={!outro}>
        <span>{tx('extra.outroNome')}</span>
        <input class="inp" id="exOutro" maxLength={30} value={outro ? e!.n : ''} enterkeyhint="done" />
      </label>
      <label class="f">
        <span>{tx('extra.valorRotulo', { moeda: simboloMoeda() })}</span>
        <input
          class="inp"
          id="exV"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          value={e && e.v ? String(e.v) : ''}
          enterkeyhint="done"
        />
      </label>
      <div class="row" style={{ marginTop: '14px' }}>
        <button class="btn primary" data-a="salvarExtra">
          {tx(e ? 'extra.salvar' : 'extra.ligar')}
        </button>
        {e ? (
          <button class="btn ghost danger" data-a="desligarExtra">
            {tx('extra.desligar')}
          </button>
        ) : null}
        <button class="btn ghost" data-a="close">
          {tx('comum.cancelar')}
        </button>
      </div>
    </div>
  );
}

const rid = () => (curRodada() as { id: string } | null)?.id || '';
const extraDe = () => (curRodada() as { extra?: Extra } | null)?.extra || null;
function gravar(pid: string, o: RespostaExtra) {
  S.ext = Object.assign({}, S.ext, { [pid]: o });
  changed();
  return w(GB.set('rodadas/' + rid() + '/extra/' + pid, o));
}
const marca = (s: 'in' | 'out', a?: RespostaExtra): RespostaExtra =>
  Object.assign({}, a || {}, { s, t: a && a.s === s && a.t ? a.t : Date.now(), by: (S.user as { uid: string }).uid });

export const acoes: Record<string, (el: El) => unknown> = {
  abrirExtra: () => {
    openDlg(<Janela e={extraDe()} />);
    dlg.setAttribute('aria-labelledby', 'extraTitulo');
    setTimeout(() => ($('#exN') as HTMLElement | null)?.focus(), 30);
  },
  salvarExtra: () => {
    const sel = val('exN') as string,
      n = (sel === '_' ? (val('exOutro') as string) : sel).replace(/\s+/g, ' ').trim().slice(0, 30),
      v = +(val('exV') as string) || 0;
    if (!n) {
      toast(tx('extra.semNome'));
      ($('#exOutro') as HTMLElement | null)?.focus();
      return;
    }
    if (v < 0) {
      toast(tx('extra.valorNegativo'));
      ($('#exV') as HTMLElement | null)?.focus();
      return;
    }
    const e: Extra = v ? { n, v } : { n };
    closeDlg();
    toast(tx('extra.ligado', { n }));
    return editRod(rid(), (x: { extra?: Extra }) => {
      x.extra = e;
    });
  },
  desligarExtra: (el: El) => {
    const e = extraDe();
    if (!e) return;
    if (
      confirmou(el, {
        titulo: tx('extra.desligarTitulo', { n: e.n }),
        texto: tx('extra.desligarTexto'),
        acao: tx('extra.desligar'),
      }) !== 'sim'
    )
      return;
    closeDlg();
    toast(tx('extra.desligado'));
    return editRod(rid(), (x: { extra?: Extra }) => {
      delete x.extra;
    });
  },
  extraAdd: () => {
    const pid = val('exAdd') as string;
    if (!pid) {
      toast(tx('extra.escolhaNome'));
      ($('#exAdd') as HTMLElement | null)?.focus();
      return;
    }
    toast(tx('extra.adicionado', { nome: pname(pid), n: extraDe()?.n || '' }));
    return gravar(pid, marca('in', (S.ext || {})[pid]));
  },
  extraAddFora: () => {
    const campo = $('#exFora') as HTMLInputElement | null,
      nome = (campo ? campo.value : '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!nome) {
      toast(tx('extra.erroVazio'));
      campo?.focus();
      return;
    }
    if (campo) campo.value = '';
    toast(tx('extra.adicionado', { nome, n: extraDe()?.n || '' }));
    return gravar(bk().newId(), Object.assign(marca('in'), { nome }));
  },
  extraTirar: (el: El) => {
    const pid = el.dataset.p || '',
      a = (S.ext || {})[pid];
    if (!a) return;
    if (a.nome) {
      const ext = Object.assign({}, S.ext);
      delete ext[pid];
      S.ext = ext;
      changed();
      return w(GB.del('rodadas/' + rid() + '/extra/' + pid));
    }
    return gravar(pid, marca('out', a));
  },
  /* Rateio do extra (KAN-213, KAN-216): abre o rateio novo com quem vai e os convidados já marcados. */
  extraRateio: () => {
    const e = extraDe(),
      r = curRodada() as { date: string } | null;
    if (!e || !r) return;
    const p = participantesDoRateio(
      S.ext,
      id => (players() as { id: string }[]).some(p => p.id === id),
      id => ((S.ext || {})[id] || {}).nome || pname(id),
      (nome, de) => tx('extra.convidadoDe', { nome, de })
    );
    const A = adm() as { carregarAba: (k: string) => Promise<unknown> } | null;
    if (!A) return;
    return A.carregarAba('caixa').then(() => {
      prepararRateio({
        n: tx('extra.rateioNome', { n: e.n, data: fdate(r.date) }),
        modo: e.v ? 'fixo' : 'total',
        base: e.v ? String(e.v) : '',
        sel: p.sel,
        fora: p.fora,
      });
      return (ACT as Record<string, (el: unknown) => unknown>).ratNovo({ dataset: {} });
    });
  },
};

/* "Adicionar alguém" continua aberto depois de adicionar (para adicionar vários seguidos). */
let addAberto = false;
/* Painel da aba Rodada: quem vai (com os convidados), adicionar, tirar e o rateio. */
export function PainelExtraRodada() {
  const e = extraDe();
  if (!e) return null;
  const ext = S.ext || {},
    res = resumoExtra(ext),
    vao = new Set(res.vao),
    opcoes = (players() as { id: string }[])
      .map(p => p.id)
      .concat(Object.keys(S.avul || {}))
      .filter(id => !vao.has(id)),
    rateio = posso('caixa') && recurso('caixa');
  return (
    <div class="panel extra-painel" id="extraRodada">
      <div class="row between">
        <h3>{tx('extra.painel', { n: e.n })}</h3>
        <button class="btn sm ghost" data-a="abrirExtra">
          {tx('extra.editar')}
        </button>
      </div>
      <p class="extra-total" id="extraTotal">
        <b>{tp('extra.total', res.total)}</b>
        {res.convidados.length ? ' ' + tp('extra.comConvidados', res.convidados.length) : ''}
        {res.naoVao.length ? ' · ' + tp('extra.naoVao', res.naoVao.length) : ''}
      </p>
      {res.vao.length ? (
        <ul class="plist">
          {res.vao.map(id => {
            const a = ext[id]!,
              nome = a.nome || pname(id);
            return (
              <li key={id} data-extra={id}>
                <span class="pn">
                  {nome}
                  {a.nome ? (
                    <>
                      {' '}
                      <span class="tag">{tx('extra.deFora')}</span>
                    </>
                  ) : null}
                </span>
                <button class="linkbtn" data-a="extraTirar" data-p={id} aria-label={tx('extra.tirar', { nome })}>
                  ✕
                </button>
                {(a.conv || []).length ? (
                  <div class="extra-conv">
                    {(a.conv || []).map(c => (
                      <span class="tag" key={c}>
                        {tx('extra.convidadoDe', { nome: c, de: nome })}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="small muted">{tx('extra.ninguem')}</p>
      )}
      <details
        class="extra-todos"
        open={addAberto}
        onToggle={ev => (addAberto = (ev.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>{tx('extra.adicionarTitulo', { n: e.n })}</summary>
        <div class="extra-novo">
          <select class="inp" id="exAdd" aria-label={tx('extra.escolhaNome')}>
            <option value="">{tx('extra.escolhaNome')}</option>
            {opcoes.map(id => (
              <option key={id} value={id}>
                {pname(id)}
              </option>
            ))}
          </select>
          <button class="btn sm" data-a="extraAdd">
            {tx('extra.adicionar')}
          </button>
        </div>
        <div class="extra-novo">
          <input
            class="inp"
            id="exFora"
            maxLength={40}
            autocomplete="off"
            enterkeyhint="done"
            aria-label={tx('extra.ouDeFora')}
            placeholder={tx('extra.ouDeFora')}
          />
          <button class="btn sm" data-a="extraAddFora">
            {tx('extra.adicionar')}
          </button>
        </div>
      </details>
      {rateio && res.total ? (
        <div class="row" style={{ marginTop: '10px' }}>
          <button class="btn sm primary" data-a="extraRateio">
            {tx('extra.rateio', { n: e.n })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
