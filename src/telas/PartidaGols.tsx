/* Gols de uma partida, lado a lado, com o autor de cada um: trocar o autor (ou gol contra), tirar e somar.
   Usado em dois lugares: corrigir a partida em andamento (KAN-229) e editar uma partida salva (KAN-176).
   O placar sai sempre dos gols. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { col, sport, tn, tnJogo } from '../dominio/esportes.js';
import { curRodada, pname } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { partidasDe } from '../nucleo/partidas-lista.js';
import { marcarAlterada } from '../ui/dialogos.js';
import { sumPts } from '../ui/placar';
import { unidade } from '../ui/JanelaPonto';
import { quadra } from './Partida';

type Time = { c: number | string; players: string[] };
type Rodada = { id: string; date: string; time?: string; times?: Time[] | null };
type Gol = { t: 'a' | 'b'; pid?: string | null; og?: boolean; pts?: number; as?: string | null };
type Partida = {
  id: string;
  ca: number | string;
  cb: number | string;
  ga: number;
  gb: number;
  goals: Gol[];
  pa?: string[];
  pb?: string[];
};
type Lado = 'a' | 'b';

/* Um lado: título com a cor e o placar, cada gol com a escolha do autor e ✕, e os botões de somar. */
function GolsDoLado(p: {
  t: Lado;
  titulo: string;
  cor: number | string;
  goals: Gol[];
  meus: string[];
  deles: string[];
  mudar: (gs: Gol[]) => void;
}) {
  const { t, goals, mudar } = p,
    SP = sport() as unknown as { score: [string, number][]; og?: boolean; ast?: string },
    /* Quem já marcou neste lado continua na lista, mesmo que tenha saído de quadra. */
    meus = [...new Set(p.meus.concat(goals.filter(g => g.t === t && g.pid && !g.og).map(g => g.pid!)))],
    deles = [...new Set(p.deles.concat(goals.filter(g => g.t === t && g.pid && g.og).map(g => g.pid!)))];
  return (
    <div class="panel gols-lado" data-lado={t} style="margin:0 0 10px">
      <h3 style="margin:0 0 6px">
        <span class="dot" style={{ background: col(p.cor).c }}></span> {p.titulo} · {sumPts(goals, t)}
      </h3>
      <ul class="plist">
        {goals.map((g, i) =>
          g.t !== t ? null : (
            <li key={i}>
              <select
                class="sel ed-autor"
                aria-label={tx('partida.autorDoGol')}
                value={g.pid ? (g.og ? 'c:' : 'p:') + g.pid : ''}
                onChange={e => {
                  const v = (e.currentTarget as HTMLSelectElement).value,
                    gs = goals.slice();
                  gs[i] = { ...g, pid: v ? v.slice(2) : null, og: v.startsWith('c:') };
                  /* KAN-66: o autor não pode ser também a assistência; gol contra e sem autor não têm assistência. */
                  if (!gs[i]!.pid || gs[i]!.og || gs[i]!.as === gs[i]!.pid) delete gs[i]!.as;
                  mudar(gs);
                }}
              >
                <option value="">{tx('partida.semAutor')}</option>
                {meus.map(id => (
                  <option key={id} value={'p:' + id}>
                    {pname(id)}
                  </option>
                ))}
                {SP.og
                  ? deles.map(id => (
                      <option key={'c' + id} value={'c:' + id}>
                        {pname(id) + ' ' + tx('partida.contraMarca')}
                      </option>
                    ))
                  : null}
              </select>
              {SP.ast && g.pid && !g.og ? (
                <select
                  class="sel ed-assist"
                  aria-label={tx('partida.assistDoGolRotulo', { ponto: unidade(), nome: pname(g.pid) })}
                  value={g.as || ''}
                  onChange={e => {
                    const v = (e.currentTarget as HTMLSelectElement).value,
                      gs = goals.slice();
                    gs[i] = { ...g, as: v || null };
                    if (!v) delete gs[i]!.as;
                    mudar(gs);
                  }}
                >
                  <option value="">{tx('partida.semAssist')}</option>
                  {[...new Set(p.meus.concat(g.as ? [g.as] : []))]
                    .filter(id => id !== g.pid)
                    .map(id => (
                      <option key={id} value={id}>
                        {pname(id)}
                      </option>
                    ))}
                </select>
              ) : null}
              {(g.pts || 1) > 1 ? <span class="tag">+{g.pts}</span> : null}
              <button
                type="button"
                class="btn sm ghost danger"
                aria-label={tx('partida.tirarGol')}
                onClick={() => mudar(goals.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          )
        )}
      </ul>
      <div class="row" style="margin-top:6px">
        {SP.score.map(([rotulo, pts], k) => (
          <button
            key={k}
            type="button"
            class="btn sm ed-mais"
            data-lado={t}
            onClick={() => mudar(goals.concat({ t, pid: null, og: false, pts }))}
          >
            {SP.score.length === 1 ? '+ ' + rotulo : rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Editar partida salva (KAN-176). O que está na janela fica em "edicao", que a ação salvarEdicao lê ao gravar. */
let edicao: { mid: string; goals: Gol[] } | null = null;
export const edicaoAtual = () => edicao;
function EditarPartida({ m }: { m: Partida }) {
  const [goals, setGoals] = useState<Gol[]>(m.goals.map(g => ({ ...g })));
  edicao = { mid: m.id, goals };
  const mudar = (gs: Gol[]) => {
      marcarAlterada(); // KAN-202
      setGoals(gs);
    },
    times = ((curRodada() as Rodada | null) || { times: [] }).times,
    lado = (t: Lado) => (
      <GolsDoLado
        t={t}
        titulo={tnJogo(m, t, times)}
        cor={t === 'a' ? m.ca : m.cb}
        goals={goals}
        meus={(t === 'a' ? m.pa : m.pb) || []}
        deles={(t === 'a' ? m.pb : m.pa) || []}
        mudar={mudar}
      />
    );
  return (
    <>
      <h3>{tx('partida.editarTitulo')}</h3>
      <p class="small muted">{tx('partida.editarTexto')}</p>
      {lado('a')}
      {lado('b')}
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarEdicao" data-v={m.id}>
          {tx('partida.salvarEdicao', { a: sumPts(goals, 'a'), b: sumPts(goals, 'b') })}
        </button>
      </div>
    </>
  );
}
export function montarEdicao(mid: string) {
  const r = curRodada() as Rodada | null,
    m = r && (partidasDe(r.id) as Partida[]).find(x => x.id === mid),
    el = document.getElementById('edRaiz');
  if (!m || !el) return false;
  render(<EditarPartida m={m} />, el);
  return true;
}

/* KAN-229: corrigir os gols da partida em andamento (autor errado, gol no time errado, gol a mais), não só o último.
   Nada é gravado no banco: a partida em andamento fica no aparelho até "Salvar partida". */
let correcao: Gol[] | null = null;
export const correcaoAtual = () => correcao;
function CorrigirAoVivo({ r }: { r: Rodada }) {
  const L = (estado as { live: { a: number; b: number; goals: Gol[] } }).live,
    times = r.times as Time[];
  const [goals, setGoals] = useState<Gol[]>(L.goals.map(g => ({ ...g })));
  correcao = goals;
  const mudar = (gs: Gol[]) => {
      marcarAlterada();
      setGoals(gs);
    },
    lado = (t: Lado) => (
      <GolsDoLado
        t={t}
        titulo={tn(t === 'a' ? L.a : L.b)}
        cor={times[t === 'a' ? L.a : L.b]!.c}
        goals={goals}
        meus={quadra(r, t).atuais}
        deles={quadra(r, t === 'a' ? 'b' : 'a').atuais}
        mudar={mudar}
      />
    );
  return (
    <>
      <h3 id="cgTitulo">{tx('partida.corrigirTitulo')}</h3>
      <p class="small muted">{tx('partida.corrigirTexto')}</p>
      {lado('a')}
      {lado('b')}
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarCorrecao">
          {tx('partida.corrigirSalvar', { a: sumPts(goals, 'a'), b: sumPts(goals, 'b') })}
        </button>
      </div>
    </>
  );
}
export function montarCorrecao() {
  const r = curRodada() as Rodada | null,
    el = document.getElementById('cgRaiz');
  if (!r || !el || !(estado as { live?: unknown }).live) return false;
  render(<CorrigirAoVivo r={r} />, el);
  return true;
}
