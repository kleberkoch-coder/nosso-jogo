import { cfg } from '../dominio/caixa.js';
import { cl, uid } from './util.js';

/* =================== backends =================== */
function FirebaseBackend(cfg){
  firebase.initializeApp(cfg);const auth=firebase.auth(),fs=firebase.firestore();try{fs.enablePersistence({synchronizeTabs:true}).catch(()=>{})}catch(e){}
  return{demo:false,
    onAuth:cb=>auth.onAuthStateChanged(u=>cb(u?{uid:u.uid,email:u.email,anon:u.isAnonymous}:null)),
    login:(e,p)=>auth.signInWithEmailAndPassword(e,p),
    signup:(e,p)=>auth.createUserWithEmailAndPassword(e,p),
    reset:e=>auth.sendPasswordResetEmail(e),
    logout:()=>auth.signOut(),
    anon:()=>auth.signInAnonymously(),
    /* Google: abre a janela de escolha de conta. Se o navegador bloquear janelas
       (alguns celulares e o app instalado), troca para o redirecionamento de página inteira. */
    google:async()=>{const pv=new firebase.auth.GoogleAuthProvider();pv.setCustomParameters({prompt:'select_account'});
      try{return await auth.signInWithPopup(pv)}
      catch(e){if(e&&['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported'].includes(e.code)){await auth.signInWithRedirect(pv);return new Promise(()=>{})}throw e}},
    redirectResult:()=>auth.getRedirectResult(),
    sub(path,cb,err){
      if(path.split('/').length%2)return fs.collection(path).onSnapshot(s=>{const o={};s.forEach(d=>o[d.id]=d.data());cb(o)},err);
      return fs.doc(path).onSnapshot({includeMetadataChanges:false},s=>{if(!s.exists&&s.metadata.fromCache&&path.startsWith('usuarios/')&&navigator.onLine)return;cb(s.exists?s.data():null)},err)},
    /* Consulta ao vivo com filtro de data e limite (D10): q = {campo, de, ate, ordem:'asc'|'desc', limite}. */
    query(path,q,cb,err){return fsQuery(fs,path,q).onSnapshot(s=>{const o={};s.forEach(d=>o[d.id]=d.data());cb(o)},err)},
    /* Uma página de resultados, sem ficar ouvindo (Histórico). cursor vem da página anterior. */
    async pagina(path,q,cursor){let x=fsQuery(fs,path,q);if(cursor)x=x.startAfter(cursor);const s=await x.get();
      return{itens:s.docs.map(d=>[d.id,d.data()]),cursor:s.docs[s.docs.length-1]||null,fim:s.docs.length<q.limite}},
    async get(path){if(path.split('/').length%2){const s=await fs.collection(path).get(),o={};s.forEach(d=>o[d.id]=d.data());return o}
      const s=await fs.doc(path).get();return s.exists?s.data():null},
    set:(p,o)=>fs.doc(p).set(o),
    /* Grava só os campos informados (D4): duas pessoas mexendo em campos diferentes não se apagam,
       e funciona sem internet. Valores especiais: op.uniao([...]), op.remover([...]), op.apagar(). */
    patch:(p,campos)=>{const FV=firebase.firestore.FieldValue,o={};
      for(const k in campos){const v=campos[k];o[k]=v&&v.$op==='uniao'?FV.arrayUnion(...v.v):v&&v.$op==='remover'?FV.arrayRemove(...v.v):v&&v.$op==='apagar'?FV.delete():v}
      return fs.doc(p).set(o,{merge:true})},
    del:p=>fs.doc(p).delete(),
    newId:()=>fs.collection('_').doc().id};
}
function fsQuery(fs,path,q){let x=fs.collection(path);if(q.de)x=x.where(q.campo,'>=',q.de);if(q.ate)x=x.where(q.campo,'<=',q.ate);
  x=x.orderBy(q.campo,q.ordem||'asc');return q.limite?x.limit(q.limite):x}
/* Operações especiais para patch(). */
const op={uniao:v=>({$op:'uniao',v}),remover:v=>({$op:'remover',v}),apagar:()=>({$op:'apagar'})};
const igual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function LocalBackend(){
  const K='pelada-demo-v2';let store={},user=null;
  try{store=JSON.parse(localStorage.getItem(K)||'{}');user=JSON.parse(localStorage.getItem(K+'-u')||'null')}catch(e){}
  const subs=new Set(),acb=new Set();
  const save=()=>{try{localStorage.setItem(K,JSON.stringify(store))}catch(e){}};
  const read=path=>{const n=path.split('/').length;if(n%2){const o={};for(const p in store){const s=p.split('/');if(s.length===n+1&&p.startsWith(path+'/'))o[s[n]]=store[p]}return o}return store[path]??null};
  const notify=()=>subs.forEach(s=>s.cb(cl(read(s.path))));
  const filtrar=(path,q)=>{let e=Object.entries(read(path)).filter(([,d])=>d&&d[q.campo]!=null&&(!q.de||d[q.campo]>=q.de)&&(!q.ate||d[q.campo]<=q.ate));
    e.sort((x,y)=>String(x[1][q.campo]).localeCompare(String(y[1][q.campo]))*(q.ordem==='desc'?-1:1));return q.limite?e.slice(0,q.limite):e};
  const setU=u=>{user=u;try{localStorage.setItem(K+'-u',JSON.stringify(u))}catch(e){}acb.forEach(f=>f(u))};
  const lg=async(e,p)=>{if(!e||!p)throw{code:'auth/invalid-credential'};setU({uid:'u-'+e.toLowerCase().replace(/[^a-z0-9]/g,''),email:e.toLowerCase(),anon:false})};
  return{demo:true,
    onAuth(cb){acb.add(cb);setTimeout(()=>cb(user),0)},
    login:lg,signup:lg,reset:async()=>{},logout:async()=>setU(null),
    google:async hint=>{await sleep(500);const e=/\S+@\S+\.\S+/.test(hint||'')?hint:'organizador.teste@gmail.com';return lg(e,'google')},
    redirectResult:async()=>null,
    anon:async()=>setU({uid:'anon-'+uid(),email:null,anon:true}),
    sub(path,cb){const s={path,cb};subs.add(s);setTimeout(()=>cb(cl(read(path))),0);return()=>subs.delete(s)},
    query(path,q,cb){const run=()=>cb(cl(Object.fromEntries(filtrar(path,q))));const s={path,cb:run};subs.add(s);setTimeout(run,0);return()=>subs.delete(s)},
    async pagina(path,q,cursor){const todos=filtrar(path,Object.assign({},q,{limite:0})),ini=cursor||0,itens=todos.slice(ini,ini+q.limite);
      await sleep(150);return{itens:cl(itens),cursor:ini+itens.length,fim:ini+itens.length>=todos.length}},
    async get(path){await sleep(100);return cl(read(path))},
    set:async(p,o)=>{store[p]=cl(o);save();notify();await sleep(250)},
    patch:async(p,campos)=>{const d=cl(store[p])||{};
      for(const k in campos){const v=campos[k];
        if(v&&v.$op==='uniao'){d[k]=(d[k]||[]).concat(v.v.filter(x=>!(d[k]||[]).some(y=>igual(x,y))))}
        else if(v&&v.$op==='remover'){d[k]=(d[k]||[]).filter(y=>!v.v.some(x=>igual(x,y)))}
        else if(v&&v.$op==='apagar')delete d[k];else d[k]=cl(v)}
      store[p]=d;save();notify();await sleep(250)},
    del:async p=>{delete store[p];save();notify();await sleep(250)},
    newId:uid};
}
let B=null;
let CAP=null;
function track(pr){if(CAP&&pr&&pr.then)CAP.push(pr);return pr}
function wrapBackend(b){['set','patch','del','login','signup','reset','logout','google'].forEach(k=>{const f=b[k];b[k]=(...a)=>track(f.apply(b,a))});return b}
const BUSY=new Map();
const busyKey=el=>[el.dataset.a,el.dataset.v,el.dataset.p,el.dataset.i,el.dataset.c2].join('|');
function setBusy(el,on){if(!el)return;if(el.dataset&&el.dataset.a){const k=busyKey(el);if(on)BUSY.set(k,(BUSY.get(k)||0)+1);else{const n=(BUSY.get(k)||1)-1;n>0?BUSY.set(k,n):BUSY.delete(k)}}
  el.classList.toggle('busy',on);el.setAttribute('aria-busy',on?'true':'false')}
function applyBusy(){document.querySelectorAll('[data-a]').forEach(el=>{const on=BUSY.has(busyKey(el));if(on!==el.classList.contains('busy')){el.classList.toggle('busy',on);el.setAttribute('aria-busy',on?'true':'false')}})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* Alteradas por outros módulos (o import de um módulo ES é só leitura). */
function setB(v){B=v}
function setCAP(v){CAP=v}

export { B, CAP, FirebaseBackend, LocalBackend, applyBusy, op, setB, setBusy, setCAP, sleep, wrapBackend };
