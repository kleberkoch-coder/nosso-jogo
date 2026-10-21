/* KAN-63: vagas para diaristas e avulsos. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  marcaVaga,
  marcasParaAjustar,
  movimento,
  precisaVaga,
  situacao,
  vagasValidas,
} from '../../src/dominio/vagas.ts';

test('sem controle no grupo, todo mundo entra (como antes)', () => {
  assert.equal(situacao(false, null, null).podeEntrar, true);
  assert.equal(situacao(false, { aberta: false }, { n: 9 }).podeEntrar, true);
});

test('controle ligado: fechadas não entra; abertas entra até o máximo; 0 = sem limite', () => {
  assert.equal(situacao(true, null, null).podeEntrar, false);
  assert.deepEqual(situacao(true, { aberta: true, max: 3 }, { n: 2 }), {
    aberta: true,
    max: 3,
    n: 2,
    cheia: false,
    podeEntrar: true,
  });
  const cheia = situacao(true, { aberta: true, max: 3 }, { n: 3 });
  assert.equal(cheia.cheia, true);
  assert.equal(cheia.podeEntrar, false);
  assert.equal(situacao(true, { aberta: true, max: 0 }, { n: 50 }).podeEntrar, true);
});

test('quem precisa de vaga: avulso (fora do elenco) e jogador com a marca', () => {
  assert.equal(precisaVaga(undefined), true);
  assert.equal(precisaVaga({ vaga: true }), true);
  assert.equal(precisaVaga({}), false);
  assert.equal(precisaVaga({ vaga: false }), false);
});

test('a marca vale só para diarista e só com o controle ligado (isento e mensalista nunca)', () => {
  assert.equal(marcaVaga('diarista', true), true);
  assert.equal(marcaVaga('diarista', false), false);
  assert.equal(marcaVaga('mensalista', true), false);
  assert.equal(marcaVaga('isento', true), false);
});

test('contador: entrar soma, quem estava dentro e sai devolve, o resto não mexe', () => {
  assert.equal(movimento(undefined, 'in'), 1);
  assert.equal(movimento('out', 'in'), 1);
  assert.equal(movimento('in', 'out'), -1);
  assert.equal(movimento('in', 'in'), 0);
  assert.equal(movimento(undefined, 'out'), 0);
});

test('ajuste das marcas: só quem precisa mudar', () => {
  const jog = { a: {}, b: { vaga: true }, c: { vaga: true }, d: {} };
  const tipo = { a: 'diarista', b: 'diarista', c: 'mensalista', d: 'isento' };
  assert.deepEqual(
    marcasParaAjustar(jog, id => tipo[id], true),
    [
      ['a', true],
      ['c', false],
    ]
  );
  assert.deepEqual(
    marcasParaAjustar(jog, id => tipo[id], false),
    [
      ['b', false],
      ['c', false],
    ]
  );
  assert.deepEqual(
    marcasParaAjustar({ a: {} }, () => 'mensalista', false),
    []
  );
});

test('quantidade de vagas: inteiro de 1 a 99; vazio ou inválido = sem limite (0)', () => {
  assert.equal(vagasValidas('3'), 3);
  assert.equal(vagasValidas(''), 0);
  assert.equal(vagasValidas('-2'), 0);
  assert.equal(vagasValidas(150), 99);
});
