/* Mata-mata do campeonato (KAN-233, pelada-v97). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCamp, mataOpcoes, mataPadrao, novoCampeonato } from '../../src/dominio/campeonato.ts';
import { chave, semeadura } from '../../src/dominio/mata-mata.ts';

const j = (a, b, ga, gb, at = 2000) => ({ a, b, ga, gb, at });
const camp = (n, mm, dec = {}) => ({ ...novoCampeonato(n, ['saldo', 'gp'], 1000, 7, mm), dec });
/* Todos contra todos com 4 times: classificação final Time 2 (1), Time 1 (0), Time 3 (2), Time 4 (3). */
const grupo4 = [j(0, 1, 2, 0), j(2, 3, 1, 0), j(0, 2, 0, 0), j(1, 3, 3, 0), j(0, 3, 1, 1), j(1, 2, 4, 1)];

test('CT-KAN-233-09: padrão do mata-mata pelo número de times (decisão do Kleber)', () => {
  assert.deepEqual(mataPadrao(3), { k: 2, t3: false });
  assert.deepEqual(mataPadrao(4), { k: 2, t3: true });
  assert.deepEqual(mataPadrao(5), { k: 4, t3: false });
  assert.deepEqual(mataPadrao(7), { k: 4, t3: false });
  assert.deepEqual(mataPadrao(8), { k: 8, t3: false });
  assert.deepEqual(mataPadrao(16), { k: 8, t3: false });
  assert.deepEqual(
    mataOpcoes(3).map(o => o.k + (o.t3 ? '+3' : '')),
    ['0', '2']
  );
  assert.deepEqual(
    mataOpcoes(8).map(o => o.k + (o.t3 ? '+3' : '')),
    ['0', '2', '2+3', '4', '4+3', '8', '8+3']
  );
  /* Campeonato da v96 (sem mata-mata gravado) ganha o padrão; um inválido também. */
  const v96 = { em: 1, n: 4, jogos: ['0-1'], crit: [], sem: 1 };
  assert.deepEqual(lerCamp(v96, 4).mm, { k: 2, t3: true });
  assert.deepEqual(lerCamp({ ...v96, mm: { k: 8, t3: false } }, 4).mm, { k: 2, t3: true });
});

test('CT-KAN-233-09: semeadura: 1º e 2º só se cruzam na final', () => {
  assert.deepEqual(semeadura(2), [1, 2]);
  assert.deepEqual(semeadura(4), [1, 4, 2, 3]);
  assert.deepEqual(semeadura(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('CT-KAN-233-10: 4 times, final e 3º lugar: 3º × 4º primeiro, depois 1º × 2º; a chave só aparece com a tabela fechada', () => {
  const c = camp(4);
  const antes = chave(c, grupo4.slice(0, 5));
  assert.equal(antes.grupoAcabou, false);
  assert.deepEqual(
    antes.slots.map(s => [s.id, s.a, s.b]),
    [
      ['t3', null, null],
      ['f', null, null],
    ]
  );
  assert.equal(antes.proximo, null);
  const k = chave(c, grupo4);
  assert.deepEqual(
    k.slots.map(s => [s.id, s.a, s.b]),
    [
      ['t3', 2, 3],
      ['f', 1, 0],
    ]
  );
  assert.equal(k.proximo.id, 't3');
  /* A final repete um jogo da fase de todos contra todos: vale a partida seguinte, não a antiga. */
  const fim = chave(c, grupo4.concat(j(3, 2, 2, 1, 3000), j(0, 1, 3, 2, 3001)));
  assert.equal(fim.proximo, null);
  assert.deepEqual([fim.campeao, fim.vice, fim.terceiro], [0, 1, 3]);
});

test('CT-KAN-233-11: empate no mata-mata: falta dizer quem passou; com a escolha (e os pênaltis), a chave anda', () => {
  const ms = grupo4.concat(j(2, 3, 0, 0, 3000));
  const k = chave(camp(4), ms);
  const t3 = k.slots[0];
  assert.equal(t3.falta, true);
  assert.equal(t3.venc, null);
  assert.equal(k.proximo.id, 'f', 'o próximo jogo é a final, mesmo com o 3º lugar pendente');
  const k2 = chave(camp(4, undefined, { t3: { p: 3, a: 3, b: 4 } }), ms);
  assert.equal(k2.slots[0].falta, false);
  assert.deepEqual([k2.slots[0].venc, k2.slots[0].perd, k2.slots[0].dec], [3, 2, { p: 3, a: 3, b: 4 }]);
  /* Escolha de um time que não está no jogo é ignorada */
  assert.equal(chave(camp(4, undefined, { t3: { p: 1 } }), ms).slots[0].falta, true);
});

test('CT-KAN-233-12: semifinais com 5 times (1º × 4º, 2º × 3º), vencedores na final', () => {
  /* 5 times, todos contra todos: quem tem o índice menor vence (0 é 1º, 1 é 2º…). */
  const c = camp(5),
    ms = c.jogos.map((p, i) => {
      const [a, b] = p.split('-').map(Number);
      return j(a, b, a < b ? 1 : 0, a < b ? 0 : 1, 1500 + i);
    });
  const k = chave(c, ms);
  assert.deepEqual(
    k.slots.map(s => [s.id, s.a, s.b]),
    [
      ['s0', 0, 3],
      ['s1', 1, 2],
      ['f', null, null],
    ]
  );
  const k2 = chave(c, ms.concat(j(3, 0, 2, 0, 3000), j(1, 2, 1, 0, 3001)));
  assert.deepEqual([k2.slots[2].a, k2.slots[2].b], [3, 1]);
  assert.equal(k2.proximo.id, 'f');
  const k3 = chave(c, ms.concat(j(3, 0, 2, 0, 3000), j(1, 2, 1, 0, 3001), j(1, 3, 2, 2, 3002)));
  assert.equal(k3.slots[2].falta, true);
  assert.equal(k3.campeao, null);
});

test('CT-KAN-233-12: 8 times: quartas 1×8, 4×5, 2×7, 3×6; sem mata-mata, o campeão é o 1º da tabela', () => {
  const c = camp(8),
    ms = c.jogos.map((p, i) => {
      const [a, b] = p.split('-').map(Number);
      return j(a, b, 1, 0, 1500 + i);
    });
  assert.deepEqual(
    chave(c, ms)
      .slots.filter(s => s.fase === 'q')
      .map(s => [s.a, s.b]),
    [
      [0, 7],
      [3, 4],
      [1, 6],
      [2, 5],
    ]
  );
  const sem = chave(camp(8, { k: 0, t3: false }), ms);
  assert.deepEqual([sem.slots.length, sem.campeao, sem.vice, sem.terceiro], [0, 0, 1, 2]);
});

test('CT-KAN-238-01: o campeonato acaba com a final (e o 3º lugar) decididos; sem mata-mata, com o último jogo da tabela', () => {
  const c = camp(4);
  assert.equal(chave(c, grupo4).encerrado, false);
  const soFinal = chave(c, grupo4.concat(j(1, 0, 1, 0, 3000)));
  assert.deepEqual([soFinal.encerrado, soFinal.proximo.id], [false, 't3'], 'final antes do 3º: ainda falta o 3º lugar');
  const fim = chave(c, grupo4.concat(j(2, 3, 1, 0, 3000), j(1, 0, 1, 0, 3001)));
  assert.deepEqual([fim.encerrado, fim.proximo], [true, null]);
  const sem = camp(4, { k: 0, t3: false });
  assert.equal(chave(sem, grupo4.slice(0, 5)).encerrado, false);
  assert.equal(chave(sem, grupo4).encerrado, true);
});

test('CT-KAN-238-01: empate sem quem passou e nenhum jogo possível: o mata-mata fica esperando a decisão', () => {
  const k = chave(camp(4, { k: 4, t3: false }), grupo4.concat(j(1, 3, 0, 0, 3000), j(0, 2, 2, 1, 3001)));
  assert.deepEqual([k.proximo, k.encerrado, k.esperando.map(s => s.id)], [null, false, ['s0']]);
});

test('CT-KAN-238-02: de que jogo é cada partida: todos contra todos, mata-mata ou fora do campeonato', () => {
  const antes = j(0, 1, 9, 9, 500);
  const ms = [antes].concat(grupo4, j(3, 2, 2, 1, 3000), j(0, 1, 3, 2, 3001), j(0, 1, 1, 1, 4000));
  assert.deepEqual(chave(camp(4), ms).fases, [null, 'g', 'g', 'g', 'g', 'g', 'g', 't3', 'f', null]);
});
