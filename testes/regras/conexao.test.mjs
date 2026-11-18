/* KAN-276 e KAN-277 (pelada-v120): quando mostrar o aviso de conexão instável e quando pedir um comprovante novo. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCONDIDA_LONGA_MS,
  LIMITE_RECUSA_MS,
  erroDoBancoLocal,
  mostrarAviso,
  pedirAoVoltar,
} from '../../src/dominio/conexao.ts';

const T = 1_800_000_000_000;

test('CT-KAN-276-03: o aviso só aparece com a recusa longa, a aba visível e internet', () => {
  assert.equal(mostrarAviso(null, T, true, true), false, 'sem falha, nada');
  assert.equal(mostrarAviso(T, T + LIMITE_RECUSA_MS - 1, true, true), false, 'antes de 5 minutos, ainda não');
  assert.equal(mostrarAviso(T, T + LIMITE_RECUSA_MS, true, true), true, 'com 5 minutos, mostra');
  assert.equal(mostrarAviso(T, T + LIMITE_RECUSA_MS * 3, false, true), false, 'aba escondida, não');
  assert.equal(
    mostrarAviso(T, T + LIMITE_RECUSA_MS * 3, true, false),
    false,
    'sem internet: a barra Sem internet já explica'
  );
});

test('CT-KAN-276-02: ao voltar a aparecer, pede um comprovante novo se ficou muito tempo escondida ou estava sem', () => {
  assert.equal(pedirAoVoltar(T, T + 2 * 60 * 60 * 1000, false), true, 'computador que dormiu 2 horas');
  assert.equal(pedirAoVoltar(T, T + ESCONDIDA_LONGA_MS - 1, false), false, 'troca rápida de aba, não');
  assert.equal(pedirAoVoltar(T, T + 1000, true), true, 'estava sem comprovante: pede de novo');
  assert.equal(pedirAoVoltar(null, T, false), false);
});

test('CT-KAN-277-01: reconhece a cópia local do banco que quebrou (Safari do iPhone)', () => {
  assert.equal(erroDoBancoLocal('Attempt to get records from database without an in-progress transaction'), true);
  assert.equal(erroDoBancoLocal('Connection to Indexed Database server lost. Refresh the page to try again'), true);
  assert.equal(erroDoBancoLocal('FIRESTORE (10.12.2) INTERNAL ASSERTION FAILED: Unexpected state'), true);
  assert.equal(erroDoBancoLocal('x is null'), false);
  assert.equal(erroDoBancoLocal('permission-denied'), false);
  assert.equal(erroDoBancoLocal(undefined), false);
});
