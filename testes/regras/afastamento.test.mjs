/* KAN-208: afastamento de jogador por um período. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afastado,
  afastadosQueConfirmaram,
  afastamentoNoMes,
  doJogador,
  erroAfastamento,
  fimAoVoltar,
  semMensalidade,
  somaMes,
} from '../../src/dominio/afastamento.ts';
import { pendenciasDoMes } from '../../src/dominio/caixa-regras.ts';

const afs = {
  a1: { pid: 'k', mot: 'lesao', de: '2026-06', ate: '2026-09', em: 1 },
  a2: { pid: 'r', mot: 'ferias', de: '2026-10', ate: '', em: 2 },
};

test('soma de meses atravessa o ano', () => {
  assert.equal(somaMes('2026-12', 1), '2027-01');
  assert.equal(somaMes('2026-01', -1), '2025-12');
  assert.equal(somaMes('2026-06', 3), '2026-09');
});

test('afastado nos meses do período, inclusive o primeiro e o último; volta sozinho no mês seguinte', () => {
  assert.equal(afastado(afs, 'k', '2026-05'), false);
  assert.equal(afastado(afs, 'k', '2026-06'), true);
  assert.equal(afastado(afs, 'k', '2026-09'), true);
  assert.equal(afastado(afs, 'k', '2026-10'), false);
});

test('"até voltar" (sem fim) vale para todos os meses a partir do início', () => {
  assert.equal(afastado(afs, 'r', '2026-09'), false);
  assert.equal(afastado(afs, 'r', '2027-05'), true);
  assert.equal(afastamentoNoMes(afs, 'r', '2027-05')[0], 'a2');
});

test('sem mensalidade só com a isenção do caixa e só nos meses que os dois cobrem', () => {
  const isen = { a1: { pid: 'k', de: '2026-06', ate: '2026-09' } };
  assert.equal(semMensalidade(afs, isen, 'k', '2026-07'), true);
  assert.equal(semMensalidade(afs, {}, 'k', '2026-07'), false, 'afastado com "cobrar normalmente"');
  assert.equal(semMensalidade(afs, isen, 'k', '2026-10'), false);
  // Quem não tem Caixa estende o afastamento: a isenção não estende junto
  const maisLongo = { a1: { ...afs.a1, ate: '2026-12' } };
  assert.equal(semMensalidade(maisLongo, isen, 'k', '2026-11'), false);
  // "Voltou" encurta o afastamento: a isenção encurta junto
  const voltou = { a1: { ...afs.a1, ate: '2026-07' } };
  assert.equal(semMensalidade(voltou, isen, 'k', '2026-08'), false);
  // Isenção de outro jogador não vale
  assert.equal(semMensalidade(afs, { a1: { pid: 'x', de: '2026-06', ate: '2026-09' } }, 'k', '2026-07'), false);
});

test('pendências do mês: afastado sem mensalidade sai da lista; com "cobrar normalmente", continua', () => {
  const base = {
    mes: '2026-07',
    lancamentos: [],
    elenco: ['k', 'b'],
    tipo: () => 'mensalista',
    rodadas: [],
    valores: { mensal: 80, diaria: 20 },
  };
  const isen = { a1: { pid: 'k', de: '2026-06', ate: '2026-09' } };
  const sem = pendenciasDoMes({ ...base, semMensal: id => semMensalidade(afs, isen, id, '2026-07') });
  assert.deepEqual(
    sem.map(p => p.pid),
    ['b']
  );
  const com = pendenciasDoMes({ ...base, semMensal: id => semMensalidade(afs, {}, id, '2026-07') });
  assert.deepEqual(
    com.map(p => p.pid),
    ['k', 'b']
  );
  assert.deepEqual(
    pendenciasDoMes(base).map(p => p.pid),
    ['k', 'b'],
    'sem afastamentos, como antes'
  );
});

test('"Voltou" fecha no mês anterior; começou neste mês, deixa de existir', () => {
  assert.equal(fimAoVoltar({ de: '2026-06' }, '2026-08'), '2026-07');
  assert.equal(fimAoVoltar({ de: '2026-08' }, '2026-08'), null);
  assert.equal(fimAoVoltar({ de: '2026-12' }, '2027-01'), '2026-12');
});

test('janela: motivo da lista, meses válidos e fim depois do início', () => {
  assert.equal(erroAfastamento({ mot: 'lesao', de: '2026-06', ate: '2026-09' }), '');
  assert.equal(erroAfastamento({ mot: 'lesao', de: '2026-06', ate: '' }), '');
  assert.equal(erroAfastamento({ mot: 'xx', de: '2026-06' }), 'afast.erroMotivo');
  assert.equal(erroAfastamento({ mot: 'outro', de: '2026-13' }), 'afast.erroInicio');
  assert.equal(erroAfastamento({ mot: 'outro', de: '2026-06', ate: '2026-05' }), 'afast.erroFim');
});

test('histórico do jogador do mais recente para o mais antigo', () => {
  const h = { ...afs, a3: { pid: 'k', mot: 'viagem', de: '2025-01', ate: '2025-02' } };
  assert.deepEqual(
    doJogador(h, 'k').map(([id]) => id),
    ['a1', 'a3']
  );
});

test('aviso: afastado que respondeu Vou, menos quando o aviso foi dispensado nesta rodada', () => {
  const pres = { k: { s: 'in' }, r: { s: 'out' }, b: { s: 'in' } };
  assert.deepEqual(afastadosQueConfirmaram(afs, pres, '2026-07', 'r1'), [['k', 'a1']]);
  const ign = { a1: { ...afs.a1, ign: 'r1' } };
  assert.deepEqual(afastadosQueConfirmaram(ign, pres, '2026-07', 'r1'), []);
  assert.deepEqual(afastadosQueConfirmaram(ign, pres, '2026-07', 'r2'), [['k', 'a1']]);
});
