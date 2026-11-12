/* Lista colada do WhatsApp (KAN-244, pelada-v113). Regra pura: lê o texto e diz quem vai, quem não vai e quem não
   respondeu, e casa cada nome com o elenco ou os avulsos. Teste em testes/regras/lista-colada.test.mjs.
   - A marca da linha manda: 👍 ✅ 🤙 👊 💪 ✔ = vai; ❌ ✖ 👎 🚫 ⛔ = não vai. Linha sem marca, numa lista que usa marcas,
     é "sem resposta" (não muda nada). Lista sem nenhuma marca: todo nome é "vai".
   - Seções: "Não vão", "Fora" e "Ausentes" = não vai; "Espera", "Suplentes" e "Reservas" = vai, no fim da lista;
     "Goleiros" marca quem vem embaixo como goleiro. Título, data, horário e regras da lista são ignorados.
   - Parênteses: "(avulso)" e "(convidado)" = avulso; "(goleiro)" e "(gol)" = goleiro; até 3 letras ("(M)", "(LE)") =
     posição, que sai do nome; o resto fica no nome ("Cris (Bigode)"). */

export type Marca = 'in' | 'out' | null;
export type LinhaLida = {
  nome: string;
  s: Marca;
  espera: boolean;
  avulso: boolean;
  goleiro: boolean;
  pos: string;
};
export type Pessoa = { id: string; nome: string };
export type Casamento =
  | { tipo: 'elenco' | 'avulso'; id: string }
  | { tipo: 'parecido'; id: string; de: 'elenco' | 'avulso' }
  | { tipo: 'novo' };

const SIM = /👍|✅|✔|☑|🤙|👊|💪|✓|🆗/u;
const NAO = /❌|✖|👎|🚫|⛔|❎|✗|✘/u;
/* Emojis (com tom de pele, variação e junções) e símbolos de marca saem do nome. */
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍⃣✓✗✘]/gu;

export const normalizar = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const SECAO_NAO = /^(n[ãa]o\s*v[ãa]o|n[ãa]o\s*vai|fora|ausentes?|desist\w*|n[ãa]o\s*confirmad\w*)$/i;
const SECAO_ESPERA = /^(lista\s+de\s+)?(espera|suplentes?|reservas?)$/i;
const SECAO_GOL = /^(goleir[oa]s?|gol(eiros)?)$/i;
const SECAO_VAO = /^(confirmad[oa]s?|v[ãa]o|vai|presen[çc]a|jogadores|linha|lista)$/i;
const AVULSO = /^(avuls[oa]|convidad[oa]|conv)$/i;
const GOLEIRO = /^(goleir[oa]|gol|gk)$/i;
const PALAVRA_SIM = /(?:^|[\s\-–:])(vou|confirmad[oa]|ok|sim|dentro)\s*$/i;
const PALAVRA_NAO = /(?:^|[\s\-–:])(n[ãa]o\s*vou|n[ãa]o\s*vai|fora|out)\s*$/i;

type Secao = 'vao' | 'nao' | 'espera';

function marcaDe(t: string): Marca {
  const si = t.search(SIM),
    na = t.search(NAO);
  if (si < 0 && na < 0) return null;
  if (si < 0) return 'out';
  if (na < 0) return 'in';
  return si > na ? 'in' : 'out';
}

/* Título ("Lista 28/09 das 20:30 às 22h - 👍 ou ❌ - Responder até 13:00"): sem número na frente e com data,
   horário, as duas marcas ou palavras de cabeçalho. */
function ehTitulo(t: string): boolean {
  if (/\d{1,2}\/\d{1,2}/.test(t)) return true;
  if (/\b\d{1,2}(:\d{2}|h\d{0,2})\b/i.test(t)) return true;
  if (SIM.test(t) && NAO.test(t)) return true;
  return /^(lista|jogo|pelada|futebol|racha|resenha|responder|respondam|hor[áa]rio|local|valor|pix)\b/i.test(
    normalizar(t.replace(EMOJI, ''))
  );
}

function secaoDe(t: string): { secao: Secao | null; goleiro: boolean } | null {
  const x = t
    .replace(EMOJI, '')
    .replace(/[:\-–—*_]+$/g, '')
    .trim();
  if (SECAO_NAO.test(x)) return { secao: 'nao', goleiro: false };
  if (SECAO_ESPERA.test(x)) return { secao: 'espera', goleiro: false };
  if (SECAO_GOL.test(x)) return { secao: null, goleiro: true };
  if (SECAO_VAO.test(x)) return { secao: 'vao', goleiro: false };
  return null;
}

type Item = { nome: string; s: Marca; avulso: boolean; goleiro: boolean; pos: string };

/* Uma linha de pessoa: tira número, marcas, parênteses de posição/avulso/goleiro e palavras de resposta. */
function lerPessoa(bruta: string): Item | null {
  let t = bruta.replace(/^\s*\d{1,3}\s*[-–—.)º°:]*\s*/, '').replace(/^[-•*·]+\s*/, '');
  let s = marcaDe(t);
  t = t.replace(EMOJI, ' ');
  let avulso = false,
    goleiro = false,
    pos = '';
  t = t.replace(/\(([^()]*)\)/g, (todo, dentro: string) => {
    const c = dentro.trim();
    if (AVULSO.test(c)) avulso = true;
    else if (GOLEIRO.test(c)) goleiro = true;
    else if (PALAVRA_NAO.test(' ' + c)) s = s || 'out';
    else if (PALAVRA_SIM.test(' ' + c)) s = s || 'in';
    else if (/^\p{L}{1,3}$/u.test(c)) pos = pos || c.toUpperCase();
    else return todo;
    return ' ';
  });
  t = t.replace(/\s+/g, ' ').trim();
  const nao = PALAVRA_NAO.exec(t);
  if (nao) {
    s = s || 'out';
    t = t.slice(0, nao.index);
  } else {
    const sim = PALAVRA_SIM.exec(t);
    if (sim) {
      s = s || 'in';
      t = t.slice(0, sim.index);
    }
  }
  const nome = t
    .replace(/^[\s\-–—:;,.*_~]+|[\s\-–—:;,.*_~]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\)\(/g, ') (');
  if (!/\p{L}/u.test(nome)) return null;
  return { nome: nome.slice(0, 40).trim(), s, avulso, goleiro, pos };
}

export function lerLista(texto: string): LinhaLida[] {
  const linhas = String(texto || '').split(/\r?\n/);
  const itens: (Item & { secao: Secao | null })[] = [];
  let secao: Secao | null = null,
    golSecao = false;
  for (const crua of linhas) {
    const t = crua.trim();
    if (!t) continue;
    const numerada = /^\s*\d{1,3}\s*[-–—.)º°:]/.test(t) || /^[-•*·]\s/.test(t);
    if (!numerada) {
      /* "Não vão: Fulano, Ciclano" ou só "Não vão:" */
      const m = /^([^:]{2,30}):\s*(.*)$/.exec(t.replace(EMOJI, '').trim());
      const sc = secaoDe(m ? m[1]! : t);
      if (sc) {
        secao = sc.secao ?? secao;
        golSecao = sc.goleiro;
        if (m && m[2]!.trim())
          for (const parte of m[2]!.split(/[,;]/)) {
            const p = lerPessoa(parte);
            if (p) itens.push(Object.assign(p, { goleiro: p.goleiro || golSecao, secao }));
          }
        continue;
      }
      if (ehTitulo(t)) continue;
      /* Frase solta (regra, aviso): mais de 5 palavras sem número na frente. */
      if (normalizar(t.replace(EMOJI, '')).split(' ').length > 5) continue;
    }
    const p = lerPessoa(t);
    if (p) itens.push(Object.assign(p, { goleiro: p.goleiro || golSecao, secao }));
  }
  const usaMarcas = itens.some(i => i.s);
  const vistos = new Set<string>();
  const lidas: LinhaLida[] = [];
  for (const i of itens) {
    const k = normalizar(i.nome);
    if (vistos.has(k)) continue;
    vistos.add(k);
    const s: Marca =
      i.s ?? (i.secao === 'nao' ? 'out' : i.secao === 'espera' ? 'in' : usaMarcas && i.secao !== 'vao' ? null : 'in');
    lidas.push({
      nome: i.nome,
      s,
      espera: i.secao === 'espera' && s === 'in',
      avulso: i.avulso,
      goleiro: i.goleiro,
      pos: i.pos,
    });
  }
  /* Quem está na espera vai para o fim, na ordem colada. */
  return lidas.filter(l => !l.espera).concat(lidas.filter(l => l.espera));
}

const semParenteses = (s: string) => normalizar(s.replace(/\([^()]*\)/g, ' '));

/* Casa o nome colado com o elenco (primeiro) ou com os avulsos. Igual sem maiúsculas e acentos; com ou sem o que está
   entre parênteses; "parecido" quando o primeiro nome bate e um nome contém o outro ("Pedro Nunes" e "Pedro"), e só
   se houver um candidato. */
export function casar(nome: string, elenco: Pessoa[], avulsos: Pessoa[]): Casamento {
  const n = normalizar(nome),
    ns = semParenteses(nome);
  for (const [lista, tipo] of [
    [elenco, 'elenco'],
    [avulsos, 'avulso'],
  ] as const) {
    const e = lista.find(p => normalizar(p.nome) === n) || lista.find(p => semParenteses(p.nome) === ns);
    if (e) return { tipo, id: e.id };
  }
  const tn = ns.split(' ');
  const parecidos: { id: string; de: 'elenco' | 'avulso' }[] = [];
  for (const [lista, de] of [
    [elenco, 'elenco'],
    [avulsos, 'avulso'],
  ] as const)
    for (const p of lista) {
      const tp = semParenteses(p.nome).split(' ');
      if (tp[0] !== tn[0]) continue;
      const [menor, maior] = tp.length <= tn.length ? [tp, tn] : [tn, tp];
      if (menor.every(x => maior.includes(x))) parecidos.push({ id: p.id, de });
    }
  if (parecidos.length === 1) return { tipo: 'parecido', id: parecidos[0]!.id, de: parecidos[0]!.de };
  return { tipo: 'novo' };
}

/* Posição de quem é novo: goleiro vira a posição-chave do esporte; uma sigla vira a posição do grupo que começa com
   ela, se for só uma ("M" → "MEI"); senão, sem posição. */
export function posicaoDe(l: LinhaLida, chaves: string[], chaveGol: string): string {
  if (l.goleiro && chaves.includes(chaveGol)) return chaveGol;
  if (!l.pos) return '';
  const exata = chaves.find(k => k.toUpperCase() === l.pos);
  if (exata) return exata;
  const comeca = chaves.filter(k => k.toUpperCase().startsWith(l.pos));
  return comeca.length === 1 ? comeca[0]! : '';
}
