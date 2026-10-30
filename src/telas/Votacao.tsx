/* Aba Votação da gestão como componente em TypeScript + Preact (KAN-195; antes, telas/votacao-gestao.js).
   Por fora, a mesma tela: os mesmos data-c (vid) e data-a (newVote, shareVote, toggleVote, delVote, saveVote),
   que eventos.js e acoes/votacao.js já conhecem. Também a janela "Nova votação". */
import { render } from 'preact';
import { hasPos, posLabel, sport } from '../dominio/esportes.js';
import { pname, rodDoc, rodadas } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { fdate } from '../nucleo/util.js';
import { textoRodada } from '../ui/componentes';
import { tally } from '../dominio/votacao';

const st = (): any => estado;
type Categoria = { id: string; name: string };
type Votacao = {
  id: string;
  title: string;
  rid: string;
  rdate?: string;
  open?: boolean;
  cats: Categoria[];
  createdAt?: number;
  resultado?: Record<string, Resultado>;
};
type Resultado = { counts: Record<string, number>; total: number; winners: string[] };
type Rodada = { id: string; date: string; time?: string; fim?: string; fixo?: boolean; times?: unknown };

/* Exemplos do que votar: vêm do esporte (posição-chave só quando o esporte tem, KAN-75). */
function exemplos(): string {
  const SP = sport() as { key?: string };
  return [
    tx('votacao.exMelhor'),
    ...(SP.key ? [tx('votacao.exMelhorPos', { pos: posLabel(SP.key).toLowerCase() })] : []),
    ...(hasPos() ? [tx('votacao.exPorPosicao')] : []),
    tx('votacao.exBagre'),
  ].join(', ');
}

function Vazia() {
  const pode = (rodadas() as Rodada[]).some(r => r.times);
  return (
    <div class="panel empty">
      <h2>{tx('votacao.vazioTitulo')}</h2>
      <p class="muted">{tx('votacao.vazioTexto', { ex: exemplos() })}</p>
      <button class="btn primary" data-a="newVote" disabled={!pode}>
        {tx('votacao.criar')}
      </button>
      {pode ? null : <p class="small muted">{tx('votacao.depoisSorteio')}</p>}
    </div>
  );
}

const dataDa = (x: Votacao) => x.rdate || (rodDoc(x.rid) as Rodada | null)?.date || '';

function CategoriaResultado({ c, R }: { c: Categoria; R: Resultado }) {
  const linhas = Object.entries(R.counts).sort((a, b) => b[1] - a[1]);
  return (
    <div class="panel">
      <h3>{c.name}</h3>
      <ul class="plist">
        {linhas.map(([id, n]) => (
          <li key={id}>
            <span class="pn">{R.winners.includes(id) ? <b>{pname(id)}</b> : pname(id)}</span>
            <span class="bar">
              <i style={{ width: (n / R.total) * 100 + '%' }}></i>
            </span>
            <span class="small">{n}</span>
          </li>
        ))}
        {linhas.length ? null : <li class="muted small">{tx('votacao.semVotos')}</li>}
      </ul>
    </div>
  );
}

function VotacaoTela() {
  const S = st();
  const vs = (Object.entries(S.vot) as [string, Omit<Votacao, 'id'>][])
    .map(([id, v]) => Object.assign({ id }, v) as Votacao)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!vs.length) return <Vazia />;
  const v = vs.find(x => x.id === S.vid) || vs[0]!;
  S.vid = v.id;
  const r = rodDoc(v.rid) as Rodada | null,
    res = (v.open ? tally(v, S.votos) : v.resultado || tally(v, S.votos)) as Record<string, Resultado>,
    nv = Object.keys(S.votos).length;
  return (
    <div class="stack">
      <div class="row between">
        <div class="rsel">
          <select class="sel" data-c="vid" aria-label={tx('votacao.seletor')}>
            {vs.map(x => (
              <option key={x.id} value={x.id} selected={x.id === v.id}>
                {x.title}
                {dataDa(x) ? ' — ' + fdate(dataDa(x)) : ''}
              </option>
            ))}
          </select>
          <button class="btn" data-a="newVote">
            {tx('votacao.nova')}
          </button>
        </div>
      </div>
      <div class="panel">
        <h2>{v.title}</h2>
        <p class="muted small">
          {r ? tx('votacao.rodadaDe', { data: fdate(r.date) }) + ' · ' : ''}
          {tx(v.open ? 'votacao.aberta' : 'votacao.encerrada')} · {tp('votacao.votos', nv)}
        </p>
        <div class="row" style="margin-top:10px">
          <button class="btn sm primary" data-a="shareVote">
            {tx(v.open ? 'votacao.mandarLink' : 'votacao.mandarResultado')}
          </button>
          <button class="btn sm" data-a="toggleVote">
            {tx(v.open ? 'votacao.encerrar' : 'votacao.reabrir')}
          </button>
          <button class="btn sm ghost danger" data-a="delVote">
            {tx('votacao.excluir')}
          </button>
        </div>
      </div>
      {v.cats.map(c => (
        <CategoriaResultado key={c.id} c={c} R={res[c.id] || { counts: {}, total: 0, winners: [] }} />
      ))}
    </div>
  );
}

/* Janela "Nova votação" (KAN-195): categorias em caixas de 44px (chk-linha) e o seletor de rodada sem o local. */
function NovaVotacao({ rs }: { rs: Rodada[] }) {
  const SP = sport() as { key?: string };
  const cats: [string, string][] = [
    ['best', tx('votacao.catMelhor')],
    ...(SP.key
      ? [['gk', tx('votacao.catMelhorPos', { pos: posLabel(SP.key).toLowerCase() })] as [string, string]]
      : []),
    ...(hasPos() ? [['pos', tx('votacao.catPorPosicao')] as [string, string]] : []),
    ['worst', tx('votacao.catBagre')],
  ];
  return (
    <>
      <h3 id="novaVotTitulo">{tx('votacao.novaTitulo')}</h3>
      <label class="f">
        <span>{tx('votacao.rodada')}</span>
        <select class="sel" id="vr">
          {rs.map(r => (
            <option key={r.id} value={r.id}>
              {textoRodada(r)}
            </option>
          ))}
        </select>
      </label>
      <label class="f">
        <span>{tx('votacao.titulo')}</span>
        <input class="inp" id="vt" value={tx('votacao.tituloPadrao')} maxLength={50} />
      </label>
      <fieldset class="f chk-lista">
        <legend class="lbl">{tx('votacao.oQueVotar')}</legend>
        {cats.map(([k, l], i) => (
          <label class="chk-linha" key={k}>
            <input type="checkbox" class="vc" value={k} defaultChecked={i === 0} />
            <span>{l}</span>
          </label>
        ))}
      </fieldset>
      <label class="f">
        <span>{tx('votacao.outraRotulo')}</span>
        <input class="inp" id="vx" placeholder={tx('votacao.outraExemplo')} maxLength={40} />
      </label>
      <label class="chk-linha" style="margin-bottom:12px">
        <input type="checkbox" id="vsf" />
        <span>{tx('votacao.siMesmo')}</span>
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="saveVote">
          {tx('votacao.abrir')}
        </button>
      </div>
    </>
  );
}

export function montarNovaVotacao(rs: Rodada[]) {
  const el = document.getElementById('novaVotRaiz');
  if (el) render(<NovaVotacao rs={rs} />, el);
}

/* A gestão desenha as abas com texto; a Votação entra num lugar reservado (#votRaiz). */
export const vVotacao = () => '<div id="votRaiz"></div>';
export function montarVotacao() {
  const el = document.getElementById('votRaiz');
  if (el) render(<VotacaoTela />, el);
}
