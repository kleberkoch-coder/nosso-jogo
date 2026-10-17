/* Próximo jogo e fila de espera (KAN-175). A sugestão sai dos jogos já salvos da rodada; o responsável troca à vontade.
   - Primeiro jogo: os dois primeiros times da ordem do sorteio.
   - Quem ganha fica, e entra quem está esperando há mais tempo (quem nunca jogou vem primeiro, na ordem do sorteio).
   - Empate no 1º jogo: fica o time que vem antes no sorteio. Nos outros: fica o time que entrou (o que não estava no jogo anterior).
   - Com 2 times, os mesmos de novo.
   Times são as posições na lista de times da rodada (0 = primeiro do sorteio). */
export type JogoFeito = { a: number; b: number; ga: number; gb: number };
export type Proximo = { a: number; b: number; espera: number[] };

export function proximoJogo(n: number, jogos: JogoFeito[]): Proximo {
  const todos = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return { a: 0, b: 1, espera: [] };
  if (!jogos.length) return { a: 0, b: 1, espera: todos.slice(2) };
  const u = jogos[jogos.length - 1];
  if (n === 2) return { a: u.a, b: u.b, espera: [] };
  let fica: number;
  if (u.ga !== u.gb) fica = u.ga > u.gb ? u.a : u.b;
  else if (jogos.length === 1) fica = Math.min(u.a, u.b);
  else {
    const ant = jogos[jogos.length - 2],
      entrou = [u.a, u.b].filter(t => t !== ant.a && t !== ant.b);
    fica = entrou.length === 1 ? entrou[0] : Math.min(u.a, u.b);
  }
  /* Último jogo de cada time (-1 = ainda não jogou nesta rodada). */
  const ultimo = (t: number) => {
    for (let i = jogos.length - 1; i >= 0; i--) if (jogos[i].a === t || jogos[i].b === t) return i;
    return -1;
  };
  const fila = todos.filter(t => t !== fica).sort((x, y) => ultimo(x) - ultimo(y) || x - y);
  return { a: fica, b: fila[0], espera: fila.slice(1) };
}
