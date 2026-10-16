import { S } from './estado.js';

const baseUrl = () => location.href.split('#')[0];
const linkRodada = id => baseUrl() + '#/p/' + S.gid + '/r/' + id;
const linkVoto = id => baseUrl() + '#/p/' + S.gid + '/v/' + id;
const linkProxima = () => baseUrl() + '#/p/' + S.gid;
const linkConvite = t => baseUrl() + '#/convite/' + S.gid + '/' + t;

/* KAN-141: o local é texto livre ("Society do Zé, Rua X, 100"). Os links abrem a busca desse texto no Google Maps e no Waze,
   sem chave de API nem custo; se o texto for vago, o próprio app de mapa mostra as opções. */
const q = t => encodeURIComponent(String(t || '').trim());
const linkMaps = t => 'https://www.google.com/maps/search/?api=1&query=' + q(t);
const linkWaze = t => 'https://waze.com/ul?q=' + q(t) + '&navigate=yes';

export { linkConvite, linkMaps, linkProxima, linkRodada, linkVoto, linkWaze };
