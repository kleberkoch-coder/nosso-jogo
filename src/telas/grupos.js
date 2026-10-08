import { linhaVersao } from '../nucleo/versao.js';
import { SPORTS } from '../dominio/esportes.js';
import { fdia } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { esc } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';

function vHome(){
  if(!S.loaded.me)return '<div class="empty muted">Carregando…</div>';
  const all=Object.entries((S.me&&S.me.grupos)||{}).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'',LOCAL));
  if(!all.length)return `<div class="panel empty auth"><h2>Bem-vindo!</h2><p class="muted">Crie seu primeiro grupo: dê um nome, escolha o esporte e diga quando vocês jogam. Você pode criar quantos grupos quiser, um para cada jogo.</p><button class="btn primary" data-a="newGroup">Criar meu grupo</button></div>`;
  const act=all.filter(([,g])=>g.ativo!==false),ina=all.filter(([,g])=>g.ativo===false);
  const li=([gid,g])=>`<li><span class="gem">${(SPORTS[g.sport]||SPORTS.futebol).e}</span><span class="pn"><b>${esc(g.name||'Grupo')}</b><br><span class="tag">${esc(g.sportName||(SPORTS[g.sport]||SPORTS.futebol).n)} · ${g.role==='owner'?'organizador':'administrador'}${g.criado?' · criado em '+fdia(g.criado):''}</span></span><a class="btn sm ${g.ativo===false?'':'primary'}" href="#/g/${gid}">Abrir</a></li>`;
  return `<div class="stack"><div class="row between"><h2>Meus grupos</h2><button class="btn primary" data-a="newGroup">Novo grupo</button></div>
  ${act.length?`<div class="panel"><ul class="plist">${act.map(li).join('')}</ul></div>`:'<div class="panel empty"><p class="muted">Nenhum grupo ativo.</p></div>'}
  ${ina.length?`<details class="panel"><summary>Grupos inativos (${ina.length})</summary><ul class="plist" style="margin-top:8px">${ina.map(li).join('')}</ul></details>`:''}
  <p class="small muted">Conectado como ${esc(S.user.email)}</p>${linhaVersao()}</div>`}

export { vHome };
