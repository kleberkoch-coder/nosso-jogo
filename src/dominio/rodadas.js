import { relogio12 } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { faixa, mostrarHora } from './relogio';

/* Horário para mostrar, no relógio do país do grupo (KAN-163): "20:00–22:00" ou "8:00–10:00 PM". */
const periodo = () => ({ am: tx('relogio.am'), pm: tx('relogio.pm') });
const horaTexto = v => mostrarHora(v, relogio12(), periodo());
const faixaTexto = (ini, fim) => faixa(ini, fim, relogio12(), periodo());
const hora = r => (r.time ? faixaTexto(r.time, r.fim) : '');

export { faixaTexto, hora, horaTexto };
