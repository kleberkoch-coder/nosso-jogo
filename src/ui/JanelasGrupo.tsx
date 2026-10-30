/* Janelas das ações de grupo (KAN-218, v84): país da conta, Novo/Editar grupo, Nova posição, Duplicar grupo,
   Seus grupos e Permissões. Componentes; antes eram montadas como texto em acoes/grupo-lote.js, com quem baixam.
   Os mesmos ids e data-a de antes, que as ações e os testes leem. */
import { SPORTS } from '../dominio/esportes.js';
import { PERMISSOES } from '../dominio/permissoes';
import { tx } from '../i18n/index.js';
import { openDlg } from './dialogos.js';
import { Opcoes } from './Campos';
import { listaPais } from './regiao.ts';

const Cancelar = () => (
  <button class="btn" data-a="close">
    {tx('comum.cancelar')}
  </button>
);
const Ajuda = ({ texto }: { texto: string }) => (
  <p class="small muted" style="margin-top:-6px">
    {texto}
  </p>
);

export function janelaPaisConta(atual: string) {
  openDlg(
    <>
      <h3>{tx('regiao.contaTitulo')}</h3>
      <Ajuda texto={tx('regiao.contaAjuda')} />
      <label class="f">
        <span>{tx('regiao.pais')}</span>
        <select class="sel" id="cpais">
          <Opcoes lista={listaPais()} atual={atual} />
        </select>
      </label>
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="salvarPaisConta">
          {tx('comum.salvar')}
        </button>
      </div>
    </>
  );
}

/* Novo grupo / Editar grupo: o formulário (telas/GrupoForm.tsx) se desenha depois em #ngRaiz. */
export function janelaGrupo(editar: { criadoEm: string } | null) {
  openDlg(
    <>
      <h3>{tx(editar ? 'admgrupo.editar' : 'admgrupo.novo')}</h3>
      {editar ? <Ajuda texto={tx('admgrupo.criadoEm', { data: editar.criadoEm })} /> : null}
      <div id="ngRaiz"></div>
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a={editar ? 'saveGroup' : 'createGroup'}>
          {tx(editar ? 'comum.salvar' : 'admgrupo.criar')}
        </button>
      </div>
    </>
  );
}

export function janelaPosicao() {
  openDlg(
    <>
      <h3>{tx('admgrupo.posNova')}</h3>
      <div class="row">
        <label class="f" style="width:110px">
          <span>{tx('admgrupo.posSigla')}</span>
          <input
            class="inp"
            id="psg"
            maxLength={4}
            placeholder={tx('admgrupo.posSiglaEx')}
            style="text-transform:uppercase"
          />
        </label>
        <label class="f" style="flex:1">
          <span>{tx('admgrupo.posNome')}</span>
          <input class="inp" id="pnmx" maxLength={24} placeholder={tx('admgrupo.posNomeEx')} />
        </label>
      </div>
      <Ajuda texto={tx('admgrupo.posAjuda')} />
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="savePos">
          {tx('admgrupo.posAdicionar')}
        </button>
      </div>
    </>
  );
}

export function janelaDuplicar(nome: string) {
  openDlg(
    <>
      <h3>{tx('admgrupo.dupTitulo')}</h3>
      <Ajuda texto={tx('admgrupo.dupAjuda')} />
      <label class="f">
        <span>{tx('admgrupo.dupNome')}</span>
        <input class="inp" id="dgn" maxLength={40} value={tx('admgrupo.dupCopia', { nome })} />
      </label>
      <div class="err" id="dgErr" style="margin-top:-8px"></div>
      <label class="row small" style="margin-bottom:6px">
        <input type="checkbox" id="dgel" checked />
        {' ' + tx('admgrupo.dupElenco')}
      </label>
      <p class="small muted">{tx('admgrupo.dupNaoCopia')}</p>
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="doDupGroup">
          {tx('admgrupo.dupAcao')}
        </button>
      </div>
    </>
  );
}

type Meu = { name: string; sport?: string; sportName?: string };
export function janelaSeusGrupos(gs: [string, Meu][], aberto: string | null) {
  const esp = (g: Meu) => (SPORTS as any)[g.sport || ''] || (SPORTS as any).futebol;
  openDlg(
    <>
      <h3>{tx('admgrupo.seus')}</h3>
      <ul class="plist">
        {gs.map(([gid, g]) => (
          <li key={gid}>
            <span class="gem">{esp(g).e}</span>
            <span class="pn">
              <b>{g.name}</b>
              {gid === aberto ? ' ' : null}
              {gid === aberto ? <span class="tag">{tx('admgrupo.aberto')}</span> : null}
              <br />
              <span class="tag">{g.sportName || esp(g).n}</span>
            </span>
            {gid === aberto ? null : (
              <a class="btn sm primary" href={'#/g/' + gid}>
                {tx('admgrupo.abrir')}
              </a>
            )}
          </li>
        ))}
      </ul>
      <div class="dlg-f">
        <a class="btn" href="#/">
          {tx('admgrupo.verTodos')}
        </a>
        <button class="btn primary" data-a="newGroup">
          {tx('admgrupo.novo')}
        </button>
      </div>
    </>
  );
}

/* Permissões de um administrador convidado (KAN-201). */
export function janelaPermissoes(u: string, email: string, atual: Record<string, boolean> | null) {
  openDlg(
    <>
      <h3 id="permTitulo">{tx('perm.titulo')}</h3>
      <Ajuda texto={tx('perm.ajuda', { email })} />
      <ul class="perm-lista">
        {(PERMISSOES as readonly string[]).map(k => (
          <li key={k}>
            <label class="perm-item">
              <input type="checkbox" id={'perm_' + k} checked={!atual || !!atual[k]} />
              <span>
                <b>{tx('perm.nome.' + k)}</b>
                <br />
                <span class="small muted">{tx('perm.desc.' + k)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p class="small muted">{tx('perm.sempre')}</p>
      <div class="dlg-f">
        <Cancelar />
        <button class="btn primary" data-a="salvarPerm" data-v={u}>
          {tx('perm.salvar')}
        </button>
      </div>
    </>
  );
}
