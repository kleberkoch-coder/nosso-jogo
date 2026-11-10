/* Lista completa na mensagem da rodada (KAN-255, pelada-v103). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPCOES_PADRAO, blocoLista, lerOpcoes } from '../../src/dominio/zap-lista.ts';

const t = { naoVao: n => `Não vão (${n})`, semResposta: n => `Ainda não responderam (${n})` };

test('CT-KAN-255-01: depois dos confirmados, quem não vai, quem não respondeu (em ordem alfabética) e o que falta', () => {
  assert.equal(
    blocoLista(['Zé', 'Ana'], ['Caio', 'Bruno', 'Éder'], ['Faltam 6 jogadores', 'Falta 1 GOL'], OPCOES_PADRAO, t),
    '\n\n❌ *Não vão (2)*\nAna, Zé\n\n⏳ *Ainda não responderam (3)*\nBruno, Caio, Éder\n\n⚠️ Faltam 6 jogadores · Falta 1 GOL'
  );
});

test('CT-KAN-255-03: desmarcando as caixas, as listas saem; lista vazia não aparece', () => {
  assert.equal(blocoLista(['Ana'], ['Bruno'], [], { naoVao: false, semResposta: false }, t), '');
  assert.equal(blocoLista([], ['Bruno'], [], OPCOES_PADRAO, t), '\n\n⏳ *Ainda não responderam (1)*\nBruno');
  assert.deepEqual(lerOpcoes(null), OPCOES_PADRAO);
  assert.deepEqual(lerOpcoes('{x'), OPCOES_PADRAO);
  assert.deepEqual(lerOpcoes('{"naoVao":false}'), { naoVao: false, semResposta: true });
});
