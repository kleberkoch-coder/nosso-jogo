/* Foto do jogador (KAN-293, pelada-v125). Regra pura, testada em testes/regras/foto.test.mjs.
   - O administrador com a permissão de Elenco escolhe uma imagem JPG, PNG ou WebP de até 5 MB (o limite aparece na
     tela) e confirma, na primeira vez, que tem a autorização do jogador.
   - O app reduz no aparelho para no máximo 800 px no lado maior, sem cortar (o card usa a foto em pé), e grava em
     WebP. O PNG com fundo transparente (a foto recortada pelo próprio celular) continua transparente: no navegador
     que não grava WebP, vai em PNG; a foto sem transparência vai em JPEG.
   - O arquivo vai para o Firebase Storage em grupos/{gid}/jogadores/{pid}/foto-{momento}.webp, com nome novo a cada
     troca. O jogador guarda só o nome do arquivo no campo "foto"; quem autorizou e quando ficam em privado/contatos
     (fa, fp), que só quem tem Elenco lê. */

export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
export const FOTO_MAX_MB = 5;
export const FOTO_LADO = 800;
/* O arquivo já reduzido: as regras do Storage recusam acima disso. */
export const FOTO_MAX_GRAVADO = 600 * 1024;

export { caminhoFoto, enderecoFoto, nomeFotoValido } from './foto-endereco.ts';

/* Pode usar o arquivo escolhido? null = pode; 'tipo' = formato não aceito; 'tamanho' = vazio ou acima de 5 MB. */
export function arquivoFoto(f: { type?: string; size?: number }): null | 'tipo' | 'tamanho' {
  if (!FOTO_TIPOS.includes(String(f.type || '').toLowerCase())) return 'tipo';
  if (!(Number(f.size) > 0) || Number(f.size) > FOTO_MAX_MB * 1024 * 1024) return 'tamanho';
  return null;
}

/* Tamanho reduzido, mantendo a proporção: o lado maior fica com no máximo `max` (foto menor não aumenta). */
export function tamanhoReduzido(w: number, h: number, max = FOTO_LADO): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/* Nome do arquivo novo: foto-<momento>.<webp|png|jpg>. */
export const nomeFoto = (ms: number, tipo: string) =>
  'foto-' + Math.floor(ms) + (tipo === 'image/webp' ? '.webp' : tipo === 'image/png' ? '.png' : '.jpg');

/* Formato a gravar quando o navegador não grava WebP: PNG se a foto tem transparência; senão, JPEG (bem menor). */
export const formatoSemWebp = (temTransparencia: boolean) => (temTransparencia ? 'image/png' : 'image/jpeg');
