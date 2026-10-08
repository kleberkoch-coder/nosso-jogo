import { sport, tn } from '../dominio/esportes.js';
import { pname, rodadas } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { esc, fdate } from '../nucleo/util.js';

/* ---------- Ranking ---------- */
function computeStats(){const s={},g=id=>s[id]||(s[id]={id,j:0,v:0,e:0,d:0,gols:0,mvp:0,bagre:0});
  rodadas().forEach(r=>(r.matches||[]).forEach(m=>{const res=m.ga>m.gb?'a':m.ga<m.gb?'b':'e';
    m.pa.forEach(id=>{const x=g(id);x.j++;res==='a'?x.v++:res==='e'?x.e++:x.d++});m.pb.forEach(id=>{const x=g(id);x.j++;res==='b'?x.v++:res==='e'?x.e++:x.d++});
    m.goals.forEach(gl=>{if(gl.pid&&!gl.og)g(gl.pid).gols+=(gl.pts||1)})}));
  Object.values(S.vot).filter(v=>!v.open&&v.resultado).forEach(v=>v.cats.forEach(c=>(v.resultado[c.id]?.winners||[]).forEach(id=>{c.neg?g(id).bagre++:g(id).mvp++})));
  return Object.values(s).map(x=>Object.assign(x,{pts:x.v*3+x.e,ap:x.j?Math.round((x.v*3+x.e)/(x.j*3)*100):0}))}
function vRanking(){const st=computeStats(),k=S.rankSort;st.sort((a,b)=>(b[k]-a[k])||(b.pts-a.pts)||(b.gols-a.gols));
  const rs=rodadas().filter(r=>(r.matches||[]).length);
  const cols=[['pts','Pts'],['j','J'],['v','V'],['e','E'],['d','D'],['ap','Aprov.'],['gols',sport().word],['mvp','Destaques'],['bagre','Bagre']];
  return `<div class="stack"><div class="row between"><h2>Ranking</h2><label class="row small muted">Ordenar por <select class="sel" style="width:auto" data-c="rank">${cols.map(([c,l])=>`<option value="${c}" ${c===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
  ${st.length?`<div class="panel tbl"><table><thead><tr><th>#</th><th>Jogador</th>${cols.map(([,l])=>`<th>${l}</th>`).join('')}</tr></thead><tbody>
  ${st.map((x,i)=>`<tr class="${i===0?'lead':''}"><td>${i+1}</td><td>${esc(pname(x.id))}</td><td class="pts">${x.pts}</td><td>${x.j}</td><td>${x.v}</td><td>${x.e}</td><td>${x.d}</td><td>${x.ap}%</td><td>${x.gols}</td><td>${x.mvp}</td><td>${x.bagre}</td></tr>`).join('')}</tbody></table>
  <p class="small muted" style="margin-top:8px">Vitória 3 pts, empate 1. Destaques e bagres vêm das votações encerradas.</p></div>`
  :'<div class="panel empty"><h2>Sem partidas ainda</h2><p class="muted">O ranking aparece quando a primeira partida for salva.</p></div>'}
  ${rs.length?`<div class="panel"><h3>Histórico</h3><ul class="plist wrap">${rs.map(r=>`<li><b style="min-width:110px">${fdate(r.date)}</b><span class="small muted pn">${r.matches.map(m=>`${tn(m.ca)} ${m.ga}×${m.gb} ${tn(m.cb)}`).join(' · ')}</span></li>`).join('')}</ul></div>`:''}</div>`}

export { vRanking };
