/* Idioma da pessoa (KAN-164): aplica (textos, catálogo, nomes de dias e meses e o "lang" da página) e grava a escolha.
   A escolha fica no aparelho (para o primeiro desenho já sair no idioma certo) e na conta (usuarios/{uid}.idioma),
   para valer também em outro aparelho. */
import { aplicarCatalogo } from '../dominio/esportes.js';
import { LOCAL } from '../i18n/formatos.js';
import { CHAVE_IDIOMA, carregarIdioma, idiomaValido, type Idioma, type Parte } from '../i18n/idiomas';
import * as banco from './backend.js';
import { adm } from './carga-admin.js';
import { S } from './estado';

// O banco é JavaScript sem tipos e é trocado ao iniciar (setB): lido na hora.
const bk = (): any => (banco as any).B;

function guardarNoAparelho(id: Idioma) {
  try {
    localStorage.setItem(CHAVE_IDIOMA, id);
  } catch (e) {
    /* sem armazenamento */
  }
}
/* Aplica o idioma. Com a gestão já baixada, baixa também os textos dela. */
export function usarIdioma(id: Idioma, partes?: Parte[]): Promise<void> {
  const p: Parte[] = partes || (adm() ? ['base', 'gestao'] : ['base']);
  return carregarIdioma(id, p)
    .catch(e => console.warn('idioma', e))
    .then(() => {
      aplicarCatalogo();
      document.documentElement.lang = LOCAL;
    });
}
export const idiomaAtual = () => LOCAL as Idioma;

/* Menu da conta → Idioma: grava no aparelho e na conta, e redesenha. */
export function trocarIdioma(id: Idioma, redesenhar: () => void): Promise<void> {
  if (!idiomaValido(id)) return Promise.resolve();
  guardarNoAparelho(id);
  const u = S.user;
  if (u && !u.anon) {
    S.me = Object.assign({}, S.me, { idioma: id });
    bk()
      .patch('usuarios/' + u.uid, { idioma: id })
      .catch((e: unknown) => console.warn('idioma', e));
  }
  return usarIdioma(id).then(redesenhar);
}
/* A conta chegou com outro idioma (escolhido em outro aparelho): passa a usar o dela. */
export function idiomaDaConta(id: unknown, redesenhar: () => void) {
  if (!idiomaValido(id) || id === LOCAL) return;
  guardarNoAparelho(id);
  usarIdioma(id).then(redesenhar);
}
