/* Aniversário na gestão (KAN-272, pelada-v118): o 🎂 e os "Aniversariantes do mês" ficam em ui/Aniversario.tsx,
   que só baixa quando algum jogador tem data de nascimento (privado/contatos, só com Elenco). Assim a gestão abre
   leve para quem não usa. */
import { S as estado } from '../nucleo/estado.js';
import { changed } from './render.js';

type Mod = typeof import('./Aniversario');
let mod: Mod | null = null,
  pedido = false;
const temNasc = () =>
  Object.values(((estado as Record<string, any>).cont || {}) as Record<string, any>).some(c => c?.nasc);
function carregado(): Mod | null {
  if (!mod && !pedido && temNasc()) {
    pedido = true;
    import('./Aniversario')
      .then(m => {
        mod = m;
        changed();
      })
      .catch(() => (pedido = false));
  }
  return mod;
}

export function Bolo(p: { id: string; data: string }) {
  const m = carregado();
  return m ? <m.Bolo {...p} /> : null;
}
export function Aniversariantes(p: { ids: string[]; hoje: string }) {
  const m = carregado();
  return m ? <m.Aniversariantes {...p} /> : null;
}
