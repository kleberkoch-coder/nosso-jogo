/* KAN-294: cards do grupo (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESPACOS,
  MAX_MODELOS,
  PRONTOS,
  apagar,
  contraste,
  copiar,
  estatsDe,
  lerCards,
  limparModelo,
  numerosDoPeriodo,
  poucoContraste,
  tiposDe,
  valor,
} from '../../src/dominio/cards.ts';

test('CT-KAN-294-07: sem nada gravado, cada tipo de card usa o pronto padrão; 3 prontos com espaços conhecidos', () => {
  const c = lerCards(undefined);
  assert.deepEqual(Object.keys(c.modelos), []);
  assert.equal(c.usos.perfil.m, 'p-classico');
  assert.equal(c.usos.craque.m, 'p-destaque');
  assert.deepEqual(Object.keys(PRONTOS).sort(), ['p-classico', 'p-destaque', 'p-escudo']);
  assert.deepEqual(ESPACOS, { classico: 6, destaque: 2, escudo: 6 });
});

test('CT-KAN-294-08: o que vem do banco é limpo (cor inválida, tipo de fundo estranho, id com código, estatística desconhecida)', () => {
  const c = lerCards({
    modelos: {
      bom: {
        n: '  Azul  ',
        base: 'escudo',
        fora: { t: 'xss', c1: 'red', c2: '#ABCDEF' },
        linha: '#FF0000',
        letra: 'url(x)',
      },
      'p-classico': { base: 'classico' },
      'ruim"><script>': { base: 'classico' },
      semBase: { n: 'x' },
    },
    usos: {
      perfil: {
        m: 'inexistente',
        grande: 'nota',
        campos: ['gols', 'senha', 'as'],
        per: 'sempre',
        titulo: 'x'.repeat(40),
      },
    },
  });
  assert.deepEqual(Object.keys(c.modelos), ['bom']);
  const m = c.modelos.bom;
  assert.equal(m.n, 'Azul');
  assert.equal(m.fora.t, PRONTOS['p-escudo'].fora.t);
  assert.equal(m.fora.c1, PRONTOS['p-escudo'].fora.c1);
  assert.equal(m.fora.c2, '#abcdef');
  assert.equal(m.linha, '#ff0000');
  assert.equal(m.letra, PRONTOS['p-escudo'].letra);
  const u = c.usos.perfil;
  assert.equal(u.m, 'p-classico');
  assert.equal(u.grande, 'gols');
  assert.deepEqual(u.campos, ['gols', '', 'as']);
  assert.equal(u.per, 'ano');
  assert.equal(u.titulo.length, 24);
  assert.equal(limparModelo({ base: 'outro' }), null);
});

test('CT-KAN-294-09: copiar um pronto cria um modelo do grupo; até 12; apagar devolve o tipo ao pronto da mesma base', () => {
  let c = lerCards(undefined);
  const r = copiar(c, 'p-destaque', 'm1', 'Destaque (cópia)');
  assert.ok(r);
  c = { ...r.cards, usos: { ...r.cards.usos, craque: { ...r.cards.usos.craque, m: 'm1' } } };
  assert.equal(c.modelos.m1.base, 'destaque');
  assert.equal(c.modelos.m1.n, 'Destaque (cópia)');
  assert.notEqual(c.modelos.m1, PRONTOS['p-destaque']);
  for (let i = 2; i <= MAX_MODELOS; i++) c = copiar(c, 'p-classico', 'm' + i, 'x').cards;
  assert.equal(Object.keys(c.modelos).length, MAX_MODELOS);
  assert.equal(copiar(c, 'p-classico', 'm99', 'x'), null);
  assert.equal(copiar(lerCards(undefined), 'p-classico', 'p-novo', 'x'), null);
  const d = apagar(c, 'm1');
  assert.equal(d.modelos.m1, undefined);
  assert.equal(d.usos.craque.m, 'p-destaque');
  assert.equal(lerCards({ modelos: c.modelos }).usos.perfil.m, 'p-classico');
});

test('CT-KAN-294-04: contraste: letra branca sobre azul-marinho passa; cinza claro sobre branco avisa', () => {
  assert.ok(contraste('#ffffff', '#0b2a5b') > 10);
  const claro = { ...PRONTOS['p-escudo'], dentro: { t: 'cor', c1: '#ffffff', c2: '#ffffff' }, letra: '#dddddd' };
  assert.equal(poucoContraste(claro), true);
  const ok = { ...PRONTOS['p-escudo'], dentro: { t: 'cor', c1: '#0b2a5b', c2: '#0b2a5b' }, letra: '#ffffff' };
  assert.equal(poucoContraste(ok), false);
  const faixa = { ...PRONTOS['p-destaque'], faixa: '#141414', letraFaixa: '#222222' };
  assert.equal(poucoContraste(faixa), true);
  for (const id of Object.keys(PRONTOS)) assert.equal(poucoContraste(PRONTOS[id]), false, id);
});

test('CT-KAN-294-03: esporte sem assistência não oferece Garçom nem assistências; o card do jogador não tem números da rodada', () => {
  assert.deepEqual(tiposDe(false), ['perfil', 'craque', 'artilheiro']);
  assert.deepEqual(tiposDe(true), ['perfil', 'craque', 'artilheiro', 'garcom']);
  assert.ok(!estatsDe('craque', false).includes('as'));
  assert.ok(!estatsDe('craque', false).includes('asRod'));
  assert.ok(!estatsDe('perfil', true).includes('votos'));
  assert.ok(estatsDe('craque', true).includes('votosPct'));
  assert.equal(lerCards({ usos: { perfil: { grande: 'as' } } }, false).usos.perfil.grande, 'gols');
});

test('CT-KAN-294-10: números do período pelos resumos do mês (temporada, mês, desde o início) e formato', () => {
  const res = {
    '2025-12': { jog: { a: { j: 4, v: 4, g: 10, mvp: 3 } } },
    '2026-10': { jog: { a: { j: 4, v: 2, e: 1, d: 1, g: 3, as: 2, mvp: 1 } } },
    '2026-11': { jog: { a: { j: 2, v: 1, e: 0, d: 1, g: 2, as: 1 }, b: { j: 9 } } },
  };
  const ano = numerosDoPeriodo(res, 'a', 'ano', '2026-11-23');
  assert.deepEqual(
    { gols: ano.gols, as: ano.as, jogos: ano.jogos, vit: ano.vit, premios: ano.premios },
    { gols: 5, as: 3, jogos: 6, vit: 3, premios: 1 }
  );
  assert.equal(Math.round(ano.aprov), 56);
  assert.equal(numerosDoPeriodo(res, 'a', 'mes', '2026-11-23').gols, 2);
  assert.equal(numerosDoPeriodo(res, 'a', 'tudo', '2026-11-23').gols, 15);
  assert.equal(numerosDoPeriodo(res, 'z', 'ano', '2026-11-23').aprov, 0);
  assert.equal(valor('aprov', { aprov: 55.6 }), '56%');
  assert.equal(valor('premios', { premios: 5 }), '5x');
  assert.equal(valor('gols', {}), '—');
});
