/* Ações da avaliação por link no app (KAN-214): abrir a janela, criar, compartilhar, as minhas notas, resultado,
   atualizar o cadastro, encerrar e apagar. Baixam junto com a janela, na primeira vez que uma delas é usada
   (acoes/avaliacao.ts só aponta para cá). Tudo exige a permissão de Notas. */
import estilo from '../estilos/avaliacao.css' with { type: 'text' };
import { usarEstilo } from '../ui/estilo';
import { erroAvaliacao, fimDoDia, type Avaliacao, type Resposta } from '../dominio/avaliacao';
import { gname, posso, setLvl } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { LOCAL } from '../i18n/formatos.js';
import * as banco from '../nucleo/backend.js';
import { editRat } from '../nucleo/edicoes.js';
import { GB, S as estado, gp, w } from '../nucleo/estado.js';
import { linkAvaliacao } from '../nucleo/links.js';
import { $, toast, today } from '../nucleo/util.js';
import { shareDlg } from '../ui/Compartilhar';
import { montarAvaliacao, rascunhoAplicar, rascunhoNova, type Tela } from '../ui/AvaliacaoJanela';
import { confirmou, dlg, openDlg } from '../ui/dialogos.js';
import { acoes as envio } from './avaliacao-envio';
usarEstilo('avaliacao', estilo);

const bk = (): any => (banco as any).B;
const st = (): any => estado;
type El = HTMLElement & { dataset: DOMStringMap };

/* Avaliações lidas ao abrir a janela (e mantidas aqui enquanto ela está aberta). */
let avs: Record<string, Avaliacao> = {};
let tela: Tela = { v: 'lista', avs };

function mostrar(t: Tela) {
  tela = t;
  if (!dlg.open || !$('#avRaiz')) {
    openDlg('avRaiz');
    dlg.setAttribute('aria-labelledby', 'avTitulo');
  }
  const el = $('#avRaiz');
  if (el) montarAvaliacao(el, t);
  const foco = t.v === 'nova' ? '#avT' : t.v === 'lista' ? '[data-a=avNova]' : '#avTitulo';
  setTimeout(() => ($(foco) as HTMLElement | null)?.focus?.(), 40);
}
const lista = () => mostrar({ v: 'lista', avs });
const respostas = async (aid: string): Promise<Record<string, Resposta>> =>
  (await bk().getServidor(gp('avaliacoes/' + aid + '/notas'))) || {};

function textoDoLink(aid: string, a: Avaliacao) {
  return tx('aval.textoLink', {
    grupo: gname(),
    t: a.t,
    data: new Date(a.ate).toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit' }),
    link: linkAvaliacao(aid),
  });
}

export const acoes: Record<string, (el: El) => unknown> = {
  avAbrir: async () => {
    if (!posso('notas')) return;
    try {
      avs = (await bk().getServidor(gp('avaliacoes'))) || {};
    } catch (e) {
      toast(tx('aval.semConexao'));
      return;
    }
    lista();
  },
  avVoltar: () => lista(),
  avNova: () => mostrar({ v: 'nova' }),
  avCriar: () => {
    if (!posso('notas')) return;
    const n = rascunhoNova(),
      erro = erroAvaliacao(n, today());
    if (erro) {
      toast(tx(erro));
      (
        $(erro === 'aval.erroTitulo' ? '#avT' : erro === 'aval.erroData' ? '#avData' : '#avQuem input') as HTMLElement
      )?.focus();
      return;
    }
    const aid = bk().newId(),
      a: Avaliacao = { t: n.t, ate: fimDoDia(n.data), jogs: n.jogs, open: true, em: Date.now() };
    avs = Object.assign({}, avs, { [aid]: a });
    const p = w(GB.set('avaliacoes/' + aid, a));
    /* Já abre o compartilhar: é o próximo passo. */
    shareDlg(tx('aval.compartilharTitulo'), textoDoLink(aid, a));
    return p;
  },
  avLink: el => {
    const aid = el.dataset.v || '',
      a = avs[aid];
    if (a) shareDlg(tx('aval.compartilharTitulo'), textoDoLink(aid, a));
  },
  avMinhas: async el => {
    const aid = el.dataset.v || '',
      a = avs[aid];
    if (!a) return;
    let minha: Resposta | null = (st().minhaAvAdm || {})[aid] || null;
    if (!minha)
      try {
        minha = (await respostas(aid))[st().user.uid] || null;
      } catch (e) {}
    mostrar({ v: 'minhas', aid, a, minha });
  },
  avEnviar: el => {
    const r = envio.avEnviar!(el);
    if (el.dataset.adm === '1') lista();
    return r;
  },
  avResultado: async el => {
    const aid = el.dataset.v || '',
      a = avs[aid];
    if (!a) return;
    let rs: Record<string, Resposta>;
    try {
      rs = await respostas(aid);
    } catch (e) {
      toast(tx('aval.semConexao'));
      return;
    }
    /* A minha nota enviada agora pode ainda não ter chegado ao servidor. */
    const minha = (st().minhaAvAdm || {})[aid];
    if (minha) rs = Object.assign({}, rs, { [st().user.uid]: minha });
    mostrar({ v: 'res', aid, a, rs });
  },
  avAplicar: () => {
    if (!posso('notas')) return;
    const novas = rascunhoAplicar(),
      n = Object.keys(novas).length;
    if (!n) {
      toast(tx('aval.nadaMarcado'));
      return;
    }
    toast(tx('aval.atualizadas', { n }));
    lista();
    return editRat((r: any) => {
      for (const [pid, v] of Object.entries(novas)) setLvl(r, pid, v);
    });
  },
  avEncerrar: el => {
    const aid = el.dataset.v || '',
      a = avs[aid];
    if (!a || !posso('notas')) return;
    if (
      confirmou(el, {
        titulo: tx('aval.encerrarTitulo', { t: a.t }),
        texto: tx('aval.encerrarTexto'),
        acao: tx('aval.encerrar'),
      }) !== 'sim'
    )
      return;
    const b = { ...a, open: false };
    avs = Object.assign({}, avs, { [aid]: b });
    lista();
    return w(GB.set('avaliacoes/' + aid, b));
  },
  avApagar: el => {
    const aid = el.dataset.v || '',
      a = avs[aid];
    if (!a || !posso('notas')) return;
    if (
      confirmou(el, {
        titulo: tx('aval.apagarTitulo', { t: a.t }),
        texto: tx('aval.apagarTexto'),
        acao: tx('aval.apagar'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    avs = Object.assign({}, avs);
    delete avs[aid];
    lista();
    /* Apaga também as notas dadas, para não sobrar nada solto. */
    return respostas(aid)
      .catch(() => ({}))
      .then(rs =>
        w(
          GB.lote(
            Object.keys(rs)
              .map(u => ({ tipo: 'del', p: 'avaliacoes/' + aid + '/notas/' + u }))
              .concat({ tipo: 'del', p: 'avaliacoes/' + aid })
          )
        )
      );
  },
};
