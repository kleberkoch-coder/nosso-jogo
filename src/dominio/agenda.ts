/* Evento de agenda (.ics) do link do jogador (KAN-124, pelada-v107). Regra pura: recebe os dados da rodada e devolve
   o texto do arquivo, sem ler o estado do app nem o banco. Teste em testes/regras/agenda.test.mjs.
   - Hora no fuso do grupo (TZID, com um VTIMEZONE simples com o deslocamento da data). Grupo sem fuso (antigo): hora
     "flutuante", que vale no relógio do aparelho, como o app faz hoje.
   - Sem término: 1h30 de jogo. Término antes do início (23:00–01:00): termina no dia seguinte. Sem horário: dia inteiro.
   - Alarme 3 horas antes. "Toda semana" repete no mesmo dia da semana (RRULE semanal).
   - Leva só o que o link já mostra: esporte, grupo, data, horário, local e o link. Nada de nota, tipo, caixa ou contato.
   - Texto escapado (\ ; , e quebra de linha) e linhas dobradas em 75 bytes, como pede o formato (RFC 5545). */

export type DadosAgenda = {
  titulo: string;
  descricao: string;
  link: string;
  data: string; // AAAA-MM-DD
  ini?: string; // HH:MM
  fim?: string; // HH:MM
  local?: string;
  fuso?: string; // IANA (America/Sao_Paulo); vazio = relógio do aparelho
  semanal?: boolean;
  uid: string;
  agora: Date;
};

const DIAS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const p2 = (n: number) => String(n).padStart(2, '0');

export function escapar(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/* Linhas com mais de 75 bytes continuam na linha de baixo, que começa com um espaço (sem partir uma letra). */
export function dobrar(linha: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = '',
    n = 0,
    lim = 75;
  for (const ch of linha) {
    const b = enc.encode(ch).length;
    if (n + b > lim) {
      partes.push(atual);
      atual = '';
      n = 0;
      lim = 74;
    }
    atual += ch;
    n += b;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

/* Data e hora somadas em minutos, sem fuso (aritmética de calendário). */
function somar(data: string, hora: string, min: number) {
  const [y, m, d] = data.split('-').map(Number),
    [hh, mm] = hora.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) + min * 60000);
  return { data: t.toISOString().slice(0, 10), hora: p2(t.getUTCHours()) + ':' + p2(t.getUTCMinutes()) };
}
const local = (data: string, hora: string) => data.replace(/-/g, '') + 'T' + hora.replace(':', '') + '00';
const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/* Quanto o fuso está à frente (+) ou atrás (−) do UTC, em minutos, naquela data e hora. */
export function deslocamento(fuso: string, data: string, hora: string): number {
  const [y, m, d] = data.split('-').map(Number),
    [hh, mm] = hora.split(':').map(Number);
  const chute = Date.UTC(y, m - 1, d, hh, mm);
  const ps = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(chute));
  const v = (t: string) => +(ps.find(p => p.type === t) || { value: '0' }).value;
  return Math.round((Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute')) - chute) / 60000);
}
const offset = (min: number) => (min < 0 ? '-' : '+') + p2(Math.floor(Math.abs(min) / 60)) + p2(Math.abs(min) % 60);

export function textoAgenda(o: DadosAgenda): string {
  const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nosso Jogo//Agenda//PT', 'CALSCALE:GREGORIAN'];
  L.push('METHOD:PUBLISH');
  let fuso = '';
  if (o.ini && o.fuso) {
    try {
      const off = offset(deslocamento(o.fuso, o.data, o.ini));
      fuso = o.fuso;
      L.push('BEGIN:VTIMEZONE', 'TZID:' + fuso, 'BEGIN:STANDARD', 'DTSTART:19700101T000000');
      L.push('TZOFFSETFROM:' + off, 'TZOFFSETTO:' + off, 'END:STANDARD', 'END:VTIMEZONE');
    } catch (e) {
      fuso = '';
    }
  }
  const tz = fuso ? ';TZID=' + fuso : '';
  L.push('BEGIN:VEVENT', 'UID:' + o.uid, 'DTSTAMP:' + utc(o.agora));
  if (o.ini) {
    let fim = o.fim ? { data: o.data, hora: o.fim } : somar(o.data, o.ini, 90);
    if (o.fim && o.fim <= o.ini) fim = { data: somar(o.data, '00:00', 24 * 60).data, hora: o.fim };
    L.push('DTSTART' + tz + ':' + local(o.data, o.ini), 'DTEND' + tz + ':' + local(fim.data, fim.hora));
  } else {
    L.push('DTSTART;VALUE=DATE:' + o.data.replace(/-/g, ''));
    L.push('DTEND;VALUE=DATE:' + somar(o.data, '00:00', 24 * 60).data.replace(/-/g, ''));
  }
  if (o.semanal) {
    const [y, m, d] = o.data.split('-').map(Number);
    L.push('RRULE:FREQ=WEEKLY;BYDAY=' + DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]);
  }
  L.push('SUMMARY:' + escapar(o.titulo));
  if (o.local && o.local.trim()) L.push('LOCATION:' + escapar(o.local.trim()));
  L.push('DESCRIPTION:' + escapar(o.descricao), 'URL:' + o.link);
  L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapar(o.titulo), 'TRIGGER:-PT3H', 'END:VALARM');
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.map(dobrar).join('\r\n') + '\r\n';
}

/* Nome do arquivo: "nosso-jogo-2026-11-16.ics" (ou "-semanal"). */
export const nomeArquivo = (data: string, semanal?: boolean) =>
  'nosso-jogo-' + data + (semanal ? '-semanal' : '') + '.ics';
