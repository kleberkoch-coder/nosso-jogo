import { pname, ppos, rodDoc } from '../dominio/grupo.js';
import { idOk } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';

/* ---------- Votação ---------- */
function tally(v,votos){const res={};v.cats.forEach(c=>res[c.id]={counts:{},total:0,winners:[]});
  Object.values(votos||{}).forEach(d=>Object.entries(d.v||{}).forEach(([cid,pid])=>{if(res[cid]&&idOk(pid)){res[cid].counts[pid]=(res[cid].counts[pid]||0)+1;res[cid].total++}}));
  Object.values(res).forEach(x=>{const mx=Math.max(0,...Object.values(x.counts));x.winners=mx?Object.keys(x.counts).filter(k=>x.counts[k]===mx):[]});return res}
function candidates(v,c){const r=rodDoc(v.rid);if(!r||!r.times)return[];let ids=r.times.flatMap(t=>t.players);if(c.pos)ids=ids.filter(id=>ppos(id)===c.pos);return ids.sort((a,b)=>pname(a).localeCompare(pname(b),LOCAL))}

export { candidates, tally };
