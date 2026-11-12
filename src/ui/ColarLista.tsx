/* Janela "Colar lista do WhatsApp" da aba Rodada (KAN-244, pelada-v113). Baixa só quando aberta (acoes/colar-lista.ts).
   Passo 1: o organizador cola o texto. Passo 2: a prévia mostra quem vai, quem não vai e quem está sem marca, com cada
   nome casado com o elenco ou os avulsos (dominio/lista-colada.ts); ele ajusta e toca em "Marcar na rodada".
   Grava como se tivesse marcado um por um: a presença de cada um (na ordem colada) e, para quem é novo, o avulso ou o
   jogador do elenco. Nada vai para o link: é só da gestão. */
import { posKeys, sport } from '../dominio/esportes.js';
import { editPc } from '../dominio/caixa-gestao';
import { curRodada, players, pname, posso } from '../dominio/grupo.js';
import { casar, lerLista, posicaoDe, type LinhaLida } from '../dominio/lista-colada';
import estilo from '../estilos/colar.css' with { type: 'text' };
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-colar';
import * as banco from '../nucleo/backend.js';
import { setPres } from '../nucleo/edicoes.js';
import { GB, S, clean, w } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { closeDlg, confirmou, openDlg, val } from './dialogos.js';
import { usarEstilo } from './estilo';
import { changed } from './render.js';

juntarTextos(textos);
usarEstilo('colar', estilo);

type El = HTMLElement & { dataset: DOMStringMap };
type Obj = Record<string, any>;
const st = (): Obj => S as Obj;
const novoId = (): string => (banco as Obj).B.newId();

/* O texto colado fica guardado enquanto a janela está aberta, para o "Voltar" não perder nada. */
let texto = '';
let lidas: LinhaLida[] = [];

function Passo1() {
  return (
    <>
      <h3>{tx('colar.titulo')}</h3>
      <p class="small muted">{tx('colar.ajuda')}</p>
      <label class="f">
        <span>{tx('colar.campo')}</span>
        <textarea class="inp colar-texto" id="colarTexto" placeholder={tx('colar.exemplo')} value={texto}></textarea>
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="colarLer">
          {tx('colar.ler')}
        </button>
      </div>
    </>
  );
}

type Opcoes = { elenco: { id: string; nome: string }[]; avulsos: { id: string; nome: string }[]; podeElenco: boolean };

function Linha({ l, i, op }: { l: LinhaLida; i: number; op: Opcoes }) {
  const c = casar(l.nome, op.elenco, op.avulsos);
  const valor = c.tipo === 'novo' ? 'novo:avulso' : c.id;
  const dica =
    c.tipo === 'parecido'
      ? tx('colar.parecido', { nome: pname(c.id) })
      : c.tipo === 'novo'
        ? tx('colar.novo')
        : l.espera
          ? tx('colar.espera')
          : '';
  return (
    <li class="colar-linha" data-i={i}>
      <span class="colar-nome">
        {l.nome}
        {dica ? <span class="small muted">{dica}</span> : null}
      </span>
      <select
        class="sel colar-sel"
        data-i={i}
        data-avulso={l.avulso ? '1' : ''}
        aria-label={tx('colar.quem', { nome: l.nome })}
      >
        <optgroup label={tx('colar.optElenco')}>
          {op.elenco.map(p => (
            <option key={p.id} value={p.id} selected={p.id === valor}>
              {p.nome}
            </option>
          ))}
        </optgroup>
        {op.avulsos.length ? (
          <optgroup label={tx('colar.optAvulsos')}>
            {op.avulsos.map(p => (
              <option key={p.id} value={p.id} selected={p.id === valor}>
                {p.nome}
              </option>
            ))}
          </optgroup>
        ) : null}
        <option value="novo:avulso" selected={valor === 'novo:avulso'}>
          {tx('colar.novoAvulso')}
        </option>
        {op.podeElenco ? <option value="novo:elenco">{tx('colar.novoElenco')}</option> : null}
        <option value="">{tx('colar.ignorar')}</option>
      </select>
    </li>
  );
}

function Previa({ op, times }: { op: Opcoes; times: boolean }) {
  const vao = lidas.map((l, i) => [l, i] as const).filter(([l]) => l.s === 'in'),
    nao = lidas.map((l, i) => [l, i] as const).filter(([l]) => l.s === 'out'),
    sem = lidas.filter(l => !l.s);
  const temNovo = lidas.some(l => l.s && casar(l.nome, op.elenco, op.avulsos).tipo === 'novo' && !l.avulso);
  return (
    <>
      <h3>{tx('colar.conferir')}</h3>
      <p class="small muted" id="colarResumo">
        {tx('colar.resumo', { vao: vao.length, nao: nao.length, sem: sem.length })}
      </p>
      {times ? (
        <p class="warn-alt" role="status">
          {tx('colar.timesFeitos')}
        </p>
      ) : null}
      {op.podeElenco && temNovo ? (
        <button class="btn sm" data-a="colarTodosElenco" id="colarTodosElenco">
          {tx('colar.todosElenco')}
        </button>
      ) : null}
      {vao.length ? (
        <>
          <h4 class="colar-grupo">{tx('colar.vao', { n: vao.length })}</h4>
          <ul class="plist" id="colarVao">
            {vao.map(([l, i]) => (
              <Linha key={i} l={l} i={i} op={op} />
            ))}
          </ul>
        </>
      ) : null}
      {nao.length ? (
        <>
          <h4 class="colar-grupo">{tx('colar.naoVao', { n: nao.length })}</h4>
          <ul class="plist" id="colarNao">
            {nao.map(([l, i]) => (
              <Linha key={i} l={l} i={i} op={op} />
            ))}
          </ul>
        </>
      ) : null}
      {sem.length ? (
        <p class="small muted colar-sem" id="colarSem">
          {tx('colar.semMarca', { nomes: sem.map(l => l.nome).join(', ') })}
        </p>
      ) : null}
      <div class="dlg-f">
        <button class="btn" data-a="colarVoltar">
          {tx('colar.voltar')}
        </button>
        <button class="btn primary" data-a="colarGravar">
          {tx('colar.marcar')}
        </button>
      </div>
    </>
  );
}

function opcoes(): Opcoes {
  const avul = st().avul || {};
  return {
    elenco: players().map((p: Obj) => ({ id: p.id, nome: p.name })),
    avulsos: Object.entries(avul as Record<string, Obj>)
      .filter(([id]) => !st().jog[id])
      .map(([id, a]) => ({ id, nome: a.nome as string }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    podeElenco: posso('elenco'),
  };
}

export function abrir() {
  const r = curRodada();
  if (!r) return;
  if (r.locked) return void toast(tx('colar.fechada'));
  texto = '';
  openDlg(<Passo1 />);
}

export const acoes: Record<string, (el: El) => unknown> = {
  colarLista: () => abrir(),
  colarLer: () => {
    texto = val('colarTexto');
    lidas = lerLista(texto);
    if (!lidas.length) {
      toast(tx('colar.semNomes'));
      ($('#colarTexto') as HTMLTextAreaElement | null)?.focus();
      return;
    }
    const r = curRodada();
    openDlg(<Previa op={opcoes()} times={!!(r && r.times)} />);
  },
  colarVoltar: () => openDlg(<Passo1 />),
  colarTodosElenco: () => {
    document.querySelectorAll<HTMLSelectElement>('#dlg .colar-sel').forEach(s => {
      if (s.value === 'novo:avulso' && !s.dataset.avulso) s.value = 'novo:elenco';
    });
  },
  colarGravar: el => {
    const r = curRodada();
    if (!r) return;
    if (r.locked) return void toast(tx('colar.fechada'));
    /* Cada pessoa uma vez só: a primeira linha que aponta para ela vale. */
    const usados = new Set<string>();
    const escolhas: { l: LinhaLida; v: string }[] = [];
    document.querySelectorAll<HTMLSelectElement>('#dlg .colar-sel').forEach(s => {
      const l = lidas[+(s.dataset.i || 0)],
        v = s.value;
      if (!l || !l.s || !v) return;
      if (!v.startsWith('novo:')) {
        if (usados.has(v)) return;
        usados.add(v);
      }
      escolhas.push({ l, v });
    });
    if (!escolhas.length) return void toast(tx('colar.nada'));
    if (
      r.times &&
      confirmou(el, {
        titulo: tx('colar.titulo'),
        texto: tx('colar.timesFeitos'),
        acao: tx('colar.marcar'),
      }) !== 'sim'
    )
      return;
    const ks = posKeys(),
      chaveGol = sport().key,
      agora = Date.now(),
      lote: { tipo: string; p: string; o: unknown }[] = [],
      novosElenco: string[] = [],
      ps: unknown[] = [];
    st().avul = st().avul || {};
    /* A ordem colada vira a ordem de confirmação (a espera já vem no fim). */
    escolhas.forEach(({ l, v }, i) => {
      const pos = posicaoDe(l, ks, chaveGol),
        t = agora + i;
      if (v === 'novo:elenco') {
        const id = novoId(),
          d = { criado: agora, name: l.nome, pos, ativo: true };
        st().jog[id] = d;
        novosElenco.push(id);
        lote.push({ tipo: 'set', p: 'jogadores/' + id, o: clean(d) });
        ps.push(() => setPres(r.id, id, { s: l.s as string, t }));
      } else if (v === 'novo:avulso') {
        const id = novoId(),
          o = { nome: l.nome, pos, criado: agora };
        st().avul[id] = o;
        lote.push({ tipo: 'set', p: 'avulsos/' + id, o: clean(o) });
        ps.push(() => setPres(r.id, id, { s: l.s as string, t, nome: l.nome, avulso: true, pos }));
      } else if (st().jog[v]) {
        ps.push(() => setPres(r.id, v, Object.assign({}, st().pres[v] || {}, { s: l.s as string, t })));
      } else {
        const a = st().avul[v] || {};
        ps.push(() => setPres(r.id, v, { s: l.s as string, t, nome: a.nome, avulso: true, pos: a.pos || '' }));
      }
    });
    const feitos: unknown[] = [];
    if (lote.length) feitos.push(w(GB.lote(lote)));
    if (novosElenco.length) feitos.push(editPc((a: Obj) => novosElenco.forEach(id => (a.tipos[id] = 'mensalista'))));
    (ps as (() => unknown)[]).forEach(f => feitos.push(f()));
    const vao = escolhas.filter(e => e.l.s === 'in').length;
    changed();
    closeDlg();
    toast(tx('colar.feito', { vao, nao: escolhas.length - vao }));
    return Promise.all(feitos);
  },
};
