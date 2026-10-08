import { LOCAL, MOEDA } from '../i18n/formatos.js';
/* =================== utilidades =================== */
const $=s=>document.querySelector(s);
const main=$('#main');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const cl=o=>o==null?null:JSON.parse(JSON.stringify(o));
const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const brl=v=>(+v||0).toLocaleString(LOCAL,{style:'currency',currency:MOEDA});
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const fdate=s=>{if(!s)return'';return new Date(s+'T12:00').toLocaleDateString(LOCAL,{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','')};
const fmonth=m=>{const t=new Date(m+'-15T12:00').toLocaleDateString(LOCAL,{month:'long',year:'numeric'});return t.charAt(0).toUpperCase()+t.slice(1)};
function toast(m,ms){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),ms||2800)}
function nextSat(){const d=new Date();d.setDate(d.getDate()+((6-d.getDay()+7)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
/* Navegadores embutidos (Instagram, Facebook, alguns apps no Android): o Google não deixa fazer login neles. */
const inAppBrowser=()=>/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|; wv\)/i.test(navigator.userAgent);
const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

export { $, DIAS, brl, cl, esc, fdate, fmonth, inAppBrowser, key, main, nextSat, shuffle, toast, today, uid };
