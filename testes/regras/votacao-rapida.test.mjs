/* Votação rápida (KAN-254, pelada-v102). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveRoda, jaVotaram, loteVotoRapido, quemVota } from '../../src/dominio/votacao-rapida.ts';
import { auditoria, tally, votosQueValem } from '../../src/dominio/votacao-contagem.ts';

const V = { rid: 'r1', cats: [{ id: 'best' }] };
const nome = id => ({ a: 'Ana', b: 'Bruno', c: 'Caio', d: 'Davi' })[id] || id;

test('CT-KAN-254-01: quem vota é a lista da votação ou quem jogou, sem repetir, em ordem alfabética', () => {
  assert.deepEqual(quemVota(null, [{ players: ['c', 'a'] }, { players: ['b', 'a'] }], nome), ['a', 'b', 'c']);
  assert.deepEqual(quemVota(['d', 'b'], [{ players: ['c'] }], nome), ['b', 'd']);
  assert.deepEqual(quemVota(null, undefined, nome), []);
});

test('CT-KAN-254-02: já votou quem tem escolha gravada, pelo link ou na votação rápida', () => {
  const s = jaVotaram({
    u1: { pid: 'a', v: { best: 'b' } },
    u2: { pid: 'b', v: {} },
    r_c: { pid: 'c', v: { best: 'a' } },
  });
  assert.deepEqual([...s].sort(), ['a', 'c']);
});

test('CT-KAN-254-03: confirmar grava r_{jogador} com o contador e tira os votos da pessoa pelo link', () => {
  const op = { agora: () => 'AGORA', apagar: () => 'APAGAR' };
  const votos = {
    u1: { pid: 'a', v: { best: 'b' } },
    u2: { pid: 'b', v: { best: 'a' } },
    r_a: { pid: 'a', v: { best: 'c', velha: 'b' }, n: 2 },
  };
  const ops = loteVotoRapido('votacoes/v1/votos/', votos, 'a', { best: 'd', gk: '' }, 10, ['best', 'gk'], op);
  assert.deepEqual(ops, [
    {
      tipo: 'patch',
      p: 'votacoes/v1/votos/r_a',
      o: { pid: 'a', t: 10, o: 'r', n: 3, em: 'AGORA', 'v.best': 'd', 'v.gk': 'APAGAR', 'v.velha': 'APAGAR' },
    },
    { tipo: 'del', p: 'votacoes/v1/votos/u1' },
  ]);
  assert.equal(loteVotoRapido('b/', {}, 'a', { best: '' }, 1, ['best'], op), null, 'sem escolha não grava');
  assert.equal(loteVotoRapido('b/', {}, 'a', { best: 'b' }, 1, ['best'], op)[0].o.n, 1);
  assert.equal(chaveRoda('a'), 'r_a');
});

test('CT-KAN-254-04: a mesma pessoa na votação rápida e pelo link: vale só o voto mais recente dela', () => {
  const votos = {
    r_a: { pid: 'a', v: { best: 'b' }, t: 5 },
    u1: { pid: 'a', v: { best: 'c' }, t: 9 },
    u2: { pid: 'b', v: { best: 'c' }, t: 1 },
    u3: { pid: 'd', v: { best: 'c' }, t: 1 },
    u4: { pid: 'd', v: { best: 'b' }, t: 2 },
  };
  assert.deepEqual(
    Object.keys(votosQueValem(votos)).sort(),
    ['u1', 'u2', 'u3', 'u4'],
    'sem votação rápida, o link fica como era'
  );
  const r = tally(V, votos).best;
  assert.deepEqual([r.counts, r.total], [{ c: 3, b: 1 }, 4]);
  const r2 = tally(V, { ...votos, r_a: { pid: 'a', v: { best: 'b' }, t: 20 } }).best;
  assert.deepEqual(r2.counts, { b: 2, c: 2 });
});

test('CT-KAN-254-05: "Quem votou" marca o voto da votação rápida, com a hora do servidor e quantas vezes votou', () => {
  const l = auditoria(
    { r_a: { pid: 'a', v: { best: 'b' }, t: 5, em: 1000, n: 2 }, u1: { pid: 'b', v: { best: 'a' }, t: 7 } },
    {}
  );
  const ra = l.find(x => x.u === 'r_a'),
    u1 = l.find(x => x.u === 'u1');
  assert.deepEqual([ra.roda, ra.n, ra.quando, ra.doServidor], [true, 2, 1000, true]);
  assert.deepEqual([u1.roda, u1.n, u1.quando, u1.doServidor], [false, 0, 7, false]);
});

test('CT-KAN-254-06: a planilha de "Quem votou" ganha a coluna Origem (votação rápida ou link)', async () => {
  const { linhasDaPlanilha } = await import('../../src/dominio/votacao-resultado.ts');
  const linhas = [
    {
      u: 'r_a',
      pid: 'a',
      v: { best: 'b' },
      quando: 1,
      doServidor: true,
      trocas: [],
      repetido: false,
      roda: true,
      n: 1,
    },
    {
      u: 'u1',
      pid: 'b',
      v: { best: 'a' },
      quando: 2,
      doServidor: false,
      trocas: [],
      repetido: false,
      roda: false,
      n: 0,
    },
  ];
  const cab = {
    quem: 'Quem',
    hora: 'Hora',
    trocas: 'Trocas',
    repetido: 'rep',
    origem: 'Origem',
    rapida: 'votação rápida',
    link: 'link',
  };
  const rows = linhasDaPlanilha(linhas, [{ id: 'best', name: 'Craque' }], nome, cab, () => 'h');
  assert.deepEqual(rows, [
    ['Quem', 'Craque', 'Hora', 'Trocas', 'Origem'],
    ['Ana', 'Bruno', 'h', '0', 'votação rápida'],
    ['Bruno', 'Ana', 'h', '0', 'link'],
  ]);
});
