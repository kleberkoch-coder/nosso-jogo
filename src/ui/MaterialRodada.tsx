/* "Material desta rodada" na aba Rodada (KAN-190, parte 2, pelada-v109): para cada material do grupo, quem guarda
   e já confirmou ("Bola: 2 de 3 confirmados (Kleber, Gu)"), o aviso em destaque quando nenhum de quem guarda
   confirmou (com o botão de cobrar essas pessoas no WhatsApp) e quem guarda e disse que não vai. Só aparece com
   material cadastrado (aba Grupo). A regra está em dominio/material.ts. */
import { pname } from '../dominio/grupo.js';
import { situacao } from '../dominio/material';
import { tx } from '../i18n/index.js';

type Pres = Record<string, { s?: 'in' | 'out' }>;
const nomes = (ids: string[]) => ids.map(pname).join(', ');

export function MaterialRodada({ mat, pres }: { mat: unknown; pres: Pres }) {
  const sit = situacao(mat, pres || {});
  if (!sit.length) return null;
  return (
    <div class="panel" id="matRodada">
      <h3>{tx('mat.titulo')}</h3>
      <ul class="plist mat-rod">
        {sit.map(m => (
          <li key={m.nome} class={m.nenhum ? 'mat-alerta' : ''} data-nome={m.nome}>
            <div>
              {!m.com.length ? (
                <span>{tx('mat.semGuarda', { nome: m.nome })}</span>
              ) : m.nenhum ? (
                <span class="warn-alt">
                  <span aria-hidden="true">⚠️ </span>
                  {tx('mat.nenhum', { nome: m.nome, nomes: nomes(m.com) })}
                </span>
              ) : (
                <span>{tx('mat.ok', { nome: m.nome, n: m.vao.length, total: m.com.length, nomes: nomes(m.vao) })}</span>
              )}
              {m.naoVao.map(p => (
                <p key={p} class="small muted mat-nao">
                  {tx('mat.naoVai', { pessoa: pname(p), nome: m.nome })}
                </p>
              ))}
            </div>
            {m.nenhum && m.semResposta.length ? (
              <button class="btn sm" data-a="matCobrar" data-v={m.nome}>
                {tx('mat.cobrar')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
