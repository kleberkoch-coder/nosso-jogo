/* Ações do material do grupo (KAN-190, parte 2, pelada-v109). Vêm com a aba Grupo. Gravam só cfg.mat e
   cfg.matHist do grupo (as regras deixam qualquer administrador ativo mexer nesses dois). */
import { pname } from '../dominio/grupo.js';
import { adicionar, passar, remover } from '../dominio/material';
import { tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
import { editApp } from '../nucleo/edicoes';
import { $, toast } from '../nucleo/util.js';
import { confirmou, val } from '../ui/dialogos.js';

type El = HTMLElement & { dataset: DOMStringMap };
type Obj = Record<string, any>;

/* Passar para outra pessoa (o combo da lista): grava na hora e avisa. */
export function passarMaterial(id: string, para: string | null) {
  let nome = '';
  const p = editApp(a => {
    const r = passar(a.cfg.mat, a.cfg.matHist, id, para, Date.now());
    if (!r) return;
    nome = (r.mat.find(x => x.id === id) || { nome: '' }).nome;
    a.cfg.mat = r.mat;
    a.cfg.matHist = r.matHist;
  });
  if (nome) toast(para ? tx('matg.passou', { nome, para: pname(para) }) : tx('matg.semNinguem', { nome }));
  return p;
}

export const acoes: Record<string, (el: El) => unknown> = {
  /* KAN-267: atalho de sugestão preenche "O que é" e leva o cursor para "Quantos". */
  matSug: el => {
    const n = $('#matNome') as HTMLInputElement | null,
      q = $('#matQtd') as HTMLInputElement | null;
    if (n) n.value = el.dataset.v || '';
    q?.focus();
    q?.select();
  },
  matAdd: () => {
    const nome = val('matNome');
    if (!nome) {
      toast(tx('matg.semNome'));
      ($('#matNome') as HTMLInputElement | null)?.focus();
      return;
    }
    const qtd = +val('matQtd') || 1,
      com = val('matCom') || null;
    const p = editApp(a => {
      a.cfg.mat = adicionar(a.cfg.mat, nome, qtd, com, () => ((banco as Obj).B as Obj).newId());
    });
    ($('#matNome') as HTMLInputElement).value = '';
    ($('#matQtd') as HTMLInputElement).value = '1';
    toast(tx('matg.adicionado', { nome: nome.trim() }));
    return p;
  },
  matDel: el => {
    const id = el.dataset.v as string;
    if (
      confirmou(el, {
        titulo: tx('matg.removerTitulo'),
        acao: tx('matg.removerAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    return editApp(a => {
      a.cfg.mat = remover(a.cfg.mat, id);
    });
  },
};
