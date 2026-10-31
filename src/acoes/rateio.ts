/* Ações dos rateios (KAN-213). Fazem parte da parte sob demanda do Caixa (abas/caixa.ts).
   O rateio fica em privado/caixa.rat; cada pagamento é uma entrada no Caixa com o jogador e o rateio (rat). */
import { cfg } from '../dominio/caixa.js';
import { gname, pname, posso, recurso } from '../dominio/grupo.js';
import { camposDoRateio, eDeFora, erroRateio, nomeNoRateio, situacao, type Rateio } from '../dominio/rateio';
import { tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
import { GB, S, w } from '../nucleo/estado.js';
import { aoLancar, apagarLanc, salvarLanc } from '../nucleo/partidas.js';
import { $, brl, cl, toast, toastAcao, today } from '../nucleo/util.js';
import { changed } from '../ui/render.js';
import { shareDlg } from '../ui/Compartilhar';
import { closeDlg, confirmou, dlg, openDlg } from '../ui/dialogos.js';
import { montarRateio, rascunho, rateios } from '../telas/Rateios';

type El = HTMLElement & { dataset: DOMStringMap };
const st = S;
const novoId = (): string => (banco as any).B.newId();
const op = (banco as any).op;
const pode = () => posso('caixa') && recurso('caixa');
const reais = (c: number) => brl(c / 100);

/* Lançamento ligado a um rateio soma (ou desconta) nele, em privado/caixa.rat, no mesmo lote (nucleo/partidas.js). */
aoLancar((o: { k: string; v: number | string; pid?: string | null; rat?: string }, sinal: 1 | -1) => {
  const c = camposDoRateio(o, sinal);
  if (!c) return null;
  const pc = cl(st.pc) || {},
    patch: Record<string, unknown> = {};
  for (const [k, n] of Object.entries(c)) {
    const ps = k.split('.'),
      f = ps.pop() as string;
    let a = pc;
    for (const x of ps) a = a[x] = a[x] || {};
    a[f] = (a[f] || 0) + n;
    patch[k] = op.somar(n);
  }
  st.pc = pc;
  return { tipo: 'patch', p: 'privado/caixa', o: patch };
});

/* Grava só os campos do rateio (patch), para não apagar o que outro aparelho somou ao mesmo tempo. */
function gravar(rid: string, campos: Record<string, unknown>, local: (r: Rateio | null) => Rateio | null) {
  const pc = cl(st.pc) || {};
  pc.rat = pc.rat || {};
  const novo = local(pc.rat[rid] || null);
  if (novo) pc.rat[rid] = novo;
  else delete pc.rat[rid];
  st.pc = pc;
  changed();
  return w(GB.patch('privado/caixa', campos));
}

function abrir(rid: string) {
  if (!pode()) return;
  openDlg('ratRaiz');
  dlg.setAttribute('aria-labelledby', 'ratTitulo');
  montarRateio(rid);
  setTimeout(() => ($('#rtn') as HTMLInputElement | null)?.focus(), 30);
}

export const acoes: Record<string, (el: El) => unknown> = {
  ratNovo: () => abrir(''),
  ratEditar: el => abrir(el.dataset.v || ''),
  ratSalvar: el => {
    const r = rascunho();
    if (!r || !pode()) return;
    const erro = erroRateio(r);
    if (erro) {
      toast(tx(erro));
      (
        $(erro === 'rateio.erroNome' ? '#rtn' : erro === 'rateio.erroValor' ? '#rtv' : '#rtMensalistas') as HTMLElement
      )?.focus();
      return;
    }
    const rid = el.dataset.v || novoId(),
      antes = rateios()[rid];
    closeDlg();
    toast(tx(antes ? 'rateio.salvo' : 'rateio.criado', { nome: r.n }));
    if (!antes) {
      const novo: Rateio = { n: r.n, modo: r.modo, base: r.base, part: r.part, pend: r.pend, em: Date.now() };
      if (Object.keys(r.fora).length) novo.fora = r.fora;
      return gravar(rid, { ['rat.' + rid]: novo }, () => novo);
    }
    const campos: Record<string, unknown> = {
      [`rat.${rid}.n`]: r.n,
      [`rat.${rid}.modo`]: r.modo,
      [`rat.${rid}.base`]: r.base,
      [`rat.${rid}.pend`]: r.pend,
    };
    Object.keys(antes.part || {}).forEach(p => {
      if (!(p in r.part)) campos[`rat.${rid}.part.${p}`] = op.apagar();
    });
    Object.entries(r.part).forEach(([p, v]) => (campos[`rat.${rid}.part.${p}`] = v));
    /* KAN-216: quem é de fora entra e sai junto com a lista; quem já pagou não sai (a janela não deixa tirar). */
    Object.keys(antes.fora || {}).forEach(f => {
      if (!(f in r.fora) && !((antes.pg || {})[f] > 0)) campos[`rat.${rid}.fora.${f}`] = op.apagar();
    });
    Object.entries(r.fora).forEach(([f, nome]) => (campos[`rat.${rid}.fora.${f}`] = nome));
    const pagos: Record<string, string> = {};
    for (const [f, nome] of Object.entries(antes.fora || {})) if ((antes.pg || {})[f]! > 0) pagos[f] = nome;
    return gravar(rid, campos, x => ({
      ...(x as Rateio),
      n: r.n,
      modo: r.modo,
      base: r.base,
      pend: r.pend,
      part: r.part,
      fora: { ...pagos, ...r.fora },
    }));
  },
  /* "Recebi": entrada no Caixa com o jogador e o rateio, pelo que falta, com a data de hoje e "Desfazer". */
  ratRecebi: el => {
    const rid = el.dataset.v || '',
      pid = el.dataset.p || '',
      r = rateios()[rid];
    if (!r || !pid || !pode()) return;
    const falta = situacao(r).faltam.find(([p]) => p === pid);
    if (!falta) return;
    return receberRateio(rid, pid, falta[1] / 100);
  },
  ratCobrar: el => {
    const r = rateios()[el.dataset.v || ''];
    if (!r) return;
    const linhas = situacao(r)
      .faltam.map(([pid, v]) => `• ${nomeNoRateio(r, pid, pname)}: ${reais(v)}`)
      .join('\n');
    let t = tx('rateio.cobrancaTitulo', { grupo: gname(), nome: r.n }) + '\n\n' + linhas;
    if (cfg().pix) t += '\n\n' + tx('rateio.pix', { pix: cfg().pix });
    shareDlg(tx('rateio.cobranca'), t);
  },
  ratEncerrar: el => {
    const rid = el.dataset.v || '',
      r = rateios()[rid];
    if (!r || !pode()) return;
    const n = situacao(r).faltam.length;
    if (
      n &&
      confirmou(el, {
        titulo: tx('rateio.encerrarTitulo', { nome: r.n }),
        texto: tx('rateio.encerrarTexto', { n }),
        acao: tx('rateio.encerrar'),
      }) !== 'sim'
    )
      return;
    const fim = Date.now();
    toast(tx('rateio.encerradoAviso', { nome: r.n }));
    return gravar(rid, { [`rat.${rid}.fim`]: fim }, x => ({ ...(x as Rateio), fim }));
  },
  ratReabrir: el => {
    const rid = el.dataset.v || '';
    if (!rateios()[rid] || !pode()) return;
    return gravar(rid, { [`rat.${rid}.fim`]: op.apagar() }, x => {
      const o = Object.assign({}, x);
      delete o.fim;
      return o;
    });
  },
  ratApagar: el => {
    const rid = el.dataset.v || '',
      r = rateios()[rid];
    if (!r || !pode()) return;
    if (
      confirmou(el, {
        titulo: tx('rateio.apagarTitulo', { nome: r.n }),
        texto: tx('rateio.apagarTexto'),
        acao: tx('rateio.apagar'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    return gravar(rid, { ['rat.' + rid]: op.apagar() }, () => null);
  },
};

/* Também usado pelo "Recebi" das pendências do Caixa (rateio marcado para aparecer lá). */
export function receberRateio(rid: string, pid: string, v: number) {
  const r = rateios()[rid];
  if (!r) return;
  /* KAN-216: quem é de fora não é jogador: a entrada fica sem jogador, com o id em "fora" e o nome na descrição. */
  const fora = eDeFora(pid),
    nome = nomeNoRateio(r, pid, pname),
    id = novoId(),
    o = fora
      ? { k: 'entrada', pid: null, fora: pid, v, d: today(), rat: rid, note: r.n + ' — ' + nome }
      : { k: 'entrada', pid, v, d: today(), rat: rid, note: r.n };
  const p = salvarLanc(id, o);
  toastAcao(tx('caixa.recebido', { nome, valor: brl(v) }), tx('caixa.desfazer'), () => {
    const d = apagarLanc(id);
    toast(tx('caixa.pagamentoDesfeito'));
    return d;
  });
  return p;
}
