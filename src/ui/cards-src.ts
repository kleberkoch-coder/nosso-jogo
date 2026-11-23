/* Imagem de fundo dos cards do grupo (KAN-294, fase 2, pelada-v127): caminho no Storage e endereço público. No modo
   demonstração não há Storage: a imagem fica neste navegador (mesma chave para gravar e mostrar). */
import { nomeFundoValido } from '../dominio/cards';
import * as banco from '../nucleo/backend.js';

export const caminhoFundo = (gid: string, nome: string) => 'grupos/' + gid + '/cards/' + nome;
export const chaveDemoFundo = (gid: string, nome: string) => 'pelada-fundo:' + gid + ':' + nome;

export function srcFundo(gid: string | null | undefined, nome: unknown): string {
  if (!gid || !nomeFundoValido(nome)) return '';
  if ((banco.B as { demo?: boolean } | null)?.demo) {
    try {
      return localStorage.getItem(chaveDemoFundo(gid, nome)) || '';
    } catch (e) {
      return '';
    }
  }
  const W = window as unknown as {
    FIREBASE_CONFIG?: { storageBucket?: string };
    FIREBASE_EMULADOR?: { storage?: string };
  };
  const bucket = (W.FIREBASE_CONFIG || {}).storageBucket || '';
  if (!bucket) return '';
  const em = W.FIREBASE_EMULADOR?.storage;
  const base = em ? 'http://' + em : 'https://firebasestorage.googleapis.com';
  return base + '/v0/b/' + bucket + '/o/' + encodeURIComponent(caminhoFundo(gid, nome)) + '?alt=media';
}
