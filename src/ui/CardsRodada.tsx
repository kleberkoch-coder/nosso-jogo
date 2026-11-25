/* Painel "Cards da rodada" (KAN-295, 2ª parte, pelada-v131): na aba Partida e no detalhe do Histórico, um botão por
   card pronto (craque, artilheiro, garçom e cada jogador do time campeão). Quem ganha card é a regra pura
   dominio/cards-rodada.ts; tocar abre a janela do card (ui/CardJogador.tsx, sob demanda), com o modelo do tipo, os
   números da rodada e a mensagem pronta para o WhatsApp. Só com o Plano A, como os cards do grupo. */
import { useState } from 'preact/hooks';
import { destaquesDaRodada, type Destaque, type PartidaRod, type VotacaoRod } from '../dominio/cards-rodada';
import { sport } from '../dominio/esportes.js';
import { pname, recurso } from '../dominio/grupo.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-cardr';
import { fdate } from '../nucleo/util.js';

juntarTextos(textos);

const ICONE: Record<string, string> = { craque: '⭐', artilheiro: '', garcom: '🍽️', campeao: '🏆' };

export function CardsRodada(o: {
  rid: string;
  data: string;
  ms: PartidaRod[];
  lancada?: Record<string, number> | null;
  votacoes?: VotacaoRod[];
  times?: { players: string[] }[] | null;
  campeao?: number | null;
  nome?: (pid: string) => string;
}) {
  const [abrindo, setAbrindo] = useState('');
  if (!recurso('cards')) return null;
  const SP = sport() as { ast?: boolean; e?: string },
    campeoes = o.campeao != null && o.times && o.times[o.campeao] ? o.times[o.campeao]!.players : null,
    lista = destaquesDaRodada({ ms: o.ms, lancada: o.lancada, votacoes: o.votacoes, campeoes, temAst: !!SP.ast });
  if (!lista.length) return null;
  const nome = o.nome || pname;
  const abrir = async (d: Destaque, k: string) => {
    if (abrindo) return;
    setAbrindo(k);
    try {
      const m = await import('./CardJogador');
      m.abrirCardJogador(d.pid, 'ficha', {
        tipo: d.tipo,
        rod: d.rod,
        data: fdate(o.data),
        titulo: d.titulo,
        nome: nome(d.pid),
      });
    } finally {
      setAbrindo('');
    }
  };
  return (
    <div class="panel" id={'cardsRodada-' + o.rid}>
      <h3 style="margin:0">{tx('cardr.titulo')}</h3>
      <p class="small muted" style="margin:4px 0 8px">
        {tx('cardr.ajuda')}
      </p>
      <div class="cards-rod" style="display:flex;flex-wrap:wrap;gap:8px">
        {lista.map((d, i) => {
          const k = d.tipo + ':' + d.pid + ':' + i,
            tipo = d.titulo || tx('cardr.tipo.' + d.tipo),
            n = nome(d.pid);
          return (
            <button
              key={k}
              type="button"
              class={abrindo === k ? 'btn sm busy' : 'btn sm'}
              aria-busy={abrindo === k}
              data-card-rod={d.tipo}
              data-p={d.pid}
              aria-label={tx('cardr.abrir', { tipo, nome: n })}
              onClick={() => abrir(d, k)}
            >
              <span aria-hidden="true">{(ICONE[d.tipo] || SP.e || '') + ' '}</span>
              {tipo + ': ' + n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
