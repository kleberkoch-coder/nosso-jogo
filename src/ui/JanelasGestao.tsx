/* Janelas da gestão (KAN-149): jogador, rodada, avulso, sorteio, mover e escolher time. Vão na parte de gestão, que o
   link público não baixa. Componentes desde a v84 (KAN-218); antes eram montadas como texto (ui/dialogos-gestao.js).
   Por fora, os mesmos ids, classes e data-a, que as ações (acoes/rodada.js, acoes/jogadores.js) e os testes leem. */
import { cfg, ptipo, recebePorJogo } from '../dominio/caixa.js';
import { col, hasPos, porTime, posKeys, posLabel, siglaTela, sport, tn } from '../dominio/esportes.js';
import { resumo } from '../dominio/times.ts';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import { fdia, fmtL, lvl, normName, pname, posso, ppos, recurso } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { openDlg } from './dialogos.js';
import { CampoPosicao, Pos } from './componentes';
import { CampoNota, CampoTelefone, CampoTipo, LinhaAfastamento } from './Campos';

const st = S;
/* KAN-261 (pelada-v104): janelas de times e pares que baixam só quando abertas (ui/JanelasTimes.tsx). Elas recebem
   daqui o que usam do app, em vez de importar (ver D52). */
const utilJanelas = () => ({
  tx,
  tp,
  pname,
  tn,
  col,
  Pos,
  openDlg,
  sport,
  hasPos,
  posKeys,
  posLabel,
  siglaTela,
  ppos,
  porTime,
  resumo,
  $,
});
export type UtilJanelas = ReturnType<typeof utilJanelas>;
let JT: any = null;
export function comJanelasTimes(f: (m: any, u: UtilJanelas) => void) {
  return (JT ? Promise.resolve(JT) : import('./JanelasTimes').then(m => (JT = m))).then(
    m => {
      juntarTextos(m.textos);
      f(m, utilJanelas());
    },
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );
}
/* KAN-262 (pelada-v106): a janela do sorteio também baixa só quando aberta (ui/JanelasTimes.tsx). */
export const drawPreview = () => comJanelasTimes((m, u) => m.drawPreview(u));
const Cancelar = () => (
  <button class="btn" data-a="close">
    {tx('comum.cancelar')}
  </button>
);

/* Novo jogador / Editar jogador. */
export function playerDlg(id: string | null, prefill?: any) {
  const p = id ? st.jog[id] : null,
    cid = id || prefill?.id,
    nota = cid ? lvl(cid) : 5,
    ct = (st.cont || {})[cid] || {};
  openDlg(
    <>
      <h3>{tx(p ? 'jogador.editar' : 'jogador.novo')}</h3>
      <label class="f">
        <span>{tx('jogador.nome')}</span>
        <input class="inp" id="pnm" value={p?.name || prefill?.name || ''} maxLength={40} />
      </label>
      <CampoPosicao id="ppos" valor={p?.pos || prefill?.pos} />
      {posso('notas') ? <CampoNota rotulo={tx('jogador.nota')} valor={nota} /> : null}
      {posso('caixa') && recurso('caixa') ? (
        <CampoTipo tipo={p ? ptipo(id) : prefill?.tipo} recebe={cid ? recebePorJogo(cid) : null} />
      ) : null}
      <CampoTelefone valor={ct.tel || ''} rotulo={tx('contato.telRotulo')} />
      <label class="f">
        <span>{tx('contato.emailRotulo')}</span>
        <input
          class="inp"
          id="pmail"
          type="email"
          autocomplete="email"
          maxLength={100}
          value={ct.email || ''}
          placeholder={tx('contato.emailExemplo')}
        />
      </label>
      {p ? (
        <p class="small muted" style="margin-top:-4px">
          {p.ativo === false ? (
            <>
              {tx('jogador.cadastradoEm', { data: fdia(p.criado) }) + ' · '}
              <b style="color:var(--out)">{tx('jogador.inativo')}</b>
            </>
          ) : (
            tx('jogador.cadastradoEm', { data: fdia(p.criado) }) + ' · ' + tx('jogador.ativo')
          )}
        </p>
      ) : null}
      {p && p.ativo !== false ? <LinhaAfastamento id={id!} /> : null}
      <div class="dlg-f">
        {p ? (
          <>
            <button class="btn ghost danger" data-a="delPlayer" data-p={id}>
              {tx('jogador.excluir')}
            </button>
            <button class="btn" data-a="toggleJog" data-p={id}>
              {tx(p.ativo === false ? 'jogador.reativar' : 'jogador.inativar')}
            </button>
          </>
        ) : null}
        <Cancelar />
        <button class="btn primary" data-a="savePlayer" data-p={id || ''}>
          {tx('jogador.salvar')}
        </button>
      </div>
    </>
  );
  setTimeout(() => ($('#pnm') as HTMLInputElement | null)?.focus(), 50);
}

/* "Não colocar no mesmo time": escolher o par. */
/* Adicionar avulso: quem já jogou aqui (para escolher) ou um avulso novo. */
export function janelaAvulso(regs: [string, { nome: string }][]) {
  openDlg(
    <>
      <h3>{tx('avulso.adicionar')}</h3>
      {regs.length ? (
        <>
          <div class="f">
            <span class="lbl">{tx('avulso.jaJogou')}</span>
            {regs.length > 8 ? (
              <input class="inp" id="avq" placeholder={tx('avulso.buscar')} style="margin-bottom:8px" />
            ) : null}
            <div class="vgrid" id="avlist">
              {regs.map(([id, a]) => (
                <button key={id} class="opt" data-a="pickAvulso" data-p={id} data-n={normName(a.nome)}>
                  <Pos id={id} />
                  <span>{a.nome}</span>
                  {posso('notas') ? (
                    <span class="tag" style="margin-left:auto">
                      {fmtL(lvl(id))}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <p class="small muted" style="margin:4px 0 10px">
            {tx('avulso.ouNovo')}
          </p>
        </>
      ) : null}
      <label class="f">
        <span>{tx('avulso.nome')}</span>
        <input class="inp" id="anm" maxLength={40} />
      </label>
      <CampoPosicao id="apos" />
      {posso('notas') ? <CampoNota rotulo={tx('nota.titulo')} valor={5} /> : null}
      {posso('elenco') ? <CampoTelefone valor="" rotulo={tx('contato.telOpcional')} /> : null}
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="saveAvulso">
          {tx('avulso.adicionarConfirmado')}
        </button>
      </div>
    </>
  );
}

/* Editar avulso (nome, posição, nota e telefone) ou esquecê-lo. */
export function janelaEditarAvulso(id: string, a: { nome: string; pos?: string; criado?: number }, tel: string) {
  openDlg(
    <>
      <h3>{tx('avulso.titulo', { nome: a.nome })}</h3>
      <label class="f">
        <span>{tx('avulso.nome')}</span>
        <input class="inp" id="anm" maxLength={40} value={a.nome} />
      </label>
      <CampoPosicao id="apos" valor={a.pos} />
      {posso('notas') ? <CampoNota rotulo={tx('jogador.nota')} valor={lvl(id)} /> : null}
      {posso('elenco') ? <CampoTelefone valor={tel} rotulo={tx('contato.telRotulo')} /> : null}
      <p class="small muted" style="margin-top:-4px">
        {tx('avulso.registradoEm', { data: fdia(a.criado) })}
      </p>
      <div class="dlg-f">
        <button class="btn ghost danger" data-a="delAvulso" data-p={id}>
          {tx('avulso.esquecer')}
        </button>
        <Cancelar />
        <button class="btn primary" data-a="saveAvEdit" data-p={id}>
          {tx('comum.salvar')}
        </button>
      </div>
    </>
  );
}
