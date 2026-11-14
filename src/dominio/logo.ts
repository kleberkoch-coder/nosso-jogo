/* Logotipo do grupo (KAN-273, pelada-v118). Regra pura, testada em testes/regras/logo.test.mjs.
   - A pessoa escolhe uma imagem JPG, PNG, WebP ou GIF de até 5 MB (o limite aparece na tela). SVG não entra.
   - O app corta no centro em quadrado e reduz para 256 × 256 (WebP; JPEG no navegador que não grava WebP).
     GIF animado vira imagem parada (o primeiro quadro).
   - O arquivo vai para o Firebase Storage em grupos/{gid}/logo-{momento}.webp, com nome novo a cada troca (pode
     ficar guardado no celular para sempre). O grupo guarda só o nome do arquivo no campo "logo".
   - Aparece no cabeçalho da gestão, no link do jogador, no link da votação e em "Meus grupos". */

export const LOGO_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const LOGO_MAX_MB = 5;
export const LOGO_LADO = 256;
/* O arquivo já reduzido: as regras do Storage recusam acima disso. */
export const LOGO_MAX_GRAVADO = 300 * 1024;

import { nomeLogoValido } from './logo-endereco.ts';
export { enderecoLogo, nomeLogoValido } from './logo-endereco.ts';

/* Pode usar o arquivo escolhido? null = pode; 'tipo' = extensão não aceita; 'tamanho' = acima de 5 MB. */
export function arquivoLogo(f: { type?: string; size?: number }): null | 'tipo' | 'tamanho' {
  if (!LOGO_TIPOS.includes(String(f.type || '').toLowerCase())) return 'tipo';
  if (!(Number(f.size) > 0) || Number(f.size) > LOGO_MAX_MB * 1024 * 1024) return 'tamanho';
  return null;
}

/* O quadrado do meio da imagem (largura x altura) que vira o logotipo. */
export function recorteQuadrado(w: number, h: number): { x: number; y: number; lado: number } {
  const lado = Math.min(w, h);
  return { x: Math.round((w - lado) / 2), y: Math.round((h - lado) / 2), lado };
}

/* Nome do arquivo novo: logo-<momento>.<webp|jpg>. */
export const nomeLogo = (ms: number, tipo: string) =>
  'logo-' + Math.floor(ms) + (tipo === 'image/webp' ? '.webp' : '.jpg');
