import { w } from '../nucleo/estado.js';
import { render } from './render.js';

/* =================== tema (Automático, Claro, Escuro) =================== */
/* A escolha fica salva neste aparelho e vale para todos, inclusive jogadores sem conta. */
const THEMES=[['auto','🌓','Automático'],['light','☀️','Claro'],['dark','🌙','Escuro']];
const TEMA_K='nj-tema';
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function getTheme(){try{const t=localStorage.getItem(TEMA_K);return t==='light'||t==='dark'?t:'auto'}catch(e){return 'auto'}}
function effTheme(){const t=getTheme();return t==='auto'?(darkMQ.matches?'dark':'light'):t}
const themeDef=()=>THEMES.find(x=>x[0]===getTheme());
const themeLabel=()=>'Tema: '+themeDef()[2];
function applyTheme(){const t=getTheme(),h=document.documentElement;if(t==='auto')h.removeAttribute('data-theme');else h.setAttribute('data-theme',t);
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=effTheme()==='dark'?'#173A2A':'#1F5A40';
  document.querySelectorAll('[data-a=themeMenu]').forEach(b=>{b.textContent=themeDef()[1];b.setAttribute('aria-label',themeLabel());b.title=themeLabel()})}
function themeOpts(){const t=getTheme(),now=effTheme()==='dark'?'escuro':'claro';
  return THEMES.map(([k,ic,l])=>`<button role="menuitemradio" aria-checked="${t===k}" data-a="setTheme" data-v="${k}"><span class="ic" aria-hidden="true">${ic}</span>${l}${k==='auto'?`<span class="hint">agora: ${now}</span>`:''}</button>`).join('')}
let themeMenuEl=null,themeAnchor=null;
function closeThemeMenu(back){if(!themeMenuEl)return;themeMenuEl.remove();themeMenuEl=null;if(themeAnchor){themeAnchor.setAttribute('aria-expanded','false');if(back&&themeAnchor.isConnected)themeAnchor.focus({preventScroll:true})}themeAnchor=null}
function openThemeMenu(anchor){closeThemeMenu();themeAnchor=anchor;anchor.setAttribute('aria-expanded','true');
  const m=document.createElement('div');m.className='theme-menu';m.setAttribute('role','menu');m.setAttribute('aria-label','Tema');
  m.innerHTML='<p class="tm-t" aria-hidden="true">Tema</p>'+themeOpts();document.body.appendChild(m);themeMenuEl=m;
  const r=anchor.getBoundingClientRect(),w=m.offsetWidth;m.style.top=Math.round(r.bottom+scrollY+8)+'px';m.style.left=Math.round(scrollX+Math.max(8,Math.min(innerWidth-w-8,r.right-w)))+'px';
  (m.querySelector('[aria-checked=true]')||m.querySelector('button')).focus({preventScroll:true})}
function vTemaPanel(){const t=getTheme();return `<div class="panel"><h3>Aparência</h3><div class="theme-seg" role="radiogroup" aria-label="Tema">${THEMES.map(([k,ic,l])=>`<button role="radio" aria-checked="${t===k}" data-a="setTheme" data-v="${k}"><span aria-hidden="true">${ic}</span> ${l}</button>`).join('')}</div>
  <p class="small muted" style="margin:8px 0 0">${t==='auto'?'Segue o tema do celular (agora: '+(effTheme()==='dark'?'escuro':'claro')+'). ':''}Vale só para este aparelho.</p></div>`}
/* Quando o celular troca entre claro e escuro, o modo Automático acompanha. */
darkMQ.addEventListener('change',()=>{applyTheme();if(getTheme()==='auto')render()});

export { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeDef, themeLabel, themeMenuEl, vTemaPanel };
