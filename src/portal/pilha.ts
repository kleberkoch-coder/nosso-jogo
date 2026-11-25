/* Pilha legível no portal (KAN-263, pelada-v131): busca os mapas de origem que o site publica ("arquivo.js.map", com
   permissão para o endereço do portal no firebase.json) e troca cada ponto da pilha pelo arquivo e a linha do código
   original. A conta é a regra pura dominio/mapa-origem.ts. Mapa que não existe mais (versão antiga, já trocada no ar)
   deixa o ponto como estava. */
import { arquivoCurto, original, pontosDaPilha, type Mapa } from '../dominio/mapa-origem.ts';

const mapas = new Map<string, Promise<Mapa | null>>();
function mapaDe(url: string): Promise<Mapa | null> {
  let m = mapas.get(url);
  if (!m) {
    m = fetch(url + '.map')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    mapas.set(url, m);
  }
  return m;
}

export async function pilhaLegivel(pilha: string): Promise<string[]> {
  const out: string[] = [];
  for (const p of pontosDaPilha(pilha)) {
    const mapa = await mapaDe(p.url),
      o = mapa ? original(mapa, p.linha, p.coluna) : null,
      curto = p.url.replace(/^https?:\/\/[^/]+\//, '');
    out.push(
      o
        ? arquivoCurto(o.arquivo) + ':' + o.linha + (o.nome ? ' (' + o.nome + ')' : '')
        : curto + ':' + p.linha + ':' + p.coluna
    );
  }
  return out;
}
