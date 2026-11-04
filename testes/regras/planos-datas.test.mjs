/* KAN-211: datas dos avisos dos planos no relógio de Brasília. Roda com: npm run regras */
process.env.TZ = 'America/Sao_Paulo';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { PLANOS_PADRAO, TRANSICAO_PADRAO, diasParaAcabar, situacao, ultimoDia } = await import(
  '../../src/dominio/planos.ts'
);
const dia = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const BRT = (d, h, m = 0) => Date.UTC(2026, 10, d, h + 3, m);

test('KAN-211: a transição acaba na virada de 28 para 29/11; o aviso mostra 28/11, o último dia que vale', () => {
  assert.equal(TRANSICAO_PADRAO, BRT(29, 0));
  assert.equal(dia(ultimoDia(TRANSICAO_PADRAO)), '28/11/2026');
  // o teste de 14 dias começa e acaba no mesmo horário: o último dia é o próprio dia do fim
  assert.equal(dia(ultimoDia(BRT(18, 15, 32))), '18/11/2026');
});

test('KAN-211: "acaba hoje" no dia 28/11 e "acaba em 1 dia" no dia 27/11 (dias do calendário)', () => {
  const s = situacao(null, PLANOS_PADRAO, BRT(20, 10), TRANSICAO_PADRAO);
  assert.equal(s.origem, 'transicao');
  assert.equal(diasParaAcabar(s, BRT(28, 10)), 0);
  assert.equal(diasParaAcabar(s, BRT(28, 23, 59)), 0);
  assert.equal(diasParaAcabar(s, BRT(27, 23)), 1);
  assert.equal(diasParaAcabar(s, BRT(25, 10)), 3);
  assert.equal(diasParaAcabar(s, BRT(24, 23)), null);
});
