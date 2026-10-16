/* Importar o elenco de uma planilha (KAN-159): transforma as linhas coladas do Excel/Google Planilhas
   ou lidas de um .csv/.xlsx em jogadores, com o que entra, o que já existe e o que tem erro.
   Regra pura, sem tela: testada em testes/regras/planilha.test.mjs. */
import { emailValido } from './contato.ts';
import { normalizarTelefone } from './telefone.ts';

export type Campo = 'nome' | 'pos' | 'nota' | 'tipo' | 'tel' | 'email';
export type Aviso = 'nomeLongo' | 'posicao' | 'nota' | 'tipo' | 'tel' | 'email';
export type Item = {
  linha: number;
  nome: string;
  pos?: string;
  nota?: number;
  tipo: 'mensalista' | 'diarista';
  tel?: string;
  email?: string;
  situacao: 'novo' | 'existe' | 'repetido';
  avisos: Aviso[];
};
export type Contexto = {
  posicoes: [string, string][]; // [sigla, nome] do esporte do grupo; vazio = esporte sem posição
  existentes: Set<string>; // nomes já no elenco, normalizados
  normalizar: (nome: string) => string;
  pais?: string; // país do grupo: telefone sem "+" segue a regra dele (KAN-162); sem país, Brasil
};

export const LIMITE_IMPORTACAO = 100;
const ORDEM: Campo[] = ['nome', 'pos', 'nota', 'tipo', 'tel', 'email'];
const semAcento = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/* Texto colado ou de um .csv → linhas e células. Separador: tabulação (Excel) ou, sem ela, ";" ou ",". Aceita aspas do CSV. */
export function lerTexto(texto: string): string[][] {
  const t = String(texto || '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n');
  if (!t.trim()) return [];
  const sep = t.includes('\t') ? '\t' : (t.match(/;/g) || []).length >= (t.match(/,/g) || []).length ? ';' : ',';
  const linhas: string[][] = [];
  let celula = '',
    linha: string[] = [],
    aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"' && celula === '') aspas = true;
    else if (c === sep) {
      linha.push(celula);
      celula = '';
    } else if (c === '\n') {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = '';
    } else celula += c;
  }
  linha.push(celula);
  linhas.push(linha);
  return linhas.map(l => l.map(c => c.trim())).filter(l => l.some(c => c));
}

/* Qual campo é cada coluna, pelo título. Devolve null se a primeira linha não parecer um título. */
function colunasPeloTitulo(cab: string[]): (Campo | null)[] | null {
  const qual = (c: string): Campo | null => {
    const s = semAcento(c);
    // Título não tem números ("Jogador 7" é um nome, não um título) e é curto.
    if (!s || /\d/.test(s) || s.length > 30) return null;
    if (/mail/.test(s)) return 'email';
    if (/(tel|whats|zap|cel|fone)/.test(s)) return 'tel';
    if (/^(pos|posicao|funcao)/.test(s)) return 'pos';
    if (/(nota|nivel|estrela)/.test(s)) return 'nota';
    if (/(tipo|mensal|diar|plano)/.test(s)) return 'tipo';
    if (/(nome|jogador|apelido|atleta)/.test(s)) return 'nome';
    return null;
  };
  const cols = cab.map(qual);
  return cols.includes('nome') ? cols : null;
}

function posicao(valor: string, ctx: Contexto): string | null | undefined {
  if (!ctx.posicoes.length || !valor) return undefined;
  const v = semAcento(valor);
  const achou = ctx.posicoes.find(([sigla, nome]) => semAcento(sigla) === v || semAcento(nome) === v);
  if (achou) return achou[0];
  const comeco = ctx.posicoes.filter(([, nome]) => semAcento(nome).startsWith(v));
  return comeco.length === 1 ? comeco[0][0] : null;
}

function nota(valor: string): number | null | undefined {
  if (!valor) return undefined;
  const n = Number(valor.replace(',', '.'));
  if (!isFinite(n) || n < 1 || n > 10) return null;
  return Math.round(n * 2) / 2;
}

function tipo(valor: string): 'mensalista' | 'diarista' | null {
  const v = semAcento(valor);
  if (!v || v.startsWith('m')) return 'mensalista';
  if (v.startsWith('d') || v.startsWith('a')) return 'diarista';
  return null;
}

/* Linhas → itens com a situação e os avisos de cada um, e quantas linhas vieram sem nome (puladas). */
export function interpretar(linhas: string[][], ctx: Contexto): { itens: Item[]; semNome: number } {
  if (!linhas.length) return { itens: [], semNome: 0 };
  const titulo = colunasPeloTitulo(linhas[0]);
  const cols = titulo || ORDEM;
  const corpo = titulo ? linhas.slice(1) : linhas;
  const vistos = new Set<string>();
  const itens: Item[] = [];
  let semNome = 0;
  corpo.slice(0, LIMITE_IMPORTACAO).forEach((cel, i) => {
    const val = (c: Campo) => {
      const k = cols.indexOf(c);
      return k >= 0 ? cel[k] || '' : '';
    };
    const avisos: Aviso[] = [];
    let nome = val('nome').replace(/\s+/g, ' ');
    if (!nome) {
      semNome++;
      return;
    }
    if (nome.length > 40) {
      nome = nome.slice(0, 40).trim();
      avisos.push('nomeLongo');
    }
    const it: Item = { linha: i + (titulo ? 2 : 1), nome, tipo: 'mensalista', situacao: 'novo', avisos };
    const p = posicao(val('pos'), ctx);
    if (p === null) avisos.push('posicao');
    else if (p) it.pos = p;
    const n = nota(val('nota'));
    if (n === null) avisos.push('nota');
    else if (n != null) it.nota = n;
    const tp = tipo(val('tipo'));
    if (tp === null) avisos.push('tipo');
    else it.tipo = tp;
    const tel = normalizarTelefone(val('tel'), ctx.pais || 'BR');
    if (!tel.ok) avisos.push('tel');
    else if (tel.valor) it.tel = tel.valor;
    const email = val('email');
    if (email && !emailValido(email)) avisos.push('email');
    else if (email) it.email = email;
    const chave = ctx.normalizar(nome);
    if (ctx.existentes.has(chave)) it.situacao = 'existe';
    else if (vistos.has(chave)) it.situacao = 'repetido';
    vistos.add(chave);
    itens.push(it);
  });
  return { itens, semNome };
}

/* Quantas linhas passaram do limite (para avisar que só as primeiras entram). */
export function excedentes(linhas: string[][]): number {
  const corpo = colunasPeloTitulo(linhas[0] || []) ? linhas.length - 1 : linhas.length;
  return Math.max(0, corpo - LIMITE_IMPORTACAO);
}
