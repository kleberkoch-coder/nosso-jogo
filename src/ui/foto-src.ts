/* Endereço da foto do jogador (KAN-293). No modo demonstração não há Storage: a imagem fica neste navegador
   (acoes/foto.ts guarda e lê pela mesma chave). */
import { enderecoFoto, nomeFotoValido } from '../dominio/foto-endereco';
import * as banco from '../nucleo/backend.js';

export const chaveDemoFoto = (gid: string, pid: string, nome: string) => 'pelada-foto:' + gid + ':' + pid + ':' + nome;

export function srcFoto(gid: string | null | undefined, pid: string | null | undefined, nome: unknown): string {
  if (!gid || !pid || !nomeFotoValido(nome)) return '';
  if ((banco.B as { demo?: boolean } | null)?.demo) {
    try {
      return localStorage.getItem(chaveDemoFoto(gid, pid, nome)) || '';
    } catch (e) {
      return '';
    }
  }
  const W = window as unknown as {
    FIREBASE_CONFIG?: { storageBucket?: string };
    FIREBASE_EMULADOR?: { storage?: string };
  };
  const em = W.FIREBASE_EMULADOR?.storage;
  return enderecoFoto((W.FIREBASE_CONFIG || {}).storageBucket || '', gid, pid, nome, em ? 'http://' + em : undefined);
}
