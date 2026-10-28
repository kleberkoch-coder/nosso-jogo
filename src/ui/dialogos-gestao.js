/* Janelas da gestão (KAN-149): jogador, rodada e prévia do sorteio. Vão na parte de gestão, que o link público não baixa. */
import { montarHoras } from './HoraCampo';
import { cfg, ptipo, recebePorJogo } from '../dominio/caixa.js';
import { relogio12, simboloMoeda } from '../i18n/formatos.js';
import { porTime, sport } from '../dominio/esportes.js';
import { resumo } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { fdia, lvl, lvlIn, posso } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { $, esc, nextSat } from '../nucleo/util.js';
import { dlg, openDlg, posField } from './dialogos.js';
import { campoTelefone } from './contato-form';

const starIn = st =>
  `<div class="starin" id="pst" data-v="${st}">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= st ? 'on' : ''}" data-a="star" data-v="${i}" aria-label="${i} estrelas">★</button>`).join('')}</div>`;
/* Tipo do jogador e "Recebe por jogo" (KAN-172): só administradores veem; ficam em privado/caixa. */
const TIPOS = ['mensalista', 'diarista', 'isento'];
function campoTipo(tipo, recebe) {
  const t = TIPOS.includes(tipo) ? tipo : 'mensalista',
    on = !!(recebe && recebe.v > 0);
  return `<label class="f"><span>${tx('jogador.tipo')}</span><select class="sel" id="ptp">${TIPOS.map(k => `<option value="${k}"${k === t ? ' selected' : ''}>${tx('tipo.' + k)}</option>`).join('')}</select></label>
  <div class="chk"><label><input type="checkbox" id="prj"${on ? ' checked' : ''}>${tx('jogador.recebePorJogo')}</label></div>
  <label class="f" id="prvBox"${on ? '' : ' hidden'}><span>${tx('jogador.valorPorJogo', { moeda: simboloMoeda() })}</span><input class="inp" type="number" inputmode="decimal" min="0" step="0.01" id="prv" value="${on ? recebe.v : ''}"></label>
  <p class="small muted" style="margin-top:-4px">${tx('jogador.recebeDica')}</p>`;
}
function playerDlg(id, prefill) {
  const p = id ? S.jog[id] : null,
    cid = id || prefill?.id,
    st = cid ? lvl(cid) : 5,
    ct = (S.cont || {})[cid] || {};
  openDlg(`<h3>${p ? 'Editar jogador' : 'Novo jogador'}</h3><label class="f"><span>Nome ou apelido</span><input class="inp" id="pnm" value="${esc(p?.name || prefill?.name || '')}" maxlength="40"></label>
  ${posField('ppos', p?.pos || prefill?.pos)}${posso('notas') ? `<div class="f"><span class="lbl">Nota de 1 a 10 (só administradores veem)</span>${lvlIn(st)}</div>` : ''}
  ${posso('caixa') ? campoTipo(p ? ptipo(id) : prefill?.tipo, cid ? recebePorJogo(cid) : null) : ''}
  ${campoTelefone(ct.tel || '', tx('contato.telRotulo'))}
  <label class="f"><span>${tx('contato.emailRotulo')}</span><input class="inp" id="pmail" type="email" autocomplete="email" maxlength="100" value="${esc(ct.email || '')}" placeholder="${tx('contato.emailExemplo')}"></label>
  ${p ? `<p class="small muted" style="margin-top:-4px">Cadastrado em ${fdia(p.criado)} · ${p.ativo === false ? '<b style="color:var(--out)">inativo</b>' : 'ativo'}</p>` : ''}
  <div class="dlg-f">${p ? `<button class="btn ghost danger" data-a="delPlayer" data-p="${id}">Excluir</button><button class="btn" data-a="toggleJog" data-p="${id}">${p.ativo === false ? 'Reativar' : 'Inativar'}</button>` : ''}<button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="savePlayer" data-p="${id || ''}">Salvar jogador</button></div>`);
  setTimeout(() => $('#pnm')?.focus(), 50);
}
/* Lugar do campo de horário (componente HoraCampo, montado depois de abrir o diálogo). */
const horaRaiz = (id, v, opcional, rotulo) =>
  `<span data-hora-raiz="${id}" data-v="${esc(v || '')}" data-rotulo="${esc(rotulo)}"${opcional ? ' data-opcional' : ''}></span>`;
function rodDlg(r) {
  const c = cfg();
  openDlg(`<h3>${r ? 'Editar rodada' : 'Nova rodada'}</h3>
  <div class="row"><label class="f" style="flex:1 1 100%"><span>Data</span><input class="inp" type="date" id="rdt" value="${r?.date || nextSat()}"></label><label class="f" style="width:auto"><span>Início</span>${horaRaiz('rtm', r?.time || c.time, false, 'Início')}</label><label class="f" style="width:auto"><span>Término</span>${horaRaiz('rfm', r?.fim || '', true, 'Término')}</label></div>
  <label class="f"><span>Local</span><input class="inp" id="rpl" value="${esc(r?.place ?? c.place)}" maxlength="200" placeholder="Ex.: Society do Zé, Av. Brasil 100, Jundiaí"></label>
  <p class="small muted">Quantidade de times e jogadores é definida na hora do sorteio.</p>
  <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveRod" data-v="${r ? r.id : ''}">${r ? 'Salvar' : 'Criar rodada'}</button></div>`);
  montarHoras(dlg, relogio12());
}
function drawPreview() {
  const box = $('#drawBox');
  if (!box) return;
  const k = [...box.querySelectorAll('.dp:checked')].length;
  if (sport().pairs) box.dataset.n = Math.max(1, Math.floor(k / 2));
  const n = +box.dataset.n,
    T = porTime();
  const kEl = $('#drawK');
  if (kEl) kEl.textContent = String(k);
  let txt;
  if (sport().pairs)
    txt =
      k < 4 ? 'São precisos ao menos 4 jogadores.' : `${k} jogadores → ${n} duplas${k % 2 ? ' (uma com reserva)' : ''}`;
  else if (k < n * 2) txt = `Poucos jogadores para ${n} times.`;
  else {
    const r = resumo(k, n, T);
    txt = r.reservas
      ? tx('sorteio.prevReservas', { k, n, t: T, r: tp('sorteio.reservas', r.reservas) })
      : r.completos
        ? tx('sorteio.prevCompletos', { k, n, t: T })
        : tx('sorteio.prevIncompletos', { k, n, tam: [...new Set(r.porTimeReal)].join(' e '), t: T });
  }
  $('#drawPrev').textContent = txt;
  $('#drawGo').disabled = sport().pairs ? k < 4 : k < n * 2;
  box.querySelectorAll('[data-a=dN]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === n));
  box.querySelectorAll('[data-a=dNov]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === +box.dataset.nov));
}

export { drawPreview, playerDlg, rodDlg };
