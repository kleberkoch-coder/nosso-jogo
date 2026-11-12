/* KAN-190 (parte 2): material do grupo e com quem cada um está. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionar, comPessoa, passar, remover, situacao, HIST_MAX } from '../../src/dominio/material.ts';

let n = 0;
const id = () => 'm' + ++n;
const bolas = () => [
  { id: 'b1', nome: 'Bola', com: 'kleber' },
  { id: 'b2', nome: 'Bola', com: 'diegao' },
  { id: 'b3', nome: 'Bola', com: 'gu' },
  { id: 'c1', nome: 'Coletes', com: 'kleber' },
];

test('CT-KAN-190-08: 3 bolas e ninguém confirmou: "nenhum", com os três nomes; o Gu confirma e vira 1 de 3', () => {
  let [b] = situacao(bolas(), {});
  assert.equal(b.nome, 'Bola');
  assert.equal(b.total, 3);
  assert.ok(b.nenhum);
  assert.deepEqual(b.semResposta, ['kleber', 'diegao', 'gu']);
  [b] = situacao(bolas(), { gu: { s: 'in' } });
  assert.ok(!b.nenhum);
  assert.deepEqual(b.vao, ['gu']);
});

test('CT-KAN-190-09: quem guarda e disse "Não vou" aparece separado', () => {
  const [b] = situacao(bolas(), { diegao: { s: 'out' }, kleber: { s: 'in' } });
  assert.deepEqual(b.naoVao, ['diegao']);
  assert.deepEqual(b.vao, ['kleber']);
  assert.deepEqual(b.semResposta, ['gu']);
});

test('CT-KAN-190-10: passar a bola do Gu para o Rafa muda quem guarda e registra no histórico', () => {
  const r = passar(bolas(), [], 'b3', 'rafa', 1000);
  assert.equal(r.mat.find(x => x.id === 'b3').com, 'rafa');
  assert.deepEqual(r.matHist[0], { nome: 'Bola', de: 'gu', para: 'rafa', em: 1000 });
  assert.equal(passar(r.mat, r.matHist, 'b3', 'rafa', 2000), null, 'passar para quem já está não grava nada');
  assert.equal(passar(bolas(), [], 'nao-existe', 'rafa', 1), null);
});

test('o histórico guarda só as 10 trocas mais recentes', () => {
  let m = bolas(),
    h = [];
  for (let i = 0; i < 15; i++) ({ mat: m, matHist: h } = passar(m, h, 'b1', 'p' + i, i));
  assert.equal(h.length, HIST_MAX);
  assert.equal(h[0].para, 'p14');
});

test('adicionar "Bola" × 3 cria 3 itens com a mesma pessoa; nome vazio não cria; até 10 de uma vez', () => {
  const m = adicionar([], ' Bola ', 3, 'kleber', id);
  assert.equal(m.length, 3);
  assert.ok(m.every(x => x.nome === 'Bola' && x.com === 'kleber'));
  assert.equal(new Set(m.map(x => x.id)).size, 3);
  assert.equal(adicionar(m, '   ', 2, null, id).length, 3);
  assert.equal(adicionar([], 'Cone', 50, null, id).length, 10);
});

test('o que está com cada pessoa e remover um item', () => {
  assert.deepEqual(comPessoa(bolas(), 'kleber'), [
    ['Bola', 1],
    ['Coletes', 1],
  ]);
  assert.deepEqual(comPessoa(bolas(), null), []);
  assert.equal(remover(bolas(), 'b2').length, 3);
  /* Dado estranho do banco é ignorado. */
  assert.deepEqual(situacao([null, { id: 1 }, { id: 'x', nome: '' }], {}), []);
});
