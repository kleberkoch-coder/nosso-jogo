/* Ações: Rodada: datas, presença, avulsos, sorteio, times, lista × times e histórico. Fazem parte de ACT (src/acoes.js). */
import { horaTexto } from '../dominio/rodadas.js';
import { cfg } from '../dominio/caixa.js';
import { hasPos, porTime, posKeys, sport, tn } from '../dominio/esportes.js';
import {
  attendance,
  curRodada,
  fixos,
  gname,
  isAvulso,
  normName,
  players,
  pname,
  ppos,
  rodadas,
  setLvl,
} from '../dominio/grupo.js';
import { draw } from '../dominio/sorteio.js';
import { foraDosTimes } from '../dominio/divergencia.ts';
import { reservas, sugerirTimes, titulares } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { linkDaRodada, txtConvite, txtTimes } from '../dominio/whatsapp.js';
import { shareDlg } from '../ui/Compartilhar';
import { quemCobrar } from '../dominio/cobrar';
import { limparMinimos } from '../dominio/posicoes';
import { elencoDaRodada, minimosDoGrupo, montarColetes, montarMinimos, montarVagas } from '../telas/Rodada';
import { situacao, vagasValidas } from '../dominio/vagas';
import { copyText } from '../eventos.js';
import { B, setCAP, sleep } from '../nucleo/backend.js';
import { lerContato } from '../ui/contato-form';
import { editApp, editRat, editRod, saveContato, setPres } from '../nucleo/edicoes.js';
import { apagarPartidasDaRodada } from '../nucleo/partidas.js';
import { GB, S, w } from '../nucleo/estado.js';
import { linkProxima, linkRodada } from '../nucleo/links.js';
import { $, diaSemana, fdate, toast } from '../nucleo/util.js';
import { avisar, closeDlg, closeDlgNow, confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import {
  drawPreview,
  janelaAvulso,
  janelaEditarAvulso,
  janelaEscolherTime,
  janelaMover,
  janelaPorTime,
  janelaSorteio,
  playerDlg,
  rodDlg,
} from '../ui/JanelasGestao';
import { changed, render } from '../ui/render.js';
import { LOCAL } from '../i18n/formatos.js';
import { nPartidas, temVotacao } from '../telas/rodada-partes.js';
import { ACT } from '../acoes.js';

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
  janelaEscolherTime(pid, curRodada().times);
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

const acoes = {
  newRod: () => rodDlg(null),
  editRod: () => rodDlg(curRodada()),
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
  shareConvite: () => shareDlg(tx('rodadm.conviteTitulo'), txtConvite(curRodada())),
  copyLink: () => copyText(linkRodada(curRodada().id)),
  /* KAN-179: mínimo para o jogo (total e por posição), salvo no grupo e válido para todas as rodadas. */
  abrirMinimos: () => {
    openDlg('minRaiz');
    dlg.setAttribute('aria-labelledby', 'minTitulo');
    montarMinimos();
    $('#minRaiz .minp')?.focus();
  },
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
  abrirVagas: () => {
    openDlg('vagasRaiz');
    dlg.setAttribute('aria-labelledby', 'vagasTitulo');
    montarVagas(curRodada(), attendance().inn.length);
    $('#vagasN')?.focus();
  },
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
  addAvulso: el => {
    const t = el && el.dataset ? el.dataset.t : null;
    S.alvoTime = t != null && t !== '' ? +t : null;
    const r = curRodada(),
      regs = Object.entries(S.avul || {})
        .filter(([id]) => !S.jog[id] && S.pres[id]?.s !== 'in')
        .sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', LOCAL));
    janelaAvulso(regs);
  },
  pickAvulso: el => {
    const id = el.dataset.p,
      a = S.avul[id];
    closeDlg();
    const ps = [setPres(curRodada().id, id, { s: 'in', nome: a.nome, avulso: true, pos: a.pos || '' })];
    if (S.alvoTime != null) ps.push(porNoTime(S.alvoTime, id));
    else toast(a.nome + ' confirmado.');
    S.alvoTime = null;
    return Promise.all(ps);
  },
  saveAvulso: el => {
    const n = val('anm');
    if (n.length < 2) {
      toast(tx('jogador.digiteNome'));
      return;
    }
    const ct = lerContato('ptel');
    if (!ct) return;
    const same = Object.entries(S.avul || {}).find(([, a]) => normName(a.nome) === normName(n));
    if (same) {
      const c = confirmou(el, {
        titulo: tx('avulso.jaJogouTitulo', { nome: n }),
        texto: tx('avulso.usarCadastroTexto'),
        acao: tx('avulso.usarCadastro'),
        nao: tx('avulso.cadastrarNovo'),
      });
      if (!c) return;
      if (c === 'sim') return ACT.pickAvulso({ dataset: { p: same[0] } });
    }
    const id = B.newId(),
      v = +($('#plv')?.value ?? 5),
      pos = val('apos'),
      o = { nome: n, pos, criado: Date.now() };
    S.avul[id] = o;
    const ps = [
      setPres(curRodada().id, id, { s: 'in', nome: n, avulso: true, pos }),
      w(GB.set('avulsos/' + id, o)),
      editRat(a => setLvl(a, id, v)),
    ];
    if (S.alvoTime != null) {
      ps.push(porNoTime(S.alvoTime, id));
      S.alvoTime = null;
    }
    const c = saveContato(id, ct.tel, '');
    if (c) ps.push(c);
    closeDlg();
    return Promise.all(ps);
  },
  editAvulso: el => {
    const id = el.dataset.p,
      a = S.avul[id] || { nome: pname(id), pos: ppos(id) },
      ct = (S.cont || {})[id] || {};
    janelaEditarAvulso(id, a, ct.tel || '');
  },
  saveAvEdit: el => {
    const id = el.dataset.p,
      n = val('anm');
    if (n.length < 2) {
      toast(tx('jogador.digiteNome'));
      return;
    }
    const ct = lerContato('ptel');
    if (!ct) return;
    const o = Object.assign({ criado: Date.now() }, S.avul[id] || {}, { nome: n, pos: val('apos') || '' });
    S.avul[id] = o;
    changed();
    const ps = [w(GB.set('avulsos/' + id, o)), $('#plv') ? editRat(a => setLvl(a, id, +$('#plv').value)) : null];
    const c = saveContato(id, ct.tel, '');
    if (c) ps.push(c);
    closeDlg();
    toast(tx('avulso.atualizado'));
    return Promise.all(ps);
  },
  delAvulso: el => {
    const id = el.dataset.p;
    if (
      confirmou(el, {
        titulo: tx('avulso.esquecerTitulo'),
        texto: tx('avulso.esquecerTexto'),
        acao: tx('avulso.esquecer'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    delete S.avul[id];
    changed();
    closeDlg();
    return w(GB.del('avulsos/' + id));
  },
  promote: el => {
    const id = el.dataset.p,
      p = S.avul?.[id] || { nome: S.pres[id]?.nome, pos: S.pres[id]?.pos };
    playerDlg(null, { id, name: p?.nome, pos: p?.pos, tipo: 'diarista' });
    $('[data-a=savePlayer]').dataset.p = '';
    $('[data-a=savePlayer]').dataset.new = id;
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
    janelaSorteio({ n, nov: cfg().novelty, fora, inn: a.inn, dentro, T });
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
    return sleep(40).then(() => {
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
  color: el => {
    openDlg('coleteRaiz');
    dlg.setAttribute('aria-labelledby', 'coleteTitulo');
    montarColetes(curRodada(), +el.dataset.v);
    $('#coletes [aria-pressed=true]')?.focus();
  },
  /* Troca a cor gravando só cores.{time} (KAN-108). Se outro time usa a cor, os dois trocam. */
  pickColor: el => {
    const r = curRodada(),
      ti = +el.dataset.v,
      c = +el.dataset.c2,
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
  move: el => {
    const r = curRodada(),
      f = +el.dataset.v,
      pid = el.dataset.p;
    janelaMover(pid, f, r.times);
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
    janelaPorTime(ti, t, conf, outros);
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
