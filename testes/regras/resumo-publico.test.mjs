/* KAN-295: números públicos do card (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comEspelho, espelhoPublico } from '../../src/dominio/resumo-publico.ts';

test('CT-KAN-295-01: ajuste do resumo do mês ganha a cópia pública só com os números do card', () => {
  const somar = { __op: 'somar', n: 1 };
  const op = {
    tipo: 'patch',
    p: 'resumos/2026-11',
    o: {
      mes: '2026-11',
      at: 5,
      'jog.a.j': somar,
      'jog.a.g': somar,
      'jog.a.as': somar,
      'jog.b.bagre': somar,
      'jog.b.mvp': somar,
      'jogos.m1': { ga: 1 },
      cx: { ent: 1 },
    },
  };
  assert.deepEqual(espelhoPublico(op), {
    tipo: 'patch',
    p: 'resumosPub/2026-11',
    o: { mes: '2026-11', at: 5, 'jog.a.j': somar, 'jog.a.g': somar, 'jog.a.as': somar, 'jog.b.mvp': somar },
  });
});

test('CT-KAN-295-02: resumo inteiro (Recalcular) vira cópia sem bagre, sem jogos e sem caixa', () => {
  const op = {
    tipo: 'set',
    p: 'resumos/2026-10',
    o: {
      mes: '2026-10',
      at: 9,
      jog: { a: { j: 2, v: 1, d: 1, g: 3, bagre: 1, nota: 8 } },
      jogos: { x: 1 },
      cx: { ent: 1 },
    },
  };
  assert.deepEqual(espelhoPublico(op).o, { mes: '2026-10', at: 9, jog: { a: { j: 2, v: 1, d: 1, g: 3 } } });
});

test('CT-KAN-295-03: só o bagre muda: nada vai para a cópia pública; outros caminhos não são copiados', () => {
  assert.equal(espelhoPublico({ tipo: 'patch', p: 'resumos/2026-11', o: { mes: '2026-11', 'jog.a.bagre': 1 } }), null);
  assert.equal(espelhoPublico({ tipo: 'set', p: 'resumosCaixa/2026-11', o: { cx: {} } }), null);
  assert.equal(espelhoPublico({ tipo: 'patch', p: 'rodadas/r1', o: { np: 1 } }), null);
  const lote = [{ tipo: 'set', p: 'rodadas/r1/partidas/p1', o: {} }];
  assert.equal(comEspelho(lote), lote);
  const com = comEspelho([...lote, { tipo: 'patch', p: 'resumos/2026-11', o: { 'jog.a.g': 1 } }]);
  assert.deepEqual(
    com.map(x => x.p),
    ['rodadas/r1/partidas/p1', 'resumos/2026-11', 'resumosPub/2026-11']
  );
});
