import { horaCampo } from '../ui/hora.js';
import { SPORTS, porTimePadrao } from '../dominio/esportes.js';
import { tx } from '../i18n/index.js';
import { dupName, fixos, freq } from '../dominio/grupo.js';
import { $, DIAS, esc, toast, uid } from '../nucleo/util.js';
import { val } from '../ui/dialogos.js';
import { S } from '../nucleo/estado.js';
import { paisPor, regiaoNova } from '../dominio/paises.ts';
import { fusoAparelho, listaFuso, listaMoeda, opcoesFuso, opcoesMoeda, opcoesPais, preencher } from '../ui/regiao.ts';

function schedRow(x) {
  x = x || { dow: 1, ini: '20:00', fim: '22:00', place: '' };
  return `<div class="srow" data-id="${esc(x.id || '')}"><select class="sel sd" aria-label="${tx('grupo.diaSemana')}">${DIAS.map((d, i) => `<option value="${i}" ${i === +x.dow ? 'selected' : ''}>${d}</option>`).join('')}</select>
  <span class="hrot"><span class="hrot-t" aria-hidden="true">${tx('grupo.inicio')}</span>${horaCampo('', 'si', x.ini || '', false, tx('grupo.inicio'))}</span>
  <span class="hrot"><span class="hrot-t" aria-hidden="true">${tx('grupo.terminoOpcional')}</span>${horaCampo('', 'sf', x.fim || '', true, tx('grupo.termino'))}</span>
  <button class="btn sm ghost danger" data-a="rmSched" aria-label="${tx('grupo.removerDia')}">✕</button><input class="inp sl" value="${esc(x.place || '')}" maxlength="200" placeholder="${tx('grupo.localOpcional')}"></div>`;
}
function groupForm(g, editing) {
  const sp = g.sport || 'futebol',
    fq = editing ? freq(g) : 'fixo',
    fx = (g.cfg && g.cfg.fixos) || [];
  return `<div id="ngBox" data-sp="${sp}" data-sp-ant="${sp}" data-freq="${fq}">
  <label class="f"><span>${tx('grupo.nome')}</span><input class="inp" id="ngn" maxlength="40" value="${esc(g.name || '')}" placeholder="${tx('grupo.nomeExemplo')}"></label>
  <div class="err" id="ngErr" style="margin-top:-8px"></div>
  <div class="f"><span class="lbl">${tx('grupo.frequencia')}</span><span class="seg" style="display:flex"><button style="flex:1" data-a="pickFreq" data-v="fixo" aria-pressed="${fq === 'fixo'}">${tx('grupo.frequente')}</button><button style="flex:1" data-a="pickFreq" data-v="esporadico" aria-pressed="${fq === 'esporadico'}">${tx('grupo.esporadico')}</button></span>
    <p class="small muted" id="fqHelp" style="margin:6px 0 0">${tx(fq === 'fixo' ? 'grupo.frequenteAjuda' : 'grupo.esporadicoAjuda')}</p></div>
  <div id="schedW" ${fq === 'fixo' ? '' : 'hidden'}><span class="lbl">${tx('grupo.diasHorarios')}</span><div id="sched">${(fx.length ? fx : [null]).map(schedRow).join('')}</div>
    <button class="btn sm" data-a="addSched" style="margin:4px 0 12px">${tx('grupo.outroDia')}</button></div>
  <div class="f"><span class="lbl">${tx('grupo.esporte')}</span><div class="sgrid">${Object.entries(SPORTS)
    .map(
      ([k, v]) =>
        `<button class="opt" aria-pressed="${k === sp}" data-a="pickSport" data-v="${k}"><span class="gem sm">${v.e}</span>${v.n}</button>`
    )
    .join('')}</div></div>
  <label class="f" id="ngoW" ${sp === 'outro' ? '' : 'hidden'}><span>${tx('grupo.qualEsporte')}</span><input class="inp" id="ngo" maxlength="30" value="${esc(g.sportName || '')}" placeholder="${tx('grupo.qualEsporteExemplo')}"></label>
  ${porTimeCampo(sp, (g.cfg && g.cfg.porTime) || porTimePadrao(sp))}
  ${editing ? `<p class="small muted" style="margin-top:-6px">${tx('grupo.mudarEsporte')}</p>` : ''}
  ${regiaoCampos(g, editing)}
  </div>`;
}
/* País, moeda e fuso do grupo (KAN-162). Grupo novo: os do organizador (país da conta e fuso do aparelho, se for do país).
   Grupo antigo, sem país: Brasil e Real. A moeda e o fuso podem ser trocados à parte. */
function regiaoCampos(g, editing) {
  const c = (g && g.cfg) || {},
    r =
      editing && c.pais
        ? { pais: c.pais, moeda: c.moeda, fuso: c.fuso }
        : regiaoNova(editing ? 'BR' : S.me && S.me.pais, fusoAparelho());
  if (editing && !c.pais) r.moeda = c.moeda || 'BRL';
  const p = paisPor(r.pais);
  return `<div class="f" id="ngReg"><span class="lbl">${tx('regiao.titulo')}</span>
  <div class="reg-campos"><label class="f"><span>${tx('regiao.pais')}</span><select class="sel" id="ngp">${opcoesPais(r.pais)}</select></label>
  <label class="f"><span>${tx('regiao.moeda')}</span><select class="sel" id="ngm" data-antes="${editing ? r.moeda : ''}">${opcoesMoeda(r.moeda)}</select></label>
  <label class="f" id="ngzW"${p && p.fusos.length > 1 ? '' : ' hidden'}><span>${tx('regiao.fuso')}</span><select class="sel" id="ngz">${opcoesFuso(r.pais, r.fuso)}</select></label></div>
  <p class="small muted" style="margin-top:-6px">${tx('regiao.grupoAjuda')}</p></div>`;
}
/* Trocou o país: moeda e fuso voltam aos do país novo (a pessoa ainda pode mudar cada um). */
function trocarPaisGrupo() {
  const r = regiaoNova(val('ngp'), fusoAparelho()),
    m = $('#ngm'),
    z = $('#ngz');
  if (m) preencher(m, listaMoeda(r.moeda), r.moeda);
  if (z) preencher(z, listaFuso(r.pais, r.fuso), r.fuso);
  const zw = $('#ngzW');
  if (zw) zw.hidden = !(paisPor(r.pais) && paisPor(r.pais).fusos.length > 1);
}
/* Jogadores por time (pelada-v16): vem do esporte e cada grupo ajusta. */
function porTimeCampo(sp, v) {
  return `<label class="f"><span>${tx('grupo.porTime')}</span><input class="inp" id="ngt" type="number" inputmode="numeric" min="1" max="30" value="${+v}" style="max-width:120px"></label>
  <p class="small muted" id="ngtHelp" style="margin-top:-6px">${porTimeAjuda(sp)}</p>`;
}
function porTimeAjuda(sp) {
  return tx('grupo.porTimeAjuda', { esporte: esc((SPORTS[sp] || SPORTS.futebol).n), n: porTimePadrao(sp) });
}
function readGroupForm(except) {
  const box = $('#ngBox'),
    err = $('#ngErr');
  err.textContent = '';
  const name = val('ngn'),
    sp = box.dataset.sp,
    fq = box.dataset.freq,
    spn = sp === 'outro' ? val('ngo') : '';
  if (name.length < 2) {
    err.textContent = tx('grupo.semNome');
    $('#ngn').focus();
    return null;
  }
  if (dupName(name, except)) {
    err.textContent = tx('grupo.nomeRepetido');
    $('#ngn').focus();
    return null;
  }
  if (sp === 'outro' && spn.length < 2) {
    toast(tx('grupo.semEsporte'));
    $('#ngo').focus();
    return null;
  }
  const pt = +val('ngt');
  if (!(pt >= 1 && pt <= 30 && Number.isInteger(pt))) {
    toast(tx('grupo.porTimeInvalido'));
    $('#ngt').focus();
    return null;
  }
  let fixos = [];
  if (fq === 'fixo') {
    fixos = [...box.querySelectorAll('.srow')].map(r => ({
      id: r.dataset.id || uid(),
      dow: +r.querySelector('.sd').value,
      ini: r.querySelector('.si').value,
      fim: r.querySelector('.sf').value,
      place: r.querySelector('.sl').value.trim(),
    }));
    if (!fixos.length || fixos.some(x => !x.ini)) {
      toast(tx('grupo.semInicio'));
      return null;
    }
    const seen = new Set();
    for (const x of fixos) {
      const k = x.dow + '|' + x.ini;
      if (seen.has(k)) {
        toast(tx('grupo.horarioRepetido'));
        return null;
      }
      seen.add(k);
    }
  }
  const pais = val('ngp') || 'BR',
    regiao = { pais, moeda: val('ngm') || 'BRL', fuso: val('ngz') || '', formato: paisPor(pais)?.formato || 'pt-BR' };
  return { name, sport: sp, sportName: spn, freq: fq, fixos, porTime: pt, regiao };
}

export { groupForm, porTimeAjuda, readGroupForm, schedRow, trocarPaisGrupo };
