/* Logotipo do grupo (KAN-273): o nome do arquivo e o endereço público. Fica à parte de dominio/logo.ts porque vai
   no link do jogador (o resto, de escolher e preparar a imagem, só baixa em Editar grupo). */
const NOME = /^logo-\d{10,16}\.(webp|jpg)$/;
export const nomeLogoValido = (s: unknown): s is string => typeof s === 'string' && NOME.test(s);

/* Endereço público do arquivo no Storage (leitura liberada pelas regras do Storage). */
export function enderecoLogo(
  bucket: string,
  gid: string,
  nome: unknown,
  base = 'https://firebasestorage.googleapis.com'
): string {
  if (!bucket || !gid || !nomeLogoValido(nome)) return '';
  return base + '/v0/b/' + bucket + '/o/' + encodeURIComponent('grupos/' + gid + '/' + nome) + '?alt=media';
}
