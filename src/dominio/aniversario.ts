/* Aniversário do jogador (KAN-272, pelada-v118). Regra pura, testada em testes/regras/aniversario.test.mjs.
   A data de nascimento fica em privado/contatos (campo "nasc", "AAAA-MM-DD"), só para administradores com Elenco.
   - 🎂 na semana do aniversário: de 3 dias antes a 3 dias depois da data de referência (hoje ou a data da rodada).
   - Nascido em 29/02: em ano que não é bissexto, comemora em 28/02.
   - O servidor usa aniversariantesNoDia para o aviso das 9h (funcoes/src/logica.ts). */

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const bissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const dd = (n: number) => String(n).padStart(2, '0');

/* Data válida, de 1900 até hoje. */
export function nascValido(s: unknown, hoje: string): s is string {
  if (typeof s !== 'string') return false;
  const m = RE.exec(s);
  if (!m) return false;
  const [a, me, d] = [+m[1]!, +m[2]!, +m[3]!];
  const dt = new Date(Date.UTC(a, me - 1, d));
  return a >= 1900 && s <= hoje && dt.getUTCMonth() === me - 1 && dt.getUTCDate() === d;
}

/* O aniversário no ano dado ("AAAA-MM-DD"). */
export function aniversarioNoAno(nasc: string, ano: number): string {
  const m = RE.exec(nasc);
  if (!m) return '';
  let me = +m[2]!,
    d = +m[3]!;
  if (me === 2 && d === 29 && !bissexto(ano)) d = 28;
  return ano + '-' + dd(me) + '-' + dd(d);
}

const dias = (a: string, b: string) =>
  Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5);

/* Faz aniversário perto da data (até 3 dias antes ou depois, inclusive na virada do ano)? */
export function aniversarioPerto(nasc: unknown, data: string, margem = 3): boolean {
  if (typeof nasc !== 'string' || !RE.test(nasc) || !RE.test(data)) return false;
  const ano = +data.slice(0, 4);
  return [ano - 1, ano, ano + 1].some(a => Math.abs(dias(aniversarioNoAno(nasc, a), data)) <= margem);
}

type Contatos = Record<string, { nasc?: unknown } | null | undefined>;

/* Aniversariantes do mês ("AAAA-MM"), do dia 1 ao fim, entre os ids dados (o elenco ativo). */
export function aniversariantesDoMes(cont: Contatos, mes: string, ids: string[]): { id: string; dia: number }[] {
  const ano = +mes.slice(0, 4);
  return ids
    .map(id => {
      const n = (cont || {})[id]?.nasc;
      if (typeof n !== 'string' || !RE.test(n)) return null;
      const a = aniversarioNoAno(n, ano);
      return a.slice(0, 7) === mes ? { id, dia: +a.slice(8) } : null;
    })
    .filter((x): x is { id: string; dia: number } => !!x)
    .sort((x, y) => x.dia - y.dia);
}

/* Quem faz aniversário exatamente na data. */
export function aniversariantesNoDia(cont: Contatos, data: string): string[] {
  const ano = +data.slice(0, 4);
  return Object.keys(cont || {}).filter(id => {
    const n = (cont || {})[id]?.nasc;
    return typeof n === 'string' && RE.test(n) && aniversarioNoAno(n, ano) === data;
  });
}

/* Da planilha (KAN-159): "dd/mm/aaaa", "dd-mm-aaaa", "dd.mm.aaaa" ou "aaaa-mm-dd"; nos países que escrevem o mês
   primeiro (EUA), "mm/dd/aaaa". Devolve "AAAA-MM-DD", '' se vazio, ou null se não deu para entender. */
export function lerNascimento(valor: string, hoje: string, mesPrimeiro = false): string | null {
  const v = String(valor || '').trim();
  if (!v) return '';
  let a: number, me: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v),
    br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (iso) [a, me, d] = [+iso[1]!, +iso[2]!, +iso[3]!];
  else if (br) [a, me, d] = mesPrimeiro ? [+br[3]!, +br[1]!, +br[2]!] : [+br[3]!, +br[2]!, +br[1]!];
  else return null;
  const s = a + '-' + dd(me) + '-' + dd(d);
  return nascValido(s, hoje) ? s : null;
}
