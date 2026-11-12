/* KAN-245: sorteio rápido, sem conta. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faltamPara, sortearRapido, textoRapido } from '../../src/dominio/sorteio-rapido.ts';

/* Sorteador fixo, para o teste não variar. */
function fixo(seed = 7) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
const nomes = n => Array.from({ length: n }, (_, i) => ({ nome: 'J' + (i + 1) }));
const OP = { porTime: 5, duplas: false, posicoes: ['GOL', 'DEF', 'MEI', 'ATA'], chave: 'GOL' };

test('CT-KAN-245-01: 10 nomes, 5 por time: 2 times de 5, todos sorteados uma vez', () => {
  const r = sortearRapido(nomes(10), Object.assign({ aleatorio: fixo() }, OP));
  assert.equal(r.faltam, 0);
  assert.equal(r.times.length, 2);
  assert.deepEqual(
    r.times.map(t => t.players.length),
    [5, 5]
  );
  assert.deepEqual(
    r.times.flatMap(t => t.players).sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.ok(r.times.every(t => t.res.length === 0));
});

test('CT-KAN-245-03: menos gente que 2 times completos diz quantos faltam e não sorteia', () => {
  assert.deepEqual(sortearRapido(nomes(3), OP), { faltam: 7 });
  assert.equal(faltamPara(9, 5, false), 1);
  assert.equal(faltamPara(3, 2, true), 1);
  assert.equal(faltamPara(10, 5, false), 0);
});

test('CT-KAN-245-01: equilibra pela nota e espalha goleiros', () => {
  const js = [
    { nome: 'Craque1', nota: 10 },
    { nome: 'Craque2', nota: 10 },
    { nome: 'G1', pos: 'GOL', nota: 5 },
    { nome: 'G2', pos: 'GOL', nota: 5 },
    ...Array.from({ length: 6 }, (_, i) => ({ nome: 'X' + i, nota: 4 })),
  ];
  const r = sortearRapido(js, Object.assign({ aleatorio: fixo(3) }, OP));
  for (const t of r.times) {
    assert.equal(t.players.filter(p => js[p].nota === 10).length, 1, 'um craque em cada time');
    assert.equal(t.players.filter(p => js[p].pos === 'GOL').length, 1, 'um goleiro em cada time');
  }
});

test('CT-KAN-245-07: 12 nomes, 5 por time: 2 times de 6 com 1 reserva cada (o mais embaixo na lista)', () => {
  const r = sortearRapido(nomes(12), Object.assign({ aleatorio: fixo() }, OP));
  assert.equal(r.times.length, 2);
  for (const t of r.times) {
    assert.equal(t.res.length, 1);
    assert.equal(t.res[0], Math.max(...t.players));
  }
});

test('CT-KAN-245-07: goleiro no fim da lista não vira reserva quando há outro para ficar de fora', () => {
  const js = [...nomes(10), { nome: 'G1', pos: 'GOL' }, { nome: 'G2', pos: 'GOL' }];
  const r = sortearRapido(js, Object.assign({ aleatorio: fixo(5) }, OP));
  for (const t of r.times) {
    assert.equal(t.res.length, 1);
    assert.notEqual(js[t.res[0]].pos, 'GOL');
  }
});

test('CT-KAN-245-05: duplas (beach tennis): 8 pessoas viram 4 duplas, sem posição', () => {
  const r = sortearRapido(nomes(8), { porTime: 2, duplas: true, posicoes: [], chave: null, aleatorio: fixo() });
  assert.equal(r.times.length, 4);
  assert.ok(r.times.every(t => t.players.length === 2));
});

test('CT-KAN-245-06: o texto do WhatsApp leva os times e os nomes, nunca as notas', () => {
  const js = [
    { nome: 'Ana', nota: 9 },
    { nome: 'Bia', nota: 3 },
    { nome: 'Caio', nota: 7 },
  ];
  const t = textoRapido(
    [
      { players: [0, 2], res: [2] },
      { players: [1], res: [] },
    ],
    js,
    {
      titulo: '⚽ Times sorteados',
      time: i => 'Time ' + (i + 1),
      reserva: 'reserva',
      rodape: 'Sorteado no Nosso Jogo',
    }
  );
  assert.equal(
    t,
    '⚽ Times sorteados\n\n*Time 1*\n• Ana\n• Caio (reserva)\n\n*Time 2*\n• Bia\n\nSorteado no Nosso Jogo'
  );
  assert.ok(!/[0-9](?![^*]*\*)/.test(t.replace(/Time \d/g, '')), 'nenhuma nota no texto');
});
