/* Extra da rodada (KAN-228): churrasco, pizzada… Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE_CONVIDADOS, comConvidado, participantesDoRateio, resumoExtra } from '../../src/dominio/extra.ts';

const ext = {
  ana: { s: 'in', t: 3, conv: ['Primo da Ana'] },
  beto: { s: 'out', t: 1, conv: ['Esquecido'] },
  caio: { s: 'in', t: 2 },
  x1: { s: 'in', t: 4, nome: 'Vizinho' },
};

test('KAN-228: quem vai, na ordem da resposta, e os convidados só de quem vai', () => {
  const r = resumoExtra(ext);
  assert.deepEqual(r.vao, ['caio', 'ana', 'x1']);
  assert.deepEqual(r.naoVao, ['beto']);
  assert.deepEqual(r.convidados, [{ nome: 'Primo da Ana', de: 'ana' }]);
  assert.equal(r.total, 4);
  assert.equal(resumoExtra(null).total, 0);
});

test('KAN-228: até 3 convidados, sem nome vazio nem repetido', () => {
  assert.equal(LIMITE_CONVIDADOS, 3);
  assert.deepEqual(comConvidado(undefined, '  Zé  da  Silva '), { conv: ['Zé da Silva'] });
  assert.deepEqual(comConvidado(['A', 'B', 'C'], 'D'), { erro: 'cheio' });
  assert.deepEqual(comConvidado(['Zé'], 'zé'), { erro: 'repetido' });
  assert.deepEqual(comConvidado([], '   '), { erro: 'vazio' });
  assert.equal(comConvidado([], 'x'.repeat(60)).conv[0].length, 40);
});

test('KAN-228: rateio do extra com o elenco pelo id e os de fora pelo nome', () => {
  const p = participantesDoRateio(
    ext,
    id => id !== 'x1',
    id => ({ ana: 'Ana', caio: 'Caio' })[id] || id,
    (nome, de) => `${nome} (convidado de ${de})`
  );
  assert.deepEqual(p.sel.slice(0, 2), ['caio', 'ana']);
  assert.deepEqual(Object.values(p.fora), ['Vizinho', 'Primo da Ana (convidado de Ana)']);
  assert.equal(p.sel.length, 4);
  assert.ok(Object.keys(p.fora).every(k => k.startsWith('f_')));
});
