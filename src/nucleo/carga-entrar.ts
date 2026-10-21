/* Carrega a tela de entrar na primeira vez que precisa (KAN-183), como a gestão (carga-admin.js). */
import { ACT } from '../acoes.js';

type Entrar = typeof import('../entrar');
let E: Entrar | null = null,
  baixando: Promise<Entrar> | null = null;
const entrarPronto = () => E;
function carregarEntrar() {
  return (
    baixando ||
    (baixando = import('../entrar')
      .then(m => {
        Object.assign(ACT, m.ACOES);
        E = m;
        return m;
      })
      .catch(e => {
        baixando = null;
        throw e;
      }))
  );
}
export { carregarEntrar, entrarPronto };
