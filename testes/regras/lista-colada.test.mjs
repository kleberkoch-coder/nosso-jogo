/* KAN-244: lista colada do WhatsApp. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casar, lerLista, posicaoDe } from '../../src/dominio/lista-colada.ts';

/* A lista real da turma do Kleber (12/11/2026). */
const KLEBER = `Lista 28/09 das 20:30 as 22h - 👍🏻 ou ❌ - Responder até as 13:00


1 - Kleber (Z) ❌️
2 - Peró (M) 👍🏼
3 - Diegão (M) 🤙🏼
4 - Luizão (LE) ❌
5 - Luiz Otávio (LE) 👍
6 - Pedro Nunes (M) 👍
7 - Daniel (M) 👍🏽
8 - Alex (LD) 🤙🏼
9 - Thiago Aguiar (V)👍🏾
10 - Denis (A) 👍
11 - Cristian (M)
12 - Ademar (M) ❌
13 - Marcinho (LE) ❌
14 - Bruno (Z) 👍🏼
15 - Gustavão (V) 👍🏼
16 - Wellington (LD) ❌️
17 - Gui (M) ❌
18 - Matheus (M) 👍🏻
19 - Pietro (avulso)
20 - Cris (Bigode)(A)❌
21 - Gabriel (Avulso) 👍🏼

1- Marcos (goleiro) 👍🏽
2- Diego (goleiro) ❌
3- Jones (goleiro)👍🏼`;

const nomes = (ls, s) => ls.filter(l => l.s === s).map(l => l.nome);

test('CT-KAN-244-01: a lista real: 👍/🤙 vai, ❌ não vai, sem marca não muda; título ignorado; ordem mantida', () => {
  const ls = lerLista(KLEBER);
  assert.deepEqual(nomes(ls, 'in'), [
    'Peró',
    'Diegão',
    'Luiz Otávio',
    'Pedro Nunes',
    'Daniel',
    'Alex',
    'Thiago Aguiar',
    'Denis',
    'Bruno',
    'Gustavão',
    'Matheus',
    'Gabriel',
    'Marcos',
    'Jones',
  ]);
  assert.deepEqual(nomes(ls, 'out'), [
    'Kleber',
    'Luizão',
    'Ademar',
    'Marcinho',
    'Wellington',
    'Gui',
    'Cris (Bigode)',
    'Diego',
  ]);
  assert.deepEqual(nomes(ls, null), ['Cristian', 'Pietro']);
  const por = n => ls.find(l => l.nome === n);
  assert.equal(por('Kleber').pos, 'Z');
  assert.equal(por('Luiz Otávio').pos, 'LE');
  assert.ok(por('Gabriel').avulso && por('Pietro').avulso && !por('Matheus').avulso);
  assert.ok(por('Marcos').goleiro && por('Jones').goleiro && !por('Bruno').goleiro);
  assert.equal(por('Cris (Bigode)').pos, 'A');
});

test('CT-KAN-244-01: lista sem nenhuma marca: todos vão, na ordem; numa lista com marcas, linha sem marca não muda', () => {
  const sem = lerLista('1. João\n2. Pedro\n3. Rafa (gol)');
  assert.deepEqual(
    sem.map(l => [l.nome, l.s, l.goleiro]),
    [
      ['João', 'in', false],
      ['Pedro', 'in', false],
      ['Rafa', 'in', true],
    ]
  );
  /* O exemplo do cartão: com marcas na lista, quem está sem marca ainda não respondeu (como Cristian e Pietro). */
  assert.deepEqual(
    lerLista('1. João ✅\n2. Pedro\n3. Rafa (gol)').map(l => [l.nome, l.s]),
    [
      ['João', 'in'],
      ['Pedro', null],
      ['Rafa', null],
    ]
  );
});

test('CT-KAN-244-07: seções "Não vão" e "Espera" (também na mesma linha) e "Goleiros"', () => {
  const ls = lerLista(
    'Pelada de quinta\nConfirmados:\n1. Ana\n2. Bia\nGoleiros:\n1. Caio\nEspera: Duda, Edu\nNão vão:\n- Fábio\n- Gil'
  );
  assert.deepEqual(
    ls.map(l => [l.nome, l.s, l.espera, l.goleiro]),
    [
      ['Ana', 'in', false, false],
      ['Bia', 'in', false, false],
      ['Caio', 'in', false, true],
      ['Fábio', 'out', false, false],
      ['Gil', 'out', false, false],
      ['Duda', 'in', true, false],
      ['Edu', 'in', true, false],
    ]
  );
});

test('CT-KAN-244-03: texto sem nomes (vazio, só emojis e números) não acha ninguém', () => {
  assert.deepEqual(lerLista(''), []);
  assert.deepEqual(lerLista('1.\n2. 👍👍\n3 - ❌\n⚽⚽⚽'), []);
});

test('CT-KAN-244-08: palavras de resposta, nome repetido e frase solta', () => {
  const ls = lerLista(
    'Atenção: quem não pagar a mensalidade não joga essa semana, combinado pessoal\nJoão - vou\nPedro (fora)\nRafa confirmado\njoão 👍'
  );
  assert.deepEqual(
    ls.map(l => [l.nome, l.s]),
    [
      ['João', 'in'],
      ['Pedro', 'out'],
      ['Rafa', 'in'],
    ]
  );
});

test('CT-KAN-244-02: casa com o elenco sem acento e maiúscula; com parênteses; parecido só com um candidato', () => {
  const elenco = [
    { id: 'e1', nome: 'Peró' },
    { id: 'e2', nome: 'Diegão' },
    { id: 'e3', nome: 'Diego' },
    { id: 'e4', nome: 'Pedro' },
    { id: 'e5', nome: 'Cris (Bigode)' },
    { id: 'e6', nome: 'Luiz Otávio' },
    { id: 'e7', nome: 'Perózinho' },
  ];
  const avulsos = [{ id: 'a1', nome: 'Gabriel' }];
  assert.deepEqual(casar('PERO', elenco, avulsos), { tipo: 'elenco', id: 'e1' });
  assert.deepEqual(casar('Diego', elenco, avulsos), { tipo: 'elenco', id: 'e3' });
  assert.deepEqual(casar('diegão', elenco, avulsos), { tipo: 'elenco', id: 'e2' });
  assert.deepEqual(casar('Cris (Bigode)', elenco, avulsos), { tipo: 'elenco', id: 'e5' });
  assert.deepEqual(casar('Cris', elenco, avulsos), { tipo: 'elenco', id: 'e5' });
  assert.deepEqual(casar('Pedro Nunes', elenco, avulsos), { tipo: 'parecido', id: 'e4', de: 'elenco' });
  assert.deepEqual(casar('Luiz', elenco, avulsos), { tipo: 'parecido', id: 'e6', de: 'elenco' });
  assert.deepEqual(casar('Gabriel', elenco, avulsos), { tipo: 'avulso', id: 'a1' });
  assert.deepEqual(casar('Cristian', elenco, avulsos), { tipo: 'novo' });
  assert.deepEqual(casar('Matheus', elenco, avulsos), { tipo: 'novo' });
  /* Dois candidatos parecidos: não escolhe sozinho. */
  assert.deepEqual(
    casar(
      'Pedro',
      [...elenco, { id: 'e8', nome: 'Pedro Henrique' }].filter(p => p.id !== 'e4'),
      [{ id: 'a2', nome: 'Pedro Lima' }]
    ),
    { tipo: 'novo' }
  );
});

test('CT-KAN-244-09: posição de quem é novo vem da sigla ou de "goleiro"', () => {
  const ks = ['GOL', 'DEF', 'MEI', 'ATA', 'VOL'];
  const l = o => Object.assign({ nome: 'X', s: 'in', espera: false, avulso: false, goleiro: false, pos: '' }, o);
  assert.equal(posicaoDe(l({ goleiro: true }), ks, 'GOL'), 'GOL');
  assert.equal(posicaoDe(l({ pos: 'M' }), ks, 'GOL'), 'MEI');
  assert.equal(posicaoDe(l({ pos: 'V' }), ks, 'GOL'), 'VOL');
  assert.equal(posicaoDe(l({ pos: 'A' }), ks, 'GOL'), 'ATA');
  assert.equal(posicaoDe(l({ pos: 'LE' }), ks, 'GOL'), '');
  assert.equal(posicaoDe(l({ pos: 'Z' }), ks, 'GOL'), '');
  assert.equal(posicaoDe(l({ goleiro: true }), ['LEV', 'PON'], 'GOL'), '');
});
