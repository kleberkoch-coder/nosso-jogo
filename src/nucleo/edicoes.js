import { isAdmin, rodById } from '../dominio/grupo.js';
import { GB, S, clean, w } from './estado.js';
import { cl } from './util.js';
import { changed } from '../ui/render.js';

/* edições otimistas */
function editRod(id,fn){const base=S.rod[id]||(()=>{const v=rodById(id);if(!v)return{};const o=Object.assign({},v);delete o.id;delete o.virtual;o.createdAt=Date.now();return o})();const r=cl(base);fn(r);S.rod[id]=r;changed();return w(GB.set('rodadas/'+id,clean(r)))}
function editApp(fn){const a=cl(S.app)||{name:'Pelada',cfg:{}};a.cfg=a.cfg||{};fn(a);S.app=a;changed();return w(GB.set('config/app',clean(a)))}
function saveContato(id,tel,email){const c=cl(S.cont)||{},o=c[id]||{};if((o.tel||'')===(tel||'')&&(o.email||'')===(email||''))return;
  if(tel||email)c[id]={tel:tel||'',email:email||''};else delete c[id];S.cont=c;return w(GB.set('privado/contatos',clean(c)))}
function waUrl(tel){let d=String(tel||'').replace(/\D/g,'');if(!d)return '';if(d.length<=11)d='55'+d;return 'https://wa.me/'+d}
function editRat(fn){const a=cl(S.rat)||{};a.stars=a.stars||{};a.nivel=a.nivel||{};a.sep=a.sep||[];fn(a);S.rat=a;changed();return w(GB.set('privado/ratings',clean(a)))}
function setPres(rid,pid,data){const cur=S.presRid===rid?S.pres[pid]:null,me=S.user?S.user.uid:'';
  const d=Object.assign({t:Date.now()},data,{by:me});delete d.dev;
  /* dev = aparelho que respondeu primeiro pelo link. Administradores não viram "dono" da resposta. */
  const dev=(cur&&cur.dev)||(isAdmin()?null:me);if(dev)d.dev=dev;
  if(S.presRid===rid){S.pres[pid]=d;changed()}return w(GB.set('rodadas/'+rid+'/presencas/'+pid,clean(d)))}
/* Resposta mudada por um aparelho diferente do que respondeu primeiro (e que não é de administrador). */
function presAlterada(id){const p=S.pres[id];return !!(p&&p.dev&&p.by&&p.by!==p.dev&&!(S.membros||{})[p.by])}

export { editApp, editRat, editRod, presAlterada, saveContato, setPres, waUrl };
