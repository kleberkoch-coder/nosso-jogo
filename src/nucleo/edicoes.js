import { isAdmin, rodById } from '../dominio/grupo.js';
import { GB, S, clean, w } from './estado.js';
import { cl, toast } from './util.js';
import { contaComoAvulso } from '../dominio/limites.ts';
import { tx } from '../i18n/index.js';
import { op } from './backend.js';
import { changed } from '../ui/render.js';

/* edições otimistas */
/* Rodada: grava só os campos que mudaram (D4). Assim, se dois administradores mexem ao mesmo tempo
   em coisas diferentes (um fecha a lista, outro salva uma partida), nada se perde, inclusive sem internet.
   Rodada fixa ainda não gravada (virtual) é criada inteira. */
function editRod(id,fn){const existe=!!S.rod[id];
  const base=S.rod[id]||(()=>{const v=rodById(id);if(!v)return{};const o=Object.assign({},v);delete o.id;delete o.virtual;o.createdAt=Date.now();return o})();
  const antes=cl(base),r=cl(base);fn(r);S.rod[id]=r;changed();
  if(!existe)return w(GB.set('rodadas/'+id,clean(r)));
  const campos={};new Set(Object.keys(antes).concat(Object.keys(r))).forEach(k=>{
    if(!(k in r))campos[k]=op.apagar();else if(JSON.stringify(antes[k])!==JSON.stringify(r[k]))campos[k]=clean(r[k])});
  return Object.keys(campos).length?w(GB.patch('rodadas/'+id,campos)):Promise.resolve()}
function editLocal(id,fn){const base=S.rod[id]||(()=>{const v=rodById(id)||{};const o=Object.assign({},v);delete o.id;delete o.virtual;o.createdAt=Date.now();return o})();
  const r=cl(base);fn(r);S.rod[id]=r;changed()}
function editApp(fn){const a=cl(S.app)||{name:'Pelada',cfg:{}};a.cfg=a.cfg||{};fn(a);S.app=a;changed();return w(GB.set('config/app',clean(a)))}
function saveContato(id,tel,email){const c=cl(S.cont)||{},o=c[id]||{};if((o.tel||'')===(tel||'')&&(o.email||'')===(email||''))return;
  if(tel||email)c[id]={tel:tel||'',email:email||''};else delete c[id];S.cont=c;return w(GB.set('privado/contatos',clean(c)))}
function waUrl(tel){let d=String(tel||'').replace(/\D/g,'');if(!d)return '';if(d.length<=11)d='55'+d;return 'https://wa.me/'+d}
function editRat(fn){const a=cl(S.rat)||{};a.stars=a.stars||{};a.nivel=a.nivel||{};a.sep=a.sep||[];fn(a);S.rat=a;changed();return w(GB.set('privado/ratings',clean(a)))}
function setPres(rid,pid,data){const cur=S.presRid===rid?S.pres[pid]:null,me=S.user?S.user.uid:'';
  const d=Object.assign({t:Date.now()},data,{by:me});delete d.dev;
  /* dev = aparelho que respondeu primeiro pelo link. Administradores não viram "dono" da resposta. */
  const dev=(cur&&cur.dev)||(isAdmin()?null:me);if(dev)d.dev=dev;
  const novo=contaComoAvulso({admin:isAdmin(),jogador:!!(S.jog||{})[pid],jaNaLista:!!cur});
  if(S.presRid===rid){S.pres[pid]=d;changed()}
  if(!novo)return w(GB.set('rodadas/'+rid+'/presencas/'+pid,clean(d)));
  /* Avulso novo pelo link (KAN-89): grava junto com +1 no contador da rodada; passou do limite, o Firebase recusa as duas. */
  return GB.lote([{tipo:'set',p:'rodadas/'+rid+'/presencas/'+pid,o:clean(d)},{tipo:'patch',p:'rodadas/'+rid+'/limites/avulsos',o:{n:op.somar(1),ult:pid}}])
    .catch(e=>{console.error(e);if(S.presRid===rid){delete S.pres[pid];changed()}
      toast(e&&e.code==='permission-denied'?tx('limite.avulsosPublico'):'Não foi possível salvar. Verifique a conexão.');throw e})}
/* Resposta mudada por um aparelho diferente do que respondeu primeiro (e que não é de administrador). */
function presAlterada(id){const p=S.pres[id];return !!(p&&p.dev&&p.by&&p.by!==p.dev&&!(S.membros||{})[p.by])}

export { editApp, editRat, editRod, presAlterada, saveContato, setPres, waUrl };
