/* Partidas salvas da rodada aberta, em ordem (KAN-149: separado de partidas.js para o link público não baixar a parte de gravação). */
import { S } from './estado.js';
function partidasDe(rid) {
  if (S.partsRid !== rid) return [];
  return Object.entries(S.parts || {})
    .map(([id, m]) => Object.assign({ id }, m))
    .filter(m => m.tipo !== 'art')
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}

/* Artilharia lançada da rodada (KAN-178), guardada junto das partidas com o código "art". */
const ART = 'art';
function artilhariaDe(rid) {
  return S.partsRid === rid ? (S.parts || {})[ART] || null : null;
}

export { ART, artilhariaDe, partidasDe };
