/* Texto da linha do sorteio (KAN-246, pelada-v109): "Sorteado às 19:42 · 1º sorteio · 2 ajustes manuais depois do
   sorteio". A hora segue o fuso e o relógio (12h ou 24h) do grupo e nunca quebra no meio. Usado no link, na aba
   Rodada e na mensagem dos times no WhatsApp. Com a opção desligada no grupo (cfg.verSorteio === false), só o
   administrador vê (aba Rodada). */
import { sport } from '../dominio/esportes.js';
import { horaTexto } from '../dominio/rodadas.js';
import { horaDoSorteio, sorteioValido } from '../dominio/sorteio-info';
import { FUSO } from '../i18n/formatos.js';
import { tp, tx } from '../i18n/index.js';
import { S } from '../nucleo/estado.js';

export const mostrarSorteio = () =>
  (((S as { app?: { cfg?: { verSorteio?: boolean } } }).app || {}).cfg || {}).verSorteio !== false;

export function textoSorteio(sor: unknown, sempre?: boolean): string {
  if (!sorteioValido(sor) || (!sempre && !mostrarSorteio())) return '';
  const hora = String(horaTexto(horaDoSorteio(sor.em, FUSO))).replace(/ /g, ' ');
  const t = tx((sport() as { pairs?: boolean }).pairs ? 'sortinfo.duplas' : 'sortinfo.feito', { hora, n: sor.n });
  return sor.aj ? t + ' · ' + tp('sortinfo.ajustes', sor.aj) : t;
}
