import { abrirHist, buscarHist, estadoHist } from './telas/historico.js';
import { CAIXA_K, cfg, editPc, ptipo } from './dominio/caixa.js';
import { APP, COL, SPORTS, col, hasPos, porTime, porTimePadrao, posKeys, posLabel, posTag, sport, tn } from './dominio/esportes.js';
import { attendance, curRodada, dupName, fdia, fixos, fmtL, freq, gname, grpAtivo, isAvulso, lvl, lvlIn, normName, players, pname, ppos, rodById, rodadas, setLvl } from './dominio/grupo.js';
import { draw } from './dominio/sorteio.js';
import { foraDosTimes, fotoDoSorteio } from './dominio/divergencia.ts';
import { reservas, sugerirTimes, titulares } from './dominio/times.ts';
import { tp, tx } from './i18n/index.js';
import { shareDlg, txtConvite, txtTimes } from './dominio/whatsapp.js';
import { copyText, semConexao } from './eventos.js';
import { B, setCAP, sleep } from './nucleo/backend.js';
import { editApp, editRat, editRod, saveContato, setPres } from './nucleo/edicoes.js';
import { addMatch, apagarLanc, apagarPartidasDaRodada, delMatch as apagarPartida, gravarVotacao, recalcular, salvarLanc } from './nucleo/partidas.js';
import { GB, S, clean, w } from './nucleo/estado.js';
import { linkConvite, linkProxima, linkRodada, linkVoto } from './nucleo/links.js';
import { $, DIAS, brl, cl, esc, fdate, fmonth, inAppBrowser, key, toast, today, uid } from './nucleo/util.js';
import { upMyGroup } from './rotas.js';
import { pendencias } from './telas/caixa.js';
import { groupForm, porTimeAjuda, readGroupForm, schedRow } from './telas/grupo-form.js';
import { AUTH_CANCEL, authMsg, pwOk } from './telas/login.js';
import { actx, elapsed, setActx, sumPts } from './telas/partida.js';
import { MEK, myLocal } from './telas/publico-rodada.js';
import { tally } from './telas/votacao.js';
import { closeDlg, closeDlgNow, dlg, drawPreview, openDlg, playerDlg, posField, rodDlg, val } from './ui/dialogos.js';
import { changed, render } from './ui/render.js';
import { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeMenuEl } from './ui/tema.js';
import { LOCAL } from './i18n/formatos.js';

/* =================== ações =================== */
/* Põe a pessoa direto num time (sai de qualquer outro) e a inclui na foto do sorteio, para não gerar aviso. */
function porNoTime(ti,pid){const r=curRodada(),t=r.times[ti];toast(tx('porTime.posto',{nome:pname(pid),time:tn(t.c)}));
  return editRod(r.id,x=>{x.times.forEach(t=>{t.players=t.players.filter(p=>p!==pid);if(t.res)t.res=t.res.filter(p=>p!==pid)});const alvo=x.times[ti];
    if(titulares(alvo).length>=porTime())alvo.res=(alvo.res||[]).concat(pid);alvo.players.push(pid);
    x.info=x.info||{};x.info[pid]={n:pname(pid),p:ppos(pid)};const b=x.base||[...fotoDoSorteio(x)];if(!b.includes(pid))b.push(pid);x.base=b})}
/* Escolher o time de quem confirmou depois do sorteio. */
function escolherTime(pid){const r=curRodada();
  openDlg(`<h3>${esc(tx('porTime.qualTime',{nome:pname(pid)}))}</h3><div class="vgrid">${r.times.map((t,i)=>`<button class="opt" data-a="doPorTime" data-v="${i}" data-p="${pid}"><span class="dot" style="background:${col(t.c).c}"></span>${tn(t.c)}<span class="tag" style="margin-left:auto">${tp('porTime.jogadores',t.players.length)}</span></button>`).join('')}</div><div class="dlg-f"><button class="btn" data-a="close">Cancelar</button></div>`)}

const ACT={
  tab:el=>{S.tab=el.dataset.v;render();window.scrollTo(0,0)},
  themeMenu:el=>{if(themeMenuEl&&themeAnchor===el){closeThemeMenu(true);return}openThemeMenu(el)},
  setTheme:el=>{const t=el.dataset.v;try{if(t==='auto')localStorage.removeItem(TEMA_K);else localStorage.setItem(TEMA_K,t)}catch(e){}
    const fromMenu=!!el.closest('.theme-menu');closeThemeMenu(fromMenu);applyTheme();render()},
  close:closeDlg,
  copy:()=>{const t=$('#shtxt');copyText(t.value,t)},
  authMode:el=>{const em=val('le');S.authMode=el.dataset.v;try{localStorage.setItem('pelada-mode',S.authMode)}catch(e){}render();const i=$('#le');if(i){i.value=em;(em?$('#lp'):i).focus()}},
  login:async()=>{const e=val('le'),p=$('#lp').value;$('#lerr').textContent='';if(!e||!p){$('#lerr').textContent='Preencha e-mail e senha.';return}try{await B.login(e,p);try{localStorage.setItem('pelada-mode','login')}catch(x){}}catch(x){$('#lerr').textContent=authMsg(x)}},
  signup:async()=>{const e=val('le'),p=$('#lp').value;if(!pwOk(p)){$('#lerr').textContent='A senha não atende aos requisitos.';return}if(p!==$('#lp2').value){$('#lerr').textContent='As senhas não conferem.';return}
    $('#lerr').textContent='';try{await B.signup(e,p);try{localStorage.setItem('pelada-mode','login')}catch(x){}}catch(x){$('#lerr').textContent=authMsg(x)}},
  google:async()=>{const le=$('#lerr');if(le)le.textContent='';
    if(!B.demo&&inAppBrowser()){openDlg(`<h3>Abra no navegador</h3><p>O Google não permite entrar por dentro deste aplicativo. Abra o link no <b>Chrome</b> ou no <b>Safari</b> e toque de novo em <b>Continuar com Google</b>.</p>
      <p class="small muted">Dica: toque nos três pontinhos (⋮ ou ⋯) no canto da tela e escolha <b>Abrir no navegador</b>. Ou entre com e-mail e senha aqui mesmo.</p>
      <div class="dlg-f"><button class="btn" data-a="close">Fechar</button><button class="btn primary" data-a="copyHere">Copiar link</button></div>`);return}
    try{await B.google(val('le'));try{localStorage.setItem('pelada-mode','login')}catch(x){}}
    catch(x){if(AUTH_CANCEL.includes(x&&x.code))return;console.warn(x);const m=authMsg(x);if($('#lerr'))$('#lerr').textContent=m;else toast(m,6000)}},
  copyHere:()=>copyText(location.href),
  reset:async()=>{const e=val('le');if(!e){$('#lerr').textContent='Digite seu e-mail acima.';return}try{await B.reset(e);toast('Enviamos um link de redefinição para '+e)}catch(x){$('#lerr').textContent=authMsg(x)}},
  newGroup:()=>{openDlg(`<h3>Novo grupo</h3>${groupForm({},false)}<div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="createGroup">Criar grupo</button></div>`);setTimeout(()=>$('#ngn')?.focus(),50)},
  editGroup:()=>{openDlg(`<h3>Editar grupo</h3><p class="small muted" style="margin-top:-6px">Criado em ${fdia(S.app.createdAt)}</p>${groupForm(S.app,true)}<div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveGroup">Salvar</button></div>`)},
  pickFreq:el=>{const box=$('#ngBox');box.dataset.freq=el.dataset.v;box.querySelectorAll('[data-a=pickFreq]').forEach(b=>b.setAttribute('aria-pressed',b===el));$('#schedW').hidden=el.dataset.v!=='fixo';
    $('#fqHelp').textContent=el.dataset.v==='fixo'?'Dias e horários fixos toda semana. A próxima rodada se cria sozinha e o link de confirmação é sempre o mesmo.':'Só rola de vez em quando. Você cria cada rodada quando marcar o jogo.'},
  addSched:()=>{const rows=[...document.querySelectorAll('#sched .srow')],last=rows[rows.length-1];const x=last?{dow:(+last.querySelector('.sd').value+2)%7,ini:last.querySelector('.si').value,fim:last.querySelector('.sf').value,place:last.querySelector('.sl').value}:null;
    $('#sched').insertAdjacentHTML('beforeend',schedRow(x));const n=$('#sched').lastElementChild.querySelector('.sd');n&&n.focus()},
  rmSched:el=>{const rows=document.querySelectorAll('#sched .srow');if(rows.length<=1){toast('Deixe pelo menos um dia, ou marque o grupo como esporádico.');return}el.closest('.srow').remove()},
  saveGroup:()=>{const g=readGroupForm(S.gid);if(!g)return;const wasFix=fixos().map(x=>x.dow+'|'+x.ini).join(),willFix=g.fixos.map(x=>x.dow+'|'+x.ini).join();
    if(wasFix&&wasFix!==willFix&&!confirm('Mudar dias ou horários fixos reinicia a confirmação da próxima rodada fixa. Continuar?'))return;
    const p=editApp(a=>{a.name=g.name;a.sport=g.sport;a.sportName=g.sportName;a.freq=g.freq;a.cfg.fixos=g.fixos;a.cfg.porTime=g.porTime;if(g.fixos[0]&&g.fixos[0].place)a.cfg.place=g.fixos[0].place});
    upMyGroup(S.gid,{name:g.name,sport:g.sport,sportName:g.sportName});S.rid=null;closeDlg();toast('Grupo atualizado.');return p},
  addPos:()=>openDlg(`<h3>Nova posição</h3><div class="row"><label class="f" style="width:110px"><span>Sigla</span><input class="inp" id="psg" maxlength="4" placeholder="Ex.: VOL" style="text-transform:uppercase"></label>
    <label class="f" style="flex:1"><span>Nome</span><input class="inp" id="pnmx" maxlength="24" placeholder="Ex.: Volante"></label></div><p class="small muted" style="margin-top:-6px">A sigla aparece nas listas e nos times (até 4 letras).</p>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="savePos">Adicionar</button></div>`),
  savePos:()=>{const k=val('psg').toUpperCase().replace(/[^A-Z0-9]/g,''),l=val('pnmx');if(k.length<2){toast('A sigla precisa de 2 a 4 letras.');return}if(l.length<2){toast('Dê um nome à posição.');return}
    if(sport().pos.some(([x,y])=>x===k||normName(y)===normName(l))){toast('Essa posição já existe.');return}closeDlg();return editApp(a=>{a.posx=(a.posx||[]).concat([[k,l]])})},
  rmPos:el=>{const i=+el.dataset.v,[k,l]=(S.app.posx||[])[i]||[];const n=Object.values(S.jog).filter(p=>p.pos===k).length;
    if(!confirm(`Remover a posição ${l}?`+(n?` ${n} jogador(es) com essa posição passam para uma posição padrão.`:'')))return;return editApp(a=>{a.posx=(a.posx||[]).filter((x,j)=>j!==i)})},
  dupGroup:()=>{openDlg(`<h3>Duplicar grupo</h3><p class="small muted" style="margin-top:-6px">Cria um grupo novo e independente, com o mesmo esporte, frequência, dias e horários, posições e configurações de partidas e caixa. Você será o organizador dele.</p>
    <label class="f"><span>Nome do novo grupo</span><input class="inp" id="dgn" maxlength="40" value="${esc(gname()+' (cópia)')}"></label><div class="err" id="dgErr" style="margin-top:-8px"></div>
    <label class="row small" style="margin-bottom:6px"><input type="checkbox" id="dgel" checked> Copiar o elenco (jogadores ativos, notas, contatos, avulsos e pares separados)</label>
    <p class="small muted">Rodadas, partidas, caixa, votações e administradores não são copiados.</p>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="doDupGroup">Duplicar</button></div>`);setTimeout(()=>{const i=$('#dgn');i&&(i.focus(),i.select())},50)},
  doDupGroup:async()=>{const name=val('dgn');$('#dgErr').textContent='';if(name.length<2){$('#dgErr').textContent='Dê um nome ao grupo.';return}if(dupName(name,null)){$('#dgErr').textContent='Você já tem um grupo com esse nome.';return}
    const withEl=$('#dgel').checked,a=S.app,gid=B.newId(),uid=S.user.uid,now=Date.now(),base='grupos/'+gid,nc=cl(a.cfg)||{},c0=cfg();CAIXA_K.forEach(k=>delete nc[k]);
    try{await B.set(base,clean({name,sport:a.sport||'futebol',sportName:a.sportName||'',freq:freq(),posx:a.posx||[],ativo:true,cfg:nc,owner:uid,createdAt:now,origem:S.gid}));
      await B.set(base+'/membros/'+uid,Object.assign({uid,email:S.user.email,role:'owner',at:now},S.user.via?{via:S.user.via}:{}));
      const pcN={mensal:c0.mensal,diaria:c0.diaria,pix:c0.pix,tipos:{}};if(withEl)players().forEach(p=>{pcN.tipos[p.id]=ptipo(p.id)});await B.set(base+'/privado/caixa',clean(pcN));
      if(withEl){const keep=new Set(players().map(p=>p.id).concat(Object.keys(S.avul||{})));const ps=[];
        players().forEach(p=>{const d=Object.assign({},S.jog[p.id],{criado:now});delete d.tipo;ps.push(B.set(base+'/jogadores/'+p.id,clean(d)))});
        Object.entries(S.avul||{}).forEach(([id,x])=>ps.push(B.set(base+'/avulsos/'+id,clean(Object.assign({},x,{criado:now})))));
        const R=cl(S.rat)||{},nv={};keep.forEach(id=>{nv[id]=lvl(id)});ps.push(B.set(base+'/privado/ratings',{nivel:nv,stars:{},sep:(R.sep||[]).filter(([x,y])=>keep.has(x)&&keep.has(y))}));
        const C={};Object.entries(S.cont||{}).forEach(([id,c])=>{if(keep.has(id))C[id]=c});if(Object.keys(C).length)ps.push(B.set(base+'/privado/contatos',C));await Promise.all(ps)}
      await upMyGroup(gid,{name,role:'owner',sport:a.sport||'futebol',sportName:a.sportName||'',ativo:true,criado:now});closeDlg();toast('Grupo duplicado.');location.hash='#/g/'+gid}
    catch(e){console.error(e);toast('Não foi possível duplicar. Tente de novo.')}},
  toggleAtivo:()=>{const on=!grpAtivo();if(!on&&!confirm('Inativar "'+gname()+'"? Os links públicos deixam de aceitar confirmações e votos, e a rodada fixa para de ser criada. Tudo continua guardado e você pode reativar depois.'))return;
    const p=editApp(a=>{a.ativo=on;if(on)delete a.inativadoEm;else a.inativadoEm=Date.now()});upMyGroup(S.gid,{ativo:on});toast(on?'Grupo reativado.':'Grupo inativado.');return p},
  pickSport:el=>{const box=el.closest('[data-sp]');box.dataset.sp=el.dataset.v;box.querySelectorAll('[data-a=pickSport]').forEach(b=>b.setAttribute('aria-pressed',b===el));const o=box.querySelector('#ngoW,#csoW');if(o)o.hidden=el.dataset.v!=='outro';
    const nt=box.querySelector('#ngt');if(nt){const ant=box.dataset.spAnt||'';if(!ant||+nt.value===porTimePadrao(ant))nt.value=porTimePadrao(el.dataset.v);box.dataset.spAnt=el.dataset.v;$('#ngtHelp').textContent=porTimeAjuda(el.dataset.v)}},
  createGroup:async el=>{const g=readGroupForm(null);if(!g)return;const gid=B.newId(),uid=S.user.uid,now=Date.now();
    try{await B.set('grupos/'+gid,{name:g.name,sport:g.sport,sportName:g.sportName,freq:g.freq,ativo:true,cfg:{minutes:SPORTS[g.sport].min,porTime:g.porTime,fixos:g.fixos,place:(g.fixos[0]&&g.fixos[0].place)||''},owner:uid,createdAt:now});
      await B.set('grupos/'+gid+'/membros/'+uid,Object.assign({uid,email:S.user.email,role:'owner',at:now},S.user.via?{via:S.user.via}:{}));
      await upMyGroup(gid,{name:g.name,role:'owner',sport:g.sport,sportName:g.sportName,ativo:true,criado:now});closeDlg();location.hash='#/g/'+gid}
    catch(e){console.error(e);toast('Não foi possível criar o grupo. Tente de novo.')}},
  groupsDlg:()=>{const gs=Object.entries((S.me&&S.me.grupos)||{}).filter(([k,v])=>v.ativo!==false||k===S.gid).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'',LOCAL));
    openDlg(`<h3>Seus grupos</h3><ul class="plist">${gs.map(([gid,g])=>`<li><span class="gem">${(SPORTS[g.sport]||SPORTS.futebol).e}</span><span class="pn"><b>${esc(g.name)}</b>${gid===S.gid?' <span class="tag">· aberto</span>':''}<br><span class="tag">${esc(g.sportName||(SPORTS[g.sport]||SPORTS.futebol).n)}</span></span>${gid===S.gid?'':`<a class="btn sm primary" href="#/g/${gid}">Abrir</a>`}</li>`).join('')}</ul>
    <div class="dlg-f"><a class="btn" href="#/">Ver todos</a><button class="btn primary" data-a="newGroup">Novo grupo</button></div>`)},
  acceptInv:async el=>{el.disabled=true;const R=S.route,uid=S.user.uid;
    try{await B.set('grupos/'+R.gid+'/membros/'+uid,Object.assign({uid,email:S.user.email,role:'admin',token:R.token,at:Date.now()},S.user.via?{via:S.user.via}:{}));await upMyGroup(R.gid,{name:gname(),role:'admin',sport:S.app.sport||'futebol',sportName:S.app.sportName||'',ativo:S.app.ativo!==false,criado:S.app.createdAt||null});location.hash='#/g/'+R.gid}
    catch(e){console.error(e);el.disabled=false;toast('Convite inválido ou expirado. Peça um novo link ao organizador.')}},
  inviteLink:()=>{let t=S.convite?.token;if(!t){t=B.newId()+B.newId();S.convite={token:t};w(GB.set('privado/convite',{token:t}))}
    shareDlg('Convite para administrador',`Oi! Te convidei para administrar o grupo *${gname()}* no ${APP}.\nAbra o link, crie sua conta (ou entre) e aceite:\n${linkConvite(t)}`)},
  newInviteLink:()=>{if(!confirm('Gerar um novo link? O link atual deixa de funcionar.'))return;const t=B.newId()+B.newId();S.convite={token:t};w(GB.set('privado/convite',{token:t}));ACT.inviteLink()},
  rmMember:el=>{if(!confirm('Remover este administrador do grupo? O link de convite atual também deixa de funcionar, para ele não conseguir voltar sozinho.'))return;delete S.membros[el.dataset.v];S.convite=null;changed();
    return Promise.all([w(GB.del('membros/'+el.dataset.v)),w(GB.del('privado/convite'))]).then(()=>toast('Administrador removido. Para convidar alguém, gere um novo link.',4500))},
  forgetGroup:()=>{const me=cl(S.me)||{grupos:{}};delete me.grupos[S.gid];S.me=me;B.set('usuarios/'+S.user.uid,me).catch(()=>{});location.hash='#/'},
  logout:()=>{B.logout().then(()=>{location.hash='#/'})},
  invSwitch:()=>B.logout(),
  newRod:()=>rodDlg(null),editRod:()=>rodDlg(curRodada()),
  saveRod:el=>{const d=val('rdt');if(!d){toast('Escolha a data.');return}const id=el.dataset.v;
    if(id)editRod(id,r=>Object.assign(r,{date:d,time:val('rtm'),fim:val('rfm'),place:val('rpl')}));
    else{const nid=B.newId();S.rid=nid;editRod(nid,r=>Object.assign(r,{date:d,time:val('rtm'),fim:val('rfm'),place:val('rpl'),locked:false,times:null,info:{},createdAt:Date.now()}));editApp(a=>{a.cfg.place=val('rpl');a.cfg.time=val('rtm')})}
    closeDlg()},
  delRod:()=>{const r=curRodada();if(!confirm('Excluir a rodada de '+fdate(r.date)+'? As partidas dela saem do ranking.'))return;Object.keys(S.pres).forEach(p=>GB.del('rodadas/'+r.id+'/presencas/'+p));
    return apagarPartidasDaRodada(r.id,r.date).then(()=>{w(GB.del('rodadas/'+r.id));delete S.rod[r.id];S.rid=null;changed()})},
  shareFixo:()=>{const f=fixos();shareDlg('Link permanente',`⚽ *${gname()}*\n${f.map(x=>`Toda ${DIAS[x.dow].toLowerCase()}, ${x.ini}${x.fim?' às '+x.fim:''}${x.place?' — '+x.place:''}`).join('\n')}\n\nConfirme sua presença sempre neste link:\n${linkProxima()}`)},
  copyFixo:()=>copyText(linkProxima()),
  cancelRod:()=>{const r=curRodada();if(!r.cancelada&&!confirm('Cancelar o jogo de '+fdate(r.date)+'? O link permanente passa a mostrar a rodada seguinte.'))return;editRod(r.id,x=>{x.cancelada=!x.cancelada});if(!r.cancelada)toast('Data cancelada.')},
  lock:()=>{const r=curRodada();if(r.locked&&r.times&&!confirm(tx('lista.confirmaReabrir')))return;return editRod(r.id,x=>{x.locked=!x.locked})},
  shareConvite:()=>shareDlg('Convite da rodada',txtConvite(curRodada())),
  copyLink:()=>copyText(linkRodada(curRodada().id)),
  shareTimes:()=>shareDlg('Times sorteados',txtTimes(curRodada())),
  mark:el=>{const r=curRodada(),id=el.dataset.p,v=el.dataset.v,cur=S.pres[id];
    if(r.locked)return;
    if(r.times&&!confirm(tx('lista.confirmaMudar',{nome:pname(id)})))return;
    if(cur&&cur.s===v){if(isAvulso(id))setPres(r.id,id,Object.assign({},cur,{s:v==='in'?'out':'in'}));else{delete S.pres[id];changed();w(GB.del('rodadas/'+r.id+'/presencas/'+id))}}
    else setPres(r.id,id,Object.assign({},cur||{},{s:v}))},
  addAvulso:el=>{const t=el&&el.dataset?el.dataset.t:null;S.alvoTime=t!=null&&t!==''?+t:null;const r=curRodada(),regs=Object.entries(S.avul||{}).filter(([id])=>!S.jog[id]&&S.pres[id]?.s!=='in').sort((a,b)=>(a[1].nome||'').localeCompare(b[1].nome||'',LOCAL));
    openDlg(`<h3>Adicionar avulso</h3>${regs.length?`<div class="f"><span class="lbl">Já jogou aqui? Escolha o nome</span>${regs.length>8?'<input class="inp" id="avq" placeholder="Buscar nome" style="margin-bottom:8px">':''}
      <div class="vgrid" id="avlist">${regs.map(([id,a])=>`<button class="opt" data-a="pickAvulso" data-p="${id}" data-n="${esc(normName(a.nome))}">${posTag(id)}<span>${esc(a.nome)}</span><span class="tag" style="margin-left:auto">${fmtL(lvl(id))}</span></button>`).join('')}</div></div>
      <p class="small muted" style="margin:4px 0 10px">Ou cadastre um avulso novo:</p>`:''}
    <label class="f"><span>Nome</span><input class="inp" id="anm" maxlength="40"></label>${posField('apos')}<div class="f"><span class="lbl">Nota de 1 a 10</span>${lvlIn(5)}</div>
    <label class="f"><span>Telefone / WhatsApp (opcional)</span><input class="inp" id="ptel" type="tel" inputmode="tel" maxlength="20"></label>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveAvulso">Adicionar confirmado</button></div>`)},
  pickAvulso:el=>{const id=el.dataset.p,a=S.avul[id];closeDlg();const ps=[setPres(curRodada().id,id,{s:'in',nome:a.nome,avulso:true,pos:a.pos||''})];
    if(S.alvoTime!=null)ps.push(porNoTime(S.alvoTime,id));else toast(a.nome+' confirmado.');S.alvoTime=null;return Promise.all(ps)},
  saveAvulso:()=>{const n=val('anm');if(n.length<2){toast('Digite o nome.');return}
    const same=Object.entries(S.avul||{}).find(([,a])=>normName(a.nome)===normName(n));if(same&&confirm(n+' já jogou aqui antes. Usar o cadastro dele?'))return ACT.pickAvulso({dataset:{p:same[0]}});
    const id=B.newId(),v=+$('#plv').value,pos=val('apos'),o={nome:n,pos,criado:Date.now()};S.avul[id]=o;
    const ps=[setPres(curRodada().id,id,{s:'in',nome:n,avulso:true,pos}),w(GB.set('avulsos/'+id,o)),editRat(a=>setLvl(a,id,v))];if(S.alvoTime!=null){ps.push(porNoTime(S.alvoTime,id));S.alvoTime=null}const c=saveContato(id,val('ptel'),'');if(c)ps.push(c);closeDlg();return Promise.all(ps)},
  editAvulso:el=>{const id=el.dataset.p,a=S.avul[id]||{nome:pname(id),pos:ppos(id)},ct=(S.cont||{})[id]||{};
    openDlg(`<h3>Avulso: ${esc(a.nome)}</h3><label class="f"><span>Nome</span><input class="inp" id="anm" maxlength="40" value="${esc(a.nome)}"></label>${posField('apos',a.pos)}
    <div class="f"><span class="lbl">Nota de 1 a 10 (só administradores veem)</span>${lvlIn(lvl(id))}</div>
    <label class="f"><span>Telefone / WhatsApp</span><input class="inp" id="ptel" type="tel" inputmode="tel" maxlength="20" value="${esc(ct.tel||'')}"></label>
    <p class="small muted" style="margin-top:-4px">Registrado em ${fdia(a.criado)}</p>
    <div class="dlg-f"><button class="btn ghost danger" data-a="delAvulso" data-p="${id}">Esquecer avulso</button><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveAvEdit" data-p="${id}">Salvar</button></div>`)},
  saveAvEdit:el=>{const id=el.dataset.p,n=val('anm');if(n.length<2){toast('Digite o nome.');return}const o=Object.assign({criado:Date.now()},S.avul[id]||{},{nome:n,pos:val('apos')||''});S.avul[id]=o;changed();
    const ps=[w(GB.set('avulsos/'+id,o)),editRat(a=>setLvl(a,id,+$('#plv').value))];const c=saveContato(id,val('ptel'),'');if(c)ps.push(c);closeDlg();toast('Avulso atualizado.');return Promise.all(ps)},
  delAvulso:el=>{const id=el.dataset.p;if(!confirm('Esquecer este avulso? Ele some da lista de "já jogaram aqui". O histórico de partidas continua.'))return;delete S.avul[id];changed();closeDlg();return w(GB.del('avulsos/'+id))},
  promote:el=>{const id=el.dataset.p,p=S.avul?.[id]||{nome:S.pres[id]?.nome,pos:S.pres[id]?.pos};playerDlg(null,{id,name:p?.nome,pos:p?.pos,tipo:'diarista'});$('[data-a=savePlayer]').dataset.p='';$('[data-a=savePlayer]').dataset.new=id},
  drawDlg:()=>{const a=attendance(),T=porTime(),fora=new Set(cfg().foraPos||[]),k=a.inn.length,dentro=a.inn.filter(id=>!(hasPos()&&fora.has(ppos(id)))).length,
      n=sport().pairs?Math.max(1,Math.floor(dentro/2)):sugerirTimes(dentro,T);
    openDlg(`<div id="drawBox" data-n="${n}" data-nov="${cfg().novelty}" data-fora="${esc([...fora].join(','))}"><h3>${sport().pairs?'Sortear duplas':'Sortear times'}</h3>
    <p class="small muted" style="margin-top:-6px">${sport().pairs?tx('sorteio.infoDuplas'):tx('sorteio.info',{n:T})}</p>
    <div class="f" ${sport().pairs?'hidden':''}><span class="lbl">Quantos times</span><span class="seg">${[2,3,4,5,6,7,8].filter(x=>x*2<=k).map(x=>`<button data-a="dN" data-v="${x}">${x}</button>`).join('')}</span></div>
    ${hasPos()?`<div class="f" style="margin-top:12px"><span class="lbl">${tx('sorteio.foraPos')}</span><span class="seg seg-wrap">${posKeys().map(p=>`<button data-a="dFora" data-v="${esc(p)}" aria-pressed="${fora.has(p)}" title="${esc(posLabel(p))}">${esc(p)}</button>`).join('')}</span>
      <p class="small muted" style="margin:6px 0 0">${tx('sorteio.foraPosAjuda')}</p></div>`:''}
    <p id="drawPrev" style="font-weight:600"></p>
    <div class="f"><span class="lbl">Variar parceiros (com base no histórico)</span><span class="seg">${['Não','Pouco','Médio','Muito'].map((l,i)=>`<button data-a="dNov" data-v="${i}">${l}</button>`).join('')}</span></div>
    <details><summary>Quem entra no sorteio (<span id="drawK">${dentro}</span> de ${k})</summary><div class="chk">${a.inn.map(id=>`<label><input type="checkbox" class="dp" value="${id}" data-pos="${esc(ppos(id)||'')}" ${hasPos()&&fora.has(ppos(id))?'':'checked'}>${esc(pname(id))}${hasPos()&&ppos(id)?` <span class="tag">· ${esc(ppos(id))}</span>`:''}</label>`).join('')}</div></details>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn bib" id="drawGo" data-a="doDraw">Sortear</button></div></div>`);drawPreview()},
  /* Deixar uma posição inteira fora do sorteio (ex.: goleiros fixos). A escolha fica salva no grupo ao sortear. */
  dFora:el=>{const box=$('#drawBox'),p=el.dataset.v,f=new Set((box.dataset.fora||'').split(',').filter(Boolean)),on=!f.has(p);on?f.add(p):f.delete(p);box.dataset.fora=[...f].join(',');
    el.setAttribute('aria-pressed',on);box.querySelectorAll('.dp').forEach(c=>{if(c.dataset.pos===p)c.checked=!on});
    if(!sport().pairs){const k=box.querySelectorAll('.dp:checked').length;box.dataset.n=sugerirTimes(k,porTime())}drawPreview()},
  dN:el=>{$('#drawBox').dataset.n=el.dataset.v;drawPreview()},
  dNov:el=>{$('#drawBox').dataset.nov=el.dataset.v;drawPreview()},
  doDraw:()=>{const box=$('#drawBox'),n=+box.dataset.n,nov=+box.dataset.nov,fora=(box.dataset.fora||'').split(',').filter(Boolean),ids=[...box.querySelectorAll('.dp:checked')].map(x=>x.value);if(ids.length<n*2)return;
    return sleep(40).then(()=>{const cap=[];cap.close=false;setCAP(cap);try{ACT._draw(ids,n,nov,fora)}finally{setCAP(null)}return Promise.allSettled(cap).then(()=>closeDlgNow())})},
  _draw:(ids,n,nov,fora)=>{
    const r=curRodada(),T=draw(ids,n,nov,r.id),PT=porTime(),quando=id=>(S.pres[id]||{}).t||0;
    editRod(r.id,x=>{const old=x.times||[];x.times=T.map((p,i)=>{const t={c:old[i]?.c??i,players:p},rs=reservas(p,PT,quando);if(rs.length)t.res=rs;return t});x.info={};ids.forEach(id=>x.info[id]={n:pname(id),p:ppos(id)});x.drawnAt=Date.now();
      /* pelada-v15: sortear fecha a lista e guarda a foto dos confirmados, para avisar se a lista mudar depois. */
      x.locked=true;x.base=attendance().inn});
    if(nov!==cfg().novelty||(fora&&fora.join()!==(cfg().foraPos||[]).join()))editApp(a=>{a.cfg.novelty=nov;if(fora)a.cfg.foraPos=fora});S.live=null;closeDlg();toast(tx('lista.sorteadoFechada'))},
  color:el=>{const ti=+el.dataset.v;editRod(curRodada().id,x=>{const used=x.times.map(t=>t.c);let c=x.times[ti].c;for(let k=0;k<COL.length;k++){c=(c+1)%COL.length;if(!used.includes(c))break}x.times[ti].c=c})},
  move:el=>{const r=curRodada(),f=+el.dataset.v,pid=el.dataset.p;openDlg(`<h3>Mover ${esc(pname(pid))}</h3><div class="vgrid">${r.times.map((t,i)=>i===f?'':`<button class="opt" data-a="doMove" data-v="${i}" data-f="${f}" data-p="${pid}"><span class="dot" style="background:${col(t.c).c}"></span>${tn(t.c)}</button>`).join('')}</div>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn" data-a="toggleRes" data-v="${f}" data-p="${pid}">${(r.times[f].res||[]).includes(pid)?tx('times.marcarTitular'):tx('times.marcarReserva')}</button></div>`)},
  toggleRes:el=>{const f=+el.dataset.v,pid=el.dataset.p;closeDlg();return editRod(curRodada().id,x=>{const t=x.times[f],r=t.res||[];t.res=r.includes(pid)?r.filter(p=>p!==pid):r.concat(pid);if(!t.res.length)delete t.res})},
  doMove:el=>{const to=+el.dataset.v,f=+el.dataset.f,pid=el.dataset.p;editRod(curRodada().id,x=>{x.times[f].players=x.times[f].players.filter(p=>p!==pid);if(x.times[f].res){x.times[f].res=x.times[f].res.filter(p=>p!==pid);if(!x.times[f].res.length)delete x.times[f].res}x.times[to].players.push(pid)});closeDlg()},
  /* Mostrar/ocultar a senha enquanto digita (pelada-v17). */
  verSenha:el=>{const i=$('#'+el.dataset.v);if(!i)return;const on=i.type==='password';i.type=on?'text':'password';el.setAttribute('aria-pressed',String(on));
    el.textContent=tx(on?'login.ocultar':'login.mostrar');el.setAttribute('aria-label',tx(on?'login.ocultarSenha':'login.mostrarSenha'));i.focus()},
  /* ---- lista × times (pelada-v15) ---- */
  divTirar:el=>{const pid=el.dataset.p;toast(tx('div.tirado',{nome:pname(pid)}));return editRod(curRodada().id,x=>{x.times.forEach(t=>{t.players=t.players.filter(p=>p!==pid);if(t.res)t.res=t.res.filter(p=>p!==pid)})})},
  divPor:el=>escolherTime(el.dataset.p),
  divManter:()=>{toast(tx('div.mantidos'));return editRod(curRodada().id,x=>{x.base=attendance().inn})},
  porTime:el=>{const r=curRodada(),ti=+el.dataset.v,t=r.times[ti],a=attendance();
    const conf=foraDosTimes(r,a.inn),outros=foraDosTimes(r,players().map(p=>p.id)).filter(id=>!conf.includes(id));
    const opc=id=>`<button class="opt" data-a="doPorTime" data-v="${ti}" data-p="${id}">${posTag(id)}<span>${esc(pname(id))}</span></button>`;
    openDlg(`<h3><span class="dot" style="background:${col(t.c).c}"></span> ${esc(tx('porTime.titulo',{time:tn(t.c)}))}</h3><p class="small muted">${tx('porTime.ajuda')}</p>
    ${conf.length?`<div class="f"><span class="lbl">${tx('porTime.confirmados')}</span><div class="vgrid">${conf.map(opc).join('')}</div></div>`:''}
    ${outros.length?`<div class="f"><span class="lbl">${tx('porTime.outros')}</span><div class="vgrid">${outros.map(opc).join('')}</div></div>`:(conf.length?'':`<p class="muted small">${tx('porTime.ninguem')}</p>`)}
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn" data-a="addAvulso" data-t="${ti}">${tx('porTime.avulso')}</button></div>`)},
  doPorTime:el=>{const ti=+el.dataset.v,pid=el.dataset.p,r=curRodada(),cur=S.pres[pid];closeDlg();
    const ps=[];if(!cur||cur.s!=='in')ps.push(setPres(r.id,pid,Object.assign({},cur||{},{s:'in'})));ps.push(porNoTime(ti,pid));return Promise.all(ps)},
  addPlayer:()=>playerDlg(null),editPlayer:el=>playerDlg(el.dataset.p),
  star:()=>{},
  waLink:()=>{},
  savePlayer:el=>{const name=val('pnm');if(name.length<2){toast('Digite o nome.');return}const nw=el.dataset.new,id=el.dataset.p||nw||B.newId(),v=+$('#plv').value;
    if(Object.entries(S.jog).some(([k,x])=>k!==id&&normName(x.name)===normName(name))&&!confirm('Já existe um jogador chamado "'+name+'". Cadastrar mesmo assim?'))return;
    const old=S.jog[id]||{},tp=val('ptp'),data=Object.assign({},old,{name,pos:val('ppos'),ativo:old.ativo!==false,criado:old.criado||(nw&&S.avul[nw]?.criado)||Date.now()});delete data.tipo;
    S.jog[id]=data;changed();w(GB.set('jogadores/'+id,clean(data)));if(ptipo(id)!==tp||!((S.pc||{}).tipos||{})[id])editPc(a=>{a.tipos[id]=tp});editRat(a=>setLvl(a,id,v));saveContato(id,val('ptel'),val('pmail'));
    if(nw&&S.avul[nw]){delete S.avul[nw];w(GB.del('avulsos/'+nw))}closeDlg();toast('Jogador salvo.')},
  toggleJog:el=>{const id=el.dataset.p,o=Object.assign({},S.jog[id]),on=o.ativo===false;if(!on&&!confirm('Inativar '+o.name+'? Ele sai das listas de presença, mas o histórico continua.'))return;
    o.ativo=on;if(on)delete o.inativadoEm;else o.inativadoEm=Date.now();S.jog[id]=o;changed();closeDlg();toast(on?'Jogador reativado.':'Jogador inativado.');return w(GB.set('jogadores/'+id,clean(o)))},
  delPlayer:el=>{const id=el.dataset.p;if(!confirm('Excluir '+pname(id)+' definitivamente? Para manter o histórico, prefira Inativar.'))return;delete S.jog[id];w(GB.del('jogadores/'+id));editRat(a=>{delete a.stars[id];a.sep=a.sep.filter(s=>!s.includes(id))});if(((S.pc||{}).tipos||{})[id])editPc(a=>{delete a.tipos[id]});closeDlg()},
  addSep:()=>{const o=players().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');openDlg(`<h3>Não colocar no mesmo time</h3><label class="f"><span>Jogador</span><select class="sel" id="sa">${o}</select></label><label class="f"><span>e</span><select class="sel" id="sb">${o}</select></label><div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveSep">Adicionar par</button></div>`)},
  saveSep:()=>{const a=val('sa'),b=val('sb');if(a===b){toast('Escolha duas pessoas diferentes.');return}editRat(x=>{if(!x.sep.some(s=>key(s[0],s[1])===key(a,b)))x.sep.push([a,b])});closeDlg()},
  delSep:el=>editRat(x=>{x.sep.splice(+el.dataset.v,1)}),
  settings:()=>{const c=cfg();openDlg(`<h3>Partidas e caixa</h3>
    <div class="row"><label class="f" style="flex:1"><span>Mensalidade (R$)</span><input class="inp" type="number" min="0" id="cm" value="${c.mensal}"></label><label class="f" style="flex:1"><span>Diária (R$)</span><input class="inp" type="number" min="0" id="cd" value="${c.diaria}"></label></div>
    <div class="row"><label class="f" style="flex:1"><span>Minutos por partida</span><input class="inp" type="number" min="1" id="cmin" value="${c.minutes}"></label><label class="f" style="flex:1"><span>Chave Pix</span><input class="inp" id="cpx" value="${esc(c.pix)}"></label></div>
    <p class="small muted" style="margin-top:-4px">Valores e chave Pix só aparecem para administradores.</p>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveSettings">Salvar</button></div>`)},
  saveSettings:()=>{const m=+val('cm')||0,d=+val('cd')||0,px=val('cpx'),mn=+val('cmin')||10;const ps=[editPc(a=>{Object.assign(a,{mensal:m,diaria:d,pix:px})})];
    if(cfg().minutes!==mn||CAIXA_K.some(k=>k in((S.app||{}).cfg||{})))ps.push(editApp(a=>{a.cfg.minutes=mn;CAIXA_K.forEach(k=>delete a.cfg[k])}));closeDlg();toast('Configurações salvas.');return Promise.all(ps)},
  seed:()=>{const ns=[['Bruno','GOL',4],['Tiago','GOL',3],['Rafa','DEF',4],['Léo','DEF',3],['Marcão','DEF',2],['Dudu','DEF',3],['Gui','MEI',5],['Fernandinho','MEI',4],['Caio','MEI',3],['Pedrinho','MEI',2],['Japa','ATA',5],['Neto','ATA',4],['Vini','ATA',3],['Alemão','ATA',2]];
    const ids=ns.map(()=>B.newId()),K=posKeys(),map={GOL:0,DEF:1,MEI:2,ATA:3};ns.forEach(([n,p],i)=>{const d={criado:Date.now(),name:n,pos:K.length?(K[Math.min(K.length-1,map[p])]||K[i%K.length]):'',ativo:true};S.jog[ids[i]]=d;w(GB.set('jogadores/'+ids[i],d))});
    editPc(a=>{ids.forEach((id,i)=>{a.tipos[id]=i%4===3?'diarista':'mensalista'})});
    editRat(a=>{ids.forEach((id,i)=>setLvl(a,id,ns[i][2]*2-(i%3===0?0.5:0)));a.sep.push([ids[6],ids[10]])});toast('Elenco de exemplo carregado.')},
  goal:el=>{const r=curRodada(),L=S.live,t=el.dataset.v,ti=t==='a'?L.a:L.b,oi=t==='a'?L.b:L.a,SP=sport(),sc=SP.score[+el.dataset.i||0],pts=sc[1];
    openDlg(`<h3>${esc(sc[0].replace('+',''))}${pts>1&&!/\d/.test(sc[0])?' (+'+pts+')':''} — ${tn(r.times[ti].c)}</h3><p class="small muted">Quem marcou?</p><div class="vgrid">${r.times[ti].players.map(id=>`<button class="opt" data-a="addGoal" data-v="${t}" data-p="${id}" data-pts="${pts}">${esc(pname(id))}</button>`).join('')}</div>
    ${SP.og?`<p class="small muted" style="margin-top:14px">Contra (jogador do adversário)</p><div class="vgrid">${r.times[oi].players.map(id=>`<button class="opt" data-a="addGoal" data-v="${t}" data-p="${id}" data-og="1" data-pts="${pts}">${esc(pname(id))}</button>`).join('')}</div>`:''}
    <div class="dlg-f"><button class="btn" data-a="addGoal" data-v="${t}" data-pts="${pts}">Sem autor</button><button class="btn" data-a="close">Cancelar</button></div>`)},
  addGoal:el=>{S.live.goals.push({t:el.dataset.v,pid:el.dataset.p||null,og:!!el.dataset.og,pts:+el.dataset.pts||1});closeDlg();render()},
  undoGoal:()=>{S.live.goals.pop();render()},
  clock:()=>{const L=S.live;try{if(!actx)setActx(new(window.AudioContext||window.webkitAudioContext)());if(actx.state==='suspended')actx.resume()}catch(e){}
    if(L.run){L.el=elapsed();L.run=false}else{L.st=Date.now();L.run=true}$('#clockBtn').textContent=L.run?'Pausar':'Iniciar'},
  clockReset:()=>{Object.assign(S.live,{el:0,run:false,beeped:false});render()},
  saveMatch:()=>{const r=curRodada(),L=S.live,ta=r.times[L.a],tb=r.times[L.b],ga=sumPts(L.goals,'a'),gb=sumPts(L.goals,'b');
    addMatch(r.id,{id:uid(),ca:ta.c,cb:tb.c,pa:ta.players.slice(),pb:tb.players.slice(),ga,gb,goals:L.goals.map(g=>({t:g.t,pid:g.pid,og:g.og,pts:g.pts||1})),at:Date.now()});
    let na=L.a,nb=L.b;if(r.times.length>2){const win=ga>gb?L.a:gb>ga?L.b:L.a,out=win===L.a?L.b:L.a,next=[...Array(r.times.length).keys()].filter(i=>i!==L.a&&i!==L.b);na=win;nb=next.concat(out)[0]}
    S.live={rid:r.id,a:na,b:nb,goals:[],dur:L.dur,el:0,run:false,st:0,beeped:false};toast(`Salvo: ${tn(ta.c)} ${ga} × ${gb} ${tn(tb.c)}`)},
  delMatch:el=>{if(confirm('Apagar esta partida?'))return apagarPartida(curRodada().id,el.dataset.v)},
  /* Recalcular os totais (KAN-87): ranking (ano, mês ou tudo) ou caixa (mês). */
  recalc:el=>{const p=el.dataset.v;if(!confirm(tx('resumo.confirmaRecalcular')))return;return recalcular(p).catch(e=>{console.warn(e);toast(tx('resumo.erroRecalcular'))})},
  addLan:()=>{const o=players().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');openDlg(`<h3>Novo lançamento</h3>
    <label class="f"><span>Tipo</span><select class="sel" id="lk"><option value="mensal">Mensalidade</option><option value="diaria">Diária</option><option value="entrada">Outra entrada</option><option value="despesa">Despesa (quadra, bola, coletes…)</option></select></label>
    <label class="f"><span>Jogador (opcional para despesa)</span><select class="sel" id="lp2"><option value="">—</option>${o}</select></label>
    <div class="row"><label class="f" style="flex:1"><span>Valor (R$)</span><input class="inp" type="number" min="0" step="0.01" id="lv" value="${cfg().mensal}"></label><label class="f" style="flex:1"><span>Data</span><input class="inp" type="date" id="ld" value="${today()}"></label></div>
    <label class="f"><span>Descrição</span><input class="inp" id="ln" maxlength="60"></label>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveLan">Lançar</button></div>`)},
  saveLan:()=>{const k=val('lk'),v=+val('lv');if(!(v>0)){toast('Informe um valor.');return}if((k==='mensal'||k==='diaria')&&!val('lp2')){toast('Escolha o jogador.');return}
    const d=val('ld')||today();let ref=d.slice(0,7);if(k==='diaria'){const r=rodadas().find(r=>r.date===d);ref=r?r.id:d}
    const id=B.newId(),o={k,pid:val('lp2')||null,v,d,ref,note:val('ln')};closeDlg();toast('Lançamento salvo.');return salvarLanc(id,o)},
  payPend:el=>{const p=pendencias(S.month)[+el.dataset.v];if(!p)return;const id=B.newId(),o={k:p.k,pid:p.pid,v:p.v,d:today(),ref:p.ref,note:''};return salvarLanc(id,o)},
  delLan:el=>{if(confirm('Apagar este lançamento?'))return apagarLanc(el.dataset.v)},
  shareCob:()=>{const by={};pendencias(S.month).forEach(x=>(by[x.pid]=by[x.pid]||[]).push(x));
    let t=`💰 *${gname()} — pendências de ${fmonth(S.month).toLowerCase()}*\n\n`+Object.entries(by).map(([pid,xs])=>`• ${pname(pid)}: ${brl(xs.reduce((s,x)=>s+x.v,0))} (${xs.map(x=>x.label).join(', ')})`).join('\n');
    if(cfg().pix)t+=`\n\nPix: ${cfg().pix}`;shareDlg('Cobrança',t)},
  newVote:()=>{const rs=rodadas().filter(r=>r.times);if(!rs.length)return;openDlg(`<h3>Nova votação</h3>
    <label class="f"><span>Rodada</span><select class="sel" id="vr">${rs.map(r=>`<option value="${r.id}">${fdate(r.date)}${r.place?' — '+esc(r.place):''}</option>`).join('')}</select></label>
    <label class="f"><span>Título</span><input class="inp" id="vt" value="Craque da rodada" maxlength="50"></label>
    <div class="f"><span class="lbl">O que votar</span>${[['best','Melhor jogador'],...(sport().key?[['gk','Melhor '+posLabel(sport().key).toLowerCase()]]:[]),...(hasPos()?[['pos','Melhor de cada posição']]:[]),['worst','Pior jogador (bagre)']].map(([k,l],i)=>`<label class="row small" style="margin-bottom:6px"><input type="checkbox" class="vc" value="${k}" ${i===0?'checked':''}> ${l}</label>`).join('')}
    <input class="inp" id="vx" placeholder="Outra categoria (opcional), ex.: Gol mais bonito" maxlength="40"></div>
    <label class="row small" style="margin-bottom:12px"><input type="checkbox" id="vsf"> Pode votar em si mesmo</label>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveVote">Abrir votação</button></div>`)},
  saveVote:()=>{const sel=[...dlg.querySelectorAll('.vc:checked')].map(x=>x.value),cats=[];
    if(sel.includes('best'))cats.push({id:'best',name:'Melhor jogador',pos:null,neg:false});
    if(sel.includes('gk')&&!sel.includes('pos')&&sport().key)cats.push({id:'gk',name:'Melhor '+posLabel(sport().key).toLowerCase(),pos:sport().key,neg:false});
    if(sel.includes('pos'))sport().pos.forEach(([k,l])=>cats.push({id:'p'+k,name:'Melhor — '+l.toLowerCase(),pos:k,neg:false}));
    if(val('vx'))cats.push({id:'x'+uid(),name:val('vx'),pos:null,neg:false});
    if(sel.includes('worst'))cats.push({id:'worst',name:'Bagre da rodada',pos:null,neg:true});
    if(!cats.length){toast('Escolha ao menos uma categoria.');return}
    const id=B.newId(),o={rid:val('vr'),rdate:(rodById(val('vr'))||{}).date||'',title:val('vt')||'Votação',cats,open:true,selfVote:$('#vsf').checked,createdAt:Date.now()};S.vot[id]=o;S.vid=id;changed();w(GB.set('votacoes/'+id,o));/* A janela troca para o link da votação; não fecha ao terminar de salvar. */shareDlg('Link da votação',`🗳️ *${o.title}*\nVote aqui: ${linkVoto(id)}`)},
  toggleVote:()=>{const antes=S.vot[S.vid],v=cl(antes);if(v.open){v.open=false;v.resultado=tally(v,S.votos)}else v.open=true;S.vot[S.vid]=v;return gravarVotacao(S.vid,antes,v)},
  delVote:()=>{if(!confirm('Excluir esta votação?'))return;const vid=S.vid,antes=S.vot[vid];Object.keys(S.votos).forEach(u=>GB.del('votacoes/'+vid+'/votos/'+u));delete S.vot[vid];S.vid=null;return gravarVotacao(vid,antes,null)},
  shareVote:()=>{const v=S.vot[S.vid];let t=`🗳️ *${v.title}*\n`;if(v.open)t+=`Vote aqui: ${linkVoto(S.vid)}`;else t+='\n'+v.cats.map(c=>`🏅 ${c.name}: ${(v.resultado?.[c.id]?.winners||[]).map(pname).join(' e ')||'sem votos'}`).join('\n');shareDlg('Votação',t)},
  /* histórico (KAN-85) */
  histModo:el=>{estadoHist().modo=el.dataset.v;render()},
  histBuscar:()=>buscarHist(false),
  histMais:()=>buscarHist(true),
  histAbrir:el=>abrirHist(el.dataset.v),
  histVoltar:()=>{estadoHist().sel=null;render()},
  /* público */
  pubMark:el=>{const r=rodById(S.route.id);if(!r||r.locked)return;const id=el.dataset.p,cur=S.pres[id]||{};
    if(!S.user){semConexao();return}
    try{localStorage.setItem(MEK,id)}catch(e){}setPres(S.route.id,id,Object.assign(isAvulso(id)?{nome:cur.nome,avulso:true,pos:cur.pos}:{},{s:el.dataset.v})).then(()=>{changed();toast(el.dataset.v==='in'?'Presença confirmada: '+pname(id):'Ok, '+pname(id)+' não vai.')}).catch(()=>{})},
  pubAdd:()=>openDlg(`<h3>Adicionar meu nome</h3><label class="f"><span>Nome ou apelido</span><input class="inp" id="anm" maxlength="40" autocomplete="off"></label>
    <div id="avsug"></div><div id="avnew">${posField('apos')}</div>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="pubSaveAdd">Confirmar presença</button></div>`),
  pubPick:el=>{const id=el.dataset.p,a=S.avul[id];if(!S.user){semConexao();return}closeDlg();try{localStorage.setItem(MEK,id)}catch(e){}
    return setPres(S.route.id,id,{s:'in',nome:a.nome,avulso:true,pos:a.pos||''}).then(()=>{changed();toast('Presença confirmada: '+a.nome)}).catch(()=>{})},
  pubSaveAdd:()=>{const n=val('anm');if(n.length<2){toast('Digite seu nome.');return}if(!S.user){semConexao();return}
    const el=players().find(p=>normName(p.name)===normName(n));if(el){closeDlg();toast('Seu nome já está na lista: toque em Vou ao lado de '+el.name+'.');return}
    const same=Object.entries(S.avul||{}).find(([,a])=>normName(a.nome)===normName(n));if(same)return ACT.pubPick({dataset:{p:same[0]}});
    const id=B.newId(),pos=val('apos');closeDlg();try{localStorage.setItem(MEK,id)}catch(e){}return setPres(S.route.id,id,{s:'in',nome:n,avulso:true,pos}).then(()=>{changed();toast('Presença confirmada: '+n)}).catch(()=>{})},
  pubVote:el=>{const me=S.myVote?.pid||myLocal();if(!me||!S.user)return;const d=cl(S.myVote)||{v:{}};d.pid=me;d.v=d.v||{};d.v[el.dataset.c2]=el.dataset.p;d.t=Date.now();S.myVote=d;changed();
    w(GB.set('votacoes/'+S.route.id+'/votos/'+S.user.uid,d))},
};

export { ACT };
