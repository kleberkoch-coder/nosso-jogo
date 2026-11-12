/* Sortear times agora, sem cadastro (KAN-245, pelada-v114). Tela de quem ainda não tem conta (#/sortear), aberta pela
   apresentação e pela tela de entrar. Baixa só quando aberta e não grava nada no banco: tudo fica no aparelho.
   1. Esporte, jogadores por time e os nomes (colar a lista do WhatsApp ou um por linha; quem tem ❌ fica de fora).
   2. Posição e nota de cada um (as duas opcionais).
   3. Os times, com o mesmo sorteio do app, o WhatsApp (sem as notas) e "Salvar como meu grupo": guarda o sorteio no
      aparelho (RASCUNHO) e leva ao cadastro; a gestão cria o grupo já com tudo (acoes/grupo-do-sorteio.ts). */
import { render } from 'preact';
import { COL, SPORTS, corClara, porTimePadrao } from '../dominio/esportes.js';
import { WA } from '../dominio/contato';
import { lerLista, posicaoDe } from '../dominio/lista-colada';
import { sortearRapido, textoRapido, type JogadorRapido, type TimeRapido } from '../dominio/sorteio-rapido';
import estilo from '../estilos/sorteio-rapido.css' with { type: 'text' };
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-sorteiorapido';
import { ACT } from '../acoes.js';
import { S } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { usarEstilo } from '../ui/estilo';

juntarTextos(textos);
usarEstilo('sorteio-rapido', estilo);

export const RASCUNHO = 'nj-sorteio-rapido';
type Obj = Record<string, any>;
type Passo = 1 | 2 | 3;
type Rascunho = { v: 1; esporte: string; porTime: number; js: JogadorRapido[]; times: TimeRapido[]; em: number };

const est: { passo: Passo; esporte: string; porTime: number; texto: string; js: JogadorRapido[]; times: TimeRapido[] } =
  {
    passo: 1,
    esporte: 'futebol',
    porTime: porTimePadrao('futebol'),
    texto: '',
    js: [],
    times: [],
  };

const sp = (): Obj => (SPORTS as Obj)[est.esporte] || (SPORTS as Obj).futebol;
const duplas = () => est.porTime === 2;
const posicoes = (): string[][] => (duplas() ? [] : sp().pos || []);
const nomeTime = (i: number) => tx(duplas() ? 'time.dupla' : 'time.nome', { n: i + 1 });

/* Volta ao último sorteio guardado (quem tocou em "Salvar como meu grupo" e voltou não perde nada). */
function lerRascunho(): Rascunho | null {
  try {
    const d = JSON.parse(localStorage.getItem(RASCUNHO) || 'null');
    return d && d.v === 1 && Array.isArray(d.js) && Array.isArray(d.times) ? d : null;
  } catch (e) {
    return null;
  }
}

function Passo1() {
  return (
    <div class="panel sr" id="srPasso1">
      <h2 class="sr-titulo">{tx('sr.titulo')}</h2>
      <p class="small muted">{tx('sr.sub')}</p>
      <div class="sr-grade">
        <label class="f">
          <span>{tx('sr.esporte')}</span>
          <select class="sel" id="srEsporte">
            {Object.keys(SPORTS).map(k => (
              <option key={k} value={k} selected={k === est.esporte}>
                {(SPORTS as Obj)[k].e} {(SPORTS as Obj)[k].n}
              </option>
            ))}
          </select>
        </label>
        <label class="f">
          <span>{tx('sr.porTime')}</span>
          <input class="inp" id="srPorTime" type="number" inputMode="numeric" min={1} max={30} value={est.porTime} />
        </label>
      </div>
      <label class="f">
        <span>{tx('sr.nomes')}</span>
        <textarea class="inp sr-nomes" id="srNomes" placeholder={tx('sr.nomesEx')} value={est.texto}></textarea>
      </label>
      <p class="small muted">{tx('sr.nomesAjuda')}</p>
      <button class="btn primary sr-acao" data-a="srLer">
        {tx('sr.continuar')}
      </button>
    </div>
  );
}

function Passo2() {
  const ps = posicoes();
  return (
    <div class="panel sr" id="srPasso2">
      <h2 class="sr-titulo">{tx('sr.ajustar', { n: est.js.length })}</h2>
      <p class="small muted">{tx(ps.length ? 'sr.ajustarAjuda' : 'sr.ajustarAjudaSemPos')}</p>
      <ul class="plist" id="srLista">
        {est.js.map((j, i) => (
          <li key={i} class="sr-linha">
            <span class="sr-nome">{j.nome}</span>
            {ps.length ? (
              <select class="sel sr-pos" data-i={i} aria-label={tx('sr.posDe', { nome: j.nome })}>
                <option value="">{tx('sr.semPos')}</option>
                {ps.map(p => (
                  <option key={p[0]} value={p[0]} selected={p[0] === j.pos}>
                    {p[1]}
                  </option>
                ))}
              </select>
            ) : null}
            <select class="sel sr-nota" data-i={i} aria-label={tx('sr.notaDe', { nome: j.nome })}>
              <option value="">{tx('sr.semNota')}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n} selected={n === j.nota}>
                  {tx('sr.nota', { n })}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div class="row sr-botoes">
        <button class="btn" data-a="srVoltar" data-v="1">
          {tx('sr.voltar')}
        </button>
        <button class="btn primary" data-a="srSortear">
          {tx('sr.sortear')}
        </button>
      </div>
    </div>
  );
}

function Time({ t, i }: { t: TimeRapido; i: number }) {
  const c = COL[i % COL.length] as Obj,
    res = new Set(t.res),
    ordem = (p: number) => {
      const k = posicoes().findIndex(x => x[0] === est.js[p]!.pos);
      return (res.has(p) ? 100 : 0) + (k < 0 ? 99 : k);
    };
  return (
    <div class="team">
      <div class={'band' + (corClara(c) && !duplas() ? ' branco' : '')} style={{ background: c.c }}></div>
      <div class="th">
        <b>{nomeTime(i)}</b>
        <span class="tag">{t.players.length}</span>
      </div>
      <ul>
        {t.players
          .slice()
          .sort((a, b) => ordem(a) - ordem(b))
          .map(p => (
            <li key={p} class={res.has(p) ? 'reserva' : ''}>
              {est.js[p]!.pos ? <span class="pos">{est.js[p]!.pos}</span> : null}
              <span class="pn">
                {est.js[p]!.nome}
                {res.has(p) ? <span class="tag"> · {tx('times.reserva')}</span> : null}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

function texto() {
  return textoRapido(est.times, est.js, {
    titulo: (sp().e || '⚽') + ' ' + tx('sr.zapTitulo'),
    time: nomeTime,
    reserva: tx('times.reserva'),
    rodape: tx('sr.zapRodape', { link: location.origin + location.pathname + '#/sortear' }),
  });
}

function Passo3() {
  return (
    <>
      <div class="panel sr" id="srPasso3">
        <h2 class="sr-titulo">{tx('sr.times')}</h2>
        <div class="teams" id="srTimes">
          {est.times.map((t, i) => (
            <Time key={i} t={t} i={i} />
          ))}
        </div>
        <div class="row sr-botoes">
          <a
            class="btn primary"
            id="srZap"
            href={WA + '?text=' + encodeURIComponent(texto())}
            target="_blank"
            rel="noopener"
          >
            {tx('sr.zap')}
          </a>
          <button class="btn" data-a="srSortear">
            {tx('sr.deNovo')}
          </button>
          <button class="btn ghost" data-a="srVoltar" data-v="2">
            {tx('sr.mudar')}
          </button>
        </div>
      </div>
      <div class="panel sr sr-salvar" id="srSalvar">
        <h3>{tx('sr.salvarTitulo')}</h3>
        <p class="small muted">{tx('sr.salvarTexto')}</p>
        <button class="btn primary sr-acao" data-a="srSalvar">
          {tx('sr.salvar')}
        </button>
      </div>
    </>
  );
}

function Tela() {
  return (
    <div class="sr-tela">
      {est.passo === 1 ? <Passo1 /> : est.passo === 2 ? <Passo2 /> : <Passo3 />}
      <p class="small muted sr-rodape">{tx('sr.privacidade')}</p>
    </div>
  );
}

let raiz: HTMLElement | null = null,
  onde: HTMLElement | null = null;
function desenhar() {
  if (onde) render(<Tela />, raiz!);
}
export function montarSorteioRapido(el: HTMLElement) {
  if (!raiz || raiz.parentNode !== el) {
    const r = lerRascunho();
    if (r && !est.js.length) {
      Object.assign(est, { esporte: r.esporte, porTime: r.porTime, js: r.js, times: r.times, passo: 3 });
    }
    raiz = document.createElement('div');
    el.replaceChildren(raiz);
    onde = el;
  }
  desenhar();
}
function ir(p: Passo, foco?: string) {
  est.passo = p;
  desenhar();
  window.scrollTo(0, 0);
  if (foco) setTimeout(() => ($(foco) as HTMLElement | null)?.focus(), 30);
}

/* Lê o que está na tela do passo 2 (posição e nota de cada um). */
function lerAjustes() {
  document.querySelectorAll<HTMLSelectElement>('#srLista .sr-pos').forEach(s => {
    est.js[+s.dataset.i!]!.pos = s.value || undefined;
  });
  document.querySelectorAll<HTMLSelectElement>('#srLista .sr-nota').forEach(s => {
    est.js[+s.dataset.i!]!.nota = s.value ? +s.value : undefined;
  });
}

const acoes: Record<string, (el: HTMLElement & { dataset: DOMStringMap }) => unknown> = {
  srLer: () => {
    const e = ($('#srEsporte') as HTMLSelectElement).value,
      pt = +($('#srPorTime') as HTMLInputElement).value;
    est.texto = ($('#srNomes') as HTMLTextAreaElement).value;
    if (!(pt >= 1 && pt <= 30 && Number.isInteger(pt))) {
      toast(tx('sr.porTimeInvalido'));
      ($('#srPorTime') as HTMLInputElement).focus();
      return;
    }
    est.esporte = e;
    est.porTime = pt;
    /* Da lista do WhatsApp entra só quem vai: quem tem ❌ ou não respondeu fica de fora. */
    const ls = lerLista(est.texto).filter(l => l.s === 'in');
    if (!ls.length) {
      toast(tx('sr.semNomes'));
      ($('#srNomes') as HTMLTextAreaElement).focus();
      return;
    }
    const ks = posicoes().map(p => p[0]!),
      chave = sp().key || '';
    est.js = ls.map(l => {
      const pos = posicaoDe(l, ks, chave);
      return pos ? { nome: l.nome, pos } : { nome: l.nome };
    });
    ir(2);
  },
  srVoltar: el => {
    if (est.passo === 2) lerAjustes();
    ir(el.dataset.v === '2' ? 2 : 1, el.dataset.v === '2' ? undefined : '#srNomes');
  },
  srSortear: () => {
    if (est.passo === 2) lerAjustes();
    const r = sortearRapido(est.js, {
      porTime: est.porTime,
      duplas: duplas(),
      posicoes: posicoes().map(p => p[0]!),
      chave: sp().key || null,
    });
    if (r.faltam) {
      toast(tx(duplas() ? 'sr.faltamDuplas' : 'sr.faltam', { n: r.faltam, t: est.porTime }));
      return;
    }
    est.times = r.times!;
    ir(3);
  },
  srSalvar: () => {
    const d: Rascunho = {
      v: 1,
      esporte: est.esporte,
      porTime: est.porTime,
      js: est.js,
      times: est.times,
      em: Date.now(),
    };
    try {
      localStorage.setItem(RASCUNHO, JSON.stringify(d));
    } catch (e) {
      /* sem armazenamento: segue mesmo assim; o grupo nasce vazio */
    }
    const logado = !!((S as Obj).user && !(S as Obj).user.anon);
    location.hash = logado ? '#/' : '#/criar';
  },
};
Object.assign(ACT, acoes);

/* Trocar o esporte: o tamanho do time acompanha, se ainda estava no padrão do esporte anterior. */
document.addEventListener('change', e => {
  const s = e.target as HTMLSelectElement;
  if (s && s.id === 'srEsporte') {
    const i = $('#srPorTime') as HTMLInputElement | null;
    if (i && +i.value === porTimePadrao(est.esporte)) i.value = String(porTimePadrao(s.value));
    est.esporte = s.value;
  }
});
