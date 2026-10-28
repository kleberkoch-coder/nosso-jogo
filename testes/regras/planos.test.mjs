/* Planos (KAN-115) e área administrativa (KAN-116). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PLANOS_PADRAO,
  catalogo,
  filtrarClientes,
  montarClientes,
  planoDaConta,
  resumoPorPlano,
  temRecurso,
} from '../../src/dominio/planos.ts';

const AGORA = Date.UTC(2026, 9, 13, 15),
  DIA = 864e5;

test('sem catálogo no Firebase, valem Grátis, A e B padrão', () => {
  const c = catalogo(null);
  assert.deepEqual(Object.keys(c), ['gratis', 'A', 'B']);
  assert.equal(c.gratis.grupos, 1);
  assert.equal(c.A.grupos, 3);
  assert.equal(c.B.grupos, null);
  assert.deepEqual([c.gratis.admins, c.A.admins, c.B.admins], [1, 2, 5]);
});

test('catálogo do Firebase vale sem versão nova; plano novo é aceito; plano inválido é ignorado; Grátis sempre existe', () => {
  const c = catalogo({
    planos: {
      A: { nome: 'Turma', grupos: 4, admins: 2, recursos: ['presenca', 'caixa'] },
      C: { nome: 'Clube', grupos: 10, admins: 10, recursos: ['presenca'] },
      X: { nome: 'Quebrado', grupos: -1, admins: 1, recursos: [] },
    },
  });
  assert.equal(c.A.grupos, 4);
  assert.equal(c.C.nome, 'Clube');
  assert.equal(c.X, undefined);
  assert.equal(c.gratis.nome, 'Grátis');
});

test('conta sem plano, com plano que não existe ou vencido fica no Grátis', () => {
  const cat = catalogo(null);
  assert.equal(planoDaConta(null, cat, AGORA).id, 'gratis');
  assert.equal(planoDaConta({ plano: 'Z' }, cat, AGORA).id, 'gratis');
  const v = planoDaConta({ plano: 'B', planoAte: AGORA - DIA }, cat, AGORA);
  assert.equal(v.id, 'gratis');
  assert.equal(v.vencido, true);
  assert.equal(v.contratado, 'B');
  const ok = planoDaConta({ plano: 'B', planoAte: AGORA + DIA }, cat, AGORA);
  assert.equal(ok.id, 'B');
  assert.equal(ok.ate, AGORA + DIA);
  assert.equal(planoDaConta({ plano: 'A' }, cat, AGORA).id, 'A');
});

test('recursos: o app pergunta pelo recurso, não pelo nome do plano', () => {
  const cat = catalogo(null);
  assert.equal(temRecurso(planoDaConta(null, cat, AGORA), 'votacao'), false);
  assert.equal(temRecurso(planoDaConta({ plano: 'A' }, cat, AGORA), 'votacao'), true);
  assert.equal(temRecurso(planoDaConta({ plano: 'A' }, cat, AGORA), 'iaCards'), false);
  assert.equal(temRecurso(planoDaConta({ plano: 'B' }, cat, AGORA), 'iaCards'), true);
});

test('portal: as regras liberam só identificadores da lista e só com login do Google; o app dos clientes não tem portal', () => {
  const r = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(
    r,
    /function adminPortal\(\)[\s\S]*sign_in_provider == 'google\.com'[\s\S]*request\.auth\.uid in \/\*ADMINS_PORTAL\*\/\[/
  );
  assert.doesNotMatch(r, /token\.email in/, 'o acesso não pode depender só do e-mail');
  const app = fs.readdirSync('src/telas').join(' ');
  assert.doesNotMatch(app, /portal/i, 'nenhuma tela do portal dentro do app dos clientes');
});

const CONTAS = {
  u1: { email: 'ana@x.com', plano: 'A', planoAte: AGORA + 3 * DIA, acesso: AGORA - DIA, criada: AGORA - 90 * DIA },
  u2: { email: 'beto@x.com', acesso: AGORA - 40 * DIA },
};
const GRUPOS = {
  g1: { owner: 'u1', name: 'Futebol de Segunda', ativo: true },
  g2: { owner: 'u1', name: 'Vôlei', ativo: false },
  g3: { owner: 'u3', name: 'Beach da Praia', ativo: true },
};

test('clientes juntam conta, grupos do dono e última rodada; dono sem ficha aparece com e-mail do cadastro de administrador', () => {
  const cs = montarClientes(
    CONTAS,
    GRUPOS,
    { u3: 'caio@x.com' },
    { g1: '2026-10-12', g2: '2026-08-01', g3: null },
    catalogo(null),
    AGORA
  );
  assert.equal(cs.length, 3);
  const ana = cs.find(c => c.uid === 'u1');
  assert.equal(ana.planoNome, 'Plano A');
  assert.equal(ana.gruposAtivos, 1);
  assert.equal(ana.gruposInativos, 1);
  assert.equal(ana.ultimaRodada, '2026-10-12');
  const caio = cs.find(c => c.uid === 'u3');
  assert.equal(caio.email, 'caio@x.com');
  assert.equal(caio.acesso, null);
  assert.equal(caio.plano, 'gratis');
  assert.equal(caio.teste, null);
  assert.equal(cs[0].uid, 'u1', 'quem acessou por último vem primeiro');
});

test('filtros: plano, sem acesso há mais de 30 dias, teste vencendo em 7 dias e busca por e-mail ou grupo', () => {
  const cs = montarClientes(CONTAS, GRUPOS, { u3: 'caio@x.com' }, {}, catalogo(null), AGORA);
  assert.deepEqual(
    filtrarClientes(cs, 'plano:A', '', AGORA).map(c => c.uid),
    ['u1']
  );
  assert.deepEqual(
    filtrarClientes(cs, 'semAcesso30', '', AGORA)
      .map(c => c.uid)
      .sort(),
    ['u2', 'u3']
  );
  assert.deepEqual(
    filtrarClientes(cs, 'vence7', '', AGORA).map(c => c.uid),
    ['u1']
  );
  assert.deepEqual(
    filtrarClientes(cs, 'todos', 'BETO', AGORA).map(c => c.uid),
    ['u2']
  );
  assert.deepEqual(
    filtrarClientes(cs, 'todos', 'praia', AGORA).map(c => c.uid),
    ['u3']
  );
  assert.deepEqual(resumoPorPlano(cs), { A: 1, gratis: 2 });
});

test('os planos padrão seguem a proposta do Kleber (PLANOS-E-CONCORRENTES.md)', () => {
  assert.ok(!PLANOS_PADRAO.gratis.recursos.includes('caixa'));
  assert.ok(PLANOS_PADRAO.A.recursos.includes('listaEspera'));
  assert.ok(PLANOS_PADRAO.B.recursos.includes('painelCaixa'));
});

/* ---------- KAN-119 (pelada-v70): plano em vigor, teste grátis, transição e limites ---------- */
import {
  TESTE_DIAS,
  TRANSICAO_PADRAO,
  diasParaAcabar,
  espelho,
  gruposAcima,
  mesmoEspelho,
  planoComRecurso,
  situacao,
  situacaoDoEspelho,
  transicaoAte,
} from '../../src/dominio/planos.ts';

const CAT = PLANOS_PADRAO,
  DEPOIS = AGORA + 60 * DIA; // transição já acabou

test('KAN-119: sem plano, sem teste e depois da transição, a conta fica no Grátis e pode testar', () => {
  const s = situacao({}, CAT, DEPOIS, AGORA);
  assert.equal(s.id, 'gratis');
  assert.equal(s.podeTestar, true);
  assert.equal(temRecurso(s, 'caixa'), false);
  assert.equal(temRecurso(s, 'presenca'), true);
});

test('KAN-119: durante a transição, toda conta tem o Plano A até a data da transição', () => {
  const s = situacao(null, CAT, AGORA, AGORA + 10 * DIA);
  assert.equal(s.id, 'A');
  assert.equal(s.origem, 'transicao');
  assert.equal(s.ate, AGORA + 10 * DIA);
  assert.equal(s.podeTestar, false);
});

test('KAN-119: o teste dá 14 dias de Plano A, uma vez só; depois volta ao Grátis sem poder testar de novo', () => {
  const ini = DEPOIS - 2 * DIA;
  const s = situacao({ teste: ini }, CAT, DEPOIS, AGORA);
  assert.equal(s.id, 'A');
  assert.equal(s.origem, 'teste');
  assert.equal(s.ate, ini + TESTE_DIAS * DIA);
  const fim = situacao({ teste: ini }, CAT, ini + TESTE_DIAS * DIA + 1, AGORA);
  assert.equal(fim.id, 'gratis');
  assert.equal(fim.podeTestar, false);
});

test('KAN-119: teste e transição juntos valem até a data mais distante', () => {
  const s = situacao({ teste: AGORA }, CAT, AGORA + DIA, AGORA + 30 * DIA);
  assert.equal(s.origem, 'transicao');
  assert.equal(s.ate, AGORA + 30 * DIA);
});

test('KAN-119: plano pago vale antes do teste e da transição; vencido, volta ao que sobrar', () => {
  assert.equal(situacao({ plano: 'B' }, CAT, AGORA, AGORA + DIA).id, 'B');
  assert.equal(situacao({ plano: 'B' }, CAT, AGORA, AGORA + DIA).origem, 'pago');
  const venc = situacao({ plano: 'B', planoAte: AGORA - 1 }, CAT, AGORA, AGORA + DIA);
  assert.equal(venc.id, 'A');
  assert.equal(venc.origem, 'transicao');
});

test('KAN-119: aviso 3 dias antes de acabar; antes disso, nada', () => {
  const s = situacao({ teste: DEPOIS - 11 * DIA }, CAT, DEPOIS, AGORA);
  assert.equal(diasParaAcabar(s, DEPOIS), 3);
  assert.equal(diasParaAcabar(s, DEPOIS - DIA), null);
  assert.equal(diasParaAcabar(situacao({ plano: 'A' }, CAT, AGORA, 0), AGORA), null);
  assert.equal(diasParaAcabar(situacao({}, CAT, DEPOIS, AGORA), DEPOIS), null);
});

test('KAN-119: data da transição vem do Firebase; sem ela, vale a padrão', () => {
  assert.equal(transicaoAte(null), TRANSICAO_PADRAO);
  assert.equal(transicaoAte({ transicaoAte: 'ontem' }), TRANSICAO_PADRAO);
  assert.equal(transicaoAte({ transicaoAte: 123 }), 123);
});

test('KAN-119: espelho do grupo mostra o mesmo plano aos convidados e vence sozinho', () => {
  const s = situacao({ teste: AGORA }, CAT, AGORA, 0),
    e = espelho(s);
  assert.equal(mesmoEspelho(e, espelho(s)), true);
  assert.equal(mesmoEspelho({ ...e, ate: 1 }, e), false);
  assert.equal(situacaoDoEspelho(e, CAT, AGORA).id, 'A');
  assert.equal(situacaoDoEspelho(e, CAT, AGORA).origem, 'teste');
  const depois = situacaoDoEspelho(e, CAT, AGORA + 15 * DIA);
  assert.equal(depois.id, 'gratis');
  assert.equal(depois.podeTestar, false);
  assert.equal(situacaoDoEspelho(null, CAT, AGORA).id, 'gratis');
  assert.equal(situacaoDoEspelho({ id: 'Z' }, CAT, AGORA).id, 'gratis');
});

test('KAN-119: limite de grupos ativos por plano e quantos passam do limite', () => {
  const gratis = situacao({}, CAT, DEPOIS, AGORA),
    b = situacao({ plano: 'B' }, CAT, AGORA, 0);
  assert.equal(gruposAcima(3, gratis), 2);
  assert.equal(gruposAcima(1, gratis), 0);
  assert.equal(gruposAcima(50, b), 0);
});

test('KAN-119: o convite do cadeado diz o plano que tem o recurso', () => {
  assert.equal(planoComRecurso(CAT, 'votacao'), 'Plano A');
  assert.equal(planoComRecurso(CAT, 'iaCards'), 'Plano B');
  assert.equal(planoComRecurso(CAT, 'nada'), null);
});

test('KAN-119: a data padrão da transição é a mesma no app e nas regras do Firebase', () => {
  const regras = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const m = regras.match(/'transicaoAte', 0\) : (\d+) \* (\d+);/);
  assert.ok(m, 'data da transição não encontrada em firestore.rules');
  assert.ok(Number(m[1]) < 2 ** 31 && Number(m[2]) < 2 ** 31, 'cada número das regras cabe em 32 bits');
  assert.equal(Number(m[1]) * Number(m[2]), TRANSICAO_PADRAO);
  assert.equal(new Date(TRANSICAO_PADRAO).toISOString(), '2026-11-29T03:00:00.000Z');
});
