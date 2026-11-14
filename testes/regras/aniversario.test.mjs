/* KAN-272: data de nascimento e aniversariantes. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aniversariantesDoMes,
  aniversariantesNoDia,
  aniversarioNoAno,
  aniversarioPerto,
  lerNascimento,
  nascValido,
} from '../../src/dominio/aniversario.ts';

const HOJE = '2026-11-14';

test('CT-KAN-272-01: data válida de 1900 até hoje', () => {
  assert.equal(nascValido('1990-05-31', HOJE), true);
  assert.equal(nascValido('1990-02-30', HOJE), false);
  assert.equal(nascValido('1899-12-31', HOJE), false);
  assert.equal(nascValido('2027-01-01', HOJE), false);
  assert.equal(nascValido('31/05/1990', HOJE), false);
});

test('CT-KAN-272-02: semana do aniversário (3 dias antes e depois), inclusive na virada do ano e em 29/02', () => {
  assert.equal(aniversarioPerto('1990-11-16', '2026-11-14'), true);
  assert.equal(aniversarioPerto('1990-11-11', '2026-11-14'), true);
  assert.equal(aniversarioPerto('1990-11-18', '2026-11-14'), false);
  assert.equal(aniversarioPerto('1990-01-02', '2026-12-31'), true);
  assert.equal(aniversarioPerto('1990-12-30', '2027-01-01'), true);
  assert.equal(aniversarioNoAno('2000-02-29', 2027), '2027-02-28');
  assert.equal(aniversarioNoAno('2000-02-29', 2028), '2028-02-29');
  assert.equal(aniversarioPerto(undefined, HOJE), false);
});

test('CT-KAN-272-03: aniversariantes do mês em ordem do dia, só do elenco ativo', () => {
  const cont = {
    a: { tel: '1', nasc: '1990-11-28' },
    b: { nasc: '1985-11-03' },
    c: { nasc: '1985-12-01' },
    d: { tel: '2' },
    e: { nasc: '1999-11-10' },
  };
  assert.deepEqual(aniversariantesDoMes(cont, '2026-11', ['a', 'b', 'c', 'd']), [
    { id: 'b', dia: 3 },
    { id: 'a', dia: 28 },
  ]);
  assert.deepEqual(aniversariantesNoDia(cont, '2026-11-28'), ['a']);
  assert.deepEqual(aniversariantesNoDia({ x: { nasc: '2000-02-29' } }, '2027-02-28'), ['x']);
});

test('CT-KAN-272-05: nascimento da planilha', () => {
  assert.equal(lerNascimento('31/05/1990', HOJE), '1990-05-31');
  assert.equal(lerNascimento('1.2.1980', HOJE), '1980-02-01');
  assert.equal(lerNascimento('1990-05-31', HOJE), '1990-05-31');
  assert.equal(lerNascimento('05/31/1990', HOJE, true), '1990-05-31');
  assert.equal(lerNascimento('', HOJE), '');
  assert.equal(lerNascimento('31/02/1990', HOJE), null);
  assert.equal(lerNascimento('ontem', HOJE), null);
});

test('CT-KAN-272-05: a planilha entende a coluna "Nascimento" e avisa a data que não entende', async () => {
  const { interpretar } = await import('../../src/dominio/planilha.ts');
  const ctx = { posicoes: [], existentes: new Set(), normalizar: s => s.toLowerCase(), hoje: HOJE };
  const r = interpretar(
    [
      ['Nome', 'Nascimento'],
      ['Ana', '31/05/1990'],
      ['Bia', 'ontem'],
    ],
    ctx
  );
  assert.equal(r.itens[0].nasc, '1990-05-31');
  assert.equal(r.itens[1].nasc, undefined);
  assert.deepEqual(r.itens[1].avisos, ['nasc']);
});
