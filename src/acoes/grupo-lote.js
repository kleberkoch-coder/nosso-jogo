/* Ações: Grupos: criar, editar, duplicar, posições, inativar e país da conta (os administradores convidados ficam em
   acoes/administradores.ts). Fazem parte de ACT (src/acoes.js). */
import { CAIXA_K, cfg, ptipo } from '../dominio/caixa.js';
import { SPORTS, porTime, porTimePadrao, sport } from '../dominio/esportes.js';
import { dupName, fdia, fixos, freq, gname, grpAtivo, lvl, normName, players } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import { B, op } from '../nucleo/backend.js';
import { gruposEsgotados, limite } from '../dominio/limites.ts';
import { temRecurso } from '../dominio/planos';
import { minhaSituacao } from '../nucleo/plano';
import { avisoLimiteGrupos, inativarGrupo, reativarGrupo } from './plano';
import { editApp } from '../nucleo/edicoes.js';
import { GB, S, clean, w } from '../nucleo/estado.js';
import { $, cl, esc, toast, uid } from '../nucleo/util.js';
import { upMyGroup } from '../rotas.js';
import { closeDlg, confirmou, dlg, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { LOCAL } from '../i18n/formatos.js';
import { contaRegiao } from '../ui/regiao.ts';
import { definirRegiao } from '../i18n/formatos.js';
import { regiaoDe } from '../dominio/regiao.ts';
import { juntarTextos } from '../i18n/index.js';
import { janelaDuplicar, janelaGrupo, janelaPaisConta, janelaPosicao, janelaSeusGrupos } from '../ui/JanelasGrupo';
import textos from '../i18n/pt-BR-grupolote';
import { acoes as administradores } from './administradores';

juntarTextos(textos);

/* Limite de grupos por conta (KAN-89): confere antes de criar. Sem sinal, deixa a decisão para o Firebase. */
async function limiteGrupos() {
  try {
    const [c, f] = await Promise.all([B.get('contas/' + S.user.uid), B.get('sistema/limites')]);
    return { cheio: gruposEsgotados(c, f), n: limite(f, 'gruposPorConta') };
  } catch (e) {
    return { cheio: false, n: limite(null, 'gruposPorConta') };
  }
}
/* Mostra a mensagem no formulário, rolando até ela (o botão Criar fica no fim do formulário). */
function avisoGrupos(sel, n) {
  const m = tp('limite.grupos', n),
    e = $(sel);
  if (e) {
    e.textContent = m;
    e.scrollIntoView({ block: 'center' });
  } else toast(m);
}
/* Cria o documento do grupo junto com +1 no contador da conta: ou entram os dois, ou nenhum. */
const gravarGrupo = (gid, o) =>
  B.lote([
    { tipo: 'set', p: 'grupos/' + gid, o },
    { tipo: 'patch', p: 'contas/' + S.user.uid, o: { ng: op.somar(1), ult: gid, ativos: op.uniao([gid]) } },
  ]);
/* KAN-217: o formulário do grupo (telas/GrupoForm.tsx, com país, moeda, fuso e dias fixos) baixa só quando
   "Novo grupo" ou "Editar grupo" abre. Enquanto a janela está aberta, o módulo já está aqui (form). */
let form = null;
const carregarForm = () =>
  import('../telas/GrupoForm').then(
    m => (form = m),
    () => {
      toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'));
      return null;
    }
  );
const formAberto = () => form && form.formAberto();
const lerForm = gid => (form ? form.readGroupForm(gid) : null);

const proprias = {
  /* País da conta (KAN-162): vale para os grupos novos; cada grupo tem o seu em Editar grupo. */
  contaPais: () => {
    janelaPaisConta((S.me && S.me.pais) || 'BR');
    setTimeout(() => $('#cpais')?.focus(), 50);
  },
  salvarPaisConta: () => {
    const pais = val('cpais');
    if (!pais || !S.user) return;
    const o = contaRegiao(pais),
      p = w(B.patch('usuarios/' + S.user.uid, o));
    if (S.me) Object.assign(S.me, o);
    if (!S.gid) definirRegiao(regiaoDe(o));
    closeDlg();
    toast(tx('regiao.contaSalvo'));
    changed();
    return p;
  },
  newGroup: el => {
    /* KAN-220: depois do cadastro, o "Novo grupo" automático pode ser pedido duas vezes enquanto esta parte baixa;
       se a janela já está aberta, não abre de novo (abrir de novo apagaria o que a pessoa já digitou). */
    if (dlg.open && $('#dlg [data-a=createGroup]')) return;
    /* KAN-222 (achado no roteiro de gravação): o automático só abre se a pessoa ainda está na página inicial;
       se ela já criou o grupo (ou abriu outra tela) enquanto esta parte baixava, não abre por cima. */
    if (el && el.dataset && el.dataset.auto && (S.route.n !== 'home' || dlg.open)) return;
    if (avisoLimiteGrupos()) return; // KAN-119: o plano já está cheio de grupos ativos
    janelaGrupo(null);
    return carregarForm().then(m => {
      if (!m || !$('#ngRaiz')) return;
      m.montarGrupoForm({}, false);
      setTimeout(() => $('#ngn')?.focus(), 50);
    });
  },
  editGroup: () => {
    janelaGrupo({ criadoEm: fdia(S.app.createdAt) });
    return carregarForm().then(m => {
      if (m && $('#ngRaiz')) m.montarGrupoForm(S.app, true);
    });
  },
  /* Escolhas dentro do formulário do grupo (componente telas/GrupoForm.tsx). */
  pickFreq: el => formAberto()?.freq(el.dataset.v),
  addSched: () => formAberto()?.maisDia(),
  rmSched: el => formAberto()?.menosDia(el),
  saveGroup: el => {
    const g = lerForm(S.gid);
    if (!g) return;
    const wasFix = fixos()
        .map(x => x.dow + '|' + x.ini)
        .join(),
      willFix = g.fixos.map(x => x.dow + '|' + x.ini).join();
    // Moeda trocada (KAN-162): os valores já lançados não são convertidos. Dias fixos trocados: a confirmação recomeça.
    // As duas perguntas viram uma só (a confirmação roda a ação de novo e só guarda uma resposta).
    const moedaAntes = (S.app.cfg && S.app.cfg.moeda) || 'BRL',
      trocaMoeda = g.regiao.moeda !== moedaAntes,
      trocaDias = !!wasFix && wasFix !== willFix;
    if (
      (trocaMoeda || trocaDias) &&
      confirmou(el, {
        titulo: tx(
          trocaMoeda && trocaDias ? 'grupo.mudancasTitulo' : trocaMoeda ? 'regiao.moedaTitulo' : 'grupo.diasTitulo'
        ),
        texto: [
          trocaMoeda ? tx('regiao.moedaTexto', { antes: moedaAntes, depois: g.regiao.moeda }) : '',
          trocaDias ? tx('grupo.diasTexto') : '',
        ]
          .filter(Boolean)
          .join(' '),
        acao: tx(trocaMoeda && trocaDias ? 'comum.salvar' : trocaMoeda ? 'regiao.moedaAcao' : 'grupo.diasAcao'),
      }) !== 'sim'
    )
      return;
    const p = editApp(a => {
      a.name = g.name;
      a.sport = g.sport;
      a.sportName = g.sportName;
      a.freq = g.freq;
      a.cfg.fixos = g.fixos;
      a.cfg.porTime = g.porTime;
      Object.assign(a.cfg, g.regiao);
      if (g.fixos[0] && g.fixos[0].place) a.cfg.place = g.fixos[0].place;
    });
    upMyGroup(S.gid, { name: g.name, sport: g.sport, sportName: g.sportName });
    S.rid = null;
    closeDlg();
    toast(tx('admgrupo.atualizado'));
    return p;
  },
  addPos: () => janelaPosicao(),
  savePos: () => {
    const k = val('psg')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''),
      l = val('pnmx');
    if (k.length < 2) {
      toast(tx('admgrupo.posSiglaCurta'));
      return;
    }
    if (l.length < 2) {
      toast(tx('admgrupo.posSemNome'));
      return;
    }
    if (sport().pos.some(([x, y]) => x === k || normName(y) === normName(l))) {
      toast(tx('admgrupo.posExiste'));
      return;
    }
    closeDlg();
    return editApp(a => {
      a.posx = (a.posx || []).concat([[k, l]]);
    });
  },
  rmPos: el => {
    const i = +el.dataset.v,
      [k, l] = (S.app.posx || [])[i] || [];
    const n = Object.values(S.jog).filter(p => p.pos === k).length;
    if (
      confirmou(el, {
        titulo: tx('admgrupo.posRemoverTitulo', { pos: l }),
        texto: n ? tp('posicao.removerAviso', n) : tx('admgrupo.posNinguem'),
        acao: tx('admgrupo.posRemover'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    return editApp(a => {
      a.posx = (a.posx || []).filter((x, j) => j !== i);
    });
  },
  dupGroup: () => {
    if (avisoLimiteGrupos()) return;
    janelaDuplicar(gname());
    setTimeout(() => {
      const i = $('#dgn');
      i && (i.focus(), i.select());
    }, 50);
  },
  doDupGroup: async () => {
    const name = val('dgn');
    $('#dgErr').textContent = '';
    if (name.length < 2) {
      $('#dgErr').textContent = tx('admgrupo.semNome');
      return;
    }
    if (dupName(name, null)) {
      $('#dgErr').textContent = tx('admgrupo.nomeRepetido');
      return;
    }
    const lg = await limiteGrupos();
    if (lg.cheio) {
      avisoGrupos('#dgErr', lg.n);
      return;
    }
    const withEl = $('#dgel').checked,
      a = S.app,
      gid = B.newId(),
      uid = S.user.uid,
      now = Date.now(),
      base = 'grupos/' + gid,
      nc = cl(a.cfg) || {},
      c0 = cfg();
    CAIXA_K.forEach(k => delete nc[k]);
    // KAN-119: o grupo novo segue o plano da conta: sem a lista de espera, o controle de vagas não vai junto.
    const sit = minhaSituacao();
    if (!temRecurso(sit, 'listaEspera')) delete nc.vagasCtrl;
    try {
      await gravarGrupo(
        gid,
        clean({
          name,
          sport: a.sport || 'futebol',
          sportName: a.sportName || '',
          freq: freq(),
          posx: a.posx || [],
          ativo: true,
          cfg: nc,
          owner: uid,
          createdAt: now,
          origem: S.gid,
        })
      );
      await B.set(
        base + '/membros/' + uid,
        Object.assign({ uid, email: S.user.email, role: 'owner', at: now }, S.user.via ? { via: S.user.via } : {})
      );
      const pcN = { mensal: c0.mensal, diaria: c0.diaria, pix: c0.pix, tipos: {} };
      if (withEl)
        players().forEach(p => {
          pcN.tipos[p.id] = ptipo(p.id);
        });
      if (temRecurso(sit, 'caixa')) await B.set(base + '/privado/caixa', clean(pcN));
      if (withEl) {
        const keep = new Set(
          players()
            .map(p => p.id)
            .concat(Object.keys(S.avul || {}))
        );
        const ps = [];
        players().forEach(p => {
          const d = Object.assign({}, S.jog[p.id], { criado: now });
          delete d.tipo;
          ps.push(B.set(base + '/jogadores/' + p.id, clean(d)));
        });
        Object.entries(S.avul || {}).forEach(([id, x]) =>
          ps.push(B.set(base + '/avulsos/' + id, clean(Object.assign({}, x, { criado: now }))))
        );
        const R = cl(S.rat) || {},
          nv = {};
        keep.forEach(id => {
          nv[id] = lvl(id);
        });
        ps.push(
          B.set(base + '/privado/ratings', {
            nivel: nv,
            stars: {},
            sep: (R.sep || []).filter(([x, y]) => keep.has(x) && keep.has(y)),
          })
        );
        const C = {};
        Object.entries(S.cont || {}).forEach(([id, c]) => {
          if (keep.has(id)) C[id] = c;
        });
        if (Object.keys(C).length) ps.push(B.set(base + '/privado/contatos', C));
        await Promise.all(ps);
      }
      await upMyGroup(gid, {
        name,
        role: 'owner',
        sport: a.sport || 'futebol',
        sportName: a.sportName || '',
        ativo: true,
        criado: now,
      });
      closeDlg();
      toast(tx('admgrupo.duplicado'));
      location.hash = '#/g/' + gid;
    } catch (e) {
      console.error(e);
      if (e && e.code === 'permission-denied' && !(await B.get('grupos/' + gid).catch(() => null)))
        avisoGrupos('#dgErr', lg.n);
      else toast(tx('admgrupo.dupFalhou'));
    }
  },
  toggleAtivo: el => {
    const on = !grpAtivo();
    if (
      !on &&
      confirmou(el, {
        titulo: tx('admgrupo.inativarTitulo', { nome: gname() }),
        texto: tx('admgrupo.inativarTexto'),
        acao: tx('admgrupo.inativarAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    // KAN-119: reativar só se couber no plano; o grupo entra e sai da lista de ativos da conta junto.
    if (on && avisoLimiteGrupos()) return;
    const p = w(on ? reativarGrupo(S.gid) : inativarGrupo(S.gid));
    toast(tx(on ? 'admgrupo.reativado' : 'admgrupo.inativado'));
    return p;
  },
  pickSport: el => formAberto()?.esporte(el.dataset.v),
  createGroup: async el => {
    const g = lerForm(null);
    if (!g) return;
    if (avisoLimiteGrupos()) return;
    const lg = await limiteGrupos();
    if (lg.cheio) {
      avisoGrupos('#ngErr', lg.n);
      return;
    }
    const gid = B.newId(),
      uid = S.user.uid,
      now = Date.now();
    try {
      await gravarGrupo(gid, {
        name: g.name,
        sport: g.sport,
        sportName: g.sportName,
        freq: g.freq,
        ativo: true,
        cfg: {
          minutes: SPORTS[g.sport].min,
          porTime: g.porTime,
          fixos: g.fixos,
          ...g.regiao,
          place: (g.fixos[0] && g.fixos[0].place) || '',
        },
        owner: uid,
        createdAt: now,
      });
      await B.set(
        'grupos/' + gid + '/membros/' + uid,
        Object.assign({ uid, email: S.user.email, role: 'owner', at: now }, S.user.via ? { via: S.user.via } : {})
      );
      await upMyGroup(gid, {
        name: g.name,
        role: 'owner',
        sport: g.sport,
        sportName: g.sportName,
        ativo: true,
        criado: now,
      });
      closeDlg();
      location.hash = '#/g/' + gid;
    } catch (e) {
      console.error(e);
      if (e && e.code === 'permission-denied' && !(await B.get('grupos/' + gid).catch(() => null)))
        avisoGrupos('#ngErr', lg.n);
      else toast(tx('admgrupo.criarFalhou'));
    }
  },
  groupsDlg: () => {
    const gs = Object.entries((S.me && S.me.grupos) || {})
      .filter(([k, v]) => v.ativo !== false || k === S.gid)
      .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', LOCAL));
    janelaSeusGrupos(gs, S.gid);
  },
  forgetGroup: () => {
    const me = cl(S.me) || { grupos: {} };
    delete me.grupos[S.gid];
    S.me = me;
    B.set('usuarios/' + S.user.uid, me).catch(() => {});
    location.hash = '#/';
  },
};

/* Os administradores convidados (convite, remover e permissões) ficam em acoes/administradores.ts (v87). */
const acoes = Object.assign({}, proprias, administradores);

export { acoes, limiteGrupos, avisoGrupos, gravarGrupo };
