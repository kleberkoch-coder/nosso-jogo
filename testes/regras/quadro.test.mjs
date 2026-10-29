/* KAN-212: quadro de mensalidades do ano e o resumo por competência. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesesDoAno, pagosPorComp, quadroDoAno } from '../../src/dominio/quadro.ts';
import { aplicar, camposMensal, resumirTudo } from '../../src/dominio/resumos.ts';

test('12 competências do ano', () => {
  const m = mesesDoAno('2026');
  assert.equal(m.length, 12);
  assert.equal(m[0], '2026-01');
  assert.equal(m[11], '2026-12');
});

test('células: pago, em aberto, sem cobrança, antes de entrar e futuro', () => {
  const q = quadroDoAno({
    ano: '2026',
    hoje: '2026-10',
    mensalistas: [{ pid: 'a' }, { pid: 'b', entrou: '2026-09' }],
    pagos: { '2026-01': { a: 85 }, '2026-09': { b: 85, x: 85 }, '2026-12': { a: 85 } },
    semMensal: (pid, c) => pid === 'a' && (c === '2026-05' || c === '2026-06'),
  });
  const a = q.linhas[0].cel,
    b = q.linhas[1].cel;
  assert.equal(a[0].estado, 'pago');
  assert.equal(a[1].estado, 'aberto');
  assert.equal(a[4].estado, 'isento');
  assert.equal(a[9].estado, 'aberto'); // outubro, a atual
  assert.equal(a[10].estado, 'futuro');
  assert.equal(a[11].estado, 'pago'); // adiantada
  assert.equal(b[7].estado, 'antes');
  assert.equal(b[8].estado, 'pago');
  assert.equal(b[9].estado, 'aberto');
  assert.equal(q.linhas[0].aberto, 7); // fev, mar, abr, jul, ago, set, out
  assert.equal(q.linhas[1].aberto, 1);
  // Rodapé: recebido inclui quem não é mais mensalista (x); abertos por mês
  assert.equal(q.recebido[8], 170);
  assert.equal(q.pagaram[8], 2);
  assert.equal(q.abertos[9], 2);
  assert.equal(q.abertos[10], 0);
});

test('mensalidade paga conta na competência (ref), não no mês do dinheiro', () => {
  const l = { k: 'mensal', v: 85, d: '2026-11-03', pid: 'a', ref: '2026-10' };
  const c = camposMensal(l, 1);
  assert.equal(c.mes, '2026-10');
  assert.deepEqual(c.somar, { 'mens.a': 8500 });
  assert.equal(camposMensal({ k: 'entrada', v: 10, d: '2026-11-03' }, 1).mes, '');
  assert.equal(camposMensal({ k: 'mensal', v: 10, d: '2026-11-03', pid: 'a' }, 1).mes, '');
  const doc = aplicar({ mes: '2026-10', cx: {} }, c);
  aplicar(doc, camposMensal(l, -1));
  assert.equal(doc.mens.a, 0);
  const r = resumirTudo([], [l], []);
  assert.equal(r['2026-10'].mens.a, 8500);
  assert.equal(r['2026-11'].cx.ent, 8500);
});

test('pagos: junta o resumo (centavos) e os lançamentos carregados (reais)', () => {
  const p = pagosPorComp(
    [{ mes: '2026-09', mens: { a: 8500, b: 0 } }],
    [
      { k: 'mensal', v: 85, pid: 'b', ref: '2026-09' },
      { k: 'mensal', v: 85, pid: 'a', ref: '2026-09' },
      { k: 'diaria', v: 20, pid: 'c', ref: 'r1' },
    ]
  );
  assert.deepEqual(p, { '2026-09': { a: 85, b: 85 } });
});
