/* Regra "pendências do caixa" (uma das 5 da D12; KAN-135). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inicioDaJanela, mesesDoCaixa, pendenciasDoMes, resumoDoCaixa } from '../../src/dominio/caixa-regras.ts';

const TIPOS = { ana: 'mensalista', beto: 'diarista', caio: 'mensalista', duda: 'mensalista' };
const tipo = id => TIPOS[id] || 'avulso';
const VAL = { mensal: 80, diaria: 20 };
const RODS = [
  { id: 'r1', date: '2026-10-05', times: [{ players: ['ana', 'beto'] }, { players: ['caio', 'zeca'] }] },
  { id: 'r2', date: '2026-10-12', times: null },
  { id: 'r3', date: '2026-10-19', times: [{ players: ['beto', 'duda'] }, { players: ['ana', 'caio'] }] },
];
const LAN = [
  { k: 'mensal', pid: 'ana', v: 80, d: '2026-10-02', ref: '2026-10' },
  { k: 'mensal', pid: 'caio', v: 80, d: '2026-09-30', ref: '2026-09' },
  { k: 'diaria', pid: 'beto', v: 20, d: '2026-10-05', ref: 'r1' },
  { k: 'despesa', pid: null, v: 150, d: '2026-10-05', ref: '2026-10', note: 'quadra' },
  { k: 'entrada', pid: null, v: '35.5', d: '2026-09-10', ref: '2026-09' },
];

/* Cálculo da tela até a pelada-v29 (src/telas/caixa.js), sem o texto do rótulo. A regra nova tem de dar o mesmo. */
function antigo(month, lan, players, ptipo, isJog, rodadasDoMes, c) {
  const mens = players
    .filter(p => ptipo(p) !== 'diarista' && !lan.some(l => l.k === 'mensal' && l.pid === p && l.ref === month))
    .map(p => ({ pid: p, k: 'mensal', ref: month, v: c.mensal }));
  const dia = [];
  rodadasDoMes
    .filter(r => r.times)
    .forEach(r =>
      r.times.forEach(t =>
        t.players.forEach(id => {
          const tp = isJog(id) ? ptipo(id) : 'avulso';
          if (tp !== 'mensalista' && !lan.some(l => l.k === 'diaria' && l.pid === id && l.ref === r.id))
            dia.push({ pid: id, k: 'diaria', ref: r.id, v: c.diaria, data: r.date });
        })
      )
    );
  return mens.concat(dia);
}

test('mensalidade: deve quem é do elenco, não é diarista e não pagou o mês (pagamento de outro mês não vale)', () => {
  const p = pendenciasDoMes({
    mes: '2026-10',
    lancamentos: LAN,
    elenco: ['ana', 'beto', 'caio', 'duda'],
    tipo,
    rodadas: RODS,
    valores: VAL,
  });
  assert.deepEqual(
    p.filter(x => x.k === 'mensal').map(x => x.pid),
    ['caio', 'duda']
  );
  assert.ok(p.filter(x => x.k === 'mensal').every(x => x.v === 80 && x.ref === '2026-10'));
});

test('diária: só rodadas com times; diarista e avulso devem, mensalista não; diária paga daquela rodada some', () => {
  const p = pendenciasDoMes({
    mes: '2026-10',
    lancamentos: LAN,
    elenco: ['ana', 'beto', 'caio', 'duda'],
    tipo,
    rodadas: RODS,
    valores: VAL,
  });
  assert.deepEqual(
    p.filter(x => x.k === 'diaria').map(x => x.pid + '@' + x.ref),
    ['zeca@r1', 'beto@r3']
  );
  assert.equal(p.find(x => x.pid === 'zeca').data, '2026-10-05');
});

test('dá o mesmo resultado do cálculo da versão anterior', () => {
  const elenco = ['ana', 'beto', 'caio', 'duda'];
  for (const mes of ['2026-09', '2026-10']) {
    const rods = RODS.filter(r => r.date.startsWith(mes));
    const novo = pendenciasDoMes({ mes, lancamentos: LAN, elenco, tipo, rodadas: rods, valores: VAL });
    assert.deepEqual(
      novo,
      antigo(
        mes,
        LAN,
        elenco,
        id => TIPOS[id] || 'mensalista',
        id => id in TIPOS,
        rods,
        VAL
      )
    );
  }
});

test('sem elenco e sem rodadas, ninguém deve; todos pagos, ninguém deve', () => {
  assert.deepEqual(
    pendenciasDoMes({ mes: '2026-10', lancamentos: [], elenco: [], tipo, rodadas: [], valores: VAL }),
    []
  );
  const pagos = ['caio', 'duda']
    .map(pid => ({ k: 'mensal', pid, v: 80, d: '2026-10-03', ref: '2026-10' }))
    .concat([
      { k: 'diaria', pid: 'zeca', v: 20, d: '2026-10-05', ref: 'r1' },
      { k: 'diaria', pid: 'beto', v: 20, d: '2026-10-19', ref: 'r3' },
    ]);
  assert.deepEqual(
    pendenciasDoMes({
      mes: '2026-10',
      lancamentos: LAN.concat(pagos),
      elenco: ['ana', 'beto', 'caio', 'duda'],
      tipo,
      rodadas: RODS,
      valores: VAL,
    }),
    []
  );
});

test('totais: saldo com tudo (despesa desconta, valor em texto vira número); entradas e saídas só do mês, lista do mais novo ao mais antigo', () => {
  const r = resumoDoCaixa(LAN, '2026-10');
  assert.equal(r.saldo, 80 + 80 + 20 - 150 + 35.5);
  assert.equal(r.entradas, 100);
  assert.equal(r.saidas, 150);
  assert.deepEqual(
    r.doMes.map(l => l.d),
    ['2026-10-05', '2026-10-05', '2026-10-02']
  );
});

test('meses do seletor: atual, com lançamento e com rodada, sem repetir, do mais novo ao mais antigo', () => {
  assert.deepEqual(
    mesesDoCaixa(
      '2026-11-03',
      LAN,
      RODS.map(r => r.date)
    ),
    ['2026-11', '2026-10', '2026-09']
  );
});

test('KAN-106 e KAN-209: janela do caixa começa 7 meses antes do mês escolhido, ou no "desde" do A pagar, se for antes', () => {
  // KAN-209: 7 meses (as 6 mensalidades em atraso, com o ciclo podendo começar depois do dia 1)
  assert.equal(inicioDaJanela('2026-10'), '2026-03-01');
  assert.equal(inicioDaJanela('2026-02'), '2025-07-01');
  assert.equal(inicioDaJanela('2026-10', '2026-01-15'), '2026-01-15');
  assert.equal(inicioDaJanela('2026-10', '2026-09-01'), '2026-03-01');
  assert.equal(inicioDaJanela('2026-10', null), '2026-03-01');
});

test('KAN-106: meses do seletor incluem os meses com movimento na ficha de resumo', () => {
  assert.deepEqual(mesesDoCaixa('2026-10-27', [], [], ['2025-12', '2026-01']), ['2026-10', '2026-01', '2025-12']);
});
