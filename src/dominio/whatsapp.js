import { col, colete, hasPos, posIdx, posLabel, sport, tn } from './esportes.js';
import { attendance, gname, pname, ppos, upcoming } from './grupo.js';
import { hora } from './rodadas.js';
import { linkMaps, linkProxima, linkRodada } from '../nucleo/links.js';
import { fdate } from '../nucleo/util.js';
import { tx } from '../i18n/index.js';
import { textoSorteio } from '../ui/linha-sorteio';

/* =================== textos WhatsApp =================== */
/* Link para confirmar: no jogo fixo, o permanente (sempre a próxima rodada); senão, o da rodada. */
function linkDaRodada(r) {
  return upcoming()[0]?.id === r.id && r.fixo ? linkProxima() : linkRodada(r.id);
}
function txtConvite(r) {
  const a = attendance(),
    isNext = upcoming()[0]?.id === r.id && r.fixo;
  let t = `${sport().e} *${gname()}* — ${fdate(r.date)}${r.time ? ' · ' + hora(r) : ''}\n`;
  if (r.place) t += `📍 ${r.place}\n🗺️ ${linkMaps(r.place)}\n`;
  t += `\n${tx('zap.confirmeAqui')}\n${isNext ? linkProxima() : linkRodada(r.id)}`;
  /* KAN-228: extra da rodada (churrasco, pizzada…), respondido no mesmo link. */
  if (r.extra && r.extra.n) t += '\n\n' + tx('zap.extra', { n: r.extra.n });
  if (a.inn.length)
    t +=
      `\n\n✅ *${tx('zap.confirmados', { n: a.inn.length })}*\n` +
      a.inn.map((p, i) => `${i + 1}. ${pname(p)}`).join('\n');
  return t;
}
function txtTimes(r) {
  let t = `${sport().e} *${tx('zap.times', { data: fdate(r.date) })}*${r.place ? '\n📍 ' + r.place + '\n🗺️ ' + linkMaps(r.place) : ''}\n`;
  r.times.forEach((tm, i) => {
    const c = col(tm.c),
      rs = id => ((tm.res || []).includes(id) ? 1 : 0);
    t +=
      `\n${sport().pairs ? '🤝' : c.e} *${tn(i)}*${sport().pairs ? '' : ' · ' + colete(tm.c)}\n` +
      tm.players
        .slice()
        .sort((a, b) => rs(a) - rs(b) || posIdx(ppos(a)) - posIdx(ppos(b)))
        .map(
          id =>
            '• ' +
            pname(id) +
            (hasPos() ? ` (${posLabel(ppos(id))})` : '') +
            (rs(id) ? ' — ' + tx('times.reserva') : '')
        )
        .join('\n') +
      '\n';
  });
  /* KAN-246: a hora e o número do sorteio, numa linha no fim (se o grupo não desligou). */
  const ls = textoSorteio(r.sor);
  return t.trim() + (ls ? '\n\n' + ls : '') + '\n\n' + tx('zap.detalhes', { link: linkRodada(r.id) });
}
/* A janela de compartilhar é um componente da gestão (KAN-131): ui/Compartilhar.tsx. */
export { linkDaRodada, txtConvite, txtTimes };
