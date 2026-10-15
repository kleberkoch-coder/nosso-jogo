/* Ações: Votação: criar, encerrar e compartilhar. Fazem parte de ACT (src/acoes.js). */
import { hasPos, posLabel, sport } from '../dominio/esportes.js';
import { pname, rodById, rodadas } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { shareDlg } from '../dominio/whatsapp.js';
import { B } from '../nucleo/backend.js';
import { gravarVotacao } from '../nucleo/partidas.js';
import { GB, S, w } from '../nucleo/estado.js';
import { linkVoto } from '../nucleo/links.js';
import { $, cl, esc, fdate, toast, uid } from '../nucleo/util.js';
import { tally } from '../telas/votacao.js';
import { confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';

const acoes={
  newVote:()=>{const rs=rodadas().filter(r=>r.times);if(!rs.length)return;openDlg(`<h3>Nova votação</h3>
    <label class="f"><span>Rodada</span><select class="sel" id="vr">${rs.map(r=>`<option value="${r.id}">${fdate(r.date)}${r.place?' — '+esc(r.place):''}</option>`).join('')}</select></label>
    <label class="f"><span>Título</span><input class="inp" id="vt" value="Craque da rodada" maxlength="50"></label>
    <div class="f"><span class="lbl">O que votar</span>${[['best','Melhor jogador'],...(sport().key?[['gk','Melhor '+posLabel(sport().key).toLowerCase()]]:[]),...(hasPos()?[['pos','Melhor de cada posição']]:[]),['worst','Pior jogador (bagre)']].map(([k,l],i)=>`<label class="row small" style="margin-bottom:6px"><input type="checkbox" class="vc" value="${k}" ${i===0?'checked':''}> ${l}</label>`).join('')}
    <input class="inp" id="vx" placeholder="${tx('votacao.outraCategoria')}" maxlength="40"></div>
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
  delVote:el=>{if(confirmou(el,{titulo:'Excluir esta votação?',texto:'Os votos e o resultado somem, e os destaques saem do ranking. Não dá para desfazer.',acao:'Excluir votação',perigo:true})!=='sim')return;const vid=S.vid,antes=S.vot[vid];Object.keys(S.votos).forEach(u=>GB.del('votacoes/'+vid+'/votos/'+u));delete S.vot[vid];S.vid=null;return gravarVotacao(vid,antes,null)},
  shareVote:()=>{const v=S.vot[S.vid];let t=`🗳️ *${v.title}*\n`;if(v.open)t+=`Vote aqui: ${linkVoto(S.vid)}`;else t+='\n'+v.cats.map(c=>`🏅 ${c.name}: ${(v.resultado?.[c.id]?.winners||[]).map(pname).join(' e ')||'sem votos'}`).join('\n');shareDlg('Votação',t)},
};

export { acoes };
