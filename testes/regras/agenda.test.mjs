/* KAN-124: o evento de agenda (.ics) que o link do jogador monta no próprio aparelho.
   Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deslocamento, dobrar, escapar, nomeArquivo, textoAgenda } from '../../src/dominio/agenda.ts';

const base = {
  titulo: 'Futebol — Pelada de Segunda',
  descricao: 'Mudou de ideia? Responda aqui: https://x.web.app/#/p/g1/r/f-2026-11-16-2000',
  link: 'https://x.web.app/#/p/g1/r/f-2026-11-16-2000',
  data: '2026-11-16',
  ini: '20:00',
  fim: '22:00',
  local: 'Arena Society',
  fuso: 'America/Sao_Paulo',
  uid: 'g1-f-2026-11-16-2000@nosso-jogo',
  agora: new Date(Date.UTC(2026, 10, 11, 12, 0, 0)),
};
const ev = o => textoAgenda(Object.assign({}, base, o));
const linhas = t => t.replace(/\r\n /g, '').split('\r\n');

test('CT-KAN-124-01: evento com título, data, início, término, local, alarme de 3 horas e o link', () => {
  const t = ev({}),
    l = linhas(t);
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\n') && t.endsWith('END:VCALENDAR\r\n'));
  assert.ok(l.includes('SUMMARY:Futebol — Pelada de Segunda'));
  assert.ok(l.includes('DTSTART;TZID=America/Sao_Paulo:20261116T200000'));
  assert.ok(l.includes('DTEND;TZID=America/Sao_Paulo:20261116T220000'));
  assert.ok(l.includes('LOCATION:Arena Society'));
  assert.ok(l.includes('TRIGGER:-PT3H'));
  assert.ok(l.includes('URL:' + base.link));
  assert.ok(l.some(x => x.startsWith('DESCRIPTION:Mudou de ideia? Responda aqui: https://x.web.app')));
  assert.ok(l.includes('TZOFFSETTO:-0300'));
  assert.ok(!l.some(x => x.startsWith('RRULE')));
});

test('CT-KAN-124-02: "Toda semana" repete no mesmo dia da semana', () => {
  assert.ok(linhas(ev({ semanal: true })).includes('RRULE:FREQ=WEEKLY;BYDAY=MO'));
  assert.ok(linhas(ev({ semanal: true, data: '2026-11-19' })).includes('RRULE:FREQ=WEEKLY;BYDAY=TH'));
  assert.equal(nomeArquivo('2026-11-16', true), 'nosso-jogo-2026-11-16-semanal.ics');
});

test('CT-KAN-124-06: sem término, 1h30 de jogo; sem local, sem a linha; término depois da meia-noite, no dia seguinte', () => {
  const l = linhas(ev({ fim: undefined, local: '' }));
  assert.ok(l.includes('DTEND;TZID=America/Sao_Paulo:20261116T213000'));
  assert.ok(!l.some(x => x.startsWith('LOCATION')));
  assert.ok(linhas(ev({ ini: '23:00', fim: '01:00' })).includes('DTEND;TZID=America/Sao_Paulo:20261117T010000'));
  assert.ok(linhas(ev({ ini: '23:00', fim: undefined })).includes('DTEND;TZID=America/Sao_Paulo:20261117T003000'));
  const dia = linhas(ev({ ini: undefined, fim: undefined }));
  assert.ok(dia.includes('DTSTART;VALUE=DATE:20261116') && dia.includes('DTEND;VALUE=DATE:20261117'));
});

test('CT-KAN-124-10: a hora segue o fuso do grupo; grupo sem fuso usa o relógio do aparelho', () => {
  assert.equal(deslocamento('America/Sao_Paulo', '2026-11-16', '20:00'), -180);
  assert.equal(deslocamento('America/New_York', '2026-07-01', '20:00'), -240);
  assert.equal(deslocamento('America/New_York', '2026-12-01', '20:00'), -300);
  const ny = linhas(ev({ fuso: 'America/New_York' }));
  assert.ok(ny.includes('DTSTART;TZID=America/New_York:20261116T200000') && ny.includes('TZOFFSETTO:-0500'));
  const semFuso = linhas(ev({ fuso: '' }));
  assert.ok(semFuso.includes('DTSTART:20261116T200000') && !semFuso.some(x => x.startsWith('BEGIN:VTIMEZONE')));
  /* Fuso inválido não quebra: vira hora do aparelho. */
  assert.ok(linhas(ev({ fuso: 'Lugar/Nenhum' })).includes('DTSTART:20261116T200000'));
});

test('CT-KAN-124-11: vírgula, ponto e vírgula, barra e quebra de linha escapados; linha longa dobrada sem partir letra', () => {
  assert.equal(escapar('a, b; c\\d\ne'), 'a\\, b\\; c\\\\d\\ne');
  const t = ev({ local: 'Rua X, 100; quadra 3\n' + 'Ã'.repeat(200), titulo: '<b>teste</b> 😀 Ãçé — Grupo' });
  const cruas = t.split('\r\n');
  assert.ok(
    cruas.every(x => new TextEncoder().encode(x).length <= 75),
    'nenhuma linha passa de 75 bytes'
  );
  assert.ok(linhas(t).includes('SUMMARY:<b>teste</b> 😀 Ãçé — Grupo'));
  assert.ok(linhas(t).some(x => x.startsWith('LOCATION:Rua X\\, 100\\; quadra 3\\nÃÃ')));
  const d = dobrar('X'.repeat(160));
  assert.deepEqual(
    d.split('\r\n').map(x => x.length),
    [75, 75, 12]
  );
});

test('CT-KAN-124-08: o evento leva só o que o link já mostra', () => {
  const t = ev({});
  for (const proibido of ['nota', 'mensalista', 'diarista', 'pix', 'r$'])
    assert.ok(!t.toLowerCase().includes(proibido), proibido);
  /* O único "@" é o do identificador do evento. */
  assert.equal((t.match(/@/g) || []).length, 1);
});
