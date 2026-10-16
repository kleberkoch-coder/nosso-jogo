/* KAN-162: país da conta e do grupo (moeda, formato, fuso) e telefone pelo país do combo. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarPais, PAISES, paisPor, regiaoNova, separarTelefone, telefonePais } from '../../src/dominio/paises.ts';
import { regiaoDe } from '../../src/dominio/regiao.ts';

test('país sugerido pelo fuso do aparelho; sem fuso conhecido, pela região do idioma; senão, Brasil', () => {
  assert.equal(detectarPais('America/Sao_Paulo', 'en-US'), 'BR'); // computador em inglês no Brasil
  assert.equal(detectarPais('America/Manaus', 'pt-BR'), 'BR');
  assert.equal(detectarPais('America/Chicago', 'pt-BR'), 'US');
  assert.equal(detectarPais('Europe/Lisbon', 'pt-PT'), 'PT');
  assert.equal(detectarPais('Etc/UTC', 'es-AR'), 'AR');
  assert.equal(detectarPais('', 'xx'), 'BR');
});

test('grupo novo herda país, moeda e fuso do organizador; fuso do aparelho só se for do país', () => {
  const r = (pais, moeda, fuso, formato) => ({ pais, moeda, fuso, formato });
  assert.deepEqual(regiaoNova('US', 'America/Chicago'), r('US', 'USD', 'America/Chicago', 'en-US'));
  assert.deepEqual(regiaoNova('US', 'America/Sao_Paulo'), r('US', 'USD', 'America/New_York', 'en-US'));
  assert.deepEqual(regiaoNova('BR', 'America/Manaus'), r('BR', 'BRL', 'America/Manaus', 'pt-BR'));
  assert.deepEqual(regiaoNova(undefined, ''), r('BR', 'BRL', 'America/Sao_Paulo', 'pt-BR'));
});

test('grupo antigo, sem país: Brasil, Real e relógio do aparelho; moeda trocada vale', () => {
  assert.deepEqual(regiaoDe(undefined), { pais: 'BR', formato: 'pt-BR', moeda: 'BRL', fuso: '' });
  assert.deepEqual(regiaoDe({ pais: 'US', moeda: 'USD', fuso: 'America/Denver', formato: 'en-US' }), {
    pais: 'US',
    formato: 'en-US',
    moeda: 'USD',
    fuso: 'America/Denver',
  });
  assert.equal(regiaoDe({ pais: 'PT', moeda: 'BRL' }).moeda, 'BRL');
});

test('telefone sem "+" segue o país do combo', () => {
  assert.deepEqual(telefonePais('(415) 555-0100', 'US'), { ok: true, valor: '+14155550100' });
  assert.deepEqual(telefonePais('1 415 555 0100', 'US'), { ok: true, valor: '+14155550100' });
  assert.deepEqual(telefonePais('912 345 678', 'PT'), { ok: true, valor: '+351912345678' });
  assert.deepEqual(telefonePais('07911 123456', 'GB'), { ok: true, valor: '+447911123456' });
  assert.deepEqual(telefonePais('11 98765-4321', 'BR'), { ok: true, valor: '+5511987654321' });
  assert.deepEqual(telefonePais('415 555 010', 'US'), { ok: false, erro: 'curto' });
  // Número brasileiro digitado com o combo ainda nos EUA: não vira um número americano errado.
  assert.deepEqual(telefonePais('(11) 98765-4321', 'US'), { ok: false, erro: 'invalido' });
  assert.deepEqual(telefonePais('912 345 6789', 'PT'), { ok: false, erro: 'longo' });
});

test('com "+", vale o código digitado, qualquer que seja o combo; "Outro país" exige o "+"', () => {
  assert.deepEqual(telefonePais('+55 11 98765-4321', 'US'), { ok: true, valor: '+5511987654321' });
  assert.deepEqual(telefonePais('912345678', ''), { ok: false, erro: 'semPais' });
  assert.deepEqual(telefonePais('+81 90 1234 5678', ''), { ok: true, valor: '+819012345678' });
});

test('telefone gravado volta para o combo e o campo; +1 fica com o país do grupo', () => {
  assert.deepEqual(separarTelefone('+5511987654321', 'US'), { pais: 'BR', numero: '11987654321' });
  assert.deepEqual(separarTelefone('+14165550100', 'CA'), { pais: 'CA', numero: '4165550100' });
  assert.deepEqual(separarTelefone('+14155550100', 'BR'), { pais: 'US', numero: '4155550100' });
  assert.deepEqual(separarTelefone('', 'PT'), { pais: 'PT', numero: '' });
  assert.deepEqual(separarTelefone('11987654321', 'US'), { pais: 'BR', numero: '11987654321' }); // antigo, sem "+"
  assert.deepEqual(separarTelefone('+99912345', 'BR'), { pais: '', numero: '+99912345' });
});

test('todo país da lista tem moeda, formato e fuso válidos para o navegador', () => {
  for (const p of PAISES) {
    assert.equal(paisPor(p.iso), p);
    assert.ok(new Intl.NumberFormat(p.formato, { style: 'currency', currency: p.moeda }).format(1));
    for (const f of p.fusos) assert.ok(new Intl.DateTimeFormat('en', { timeZone: f }).format(0), f);
  }
});

test('"agora" segue o fuso do grupo; sem fuso (grupo antigo), o relógio do aparelho', async () => {
  const f = await import('../../src/i18n/formatos.js');
  f.definirRegiao({ pais: 'JP', formato: 'ja-JP', moeda: 'JPY', fuso: 'Asia/Tokyo' });
  const horaTokyo = +new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date());
  assert.equal(f.agora().getHours(), horaTokyo);
  assert.equal(f.MOEDA, 'JPY');
  f.definirRegiao({ pais: 'BR', formato: 'pt-BR', moeda: 'BRL', fuso: '' });
  assert.equal(f.agora().getHours(), new Date().getHours());
  assert.equal(f.simboloMoeda(), 'R$');
});
