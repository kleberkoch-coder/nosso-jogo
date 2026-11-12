/* Ações: Rodada: datas, presença, sorteio, times, lista × times e histórico. Os avulsos ficam em acoes/avulsos.ts
   (v87). Fazem parte de ACT (src/acoes.js). */
import { LOCAL } from '../i18n/formatos.js';
import { horaTexto } from '../dominio/rodadas.js';
import { cfg } from '../dominio/caixa.js';
import { hasPos, porTime, posKeys, sport, tn } from '../dominio/esportes.js';
import { attendance, curRodada, fixos, gname, isAvulso, players, pname, ppos, rodadas } from '../dominio/grupo.js';
import { foraDosTimes } from '../dominio/divergencia.ts';
import { reservas, sugerirTimes, titulares } from '../dominio/times.ts';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import { h, render as desenhar } from 'preact';
import { linkDaRodada, txtConvite, txtTimes } from '../dominio/whatsapp.js';
import { Compartilhar, shareDlg } from '../ui/Compartilhar';
import { quemCobrar } from '../dominio/cobrar';
import { limparMinimos } from '../dominio/posicoes';
import { dadosMinimos, dadosVagas, elencoDaRodada, listasDoConvite, minimosDoGrupo } from '../telas/Rodada';
import { situacao, vagasValidas } from '../dominio/vagas';
import { copyText } from '../eventos.js';
import { B, setCAP, sleep } from '../nucleo/backend.js';
import { editApp, editRod, setPres } from '../nucleo/edicoes.js';
import { apagarPartidasDaRodada } from '../nucleo/partidas.js';
import { GB, S, w } from '../nucleo/estado.js';
import { linkProxima, linkRodada } from '../nucleo/links.js';
import { $, diaSemana, fdate, toast } from '../nucleo/util.js';
import { avisar, closeDlg, closeDlgNow, confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { drawPreview, comJanelasTimes } from '../ui/JanelasGestao';
import { changed, render } from '../ui/render.js';
import { nPartidas, temVotacao } from '../telas/rodada-partes.js';
import { ACT } from '../acoes.js';
import { comAjuste, novoSorteio } from '../dominio/sorteio-info';
import { situacao as situacaoMaterial } from '../dominio/material';

const janelaRodada = () => import('../ui/JanelaRodada');
/* Sorteio de times: chega com o primeiro "Sortear" (doDraw). */
let draw = null;
const naoCarregou = () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'));
/* KAN-246: mexer nos times depois do sorteio conta um ajuste manual (sem dizer quem foi mexido). */
function ajusteManual(x) {
  const s = comAjuste(x.sor);
  if (s) x.sor = s;
}
/* Põe a pessoa direto num time (sai de qualquer outro) e a inclui na foto do sorteio, para não gerar aviso. */
function porNoTime(ti, pid) {
  const r = curRodada(),
    t = r.times[ti];
  toast(tx('porTime.posto', { nome: pname(pid), time: tn(ti) }));
  return editRod(r.id, x => {
    x.times.forEach(t => {
      t.players = t.players.filter(p => p !== pid);
      if (t.res) t.res = t.res.filter(p => p !== pid);
    });
    ajusteManual(x);
    const alvo = x.times[ti];
    if (titulares(alvo).length >= porTime()) alvo.res = (alvo.res || []).concat(pid);
    alvo.players.push(pid);
    x.info = x.info || {};
    x.info[pid] = { n: pname(pid), p: ppos(pid) };
    const b = x.base || [...fotoDoSorteio(x)];
    if (!b.includes(pid)) b.push(pid);
    x.base = b;
  });
}
/* Escolher o time de quem confirmou depois do sorteio. */
function escolherTime(pid) {
  return comJanelasTimes((m, u) => m.janelaEscolherTime(u, pid, curRodada().times));
}
/* KAN-71: depois de sortear, a tela vai até os times e o foco fica no título "Times" (leitor de tela anuncia). */
function irParaTimes() {
  setTimeout(() => {
    const h = document.getElementById('timesTit');
    if (!h) return;
    h.scrollIntoView({ block: 'start' });
    h.focus({ preventScroll: true });
  }, 80);
}

/* KAN-261: janelas de mínimo e vagas, sob demanda (com os textos delas). Sem internet, avisa. */
let JV = null;
const janelasVagas = () =>
  JV
    ? Promise.resolve(JV)
    : import('../ui/VagasJanelas').then(m => {
        juntarTextos(m.textos);
        return (JV = m);
      });
const semJanela = () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'));

const acoes = {
  /* pelada-v109: a janela da rodada baixa no primeiro toque (o botão gira até ela abrir). */
  newRod: () => janelaRodada().then(m => m.rodDlg(null), naoCarregou),
  editRod: () => janelaRodada().then(m => m.rodDlg(curRodada()), naoCarregou),
  saveRod: el => {
    const d = val('rdt');
    if (!d) {
      toast(tx('rodadm.escolhaData'));
      return;
    }
    const id = el.dataset.v;
    if (id) editRod(id, r => Object.assign(r, { date: d, time: val('rtm'), fim: val('rfm'), place: val('rpl') }));
    else {
      const nid = B.newId();
      S.rid = nid;
      editRod(nid, r =>
        Object.assign(r, {
          date: d,
          time: val('rtm'),
          fim: val('rfm'),
          place: val('rpl'),
          locked: false,
          times: null,
          info: {},
          createdAt: Date.now(),
        })
      );
      editApp(a => {
        a.cfg.place = val('rpl');
        a.cfg.time = val('rtm');
      });
    }
    closeDlg();
  },
  delRod: el => {
    const r = curRodada();
    if (
      confirmou(el, {
        titulo: tx('rodadm.excluirTitulo', { data: fdate(r.date) }),
        texto: tx('rodadm.excluirTexto'),
        acao: tx('rodadm.excluirAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    Object.keys(S.pres).forEach(p => GB.del('rodadas/' + r.id + '/presencas/' + p));
    return apagarPartidasDaRodada(r.id, r.date).then(() => {
      w(GB.del('rodadas/' + r.id));
      delete S.rod[r.id];
      S.rid = null;
      changed();
    });
  },
  /* KAN-75: o emoji vem do esporte do grupo; "Todo" no sábado e no domingo. */
  shareFixo: () => {
    const f = fixos();
    shareDlg(
      tx('fixos.titulo'),
      tx('fixos.convite', {
        emoji: sport().e,
        grupo: gname(),
        dias: f
          .map(x =>
            tx(x.dow === 0 || x.dow === 6 ? 'fixos.diaTodo' : 'fixos.diaToda', {
              dia: diaSemana(x.dow).toLowerCase(),
              ini: horaTexto(x.ini),
              fim: x.fim ? tx('fixos.ate', { fim: horaTexto(x.fim) }) : '',
              local: x.place ? ' — ' + x.place : '',
            })
          )
          .join('\n'),
        link: linkProxima(),
      })
    );
  },
  copyFixo: () => copyText(linkProxima()),
  cancelRod: el => {
    const r = curRodada();
    if (
      !r.cancelada &&
      confirmou(el, {
        titulo: tx('rodadm.cancelarTitulo', { data: fdate(r.date) }),
        texto: tx('rodadm.cancelarTexto'),
        acao: tx('rodadm.cancelarAcao'),
        cancelar: tx('rodadm.voltar'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    editRod(r.id, x => {
      x.cancelada = !x.cancelada;
    });
    if (!r.cancelada) toast(tx('rodadm.cancelada'));
  },
  lock: el => {
    const r = curRodada();
    if (
      r.locked &&
      r.times &&
      confirmou(el, {
        titulo: tx('lista.reabrirTitulo'),
        texto: tx('lista.confirmaReabrir'),
        acao: tx('lista.reabrirAcao'),
      }) !== 'sim'
    )
      return;
    return editRod(r.id, x => {
      x.locked = !x.locked;
    });
  },
  /* KAN-255: com quem não vai, quem não respondeu e o que falta (ui/ConviteZap.tsx, sob demanda). */
  shareConvite: () =>
    import('../ui/ConviteZap').then(
      m => {
        const r = curRodada();
        openDlg('shRaiz');
        dlg.setAttribute('aria-labelledby', 'shTitulo');
        juntarTextos(m.textos);
        m.mandarConvite(
          Object.assign(
            {
              titulo: tx('rodadm.conviteTitulo'),
              texto: txtConvite(r),
              Compartilhar,
              local: LOCAL,
              tx,
              render: desenhar,
            },
            listasDoConvite(r)
          ),
          document.getElementById('shRaiz')
        );
      },
      () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
    ),
  copyLink: () => copyText(linkRodada(curRodada().id)),
  /* KAN-179: mínimo para o jogo (total e por posição), salvo no grupo e válido para todas as rodadas. */
  /* KAN-261: as janelas de mínimo e vagas baixam no primeiro toque (ui/VagasJanelas.tsx). */
  abrirMinimos: () =>
    janelasVagas().then(m => {
      openDlg('minRaiz');
      dlg.setAttribute('aria-labelledby', 'minTitulo');
      desenhar(h(m.Minimos, { d: dadosMinimos() }), $('#minRaiz'));
      $('#minRaiz .minp')?.focus();
    }, semJanela),
  salvarMinimos: () => {
    const m = {};
    document.querySelectorAll('#minRaiz .minp').forEach(i => (m[i.dataset.k] = i.value));
    const novo = limparMinimos(hasPos() ? posKeys() : [], m),
      ctrl = !!$('#vagasCtrl')?.checked;
    closeDlg();
    if (JSON.stringify(novo) === JSON.stringify(minimosDoGrupo()) && ctrl === !!cfg().vagasCtrl) return;
    const p = editApp(a => {
      a.cfg.minPos = novo;
      a.cfg.vagasCtrl = ctrl;
    });
    toast(tx('minimo.salvo'));
    return p;
  },
  /* KAN-63: vagas para diaristas e avulsos nesta rodada. Abrir zera o contador; mudar a quantidade mantém quem já entrou. */
  abrirVagas: () =>
    janelasVagas().then(m => {
      openDlg('vagasRaiz');
      dlg.setAttribute('aria-labelledby', 'vagasTitulo');
      desenhar(h(m.AbrirVagas, dadosVagas(curRodada(), attendance().inn.length)), $('#vagasRaiz'));
      $('#vagasN')?.focus();
    }, semJanela),
  salvarVagas: () => {
    const r = curRodada(),
      max = vagasValidas(val('vagasN')),
      abrindo = !(r.vagas && r.vagas.aberta);
    closeDlg();
    const p = editRod(r.id, x => {
      x.vagas = { aberta: true, max };
    });
    toast(max ? tp('vagas.abertasToast', max) : tx('vagas.abertasSemLimiteToast'));
    return abrindo ? Promise.all([p, w(GB.del('rodadas/' + r.id + '/limites/vagas'))]) : p;
  },
  fecharVagas: () => {
    const r = curRodada();
    toast(tx('vagas.fechadasToast'));
    return editRod(r.id, x => {
      x.vagas = { aberta: false, max: (r.vagas && r.vagas.max) || 0 };
    });
  },
  /* KAN-64: mensagem pronta para o grupo do WhatsApp com quem ainda não respondeu. */
  /* KAN-190: cobrar no WhatsApp quem guarda um material e ainda não respondeu. */
  matCobrar: el => {
    const r = curRodada(),
      m = r && situacaoMaterial(cfg().mat, S.pres).find(x => x.nome === el.dataset.v);
    if (!m || !m.semResposta.length) return;
    shareDlg(
      tx('mat.cobrar'),
      tx('mat.cobrarTexto', {
        e: sport().e,
        nomes: m.semResposta.map(pname).join(', '),
        nome: m.nome,
        data: fdate(r.date),
        link: linkDaRodada(r),
      })
    );
  },
  cobrarGrupo: () => {
    const r = curRodada(),
      falta = r
        ? quemCobrar(elencoDaRodada(r), S.pres, S.jog || {}, situacao(!!cfg().vagasCtrl, r.vagas, S.limVg).podeEntrar)
        : [];
    if (!r || !falta.length) return;
    shareDlg(
      tx('cobrar.noGrupo'),
      tx('cobrar.textoGrupo', {
        e: sport().e,
        grupo: gname(),
        data: fdate(r.date),
        nomes: falta.map(pname).join(', '),
        link: linkDaRodada(r),
      })
    );
  },
  shareTimes: () => shareDlg(tx('rodadm.timesTitulo'), txtTimes(curRodada())),
  mark: el => {
    const r = curRodada(),
      id = el.dataset.p,
      v = el.dataset.v,
      cur = S.pres[id];
    if (r.locked) return;
    if (
      r.times &&
      confirmou(el, {
        titulo: tx('lista.mudarTitulo', { nome: pname(id) }),
        texto: tx('lista.confirmaMudar', { nome: pname(id) }),
        acao: tx('lista.mudarAcao'),
      }) !== 'sim'
    )
      return;
    if (cur && cur.s === v) {
      if (isAvulso(id)) setPres(r.id, id, Object.assign({}, cur, { s: v === 'in' ? 'out' : 'in' }));
      else {
        delete S.pres[id];
        changed();
        w(GB.del('rodadas/' + r.id + '/presencas/' + id));
      }
    } else setPres(r.id, id, Object.assign({}, cur || {}, { s: v }));
  },
  drawDlg: el => {
    const r0 = curRodada();
    if (r0 && r0.times && temVotacao(r0)) {
      toast(tx('sorteio.bloqueadoVotacao'), 6000);
      return;
    }
    if (
      r0 &&
      r0.times &&
      nPartidas(r0) &&
      confirmou(el, {
        titulo: tx('sorteio.comPartidasTitulo'),
        texto: tp('sorteio.comPartidas', nPartidas(r0)),
        acao: tx('div.sortearDeNovo'),
      }) !== 'sim'
    )
      return;
    const a = attendance(),
      T = porTime(),
      fora = new Set(cfg().foraPos || []),
      k = a.inn.length,
      dentro = a.inn.filter(id => !(hasPos() && fora.has(ppos(id)))).length,
      n = sport().pairs ? Math.max(1, Math.floor(dentro / 2)) : sugerirTimes(dentro, T);
    return comJanelasTimes((m, u) => m.janelaSorteio(u, { n, nov: cfg().novelty, fora, inn: a.inn, dentro, T }));
  },
  /* Deixar uma posição inteira fora do sorteio (ex.: goleiros fixos). A escolha fica salva no grupo ao sortear. */
  dFora: el => {
    const box = $('#drawBox'),
      p = el.dataset.v,
      f = new Set((box.dataset.fora || '').split(',').filter(Boolean)),
      on = !f.has(p);
    on ? f.add(p) : f.delete(p);
    box.dataset.fora = [...f].join(',');
    el.setAttribute('aria-pressed', on);
    box.querySelectorAll('.dp').forEach(c => {
      if (c.dataset.pos === p) c.checked = !on;
    });
    if (!sport().pairs) {
      const k = box.querySelectorAll('.dp:checked').length;
      box.dataset.n = sugerirTimes(k, porTime());
    }
    drawPreview();
  },
  dN: el => {
    $('#drawBox').dataset.n = el.dataset.v;
    drawPreview();
  },
  /* KAN-71: filtro da lista de presença (Todos, Vão, Não vão, Sem resposta). Só muda a tela. */
  presFiltro: el => {
    S.presFiltro = el.dataset.v;
    render();
  },
  dNov: el => {
    $('#drawBox').dataset.nov = el.dataset.v;
    drawPreview();
  },
  doDraw: () => {
    const box = $('#drawBox'),
      n = +box.dataset.n,
      nov = +box.dataset.nov,
      fora = (box.dataset.fora || '').split(',').filter(Boolean),
      ids = [...box.querySelectorAll('.dp:checked')].map(x => x.value);
    if (ids.length < n * 2) return;
    /* KAN-245: o sorteio baixa na hora de sortear (não pesa na gestão). */
    return Promise.all([sleep(40), import('../dominio/sorteio.js')]).then(([, m]) => {
      draw = m.draw;
      const cap = [];
      cap.close = false;
      setCAP(cap);
      try {
        ACT._draw(ids, n, nov, fora);
      } finally {
        setCAP(null);
      }
      return Promise.allSettled(cap).then(() => {
        closeDlgNow();
        irParaTimes();
      });
    });
  },
  _draw: (ids, n, nov, fora) => {
    if (!draw) return;
    const r = curRodada(),
      T = draw(ids, n, nov, r.id),
      PT = porTime(),
      quando = id => (S.pres[id] || {}).t || 0;
    editRod(r.id, x => {
      const old = x.times || [];
      x.times = T.map((p, i) => {
        const t = { c: old[i]?.c ?? i, players: p },
          rs = reservas(p, PT, quando);
        if (rs.length) t.res = rs;
        return t;
      });
      x.info = {};
      ids.forEach(id => (x.info[id] = { n: pname(id), p: ppos(id) }));
      x.drawnAt = Date.now();
      /* KAN-246: número e hora do sorteio (sobe de 1 em 1; os ajustes manuais voltam a zero). */
      x.sor = novoSorteio(x.sor, x.drawnAt);
      /* pelada-v15: sortear fecha a lista e guarda a foto dos confirmados, para avisar se a lista mudar depois. */
      x.locked = true;
      x.base = attendance().inn;
    });
    if (nov !== cfg().novelty || (fora && fora.join() !== (cfg().foraPos || []).join()))
      editApp(a => {
        a.cfg.novelty = nov;
        if (fora) a.cfg.foraPos = fora;
      });
    S.live = null;
    closeDlg();
    toast(tx('lista.sorteadoFechada'));
  },
  /* Troca a cor do colete gravando só cores.{time} (KAN-108), sem regravar os jogadores. */
  /* v60: o nome do time é o número; a cor é só o colete. Abre a escolha da cor. */
  /* A janela do colete e a paleta (KAN-235) baixam no primeiro toque (ui/PaletaDeCor.tsx). */
  color: el =>
    import('../ui/PaletaDeCor').then(
      m => {
        openDlg('coleteRaiz');
        dlg.setAttribute('aria-labelledby', 'coleteTitulo');
        m.montarColetes(curRodada(), +el.dataset.v);
        $('#coletes [aria-pressed=true]')?.focus();
      },
      () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
    ),
  /* Troca a cor gravando só cores.{time} (KAN-108). Se outro time usa a cor, os dois trocam. */
  pickColor: el => {
    const r = curRodada(),
      ti = +el.dataset.v,
      /* KAN-235: as 8 de sempre são números; a cor da paleta é o texto "#rrggbb|Nome". */
      c = /^\d+$/.test(el.dataset.c2) ? +el.dataset.c2 : el.dataset.c2,
      antes = r.times[ti].c,
      outro = r.times.findIndex((t, i) => i !== ti && t.c === c);
    closeDlg();
    if (c === antes) return;
    const novas = { [ti]: c };
    if (outro >= 0) novas[outro] = antes;
    const d = S.rod[r.id] || {};
    S.rod[r.id] = Object.assign({}, d, { cores: Object.assign({}, d.cores || {}, novas) });
    changed();
    const campos = {};
    Object.keys(novas).forEach(k => (campos['cores.' + k] = novas[k]));
    return w(GB.patch('rodadas/' + r.id, campos));
  },
  /* KAN-235: "Outra cor" abre a paleta (baixa só agora). */
  outraCor: el => {
    const ti = +el.dataset.v,
      r = curRodada();
    return import('../ui/PaletaDeCor').then(
      m => m.abrirPaleta(ti, r.times[ti].c),
      () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
    );
  },
  usarCor: () =>
    import('../ui/PaletaDeCor').then(m => {
      const e = m.confirmar();
      if (e) return ACT.pickColor({ dataset: { v: String(e.ti), c2: e.valor } });
    }),
  move: el => {
    const r = curRodada(),
      f = +el.dataset.v,
      pid = el.dataset.p;
    return comJanelasTimes((m, u) => m.janelaMover(u, pid, f, r.times));
  },
  toggleRes: el => {
    const f = +el.dataset.v,
      pid = el.dataset.p;
    closeDlg();
    return editRod(curRodada().id, x => {
      const t = x.times[f],
        r = t.res || [];
      t.res = r.includes(pid) ? r.filter(p => p !== pid) : r.concat(pid);
      if (!t.res.length) delete t.res;
    });
  },
  doMove: el => {
    const to = +el.dataset.v,
      f = +el.dataset.f,
      pid = el.dataset.p;
    editRod(curRodada().id, x => {
      x.times[f].players = x.times[f].players.filter(p => p !== pid);
      if (x.times[f].res) {
        x.times[f].res = x.times[f].res.filter(p => p !== pid);
        if (!x.times[f].res.length) delete x.times[f].res;
      }
      x.times[to].players.push(pid);
      ajusteManual(x);
    });
    closeDlg();
  },
  /* ---- lista × times (pelada-v15) ---- */
  divTirar: el => {
    const pid = el.dataset.p;
    toast(tx('div.tirado', { nome: pname(pid) }));
    return editRod(curRodada().id, x => {
      x.times.forEach(t => {
        t.players = t.players.filter(p => p !== pid);
        if (t.res) t.res = t.res.filter(p => p !== pid);
      });
      ajusteManual(x);
    });
  },
  divPor: el => escolherTime(el.dataset.p),
  divManter: () => {
    toast(tx('div.mantidos'));
    return editRod(curRodada().id, x => {
      x.base = attendance().inn;
    });
  },
  porTime: el => {
    const r = curRodada(),
      ti = +el.dataset.v,
      t = r.times[ti],
      a = attendance();
    const conf = foraDosTimes(r, a.inn),
      outros = foraDosTimes(
        r,
        players().map(p => p.id)
      ).filter(id => !conf.includes(id));
    return comJanelasTimes((m, u) => m.janelaPorTime(u, ti, t, conf, outros));
  },
  doPorTime: el => {
    const ti = +el.dataset.v,
      pid = el.dataset.p,
      r = curRodada(),
      cur = S.pres[pid];
    closeDlg();
    const ps = [];
    if (!cur || cur.s !== 'in') ps.push(setPres(r.id, pid, Object.assign({}, cur || {}, { s: 'in' })));
    ps.push(porNoTime(ti, pid));
    return Promise.all(ps);
  },
};

export { acoes, porNoTime, escolherTime };
