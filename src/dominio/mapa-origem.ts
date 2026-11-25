/* Pilha legível no portal (KAN-263, pelada-v131): a pilha de um erro aponta para o código compactado
   ("chunks/admin-X.js:1:23456"); os mapas de origem que a montagem já publica (".js.map") dizem de que arquivo e linha
   do código original aquele ponto veio. Regra pura, testada em testes/regras/mapa-origem.test.mjs; quem busca os mapas
   é o portal (src/portal/pilha.ts). */

/* Um ponto da pilha: endereço do arquivo compactado, linha e coluna (contadas a partir de 1, como no navegador). */
export type Ponto = { url: string; linha: number; coluna: number };
export type Original = { arquivo: string; linha: number; coluna: number; nome?: string };
export type Mapa = { sources?: string[]; names?: string[]; mappings?: string; sourceRoot?: string };

/* Os pontos de uma pilha (Chrome "at f (url:l:c)", Safari e Firefox "f@url:l:c"), no máximo 12, sem repetir. */
export function pontosDaPilha(pilha: string): Ponto[] {
  const out: Ponto[] = [],
    vistos = new Set<string>();
  const re = /(https?:\/\/[^\s()@]+?\.js):(\d+):(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pilha || '')) && out.length < 12) {
    const k = m[1] + ':' + m[2] + ':' + m[3];
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ url: m[1]!, linha: +m[2]!, coluna: +m[3]! });
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/* Um trecho em VLQ base 64 (o formato dos mapas de origem) vira a lista de números. */
export function vlq(s: string): number[] {
  const out: number[] = [];
  let v = 0,
    desloca = 0;
  for (const ch of s) {
    const d = B64.indexOf(ch);
    if (d < 0) continue;
    v += (d & 31) << desloca;
    if (d & 32) desloca += 5;
    else {
      out.push(v & 1 ? -(v >> 1) : v >> 1);
      v = 0;
      desloca = 0;
    }
  }
  return out;
}

/* O ponto do código original para a linha e a coluna do compactado (as duas a partir de 1). Sem mapa para o ponto,
   null. Usa o trecho mais próximo à esquerda da coluna, como as ferramentas do navegador. */
export function original(mapa: Mapa, linha: number, coluna: number): Original | null {
  const linhas = String(mapa.mappings || '').split(';');
  let fonte = 0,
    oLinha = 0,
    oColuna = 0,
    nome = 0,
    achado: Original | null = null;
  for (let i = 0; i < linhas.length && i < linha; i++) {
    let gColuna = 0;
    for (const seg of linhas[i]!.split(',')) {
      if (!seg) continue;
      const n = vlq(seg);
      gColuna += n[0] || 0;
      if (n.length >= 4) {
        fonte += n[1]!;
        oLinha += n[2]!;
        oColuna += n[3]!;
        if (n.length >= 5) nome += n[4]!;
        if (i === linha - 1 && gColuna <= coluna - 1)
          achado = {
            arquivo: (mapa.sourceRoot || '') + ((mapa.sources || [])[fonte] || '?'),
            linha: oLinha + 1,
            coluna: oColuna + 1,
            ...(n.length >= 5 && mapa.names && mapa.names[nome] ? { nome: mapa.names[nome] } : {}),
          };
      }
    }
  }
  return achado;
}

/* "../src/telas/Rodada.tsx" vira "src/telas/Rodada.tsx"; o caminho de bibliotecas fica com o nome do pacote. */
export function arquivoCurto(a: string): string {
  const s = a.replace(/^(\.\.\/|\.\/|webpack:\/\/\/?)+/, '');
  const nm = s.lastIndexOf('node_modules/');
  return nm >= 0 ? s.slice(nm + 13) : s;
}
