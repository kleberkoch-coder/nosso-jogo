/* KAN-228: rateio novo já preenchido (o do extra da rodada: quem vai e os convidados). Vale só para a próxima
   abertura do rateio novo (telas/Rateios.tsx). Quem é de fora ganha um id próprio deste rateio (f_…). */
export type Preparo = { n: string; modo: 'total' | 'fixo'; base: string; sel: string[]; fora: Record<string, string> };
let preparo: Preparo | null = null;
const novoIdFora = (i: number) => 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i;
export function prepararRateio(p: Preparo) {
  const fora: Record<string, string> = {},
    troca: Record<string, string> = {};
  Object.keys(p.fora).forEach((id, i) => {
    troca[id] = novoIdFora(i);
    fora[troca[id]!] = p.fora[id]!;
  });
  preparo = { ...p, fora, sel: p.sel.map(id => troca[id] || id) };
}
export function pegarPreparo() {
  const p = preparo;
  preparo = null;
  return p;
}
