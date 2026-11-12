/* Material do grupo na aba Grupo (KAN-190, parte 2, pelada-v109): o que o grupo tem (bolas, coletes…) e com quem
   cada um fica entre as rodadas. Trocar a pessoa no combo é "passar" (fica no histórico). Qualquer administrador
   mexe. A regra está em dominio/material.ts; as ações, em acoes/material.ts. Vem com a aba Grupo (sob demanda). */
import { sport } from '../dominio/esportes.js';
import { players, pname } from '../dominio/grupo.js';
import { itens, type Troca } from '../dominio/material';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { fdate } from '../nucleo/util.js';
import { passarMaterial } from '../acoes/material';

type Cfg = { mat?: unknown; matHist?: Troca[] };
const cfgGrupo = (): Cfg => ((estado as { app?: { cfg?: Cfg } }).app || {}).cfg || {};

function Pessoas({ valor }: { valor: string | null }) {
  const ps = (players() as { id: string; name: string }[]).slice().sort((a, b) => a.name.localeCompare(b.name, LOCAL));
  return (
    <>
      <option value="">{tx('matg.ninguem')}</option>
      {ps.map(p => (
        <option key={p.id} value={p.id} selected={p.id === valor}>
          {p.name}
        </option>
      ))}
      {valor && !ps.some(p => p.id === valor) ? (
        <option value={valor} selected>
          {pname(valor)}
        </option>
      ) : null}
    </>
  );
}

export function PainelMaterial() {
  const c = cfgGrupo(),
    xs = itens(c.mat),
    hist = Array.isArray(c.matHist) ? c.matHist : [],
    sugestoes = ((sport() as { mat?: string[] }).mat || []) as string[];
  return (
    <div class="panel" id="materialPainel">
      <h3>{tx('matg.titulo')}</h3>
      <p class="small muted" style="margin-top:-6px">
        {tx('matg.ajuda')}
      </p>
      {xs.length ? (
        <ul class="plist" id="matLista">
          {xs.map(x => (
            <li key={x.id} class="mat-linha">
              <b class="mat-nome">{x.nome}</b>
              <select
                class="sel"
                aria-label={tx('matg.comQuem', { nome: x.nome })}
                data-m={x.id}
                onChange={e => passarMaterial(x.id, (e.currentTarget as HTMLSelectElement).value || null)}
              >
                <Pessoas valor={x.com} />
              </select>
              <button
                class="btn sm ghost danger"
                data-a="matDel"
                data-v={x.id}
                aria-label={tx('matg.remover', { nome: x.nome })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted small">{tx('matg.vazio')}</p>
      )}
      <div class="mat-novo">
        <label class="f">
          <span>{tx('matg.nome')}</span>
          <input class="inp" id="matNome" maxLength={30} placeholder={tx('matg.exemplo')} />
        </label>
        <label class="f">
          <span>{tx('matg.qtd')}</span>
          <input class="inp" id="matQtd" type="number" inputMode="numeric" min={1} max={10} value="1" />
        </label>
        {sugestoes.length ? (
          <div class="mat-atalhos" id="matSug" role="group" aria-label={tx('matg.atalhos')}>
            {sugestoes.map(n => (
              <button key={n} type="button" class="btn sm" data-a="matSug" data-v={n}>
                {n}
              </button>
            ))}
          </div>
        ) : null}
        <label class="f mat-com">
          <span>{tx('matg.com')}</span>
          <select class="sel" id="matCom">
            <Pessoas valor={null} />
          </select>
        </label>
        <button class="btn" data-a="matAdd" id="matAddBtn">
          {tx('matg.adicionar')}
        </button>
      </div>
      {hist.length ? (
        <details class="mat-hist">
          <summary class="small">{tx('matg.historico')}</summary>
          <ul class="plist">
            {hist.slice(0, 5).map((h, i) => (
              <li key={i} class="small">
                {tx('matg.troca', {
                  data: fdate(new Date(h.em).toISOString().slice(0, 10)),
                  nome: h.nome,
                  de: h.de ? pname(h.de) : tx('matg.ninguem'),
                  para: h.para ? pname(h.para) : tx('matg.ninguem'),
                })}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
