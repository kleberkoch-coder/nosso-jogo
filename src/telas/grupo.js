import { linhaVersao } from '../nucleo/versao.js';
import { cfg } from '../dominio/caixa.js';
import { basePos, porTime, sport, sportName } from '../dominio/esportes.js';
import { tx } from '../i18n/index.js';
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
    <dt>${tx('grupo.porTime')}</dt><dd>${porTime()===2?tx('grupo.duplas'):porTime()}</dd>
    ${(c.foraPos||[]).length?`<dt>${tx('grupo.foraSorteio')}</dt><dd>${(c.foraPos||[]).map(esc).join(', ')}</dd>`:''}
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
    <ul class="plist" style="margin-top:6px">${Object.entries(S.membros).sort((x,y)=>(x[1].role==='owner'?-1:1)-(y[1].role==='owner'?-1:1)).map(([u,m])=>`<li><span class="pn">${esc(m.email||u)}${u===S.user.uid?' <span class="tag">· você</span>':''}${viaTag(m.via)}</span><span class="tag">${m.role==='owner'?'organizador':'admin'}</span>${owner&&m.role!=='owner'?`<button class="btn sm ghost danger" data-a="rmMember" data-v="${u}">Remover</button>`:''}</li>`).join('')}</ul>
    <p class="small muted" style="margin-top:8px">O convite é um link: quem abrir cria a conta (ou entra) e vira administrador deste grupo.${S.convite?.token?' <button class="linkbtn" data-a="newInviteLink">Invalidar o link atual</button>':''}</p></div>
  </div>${vTemaPanel()}${linhaVersao()}</div>`}

/* Como o administrador entrou da última vez (pelada-v17). Vazio até o próximo acesso dele. */
const GMINI='<svg viewBox="0 0 48 48" width="12" height="12" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
function viaTag(v){if(v!=='google'&&v!=='senha')return '';const n=tx(v==='google'?'grupo.viaGoogle':'grupo.viaSenha');
  return `<br><span class="via tag" title="${esc(tx('grupo.viaTitulo',{via:n}))}">${v==='google'?GMINI:'✉️'} ${n}</span>`}

export { vGrupo };
