/* Ações: Rodada: datas, presença, avulsos, sorteio, times, lista × times e histórico. Fazem parte de ACT (src/acoes.js). */
import { abrirHist, buscarHist, estadoHist } from '../telas/historico.js';
import { cfg } from '../dominio/caixa.js';
import { COL, col, hasPos, porTime, posKeys, posLabel, posTag, sport, tn } from '../dominio/esportes.js';
import { attendance, curRodada, fdia, fixos, fmtL, gname, isAvulso, lvl, lvlIn, normName, players, pname, ppos, rodadas, setLvl } from '../dominio/grupo.js';
import { draw } from '../dominio/sorteio.js';
import { foraDosTimes } from '../dominio/divergencia.ts';
import { reservas, sugerirTimes, titulares } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { shareDlg, txtConvite, txtTimes } from '../dominio/whatsapp.js';
import { copyText } from '../eventos.js';
import { B, setCAP, sleep } from '../nucleo/backend.js';
import { campoTelefone, lerContato } from '../ui/contato-form';
import { editApp, editRat, editRod, saveContato, setPres } from '../nucleo/edicoes.js';
import { apagarPartidasDaRodada } from '../nucleo/partidas.js';
import { GB, S, w } from '../nucleo/estado.js';
import { linkProxima, linkRodada } from '../nucleo/links.js';
import { $, DIAS, esc, fdate, toast } from '../nucleo/util.js';
import { avisar, closeDlg, closeDlgNow, confirmou, dlg, openDlg, posField, val } from '../ui/dialogos.js';
import { drawPreview, playerDlg, rodDlg } from '../ui/dialogos-gestao.js';
import { changed, render } from '../ui/render.js';
import { LOCAL } from '../i18n/formatos.js';
import { nPartidas, temVotacao } from '../telas/rodada-partes.js';
import { ACT } from '../acoes.js';

/* Põe a pessoa direto num time (sai de qualquer outro) e a inclui na foto do sorteio, para não gerar aviso. */
function porNoTime(ti,pid){const r=curRodada(),t=r.times[ti];toast(tx('porTime.posto',{nome:pname(pid),time:tn(t.c)}));
  return editRod(r.id,x=>{x.times.forEach(t=>{t.players=t.players.filter(p=>p!==pid);if(t.res)t.res=t.res.filter(p=>p!==pid)});const alvo=x.times[ti];
    if(titulares(alvo).length>=porTime())alvo.res=(alvo.res||[]).concat(pid);alvo.players.push(pid);
    x.info=x.info||{};x.info[pid]={n:pname(pid),p:ppos(pid)};const b=x.base||[...fotoDoSorteio(x)];if(!b.includes(pid))b.push(pid);x.base=b})}
/* Escolher o time de quem confirmou depois do sorteio. */
function escolherTime(pid){const r=curRodada();
  openDlg(`<h3>${esc(tx('porTime.qualTime',{nome:pname(pid)}))}</h3><div class="vgrid">${r.times.map((t,i)=>`<button class="opt" data-a="doPorTime" data-v="${i}" data-p="${pid}"><span class="dot" style="background:${col(t.c).c}"></span>${tn(t.c)}<span class="tag" style="margin-left:auto">${tp('porTime.jogadores',t.players.length)}</span></button>`).join('')}</div><div class="dlg-f"><button class="btn" data-a="close">Cancelar</button></div>`)}
/* KAN-71: depois de sortear, a tela vai até os times e o foco fica no título "Times" (leitor de tela anuncia). */
function irParaTimes(){setTimeout(()=>{const h=document.getElementById('timesTit');if(!h)return;h.scrollIntoView({block:'start'});h.focus({preventScroll:true})},80)}

const acoes={
  newRod:()=>rodDlg(null),editRod:()=>rodDlg(curRodada()),
  saveRod:el=>{const d=val('rdt');if(!d){toast('Escolha a data.');return}const id=el.dataset.v;
    if(id)editRod(id,r=>Object.assign(r,{date:d,time:val('rtm'),fim:val('rfm'),place:val('rpl')}));
    else{const nid=B.newId();S.rid=nid;editRod(nid,r=>Object.assign(r,{date:d,time:val('rtm'),fim:val('rfm'),place:val('rpl'),locked:false,times:null,info:{},createdAt:Date.now()}));editApp(a=>{a.cfg.place=val('rpl');a.cfg.time=val('rtm')})}
    closeDlg()},
  delRod:el=>{const r=curRodada();if(confirmou(el,{titulo:'Excluir a rodada de '+fdate(r.date)+'?',texto:'A lista, os times e as partidas desta rodada somem, e as partidas saem do ranking. Não dá para desfazer.',acao:'Excluir rodada',perigo:true})!=='sim')return;Object.keys(S.pres).forEach(p=>GB.del('rodadas/'+r.id+'/presencas/'+p));
    return apagarPartidasDaRodada(r.id,r.date).then(()=>{w(GB.del('rodadas/'+r.id));delete S.rod[r.id];S.rid=null;changed()})},
  /* KAN-75: o emoji vem do esporte do grupo; "Todo" no sábado e no domingo. */
  shareFixo:()=>{const f=fixos();shareDlg(tx('fixos.titulo'),tx('fixos.convite',{emoji:sport().e,grupo:gname(),dias:f.map(x=>tx(x.dow===0||x.dow===6?'fixos.diaTodo':'fixos.diaToda',{dia:DIAS[x.dow].toLowerCase(),ini:x.ini,fim:x.fim?tx('fixos.ate',{fim:x.fim}):'',local:x.place?' — '+x.place:''})).join('\n'),link:linkProxima()}))},
  copyFixo:()=>copyText(linkProxima()),
  cancelRod:el=>{const r=curRodada();if(!r.cancelada&&confirmou(el,{titulo:'Cancelar o jogo de '+fdate(r.date)+'?',texto:'O link permanente passa a mostrar a rodada seguinte. Dá para reativar depois.',acao:'Cancelar esta data',cancelar:'Voltar',perigo:true})!=='sim')return;editRod(r.id,x=>{x.cancelada=!x.cancelada});if(!r.cancelada)toast('Data cancelada.')},
  lock:el=>{const r=curRodada();if(r.locked&&r.times&&confirmou(el,{titulo:tx('lista.reabrirTitulo'),texto:tx('lista.confirmaReabrir'),acao:tx('lista.reabrirAcao')})!=='sim')return;return editRod(r.id,x=>{x.locked=!x.locked})},
  shareConvite:()=>shareDlg('Convite da rodada',txtConvite(curRodada())),
  copyLink:()=>copyText(linkRodada(curRodada().id)),
  shareTimes:()=>shareDlg('Times sorteados',txtTimes(curRodada())),
  mark:el=>{const r=curRodada(),id=el.dataset.p,v=el.dataset.v,cur=S.pres[id];
    if(r.locked)return;
    if(r.times&&confirmou(el,{titulo:tx('lista.mudarTitulo',{nome:pname(id)}),texto:tx('lista.confirmaMudar',{nome:pname(id)}),acao:tx('lista.mudarAcao')})!=='sim')return;
    if(cur&&cur.s===v){if(isAvulso(id))setPres(r.id,id,Object.assign({},cur,{s:v==='in'?'out':'in'}));else{delete S.pres[id];changed();w(GB.del('rodadas/'+r.id+'/presencas/'+id))}}
    else setPres(r.id,id,Object.assign({},cur||{},{s:v}))},
  addAvulso:el=>{const t=el&&el.dataset?el.dataset.t:null;S.alvoTime=t!=null&&t!==''?+t:null;const r=curRodada(),regs=Object.entries(S.avul||{}).filter(([id])=>!S.jog[id]&&S.pres[id]?.s!=='in').sort((a,b)=>(a[1].nome||'').localeCompare(b[1].nome||'',LOCAL));
    openDlg(`<h3>Adicionar avulso</h3>${regs.length?`<div class="f"><span class="lbl">Já jogou aqui? Escolha o nome</span>${regs.length>8?'<input class="inp" id="avq" placeholder="Buscar nome" style="margin-bottom:8px">':''}
      <div class="vgrid" id="avlist">${regs.map(([id,a])=>`<button class="opt" data-a="pickAvulso" data-p="${id}" data-n="${esc(normName(a.nome))}">${posTag(id)}<span>${esc(a.nome)}</span><span class="tag" style="margin-left:auto">${fmtL(lvl(id))}</span></button>`).join('')}</div></div>
      <p class="small muted" style="margin:4px 0 10px">Ou cadastre um avulso novo:</p>`:''}
    <label class="f"><span>Nome</span><input class="inp" id="anm" maxlength="40"></label>${posField('apos')}<div class="f"><span class="lbl">Nota de 1 a 10</span>${lvlIn(5)}</div>
    ${campoTelefone('',tx('contato.telOpcional'))}
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveAvulso">Adicionar confirmado</button></div>`)},
  pickAvulso:el=>{const id=el.dataset.p,a=S.avul[id];closeDlg();const ps=[setPres(curRodada().id,id,{s:'in',nome:a.nome,avulso:true,pos:a.pos||''})];
    if(S.alvoTime!=null)ps.push(porNoTime(S.alvoTime,id));else toast(a.nome+' confirmado.');S.alvoTime=null;return Promise.all(ps)},
  saveAvulso:el=>{const n=val('anm');if(n.length<2){toast('Digite o nome.');return}const ct=lerContato('ptel');if(!ct)return;
    const same=Object.entries(S.avul||{}).find(([,a])=>normName(a.nome)===normName(n));if(same){const c=confirmou(el,{titulo:n+' já jogou aqui antes',texto:'Usar o cadastro dele (posição, nota e contato)?',acao:'Usar o cadastro',nao:'Cadastrar como novo'});if(!c)return;if(c==='sim')return ACT.pickAvulso({dataset:{p:same[0]}})}
    const id=B.newId(),v=+$('#plv').value,pos=val('apos'),o={nome:n,pos,criado:Date.now()};S.avul[id]=o;
    const ps=[setPres(curRodada().id,id,{s:'in',nome:n,avulso:true,pos}),w(GB.set('avulsos/'+id,o)),editRat(a=>setLvl(a,id,v))];if(S.alvoTime!=null){ps.push(porNoTime(S.alvoTime,id));S.alvoTime=null}const c=saveContato(id,ct.tel,'');if(c)ps.push(c);closeDlg();return Promise.all(ps)},
  editAvulso:el=>{const id=el.dataset.p,a=S.avul[id]||{nome:pname(id),pos:ppos(id)},ct=(S.cont||{})[id]||{};
    openDlg(`<h3>Avulso: ${esc(a.nome)}</h3><label class="f"><span>Nome</span><input class="inp" id="anm" maxlength="40" value="${esc(a.nome)}"></label>${posField('apos',a.pos)}
    <div class="f"><span class="lbl">Nota de 1 a 10 (só administradores veem)</span>${lvlIn(lvl(id))}</div>
    ${campoTelefone(ct.tel||'',tx('contato.telRotulo'))}
    <p class="small muted" style="margin-top:-4px">Registrado em ${fdia(a.criado)}</p>
    <div class="dlg-f"><button class="btn ghost danger" data-a="delAvulso" data-p="${id}">Esquecer avulso</button><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveAvEdit" data-p="${id}">Salvar</button></div>`)},
  saveAvEdit:el=>{const id=el.dataset.p,n=val('anm');if(n.length<2){toast('Digite o nome.');return}const ct=lerContato('ptel');if(!ct)return;const o=Object.assign({criado:Date.now()},S.avul[id]||{},{nome:n,pos:val('apos')||''});S.avul[id]=o;changed();
    const ps=[w(GB.set('avulsos/'+id,o)),editRat(a=>setLvl(a,id,+$('#plv').value))];const c=saveContato(id,ct.tel,'');if(c)ps.push(c);closeDlg();toast('Avulso atualizado.');return Promise.all(ps)},
  delAvulso:el=>{const id=el.dataset.p;if(confirmou(el,{titulo:'Esquecer este avulso?',texto:'Ele some da lista de "já jogaram aqui". O histórico de partidas continua.',acao:'Esquecer avulso',perigo:true})!=='sim')return;delete S.avul[id];changed();closeDlg();return w(GB.del('avulsos/'+id))},
  promote:el=>{const id=el.dataset.p,p=S.avul?.[id]||{nome:S.pres[id]?.nome,pos:S.pres[id]?.pos};playerDlg(null,{id,name:p?.nome,pos:p?.pos,tipo:'diarista'});$('[data-a=savePlayer]').dataset.p='';$('[data-a=savePlayer]').dataset.new=id},
  drawDlg:el=>{const r0=curRodada();
    if(r0&&r0.times&&temVotacao(r0)){toast(tx('sorteio.bloqueadoVotacao'),6000);return}
    if(r0&&r0.times&&nPartidas(r0)&&confirmou(el,{titulo:tx('sorteio.comPartidasTitulo'),texto:tp('sorteio.comPartidas',nPartidas(r0)),acao:tx('div.sortearDeNovo')})!=='sim')return;
    const a=attendance(),T=porTime(),fora=new Set(cfg().foraPos||[]),k=a.inn.length,dentro=a.inn.filter(id=>!(hasPos()&&fora.has(ppos(id)))).length,
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
  /* KAN-71: filtro da lista de presença (Todos, Vão, Não vão, Sem resposta). Só muda a tela. */
  presFiltro:el=>{S.presFiltro=el.dataset.v;render()},
  dNov:el=>{$('#drawBox').dataset.nov=el.dataset.v;drawPreview()},
  doDraw:()=>{const box=$('#drawBox'),n=+box.dataset.n,nov=+box.dataset.nov,fora=(box.dataset.fora||'').split(',').filter(Boolean),ids=[...box.querySelectorAll('.dp:checked')].map(x=>x.value);if(ids.length<n*2)return;
    return sleep(40).then(()=>{const cap=[];cap.close=false;setCAP(cap);try{ACT._draw(ids,n,nov,fora)}finally{setCAP(null)}return Promise.allSettled(cap).then(()=>{closeDlgNow();irParaTimes()})})},
  _draw:(ids,n,nov,fora)=>{
    const r=curRodada(),T=draw(ids,n,nov,r.id),PT=porTime(),quando=id=>(S.pres[id]||{}).t||0;
    editRod(r.id,x=>{const old=x.times||[];x.times=T.map((p,i)=>{const t={c:old[i]?.c??i,players:p},rs=reservas(p,PT,quando);if(rs.length)t.res=rs;return t});x.info={};ids.forEach(id=>x.info[id]={n:pname(id),p:ppos(id)});x.drawnAt=Date.now();
      /* pelada-v15: sortear fecha a lista e guarda a foto dos confirmados, para avisar se a lista mudar depois. */
      x.locked=true;x.base=attendance().inn});
    if(nov!==cfg().novelty||(fora&&fora.join()!==(cfg().foraPos||[]).join()))editApp(a=>{a.cfg.novelty=nov;if(fora)a.cfg.foraPos=fora});S.live=null;closeDlg();toast(tx('lista.sorteadoFechada'))},
  /* Troca a cor do colete gravando só cores.{time} (KAN-108), sem regravar os jogadores. */
  color:el=>{const r=curRodada(),ti=+el.dataset.v,used=r.times.map(t=>t.c);let c=r.times[ti].c;for(let k=0;k<COL.length;k++){c=(c+1)%COL.length;if(!used.includes(c))break}
    const d=S.rod[r.id]||{};S.rod[r.id]=Object.assign({},d,{cores:Object.assign({},d.cores||{},{[ti]:c})});changed();return w(GB.patch('rodadas/'+r.id,{['cores.'+ti]:c}))},
  move:el=>{const r=curRodada(),f=+el.dataset.v,pid=el.dataset.p;openDlg(`<h3>Mover ${esc(pname(pid))}</h3><div class="vgrid">${r.times.map((t,i)=>i===f?'':`<button class="opt" data-a="doMove" data-v="${i}" data-f="${f}" data-p="${pid}"><span class="dot" style="background:${col(t.c).c}"></span>${tn(t.c)}</button>`).join('')}</div>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn" data-a="toggleRes" data-v="${f}" data-p="${pid}">${(r.times[f].res||[]).includes(pid)?tx('times.marcarTitular'):tx('times.marcarReserva')}</button></div>`)},
  toggleRes:el=>{const f=+el.dataset.v,pid=el.dataset.p;closeDlg();return editRod(curRodada().id,x=>{const t=x.times[f],r=t.res||[];t.res=r.includes(pid)?r.filter(p=>p!==pid):r.concat(pid);if(!t.res.length)delete t.res})},
  doMove:el=>{const to=+el.dataset.v,f=+el.dataset.f,pid=el.dataset.p;editRod(curRodada().id,x=>{x.times[f].players=x.times[f].players.filter(p=>p!==pid);if(x.times[f].res){x.times[f].res=x.times[f].res.filter(p=>p!==pid);if(!x.times[f].res.length)delete x.times[f].res}x.times[to].players.push(pid)});closeDlg()},
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
  /* histórico (KAN-85) */
  histModo:el=>{estadoHist().modo=el.dataset.v;render()},
  histBuscar:()=>buscarHist(false),
  histMais:()=>buscarHist(true),
  histAbrir:el=>abrirHist(el.dataset.v),
  histVoltar:()=>{estadoHist().sel=null;render()},
};

export { acoes, porNoTime, escolherTime };
