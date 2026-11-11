/* Falhas no uso (KAN-239, 1ª parte, pelada-v105). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, cabeNoDia, corta, ignorar, navegacao } from '../../src/dominio/falhas.ts';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0',
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  webview:
    'Mozilla/5.0 (Linux; Android 12; moto g) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36; wv)',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
};

test('CT-KAN-239-01: navegador, sistema e tipo de aparelho, só com o nome e a versão principal', () => {
  assert.deepEqual(navegacao(UA.iphone), { nav: 'Safari 17', so: 'iOS 17', disp: 'celular' });
  assert.deepEqual(navegacao(UA.iphoneChrome), { nav: 'Chrome 130', so: 'iOS 18', disp: 'celular' });
  assert.deepEqual(navegacao(UA.instagram), { nav: 'Instagram', so: 'iOS 17', disp: 'celular' });
  assert.deepEqual(navegacao(UA.android), { nav: 'Chrome 130', so: 'Android 14', disp: 'celular' });
  assert.deepEqual(navegacao(UA.samsung), { nav: 'Samsung Internet 25', so: 'Android 13', disp: 'celular' });
  assert.equal(navegacao(UA.webview).nav, 'Chrome (app) 129');
  assert.deepEqual(navegacao(UA.windows), { nav: 'Edge 130', so: 'Windows', disp: 'computador' });
  assert.deepEqual(navegacao(UA.ipad, true), { nav: 'Safari 17', so: 'iPadOS 17', disp: 'tablet' });
  assert.deepEqual(navegacao(UA.ipad, false), { nav: 'Safari 17', so: 'macOS', disp: 'computador' });
  assert.deepEqual(navegacao(''), { nav: 'outro', so: 'outro', disp: 'computador' });
});

test('CT-KAN-239-02: no máximo 20 por aparelho por dia; no dia seguinte, volta a contar', () => {
  let e = null;
  for (let i = 0; i < 20; i++) {
    const r = cabeNoDia(e, '2026-11-11');
    assert.equal(r.pode, true);
    e = r.estado;
  }
  assert.deepEqual(cabeNoDia(e, '2026-11-11'), { pode: false, estado: { d: '2026-11-11', n: 20 } });
  assert.deepEqual(cabeNoDia(e, '2026-11-12'), { pode: true, estado: { d: '2026-11-12', n: 1 } });
});

test('CT-KAN-239-03: mensagens curtas, sem quebras; erros de extensão e "Script error." não contam', () => {
  assert.equal(corta('a\n  b\tc', 300), 'a b c');
  assert.equal(corta('x'.repeat(500), 300).length, 300);
  assert.equal(corta(null, 10), '');
  assert.equal(ignorar('Script error.'), true);
  assert.equal(ignorar('ResizeObserver loop completed with undelivered notifications.'), true);
  assert.equal(ignorar('x is null', 'chrome-extension://abc/x.js'), true);
  assert.equal(ignorar("Cannot read properties of null (reading 'id')"), false);
});

test('CT-KAN-239-04: o portal agrupa por tipo e mensagem, soma as vezes e mostra os navegadores', () => {
  const g = agrupar({
    a: {
      t: 'appcheck',
      m: 'appCheck/fetch-status-error',
      v: 'pelada-v105',
      r: 'r',
      nav: 'Safari 17',
      so: 'iOS 17',
      disp: 'celular',
      n: 3,
      em: 100,
    },
    b: {
      t: 'appcheck',
      m: 'appCheck/fetch-status-error',
      v: 'pelada-v105',
      r: 'v',
      nav: 'Safari 17',
      so: 'iOS 17',
      disp: 'celular',
      inst: true,
      n: 1,
      em: 300,
    },
    c: {
      t: 'erro',
      m: 'x is null',
      v: 'pelada-v104',
      r: 'g',
      nav: 'Chrome 130',
      so: 'Android 14',
      disp: 'celular',
      n: 1,
      em: 200,
    },
    d: null,
  });
  assert.equal(g.length, 2);
  assert.deepEqual(
    [g[0].t, g[0].n, g[0].registros, g[0].primeira, g[0].ultima, g[0].telas],
    ['appcheck', 4, 2, 100, 300, ['r', 'v']]
  );
  assert.deepEqual(g[0].navs, [
    ['Safari 17 · iOS 17 · celular', 3],
    ['Safari 17 · iOS 17 · celular · instalado', 1],
  ]);
  assert.deepEqual(g[1].versoes, ['pelada-v104']);
});
