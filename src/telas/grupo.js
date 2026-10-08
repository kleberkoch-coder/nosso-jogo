import { cfg } from '../dominio/caixa.js';
import { basePos, sport, sportName } from '../dominio/esportes.js';
import { fdia, fixos, freq, gname, grpAtivo, isOwnerMe, schedTxt } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { brl, esc } from '../nucleo/util.js';
import { vTemaPanel } from '../ui/tema.js';

/* ---------- Grupo ---------- */
function vGrupo(){const a=S.app,f=fixos(),c=cfg(),owner=isOwnerMe();
  return `<div class="stack">
  <div class="panel"><div class="row between" style="align-items:flex-start"><div class="row" style="align-items:center"><span class="gem">${sport().e}</span><div><h2 style="margin:0">${esc(gname())}</h2><div class="small muted">${esc(sportName())} · criado em ${fdia(a.createdAt)}</div></div></div>
    <span class="stat ${grpAtivo()?'on':'off'}">${grpAtivo()?'Ativo':'Inativo'}</span></div>
    <dl class="ficha"><dt>Frequência</dt><dd>${freq()==='fixo'?'Frequente (dias fixos)':'Esporádico'}</dd>
    ${freq()==='fixo'?`<dt>Dias e horários</dt><dd>${f.map(schedTxt).join('<br>')||'—'}</dd>`:''}
    ${!grpAtivo()?`<dt>Inativado em</dt><dd>${fdia(a.inativadoEm)}</dd>`:''}</dl>
    <div class="row" style="margin-top:12px"><button class="btn primary sm" data-a="editGroup">Editar grupo</button>
<button class="btn sm" data-a="dupGroup">Duplicar grupo</button>
    ${owner?(grpAtivo()?'<button class="btn sm ghost danger" data-a="toggleAtivo">Inativar grupo</button>':'<button class="btn sm" data-a="toggleAtivo">Reativar grupo</button>'):''}</div>
    ${owner?'':'<p class="small muted" style="margin-top:8px">Só o organizador pode inativar o grupo.</p>'}</div>
  <div class="panel"><div class="row between"><h3 style="margin:0">Posições</h3><button class="btn sm" data-a="addPos">Nova posição</button></div>
    <p class="small muted">Do esporte (${esc(sportName())}):</p><div class="poschips">${basePos().map(([k,l])=>`<span><b>${esc(k)}</b> ${esc(l)}</span>`).join('')||'<span class="muted">nenhuma</span>'}</div>
    <p class="small muted" style="margin-top:12px">Criadas por vocês:</p><div class="poschips">${((a.posx)||[]).map(([k,l],i)=>`<span><b>${esc(k)}</b> ${esc(l)}<button class="linkbtn" data-a="rmPos" data-v="${i}" aria-label="Remover ${esc(l)}">✕</button></span>`).join('')||'<span class="muted small">nenhuma ainda</span>'}</div></div>
  <div class="grid2">
   <div class="panel"><div class="row between"><h3 style="margin:0">Partidas e caixa</h3><button class="btn sm" data-a="settings">Editar</button></div>
    <p class="small muted">Partidas de ${c.minutes} min · mensalidade ${brl(c.mensal)} · diária ${brl(c.diaria)}${c.pix?' · Pix: '+esc(c.pix):''}</p></div>
   <div class="panel"><div class="row between"><h3 style="margin:0">Administradores</h3><button class="btn sm" data-a="inviteLink">Convidar</button></div>
    <ul class="plist" style="margin-top:6px">${Object.entries(S.membros).sort((x,y)=>(x[1].role==='owner'?-1:1)-(y[1].role==='owner'?-1:1)).map(([u,m])=>`<li><span class="pn">${esc(m.email||u)}${u===S.user.uid?' <span class="tag">· você</span>':''}</span><span class="tag">${m.role==='owner'?'organizador':'admin'}</span>${owner&&m.role!=='owner'?`<button class="btn sm ghost danger" data-a="rmMember" data-v="${u}">Remover</button>`:''}</li>`).join('')}</ul>
    <p class="small muted" style="margin-top:8px">O convite é um link: quem abrir cria a conta (ou entra) e vira administrador deste grupo.${S.convite?.token?' <button class="linkbtn" data-a="newInviteLink">Invalidar o link atual</button>':''}</p></div>
  </div>${vTemaPanel()}</div>`}

export { vGrupo };
