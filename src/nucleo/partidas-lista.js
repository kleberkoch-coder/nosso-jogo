/* Partidas salvas da rodada aberta, em ordem (KAN-149: separado de partidas.js para o link público não baixar a parte de gravação). */
import { S } from './estado.js';
function partidasDe(rid) {
  if (S.partsRid !== rid) return [];
  return Object.entries(S.parts || {})
    .map(([id, m]) => Object.assign({ id }, m))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}

export { partidasDe };
