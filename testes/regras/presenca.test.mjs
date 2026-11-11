/* KAN-262: o que grava quando alguém marca Vou ou Não vou (antes dentro de setPres, sem teste próprio).
   Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respostaDePresenca } from '../../src/dominio/presenca.ts';

const base = {
  atual: null,
  eu: 'u1',
  admin: false,
  jogador: { n: 'Ana' },
  vagasCtrl: false,
  vagasOcupadas: 0,
  agora: 1000,
};
const ctx = o => Object.assign({}, base, o);

test('CT-KAN-262-01: presença comum pelo link grava hora, quem gravou e o aparelho, sem contador', () => {
  const g = respostaDePresenca({ s: 'in' }, ctx());
  assert.deepEqual(g.pres, { t: 1000, s: 'in', by: 'u1', dev: 'u1' });
  assert.equal(g.avulsoNovo, false);
  assert.equal(g.vaga, 0);
});

test('CT-KAN-262-02: a hora da confirmação só muda quando a resposta muda, e nunca volta (KAN-78)', () => {
  const mesma = respostaDePresenca({ s: 'in' }, ctx({ atual: { s: 'in', t: 500, dev: 'u9' }, agora: 2000 }));
  assert.equal(mesma.pres.t, 500);
  assert.equal(mesma.pres.dev, 'u9', 'o aparelho que respondeu primeiro continua o dono');
  const mudou = respostaDePresenca({ s: 'out' }, ctx({ atual: { s: 'in', t: 500 }, agora: 2000 }));
  assert.equal(mudou.pres.t, 2000);
  const relogioAtrasado = respostaDePresenca({ s: 'out' }, ctx({ atual: { s: 'in', t: 5000 }, agora: 2000 }));
  assert.equal(relogioAtrasado.pres.t, 5000);
});

test('CT-KAN-262-03: pelo link, nome, marca de avulso e posição ficam como estavam; o administrador muda', () => {
  const atual = { s: 'out', t: 1, nome: 'Zé', avulso: true };
  const link = respostaDePresenca({ s: 'in', nome: 'Outro', pos: 'ATA' }, ctx({ atual }));
  assert.equal(link.pres.nome, 'Zé');
  assert.equal(link.pres.avulso, true);
  assert.equal('pos' in link.pres, false);
  const adm = respostaDePresenca({ s: 'in', nome: 'Outro', pos: 'ATA' }, ctx({ atual, admin: true }));
  assert.equal(adm.pres.nome, 'Outro');
  assert.equal(adm.pres.pos, 'ATA');
  assert.equal('dev' in adm.pres, false, 'administrador não vira dono da resposta');
});

test('CT-KAN-262-04: avulso novo pelo link soma no contador de avulsos; já na lista ou pelo administrador, não', () => {
  const novo = respostaDePresenca({ s: 'in', nome: 'Visitante', avulso: true }, ctx({ jogador: undefined }));
  assert.equal(novo.avulsoNovo, true);
  const jaNaLista = respostaDePresenca({ s: 'out' }, ctx({ jogador: undefined, atual: { s: 'in', t: 1 } }));
  assert.equal(jaNaLista.avulsoNovo, false);
  const peloAdm = respostaDePresenca({ s: 'in', nome: 'Visitante' }, ctx({ jogador: undefined, admin: true }));
  assert.equal(peloAdm.avulsoNovo, false);
});

test('CT-KAN-262-05: com o controle de vagas, quem precisa de vaga soma ao entrar e devolve ao sair', () => {
  const diarista = { vaga: true };
  const entra = respostaDePresenca({ s: 'in' }, ctx({ vagasCtrl: true, jogador: diarista }));
  assert.equal(entra.vaga, 1);
  const sai = respostaDePresenca(
    { s: 'out' },
    ctx({ vagasCtrl: true, jogador: diarista, atual: { s: 'in', t: 1 }, vagasOcupadas: 2 })
  );
  assert.equal(sai.vaga, -1);
  const contadorZerado = respostaDePresenca(
    { s: 'out' },
    ctx({ vagasCtrl: true, jogador: diarista, atual: { s: 'in', t: 1 } })
  );
  assert.equal(contadorZerado.vaga, 0, 'o contador nunca fica abaixo de zero');
  const mensalista = respostaDePresenca({ s: 'in' }, ctx({ vagasCtrl: true, jogador: { vaga: false } }));
  assert.equal(mensalista.vaga, 0);
  const semControle = respostaDePresenca({ s: 'in' }, ctx({ jogador: diarista }));
  assert.equal(semControle.vaga, 0);
  const peloAdm = respostaDePresenca({ s: 'in' }, ctx({ vagasCtrl: true, jogador: diarista, admin: true }));
  assert.equal(peloAdm.vaga, 0);
});
