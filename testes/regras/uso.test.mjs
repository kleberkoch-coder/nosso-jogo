/* Uso do app por dia (KAN-313, pelada-v132): o painel do portal. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaUso, resumoDoUso, totalDoUso } from '../../src/dominio/uso.ts';

const regs = {
  '20782_anon1': { dia: 20782, d: '2026-11-25', onde: ['link'], grupos: ['g1'], conta: false, n: 40, e: 6 },
  '20782_anon2': { dia: 20782, d: '2026-11-25', onde: ['voto', 'inicio'], grupos: ['g1', 'g2'], conta: false, n: 10 },
  '20782_dono': { dia: 20782, d: '2026-11-25', onde: ['gestao'], grupos: ['g3'], conta: true, n: 200 },
  '20782_kleber': { dia: 20782, d: '2026-11-25', onde: ['gestao', 'link'], grupos: ['g1'], conta: true, n: 900 },
  '20781_anon1': { dia: 20781, d: '2026-11-24', onde: ['aval'], grupos: [], conta: false, n: 5 },
  '20781_kleber': { dia: 20781, d: '2026-11-24', onde: ['gestao'], conta: true, n: 300 },
};

test('CT-KAN-313-01: por dia, do mais recente: aparelhos, pelo link, com conta, grupos e pedidos', () => {
  const r = resumoDoUso(regs, 'kleber');
  assert.deepEqual(
    r.map(x => x.d),
    ['2026-11-25', '2026-11-24']
  );
  assert.deepEqual(r[0], {
    d: '2026-11-25',
    aparelhos: 3,
    link: 2,
    contas: 1,
    grupos: 3,
    pedidos: 250,
    meus: 1,
    meusPedidos: 900,
  });
  assert.equal(r[1].link, 1, 'a avaliação também é pelo link');
});

test('CT-KAN-313-02: os aparelhos de quem está no portal ficam à parte (tráfego interno)', () => {
  const r = resumoDoUso(regs, 'kleber');
  assert.deepEqual([r[1].aparelhos, r[1].meus, r[1].meusPedidos, r[1].pedidos], [1, 1, 300, 5]);
  const semEu = resumoDoUso(regs, '');
  assert.equal(semEu[0].aparelhos, 4);
  assert.equal(semEu[0].pedidos, 1150);
});

test('CT-KAN-313-03: registro sem data ou com número estranho não quebra a conta', () => {
  const r = resumoDoUso({ a_x: { n: 5 }, b_y: { d: '2026-11-25', n: -3 }, c_z: null }, '');
  assert.deepEqual([r.length, r[0].aparelhos, r[0].pedidos], [1, 1, 0]);
  assert.deepEqual(resumoDoUso({}, 'k'), []);
});

test('CT-KAN-313-04: totais do período e o dia contado em UTC (o mesmo das regras)', () => {
  assert.deepEqual(totalDoUso(resumoDoUso(regs, 'kleber')), { aparelhos: 4, pedidos: 255, meusPedidos: 1200 });
  assert.equal(diaUso(Date.UTC(2026, 10, 25, 2, 59)), 20782);
  assert.equal(diaUso(0), 0);
});
