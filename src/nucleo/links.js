import { S } from './estado.js';

const baseUrl=()=>location.href.split('#')[0];
const linkRodada=id=>baseUrl()+'#/p/'+S.gid+'/r/'+id;
const linkVoto=id=>baseUrl()+'#/p/'+S.gid+'/v/'+id;
const linkProxima=()=>baseUrl()+'#/p/'+S.gid;
const linkConvite=t=>baseUrl()+'#/convite/'+S.gid+'/'+t;

export { linkConvite, linkProxima, linkRodada, linkVoto };
