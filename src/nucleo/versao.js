/* Versão do app (pelada-v19): vem do VERSION do site/sw.js, embutida na montagem (build.mjs).
   Aparece na apresentação, no login, em Meus grupos e na aba Grupo, para todos saberem se o app já atualizou. */
/* global __VERSAO__ */
import { tx } from '../i18n/index.js';
const VERSAO = typeof __VERSAO__ !== 'undefined' ? __VERSAO__ : 'dev';
const numeroVersao = () => VERSAO.replace(/^pelada-v/, '');
const linhaVersao = () => `<p class="versao small muted">${tx('comum.versao', { n: numeroVersao() })}</p>`;

export { VERSAO, linhaVersao, numeroVersao };
