/* Resultado da votação para o WhatsApp e a planilha de "Quem votou" (KAN-231). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emCsv, linhasDaPlanilha, maisVotados } from '../../src/dominio/votacao-resultado.ts';

const nome = id => ({ a: 'Ana', b: 'Beto', c: 'Caio', d: 'Dudu' })[id] || id;

test('CT-KAN-231-01: os 3 mais votados, do maior para o menor; empate em ordem alfabética; sem voto, nada', () => {
  assert.deepEqual(maisVotados({ counts: { d: 2, a: 5, c: 2, b: 1 } }, nome), [
    ['a', 5],
    ['c', 2],
    ['d', 2],
  ]);
  assert.deepEqual(maisVotados({ counts: {} }, nome), []);
  assert.deepEqual(maisVotados(undefined, nome), []);
});

test('CT-KAN-231-02: a planilha tem uma coluna por categoria, a hora, as trocas e a marca de quem votou em 2 aparelhos', () => {
  const cats = [
    { id: 'm', name: 'Craque' },
    { id: 'p', name: 'Bagre' },
  ];
  const linhas = [
    { u: 'x', pid: 'a', v: { m: 'b', p: 'c' }, quando: 1000, doServidor: true, trocas: [{}, {}], repetido: false },
    { u: 'y', pid: 'd', v: { m: 'a' }, quando: null, doServidor: false, trocas: [], repetido: true },
  ];
  const rows = linhasDaPlanilha(
    linhas,
    cats,
    nome,
    { quem: 'Quem votou', hora: 'Hora', trocas: 'Trocas', repetido: 'votou em 2 aparelhos' },
    () => '01/01 10:00'
  );
  assert.deepEqual(rows, [
    ['Quem votou', 'Craque', 'Bagre', 'Hora', 'Trocas'],
    ['Ana', 'Beto', 'Caio', '01/01 10:00', '2'],
    ['Dudu (votou em 2 aparelhos)', 'Ana', '', '', '0'],
  ]);
});

test('CT-KAN-231-02: o CSV põe aspas em cada célula e dobra as aspas internas', () => {
  assert.equal(
    emCsv(
      [
        ['a', 'b;c'],
        ['Zé "Gol"', ''],
      ],
      ';'
    ),
    '"a";"b;c"\r\n"Zé ""Gol""";""'
  );
});
