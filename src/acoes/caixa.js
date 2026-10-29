/* Ações: Caixa: lançamentos, pendências e cobrança. Fazem parte de ACT (src/acoes.js). */
import { cfg } from '../dominio/caixa.js';
import { foraDoPadrao, referenciaDoGrupo } from '../dominio/caixa-regras';
import { gname, pname, rodadas } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import { shareDlg } from '../ui/Compartilhar';
import { B } from '../nucleo/backend.js';
import { apagarLanc, salvarLanc } from '../nucleo/partidas.js';
import { S } from '../nucleo/estado.js';
import { $, brl, fmonth, toast, toastAcao, today, usarAvisoAcao } from '../nucleo/util.js';
import { listaAPagar, montarNovoLancamento, montarPagar, pendencias } from '../telas/Caixa.tsx';
import { dividir } from '../dominio/ciclo';
import { closeDlg, confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { ACT } from '../acoes.js';

/* KAN-161: valor muito acima do padrão do grupo pergunta antes de gravar ("Corrigir valor" volta ao campo). */
function refGrupo() {
  /* Os mesmos valores que o Caixa usa para cobrar (mensalidade e diária do grupo). */
  const c = cfg();
  return referenciaDoGrupo({
    mensal: c.mensal,
    diaria: c.diaria,
    lancamentos: Object.values(S.caixa || {}),
    hoje: today(),
  });
}
function valorConferido(el, v, ref, campo) {
  if (!foraDoPadrao(v, ref)) return true;
  return (
    confirmou(el, {
      titulo: tx('caixa.foraTitulo', { valor: brl(v) }),
      texto: tx('caixa.foraTexto'),
      acao: tx('caixa.foraLancar'),
      cancelar: tx('caixa.foraCorrigir'),
      fim: () =>
        setTimeout(() => {
          const c = $(campo);
          if (c && !$('#dlgBody .conf')) {
            c.focus();
            c.select?.();
          }
        }, 40),
    }) === 'sim'
  );
}

const acoes = {
  /* KAN-209: a janela é um componente (telas/Caixa.tsx). */
  addLan: () => {
    openDlg('<div id="lanRaiz"></div>');
    dlg.setAttribute('aria-labelledby', 'lanTitulo');
    montarNovoLancamento();
  },
  saveLan: el => {
    const k = val('lk'),
      v = +val('lv'),
      meses = k === 'mensal' ? [...document.querySelectorAll('#lanMeses .lm:checked')].map(x => x.value).sort() : [];
    if (!(v > 0)) {
      toast(tx('caixa.informeValor'));
      return;
    }
    if ((k === 'mensal' || k === 'diaria') && !val('lp2')) {
      toast(tx('caixa.escolhaJogador'));
      return;
    }
    if (k === 'mensal' && !meses.length) {
      toast(tx('caixa.escolhaMes'));
      return;
    }
    if (!valorConferido(el, k === 'mensal' ? v / meses.length : v, refGrupo(), '#lv')) return;
    const d = val('ld') || today(),
      base = { k, pid: val('lp2') || null, d, note: val('ln') };
    closeDlg();
    /* Mensalidade: um lançamento por mês escolhido (KAN-209), com o mês da mensalidade em ref e a data em d. */
    if (k === 'mensal') {
      toast(meses.length > 1 ? tx('caixa.lancamentosSalvos', { n: meses.length }) : tx('caixa.lancamentoSalvo'));
      return Promise.all(
        dividir(v, meses).map(([ref, vm]) => salvarLanc(B.newId(), Object.assign({}, base, { v: vm, ref })))
      );
    }
    let ref = d.slice(0, 7);
    if (k === 'diaria') {
      const r = rodadas().find(r => r.date === d);
      ref = r ? r.id : d;
    }
    toast(tx('caixa.lancamentoSalvo'));
    return salvarLanc(B.newId(), Object.assign({}, base, { v, ref }));
  },
  /* KAN-129: "Recebi" grava na hora e o aviso oferece "Desfazer" por 6 segundos. */
  payPend: el => {
    const p = pendencias(S.month)[+el.dataset.v];
    if (!p) return;
    const id = B.newId(),
      o = { k: p.k, pid: p.pid, v: p.v, d: today(), ref: p.ref, note: '' };
    const r = salvarLanc(id, o);
    toastAcao(tx('caixa.recebido', { nome: pname(p.pid), valor: brl(p.v) }), tx('caixa.desfazer'), () => {
      const d = apagarLanc(id);
      toast(tx('caixa.pagamentoDesfeito'));
      return d;
    });
    return r;
  },
  /* A pagar por jogo (KAN-172): a janela lista os jogos acumulados; Paguei lança uma despesa com o total e as rodadas pagas. */
  abrirPagar: el => {
    openDlg('<div id="apgRaiz"></div>');
    if (!montarPagar(el.dataset.v)) closeDlg();
  },
  pagarJogos: el => {
    const pid = el.dataset.v,
      a = listaAPagar().find(x => x.pid === pid);
    if (!a) return;
    const refs = [...document.querySelectorAll('#apgLista .apg:checked')].map(x => x.value),
      v = Math.round(+val('apgv') * 100) / 100;
    if (!refs.length) {
      toast(tx('caixa.pagarNenhum'));
      return;
    }
    if (!(v > 0)) {
      toast(tx('caixa.pagarValor'));
      $('#apgv')?.focus();
      return;
    }
    if (!valorConferido(el, v, a.v * refs.length, '#apgv')) return;
    const id = B.newId(),
      d = today(),
      o = { k: 'despesa', pid, v, d, ref: d.slice(0, 7), refs, note: tp('caixa.pagamentoPorJogo', refs.length) };
    closeDlg();
    const r = salvarLanc(id, o);
    toastAcao(tx('caixa.pago', { nome: pname(pid), valor: brl(v) }), tx('caixa.desfazer'), () => {
      const x = apagarLanc(id);
      toast(tx('caixa.pagamentoDesfeito'));
      return x;
    });
    return r;
  },
  /* Apagar (depois da confirmação) também oferece "Desfazer": o lançamento volta com o mesmo código. */
  _apagarLan: id => {
    const o = S.caixa[id];
    if (!o) return;
    const r = apagarLanc(id);
    toastAcao(tx('caixa.apagado'), tx('caixa.desfazer'), () => {
      const d = salvarLanc(id, o);
      toast(tx('caixa.apagadoVolta'));
      return d;
    });
    return r;
  },
  avisoAcao: () => usarAvisoAcao(),
  delLan: el => {
    if (
      confirmou(el, {
        titulo: 'Apagar este lançamento?',
        texto: 'O valor sai do saldo e do mês.',
        acao: 'Apagar lançamento',
        perigo: true,
      }) !== 'sim'
    )
      return;
    return ACT._apagarLan(el.dataset.v);
  },
  shareCob: () => {
    const by = {};
    pendencias(S.month).forEach(x => (by[x.pid] = by[x.pid] || []).push(x));
    let t =
      `💰 *${gname()} — pendências de ${fmonth(S.month).toLowerCase()}*\n\n` +
      Object.entries(by)
        .map(
          ([pid, xs]) =>
            `• ${pname(pid)}: ${brl(xs.reduce((s, x) => s + x.v, 0))} (${xs.map(x => x.cob || x.label).join(', ')})`
        )
        .join('\n');
    if (cfg().pix) t += `\n\nPix: ${cfg().pix}`;
    shareDlg('Cobrança', t);
  },
};

export { acoes, refGrupo };
