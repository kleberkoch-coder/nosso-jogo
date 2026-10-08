import { isAdmin } from './grupo.js';
import { B } from '../nucleo/backend.js';
import { GB, S, clean, gp, w } from '../nucleo/estado.js';
import { cl } from '../nucleo/util.js';
import { changed } from '../ui/render.js';

function cfg(){const p=S.pc||{},x={};CAIXA_K.forEach(k=>{if(p[k]!=null)x[k]=p[k]});return Object.assign({mensal:80,diaria:20,minutes:10,pix:'',novelty:2,place:'',time:'09:00'},(S.app||{}).cfg||{},x)}
/* Valores, chave Pix e tipo (mensalista/diarista) ficam em privado/caixa, só para administradores. */
const CAIXA_K=['mensal','diaria','pix'];
function ptipo(id){const t=((S.pc||{}).tipos||{})[id];return t||S.jog[id]?.tipo||'mensalista'}
function editPc(fn){const a=cl(S.pc)||{};a.tipos=a.tipos||{};fn(a);S.pc=a;changed();return w(GB.set('privado/caixa',clean(a)))}
function migrarPrivado(){
  if(S.migrando||!S.dataOn||!isAdmin()||!S.app||!S.loaded.app||!S.loaded.jog||!S.loaded.pc)return;
  const c=S.app.cfg||{},ks=CAIXA_K.filter(k=>k in c),js=Object.entries(S.jog).filter(([,j])=>j&&('tipo' in j));
  if(!ks.length&&!js.length)return;
  S.migrando=true;const p=cl(S.pc)||{};p.tipos=p.tipos||{};
  ks.forEach(k=>{if(p[k]==null)p[k]=c[k]});js.forEach(([id,j])=>{if(!p.tipos[id])p.tipos[id]=j.tipo});S.pc=p;
  B.set(gp('privado/caixa'),clean(p)).then(()=>{const ps=[];
    if(ks.length){const a=cl(S.app);ks.forEach(k=>delete a.cfg[k]);S.app=a;ps.push(B.set(gp('config/app'),clean(a)))}
    js.forEach(([id])=>{const o=cl(S.jog[id]);if(!o)return;delete o.tipo;S.jog[id]=o;ps.push(B.set(gp('jogadores/'+id),clean(o)))});
    return Promise.all(ps)}).catch(e=>console.warn('migração do caixa',e)).finally(()=>{S.migrando=false;changed()})}

export { CAIXA_K, cfg, editPc, migrarPrivado, ptipo };
