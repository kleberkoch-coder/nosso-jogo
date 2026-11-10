/* Resultado da votação para o WhatsApp e a planilha de "Quem votou" (KAN-231). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emCsv, linhasDaPlanilha, maisVotados, semFormula } from '../../src/dominio/votacao-resultado.ts';

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

test('CT-KAN-237-01: nome que viraria fórmula no Excel (=, +, -, @, tab, retorno) abre como texto; nomes normais não mudam', () => {
  assert.equal(
    emCsv([['=HYPERLINK("http://x.co","Pix")', '+55 11', '-Zé', '@ana', '\tX', '\rY']], ';'),
    '"\'=HYPERLINK(""http://x.co"",""Pix"")";"\'+55 11";"\'-Zé";"\'@ana";"\'\tX";"\'\rY"'
  );
  assert.equal(semFormula('=1+1'), "'=1+1");
  for (const n of ['Zé "Gol"', 'Peró-zinho', 'Ana; Bia', '⚽ Caio', 'João=Bom', '']) assert.equal(semFormula(n), n);
});

test('CT-KAN-257-01: percentual sobre os votos da categoria, arredondado; formato do número do grupo', async () => {
  const { percentual, textoPct } = await import('../../src/dominio/votacao-resultado.ts');
  assert.deepEqual(
    [5, 4, 3].map(n => percentual(n, 12)),
    [42, 33, 25]
  );
  assert.equal(percentual(0, 0), 0);
  assert.equal(textoPct(42).replace(/\s/g, ' '), '42%');
  assert.equal(textoPct(42, 'es-ES').replace(/\s/g, ' '), '42 %');
});

test('CT-KAN-257-02: "N de M votaram": cada pessoa conta uma vez; voto vazio não conta; gente fora da lista, só "N votos"', async () => {
  const { participacao } = await import('../../src/dominio/votacao-resultado.ts');
  const lista = ['a', 'b', 'c', 'd'];
  assert.deepEqual(
    participacao({ u1: { pid: 'a', v: { m: 'b' } }, r_a: { pid: 'a', v: { m: 'c' } }, u2: { pid: 'b', v: {} } }, lista),
    { n: 1, de: 4 }
  );
  assert.deepEqual(participacao({ u1: { pid: 'z', v: { m: 'b' } } }, lista), { n: 1, de: null });
  assert.deepEqual(participacao({}, []), { n: 0, de: null });
});
