/* Campeonato da rodada (KAN-233, pelada-v96). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classificacao,
  faltam,
  lerCamp,
  novoCampeonato,
  ordemDosJogos,
  proximo,
  resultados,
} from '../../src/dominio/campeonato.ts';

const camp = (n, crit = ['saldo', 'gp', 'cd', 'sorteio']) => novoCampeonato(n, crit, 1000, 7);
const j = (a, b, ga, gb, at = 2000) => ({ a, b, ga, gb, at });

const seguidas = o => o.slice(1).filter((x, i) => x.split('-').some(t => o[i].split('-').includes(t))).length;

test('CT-KAN-233-01: com 4 times, 6 jogos, cada par uma vez, na ordem do app', () => {
  const o = ordemDosJogos(4);
  assert.deepEqual(o, ['0-1', '2-3', '0-2', '1-3', '0-3', '1-2']);
  /* Com 4 times sempre há time jogando duas seguidas; o mínimo é 2 vezes. */
  assert.equal(seguidas(o), 2);
});

test('CT-KAN-233-01: com 3 a 16 times, todos os pares uma vez; de 5 em diante, ninguém joga duas seguidas', () => {
  for (let n = 3; n <= 16; n++) {
    const o = ordemDosJogos(n),
      total = (n * (n - 1)) / 2;
    assert.equal(o.length, total);
    assert.equal(new Set(o).size, total);
    if (n >= 5) assert.equal(seguidas(o), 0, n + ' times');
  }
});

test('CT-KAN-233-02: o jogo vale pelo par, mesmo com os times trocados de lado; partida de antes do início não conta', () => {
  const c = camp(3),
    ms = [j(0, 1, 5, 0, 500), j(1, 0, 2, 1), j(2, 0, 1, 1)];
  const r = resultados(c, ms);
  assert.deepEqual(r[0], { a: 0, b: 1, ga: 1, gb: 2, at: 2000 });
  assert.equal(faltam(c, ms), 1);
  assert.deepEqual(proximo(c, ms), { i: 2, a: 1, b: 2 });
});

test('CT-KAN-233-03: pontos primeiro (vitória 3, empate 1), depois saldo e gols pró', () => {
  const c = camp(4),
    ms = [j(0, 1, 2, 0), j(2, 3, 1, 0), j(0, 2, 0, 0), j(1, 3, 3, 0), j(0, 3, 1, 1), j(1, 2, 4, 1)];
  const t = classificacao(c, ms);
  assert.deepEqual(
    t.map(x => [x.t, x.pts, x.sg]),
    [
      [1, 6, 4],
      [0, 5, 2],
      [2, 4, -2],
      [3, 1, -4],
    ]
  );
  assert.equal(faltam(c, ms), 0);
  assert.equal(proximo(c, ms), null);
});

test('CT-KAN-233-03: a ordem dos critérios muda a classificação (gols pró antes do saldo)', () => {
  const ms = [j(0, 1, 5, 4), j(2, 3, 1, 0), j(0, 2, 0, 1), j(1, 3, 0, 0), j(0, 3, 0, 0), j(1, 2, 0, 0)];
  /* 0: 4 pts, sg 0, gp 5. 2: 7 pts. 1: 2 pts. 3: 2 pts. */
  const porSaldo = classificacao(camp(4, ['saldo', 'gp']), ms).map(x => x.t),
    porGols = classificacao(camp(4, ['gp', 'saldo']), ms).map(x => x.t);
  assert.equal(porSaldo[0], 2);
  /* 1 e 3: 2 pts; saldo 1: -1, 3: -1; gols pró 1: 4, 3: 0 */
  assert.deepEqual(porSaldo.slice(2), [1, 3]);
  assert.deepEqual(porGols.slice(2), [1, 3]);
});

test('CT-KAN-233-04: confronto direto entre os empatados', () => {
  /* 3 times: 0 vence 1, 1 vence 2, 2 vence 0 → todos com 3 pts; saldo igual; confronto direto empata; sorteio decide */
  const ms = [j(0, 1, 1, 0), j(1, 2, 1, 0), j(0, 2, 0, 1)];
  const a = classificacao(camp(3, ['cd', 'sorteio']), ms).map(x => x.t),
    b = classificacao(camp(3, ['cd', 'sorteio']), ms).map(x => x.t);
  assert.deepEqual(a, b, 'sorteio igual em todos os aparelhos');
  assert.equal(new Set(a).size, 3);
  /* Dois empatados: quem venceu o confronto fica na frente, mesmo com saldo pior */
  const ms2 = [j(0, 1, 1, 0), j(2, 0, 5, 0), j(1, 2, 3, 0)];
  /* 0: 3 pts (1-0, 0-5) sg -4; 1: 3 pts (0-1, 3-0) sg 2; 2: 3 pts (5-0, 0-3) sg 2 */
  assert.deepEqual(
    classificacao(camp(3, ['cd']), ms2).map(x => x.t),
    [0, 1, 2],
    'todos 3 pts, confronto direto entre os 3 empata: ordem do sorteio'
  );
  const ms3 = [j(0, 1, 1, 0), j(0, 2, 0, 3), j(1, 2, 2, 0)];
  /* 0: 3 pts sg -2; 1: 3 pts sg 1; 2: 3 pts sg 1. Por saldo: 1 e 2 empatam; confronto direto: 1 venceu 2 */
  assert.deepEqual(
    classificacao(camp(3, ['saldo', 'cd']), ms3).map(x => x.t),
    [1, 2, 0]
  );
});

test('CT-KAN-233-05: campeonato de outro número de times é ignorado (o sorteio mudou)', () => {
  const c = camp(4);
  assert.deepEqual(lerCamp(c, 4), c);
  assert.equal(lerCamp(c, 3), null);
  assert.equal(lerCamp(null, 4), null);
  assert.deepEqual(lerCamp({ ...c, crit: ['saldo', 'xx'] }, 4).crit, ['saldo']);
});
