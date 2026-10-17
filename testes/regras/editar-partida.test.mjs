/* KAN-176: editar uma partida salva ajusta o ranking igual a apagar a antiga e salvar a nova. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, camposEdicao, camposPartida, ranking, resumirTudo } from '../../src/dominio/resumos.ts';

const P = (ga, gb, goals = []) => ({
  id: 'm1',
  rid: 'r1',
  date: '2026-10-05',
  ca: 0,
  cb: 1,
  pa: ['a', 'b'],
  pb: ['c', 'd'],
  ga,
  gb,
  goals,
  at: 1,
});
const doMes = ms => resumirTudo(ms, [], [])['2026-10'];
const linha = (doc, id) => ranking([doc]).find(l => l.id === id) || {};

function editar(antes, depois) {
  const doc = doMes([antes]);
  camposEdicao(antes, depois, 'r1', '2026-10-05').forEach(c => aplicar(doc, c));
  return doc;
}

test('trocar o autor do gol: a artilharia passa de um para o outro (critério 1)', () => {
  const doc = editar(P(1, 0, [{ t: 'a', pid: 'a' }]), P(1, 0, [{ t: 'a', pid: 'b' }]));
  assert.equal(linha(doc, 'a').gols, 0);
  assert.equal(linha(doc, 'b').gols, 1);
  assert.equal(linha(doc, 'a').v, 1);
});

test('tirar o único gol de um 1×0: vira empate para os dois times (critério 2)', () => {
  const doc = editar(P(1, 0, [{ t: 'a', pid: 'a' }]), P(0, 0, []));
  for (const id of ['a', 'b', 'c', 'd']) {
    const l = linha(doc, id);
    assert.deepEqual([l.j, l.v, l.e, l.d], [1, 0, 1, 0], id);
  }
  assert.deepEqual([doc.jogos.m1.ga, doc.jogos.m1.gb], [0, 0]);
});

test('incluir um gol: placar e artilharia sobem (critério 3)', () => {
  const doc = editar(
    P(1, 0, [{ t: 'a', pid: 'a' }]),
    P(1, 1, [
      { t: 'a', pid: 'a' },
      { t: 'b', pid: 'c', pts: 2 },
    ])
  );
  assert.equal(linha(doc, 'c').gols, 2);
  assert.equal(linha(doc, 'c').e, 1);
});

test('editar dá o mesmo ranking que calcular do zero com a partida nova', () => {
  const antes = P(2, 1, [
      { t: 'a', pid: 'a' },
      { t: 'a', pid: 'b' },
      { t: 'b', pid: 'c' },
    ]),
    depois = P(1, 2, [
      { t: 'a', pid: 'a' },
      { t: 'b', pid: 'c' },
      { t: 'b', pid: 'b', og: true },
    ]);
  assert.deepEqual(ranking([editar(antes, depois)]), ranking([doMes([depois])]));
});

test('o ajuste não apaga e grava o mesmo placar ao mesmo tempo', () => {
  const [c] = camposEdicao(P(1, 0), P(2, 0), 'r1', '2026-10-05');
  assert.ok(!c.apagar.includes('jogos.m1'));
  assert.deepEqual(c.gravar['jogos.m1'].ga, 2);
  assert.ok(Object.values(c.somar).every(n => n !== 0));
  assert.ok(camposPartida);
});
