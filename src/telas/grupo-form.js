import { SPORTS, porTimePadrao } from '../dominio/esportes.js';
import { tx } from '../i18n/index.js';
import { dupName, fixos, freq, schedTxt } from '../dominio/grupo.js';
import { $, DIAS, esc, toast, uid } from '../nucleo/util.js';
import { val } from '../ui/dialogos.js';

function fixPanel(){const f=fixos();
  if(!f.length)return freq()==='fixo'?`<div class="row small muted">Os dias fixos do grupo ainda não foram definidos.<button class="btn sm" data-a="editGroup">Definir dias e horários</button></div>`:'';
  /* KAN-71: painel compacto; a explicação fica em "Como funciona". */
  return `<div class="panel fixos"><div class="row between"><div><h3 style="margin:0">Jogos fixos</h3><div class="small muted">${f.map(schedTxt).join('<br>')}</div></div>
  <div class="row"><button class="btn sm primary" data-a="shareFixo">Link permanente no WhatsApp</button><button class="btn sm" data-a="copyFixo">Copiar link</button><button class="btn sm" data-a="editGroup">Editar dias</button></div></div>
  <details class="small" style="margin-top:8px"><summary>Como funciona</summary><p class="muted" style="margin:6px 0 0">O link permanente sempre abre a próxima rodada. Mande uma vez e deixe fixado no grupo. A confirmação da semana seguinte abre assim que o jogo termina.</p></details></div>`}
function schedRow(x){x=x||{dow:1,ini:'20:00',fim:'22:00',place:''};
  return `<div class="srow" data-id="${esc(x.id||'')}"><select class="sel sd" aria-label="Dia da semana">${DIAS.map((d,i)=>`<option value="${i}" ${i===+x.dow?'selected':''}>${d}</option>`).join('')}</select>
  <input class="inp si" type="time" value="${esc(x.ini||'')}" aria-label="Início"><input class="inp sf" type="time" value="${esc(x.fim||'')}" aria-label="Término">
  <button class="btn sm ghost danger" data-a="rmSched" aria-label="Remover dia">✕</button><input class="inp sl" value="${esc(x.place||'')}" maxlength="60" placeholder="Local (opcional)"></div>`}
function groupForm(g,editing){const sp=g.sport||'futebol',fq=editing?freq(g):'fixo',fx=(g.cfg&&g.cfg.fixos)||[];
  return `<div id="ngBox" data-sp="${sp}" data-sp-ant="${sp}" data-freq="${fq}">
  <label class="f"><span>Nome do grupo</span><input class="inp" id="ngn" maxlength="40" value="${esc(g.name||'')}" placeholder="Ex.: Futebol de Segunda"></label>
  <div class="err" id="ngErr" style="margin-top:-8px"></div>
  <div class="f"><span class="lbl">Com que frequência vocês jogam?</span><span class="seg" style="display:flex"><button style="flex:1" data-a="pickFreq" data-v="fixo" aria-pressed="${fq==='fixo'}">Frequente</button><button style="flex:1" data-a="pickFreq" data-v="esporadico" aria-pressed="${fq==='esporadico'}">Esporádico</button></span>
    <p class="small muted" id="fqHelp" style="margin:6px 0 0">${fq==='fixo'?'Dias e horários fixos toda semana. A próxima rodada se cria sozinha e o link de confirmação é sempre o mesmo.':'Só rola de vez em quando. Você cria cada rodada quando marcar o jogo.'}</p></div>
  <div id="schedW" ${fq==='fixo'?'':'hidden'}><span class="lbl">Dias e horários</span><div id="sched">${(fx.length?fx:[null]).map(schedRow).join('')}</div>
    <button class="btn sm" data-a="addSched" style="margin:4px 0 12px">+ Adicionar outro dia</button></div>
  <div class="f"><span class="lbl">Esporte</span><div class="sgrid">${Object.entries(SPORTS).map(([k,v])=>`<button class="opt" aria-pressed="${k===sp}" data-a="pickSport" data-v="${k}"><span class="gem sm">${v.e}</span>${v.n}</button>`).join('')}</div></div>
  <label class="f" id="ngoW" ${sp==='outro'?'':'hidden'}><span>Qual esporte?</span><input class="inp" id="ngo" maxlength="30" value="${esc(g.sportName||'')}" placeholder="Ex.: Pickleball"></label>
  ${porTimeCampo(sp,(g.cfg&&g.cfg.porTime)||porTimePadrao(sp))}
  ${editing?'<p class="small muted" style="margin-top:-6px">Mudar o esporte troca posições, pontuação e categorias de votação. Revise as posições dos jogadores depois.</p>':''}
  </div>`}
/* Jogadores por time (pelada-v16): vem do esporte e cada grupo ajusta. */
function porTimeCampo(sp,v){return `<label class="f"><span>${tx('grupo.porTime')}</span><input class="inp" id="ngt" type="number" inputmode="numeric" min="1" max="30" value="${+v}" style="max-width:120px"></label>
  <p class="small muted" id="ngtHelp" style="margin-top:-6px">${porTimeAjuda(sp)}</p>`}
function porTimeAjuda(sp){return tx('grupo.porTimeAjuda',{esporte:esc((SPORTS[sp]||SPORTS.futebol).n),n:porTimePadrao(sp)})}
function readGroupForm(except){const box=$('#ngBox'),err=$('#ngErr');err.textContent='';
  const name=val('ngn'),sp=box.dataset.sp,fq=box.dataset.freq,spn=sp==='outro'?val('ngo'):'';
  if(name.length<2){err.textContent='Dê um nome ao grupo.';$('#ngn').focus();return null}
  if(dupName(name,except)){err.textContent='Você já tem um grupo com esse nome. Escolha outro para não confundir.';$('#ngn').focus();return null}
  if(sp==='outro'&&spn.length<2){toast('Diga qual é o esporte.');$('#ngo').focus();return null}
  const pt=+val('ngt');if(!(pt>=1&&pt<=30&&Number.isInteger(pt))){toast(tx('grupo.porTimeInvalido'));$('#ngt').focus();return null}
  let fixos=[];
  if(fq==='fixo'){fixos=[...box.querySelectorAll('.srow')].map(r=>({id:r.dataset.id||uid(),dow:+r.querySelector('.sd').value,ini:r.querySelector('.si').value,fim:r.querySelector('.sf').value,place:r.querySelector('.sl').value.trim()}));
    if(!fixos.length||fixos.some(x=>!x.ini)){toast('Informe o horário de início de cada dia.');return null}
    const seen=new Set();for(const x of fixos){const k=x.dow+'|'+x.ini;if(seen.has(k)){toast('Há dois horários iguais no mesmo dia.');return null}seen.add(k)}}
  return{name,sport:sp,sportName:spn,freq:fq,fixos,porTime:pt}}

export { fixPanel, groupForm, porTimeAjuda, readGroupForm, schedRow };
