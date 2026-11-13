/* Textos dos avisos no celular (KAN-242, pelada-v116), nos três idiomas. Ficam à parte do dicionário do app porque
   quem os usa é o servidor (funcoes/), que não carrega o app; a regra em dominio/avisos.ts escolhe o idioma de cada
   celular. Mesmas chaves e marcadores nos três (testes/regras/avisos.test.mjs confere). */
export type IdiomaAviso = 'pt-BR' | 'en' | 'es';

export const TEXTOS: Record<IdiomaAviso, Record<string, string>> = {
  'pt-BR': {
    vai: '✅ {nome} vai',
    naoVai: '❌ {nome} não vai',
    mudouVai: '🔁 {nome} mudou para Vou',
    mudouNaoVai: '⚠️ {nome} desistiu',
    corpoResposta: '{grupo} · {data} · {n} confirmados',
    corpoResposta1: '{grupo} · {data} · 1 confirmado',
    faltaTitulo: '⏰ Faltam {n} para o mínimo',
    faltaTitulo1: '⏰ Falta 1 para o mínimo',
    faltaPosTitulo: '⏰ Falta gente para o mínimo',
    faltaCorpo: '{grupo} · {data} às {hora} · {conf} de {min} confirmados',
    faltaCorpoSemTotal: '{grupo} · {data} às {hora} · {conf} confirmados',
    faltaPos: 'falta {n} {pos}',
    alguem: 'Alguém',
  },
  en: {
    vai: '✅ {nome} is in',
    naoVai: "❌ {nome} can't make it",
    mudouVai: '🔁 {nome} changed to In',
    mudouNaoVai: '⚠️ {nome} dropped out',
    corpoResposta: '{grupo} · {data} · {n} confirmed',
    corpoResposta1: '{grupo} · {data} · 1 confirmed',
    faltaTitulo: '⏰ {n} more needed for the minimum',
    faltaTitulo1: '⏰ 1 more needed for the minimum',
    faltaPosTitulo: '⏰ Not enough players for the minimum',
    faltaCorpo: '{grupo} · {data} at {hora} · {conf} of {min} confirmed',
    faltaCorpoSemTotal: '{grupo} · {data} at {hora} · {conf} confirmed',
    faltaPos: '{n} {pos} missing',
    alguem: 'Someone',
  },
  es: {
    vai: '✅ {nome} va',
    naoVai: '❌ {nome} no va',
    mudouVai: '🔁 {nome} cambió a Voy',
    mudouNaoVai: '⚠️ {nome} se bajó',
    corpoResposta: '{grupo} · {data} · {n} confirmados',
    corpoResposta1: '{grupo} · {data} · 1 confirmado',
    faltaTitulo: '⏰ Faltan {n} para el mínimo',
    faltaTitulo1: '⏰ Falta 1 para el mínimo',
    faltaPosTitulo: '⏰ Falta gente para el mínimo',
    faltaCorpo: '{grupo} · {data} a las {hora} · {conf} de {min} confirmados',
    faltaCorpoSemTotal: '{grupo} · {data} a las {hora} · {conf} confirmados',
    faltaPos: 'falta {n} {pos}',
    alguem: 'Alguien',
  },
};
