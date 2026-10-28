/* Ações do afastamento (KAN-208): abrir a janela, salvar, "Voltou", "Manter afastado" e apagar.
   O afastamento fica em privado/afast (permissão de Elenco); "não cobrar" fica em privado/caixa.afIsen
   (permissão de Caixa e Plano A), gravados juntos num lote. Baixam junto com a janela, na primeira vez que
   uma delas é usada (acoes/afastamento.ts só aponta para cá), para a gestão abrir leve. */
import { erroAfastamento, fimAoVoltar, type Afastamento, type Motivo } from '../dominio/afastamento';
import { ptipo } from '../dominio/caixa.js';
import { pname, posso, recurso } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
// O banco é JavaScript sem tipos e é trocado ao iniciar (setB): lido na hora.
const bk = (): any => (banco as any).B;
const { op } = banco as any;
import { afs, isencoes, mesCurto, mesHoje } from '../nucleo/afast';
import { GB, S as estado, w } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { montarAfastamento } from '../ui/AfastamentoJanela';
import { closeDlg, confirmou, dlg, openDlg } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';

const st = (): any => estado;
type El = HTMLElement & { dataset: DOMStringMap };
type Op = { tipo: 'patch'; p: string; o: Record<string, unknown> };

/* "Não cobrar" só aparece para quem tem Caixa no Plano A, e só para mensalista (os outros não pagam mensalidade). */
const comCaixa = (pid: string) => posso('caixa') && recurso('caixa') && ptipo(pid) === 'mensalista';

/* Muda o afastamento no estado e no banco num lote só (as duas fichas juntas). */
function gravar(ops: Op[], local: () => void) {
  local();
  changed();
  return w(GB.lote(ops));
}
function mudarAfast(aid: string, a: Afastamento | null) {
  const S = st();
  S.af = Object.assign({}, S.af);
  if (a) S.af[aid] = a;
  else delete S.af[aid];
}
function mudarIsen(aid: string, i: { pid: string; de: string; ate?: string } | null) {
  const S = st();
  if (!S.pc) return;
  const x = Object.assign({}, S.pc.afIsen);
  if (i) x[aid] = i;
  else delete x[aid];
  S.pc = Object.assign({}, S.pc, { afIsen: x });
}

export function abrirAfastamento(pid: string, aid: string | null) {
  openDlg('<div id="afRaiz"></div>');
  dlg.setAttribute('aria-labelledby', 'afTitulo');
  const el = $('#afRaiz');
  if (el) montarAfastamento(el, pid, aid, comCaixa(pid));
  setTimeout(() => $('#afMot')?.focus(), 50);
}

function voltou(aid: string) {
  const a = afs()[aid];
  if (!a) return;
  const ate = fimAoVoltar(a, mesHoje()),
    caixa = posso('caixa') && recurso('caixa') && !!isencoes()[aid],
    ops: Op[] = [
      { tipo: 'patch', p: 'privado/afast', o: { [aid]: ate ? Object.assign({}, a, { ate }) : op.apagar() } },
    ];
  if (caixa)
    ops.push({
      tipo: 'patch',
      p: 'privado/caixa',
      o: { ['afIsen.' + aid]: ate ? Object.assign({}, isencoes()[aid], { ate }) : op.apagar() },
    });
  closeDlg();
  toast(
    ate
      ? tx('afast.voltouFeito', { nome: pname(a.pid), mes: mesCurto(ate) })
      : tx('afast.voltouCancelado', { nome: pname(a.pid) })
  );
  return gravar(ops, () => {
    mudarAfast(aid, ate ? Object.assign({}, a, { ate }) : null);
    if (caixa) mudarIsen(aid, ate ? Object.assign({}, isencoes()[aid], { ate }) : null);
  });
}

export const acoes = {
  afastarDlg: (el: El) => {
    const pid = el.dataset.p || '';
    if (!pid || !posso('elenco')) return;
    return abrirAfastamento(pid, el.dataset.v || null);
  },
  afSalvar: (el: El) => {
    const pid = el.dataset.p || '',
      aid0 = el.dataset.v || '',
      val = (id: string) => (($('#' + id) as HTMLInputElement | null)?.value || '').trim(),
      x = { mot: val('afMot'), de: val('afDe'), ate: val('afAte') },
      erro = erroAfastamento(x);
    if (erro) {
      toast(tx(erro));
      $(erro === 'afast.erroFim' ? '#afAte' : erro === 'afast.erroInicio' ? '#afDe' : '#afMot')?.focus();
      return;
    }
    const aid = aid0 || bk().newId(),
      antes = afs()[aid],
      a: Afastamento = {
        pid,
        mot: x.mot as Motivo,
        obs: val('afObs').slice(0, 60),
        de: x.de,
        ate: x.ate,
        em: antes?.em || Date.now(),
      };
    if (antes?.ign) a.ign = antes.ign;
    const ops: Op[] = [{ tipo: 'patch', p: 'privado/afast', o: { [aid]: a } }],
      caixa = comCaixa(pid),
      naoCobra =
        caixa && (document.querySelector('input[name=afCobra]:checked') as HTMLInputElement | null)?.value === 'nao',
      isen = { pid, de: a.de, ate: a.ate };
    if (caixa) ops.push({ tipo: 'patch', p: 'privado/caixa', o: { ['afIsen.' + aid]: naoCobra ? isen : op.apagar() } });
    closeDlg();
    toast(tx('afast.salvo', { nome: pname(pid) }));
    return gravar(ops, () => {
      mudarAfast(aid, a);
      if (caixa) mudarIsen(aid, naoCobra ? isen : null);
    });
  },
  afVoltou: (el: El) => {
    if (!posso('elenco')) return;
    return voltou(el.dataset.v || '');
  },
  /* O afastado confirmou pelo link e continua afastado: o aviso some nesta rodada. */
  afManter: (el: El) => {
    const aid = el.dataset.v || '',
      rid = el.dataset.r || '',
      a = afs()[aid];
    if (!a || !posso('elenco')) return;
    const n = Object.assign({}, a, { ign: rid });
    return gravar([{ tipo: 'patch', p: 'privado/afast', o: { [aid + '.ign']: rid } }], () => mudarAfast(aid, n));
  },
  afApagar: (el: El) => {
    const aid = el.dataset.v || '';
    if (!afs()[aid] || !posso('elenco')) return;
    if (
      confirmou(el, {
        titulo: tx('afast.apagarTitulo'),
        texto: tx('afast.apagarTexto'),
        acao: tx('afast.apagarAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    const caixa = posso('caixa') && recurso('caixa') && !!isencoes()[aid],
      ops: Op[] = [{ tipo: 'patch', p: 'privado/afast', o: { [aid]: op.apagar() } }];
    if (caixa) ops.push({ tipo: 'patch', p: 'privado/caixa', o: { ['afIsen.' + aid]: op.apagar() } });
    closeDlg();
    toast(tx('afast.apagado'));
    return gravar(ops, () => {
      mudarAfast(aid, null);
      if (caixa) mudarIsen(aid, null);
    });
  },
};
