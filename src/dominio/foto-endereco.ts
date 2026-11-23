/* Foto do jogador (KAN-293, pelada-v125): o nome do arquivo e o endereço público. Fica à parte de dominio/foto.ts
   porque o card do jogador (KAN-295) vai mostrar a foto também no link; o resto (escolher e preparar) só baixa na
   ficha do jogador. */
const NOME = /^foto-\d{10,16}\.(webp|png|jpg)$/;
export const nomeFotoValido = (s: unknown): s is string => typeof s === 'string' && NOME.test(s);

export const caminhoFoto = (gid: string, pid: string, nome: string) =>
  'grupos/' + gid + '/jogadores/' + pid + '/' + nome;

/* Endereço público do arquivo no Storage (leitura liberada pelas regras do Storage, como o logotipo). */
export function enderecoFoto(
  bucket: string,
  gid: string,
  pid: string,
  nome: unknown,
  base = 'https://firebasestorage.googleapis.com'
): string {
  if (!bucket || !gid || !pid || !/^[A-Za-z0-9_-]{1,64}$/.test(pid) || !nomeFotoValido(nome)) return '';
  return base + '/v0/b/' + bucket + '/o/' + encodeURIComponent(caminhoFoto(gid, pid, nome)) + '?alt=media';
}
