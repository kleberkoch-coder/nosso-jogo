/* Avisos no celular dos administradores (KAN-242, pelada-v116). Regra pura, usada pelas funções do servidor
   (funcoes/src) e testada em testes/regras/avisos.test.mjs. Não lê o banco nem o estado do app.
   - Resposta pelo link: avisa a primeira resposta (vai / não vai) e cada troca. Gravação de um administrador (pelo
     app) não avisa; quem decide isso é o servidor, que confere se quem gravou é administrador do grupo.
   - Faltam pessoas: X horas antes do início do jogo (padrão 3, de 1 a 24, escolhido por grupo), se os confirmados
     estiverem abaixo do mínimo do grupo (cfg.minPos). Sem mínimo, não avisa. Uma vez por rodada.
   - Os horários das rodadas são texto local do lugar do jogo ("2026-11-13", "20:00"); o "agora" é convertido para o
     fuso do grupo antes de comparar, como no app (i18n/formatos.js).
   - O texto do aviso leva só nome, grupo, data, hora e contagem: nada de notas, caixa ou contatos. */
import { TOTAL, faltaTotal, minimoValido } from './posicoes.ts';
import { proximasFixas, type Fixo } from './rodadas-fixas.ts';
import { TEXTOS } from '../i18n/avisos-servidor.ts';

export type Marca = 'in' | 'out';
export type Presenca = { s?: Marca | string; by?: string; nome?: string; pos?: string };
export type TipoResposta = 'vai' | 'naoVai' | 'mudouVai' | 'mudouNaoVai';
export type Rodada = { date?: string; time?: string; fim?: string; cancelada?: boolean };
export type Jogo = { id: string; date: string; time: string };
export type Idioma = 'pt-BR' | 'en' | 'es';

export const HORAS_PADRAO = 3;
export const FUSO_PADRAO = 'America/Sao_Paulo';

/* Horas antes do jogo: inteiro de 1 a 24; o resto vira o padrão. */
export function horasValidas(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : HORAS_PADRAO;
}

/* Que aviso uma gravação de presença gera: nada se a resposta não mudou ou foi apagada. */
export function tipoDaResposta(
  antes: Presenca | null | undefined,
  depois: Presenca | null | undefined
): TipoResposta | null {
  const s = depois && depois.s;
  if (s !== 'in' && s !== 'out') return null;
  const a = antes && antes.s;
  if (a === s) return null;
  if (a !== 'in' && a !== 'out') return s === 'in' ? 'vai' : 'naoVai';
  return s === 'in' ? 'mudouVai' : 'mudouNaoVai';
}

/* "Agora" no relógio do lugar do jogo: um Date cujos campos (dia, hora…) são os do fuso do grupo. Fuso inválido ou
   vazio usa o do Brasil (grupos antigos, sem fuso gravado). */
export function agoraNoFuso(ms: number, fuso?: string): Date {
  const p: Record<string, number> = {};
  const ler = (tz: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(ms))
      .forEach(x => {
        if (x.type !== 'literal') p[x.type] = +x.value;
      });
  try {
    ler(fuso || FUSO_PADRAO);
  } catch (e) {
    ler(FUSO_PADRAO);
  }
  return new Date(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

const inicio = (j: { date: string; time: string }) => new Date(j.date + 'T' + j.time).getTime();

/* Jogos que entram na janela do aviso agora: começam daqui a no máximo "horas" e ainda não começaram. Vale para as
   rodadas gravadas (não canceladas, com horário) e para a próxima de cada dia fixo que ainda não tem documento. */
export function jogosNaJanela(
  fixos: Fixo[],
  docs: Record<string, Rodada | undefined>,
  agoraLocal: Date,
  horas: number
): Jogo[] {
  const now = agoraLocal.getTime(),
    h = horasValidas(horas) * 3600e3,
    out: Jogo[] = [];
  const entra = (j: Jogo) => {
    const t = inicio(j);
    return Number.isFinite(t) && t > now && t - h <= now;
  };
  Object.entries(docs).forEach(([id, r]) => {
    if (r && !r.cancelada && r.date && r.time && /^\d{2}:\d{2}$/.test(r.time)) {
      const j = { id, date: r.date, time: r.time };
      if (entra(j)) out.push(j);
    }
  });
  proximasFixas(fixos || [], docs as Record<string, Rodada>, agoraLocal).forEach(v => {
    if (!v.time) return;
    const j = { id: v.id, date: v.date, time: v.time };
    if (entra(j)) out.push(j);
  });
  return out;
}

/* O grupo tem mínimo para avisar? (total ou alguma posição) */
export const temMinimo = (minimos?: Record<string, unknown> | null) =>
  Object.values(minimos || {}).some(v => minimoValido(v) > 0);

/* O que falta para o mínimo: total e por posição (as posições na ordem do mínimo do grupo). */
export function faltas(
  confirmados: { pos?: string }[],
  minimos: Record<string, unknown> = {}
): { total: { n: number; min: number; falta: number }; pos: { k: string; falta: number }[] } {
  const t = faltaTotal(confirmados.length, minimos),
    n: Record<string, number> = {};
  confirmados.forEach(c => {
    if (c.pos) n[c.pos] = (n[c.pos] || 0) + 1;
  });
  const pos = Object.keys(minimos)
    .filter(k => k !== TOTAL)
    .map(k => ({ k, falta: Math.max(0, minimoValido(minimos[k]) - (n[k] || 0)) }))
    .filter(x => x.falta > 0);
  return { total: { n: confirmados.length, min: t.min, falta: t.falta }, pos };
}

/* ---------- Textos (três idiomas, em i18n/avisos-servidor.ts: o servidor não carrega o dicionário do app) ---------- */
export const CHAVES_TEXTO = Object.keys(TEXTOS['pt-BR']);
export const textosDe = (l: Idioma) => TEXTOS[l];

export const idiomaValido = (l: unknown): Idioma => (l === 'en' || l === 'es' ? l : 'pt-BR');
const tt = (l: Idioma, k: string, v: Record<string, string | number> = {}) =>
  (TEXTOS[l][k] || TEXTOS['pt-BR'][k] || k).replace(/\{(\w+)\}/g, (_, x) => (x in v ? String(v[x]) : ''));

/* "qui., 13/11" no idioma da pessoa e na ordem de data do país do grupo (como fdate, no app). */
export function dataCurta(date: string, l: Idioma, formato = 'pt-BR'): string {
  const d = new Date(date + 'T12:00');
  if (!Number.isFinite(d.getTime())) return date;
  try {
    return (
      d.toLocaleDateString(l, { weekday: 'short' }).replace('.', '') +
      ', ' +
      d.toLocaleDateString(formato, { day: '2-digit', month: '2-digit' })
    );
  } catch (e) {
    return date;
  }
}

export type Aviso = { titulo: string; corpo: string };

export function textoResposta(
  tipo: TipoResposta,
  o: { nome?: string; grupo: string; date: string; confirmados: number; formato?: string },
  l: Idioma
): Aviso {
  const nome = String(o.nome || '').trim() || tt(l, 'alguem');
  const data = dataCurta(o.date, l, o.formato);
  return {
    titulo: tt(l, tipo, { nome }).slice(0, 80),
    corpo: tt(l, o.confirmados === 1 ? 'corpoResposta1' : 'corpoResposta', { grupo: o.grupo, data, n: o.confirmados }),
  };
}

export function textoFalta(
  f: ReturnType<typeof faltas>,
  o: { grupo: string; date: string; time: string; formato?: string },
  l: Idioma
): Aviso {
  const data = dataCurta(o.date, l, o.formato);
  const titulo = f.total.falta
    ? f.total.falta === 1
      ? tt(l, 'faltaTitulo1')
      : tt(l, 'faltaTitulo', { n: f.total.falta })
    : tt(l, 'faltaPosTitulo');
  const base = f.total.min
    ? tt(l, 'faltaCorpo', { grupo: o.grupo, data, hora: o.time, conf: f.total.n, min: f.total.min })
    : tt(l, 'faltaCorpoSemTotal', { grupo: o.grupo, data, hora: o.time, conf: f.total.n });
  const pos = f.pos.map(p => tt(l, 'faltaPos', { n: p.falta, pos: p.k })).join(' · ');
  return { titulo, corpo: pos ? base + ' · ' + pos : base };
}

/* Precisa avisar? Só se faltar algo (no total ou em alguma posição). */
export const faltaAlgo = (f: ReturnType<typeof faltas>) => f.total.falta > 0 || f.pos.length > 0;

/* Endereço que o toque no aviso abre: a rodada na gestão. */
export const linkDaRodada = (gid: string, rid: string) =>
  './#/g/' + encodeURIComponent(gid) + '/r/' + encodeURIComponent(rid);
