/* Endereço da imagem do logotipo do grupo (KAN-273) para o cabeçalho e "Meus grupos". No modo demonstração não há
   Storage: a imagem fica neste navegador (acoes/logo.ts guarda e lê pela mesma chave). */
import { enderecoLogo, nomeLogoValido } from '../dominio/logo-endereco';
import * as banco from '../nucleo/backend.js';

export const chaveDemo = (gid: string, nome: string) => 'pelada-logo:' + gid + ':' + nome;

export function srcLogo(gid: string | null | undefined, nome: unknown): string {
  if (!gid || !nomeLogoValido(nome)) return '';
  if ((banco.B as { demo?: boolean } | null)?.demo) {
    try {
      return localStorage.getItem(chaveDemo(gid, nome)) || '';
    } catch (e) {
      return '';
    }
  }
  const C = (window as unknown as { FIREBASE_CONFIG?: { storageBucket?: string } }).FIREBASE_CONFIG || {};
  return enderecoLogo(C.storageBucket || '', gid, nome);
}
