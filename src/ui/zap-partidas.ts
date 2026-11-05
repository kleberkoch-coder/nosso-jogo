/* Mensagem do WhatsApp com as partidas da rodada (KAN-232): cada jogo com o placar e quem marcou, a artilharia
   somada e, com mais de 2 times, a classificação da rodada. Usada na aba Partida e no Histórico. */
import { artilharia, autores, tabela, type PartidaResumo } from '../dominio/resumo-rodada';
import { artNome, col, sport, tnJogo } from '../dominio/esportes.js';
import { pname } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-zappartidas';
import { linkRodada } from '../nucleo/links.js';
import { fdate } from '../nucleo/util.js';
import { shareDlg } from './Compartilhar';

juntarTextos(textos);

type Time = { c: number; players: string[] };
type Rodada = { id: string; date: string; times?: Time[] | null };
type Partida = PartidaResumo & { ca: number; cb: number };

export function txtPartidas(
  r: Rodada,
  ms: Partida[],
  lancada?: Record<string, number> | null,
  nome: (pid: string) => string = pname
): string {
  const SP = sport() as { e: string; pairs?: boolean },
    nomeTime = (m: PartidaResumo, lado: 'a' | 'b') => tnJogo(m, lado, r.times),
    marca = (c: number) => (SP.pairs ? '' : col(c).e + ' '),
    cor: Record<string, number> = {};
  let t = `${SP.e} *${tx('zappart.cabecalho', { data: fdate(r.date) })}*\n`;
  ms.forEach((m, i) => {
    cor[nomeTime(m, 'a')] = m.ca;
    cor[nomeTime(m, 'b')] = m.cb;
    const quem = autores(m).map(([p, n]) => nome(p) + (n > 1 ? ` (${n})` : ''));
    t +=
      `\n${i + 1}. ${marca(m.ca)}${nomeTime(m, 'a')} *${m.ga} × ${m.gb}* ${nomeTime(m, 'b')}` +
      (SP.pairs ? '' : ' ' + col(m.cb).e) +
      (quem.length ? ` (${quem.join(', ')})` : '');
  });
  const art = artilharia(ms, nome, lancada, LOCAL);
  if (art.length) t += `\n\n🏅 *${artNome()}*: ` + art.map(([p, n]) => `${nome(p)} ${n}`).join(' · ');
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
