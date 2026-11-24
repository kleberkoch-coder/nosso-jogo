/* O que vai escrito num card (KAN-294 e KAN-295): o mesmo para a prévia do editor (números de exemplo), para o card da
   ficha e para o "Meu card" do link (números de verdade). Os textos vêm de i18n/pt-BR-cardj.ts. */
import { ESPACOS, valor, type Modelo, type Numeros, type TipoCard, type Uso } from '../dominio/cards';
import { sport } from '../dominio/esportes.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-cardj';
import type { DadosCard } from './CardDesenho';

juntarTextos(textos);

const palavra = () => String((sport() as { word?: string }).word || '');
export const curtoEstat = (k: string) => tx('card.curto.' + k, { PONTO: palavra().toUpperCase() });

export function iniciais(nome: string) {
  const p = nome.split(/\s+/).filter(Boolean);
  return ((p[0] || '?')[0]! + (p[1] ? p[1][0] : (p[0] || '')[1] || '')).toUpperCase();
}

export function dadosDoCard(
  m: Modelo,
  u: Uso,
  tipo: TipoCard,
  j: { nome: string; pos: string; foto: string },
  n: Numeros,
  grupo: { logo: string; nome: string }
): DadosCard {
  return {
    nome: j.nome,
    pos: j.pos,
    foto: j.foto,
    logo: grupo.logo,
    iniciais: iniciais(grupo.nome || ''),
    titulo: u.titulo || tx('card.tituloPadrao.' + tipo),
    grande: valor(u.grande, n),
    rotGrande: curtoEstat(u.grande),
    campos: u.campos
      .slice(0, ESPACOS[m.base])
      .filter(Boolean)
      .map(k => ({ r: curtoEstat(k), v: valor(k, n) })),
  };
}
