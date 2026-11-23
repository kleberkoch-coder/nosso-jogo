/* Janelas de jogador e de avulso (Novo e Editar jogador, com a ficha; Adicionar e Editar avulso). Baixam só quando
   abertas (KAN-274, pelada-v119), com os textos delas (i18n/pt-BR-ficha.ts). Chamadas por ui/JanelasGestao.tsx.
   Por fora, os mesmos ids, classes e data-a, que as ações (acoes/jogadores.js, acoes/avulsos.ts) e os testes leem. */
import { ptipo, recebePorJogo } from '../dominio/caixa.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-ficha';
import { fdia, fmtL, lvl, normName, posso, recurso } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { $, today } from '../nucleo/util.js';
import { openDlg } from './dialogos.js';
import { CampoPosicao, Pos } from './componentes';
import { CampoNota, CampoTelefone, CampoTipo, LinhaAfastamento } from './Campos';
import { FotoJogador } from './FotoJogador';

juntarTextos(textos);
const st = S;
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
      {/* KAN-293: foto do jogador (só em jogador já cadastrado, com a permissão de Elenco). */}
      {p && id && posso('elenco') ? <FotoJogador pid={id} /> : null}
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
      {/* KAN-272: data de nascimento, só para quem tem Elenco (fica com o telefone, em privado/contatos). */}
      {posso('elenco') ? (
        <label class="f">
          <span>{tx('niver.campo')}</span>
          <input class="inp" id="pnasc" type="date" min="1900-01-01" max={today()} value={ct.nasc || ''} />
          <span class="small muted">{tx('niver.ajuda')}</span>
        </label>
      ) : null}
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
