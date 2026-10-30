/* Componentes reaproveitáveis do Nosso Jogo (KAN-153), em TypeScript + Preact.
   Cada um segue o Design System (docs/DESIGN-SYSTEM.md, "Componentes (pelada-v31 a v43)").
   Tela nova ou migrada usa estes componentes, em vez de montar HTML como texto.
   Os botões continuam com data-a: as ações, o carregando e o aviso de sem sinal são os mesmos do resto do app. */
import type { ComponentChildren } from 'preact';
import { hasPos, posKeys, posLabel, sport } from '../dominio/esportes.js';
import { fmtL, lvl, posso, ppos, rodadasJanela } from '../dominio/grupo.js';
import { faltaTotal, porPosicao } from '../dominio/posicoes';
import { hora } from '../dominio/rodadas.js';
import { fdate } from '../nucleo/util.js';
import { tp, tx } from '../i18n/index.js';
import { linkMaps, linkWaze } from '../nucleo/links.js';

/* Texto longo numa linha só, com "…" (KAN-146). Ao cortar, ui/render.js (subtituloCompleto) liga o título e o toque. */
export function TextoCortado({ texto }: { texto: string }) {
  return (
    <span class="corta" data-corta>
      {texto}
    </span>
  );
}

/* "Como chegar" com Google Maps e Waze, pela busca do texto do local (KAN-141). */
export function ComoChegar({ local }: { local: string }) {
  const app = (href: string, nome: string) => (
    <a
      class="chip-mapa"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={tx('mapa.abrirEm', { local, app: nome })}
    >
      {nome}
    </a>
  );
  return (
    <div class="mapa small">
      <span class="muted">{tx('mapa.abrir')}</span>
      {app(linkMaps(local), tx('mapa.google'))}
      {app(linkWaze(local), tx('mapa.waze'))}
    </div>
  );
}

/* Seletor segmentado com contagem embaixo de cada opção (KAN-71). */
export type Opcao = { v: string; rotulo: string; n: number | string };
export function Segmentado({
  opcoes,
  atual,
  acao,
  rotulo,
}: {
  opcoes: Opcao[];
  atual: string;
  acao: string;
  rotulo: string;
}) {
  return (
    <div class="seg seg-filtro" role="group" aria-label={rotulo}>
      {opcoes.map(o => (
        <button key={o.v} data-a={acao} data-v={o.v} aria-pressed={atual === o.v}>
          {o.rotulo} <span class="n">{o.n}</span>
        </button>
      ))}
    </div>
  );
}

/* Sigla da posição do jogador; a posição-chave do esporte ganha o destaque (classe GOL). */
export function Pos({ id }: { id: string }) {
  const k = ppos(id) as string;
  if (!hasPos() || !k) return null;
  return (
    <span class={'pos ' + (k === sport().key ? 'GOL' : '')} title={posLabel(k)}>
      {k}
    </span>
  );
}

/* Nota de 1 a 10 do jogador (só a gestão mostra). */
/* Sem a permissão de notas (KAN-201), a nota não aparece: o sorteio usa, mas a tela esconde. */
export function Nota({ id }: { id: string }) {
  if (!posso('notas')) return null;
  return (
    <span class="lvl-tag" title={tx('nota.titulo')}>
      {fmtL(lvl(id))}
    </span>
  );
}

/* Mínimo para o jogo (KAN-179), na aba Rodada e no link: total de confirmados contra o mínimo do grupo
   (qualquer esporte) e, se o esporte ou o grupo tiver posições, "GOL 1 de 2 · DEF 4". Se faltar: "Falta 1 GOL".
   A gestão passa o botão de definir o mínimo em "acao". */
export function PorPosicao({
  inn,
  minimos,
  acao,
}: {
  inn: string[];
  minimos?: Record<string, unknown>;
  acao?: ComponentChildren;
}) {
  const m = minimos || {},
    lista = hasPos() ? porPosicao(posKeys(), inn, id => ppos(id) as string, m) : [],
    total = faltaTotal(inn.length, m),
    faltas = (total.falta ? [tp('porpos.faltaTotal', total.falta)] : []).concat(
      lista.filter(x => x.falta).map(x => tp('porpos.falta', x.falta, { pos: x.k }))
    );
  if (!lista.length && !total.min && !acao) return null;
  return (
    <div class="porpos" id="porPosicao">
      <div class="row between">
        <span class="small muted">{tx(hasPos() ? 'porpos.titulo' : 'porpos.tituloTotal')}</span>
        {acao}
      </div>
      {lista.length || total.min ? (
        <div class="poschips">
          {total.min ? (
            <span class={total.falta ? 'falta' : ''} data-pos="total">
              <b>{tx('porpos.total')}</b> {tx('porpos.deMinimo', { n: inn.length, min: total.min })}
            </span>
          ) : null}
          {lista.map(x => (
            <span key={x.k} class={x.falta ? 'falta' : ''} data-pos={x.k} title={posLabel(x.k)}>
              <b>{x.k}</b> {x.min ? tx('porpos.deMinimo', { n: x.n, min: x.min }) : x.n}
            </span>
          ))}
        </div>
      ) : null}
      {faltas.length ? (
        <p class="porpos-falta" id="faltaPos">
          {faltas.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

/* Etiqueta pequena de apoio (· avulso, · reserva…). */
export function Tag({
  children,
  cor,
  classe,
  titulo,
}: {
  children: ComponentChildren;
  cor?: string;
  classe?: string;
  titulo?: string;
}) {
  return (
    <span class={'tag' + (classe ? ' ' + classe : '')} style={cor ? { color: cor } : undefined} title={titulo}>
      {children}
    </span>
  );
}

/* Seletor da rodada (D10): as próximas e as últimas 4; as antigas ficam na aba Histórico.
   Na aba Rodada vem com "Nova rodada" e "Histórico" (acoes); na aba Partida, só a lista (KAN-160). */
type RodadaOpcao = { id: string; date: string; time?: string; fim?: string; cancelada?: boolean; fixo?: boolean };
/* Texto de uma rodada nos seletores (KAN-146, KAN-195): data, hora e "fixo", sem o local. */
export function textoRodada(x: RodadaOpcao): string {
  return (
    fdate(x.date) +
    (x.time ? ' · ' + hora(x) : '') +
    (x.cancelada ? ' ' + tx('rodada.canceladaOpcao') : x.fixo ? ' · ' + tx('rodada.fixoOpcao') : '')
  );
}
export function SeletorRodada({ r, acoes }: { r: RodadaOpcao; acoes?: boolean }) {
  const rs = rodadasJanela() as RodadaOpcao[];
  if (!rs.some(x => x.id === r.id)) rs.push(r);
  return (
    <div class="rsel">
      <select class="sel" data-c="rid" aria-label={tx('rodada.seletor')} value={r.id}>
        {rs.map(x => (
          <option key={x.id} value={x.id} selected={x.id === r.id}>
            {textoRodada(x)}
          </option>
        ))}
      </select>
      {/* KAN-194: o Histórico fica só na aba (sem o botão repetido aqui). */}
      {acoes ? (
        <button class="btn" data-a="newRod">
          {tx('rodada.nova')}
        </button>
      ) : null}
    </div>
  );
}

/* Campo "Posição" das janelas (jogador, avulso, link): o combo com as posições do esporte. Some quando o esporte não
   tem posição. Componente desde a v84 (antes posField, em texto). */
export function CampoPosicao({ id, valor }: { id: string; valor?: string }) {
  if (!hasPos()) return null;
  const atual = valor || (ppos('') as string);
  return (
    <label class="f">
      <span>{tx('comum.posicao')}</span>
      <select class="sel" id={id}>
        {(sport().pos as [string, string][]).map(([k, l]) => (
          <option key={k} value={k} selected={atual === k}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/* Texto do dicionário com trechos em negrito marcados com <b>…</b> (ex.: o nome de um botão): vira negrito de verdade,
   sem montar HTML. */
export function ComNegrito({ texto }: { texto: string }) {
  return <>{texto.split(/<b>|<\/b>/).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;
}
