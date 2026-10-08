import { cfg } from './caixa.js';
import { hasPos, posKeys, sport } from './esportes.js';
import { S } from '../nucleo/estado.js';
import { DIAS, esc } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';

function gname(){return(S.app&&S.app.name)||'Meu grupo'}
function rat(){return Object.assign({stars:{},nivel:{},sep:[]},S.rat||{})}
function lvl(id){const R=S.rat||{};const n=R.nivel&&R.nivel[id];if(n!=null)return +n;const st=R.stars&&R.stars[id];return st!=null?st*2:5}
const fmtL=v=>(+v).toLocaleString(LOCAL,{minimumFractionDigits:(+v)%1?1:0,maximumFractionDigits:1});
function lvlTag(id){return `<span class="lvl-tag" title="Nota de 1 a 10">${fmtL(lvl(id))}</span>`}
const lvlIn=v=>`<div class="lvlin"><input type="range" id="plv" min="1" max="10" step="0.5" value="${v}" aria-label="Nota de 1 a 10"><output id="plvo">${fmtL(v)}</output></div><div class="lvlscale"><span>1 · iniciante</span><span>10 · craque</span></div>`;
function setLvl(a,id,v){a.nivel=a.nivel||{};a.nivel[id]=v;if(a.stars)delete a.stars[id]}
function players(){return Object.entries(S.jog).map(([id,v])=>Object.assign({id},v)).filter(p=>p.ativo!==false).sort((a,b)=>a.name.localeCompare(b.name,LOCAL))}
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function fixos(){return cfg().fixos||[]}
function freq(a){a=a||S.app||{};return a.freq||((a.cfg&&a.cfg.fixos&&a.cfg.fixos.length)?'fixo':'esporadico')}
function grpAtivo(a){a=a||S.app;return !a||a.ativo!==false}
const fdia=ts=>ts?new Date(ts).toLocaleDateString(LOCAL,{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const normName=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function dupName(name,except){return Object.entries((S.me&&S.me.grupos)||{}).some(([g,v])=>g!==except&&normName(v.name)===normName(name))}
const schedTxt=x=>`${DIAS[x.dow]}, ${x.ini}${x.fim?'–'+x.fim:''}${x.place?' · '+esc(x.place):''}`;
function endTs(r){let t=new Date(r.date+'T'+(r.fim||'23:59')).getTime();if(r.fim&&r.time&&r.fim<r.time)t+=864e5;return t}
function fixId(date,ini){return 'f-'+date+'-'+String(ini||'0000').replace(':','')}
function virtualOf(fx,date){return{id:fixId(date,fx.ini),date,time:fx.ini,fim:fx.fim,place:fx.place,fixo:true,virtual:true,locked:false,times:null,matches:[]}}
function virtualFixos(){const out=[],now=Date.now();if(!grpAtivo())return out;
  fixos().forEach(fx=>{const d=new Date();d.setHours(12,0,0,0);
    for(let k=0;k<70;k++){if(d.getDay()===+fx.dow){const date=ymd(d),id=fixId(date,fx.ini),doc=S.rod[id],v=virtualOf(fx,date);
        if(endTs(doc?Object.assign({},v,doc):v)>now&&!(doc&&doc.cancelada)){if(!doc)out.push(v);break}}
      d.setDate(d.getDate()+1)}});
  return out}
function virtualFromId(id){const m=/^f-(\d{4}-\d{2}-\d{2})-(\d{4})$/.exec(id||'');if(!m)return null;const dow=new Date(m[1]+'T12:00').getDay();
  const fx=fixos().find(f=>+f.dow===dow&&String(f.ini).replace(':','')===m[2]);return fx?virtualOf(fx,m[1]):null}
function rodById(id){if(!id)return null;if(S.rod[id])return Object.assign({id},S.rod[id]);return virtualFixos().find(v=>v.id===id)||virtualFromId(id)}
function rodadas(){const docs=Object.entries(S.rod).map(([id,v])=>Object.assign({id},v));const ids=new Set(docs.map(d=>d.id));
  return docs.concat(virtualFixos().filter(v=>!ids.has(v.id))).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||'')||(b.createdAt||0)-(a.createdAt||0))}
function upcoming(){const now=Date.now();return rodadas().filter(r=>!r.cancelada&&endTs(r)>now).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))}
function info(id){for(const r of Object.values(S.rod)){if(r.info&&r.info[id])return r.info[id]}return null}
function pname(id){return S.jog[id]?.name||S.avul?.[id]?.nome||S.pres[id]?.nome||info(id)?.n||'Avulso'}
function ppos(id){if(!hasPos())return '';const k=S.jog[id]?.pos||S.avul?.[id]?.pos||S.pres[id]?.pos||info(id)?.p;if(k&&posKeys().includes(k))return k;const ks=posKeys().filter(x=>x!==sport().key);return ks[Math.floor(ks.length/2)]||posKeys()[0]}
function isAvulso(id){return !S.jog[id]}
function isAdmin(){return !!(S.user&&!S.user.anon&&S.mem)}
function isOwnerMe(){return !!(S.app&&S.user&&S.app.owner===S.user.uid)}
function curRodada(){const rs=rodadas();if(!rs.length)return null;if(S.rid){const f=rs.find(r=>r.id===S.rid);if(f)return f}
  const r=upcoming()[0]||rs[0];S.rid=r.id;return r}
function attendance(){const a=Object.entries(S.pres).map(([id,v])=>Object.assign({id},v));
  return{inn:a.filter(x=>x.s==='in').sort((x,y)=>x.t-y.t).map(x=>x.id),out:a.filter(x=>x.s==='out').map(x=>x.id)}}

export { attendance, curRodada, dupName, fdia, fixos, fmtL, freq, gname, grpAtivo, isAdmin, isAvulso, isOwnerMe, lvl, lvlIn, lvlTag, normName, players, pname, ppos, rat, rodById, rodadas, schedTxt, setLvl, upcoming };
