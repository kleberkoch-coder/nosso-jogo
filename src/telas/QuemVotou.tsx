/* "Quem votou" (KAN-222): auditoria da votação, só para administradores. Uma linha por aparelho que votou, com o nome
   que a pessoa escolheu, a hora, o voto em cada categoria e as trocas (com a hora do servidor). Regra pura em
   dominio/votacao.ts (auditoria), testada em testes/regras/votacao.test.mjs. Vem com a aba Votação. */
import { useState } from 'preact/hooks';
import { pname } from '../dominio/grupo.js';
import { auditoria, type Categoria, type LinhaAuditoria, type Troca } from '../dominio/votacao';
import { FORMATO, FUSO } from '../i18n/formatos.js';
import { tp, tx } from '../i18n/index.js';

/* A hora do servidor chega do Firebase como Timestamp; no modo demonstração, como número. */
const emMs = (x: unknown): number | null =>
  x == null
    ? null
    : typeof x === 'number'
      ? x
      : typeof (x as { toMillis?: () => number }).toMillis === 'function'
        ? (x as { toMillis: () => number }).toMillis()
        : null;
const quando = (ms: number) =>
  new Date(ms).toLocaleString(FORMATO, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  });
const hora = (ms: number) =>
  new Date(ms).toLocaleTimeString(FORMATO, { hour: '2-digit', minute: '2-digit', timeZone: FUSO });

/* O que está aberto fica guardado fora do componente: a aba se desenha de novo a cada voto que chega
   (e ao trocar o tema), e a seção não pode fechar sozinha no meio da conferência. */
let secaoAberta = '';
const trocasAbertas = new Set<string>();

function Linha({ l, cats }: { l: LinhaAuditoria; cats: Categoria[] }) {
  const [aberta, setAbertaEstado] = useState(trocasAbertas.has(l.u));
  const setAberta = (v: boolean) => {
    if (v) trocasAbertas.add(l.u);
    else trocasAbertas.delete(l.u);
    setAbertaEstado(v);
  };
  const nomeCat = (id: string) => (cats.find(c => c.id === id) || { name: id }).name || id;
  return (
    <li class="aud-linha" data-u={l.u}>
      <div class="row between aud-topo">
        <span class="pn">
          <b>{pname(l.pid)}</b>
          {l.repetido ? (
            <>
              {' '}
              <span class="tag alt aud-repetido">{tx('aud.repetido')}</span>
            </>
          ) : null}
        </span>
        <span class="small muted aud-hora">
          {l.quando ? quando(l.quando) : '—'}
          {l.quando && !l.doServidor ? ' ' + tx('aud.horaAparelho') : ''}
        </span>
      </div>
      <ul class="aud-votos small">
        {cats.map(c =>
          l.v[c.id] ? <li key={c.id}>{tx('aud.escolha', { cat: nomeCat(c.id), nome: pname(l.v[c.id]!) })}</li> : null
        )}
        {Object.keys(l.v).some(k => l.v[k]) ? null : <li class="muted">{tx('aud.semEscolha')}</li>}
      </ul>
      {l.trocas.length ? (
        <>
          <button type="button" class="btn sm ghost aud-ver" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
            {aberta ? tx('aud.esconderTrocas') : tp('aud.verTrocas', l.trocas.length)}
          </button>
          {aberta ? (
            <ol class="aud-trocas small muted">
              {l.trocas.map((t: Troca, i) => (
                <li key={i}>
                  {(t.em ? hora(t.em) + ' · ' : '') + tx('aud.escolha', { cat: nomeCat(t.c), nome: pname(t.p) })}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export function QuemVotou({
  vid,
  cats,
  votos,
  trocas,
}: {
  vid: string;
  cats: Categoria[];
  votos: Record<string, any>;
  trocas: Record<string, any>;
}) {
  const [aberta, setAbertaEstado] = useState(secaoAberta === vid);
  const setAberta = (v: boolean) => {
    secaoAberta = v ? vid : '';
    setAbertaEstado(v);
  };
  const ts: Record<string, Troca> = {};
  for (const [k, x] of Object.entries(trocas || {}))
    if (x) ts[k] = { u: x.u, pid: x.pid, c: x.c, p: x.p, em: emMs(x.em) };
  const linhas = auditoria(votos, ts);
  return (
    <details
      class="panel aud-painel"
      id="quemVotou"
      open={aberta}
      onToggle={e => setAberta((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <h3>{tx('aud.titulo', { n: linhas.length })}</h3>
        <span class="small muted">{tx('aud.resumo')}</span>
      </summary>
      {aberta ? (
        <>
          <p class="small muted">{tx('aud.ajuda')}</p>
          {linhas.length ? (
            <ul class="aud-lista">
              {linhas.map(l => (
                <Linha key={l.u} l={l} cats={cats} />
              ))}
            </ul>
          ) : (
            <p class="small muted">{tx('aud.nenhum')}</p>
          )}
        </>
      ) : null}
    </details>
  );
}
