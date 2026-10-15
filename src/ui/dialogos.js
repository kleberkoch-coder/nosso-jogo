import { horaCampo } from './hora.js';
import { cfg, ptipo } from '../dominio/caixa.js';
import { hasPos, porTime, sport } from '../dominio/esportes.js';
import { resumo } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { fdia, lvl, lvlIn, ppos } from '../dominio/grupo.js';
import { CAP } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, esc, nextSat } from '../nucleo/util.js';

/* =================== diálogos =================== */
const dlg=$('#dlg');
/* KAN-74: com botão principal no rodapé, o teclado do celular mostra "Concluir" e o Enter envia (ver eventos.js). */
function openDlg(h){conf=null;dlg.removeAttribute('aria-labelledby');const b=$('#dlgBody');b.innerHTML=h;fotoForm=valoresForm();setTimeout(()=>{fotoForm=valoresForm()},0);if(b.querySelector('.dlg-f .btn.primary,.dlg-f .btn.bib'))b.querySelectorAll('input.inp:not([enterkeyhint])').forEach(i=>{if(i.id!=='avq')i.setAttribute('enterkeyhint','done')});if(!dlg.open)dlg.showModal()}
function closeDlgNow(){if(dlg.open)dlg.close()}
function closeDlg(){if(CAP){CAP.close=true;return}if(conf){naoConfirmar();return}closeDlgNow()}
/* KAN-140: tocar fora ou Esc numa janela com algo já preenchido não joga o trabalho fora: pergunta antes.
   "Preenchido" = algum campo diferente de quando a janela abriu. Sem mudança, fecha direto como antes. */
let fotoForm='';
function valoresForm(){return [...document.querySelectorAll('#dlgBody input,#dlgBody select,#dlgBody textarea,#dlgBody [aria-pressed],#dlgBody [data-sp],#dlgBody [data-freq]')].filter(e=>!e.closest('#dlgGuardado,.conf'))
  .map(e=>e.tagName==='BUTTON'?e.getAttribute('aria-pressed'):e.type==='checkbox'||e.type==='radio'?e.checked:'value' in e&&e.tagName!=='DIV'?e.value:(e.dataset.sp||'')+'|'+(e.dataset.freq||'')).join('\u0001')}
function fecharPerguntando(){if(conf){naoConfirmar();return}
  if(!$('#dlgBody .dlg-f .btn.primary,#dlgBody .dlg-f .btn.bib')||valoresForm()===fotoForm){closeDlgNow();return}
  confirmou(null,{titulo:tx('janela.descartarTitulo'),texto:tx('janela.descartarTexto'),acao:tx('janela.descartar'),cancelar:tx('janela.continuarEditando'),perigo:true})}
dlg.addEventListener('click',e=>{if(e.target===dlg)fecharPerguntando()});

/* ---------- Janela de confirmação do app (KAN-128): no lugar do confirm() e do alert() do navegador ----------
   Uso numa ação:  const c=confirmou(el,{titulo,texto,acao,perigo});if(c!=='sim')return;  ...segue a ação...
   - Na 1ª vez abre a janela e devolve null. "Sim" roda a MESMA ação de novo com o mesmo botão, agora devolvendo 'sim'
     (assim o carregando, a gravação sem sinal e o fechar só depois de gravar continuam iguais a qualquer botão).
   - Com `nao`, a janela tem um segundo caminho (devolve 'nao'). Cancelar, Esc e tocar fora não fazem nada.
   - Aberta por cima de outra janela (ex.: Editar grupo), o formulário fica guardado escondido e volta ao Cancelar. */
let conf=null;
function confirmou(el,o){if(el&&el._conf){const r=el._conf;delete el._conf;return r}
  const body=$('#dlgBody');let guardado=null;
  if(dlg.open){guardado=document.createElement('div');guardado.id='dlgGuardado';guardado.hidden=true;while(body.firstChild)guardado.appendChild(body.firstChild)}else body.replaceChildren()
  conf={el,a:el&&el.dataset&&el.dataset.a,guardado,volta:document.activeElement,fim:o.fim};
  /* Montada elemento por elemento: os textos entram como texto, nunca como HTML. */
  const el_=(tag,cls,txt,a)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;if(a)e.dataset.a=a;return e};
  const h=el_('div','conf'),t=el_('h3',null,o.titulo),f=el_('div','dlg-f');t.id='confT';h.append(t);if(o.texto)h.append(el_('p','conf-txt',o.texto));
  if(!o.unico)f.append(el_('button','btn',o.cancelar||'Cancelar','confNao'));if(o.nao)f.append(el_('button','btn',o.nao,'confOutro'));
  f.append(el_('button','btn '+(o.perigo?'perigo':'primary'),o.acao,'confSim'));h.append(f);
  body.appendChild(h);if(guardado)body.appendChild(guardado);
  dlg.setAttribute('aria-labelledby','confT');if(!dlg.open)dlg.showModal();
  setTimeout(()=>h.querySelector('[data-a=confNao],[data-a=confSim]')?.focus(),20);return null}
/* Volta ao formulário guardado (ou fecha), sem fazer nada. */
function naoConfirmar(){const c=conf;if(!c)return;conf=null;dlg.removeAttribute('aria-labelledby');
  if(c.guardado){const body=$('#dlgBody');body.querySelector('.conf')?.remove();while(c.guardado.firstChild)body.appendChild(c.guardado.firstChild);c.guardado.remove()}else closeDlgNow();
  if(c.fim)c.fim();if(c.volta&&c.volta.isConnected)c.volta.focus()}
/* "Sim" ou o segundo caminho: roda a ação de novo. Se ela não fechar a janela nem abrir outra, volta ao formulário guardado. */
function responder(r,ACT){const c=conf;if(!c)return;conf=null;dlg.removeAttribute('aria-labelledby');
  const f=ACT[c.a];if(!f||!c.el){closeDlg();if(c.fim)c.fim();return}c.el._conf=r;
  const res=f(c.el);if(c.fim)c.fim();
  if(!(CAP&&CAP.close)&&$('#dlgBody .conf')){if(c.guardado){const body=$('#dlgBody');body.querySelector('.conf').remove();while(c.guardado.firstChild)body.appendChild(c.guardado.firstChild);c.guardado.remove()}else closeDlg()}
  if(c.volta&&c.volta.isConnected)setTimeout(()=>{if(!dlg.open&&c.volta.isConnected)c.volta.focus()},0);
  return res}
/* Esc com a confirmação aberta: só a confirmação fecha (volta ao formulário, se houver). */
dlg.addEventListener('cancel',e=>{e.preventDefault();fecharPerguntando()});
dlg.addEventListener('close',()=>{if(conf){const c=conf;conf=null;if(c.fim)c.fim()}});
/* Aviso de uma linha com "Entendi" (no lugar do alert): resolve quando a janela fecha. */
function avisar(titulo,texto){return new Promise(res=>{confirmou(null,{titulo,texto,acao:'Entendi',unico:true,fim:res})})}
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
  <div class="row"><label class="f" style="flex:1 1 100%"><span>Data</span><input class="inp" type="date" id="rdt" value="${r?.date||nextSat()}"></label><label class="f" style="width:auto"><span>Início</span>${horaCampo('rtm','',r?.time||c.time,false,'Início')}</label><label class="f" style="width:auto"><span>Término</span>${horaCampo('rfm','',r?.fim||'',true,'Término')}</label></div>
  <label class="f"><span>Local</span><input class="inp" id="rpl" value="${esc(r?.place??c.place)}" maxlength="200" placeholder="Ex.: Society do Zé, Av. Brasil 100, Jundiaí"></label>
  <p class="small muted">Quantidade de times e jogadores é definida na hora do sorteio.</p>
  <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveRod" data-v="${r?r.id:''}">${r?'Salvar':'Criar rodada'}</button></div>`)}
function drawPreview(){const box=$('#drawBox');if(!box)return;const k=[...box.querySelectorAll('.dp:checked')].length;if(sport().pairs)box.dataset.n=Math.max(1,Math.floor(k/2));const n=+box.dataset.n,T=porTime();
  const kEl=$('#drawK');if(kEl)kEl.textContent=String(k);
  let txt;if(sport().pairs)txt=k<4?'São precisos ao menos 4 jogadores.':`${k} jogadores → ${n} duplas${k%2?' (uma com reserva)':''}`;
  else if(k<n*2)txt=`Poucos jogadores para ${n} times.`;
  else{const r=resumo(k,n,T);txt=r.reservas?tx('sorteio.prevReservas',{k,n,t:T,r:tp('sorteio.reservas',r.reservas)}):r.completos?tx('sorteio.prevCompletos',{k,n,t:T}):tx('sorteio.prevIncompletos',{k,n,tam:[...new Set(r.porTimeReal)].join(' e '),t:T})}
  $('#drawPrev').textContent=txt;
  $('#drawGo').disabled=sport().pairs?k<4:k<n*2;box.querySelectorAll('[data-a=dN]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===n));box.querySelectorAll('[data-a=dNov]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===+box.dataset.nov))}

export { avisar, closeDlg, closeDlgNow, confirmou, dlg, drawPreview, naoConfirmar, openDlg, playerDlg, posField, responder, rodDlg, val };
