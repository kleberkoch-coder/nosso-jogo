/* Planos (KAN-115) e área administrativa (KAN-116). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLANOS_PADRAO, catalogo, filtrarClientes, montarClientes, planoDaConta, resumoPorPlano, temRecurso } from '../../src/dominio/planos.ts';

const AGORA = Date.UTC(2026, 9, 13, 15), DIA = 864e5;

test('sem catálogo no Firebase, valem Grátis, A e B padrão', () => {
  const c = catalogo(null);
  assert.deepEqual(Object.keys(c), ['gratis', 'A', 'B']);
  assert.equal(c.gratis.grupos, 1); assert.equal(c.A.grupos, 3); assert.equal(c.B.grupos, null);
  assert.deepEqual([c.gratis.admins, c.A.admins, c.B.admins], [1, 2, 5]);
});

test('catálogo do Firebase vale sem versão nova; plano novo é aceito; plano inválido é ignorado; Grátis sempre existe', () => {
  const c = catalogo({ planos: {
    A: { nome: 'Turma', grupos: 4, admins: 2, recursos: ['presenca', 'caixa'] },
    C: { nome: 'Clube', grupos: 10, admins: 10, recursos: ['presenca'] },
    X: { nome: 'Quebrado', grupos: -1, admins: 1, recursos: [] },
  } });
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
  assert.equal(v.id, 'gratis'); assert.equal(v.vencido, true); assert.equal(v.contratado, 'B');
  const ok = planoDaConta({ plano: 'B', planoAte: AGORA + DIA }, cat, AGORA);
  assert.equal(ok.id, 'B'); assert.equal(ok.ate, AGORA + DIA);
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
  assert.match(r, /function adminPortal\(\)[\s\S]*sign_in_provider == 'google\.com'[\s\S]*request\.auth\.uid in \/\*ADMINS_PORTAL\*\/\[/);
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
  const cs = montarClientes(CONTAS, GRUPOS, { u3: 'caio@x.com' }, { g1: '2026-10-12', g2: '2026-08-01', g3: null }, catalogo(null), AGORA);
  assert.equal(cs.length, 3);
  const ana = cs.find(c => c.uid === 'u1');
  assert.equal(ana.planoNome, 'Plano A'); assert.equal(ana.gruposAtivos, 1); assert.equal(ana.gruposInativos, 1);
  assert.equal(ana.ultimaRodada, '2026-10-12');
  const caio = cs.find(c => c.uid === 'u3');
  assert.equal(caio.email, 'caio@x.com'); assert.equal(caio.acesso, null); assert.equal(caio.plano, 'gratis');
  assert.equal(cs[0].uid, 'u1', 'quem acessou por último vem primeiro');
});

test('filtros: plano, sem acesso há mais de 30 dias, teste vencendo em 7 dias e busca por e-mail ou grupo', () => {
  const cs = montarClientes(CONTAS, GRUPOS, { u3: 'caio@x.com' }, {}, catalogo(null), AGORA);
  assert.deepEqual(filtrarClientes(cs, 'plano:A', '', AGORA).map(c => c.uid), ['u1']);
  assert.deepEqual(filtrarClientes(cs, 'semAcesso30', '', AGORA).map(c => c.uid).sort(), ['u2', 'u3']);
  assert.deepEqual(filtrarClientes(cs, 'vence7', '', AGORA).map(c => c.uid), ['u1']);
  assert.deepEqual(filtrarClientes(cs, 'todos', 'BETO', AGORA).map(c => c.uid), ['u2']);
  assert.deepEqual(filtrarClientes(cs, 'todos', 'praia', AGORA).map(c => c.uid), ['u3']);
  assert.deepEqual(resumoPorPlano(cs), { A: 1, gratis: 2 });
});

test('os planos padrão seguem a proposta do Kleber (PLANOS-E-CONCORRENTES.md)', () => {
  assert.ok(!PLANOS_PADRAO.gratis.recursos.includes('caixa'));
  assert.ok(PLANOS_PADRAO.A.recursos.includes('listaEspera'));
  assert.ok(PLANOS_PADRAO.B.recursos.includes('painelCaixa'));
});
