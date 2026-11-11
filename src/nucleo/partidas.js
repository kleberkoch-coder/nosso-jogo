import {
  camposEdicao,
  camposLancamento,
  camposMensal,
  aplicar,
  camposPartida,
  camposVotacao,
  caixaAntigo,
  mesDe,
  resumirTudo,
  semCaixa,
  soCaixa,
  vazio,
} from '../dominio/resumos.ts';
import { isOwnerMe, posso, rodById } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { B, op } from './backend.js';
import { GB, S, clean, gp, w } from './estado.js';
import { cl, toast } from './util.js';
import { changed } from '../ui/render.js';
import { partidasDe } from './partidas-lista.js';

/* ---------- Partidas na subpasta da rodada (D10, KAN-86) e totais por mês (D11, KAN-87) ----------
   Partida: grupos/{gid}/rodadas/{rid}/partidas/{id}. A ficha da rodada guarda só a contagem (np).
   Resumo do mês: grupos/{gid}/resumos/{AAAA-MM}. Cada gravação vai num lote junto com o ajuste do resumo:
   ou entra tudo, ou nada (também sem internet). As somas usam o incremento do servidor, então
   dois administradores salvando ao mesmo tempo não se apagam (D4). O botão Recalcular refaz do zero. */

const VERSAO_DADOS = 18;
const LOTE = 200; // o Firestore aceita até 500 gravações por lote; menos, para folgar nas checagens das regras

/* Campos da regra (resumos.ts) → campos de gravação. */
function patchResumo(c) {
  const o = { mes: c.mes, at: Date.now() };
  Object.entries(c.somar).forEach(([k, n]) => {
    o[k] = op.somar(n);
  });
  Object.entries(c.gravar).forEach(([k, v]) => {
    o[k] = clean(v);
  });
  c.apagar.forEach(k => {
    o[k] = op.apagar();
  });
  return o;
}
/* Mesmo ajuste no resumo em memória, para a tela mudar na hora (otimista). */
function localResumo(c) {
  if (!S.res || !c.mes) return;
  const d = cl(S.res[c.mes]) || vazio(c.mes);
  Object.entries(c.somar).forEach(([k, n]) => {
    const ps = k.split('.'),
      f = ps.pop();
    let a = d;
    ps.forEach(p => {
      a = a[p] = a[p] || {};
    });
    a[f] = (a[f] || 0) + n;
  });
  Object.entries(c.gravar).forEach(([k, v]) => {
    const ps = k.split('.'),
      f = ps.pop();
    let a = d;
    ps.forEach(p => {
      a = a[p] = a[p] || {};
    });
    a[f] = cl(v);
  });
  c.apagar.forEach(k => {
    const ps = k.split('.'),
      f = ps.pop();
    let a = d;
    ps.forEach(p => {
      a = a[p] = a[p] || {};
    });
    delete a[f];
  });
  S.res[c.mes] = d;
}
/* Sem mês (lançamento antigo sem data) não há ficha a ajustar. */
function opResumo(c) {
  if (!c.mes) return null;
  localResumo(c);
  return { tipo: 'patch', p: 'resumos/' + c.mes, o: patchResumo(c) };
}
const sem = ops => ops.filter(Boolean);
/* KAN-207: os totais do caixa vão para grupos/{gid}/resumosCaixa/{mês}, que só quem tem a permissão de Caixa lê. */
function opResumoCaixa(c) {
  if (!c.mes) return null;
  if (S.resCx) S.resCx[c.mes] = aplicar(cl(S.resCx[c.mes]) || { mes: c.mes, cx: {} }, c);
  return { tipo: 'patch', p: 'resumosCaixa/' + c.mes, o: patchResumo(c) };
}

/* KAN-213: outras partes (o rateio, sob demanda com o Caixa) somam no mesmo lote do lançamento. */
const extrasLanc = [];
const aoLancar = f => extrasLanc.push(f);

/* Partidas da rodada aberta, na ordem em que foram salvas. */

/* Caixa: lançamento junto com o resumo do mês. */
function salvarLanc(id, o) {
  S.caixa[id] = o;
  const ops = [
    { tipo: 'set', p: 'caixa/' + id, o: clean(o) },
    opResumoCaixa(camposLancamento(o, 1)),
    opResumoCaixa(camposMensal(o, 1)),
    ...extrasLanc.map(f => f(o, 1)),
  ];
  changed();
  return w(GB.lote(sem(ops)));
}
function apagarLanc(id) {
  const o = S.caixa[id];
  if (!o) return Promise.resolve();
  delete S.caixa[id];
  const ops = [
    { tipo: 'del', p: 'caixa/' + id },
    opResumoCaixa(camposLancamento(o, -1)),
    opResumoCaixa(camposMensal(o, -1)),
    ...extrasLanc.map(f => f(o, -1)),
  ];
  changed();
  return w(GB.lote(sem(ops)));
}

/* Votação: ao encerrar soma destaques e bagres; ao reabrir ou apagar uma encerrada, desconta. */
function gravarVotacao(vid, antes, depois) {
  const ops = [];
  if (antes && !antes.open && antes.resultado) ops.push(opResumo(camposVotacao(antes, -1)));
  if (depois && !depois.open && depois.resultado) ops.push(opResumo(camposVotacao(depois, 1)));
  ops.unshift(depois ? { tipo: 'set', p: 'votacoes/' + vid, o: clean(depois) } : { tipo: 'del', p: 'votacoes/' + vid });
  changed();
  return w(GB.lote(sem(ops)));
}

/* Excluir a rodada tira as partidas dela do ranking (desconta dos resumos). */
async function apagarPartidasDaRodada(rid, date) {
  const d = S.rod[rid] || {};
  if (!(d.np > 0) && !(d.matches || []).length) return;
  const ps = await (await tarefas()).lerPartidas([[rid, d]]),
    ops = [];
  ps.forEach(p => {
    if (!p._antiga) ops.push({ tipo: 'del', p: 'rodadas/' + rid + '/partidas/' + p.id });
    ops.push(opResumo(camposPartida(p, rid, p.date || date, -1)));
  });
  await w(enviar(sem(ops)));
}

/* Lotes de até 400 gravações. */
async function enviar(ops) {
  for (let i = 0; i < ops.length; i += LOTE) await GB.lote(ops.slice(i, i + LOTE));
}

/* KAN-66 (pelada-v107): o que só a Partida, o Ranking e as migrações usam (gravar partidas, recalcular e mover os
   dados antigos) fica em nucleo/partidas-tarefas.ts e baixa quando precisa, para a gestão caber nos 90 KB.
   As conferências baratas ficam aqui: grupo já migrado não baixa nada. */
const tarefas = () => import('./partidas-tarefas');
function migrar() {
  if (S.migrandoDados || !S.dataOn || !S.loaded.migr || !S.loaded.vot) return;
  if (((S.migr || {}).v || 0) >= VERSAO_DADOS) return;
  return tarefas().then(m => m.migrar());
}
function migrarCaixa() {
  if (!S.dataOn || !isOwnerMe() || ((S.migr || {}).v || 0) < VERSAO_DADOS || (S.migr || {}).cx) return;
  return tarefas().then(m => m.migrarCaixa());
}
function migrarMensal() {
  if (!S.dataOn || !posso('caixa') || !S.loaded.migr || (S.migr || {}).mens) return;
  if (((S.migr || {}).v || 0) < VERSAO_DADOS) return;
  return tarefas().then(m => m.migrarMensal());
}
const recalcular = periodo => tarefas().then(m => m.recalcular(periodo));

/* Aparelho com versão antiga ainda pode gravar partida dentro da ficha da rodada: move na hora. */
const movendo = new Set(),
  falhou = {};
function verificarRodadas() {
  if (((S.migr || {}).v || 0) < VERSAO_DADOS || !S.dataOn) return;
  Object.entries(S.rod || {}).forEach(([rid, r]) => {
    if (!(r.matches || []).length || movendo.has(rid) || (falhou[rid] && Date.now() - falhou[rid] < 60000)) return;
    movendo.add(rid);
    /* Criar a partida só funciona se ela ainda não existe: se outro aparelho já moveu, o lote é recusado e nada conta em dobro. */
    const ops = [];
    r.matches.forEach((m, i) => {
      const id = m.id || rid + '-' + i;
      ops.push({
        tipo: 'set',
        p: 'rodadas/' + rid + '/partidas/' + id,
        o: clean(Object.assign({}, m, { id, rid, date: r.date })),
      });
      ops.push(opResumo(camposPartida(Object.assign({ id }, m), rid, r.date, 1)));
    });
    ops.push({
      tipo: 'patch',
      p: 'rodadas/' + rid,
      o: { matches: op.remover(r.matches.map(cl)), np: op.somar(r.matches.length) },
    });
    GB.lote(sem(ops))
      .catch(e => {
        console.warn('mover partidas', e);
        falhou[rid] = Date.now();
      })
      .finally(() => movendo.delete(rid));
  });
}

export {
  VERSAO_DADOS,
  enviar,
  migrarCaixa,
  migrarMensal,
  opResumo,
  sem,
  aoLancar,
  apagarLanc,
  apagarPartidasDaRodada,
  gravarVotacao,
  migrar,
  partidasDe,
  recalcular,
  salvarLanc,
  verificarRodadas,
};
