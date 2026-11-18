/* KAN-242: avisos no celular dos administradores. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVES_TEXTO,
  agoraNoFuso,
  faltaAlgo,
  faltas,
  horasValidas,
  jogosNaJanela,
  linkDaRodada,
  temMinimo,
  textoFalta,
  textoResposta,
  textosDe,
  tipoDaResposta,
} from '../../src/dominio/avisos.ts';

test('CT-KAN-242-01: primeira resposta e troca avisam; mesma resposta e apagar não avisam', () => {
  assert.equal(tipoDaResposta(null, { s: 'in' }), 'vai');
  assert.equal(tipoDaResposta(undefined, { s: 'out' }), 'naoVai');
  assert.equal(tipoDaResposta({ s: 'in' }, { s: 'out' }), 'mudouNaoVai');
  assert.equal(tipoDaResposta({ s: 'out' }, { s: 'in' }), 'mudouVai');
  assert.equal(tipoDaResposta({ s: 'in' }, { s: 'in', t: 2 }), null);
  assert.equal(tipoDaResposta({ s: 'in' }, null), null);
  assert.equal(tipoDaResposta({}, { s: 'x' }), null);
});

test('CT-KAN-242-02: horas do aviso de 1 a 24, padrão 3', () => {
  assert.equal(horasValidas(undefined), 3);
  assert.equal(horasValidas('5'), 5);
  assert.equal(horasValidas(0), 3);
  assert.equal(horasValidas(25), 3);
  assert.equal(horasValidas(24), 24);
});

test('CT-KAN-242-03: "agora" no fuso do grupo', () => {
  const ms = Date.UTC(2026, 10, 13, 20, 30); // 20h30 UTC = 17h30 em São Paulo
  const d = agoraNoFuso(ms, 'America/Sao_Paulo');
  assert.deepEqual([d.getDate(), d.getHours(), d.getMinutes()], [13, 17, 30]);
  const ny = agoraNoFuso(ms, 'America/New_York');
  assert.equal(ny.getHours(), 15);
  assert.equal(agoraNoFuso(ms, 'Lugar/Inventado').getHours(), 17); // fuso inválido: o do Brasil
});

test('CT-KAN-242-04: jogos na janela de 3h: gravados e o próximo fixo; cancelado, sem horário e já começado ficam fora', () => {
  const agora = new Date(2026, 10, 13, 17, 30); // sexta, 13/11, 17h30 (local do jogo)
  const docs = {
    r1: { date: '2026-11-13', time: '20:00' }, // em 2h30: entra
    r2: { date: '2026-11-13', time: '21:00' }, // em 3h30: ainda não
    r3: { date: '2026-11-13', time: '19:00', cancelada: true },
    r4: { date: '2026-11-13', time: '' },
    r5: { date: '2026-11-13', time: '17:00' }, // já começou
  };
  const fixos = [
    { dow: 5, ini: '20:30' }, // sexta 20h30, sem documento: entra (virtual)
    { dow: 6, ini: '09:00' }, // sábado: fora
  ];
  const ids = jogosNaJanela(fixos, docs, agora, 3)
    .map(j => j.id)
    .sort();
  assert.deepEqual(ids, ['f-2026-11-13-2030', 'r1']);
  /* Com 4 horas, o das 21h também entra. */
  assert.ok(jogosNaJanela([], docs, agora, 4).some(j => j.id === 'r2'));
  /* Fixo com documento gravado (cancelado): não volta como virtual na mesma data. */
  const comDoc = { 'f-2026-11-13-2030': { date: '2026-11-13', time: '20:30', cancelada: true } };
  assert.deepEqual(jogosNaJanela(fixos, comDoc, agora, 3), []);
});

test('CT-KAN-242-05: o que falta para o mínimo: total e posição; sem mínimo não avisa', () => {
  assert.equal(temMinimo({}), false);
  assert.equal(temMinimo({ _total: 0 }), false);
  assert.equal(temMinimo({ GOL: 2 }), true);
  const conf = [{ pos: 'GOL' }, { pos: 'DEF' }, { pos: 'DEF' }, {}];
  const f = faltas(conf, { _total: 10, GOL: 2, DEF: 2 });
  assert.deepEqual(f, { total: { n: 4, min: 10, falta: 6 }, pos: [{ k: 'GOL', falta: 1 }] });
  assert.equal(faltaAlgo(f), true);
  assert.equal(faltaAlgo(faltas(conf, { _total: 4 })), false);
});

test('CT-KAN-242-06: textos sem notas nem contatos, nos três idiomas, e o link da rodada', () => {
  const r = textoResposta(
    'mudouNaoVai',
    { nome: 'João', grupo: 'Pelada', date: '2026-11-13', confirmados: 11 },
    'pt-BR'
  );
  assert.equal(r.titulo, '⚠️ João desistiu');
  assert.match(r.corpo, /^Pelada · sex, 13\/11 · 11 confirmados$/);
  assert.equal(
    textoResposta('vai', { nome: '', grupo: 'G', date: '2026-11-13', confirmados: 1 }, 'en').titulo,
    '✅ Someone is in'
  );
  const f = faltas([{ pos: 'DEF' }], { _total: 3, GOL: 1 });
  const t = textoFalta(f, { grupo: 'Pelada', date: '2026-11-13', time: '20:00' }, 'pt-BR');
  assert.equal(t.titulo, '⏰ Faltam 2 para o mínimo');
  assert.equal(t.corpo, 'Pelada · sex, 13/11 às 20:00 · 1 de 3 confirmados · falta 1 GOL');
  assert.equal(
    textoFalta(faltas([{}, {}], { _total: 3 }), { grupo: 'G', date: '2026-11-13', time: '20:00' }, 'es').titulo,
    '⏰ Falta 1 para el mínimo'
  );
  for (const l of ['en', 'es']) assert.deepEqual(Object.keys(textosDe(l)).sort(), [...CHAVES_TEXTO].sort());
  assert.equal(linkDaRodada('g1', 'f-2026-11-13-2000'), './#/g/g1/r/f-2026-11-13-2000');
});

test('CT-KAN-272-04: texto do aviso de aniversário, com um ou mais nomes, nos três idiomas', async () => {
  const { textoAniversario } = await import('../../src/dominio/avisos.ts');
  assert.deepEqual(textoAniversario(['João'], { grupo: 'G' }, 'pt-BR'), {
    titulo: '🎂 Hoje é aniversário de João',
    corpo: 'G · mande os parabéns!',
  });
  assert.equal(
    textoAniversario(['Ana', 'Bia', 'Caio'], { grupo: 'G' }, 'pt-BR').titulo,
    '🎂 Hoje fazem aniversário: Ana, Bia e Caio'
  );
  assert.equal(textoAniversario(['Ann', 'Bob'], { grupo: 'G' }, 'en').titulo, '🎂 Birthdays today: Ann and Bob');
});
