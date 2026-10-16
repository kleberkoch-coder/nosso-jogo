/* Regra "rodadas fixas: próxima data" (uma das 5 da D12). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTs, fixId, proximasFixas } from '../../src/dominio/rodadas-fixas.ts';

// 2026-10-05 é segunda-feira (dow 1)
const SEG = { dow: 1, ini: '20:00', fim: '22:00', place: 'Quadra' };
const em = s => new Date(s);

test('antes do jogo, a próxima é a do mesmo dia', () => {
  const [r] = proximasFixas([SEG], {}, em('2026-10-05T10:00'));
  assert.equal(r.date, '2026-10-05');
  assert.equal(r.id, fixId('2026-10-05', '20:00'));
  assert.equal(r.virtual, true);
});

test('durante o jogo continua a mesma rodada', () => {
  assert.equal(proximasFixas([SEG], {}, em('2026-10-05T21:00'))[0].date, '2026-10-05');
});

test('depois do término vira para a semana seguinte', () => {
  assert.equal(proximasFixas([SEG], {}, em('2026-10-05T22:30'))[0].date, '2026-10-12');
});

test('sem horário de término, vale até o fim do dia', () => {
  assert.equal(proximasFixas([{ dow: 1, ini: '20:00' }], {}, em('2026-10-05T23:00'))[0].date, '2026-10-05');
});

test('jogo que passa da meia-noite termina no dia seguinte', () => {
  assert.equal(endTs({ date: '2026-10-05', time: '23:00', fim: '01:00' }), new Date('2026-10-06T01:00').getTime());
});

test('jogo que passa da meia-noite continua sendo a próxima rodada até o término (KAN-111)', () => {
  const sex = { dow: 5, ini: '23:00', fim: '01:00' }; // 2026-10-09 é sexta
  assert.equal(proximasFixas([sex], {}, em('2026-10-09T23:30'))[0].date, '2026-10-09');
  assert.equal(proximasFixas([sex], {}, em('2026-10-10T00:30'))[0].date, '2026-10-09');
  assert.equal(proximasFixas([sex], {}, em('2026-10-10T01:30'))[0].date, '2026-10-16');
});

test('data cancelada pula para a semana seguinte', () => {
  const docs = { [fixId('2026-10-05', '20:00')]: { date: '2026-10-05', cancelada: true } };
  assert.equal(proximasFixas([SEG], docs, em('2026-10-05T10:00'))[0].date, '2026-10-12');
});

test('rodada já gravada não é repetida como virtual', () => {
  const docs = { [fixId('2026-10-05', '20:00')]: { date: '2026-10-05', time: '20:00', fim: '22:00' } };
  assert.deepEqual(proximasFixas([SEG], docs, em('2026-10-05T10:00')), []);
});

test('dois dias fixos geram uma próxima rodada cada', () => {
  const qua = { dow: 3, ini: '19:00' };
  assert.deepEqual(
    proximasFixas([SEG, qua], {}, em('2026-10-05T10:00')).map(r => r.date),
    ['2026-10-05', '2026-10-07']
  );
});
