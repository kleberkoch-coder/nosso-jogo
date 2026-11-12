/* Linha da partida e confronto (KAN-249, pelada-v107; arquivo próprio desde a pelada-v109, para não pesar no link
   do jogador nem na gestão: chega com a Partida, o Histórico, o campeonato e, no link, só quando a rodada tem
   partidas salvas). */
import type { ComponentChildren } from 'preact';
import { col, sport } from '../dominio/esportes.js';
import { pname } from '../dominio/grupo.js';
import { autoresTexto, type GolTexto } from '../dominio/partida-texto';
import { tx } from '../i18n/index.js';

/* KAN-249 (pelada-v107): o confronto "● Time 1 [1 × 0] Time 2 ●". O placar fica numa pílula, em display, e o nome de
   cada time nunca quebra por dentro (nw). Sem placar (jogo do campeonato que ainda não aconteceu), só o "×". */
export function Confronto(o: {
  ca: number | string;
  cb: number | string;
  na: string;
  nb: string;
  ga?: number | null;
  gb?: number | null;
}) {
  return (
    <span class="confronto">
      <span class="nw">
        <span class="dot" style={{ background: col(o.ca).c }}></span> {o.na}
      </span>
      <b class="placar-p">{o.ga != null ? o.ga + ' × ' + o.gb : '×'}</b>
      <span class="nw">
        {o.nb} <span class="dot" style={{ background: col(o.cb).c }}></span>
      </span>
    </span>
  );
}
/* "gols: Marcão (Caio), Japa" (a palavra vem do catálogo do esporte). */
export function apoioGols(goals: GolTexto[] | null | undefined): string {
  const a = autoresTexto(goals, pname);
  return a ? String((sport() as { word: string }).word).toLowerCase() + ': ' + a : '';
}
/* Linha da partida (KAN-249): em cima, a fase (com campeonato), o confronto e os botões, que descem para uma linha
   própria quando não cabem; embaixo, em small muted, "Jogo 1 · gols: Marcão (Caio)". Aba Partida, Histórico e link. */
export function LinhaPartida(o: {
  n: number;
  ca: number | string;
  cb: number | string;
  na: string;
  nb: string;
  ga: number;
  gb: number;
  goals?: GolTexto[] | null;
  fase?: ComponentChildren;
  acoes?: ComponentChildren;
}) {
  const apoio = apoioGols(o.goals);
  return (
    <li class="linha-partida">
      <div class="lp-topo">
        {o.fase}
        <Confronto ca={o.ca} cb={o.cb} na={o.na} nb={o.nb} ga={o.ga} gb={o.gb} />
        {o.acoes ? <span class="lp-acoes">{o.acoes}</span> : null}
      </div>
      <div class="small muted lp-apoio">
        {tx('partida.jogoN', { n: o.n })}
        {apoio ? ' · ' + apoio : ''}
      </div>
    </li>
  );
}
