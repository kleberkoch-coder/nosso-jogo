/* KAN-159: importar o elenco de uma planilha. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, lerTexto, LIMITE_IMPORTACAO, excedentes } from '../../src/dominio/planilha.ts';

const norm = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const FUT = [
  ['GOL', 'Goleiro'],
  ['DEF', 'Defesa'],
  ['MEI', 'Meio'],
  ['ATA', 'Ataque'],
];
const ctx = (existentes = [], posicoes = FUT) => ({
  posicoes,
  existentes: new Set(existentes.map(norm)),
  normalizar: norm,
});

test('colado do Excel (tabulação) com título: reconhece as colunas pelo nome, em qualquer ordem', () => {
  const t =
    'Jogador\tTelefone\tPosição\tNota\tTipo\tE-mail\nBruno\t(11) 98765-4321\tGoleiro\t7,5\tMensalista\tbruno@clube.com\nRafa\t\tDEF\t6\tDiarista\t';
  const { itens } = interpretar(lerTexto(t), ctx());
  assert.equal(itens.length, 2);
  assert.deepEqual(itens[0], {
    linha: 2,
    nome: 'Bruno',
    tipo: 'mensalista',
    situacao: 'novo',
    avisos: [],
    pos: 'GOL',
    nota: 7.5,
    tel: '+5511987654321',
    email: 'bruno@clube.com',
  });
  assert.equal(itens[1].pos, 'DEF');
  assert.equal(itens[1].tipo, 'diarista');
});

test('sem título: segue a ordem Nome, Posição, Nota, Tipo, Telefone, E-mail', () => {
  const { itens } = interpretar(lerTexto('Gui;Meio;8;D\nJapa;ata;9,5'), ctx());
  assert.equal(itens[0].pos, 'MEI');
  assert.equal(itens[0].tipo, 'diarista');
  assert.equal(itens[1].nota, 9.5);
});

test('lista simples, um nome por linha (ex.: colada do WhatsApp)', () => {
  const { itens } = interpretar(lerTexto('Bruno\nTiago\n\nLéo'), ctx());
  assert.deepEqual(
    itens.map(i => i.nome),
    ['Bruno', 'Tiago', 'Léo']
  );
});

test('CSV com aspas e vírgula dentro do nome', () => {
  const linhas = lerTexto('Nome,Nota\n"Silva, João",7\n"Zé ""Bala""",5');
  assert.deepEqual(linhas, [
    ['Nome', 'Nota'],
    ['Silva, João', '7'],
    ['Zé "Bala"', '5'],
  ]);
});

test('já existe no elenco (sem acento e maiúscula) e repetido na própria lista', () => {
  const { itens } = interpretar(lerTexto('Nome\nLÉO\nBruno\nbruno'), ctx(['Leo']));
  assert.deepEqual(
    itens.map(i => i.situacao),
    ['existe', 'novo', 'repetido']
  );
});

test('valores inválidos viram aviso, e o jogador entra sem eles', () => {
  const { itens } = interpretar(
    lerTexto('Nome\tPosição\tNota\tTipo\tTelefone\tE-mail\nCaio\tZagueiro central\t12\tSócio\t123\tcaio@'),
    ctx()
  );
  assert.deepEqual(itens[0].avisos, ['posicao', 'nota', 'tipo', 'tel', 'email']);
  assert.equal(itens[0].pos, undefined);
  assert.equal(itens[0].nota, undefined);
  assert.equal(itens[0].tipo, 'mensalista');
});

test('esporte sem posição ignora a coluna de posição, sem erro', () => {
  const { itens } = interpretar(lerTexto('Nome\tPosição\nAna\tGoleiro'), ctx([], []));
  assert.deepEqual(itens[0].avisos, []);
  assert.equal(itens[0].pos, undefined);
});

test('linha sem nome é pulada e contada; nome longo é cortado em 40 letras', () => {
  const r = interpretar(lerTexto('Nome\tNota\n\t7\n' + 'A'.repeat(50) + '\t6'), ctx());
  assert.equal(r.semNome, 1);
  assert.equal(r.itens[0].nome.length, 40);
  assert.deepEqual(r.itens[0].avisos, ['nomeLongo']);
});

test('limite de jogadores por importação', () => {
  const t = Array.from({ length: LIMITE_IMPORTACAO + 5 }, (_, i) => 'Jogador ' + i).join('\n');
  const linhas = lerTexto(t);
  assert.equal(interpretar(linhas, ctx()).itens.length, LIMITE_IMPORTACAO);
  assert.equal(excedentes(linhas), 5);
});

test('tipo isento de pagamento (KAN-172): "Isento" e "Não paga" viram isento', () => {
  const { itens } = interpretar(lerTexto('Nome\tTipo\nGol\tIsento\nGol2\tNão paga'), ctx());
  assert.deepEqual(
    itens.map(i => i.tipo),
    ['isento', 'isento']
  );
});
