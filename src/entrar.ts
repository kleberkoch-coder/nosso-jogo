/* Tela de entrar e criar conta sob demanda (KAN-183): o jogador que só abre o link nunca baixa esta parte.
   Traz a tela, as ações (login, cadastro, Google, recuperar senha, mostrar senha) e os textos dela. */
import estilo from './estilos/entrar.css' with { type: 'text' };
import { usarEstilo } from './ui/estilo';
import textosEntrar from './i18n/pt-BR-entrar';
import { juntarTextos } from './i18n/index.js';
import { acoes } from './acoes/entrar';
usarEstilo('entrar', estilo);

juntarTextos(textosEntrar);

export { AUTH_CANCEL, authMsg, avisoGoogle, checkPw, montarAuth, vAuth } from './telas/Login';
export const ACOES = acoes;
