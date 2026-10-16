/* Componentes reaproveitáveis do Nosso Jogo (KAN-153), em TypeScript + Preact.
   Cada um segue o Design System (docs/DESIGN-SYSTEM.md, "Componentes (pelada-v31 a v43)").
   Tela nova ou migrada usa estes componentes, em vez de montar HTML como texto.
   Os botões continuam com data-a: as ações, o carregando e o aviso de sem sinal são os mesmos do resto do app. */
import type { ComponentChildren } from 'preact';
import { hasPos, posLabel, sport } from '../dominio/esportes.js';
import { fmtL, lvl, ppos } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
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
export function Nota({ id }: { id: string }) {
  return (
    <span class="lvl-tag" title={tx('nota.titulo')}>
      {fmtL(lvl(id))}
    </span>
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
