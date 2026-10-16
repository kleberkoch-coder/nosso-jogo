/* Lê um arquivo de planilha escolhido no aparelho (KAN-159): .csv (texto) ou .xlsx (Excel).
   O .xlsx é um zip com XML dentro; ele é aberto aqui mesmo, com o descompactador do navegador
   (DecompressionStream), sem biblioteca: o app não fica mais pesado. Lê só a primeira aba. */
import { lerTexto } from '../dominio/planilha.ts';

export class ErroPlanilha extends Error {}

type Entrada = { nome: string; metodo: number; inicio: number; tamanho: number };

function entradasDoZip(b: Uint8Array): Entrada[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  if (fim < 0) throw new ErroPlanilha('formato');
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const dec = new TextDecoder();
  const lista: Entrada[] = [];
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new ErroPlanilha('formato');
    const metodo = v.getUint16(p + 10, true),
      tamanho = v.getUint32(p + 20, true),
      nLen = v.getUint16(p + 28, true),
      xLen = v.getUint16(p + 30, true),
      cLen = v.getUint16(p + 32, true),
      local = v.getUint32(p + 42, true);
    const nome = dec.decode(b.subarray(p + 46, p + 46 + nLen));
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    lista.push({ nome, metodo, inicio, tamanho });
    p += 46 + nLen + xLen + cLen;
  }
  return lista;
}

async function abrir(b: Uint8Array, e: Entrada): Promise<string> {
  const dados = b.subarray(e.inicio, e.inicio + e.tamanho);
  if (e.metodo === 0) return new TextDecoder().decode(dados);
  if (e.metodo !== 8 || typeof DecompressionStream === 'undefined') throw new ErroPlanilha('navegador');
  const fluxo = new Blob([dados as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(fluxo).text();
}

const coluna = (ref: string) => {
  const letras = (/^[A-Z]+/.exec(ref) || ['A'])[0];
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
};

async function lerXlsx(b: Uint8Array): Promise<string[][]> {
  const ents = entradasDoZip(b);
  const achar = (nome: string) => ents.find(e => e.nome === nome);
  const xml = (t: string) => new DOMParser().parseFromString(t, 'application/xml');
  const textos: string[] = [];
  const ss = achar('xl/sharedStrings.xml');
  if (ss)
    xml(await abrir(b, ss))
      .querySelectorAll('si')
      .forEach(si => textos.push([...si.querySelectorAll('t')].map(t => t.textContent || '').join('')));
  const abas = ents
    .filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.nome))
    .sort((x, y) => x.nome.localeCompare(y.nome, 'en', { numeric: true }));
  if (!abas.length) throw new ErroPlanilha('formato');
  const doc = xml(await abrir(b, abas[0]));
  const linhas: string[][] = [];
  doc.querySelectorAll('sheetData > row').forEach(row => {
    const l: string[] = [];
    row.querySelectorAll('c').forEach(c => {
      const t = c.getAttribute('t'),
        v = c.querySelector('v')?.textContent || '';
      const valor =
        t === 's'
          ? textos[+v] || ''
          : t === 'inlineStr'
            ? [...c.querySelectorAll('t')].map(x => x.textContent || '').join('')
            : v;
      l[coluna(c.getAttribute('r') || '')] = valor;
    });
    linhas.push(Array.from(l, x => (x || '').trim()));
  });
  return linhas.filter(l => l.some(c => c));
}

/* Arquivo → linhas e células. Erros: "formato" (não é planilha que o app lê) ou "navegador" (aparelho antigo). */
export async function lerArquivo(arq: File): Promise<string[][]> {
  const nome = arq.name.toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt') || arq.type === 'text/csv') return lerTexto(await arq.text());
  if (nome.endsWith('.xlsx')) return lerXlsx(new Uint8Array(await arq.arrayBuffer()));
  throw new ErroPlanilha('formato');
}
