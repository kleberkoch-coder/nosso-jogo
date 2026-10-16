/* Limites contra abuso (KAN-89). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PADRAO, avulsosEsgotados, contaComoAvulso, gruposEsgotados, limite } from '../../src/dominio/limites.ts';

test('sem configuração, valem os padrões: 30 avulsos por rodada e 20 grupos por conta', () => {
  assert.equal(limite(null, 'avulsosPorRodada'), 30);
  assert.equal(limite(undefined, 'gruposPorConta'), 20);
});

test('valor configurado vale; valor inválido volta ao padrão', () => {
  assert.equal(limite({ avulsosPorRodada: 5 }, 'avulsosPorRodada'), 5);
  assert.equal(limite({ avulsosPorRodada: 0 }, 'avulsosPorRodada'), 0);
  assert.equal(limite({ avulsosPorRodada: -1 }, 'avulsosPorRodada'), 30);
  assert.equal(limite({ avulsosPorRodada: '10' }, 'avulsosPorRodada'), 30);
  assert.equal(limite({ gruposPorConta: 2.5 }, 'gruposPorConta'), 20);
});

test('avulsos: esgota ao chegar no limite', () => {
  assert.equal(avulsosEsgotados(null, null), false);
  assert.equal(avulsosEsgotados({ n: 29 }, null), false);
  assert.equal(avulsosEsgotados({ n: 30 }, null), true);
  assert.equal(avulsosEsgotados({ n: 2 }, { avulsosPorRodada: 2 }), true);
});

test('grupos: esgota ao chegar no limite', () => {
  assert.equal(gruposEsgotados(null, null), false);
  assert.equal(gruposEsgotados({ ng: 20 }, null), true);
  assert.equal(gruposEsgotados({ ng: 3 }, { gruposPorConta: 4 }), false);
});

test('só conta como avulso novo quem não é administrador, não é jogador e ainda não está na lista', () => {
  assert.equal(contaComoAvulso({ admin: false, jogador: false, jaNaLista: false }), true);
  assert.equal(contaComoAvulso({ admin: true, jogador: false, jaNaLista: false }), false);
  assert.equal(contaComoAvulso({ admin: false, jogador: true, jaNaLista: false }), false);
  assert.equal(
    contaComoAvulso({ admin: false, jogador: false, jaNaLista: true }),
    false,
    'mudar Vou/Não vou não conta (critério 2)'
  );
});

test('os padrões do app são os mesmos das regras do Firebase', () => {
  const r = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(r, new RegExp("lim\\('avulsosPorRodada', " + PADRAO.avulsosPorRodada + '\\)'));
  assert.match(r, new RegExp("lim\\('gruposPorConta', " + PADRAO.gruposPorConta + '\\)'));
});
