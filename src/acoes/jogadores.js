/* Ações: Jogadores: elenco, notas, contatos, pares separados e configurações. Fazem parte de ACT (src/acoes.js). */
import { CAIXA_K, cfg, editPc, ptipo, recebePorJogo } from '../dominio/caixa.js';
import { posKeys } from '../dominio/esportes.js';
import { normName, players, pname, posso, ppos, recurso, setLvl } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import { simboloMoeda } from '../i18n/formatos.js';
import { B } from '../nucleo/backend.js';
import { lerContato } from '../ui/contato-form';
import { editApp, editRat, saveContato } from '../nucleo/edicoes.js';
import { GB, S, clean, w } from '../nucleo/estado.js';
import { $, brl, esc, key, toast, today } from '../nucleo/util.js';
import { foraDoPadrao, referenciaDoGrupo } from '../dominio/caixa-regras';
import { closeDlg, confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { playerDlg } from '../ui/dialogos-gestao.js';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';
/* Importar da planilha (KAN-159) baixa só quando a janela abre (v59), para a gestão abrir mais leve.
   O service worker guarda essa parte junto com a gestão, então funciona sem sinal depois do primeiro uso. */
let IMP = null;
const carregarImportar = () => (IMP ? Promise.resolve(IMP) : import('../ui/ImportarJogadores').then(m => (IMP = m)));

const acoes = {
  addPlayer: () => playerDlg(null),
  editPlayer: el => playerDlg(el.dataset.p),
  star: () => {},
  waLink: () => {},
  savePlayer: el => {
    const name = val('pnm');
    if (name.length < 2) {
      toast('Digite o nome.');
      return;
    }
    const ct = lerContato('ptel', 'pmail');
    if (!ct) return;
    const comCaixa = !!$('#ptp'),
      recebe = $('#prj')?.checked,
      vj = +val('prv');
    if (recebe && !(vj > 0)) {
      toast(tx('jogador.valorPorJogoFalta'));
      $('#prv')?.focus();
      return;
    }
    const nw = el.dataset.new,
      id = el.dataset.p || nw || B.newId(),
      v = +($('#plv')?.value ?? 0);
    /* Uma pergunta só (KAN-161): nome repetido e/ou valor por jogo muito acima do padrão do grupo. */
    const dup = Object.entries(S.jog).some(([k, x]) => k !== id && normName(x.name) === normName(name)),
      c = cfg(),
      fora =
        recebe &&
        foraDoPadrao(
          vj,
          referenciaDoGrupo({
            mensal: c.mensal,
            diaria: c.diaria,
            lancamentos: Object.values(S.caixa || {}),
            hoje: today(),
          })
        );
    if (dup || fora) {
      const textos = [];
      if (dup) textos.push(tx('jogador.nomeRepetido', { nome: name }));
      if (fora) textos.push(tx('jogador.valorFora', { valor: brl(vj) }));
      const r = confirmou(el, {
        titulo:
          dup && fora
            ? tx('jogador.conferirTitulo')
            : dup
              ? tx('jogador.nomeRepetidoTitulo', { nome: name })
              : tx('caixa.foraTitulo', { valor: brl(vj) }),
        texto: dup && !fora ? tx('jogador.mesmoNome') : textos.join(' '),
        acao: dup && !fora ? tx('jogador.cadastrarAssim') : tx('jogador.salvarAssim'),
        cancelar: fora ? tx('caixa.foraCorrigir') : undefined,
        fim: fora
          ? () =>
              setTimeout(() => {
                const c = $('#prv');
                if (c && !$('#dlgBody .conf')) c.focus();
              }, 40)
          : undefined,
      });
      if (r !== 'sim') return;
    }
    const old = S.jog[id] || {},
      tp = val('ptp'),
      data = Object.assign({}, old, {
        name,
        pos: val('ppos'),
        ativo: old.ativo !== false,
        criado: old.criado || (nw && S.avul[nw]?.criado) || Date.now(),
      });
    delete data.tipo;
    S.jog[id] = data;
    changed();
    w(GB.set('jogadores/' + id, clean(data)));
    const rj = recebePorJogo(id),
      mudouRecebe = recebe ? !rj || rj.v !== vj : !!rj;
    if (comCaixa && (ptipo(id) !== tp || !((S.pc || {}).tipos || {})[id] || mudouRecebe))
      editPc(a => {
        a.tipos[id] = tp;
        a.porJogo = a.porJogo || {};
        if (recebe) a.porJogo[id] = { v: vj, desde: (rj && rj.desde) || today() };
        else delete a.porJogo[id];
      });
    if ($('#plv')) editRat(a => setLvl(a, id, v));
    saveContato(id, ct.tel, ct.email);
    if (nw && S.avul[nw]) {
      delete S.avul[nw];
      w(GB.del('avulsos/' + nw));
    }
    closeDlg();
    toast('Jogador salvo.');
  },
  toggleJog: el => {
    const id = el.dataset.p,
      o = Object.assign({}, S.jog[id]),
      on = o.ativo === false;
    if (
      !on &&
      confirmou(el, {
        titulo: 'Inativar ' + o.name + '?',
        texto: 'Ele sai das listas de presença, mas o histórico continua.',
        acao: 'Inativar jogador',
      }) !== 'sim'
    )
      return;
    o.ativo = on;
    if (on) delete o.inativadoEm;
    else o.inativadoEm = Date.now();
    S.jog[id] = o;
    changed();
    closeDlg();
    toast(on ? 'Jogador reativado.' : 'Jogador inativado.');
    return w(GB.set('jogadores/' + id, clean(o)));
  },
  delPlayer: el => {
    const id = el.dataset.p;
    if (
      confirmou(el, {
        titulo: 'Excluir ' + pname(id) + '?',
        texto: 'Ele sai do elenco de vez. Para manter o histórico, prefira Inativar.',
        acao: 'Excluir jogador',
        perigo: true,
      }) !== 'sim'
    )
      return;
    delete S.jog[id];
    w(GB.del('jogadores/' + id));
    editRat(a => {
      if (a.stars) delete a.stars[id];
      a.sep = a.sep.filter(s => !s.includes(id));
    });
    if (((S.pc || {}).tipos || {})[id] || recebePorJogo(id))
      editPc(a => {
        delete a.tipos[id];
        if (a.porJogo) delete a.porJogo[id];
      });
    closeDlg();
  },
  addSep: () => {
    const o = players()
      .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join('');
    openDlg(
      `<h3>Não colocar no mesmo time</h3><label class="f"><span>Jogador</span><select class="sel" id="sa">${o}</select></label><label class="f"><span>e</span><select class="sel" id="sb">${o}</select></label><div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveSep">Adicionar par</button></div>`
    );
  },
  saveSep: () => {
    const a = val('sa'),
      b = val('sb');
    if (a === b) {
      toast('Escolha duas pessoas diferentes.');
      return;
    }
    editRat(x => {
      if (!x.sep.some(s => key(s[0], s[1]) === key(a, b))) x.sep.push([a, b]);
    });
    closeDlg();
  },
  delSep: el =>
    editRat(x => {
      x.sep.splice(+el.dataset.v, 1);
    }),
  /* Partidas e caixa (KAN-201): os minutos com a permissão de configurações; valores e Pix com a de caixa. */
  settings: () => {
    const c = cfg(),
      comCaixa = posso('caixa') && recurso('caixa'),
      comConfig = posso('config');
    const valores = `<div class="row"><label class="f" style="flex:1"><span>${tx('caixa.mensalidadeMoeda', { moeda: simboloMoeda() })}</span><input class="inp" type="number" min="0" id="cm" value="${c.mensal}"></label><label class="f" style="flex:1"><span>${tx('caixa.diariaMoeda', { moeda: simboloMoeda() })}</span><input class="inp" type="number" min="0" id="cd" value="${c.diaria}"></label></div>`;
    const minutos = `<label class="f" style="flex:1"><span>Minutos por partida</span><input class="inp" type="number" min="1" id="cmin" value="${c.minutes}"></label>`,
      pix = `<label class="f" style="flex:1"><span>Chave Pix</span><input class="inp" id="cpx" value="${esc(c.pix)}"></label>`;
    openDlg(`<h3>${tx(comCaixa ? 'grupo.partidasCaixa' : 'grupo.partidas')}</h3>
    ${comCaixa ? valores : ''}
    <div class="row">${comConfig ? minutos : ''}${comCaixa ? pix : ''}</div>
    ${comCaixa ? '<p class="small muted" style="margin-top:-4px">Valores e chave Pix só aparecem para administradores.</p>' : ''}
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveSettings">Salvar</button></div>`);
  },
  saveSettings: () => {
    const ps = [];
    if ($('#cm'))
      ps.push(
        editPc(a => {
          Object.assign(a, { mensal: +val('cm') || 0, diaria: +val('cd') || 0, pix: val('cpx') });
        })
      );
    const mn = $('#cmin') ? +val('cmin') || 10 : cfg().minutes;
    if ($('#cmin') && (cfg().minutes !== mn || CAIXA_K.some(k => k in ((S.app || {}).cfg || {}))))
      ps.push(
        editApp(a => {
          a.cfg.minutes = mn;
          CAIXA_K.forEach(k => delete a.cfg[k]);
        })
      );
    closeDlg();
    toast('Configurações salvas.');
    return Promise.all(ps);
  },
  /* KAN-159: importar o elenco de uma planilha (colar ou arquivo), com prévia. */
  importarDlg: () =>
    carregarImportar().then(
      m => {
        openDlg('<div id="impRaiz"></div>');
        const el = $('#impRaiz');
        if (el) m.montarImportar(el);
        setTimeout(() => $('#impTexto')?.focus(), 50);
      },
      () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
    ),
  importarJogadores: () => {
    const novos = IMP ? IMP.paraImportar() : [];
    if (!novos.length) return;
    const agora = Date.now(),
      ops = [],
      ids = novos.map(() => B.newId());
    novos.forEach((it, i) => {
      const data = { criado: agora, name: it.nome, pos: it.pos || '', ativo: true };
      S.jog[ids[i]] = data;
      ops.push({ tipo: 'set', p: 'jogadores/' + ids[i], o: clean(data) });
    });
    /* Tudo de uma vez: os jogadores num lote só, e um registro só para tipos, notas e contatos. */
    const contatos = Object.assign({}, S.cont || {});
    novos.forEach((it, i) => {
      if (it.tel || it.email) contatos[ids[i]] = { tel: it.tel || '', email: it.email || '' };
    });
    S.cont = contatos;
    const ps = [
      w(GB.lote(ops)),
      editPc(a => novos.forEach((it, i) => (a.tipos[ids[i]] = it.tipo))),
      editRat(a => novos.forEach((it, i) => it.nota != null && setLvl(a, ids[i], it.nota))),
    ];
    if (novos.some(it => it.tel || it.email)) ps.push(w(GB.set('privado/contatos', clean(contatos))));
    changed();
    closeDlg();
    toast(tp('importar.feito', novos.length));
    return Promise.all(ps);
  },
  seed: () => {
    const ns = [
      ['Bruno', 'GOL', 4],
      ['Tiago', 'GOL', 3],
      ['Rafa', 'DEF', 4],
      ['Léo', 'DEF', 3],
      ['Marcão', 'DEF', 2],
      ['Dudu', 'DEF', 3],
      ['Gui', 'MEI', 5],
      ['Fernandinho', 'MEI', 4],
      ['Caio', 'MEI', 3],
      ['Pedrinho', 'MEI', 2],
      ['Japa', 'ATA', 5],
      ['Neto', 'ATA', 4],
      ['Vini', 'ATA', 3],
      ['Alemão', 'ATA', 2],
    ];
    const ids = ns.map(() => B.newId()),
      K = posKeys(),
      map = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };
    ns.forEach(([n, p], i) => {
      const d = {
        criado: Date.now(),
        name: n,
        pos: K.length ? K[Math.min(K.length - 1, map[p])] || K[i % K.length] : '',
        ativo: true,
      };
      S.jog[ids[i]] = d;
      w(GB.set('jogadores/' + ids[i], d));
    });
    editPc(a => {
      ids.forEach((id, i) => {
        a.tipos[id] = i % 4 === 3 ? 'diarista' : 'mensalista';
      });
    });
    editRat(a => {
      ids.forEach((id, i) => setLvl(a, id, ns[i][2] * 2 - (i % 3 === 0 ? 0.5 : 0)));
      a.sep.push([ids[6], ids[10]]);
    });
    toast('Elenco de exemplo carregado.');
  },
};

export { acoes };
