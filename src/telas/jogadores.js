import { ptipo } from '../dominio/caixa.js';
import { posTag } from '../dominio/esportes.js';
import { fdia, lvlTag, players, pname, rat } from '../dominio/grupo.js';
import { history } from '../dominio/sorteio.js';
import { waUrl } from '../nucleo/edicoes.js';
import { S } from '../nucleo/estado.js';
import { esc } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';

/* ---------- Jogadores ---------- */
function vJogadores() {
  const R = rat(),
    ps = players(),
    inactive = Object.entries(S.jog)
      .filter(([, p]) => p.ativo === false)
      .map(([id, p]) => Object.assign({ id }, p))
      .sort((a, b) => a.name.localeCompare(b.name, LOCAL)),
    C = S.cont || {};
  const avs = Object.entries(S.avul || {})
    .filter(([id]) => !S.jog[id])
    .sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', LOCAL));
  const prow = p =>
    `<li>${posTag(p.id)}<span class="pn">${esc(p.name)}<br><span class="tag">${ptipo(p.id) === 'diarista' ? 'Diarista' : 'Mensalista'} · desde ${fdia(p.criado)}${C[p.id]?.tel ? ` · <a href="${waUrl(C[p.id].tel)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</span></span>${lvlTag(p.id)}<button class="btn sm" data-a="editPlayer" data-p="${p.id}">Editar</button></li>`;
  const top = Object.entries(history(null))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  return `<div class="stack">
  <div class="row between"><h2>${ps.length} jogadores</h2><div class="row"><button class="btn primary" data-a="addPlayer">Adicionar jogador</button>${!ps.length ? '<button class="btn" data-a="seed">Elenco de exemplo</button>' : ''}</div></div>
  <div class="panel"><ul class="plist">${ps.map(prow).join('') || '<li class="muted small">Nenhum jogador ativo.</li>'}</ul>
  ${inactive.length ? `<details style="margin-top:10px"><summary class="small">Inativos (${inactive.length})</summary><ul class="plist" style="opacity:.75">${inactive.map(prow).join('')}</ul></details>` : ''}</div>
  <div class="panel"><h3>Avulsos que já jogaram</h3><p class="small muted" style="margin-top:-6px">Ficam guardados com posição e nota. Quando voltarem, é só escolher o nome, sem preencher tudo de novo.</p>
  <ul class="plist">${avs.map(([id, a]) => `<li>${posTag(id)}<span class="pn">${esc(a.nome)}<br><span class="tag">desde ${fdia(a.criado)}${C[id]?.tel ? ` · <a href="${waUrl(C[id].tel)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</span></span>${lvlTag(id)}<button class="btn sm" data-a="editAvulso" data-p="${id}">Editar</button><button class="btn sm" data-a="promote" data-p="${id}">Pôr no elenco</button></li>`).join('') || '<li class="muted small">Nenhum avulso ainda. Eles entram aqui automaticamente quando confirmam pelo link ou são adicionados na rodada.</li>'}</ul></div>
  <div class="grid2">
   <div class="panel"><h3>Não colocar no mesmo time</h3><p class="small muted" style="margin-top:-6px">Ex.: dois craques. O sorteio evita juntar esses pares sempre que der.</p>
    <ul class="plist">${(R.sep || []).map(([a, b], i) => `<li><span class="pn">${esc(pname(a))} <span class="muted">e</span> ${esc(pname(b))}</span><button class="btn sm ghost danger" data-a="delSep" data-v="${i}">Remover</button></li>`).join('') || '<li class="muted small">Nenhum par cadastrado.</li>'}</ul>
    <button class="btn sm" style="margin-top:10px" data-a="addSep">Adicionar par</button></div>
   <div class="panel"><h3>Quem mais joga junto</h3><p class="small muted" style="margin-top:-6px">Peso maior para rodadas recentes. O sorteio usa isso para variar os times.</p>
    <ul class="plist">${
      top
        .map(([k, v]) => {
          const [a, b] = k.split('|');
          return `<li><span class="pn">${esc(pname(a))} + ${esc(pname(b))}</span><span class="bar" style="max-width:120px"><i style="width:${Math.min(100, (v / top[0][1]) * 100)}%"></i></span></li>`;
        })
        .join('') || '<li class="muted small">Aparece depois dos primeiros sorteios.</li>'
    }</ul></div>
  </div>
  </div></div>`;
}

export { vJogadores };
