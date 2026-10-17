/* Ações: Caixa: lançamentos, pendências e cobrança. Fazem parte de ACT (src/acoes.js). */
import { cfg } from '../dominio/caixa.js';
import { foraDoPadrao, referenciaDoGrupo } from '../dominio/caixa-regras';
import { gname, players, pname, rodadas } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import { simboloMoeda } from '../i18n/formatos.js';
import { shareDlg } from '../dominio/whatsapp.js';
import { B } from '../nucleo/backend.js';
import { apagarLanc, salvarLanc } from '../nucleo/partidas.js';
import { S } from '../nucleo/estado.js';
import { $, brl, esc, fmonth, toast, toastAcao, today, usarAvisoAcao } from '../nucleo/util.js';
import { listaAPagar, montarPagar, pendencias } from '../telas/Caixa.tsx';
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
  addLan: () => {
    const o = players()
      .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join('');
    openDlg(`<h3>Novo lançamento</h3>
    <label class="f"><span>Tipo</span><select class="sel" id="lk"><option value="mensal">Mensalidade</option><option value="diaria">Diária</option><option value="entrada">Outra entrada</option><option value="despesa">Despesa (quadra, bola, coletes…)</option></select></label>
    <label class="f"><span>Jogador (opcional para despesa)</span><select class="sel" id="lp2"><option value="">—</option>${o}</select></label>
    <div class="row"><label class="f" style="flex:1"><span>${tx('caixa.valorMoeda', { moeda: simboloMoeda() })}</span><input class="inp" type="number" min="0" step="0.01" id="lv" value="${cfg().mensal}"></label><label class="f" style="flex:1"><span>Data</span><input class="inp" type="date" id="ld" value="${today()}"></label></div>
    <label class="f"><span>Descrição</span><input class="inp" id="ln" maxlength="60"></label>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveLan">Lançar</button></div>`);
  },
  saveLan: el => {
    const k = val('lk'),
      v = +val('lv');
    if (!(v > 0)) {
      toast('Informe um valor.');
      return;
    }
    if ((k === 'mensal' || k === 'diaria') && !val('lp2')) {
      toast('Escolha o jogador.');
      return;
    }
    if (!valorConferido(el, v, refGrupo(), '#lv')) return;
    const d = val('ld') || today();
    let ref = d.slice(0, 7);
    if (k === 'diaria') {
      const r = rodadas().find(r => r.date === d);
      ref = r ? r.id : d;
    }
    const id = B.newId(),
      o = { k, pid: val('lp2') || null, v, d, ref, note: val('ln') };
    closeDlg();
    toast('Lançamento salvo.');
    return salvarLanc(id, o);
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
          ([pid, xs]) => `• ${pname(pid)}: ${brl(xs.reduce((s, x) => s + x.v, 0))} (${xs.map(x => x.label).join(', ')})`
        )
        .join('\n');
    if (cfg().pix) t += `\n\nPix: ${cfg().pix}`;
    shareDlg('Cobrança', t);
  },
};

export { acoes, refGrupo };
