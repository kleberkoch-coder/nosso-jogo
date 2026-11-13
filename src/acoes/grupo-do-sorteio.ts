/* "Salvar como meu grupo" do sorteio sem conta (KAN-245, pelada-v114). Baixa só quando há um sorteio guardado no
   aparelho (telas/SorteioRapido.tsx, chave RASCUNHO) e a pessoa já entrou na conta.
   1. Abre o "Novo grupo" com o esporte e o tamanho do time do sorteio, e um aviso do que vem junto.
   2. "Criar grupo" faz o de sempre (createGroup: limite do plano, conta bloqueada…); se o grupo nasceu, espera ele
      carregar e grava: os jogadores (mensalistas, com posição e nota) e uma rodada de hoje com os times sorteados e
      todos confirmados, na ordem da lista. Aí apaga o rascunho.
   3. Se o grupo não nasceu (limite do plano, sem internet), o sorteio continua guardado: nada se perde. */
import { render } from 'preact';
import { editPc } from '../dominio/caixa-gestao';
import { posso, setLvl } from '../dominio/grupo.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-grupodosorteio';
import * as banco from '../nucleo/backend.js';
import { editRat, editRod, setPres } from '../nucleo/edicoes.js';
import { GB, S, clean, w } from '../nucleo/estado.js';
import { $, toast, today } from '../nucleo/util.js';
import { ACT } from '../acoes.js';
import { closeDlg, dlg } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';

juntarTextos(textos);

const RASCUNHO = 'nj-sorteio-rapido';
type Obj = Record<string, any>;
type El = HTMLElement & { dataset: DOMStringMap };
type Jog = { nome: string; pos?: string; nota?: number };
type Rascunho = {
  v: 1;
  esporte: string;
  porTime: number;
  js: Jog[];
  times: { players: number[]; res: number[] }[];
  em: number;
};
const st = (): Obj => S as Obj;
const novoId = (): string => (banco as Obj).B.newId();
const act = (): Record<string, (el: unknown) => unknown> => ACT as Record<string, (el: unknown) => unknown>;

function ler(): Rascunho | null {
  try {
    const d = JSON.parse(localStorage.getItem(RASCUNHO) || 'null');
    return d && d.v === 1 && Array.isArray(d.js) && d.js.length ? d : null;
  } catch (e) {
    return null;
  }
}
function apagar() {
  try {
    localStorage.removeItem(RASCUNHO);
  } catch (e) {
    /* sem armazenamento */
  }
}

/* Abre o "Novo grupo" já com o esporte do sorteio. Não abre de novo se já estiver aberto. */
/* No limite de grupos do plano, o "Novo grupo" mostra os planos; isso acontece uma vez por visita, não a cada volta à
   página inicial (o sorteio continua guardado). */
let avisouLimite = false;
export async function abrir() {
  const d = ler();
  if (!d || avisouLimite || (dlg.open && $('#dlg [data-a=criarGrupoDoSorteio]'))) return;
  await act().newGroup({ dataset: {} });
  if (!$('#ngRaiz')) avisouLimite = true;
  const raiz = $('#ngRaiz') as HTMLElement | null,
    b = $('#dlg [data-a=createGroup]') as HTMLElement | null;
  if (!raiz || !b) return;
  const m = await import('../telas/GrupoForm');
  render(null, raiz);
  m.montarGrupoForm({ sport: d.esporte, cfg: { porTime: d.porTime } } as Obj, false);
  b.dataset.a = 'criarGrupoDoSorteio';
  const aviso = document.createElement('p');
  aviso.className = 'warn-alt';
  aviso.id = 'ngDoSorteio';
  aviso.setAttribute('role', 'status');
  aviso.textContent = tx('srg.aviso', { n: d.js.length }) + ' ';
  /* Quem desistiu de salvar descarta o sorteio (senão o "Novo grupo" volta a abrir na página inicial). */
  const descartar = document.createElement('button');
  descartar.className = 'linkbtn';
  descartar.dataset.a = 'descartarSorteio';
  descartar.textContent = tx('srg.descartar');
  aviso.append(descartar);
  raiz.before(aviso);
  setTimeout(() => ($('#ngn') as HTMLInputElement | null)?.focus(), 50);
}

/* Espera o grupo novo abrir (dados e permissões carregados), até 20 s. */
function esperarGrupo(gid: string): Promise<boolean> {
  return new Promise(ok => {
    let n = 0;
    const t = setInterval(() => {
      const L = st().loaded || {};
      const pronto = st().gid === gid && st().app && L.mem && L.jog && L.rat && L.rodF && (!posso('caixa') || L.pc);
      if (pronto || ++n > 100) {
        clearInterval(t);
        ok(!!pronto);
      }
    }, 200);
  });
}

function gravar(d: Rascunho) {
  const agora = Date.now(),
    ids = d.js.map(() => novoId()),
    rid = novoId(),
    lote: { tipo: string; p: string; o: unknown }[] = [];
  d.js.forEach((j, i) => {
    const o = { criado: agora, name: j.nome, pos: j.pos || '', ativo: true };
    st().jog[ids[i]!] = o;
    lote.push({ tipo: 'set', p: 'jogadores/' + ids[i], o: clean(o) });
  });
  const ps: unknown[] = [w(GB.lote(lote))];
  ps.push(editPc((a: Obj) => ids.forEach(id => (a.tipos[id] = 'mensalista'))));
  if (d.js.some(j => j.nota)) ps.push(editRat((a: Obj) => d.js.forEach((j, i) => j.nota && setLvl(a, ids[i], j.nota))));
  const em = Math.round(d.em || agora),
    info: Obj = {};
  d.js.forEach((j, i) => (info[ids[i]!] = { n: j.nome, p: j.pos || '' }));
  st().rid = rid;
  editRod(rid, r =>
    Object.assign(r, {
      date: today(),
      time: '',
      place: '',
      locked: true,
      times: d.times.map((t, i) =>
        Object.assign(
          { c: i, players: t.players.map(p => ids[p]) },
          t.res.length ? { res: t.res.map(p => ids[p]) } : {}
        )
      ),
      info,
      drawnAt: em,
      sor: { n: 1, em, aj: 0 },
      base: ids.slice(),
      createdAt: agora,
    })
  );
  ids.forEach((id, i) => ps.push(setPres(rid, id, { s: 'in', t: agora + i })));
  apagar();
  changed();
  toast(tx('srg.pronto', { n: ids.length }));
  return Promise.all(ps);
}

export const acoes: Record<string, (el: El) => unknown> = {
  descartarSorteio: () => {
    apagar();
    closeDlg();
    toast(tx('srg.descartado'));
  },
  criarGrupoDoSorteio: async el => {
    const d = ler(),
      antes = location.hash;
    await act().createGroup(el);
    const m = /^#\/g\/([^/]+)/.exec(location.hash);
    if (!d || !m || location.hash === antes) return;
    /* Mesmo se demorar, grava quando o grupo novo já está aberto (o que faltou carregar chega depois). */
    if (!(await esperarGrupo(m[1]!)) && st().gid !== m[1]) return void toast(tx('srg.demorou'));
    return gravar(d);
  },
};
Object.assign(ACT, acoes);

/* Para o teste: há um sorteio guardado esperando virar grupo? */
export const temRascunho = () => !!ler();
