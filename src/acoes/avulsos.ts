/* Ações dos avulsos (quem joga sem estar no elenco): adicionar à rodada, escolher quem já jogou, editar, esquecer
   e pôr no elenco. Saíram de acoes/rodada.js na v87 (KAN-220: arquivos menores, por assunto). Fazem parte de ACT
   (src/admin.js). */
import { curRodada, normName, pname, ppos, setLvl } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { LOCAL } from '../i18n/formatos.js';
import * as backend from '../nucleo/backend.js';
import { editRat, saveContato, setPres } from '../nucleo/edicoes.js';
import { GB, S, w } from '../nucleo/estado';
import { $, toast } from '../nucleo/util.js';
import { lerContato } from '../ui/contato-form';
import { closeDlg, confirmou, val } from '../ui/dialogos.js';
import { janelaAvulso, janelaEditarAvulso, playerDlg } from '../ui/JanelasGestao';
import { changed } from '../ui/render.js';
import { porNoTime } from './rodada.js';

type El = HTMLElement & { dataset: DOMStringMap };
const novoId = (): string => (backend as any).B.newId();
const nota = () => $('#plv') as HTMLInputElement | null;

export const acoes: Record<string, (el: El) => unknown> = {
  /* Adicionar avulso (da lista ou do "Pôr no time", que traz o time em data-t). */
  addAvulso: el => {
    const t = el && el.dataset ? el.dataset.t : null;
    S.alvoTime = t != null && t !== '' ? +t : null;
    const regs = Object.entries(S.avul || {})
      .filter(([id]) => !S.jog[id] && S.pres[id]?.s !== 'in')
      .sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', LOCAL));
    janelaAvulso(regs);
  },
  pickAvulso: el => {
    const id = el.dataset.p || '',
      a = (S.avul || {})[id]!;
    closeDlg();
    const ps = [setPres(curRodada().id, id, { s: 'in', nome: a.nome, avulso: true, pos: a.pos || '' })];
    if (S.alvoTime != null) ps.push(porNoTime(S.alvoTime, id));
    else toast(tx('avulso.confirmado', { nome: a.nome }));
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
      if (c === 'sim') return acoes.pickAvulso!({ dataset: { p: same[0] } } as unknown as El);
    }
    const id = novoId(),
      v = +(nota()?.value ?? 5),
      pos = val('apos'),
      o = { nome: n, pos, criado: Date.now() };
    S.avul = S.avul || {};
    S.avul[id] = o;
    const ps: unknown[] = [
      setPres(curRodada().id, id, { s: 'in', nome: n, avulso: true, pos }),
      w(GB.set('avulsos/' + id, o)),
      editRat((a: any) => setLvl(a, id, v)),
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
    const id = el.dataset.p || '',
      a = (S.avul || {})[id] || { nome: pname(id), pos: ppos(id) },
      ct = (S.cont || {})[id] || {};
    janelaEditarAvulso(id, a, ct.tel || '');
  },
  saveAvEdit: el => {
    const id = el.dataset.p || '',
      n = val('anm');
    if (n.length < 2) {
      toast(tx('jogador.digiteNome'));
      return;
    }
    const ct = lerContato('ptel');
    if (!ct) return;
    const o = Object.assign({ criado: Date.now() }, (S.avul || {})[id] || {}, { nome: n, pos: val('apos') || '' });
    S.avul = S.avul || {};
    S.avul[id] = o;
    changed();
    const n0 = nota(),
      ps: unknown[] = [w(GB.set('avulsos/' + id, o)), n0 ? editRat((a: any) => setLvl(a, id, +n0.value)) : null];
    const c = saveContato(id, ct.tel, '');
    if (c) ps.push(c);
    closeDlg();
    toast(tx('avulso.atualizado'));
    return Promise.all(ps);
  },
  delAvulso: el => {
    const id = el.dataset.p || '';
    if (
      confirmou(el, {
        titulo: tx('avulso.esquecerTitulo'),
        texto: tx('avulso.esquecerTexto'),
        acao: tx('avulso.esquecer'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    if (S.avul) delete S.avul[id];
    changed();
    closeDlg();
    return w(GB.del('avulsos/' + id));
  },
  /* Pôr no elenco: abre o Novo jogador com o nome e a posição do avulso. */
  promote: el => {
    const id = el.dataset.p || '',
      p = S.avul?.[id] || { nome: S.pres[id]?.nome, pos: S.pres[id]?.pos };
    playerDlg(null, { id, name: p?.nome, pos: p?.pos, tipo: 'diarista' });
    const b = $('[data-a=savePlayer]') as HTMLElement;
    b.dataset.p = '';
    b.dataset.new = id;
  },
};
