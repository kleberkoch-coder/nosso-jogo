import { B } from './backend.js';
import { toast, today } from './util.js';
import { changed } from '../ui/render.js';

/* =================== estado =================== */
const S={user:null,route:{n:'admin'},tab:'rodada',rid:null,vid:null,month:today().slice(0,7),live:null,rankSort:'pts',
  owner:undefined,admins:{},myInv:null,app:null,rat:null,jog:{},rod:{},pres:{},caixa:{},vot:{},votos:{},conv:{},loaded:{}};
const SUBS={};
function gp(p){const base='grupos/'+S.gid;return p==='config/app'?base:base+'/'+p}
const GB={set:(p,o)=>B.set(gp(p),o),del:p=>B.del(gp(p))};
function subRaw(k,path,cb){drop(k);SUBS[k]=B.sub(path,d=>{S.loaded[k]=true;cb(d);changed()},e=>{S.loaded[k]=true;console.warn(k,e);changed()})}
function sub(k,path,cb){drop(k);SUBS[k]=B.sub(gp(path),d=>{S.loaded[k]=true;cb(d);changed()},e=>{S.loaded[k]=true;console.warn(k,e);changed()})}
function drop(k){if(SUBS[k]){SUBS[k]();delete SUBS[k]}delete S.loaded[k]}
function dropAll(){Object.keys(SUBS).forEach(drop)}
function w(p){return Promise.resolve(p).catch(e=>{console.error(e);toast(e&&e.code==='permission-denied'?'Sem permissão para isso.':'Não foi possível salvar. Verifique a conexão.');throw e})}
const clean=o=>JSON.parse(JSON.stringify(o));

export { GB, S, SUBS, clean, drop, dropAll, gp, sub, subRaw, w };
