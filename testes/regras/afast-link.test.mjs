/* KAN-271: afastado aparece como "Não vou" no link. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcasAfastParaAjustar, periodosDe } from '../../src/dominio/afast-link.ts';
import { afastadoNaData } from '../../src/dominio/afast-data.ts';

const AFS = {
  a1: { pid: 'j1', mot: 'Lesao', obs: 'joelho', de: '2026-11', ate: '2026-12' },
  a2: { pid: 'j2', mot: 'Ferias', de: '2026-09', ate: '2026-10' }, // já acabou
  a3: { pid: 'j3', mot: 'Viagem', de: '2026-12' }, // até voltar
};

test('CT-KAN-271-04: a marca tem só as datas (sem motivo), dos afastamentos atuais e futuros, pelo ciclo', () => {
  assert.deepEqual(periodosDe(AFS, null, 'j1', '2026-11'), [{ de: '2026-11-01', ate: '2026-12-31' }]);
  assert.deepEqual(periodosDe(AFS, null, 'j2', '2026-11'), []);
  assert.deepEqual(periodosDe(AFS, null, 'j3', '2026-11'), [{ de: '2026-12-01', ate: '' }]);
  /* Ciclo de 21 a 20: novembro vai de 21/11 a 20/12. */
  const ciclo = [{ desde: '0000-01', dia: 21 }];
  assert.deepEqual(
    periodosDe({ a: { pid: 'j1', mot: 'Lesao', de: '2026-11', ate: '2026-11' } }, ciclo, 'j1', '2026-11'),
    [{ de: '2026-11-21', ate: '2026-12-20' }]
  );
  assert.ok(!JSON.stringify(periodosDe(AFS, null, 'j1', '2026-11')).includes('joelho'));
});

test('CT-KAN-271-04: grava só quem precisa mudar; tira a marca de quem voltou', () => {
  const jog = {
    j1: { name: 'A' },
    j2: { name: 'B', af: [{ de: '2026-09-01', ate: '2026-10-31' }] },
    j3: { name: 'C', af: [{ de: '2026-12-01', ate: '' }] },
    j4: { name: 'D' },
  };
  assert.deepEqual(marcasAfastParaAjustar(jog, AFS, null, '2026-11-13'), [
    ['j1', [{ de: '2026-11-01', ate: '2026-12-31' }]],
    ['j2', []],
  ]);
});

test('CT-KAN-271-01 e 03: no link, afastado na data da rodada; fora do período, normal', () => {
  const af = [{ de: '2026-11-01', ate: '2026-12-31' }];
  assert.equal(afastadoNaData(af, '2026-11-16'), true);
  assert.equal(afastadoNaData(af, '2027-01-04'), false);
  assert.equal(afastadoNaData(af, '2026-10-26'), false);
  assert.equal(afastadoNaData([{ de: '2026-12-01', ate: '' }], '2027-05-01'), true);
  assert.equal(afastadoNaData(undefined, '2026-11-16'), false);
  assert.equal(afastadoNaData('lixo', '2026-11-16'), false);
});
