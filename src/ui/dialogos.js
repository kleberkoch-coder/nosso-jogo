import { cfg, ptipo } from '../dominio/caixa.js';
import { hasPos, sport } from '../dominio/esportes.js';
import { fdia, lvl, lvlIn, ppos } from '../dominio/grupo.js';
import { CAP } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, esc, nextSat } from '../nucleo/util.js';

/* =================== diálogos =================== */
const dlg=$('#dlg');
function openDlg(h){$('#dlgBody').innerHTML=h;if(!dlg.open)dlg.showModal()}
function closeDlgNow(){if(dlg.open)dlg.close()}
function closeDlg(){if(CAP){CAP.close=true;return}closeDlgNow()}
dlg.addEventListener('click',e=>{if(e.target===dlg)closeDlg()});
const val=id=>(document.getElementById(id)?.value||'').trim();
const posSel=(id,v)=>`<select class="sel" id="${id}">${sport().pos.map(([k,l])=>`<option value="${k}" ${(v||ppos(''))===k?'selected':''}>${l}</option>`).join('')}</select>`;
const posField=(id,v)=>hasPos()?`<label class="f"><span>Posição</span>${posSel(id,v)}</label>`:'';
const starIn=st=>`<div class="starin" id="pst" data-v="${st}">${[1,2,3,4,5].map(i=>`<button type="button" class="${i<=st?'on':''}" data-a="star" data-v="${i}" aria-label="${i} estrelas">★</button>`).join('')}</div>`;
function playerDlg(id,prefill){const p=id?S.jog[id]:null,cid=id||prefill?.id,st=cid?lvl(cid):5,ct=(S.cont||{})[cid]||{};
  openDlg(`<h3>${p?'Editar jogador':'Novo jogador'}</h3><label class="f"><span>Nome ou apelido</span><input class="inp" id="pnm" value="${esc(p?.name||prefill?.name||'')}" maxlength="40"></label>
  ${posField('ppos',p?.pos||prefill?.pos)}<div class="f"><span class="lbl">Nota de 1 a 10 (só administradores veem)</span>${lvlIn(st)}</div>
  <label class="f"><span>Tipo</span><select class="sel" id="ptp"><option value="mensalista">Mensalista</option><option value="diarista" ${(p?ptipo(id):prefill?.tipo)==='diarista'?'selected':''}>Diarista</option></select></label>
  <div class="row"><label class="f" style="flex:1;min-width:150px"><span>Telefone / WhatsApp</span><input class="inp" id="ptel" type="tel" inputmode="tel" maxlength="20" value="${esc(ct.tel||'')}" placeholder="(11) 98765-4321"></label>
  <label class="f" style="flex:1;min-width:150px"><span>E-mail (opcional)</span><input class="inp" id="pmail" type="email" maxlength="60" value="${esc(ct.email||'')}"></label></div>
  ${p?`<p class="small muted" style="margin-top:-4px">Cadastrado em ${fdia(p.criado)} · ${p.ativo===false?'<b style="color:var(--out)">inativo</b>':'ativo'}</p>`:''}
  <div class="dlg-f">${p?`<button class="btn ghost danger" data-a="delPlayer" data-p="${id}">Excluir</button><button class="btn" data-a="toggleJog" data-p="${id}">${p.ativo===false?'Reativar':'Inativar'}</button>`:''}<button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="savePlayer" data-p="${id||''}">Salvar jogador</button></div>`);
  setTimeout(()=>$('#pnm')?.focus(),50)}
function rodDlg(r){const c=cfg();openDlg(`<h3>${r?'Editar rodada':'Nova rodada'}</h3>
  <div class="row"><label class="f" style="flex:1"><span>Data</span><input class="inp" type="date" id="rdt" value="${r?.date||nextSat()}"></label><label class="f" style="width:120px"><span>Início</span><input class="inp" type="time" id="rtm" value="${r?.time||c.time}"></label><label class="f" style="width:120px"><span>Término</span><input class="inp" type="time" id="rfm" value="${r?.fim||''}"></label></div>
  <label class="f"><span>Local</span><input class="inp" id="rpl" value="${esc(r?.place??c.place)}" placeholder="Ex.: Society do Zé"></label>
  <p class="small muted">Quantidade de times e jogadores é definida na hora do sorteio.</p>
  <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveRod" data-v="${r?r.id:''}">${r?'Salvar':'Criar rodada'}</button></div>`)}
function drawPreview(){const box=$('#drawBox');if(!box)return;const k=[...box.querySelectorAll('.dp:checked')].length;if(sport().pairs)box.dataset.n=Math.max(1,Math.floor(k/2));const n=+box.dataset.n;
  const sz=Array.from({length:n},(_,i)=>Math.floor(k/n)+(i<k%n?1:0));$('#drawPrev').textContent=sport().pairs?(k<4?'São precisos ao menos 4 jogadores.':`${k} jogadores → ${n} duplas${k%2?' (uma com 3)':''}`):k<n*2?`Poucos jogadores para ${n} times.`:`${k} jogadores → ${n} times (${[...new Set(sz)].join(' e ')} por time)`;
  $('#drawGo').disabled=sport().pairs?k<4:k<n*2;box.querySelectorAll('[data-a=dN]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===n));box.querySelectorAll('[data-a=dNov]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===+box.dataset.nov))}

export { closeDlg, closeDlgNow, dlg, drawPreview, openDlg, playerDlg, posField, rodDlg, val };
