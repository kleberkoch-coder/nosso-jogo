/* O que cada botão (data-a) faz. As ações ficam divididas por assunto em src/acoes/ (organização pedida pelo Arquiteto em 14/10/2026).
   Aqui ficam só as que o link público e o login usam; as de gestão chegam com src/admin.js quando ele carrega (KAN-149). */
import { acoes as conta } from './acoes/conta.js';
import { acoes as publico } from './acoes/publico.js';

const ACT=Object.assign({},conta, publico);

export { ACT };
