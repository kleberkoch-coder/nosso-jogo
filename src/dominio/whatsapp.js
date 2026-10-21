import { col, colete, hasPos, posIdx, posLabel, sport, tn } from './esportes.js';
import { attendance, gname, pname, ppos, upcoming } from './grupo.js';
import { hora } from './rodadas.js';
import { linkMaps, linkProxima, linkRodada } from '../nucleo/links.js';
import { esc, fdate } from '../nucleo/util.js';
import { openDlg } from '../ui/dialogos.js';

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
  t += `\nConfirme sua presença aqui:\n${isNext ? linkProxima() : linkRodada(r.id)}`;
  if (a.inn.length)
    t += `\n\n✅ *Confirmados (${a.inn.length})*\n` + a.inn.map((p, i) => `${i + 1}. ${pname(p)}`).join('\n');
  return t;
}
function txtTimes(r) {
  let t = `${sport().e} *Times — ${fdate(r.date)}*${r.place ? '\n📍 ' + r.place + '\n🗺️ ' + linkMaps(r.place) : ''}\n`;
  r.times.forEach((tm, i) => {
    const c = col(tm.c),
      rs = id => ((tm.res || []).includes(id) ? 1 : 0);
    t +=
      `\n${sport().pairs ? '🤝' : c.e} *${tn(i)}*${sport().pairs ? '' : ' · ' + colete(tm.c)}\n` +
      tm.players
        .slice()
        .sort((a, b) => rs(a) - rs(b) || posIdx(ppos(a)) - posIdx(ppos(b)))
        .map(id => '• ' + pname(id) + (hasPos() ? ` (${posLabel(ppos(id))})` : '') + (rs(id) ? ' — reserva' : ''))
        .join('\n') +
      '\n';
  });
  return t.trim() + `\n\nDetalhes: ${linkRodada(r.id)}`;
}
function shareDlg(title, text) {
  openDlg(`<h3>${esc(title)}</h3><textarea class="inp" id="shtxt">${esc(text)}</textarea>
  <div class="dlg-f"><button class="btn" data-a="close">Fechar</button><button class="btn" data-a="copy">Copiar texto</button>
  <a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Abrir no WhatsApp</a></div>`);
}

export { linkDaRodada, shareDlg, txtConvite, txtTimes };
