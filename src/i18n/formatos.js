/* Local, formato, moeda e fuso usados em textos, datas, números e valores (KAN-162).
   - LOCAL: idioma dos textos (dicionário, nomes de dias e meses, ordem alfabética). Hoje só português do Brasil.
   - FORMATO: ordem da data e separadores de número, do país do grupo (pt-BR: 16/10 e 1.234,50; en-US: 10/16 e 1,234.50).
   - PAIS: o do grupo (padrão do combo do telefone e da importação da planilha).
   - MOEDA: a do grupo (cfg.moeda), que nasce da moeda do país do organizador.
   - FUSO: o do grupo (cfg.fuso). Vazio (grupo antigo) = relógio do aparelho, como antes.
   - RELÓGIO: 12h (8:00 PM) ou 24h (20:00), do formato do país do grupo (KAN-163). Gravado sempre em 24h.
   Quem muda é definirRegiao(), chamada quando o grupo carrega (rotas.js); fora de um grupo, vale o país da conta. */
const LOCAL = 'pt-BR';
let PAIS = 'BR',
  FORMATO = 'pt-BR',
  MOEDA = 'BRL',
  FUSO = '',
  relogio = null;

function definirRegiao(r) {
  PAIS = r.pais || 'BR';
  FORMATO = r.formato || 'pt-BR';
  MOEDA = r.moeda || 'BRL';
  if (FUSO !== (r.fuso || '')) relogio = null;
  FUSO = r.fuso || '';
}

/* "Agora" no relógio do lugar do jogo: um Date cujos campos (dia, hora…) são os do fuso do grupo.
   Datas e horários das rodadas são gravados como texto local ("2026-10-16", "20:00") e comparados com ele.
   Assim, quem abre de outro fuso vê o jogo terminar na hora certa do lugar. */
function agora() {
  if (!FUSO) return new Date();
  try {
    relogio =
      relogio ||
      new Intl.DateTimeFormat('en-US', {
        timeZone: FUSO,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    const p = {};
    relogio.formatToParts(new Date()).forEach(x => {
      p[x.type] = +x.value;
    });
    return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  } catch (e) {
    return new Date();
  }
}

/* O país do grupo usa relógio de 12 horas (AM/PM)? Vem do navegador (padrão internacional), pelo formato do grupo.
   Com um formato dado (ex.: o país escolhido no formulário do grupo, ainda não salvo, KAN-186), vale o dele. */
const doze = {};
function relogio12(formato = FORMATO) {
  if (!(formato in doze)) {
    try {
      const o = new Intl.DateTimeFormat(formato, { hour: 'numeric' }).resolvedOptions();
      doze[formato] = o.hourCycle ? o.hourCycle === 'h12' || o.hourCycle === 'h11' : !!o.hour12;
    } catch (e) {
      doze[formato] = false;
    }
  }
  return doze[formato];
}

/* Símbolo da moeda do grupo (R$, US$, €…), para rótulos como "Valor (R$)". */
function simboloMoeda() {
  try {
    const p = new Intl.NumberFormat(FORMATO, { style: 'currency', currency: MOEDA })
      .formatToParts(0)
      .find(x => x.type === 'currency');
    return p ? p.value : MOEDA;
  } catch (e) {
    return MOEDA;
  }
}

export { FORMATO, FUSO, LOCAL, MOEDA, PAIS, agora, definirRegiao, relogio12, simboloMoeda };
