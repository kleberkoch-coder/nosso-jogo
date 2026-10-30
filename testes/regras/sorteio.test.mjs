/* Regra "sorteio de times" (uma das 5 da D12; KAN-220). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { custo, historico, par, qualidade, sortear, tamanhos } from '../../src/dominio/sorteio-regra.ts';

/* Sorteador fixo (sempre a mesma sequência), para o teste dar sempre o mesmo resultado. */
function semente(s = 7) {
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const media = (t, nota) => t.reduce((s, id) => s + nota(id), 0) / t.length;
const ids = n => Array.from({ length: n }, (_, i) => 'j' + i);

test('tamanhos: o mais parecido possível, os primeiros com um a mais', () => {
  assert.deepEqual(tamanhos(10, 2), [5, 5]);
  assert.deepEqual(tamanhos(11, 2), [6, 5]);
  assert.deepEqual(tamanhos(14, 3), [5, 5, 4]);
});

test('todos entram, ninguém repete, e os times têm os tamanhos certos', () => {
  const js = ids(14),
    T = sortear(js, 3, { nota: () => 5, pos: () => undefined, posicoes: [], aleatorio: semente() });
  assert.equal(T.length, 3);
  assert.deepEqual(T.map(t => t.length).sort(), [4, 5, 5]);
  assert.deepEqual(T.flat().sort(), js.slice().sort());
});

test('equilíbrio de notas: 5 craques (10) e 5 iniciantes (1) ficam 3 e 2 em cada time (o melhor possível)', () => {
  const js = ids(10),
    nota = id => (+id.slice(1) < 5 ? 10 : 1);
  for (let s = 1; s <= 5; s++) {
    const T = sortear(js, 2, { nota, pos: () => undefined, posicoes: [], aleatorio: semente(s) });
    const cr = T.map(t => t.filter(id => nota(id) === 10).length).sort();
    assert.deepEqual(cr, [2, 3], `craques por time ${cr} (sorteio ${s})`);
    assert.ok(Math.abs(media(T[0], nota) - media(T[1], nota)) < 1.81);
  }
});

test('craques (nota 9 ou mais) se espalham: nenhum time fica com 2 a mais que o outro', () => {
  const js = ids(12),
    nota = id => (['j0', 'j1', 'j2', 'j3'].includes(id) ? 9.5 : 5);
  const T = sortear(js, 2, { nota, pos: () => undefined, posicoes: [], aleatorio: semente(3) });
  const cr = T.map(t => t.filter(id => nota(id) >= 9).length);
  assert.ok(Math.abs(cr[0] - cr[1]) <= 1, `craques por time: ${cr}`);
});

test('posições: 2 goleiros vão um para cada time; zagueiros se dividem', () => {
  const pos = { j0: 'GOL', j1: 'GOL', j2: 'DEF', j3: 'DEF', j4: 'DEF', j5: 'DEF' };
  const js = ids(12);
  for (let s = 1; s <= 5; s++) {
    const T = sortear(js, 2, {
      nota: () => 5,
      pos: id => pos[id],
      posicoes: ['GOL', 'DEF', 'MEI', 'ATA'],
      chave: 'GOL',
      aleatorio: semente(s),
    });
    assert.deepEqual(
      T.map(t => t.filter(id => pos[id] === 'GOL').length),
      [1, 1]
    );
    assert.deepEqual(
      T.map(t => t.filter(id => pos[id] === 'DEF').length),
      [2, 2]
    );
  }
});

test('pares separados ("não colocar no mesmo time") ficam em times diferentes', () => {
  const js = ids(10),
    separados = [
      ['j0', 'j1'],
      ['j2', 'j3'],
      ['j4', 'j5'],
    ];
  for (let s = 1; s <= 5; s++) {
    const T = sortear(js, 2, { nota: () => 5, pos: () => undefined, posicoes: [], separados, aleatorio: semente(s) });
    for (const [a, b] of separados) assert.ok(!T.some(t => t.includes(a) && t.includes(b)), `${a} e ${b} juntos`);
  }
});

test('variar parceiros: com "Muito", quem jogou junto na última rodada tende a se separar', () => {
  const js = ids(8),
    anterior = [{ times: [{ players: ['j0', 'j1', 'j2', 'j3'] }, { players: ['j4', 'j5', 'j6', 'j7'] }] }],
    h = historico(anterior),
    base = { nota: () => 5, pos: () => undefined, posicoes: [], historico: h };
  let repetidosMuito = 0,
    repetidosNao = 0;
  const repetidos = T =>
    T.flatMap(t => t.flatMap((a, i) => t.slice(i + 1).map(b => par(a, b)))).filter(k => h[k]).length;
  for (let s = 1; s <= 8; s++) {
    repetidosMuito += repetidos(sortear(js, 2, { ...base, variar: 3, aleatorio: semente(s) }));
    repetidosNao += repetidos(sortear(js, 2, { ...base, variar: 0, aleatorio: semente(s) }));
  }
  assert.ok(repetidosMuito < repetidosNao, `Muito: ${repetidosMuito} pares repetidos; Não: ${repetidosNao}`);
});

test('histórico: rodada mais antiga pesa menos (0,8 por rodada)', () => {
  const h = historico([{ times: [{ players: ['a', 'b'] }] }, { times: [{ players: ['a', 'b'] }] }, {}]);
  assert.equal(h[par('a', 'b')], 1.8);
});

test('custo: juntar um par separado custa mais que qualquer desequilíbrio pequeno', () => {
  const o = { nota: () => 5, pos: () => undefined, posicoes: [], separados: [['a', 'b']] };
  assert.ok(
    custo(
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      o
    ) >= 500
  );
  assert.equal(
    custo(
      [
        ['a', 'c'],
        ['b', 'd'],
      ],
      o
    ),
    0
  );
});

test('qualidade: diferença de média, pares separados juntos e parcerias novas', () => {
  const nota = id => ({ a: 8, b: 6, c: 4, d: 2 })[id];
  const q = qualidade(
    [{ players: ['a', 'b'] }, { players: ['c', 'd'] }],
    { nota, pos: () => undefined, separados: [['a', 'b']] },
    [{ players: ['a', 'c'] }, { players: ['b', 'd'] }]
  );
  assert.equal(q.diff, 4);
  assert.equal(q.viol, 1);
  assert.equal(q.nsep, 1);
  assert.equal(q.newPct, 100);
  assert.equal(q.gk, null);
});
