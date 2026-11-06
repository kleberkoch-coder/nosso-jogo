/* Mensagem do WhatsApp com as partidas da rodada (KAN-232): cada jogo com o placar e quem marcou, a artilharia
   somada e, com mais de 2 times, a classificação da rodada. Usada na aba Partida e no Histórico.
   KAN-238: com campeonato, as partidas vêm por fase (todos contra todos, mata-mata, fora do campeonato), com os
   pênaltis de quem passou, a classificação do campeonato e o campeão, o vice e o 3º. A fase de cada partida
   (rotuloFase) também aparece na lista da aba Partida e no Histórico. */
import { lerCamp, type Jogo } from '../dominio/campeonato';
import { chave, type Chave } from '../dominio/mata-mata';
import { artilharia, autores, tabela, type PartidaResumo } from '../dominio/resumo-rodada';
import { artNome, col, sport, timeDoJogo, tn, tnJogo } from '../dominio/esportes.js';
import { pname } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-zappartidas';
import { linkRodada } from '../nucleo/links.js';
import { fdate } from '../nucleo/util.js';
import { shareDlg } from './Compartilhar';

juntarTextos(textos);

type Time = { c: number | string; players: string[] };
type Rodada = { id: string; date: string; times?: Time[] | null; camp?: unknown };
type Partida = PartidaResumo & { ca: number | string; cb: number | string; ta?: number; tb?: number; at?: number };

/* Nome de um jogo do campeonato: "Semifinal 1", "Final", "3º lugar" (pelo id do jogo da chave). */
export function nomeFase(s: { id: string; fase?: string }): string {
  const f = s.fase || (s.id === 'f' || s.id === 't3' ? s.id : s.id[0]);
  return tx('mata.fase.' + f, { n: s.id.length > 1 && f !== 't3' ? +s.id.slice(1) + 1 : '' }).trim();
}
/* Etiqueta da partida salva: 'g' = todos contra todos; o id do jogo da chave; null = fora do campeonato. */
export const rotuloFase = (f: string | null) =>
  f === 'g' ? tx('zappart.faseG') : f ? nomeFase({ id: f }) : tx('zappart.fora');
/* As partidas salvas como jogos entre posições de times, na mesma ordem (sem tirar nenhuma: a posição conta). */
export const comoJogos = (ms: Partida[], times: Time[] | null | undefined): Jogo[] =>
  ms.map(m => ({
    a: timeDoJogo(m, 'a', times) as number,
    b: timeDoJogo(m, 'b', times) as number,
    ga: m.ga,
    gb: m.gb,
    at: m.at,
  }));
/* Chave do campeonato da rodada para estas partidas (null: rodada sem campeonato). */
export function chaveDaRodada(r: Rodada, ms: Partida[]): Chave | null {
  const c = r.times ? lerCamp(r.camp, r.times.length) : null;
  return c ? chave(c, comoJogos(ms, r.times)) : null;
}

export function txtPartidas(
  r: Rodada,
  ms: Partida[],
  lancada?: Record<string, number> | null,
  nome: (pid: string) => string = pname
): string {
  const SP = sport() as { e: string; pairs?: boolean },
    nomeTime = (m: PartidaResumo, lado: 'a' | 'b') => tnJogo(m, lado, r.times),
    marca = (c: number | string) => (SP.pairs ? '' : col(c).e + ' '),
    cor: Record<string, number | string> = {},
    k = chaveDaRodada(r, ms);
  let t = `${SP.e} *${tx('zappart.cabecalho', { data: fdate(r.date) })}*\n`;
  const linha = (m: Partida, i: number) => {
    cor[nomeTime(m, 'a')] = m.ca;
    cor[nomeTime(m, 'b')] = m.cb;
    const quem = autores(m).map(([p, n]) => nome(p) + (n > 1 ? ` (${n})` : '')),
      f = k ? k.fases[i] : null,
      s = k && f && f !== 'g' ? k.slots.find(x => x.id === f) : null,
      dec = s && s.dec;
    return (
      `\n${i + 1}. ${s ? nomeFase(s) + ': ' : ''}${marca(m.ca)}${nomeTime(m, 'a')} *${m.ga} × ${m.gb}* ${nomeTime(m, 'b')}` +
      (SP.pairs ? '' : ' ' + col(m.cb).e) +
      (dec
        ? ' (' +
          (dec.a != null && dec.b != null ? tx('zappart.penaltis', { a: dec.a, b: dec.b }) + ', ' : '') +
          tx('zappart.passou', { time: tn(dec.p) }) +
          ')'
        : '') +
      (quem.length ? ` (${quem.join(', ')})` : '')
    );
  };
  if (!k) ms.forEach((m, i) => (t += linha(m, i)));
  /* Com campeonato: um bloco por fase, na ordem dos jogos; a numeração continua a das partidas salvas. */ else
    (['g', 'm', 'x'] as const).forEach(b => {
      const idx = ms
        .map((_, i) => i)
        .filter(i => (b === 'g' ? k.fases[i] === 'g' : b === 'x' ? !k.fases[i] : k.fases[i] && k.fases[i] !== 'g'));
      if (!idx.length) return;
      t += `\n*${tx(b === 'g' ? 'zappart.faseG' : b === 'm' ? 'zappart.mata' : 'zappart.fora')}*`;
      idx.forEach(i => (t += linha(ms[i]!, i)));
      t += '\n';
    });
  const art = artilharia(ms, nome, lancada, LOCAL);
  if (art.length) t += `\n\n🏅 *${artNome()}*: ` + art.map(([p, n]) => `${nome(p)} ${n}`).join(' · ');
  if (k) {
    const camp = k.tabela.filter(l => l.j > 0);
    if (camp.length)
      t +=
        `\n\n🏆 *${tx('zappart.tabelaCamp')}*\n` +
        k.tabela
          .map(l =>
            tx('zappart.linhaTabela', {
              pos: l.pos,
              time: (r.times && r.times[l.t] ? marca(r.times[l.t]!.c) : '') + tn(l.t),
              pts: l.pts,
              v: l.v,
              e: l.e,
              d: l.d,
              saldo: (l.sg > 0 ? '+' : '') + l.sg,
            })
          )
          .join('\n');
    if (k.campeao != null) {
      t += `\n\n🥇 *${tx('zappart.campeao', { time: tn(k.campeao) })}*`;
      if (k.vice != null) t += `\n🥈 ${tx('zappart.vice', { time: tn(k.vice) })}`;
      if (k.terceiro != null && k.slots.some(x => x.id === 't3'))
        t += `\n🥉 ${tx('zappart.terceiro', { time: tn(k.terceiro) })}`;
    }
    return t + '\n\n' + tx('zap.detalhes', { link: linkRodada(r.id) });
  }
  const tab = tabela(ms, nomeTime);
  if (tab.length > 2)
    t +=
      `\n\n🏆 *${tx('zappart.tabela')}*\n` +
      tab
        .map((l, i) =>
          tx('zappart.linhaTabela', {
            pos: i + 1,
            time: (cor[l.time] != null ? marca(cor[l.time]!) : '') + l.time,
            pts: l.pts,
            v: l.v,
            e: l.e,
            d: l.d,
            saldo: (l.gp - l.gc > 0 ? '+' : '') + (l.gp - l.gc),
          })
        )
        .join('\n');
  return t + '\n\n' + tx('zap.detalhes', { link: linkRodada(r.id) });
}

export function mandarPartidas(
  r: Rodada,
  ms: Partida[],
  lancada?: Record<string, number> | null,
  nome: (pid: string) => string = pname
) {
  shareDlg(tx('zappart.titulo'), txtPartidas(r, ms, lancada, nome));
}
