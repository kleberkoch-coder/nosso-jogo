/* Ações: Grupos: criar, editar, duplicar, posições, convites e administradores. Fazem parte de ACT (src/acoes.js). */
import { abrirHist, buscarHist, estadoHist } from '../telas/historico.js';
import { CAIXA_K, cfg, editPc, ptipo } from '../dominio/caixa.js';
import { APP, COL, SPORTS, col, hasPos, porTime, porTimePadrao, posKeys, posLabel, posTag, sport, tn } from '../dominio/esportes.js';
import { attendance, curRodada, dupName, fdia, fixos, fmtL, freq, gname, grpAtivo, isAvulso, lvl, lvlIn, normName, players, pname, ppos, rodById, rodadas, setLvl } from '../dominio/grupo.js';
import { draw } from '../dominio/sorteio.js';
import { foraDosTimes, fotoDoSorteio } from '../dominio/divergencia.ts';
import { reservas, sugerirTimes, titulares } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { shareDlg, txtConvite, txtTimes } from '../dominio/whatsapp.js';
import { copyText, semConexao } from '../eventos.js';
import { B, op, setCAP, sleep } from '../nucleo/backend.js';
import { avulsosEsgotados, gruposEsgotados, limite } from '../dominio/limites.ts';
import { editApp, editRat, editRod, saveContato, setPres } from '../nucleo/edicoes.js';
import { addMatch, apagarLanc, apagarPartidasDaRodada, delMatch as apagarPartida, gravarVotacao, recalcular, salvarLanc } from '../nucleo/partidas.js';
import { GB, S, clean, w } from '../nucleo/estado.js';
import { linkConvite, linkProxima, linkRodada, linkVoto } from '../nucleo/links.js';
import { $, DIAS, brl, cl, esc, fdate, fmonth, inAppBrowser, key, toast, toastAcao, today, uid, usarAvisoAcao } from '../nucleo/util.js';
import { upMyGroup } from '../rotas.js';
import { pendencias } from '../telas/Caixa.tsx';
import { groupForm, porTimeAjuda, readGroupForm, schedRow } from '../telas/grupo-form.js';
import { AUTH_CANCEL, authMsg, pwFalta, pwOk } from '../telas/login.js';
import { actx, elapsed, setActx, sumPts } from '../telas/partida.js';
import { MEK, myLocal } from '../telas/publico-rodada.js';
import { tally } from '../telas/votacao.js';
import { avisar, closeDlg, closeDlgNow, confirmou, dlg, drawPreview, naoConfirmar, openDlg, playerDlg, posField, responder, rodDlg, val } from '../ui/dialogos.js';
import { changed, render } from '../ui/render.js';
import { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeMenuEl } from '../ui/tema.js';
import { LOCAL } from '../i18n/formatos.js';
import { ACT } from '../acoes.js';

/* Limite de grupos por conta (KAN-89): confere antes de criar. Sem sinal, deixa a decisão para o Firebase. */
async function limiteGrupos(){try{const [c,f]=await Promise.all([B.get('contas/'+S.user.uid),B.get('sistema/limites')]);
  return{cheio:gruposEsgotados(c,f),n:limite(f,'gruposPorConta')}}catch(e){return{cheio:false,n:limite(null,'gruposPorConta')}}}
/* Mostra a mensagem no formulário, rolando até ela (o botão Criar fica no fim do formulário). */
function avisoGrupos(sel,n){const m=tp('limite.grupos',n),e=$(sel);if(e){e.textContent=m;e.scrollIntoView({block:'center'})}else toast(m)}
/* Cria o documento do grupo junto com +1 no contador da conta: ou entram os dois, ou nenhum. */
const gravarGrupo=(gid,o)=>B.lote([{tipo:'set',p:'grupos/'+gid,o},{tipo:'patch',p:'contas/'+S.user.uid,o:{ng:op.somar(1),ult:gid}}]);
const acoes={
  newGroup:()=>{openDlg(`<h3>Novo grupo</h3>${groupForm({},false)}<div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="createGroup">Criar grupo</button></div>`);setTimeout(()=>$('#ngn')?.focus(),50)},
  editGroup:()=>{openDlg(`<h3>Editar grupo</h3><p class="small muted" style="margin-top:-6px">Criado em ${fdia(S.app.createdAt)}</p>${groupForm(S.app,true)}<div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveGroup">Salvar</button></div>`)},
  pickFreq:el=>{const box=$('#ngBox');box.dataset.freq=el.dataset.v;box.querySelectorAll('[data-a=pickFreq]').forEach(b=>b.setAttribute('aria-pressed',b===el));$('#schedW').hidden=el.dataset.v!=='fixo';
    $('#fqHelp').textContent=el.dataset.v==='fixo'?'Dias e horários fixos toda semana. A próxima rodada se cria sozinha e o link de confirmação é sempre o mesmo.':'Só rola de vez em quando. Você cria cada rodada quando marcar o jogo.'},
  addSched:()=>{const rows=[...document.querySelectorAll('#sched .srow')],last=rows[rows.length-1];const x=last?{dow:(+last.querySelector('.sd').value+2)%7,ini:last.querySelector('.si').value,fim:last.querySelector('.sf').value,place:last.querySelector('.sl').value}:null;
    $('#sched').insertAdjacentHTML('beforeend',schedRow(x));const n=$('#sched').lastElementChild.querySelector('.sd');n&&n.focus()},
  rmSched:el=>{const rows=document.querySelectorAll('#sched .srow');if(rows.length<=1){toast('Deixe pelo menos um dia, ou marque o grupo como esporádico.');return}el.closest('.srow').remove()},
  saveGroup:el=>{const g=readGroupForm(S.gid);if(!g)return;const wasFix=fixos().map(x=>x.dow+'|'+x.ini).join(),willFix=g.fixos.map(x=>x.dow+'|'+x.ini).join();
    if(wasFix&&wasFix!==willFix&&confirmou(el,{titulo:'Mudar os dias fixos?',texto:'A confirmação da próxima rodada fixa começa do zero.',acao:'Mudar dias'})!=='sim')return;
    const p=editApp(a=>{a.name=g.name;a.sport=g.sport;a.sportName=g.sportName;a.freq=g.freq;a.cfg.fixos=g.fixos;a.cfg.porTime=g.porTime;if(g.fixos[0]&&g.fixos[0].place)a.cfg.place=g.fixos[0].place});
    upMyGroup(S.gid,{name:g.name,sport:g.sport,sportName:g.sportName});S.rid=null;closeDlg();toast('Grupo atualizado.');return p},
  addPos:()=>openDlg(`<h3>Nova posição</h3><div class="row"><label class="f" style="width:110px"><span>Sigla</span><input class="inp" id="psg" maxlength="4" placeholder="Ex.: VOL" style="text-transform:uppercase"></label>
    <label class="f" style="flex:1"><span>Nome</span><input class="inp" id="pnmx" maxlength="24" placeholder="Ex.: Volante"></label></div><p class="small muted" style="margin-top:-6px">A sigla aparece nas listas e nos times (até 4 letras).</p>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="savePos">Adicionar</button></div>`),
  savePos:()=>{const k=val('psg').toUpperCase().replace(/[^A-Z0-9]/g,''),l=val('pnmx');if(k.length<2){toast('A sigla precisa de 2 a 4 letras.');return}if(l.length<2){toast('Dê um nome à posição.');return}
    if(sport().pos.some(([x,y])=>x===k||normName(y)===normName(l))){toast('Essa posição já existe.');return}closeDlg();return editApp(a=>{a.posx=(a.posx||[]).concat([[k,l]])})},
  rmPos:el=>{const i=+el.dataset.v,[k,l]=(S.app.posx||[])[i]||[];const n=Object.values(S.jog).filter(p=>p.pos===k).length;
    if(confirmou(el,{titulo:`Remover a posição ${l}?`,texto:n?tp('posicao.removerAviso',n):'Ninguém usa esta posição.',acao:'Remover posição',perigo:true})!=='sim')return;return editApp(a=>{a.posx=(a.posx||[]).filter((x,j)=>j!==i)})},
  dupGroup:()=>{openDlg(`<h3>Duplicar grupo</h3><p class="small muted" style="margin-top:-6px">Cria um grupo novo e independente, com o mesmo esporte, frequência, dias e horários, posições e configurações de partidas e caixa. Você será o organizador dele.</p>
    <label class="f"><span>Nome do novo grupo</span><input class="inp" id="dgn" maxlength="40" value="${esc(gname()+' (cópia)')}"></label><div class="err" id="dgErr" style="margin-top:-8px"></div>
    <label class="row small" style="margin-bottom:6px"><input type="checkbox" id="dgel" checked> Copiar o elenco (jogadores ativos, notas, contatos, avulsos e pares separados)</label>
    <p class="small muted">Rodadas, partidas, caixa, votações e administradores não são copiados.</p>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="doDupGroup">Duplicar</button></div>`);setTimeout(()=>{const i=$('#dgn');i&&(i.focus(),i.select())},50)},
  doDupGroup:async()=>{const name=val('dgn');$('#dgErr').textContent='';if(name.length<2){$('#dgErr').textContent='Dê um nome ao grupo.';return}if(dupName(name,null)){$('#dgErr').textContent='Você já tem um grupo com esse nome.';return}
    const lg=await limiteGrupos();if(lg.cheio){avisoGrupos('#dgErr',lg.n);return}
    const withEl=$('#dgel').checked,a=S.app,gid=B.newId(),uid=S.user.uid,now=Date.now(),base='grupos/'+gid,nc=cl(a.cfg)||{},c0=cfg();CAIXA_K.forEach(k=>delete nc[k]);
    try{await gravarGrupo(gid,clean({name,sport:a.sport||'futebol',sportName:a.sportName||'',freq:freq(),posx:a.posx||[],ativo:true,cfg:nc,owner:uid,createdAt:now,origem:S.gid}));
      await B.set(base+'/membros/'+uid,Object.assign({uid,email:S.user.email,role:'owner',at:now},S.user.via?{via:S.user.via}:{}));
      const pcN={mensal:c0.mensal,diaria:c0.diaria,pix:c0.pix,tipos:{}};if(withEl)players().forEach(p=>{pcN.tipos[p.id]=ptipo(p.id)});await B.set(base+'/privado/caixa',clean(pcN));
      if(withEl){const keep=new Set(players().map(p=>p.id).concat(Object.keys(S.avul||{})));const ps=[];
        players().forEach(p=>{const d=Object.assign({},S.jog[p.id],{criado:now});delete d.tipo;ps.push(B.set(base+'/jogadores/'+p.id,clean(d)))});
        Object.entries(S.avul||{}).forEach(([id,x])=>ps.push(B.set(base+'/avulsos/'+id,clean(Object.assign({},x,{criado:now})))));
        const R=cl(S.rat)||{},nv={};keep.forEach(id=>{nv[id]=lvl(id)});ps.push(B.set(base+'/privado/ratings',{nivel:nv,stars:{},sep:(R.sep||[]).filter(([x,y])=>keep.has(x)&&keep.has(y))}));
        const C={};Object.entries(S.cont||{}).forEach(([id,c])=>{if(keep.has(id))C[id]=c});if(Object.keys(C).length)ps.push(B.set(base+'/privado/contatos',C));await Promise.all(ps)}
      await upMyGroup(gid,{name,role:'owner',sport:a.sport||'futebol',sportName:a.sportName||'',ativo:true,criado:now});closeDlg();toast('Grupo duplicado.');location.hash='#/g/'+gid}
    catch(e){console.error(e);if(e&&e.code==='permission-denied'&&!(await B.get('grupos/'+gid).catch(()=>null)))avisoGrupos('#dgErr',lg.n);else toast('Não foi possível duplicar. Tente de novo.')}},
  toggleAtivo:el=>{const on=!grpAtivo();if(!on&&confirmou(el,{titulo:'Inativar "'+gname()+'"?',texto:'Os links públicos deixam de aceitar confirmações e votos, e a rodada fixa para de ser criada. Tudo continua guardado e você pode reativar depois.',acao:'Inativar grupo',perigo:true})!=='sim')return;
    const p=editApp(a=>{a.ativo=on;if(on)delete a.inativadoEm;else a.inativadoEm=Date.now()});upMyGroup(S.gid,{ativo:on});toast(on?'Grupo reativado.':'Grupo inativado.');return p},
  pickSport:el=>{const box=el.closest('[data-sp]');box.dataset.sp=el.dataset.v;box.querySelectorAll('[data-a=pickSport]').forEach(b=>b.setAttribute('aria-pressed',b===el));const o=box.querySelector('#ngoW,#csoW');if(o)o.hidden=el.dataset.v!=='outro';
    const nt=box.querySelector('#ngt');if(nt){const ant=box.dataset.spAnt||'';if(!ant||+nt.value===porTimePadrao(ant))nt.value=porTimePadrao(el.dataset.v);box.dataset.spAnt=el.dataset.v;$('#ngtHelp').textContent=porTimeAjuda(el.dataset.v)}},
  createGroup:async el=>{const g=readGroupForm(null);if(!g)return;
    const lg=await limiteGrupos();if(lg.cheio){avisoGrupos('#ngErr',lg.n);return}
    const gid=B.newId(),uid=S.user.uid,now=Date.now();
    try{await gravarGrupo(gid,{name:g.name,sport:g.sport,sportName:g.sportName,freq:g.freq,ativo:true,cfg:{minutes:SPORTS[g.sport].min,porTime:g.porTime,fixos:g.fixos,place:(g.fixos[0]&&g.fixos[0].place)||''},owner:uid,createdAt:now});
      await B.set('grupos/'+gid+'/membros/'+uid,Object.assign({uid,email:S.user.email,role:'owner',at:now},S.user.via?{via:S.user.via}:{}));
      await upMyGroup(gid,{name:g.name,role:'owner',sport:g.sport,sportName:g.sportName,ativo:true,criado:now});closeDlg();location.hash='#/g/'+gid}
    catch(e){console.error(e);if(e&&e.code==='permission-denied'&&!(await B.get('grupos/'+gid).catch(()=>null)))avisoGrupos('#ngErr',lg.n);else toast('Não foi possível criar o grupo. Tente de novo.')}},
  groupsDlg:()=>{const gs=Object.entries((S.me&&S.me.grupos)||{}).filter(([k,v])=>v.ativo!==false||k===S.gid).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'',LOCAL));
    openDlg(`<h3>Seus grupos</h3><ul class="plist">${gs.map(([gid,g])=>`<li><span class="gem">${(SPORTS[g.sport]||SPORTS.futebol).e}</span><span class="pn"><b>${esc(g.name)}</b>${gid===S.gid?' <span class="tag">· aberto</span>':''}<br><span class="tag">${esc(g.sportName||(SPORTS[g.sport]||SPORTS.futebol).n)}</span></span>${gid===S.gid?'':`<a class="btn sm primary" href="#/g/${gid}">Abrir</a>`}</li>`).join('')}</ul>
    <div class="dlg-f"><a class="btn" href="#/">Ver todos</a><button class="btn primary" data-a="newGroup">Novo grupo</button></div>`)},
  acceptInv:async el=>{el.disabled=true;const R=S.route,uid=S.user.uid;
    try{await B.set('grupos/'+R.gid+'/membros/'+uid,Object.assign({uid,email:S.user.email,role:'admin',token:R.token,at:Date.now()},S.user.via?{via:S.user.via}:{}));await upMyGroup(R.gid,{name:gname(),role:'admin',sport:S.app.sport||'futebol',sportName:S.app.sportName||'',ativo:S.app.ativo!==false,criado:S.app.createdAt||null});location.hash='#/g/'+R.gid}
    catch(e){console.error(e);el.disabled=false;toast('Convite inválido ou expirado. Peça um novo link ao organizador.')}},
  inviteLink:()=>{let t=S.convite?.token;if(!t){t=B.newId()+B.newId();S.convite={token:t};w(GB.set('privado/convite',{token:t}))}
    shareDlg('Convite para administrador',`Oi! Te convidei para administrar o grupo *${gname()}* no ${APP}.\nAbra o link, crie sua conta (ou entre) e aceite:\n${linkConvite(t)}`)},
  newInviteLink:el=>{if(confirmou(el,{titulo:'Gerar um novo link de convite?',texto:'O link atual deixa de funcionar.',acao:'Gerar novo link'})!=='sim')return;const t=B.newId()+B.newId();S.convite={token:t};w(GB.set('privado/convite',{token:t}));ACT.inviteLink()},
  rmMember:el=>{if(confirmou(el,{titulo:'Remover este administrador?',texto:'O link de convite atual também deixa de funcionar, para ele não conseguir voltar sozinho.',acao:'Remover administrador',perigo:true})!=='sim')return;delete S.membros[el.dataset.v];S.convite=null;changed();
    return Promise.all([w(GB.del('membros/'+el.dataset.v)),w(GB.del('privado/convite'))]).then(()=>toast('Administrador removido. Para convidar alguém, gere um novo link.',4500))},
  forgetGroup:()=>{const me=cl(S.me)||{grupos:{}};delete me.grupos[S.gid];S.me=me;B.set('usuarios/'+S.user.uid,me).catch(()=>{});location.hash='#/'},
};

export { acoes, limiteGrupos, avisoGrupos, gravarGrupo };
