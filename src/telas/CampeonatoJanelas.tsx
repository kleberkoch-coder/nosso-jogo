/* Janelas do campeonato (KAN-233): montar (ou ajustar) com o mata-mata e os critérios de desempate, e "Quem passou?"
   no empate do mata-mata (pelada-v97). Baixam só quando abertas, para a parte Partida continuar leve.
   O que está na janela fica em variáveis do módulo, que as ações (acoes/partida.js) leem ao gravar. */
import { useState } from 'preact/hooks';
import { CRITERIOS, mataOpcoes, mataPadrao, type Criterio, type Dec, type Mata } from '../dominio/campeonato';
import { tn } from '../dominio/esportes.js';
import type { Slot } from '../dominio/mata-mata';
import { tx } from '../i18n/index.js';
import { marcarAlterada } from '../ui/dialogos.js';
import { campDe, nomeCrit, nomeFase, nomeMata, type Rodada } from './Campeonato';

export const PADRAO: Criterio[] = ['saldo', 'gp', 'cd', 'sorteio'];
let escolha: Criterio[] = PADRAO,
  mata: Mata | null = null;
export const desempateEscolhido = () => escolha;
export const mataEscolhido = () => mata;

function MontarCampeonato({ r }: { r: Rodada }) {
  const c = campDe(r),
    n = (r.times || []).length,
    inicial = c ? c.crit : PADRAO,
    [ordem, setOrdem] = useState<Criterio[]>(() => inicial.concat(CRITERIOS.filter(k => !inicial.includes(k)))),
    [ligados, setLigados] = useState<Criterio[]>(inicial),
    [mm, setMm] = useState<Mata>(() => (c ? c.mm : mataPadrao(n)));
  escolha = ordem.filter(k => ligados.includes(k));
  mata = mm;
  const subir = (i: number) => {
      marcarAlterada();
      const o = ordem.slice();
      [o[i - 1], o[i]] = [o[i], o[i - 1]];
      setOrdem(o);
    },
    marcar = (k: Criterio, sim: boolean) => {
      marcarAlterada();
      setLigados(sim ? ligados.concat(k) : ligados.filter(x => x !== k));
    },
    opcoes = mataOpcoes(n);
  return (
    <>
      <h3 id="campDlgTitulo">{tx(c ? 'camp.ajustesTitulo' : 'camp.montarTitulo')}</h3>
      {c ? null : <p class="small muted">{tx('camp.montarTexto', { n, jogos: (n * (n - 1)) / 2 })}</p>}
      <label class="f">
        <span>{tx('mata.titulo')}</span>
        <select
          class="sel"
          id="campMata"
          onChange={e => {
            marcarAlterada();
            setMm(opcoes[+(e.currentTarget as HTMLSelectElement).value]);
          }}
        >
          {opcoes.map((o, i) => (
            <option key={i} value={i} selected={o.k === mm.k && o.t3 === mm.t3}>
              {tx(nomeMata(o))}
            </option>
          ))}
        </select>
      </label>
      <p class="small muted" style="margin:-4px 0 12px">
        {tx('mata.ajuda')}
      </p>
      <fieldset class="f chk-lista camp-crit" id="campCrit">
        <legend class="lbl">{tx('camp.desempateLegenda')}</legend>
        <p class="small muted" style="margin:0 0 6px">
          {tx('camp.desempateAjuda')}
        </p>
        <ol>
          {ordem.map((k, i) => (
            <li key={k} data-k={k}>
              <label class="chk-linha">
                <input
                  type="checkbox"
                  value={k}
                  checked={ligados.includes(k)}
                  onChange={e => marcar(k, (e.currentTarget as HTMLInputElement).checked)}
                />
                <span>{nomeCrit(k)}</span>
              </label>
              {i ? (
                <button
                  type="button"
                  class="btn sm ghost camp-subir"
                  aria-label={tx('camp.subir', { crit: nomeCrit(k) })}
                  onClick={() => subir(i)}
                >
                  ↑
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        <p class="small muted" style="margin:6px 0 0">
          {tx('camp.empateFinal')}
        </p>
      </fieldset>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a={c ? 'salvarDesempate' : 'comecarCampeonato'} id="campOk">
          {tx(c ? 'camp.salvarDesempate' : 'camp.comecar')}
        </button>
      </div>
    </>
  );
}
export const janelaCampeonato = (r: Rodada) => <MontarCampeonato r={r} />;

/* Empate no mata-mata: quem passou (pênaltis, par ou ímpar, sorteio… é critério de quem organiza). Os pênaltis são
   opcionais; com os dois anotados e diferentes, quem fez mais já fica escolhido. */
let decisao: { id: string; d: Dec | null } | null = null;
export const decisaoEscolhida = () => decisao;
function QuemPassou({ s }: { s: Slot }) {
  const a = s.a as number,
    b = s.b as number,
    [p, setP] = useState<number | null>(s.dec ? s.dec.p : null),
    [pa, setPa] = useState<string>(s.dec && s.dec.a != null ? String(s.dec.a) : ''),
    [pb, setPb] = useState<string>(s.dec && s.dec.b != null ? String(s.dec.b) : '');
  const num = (v: string) => (/^\d{1,2}$/.test(v) ? +v : null),
    na = num(pa),
    nb = num(pb);
  decisao = { id: s.id, d: p == null ? null : Object.assign({ p }, na != null && nb != null ? { a: na, b: nb } : {}) };
  const pen = (v: string, outro: number | null, lado: 'a' | 'b') => {
    marcarAlterada();
    (lado === 'a' ? setPa : setPb)(v);
    const x = num(v);
    if (x != null && outro != null && x !== outro) setP((lado === 'a' ? x > outro : x < outro) ? a : b);
  };
  return (
    <>
      <h3 id="passouTitulo">{tx('mata.quemPassouTitulo')}</h3>
      <p class="small muted">
        {tx('mata.quemPassouTexto', {
          fase: nomeFase(s),
          a: tn(a),
          b: tn(b),
          placar: s.res ? s.res.ga + ' × ' + s.res.gb : '',
        })}
      </p>
      <div class="seg camp-passou" role="group" aria-label={tx('mata.quemPassou')} id="passouTimes">
        {[a, b].map(t => (
          <button
            key={t}
            type="button"
            data-t={t}
            aria-pressed={p === t}
            onClick={() => {
              marcarAlterada();
              setP(t);
            }}
          >
            {tn(t)}
          </button>
        ))}
      </div>
      <fieldset class="f camp-pen" style="margin-top:12px">
        <legend class="lbl">{tx('mata.penaltisOpcional')}</legend>
        <div class="row">
          {(['a', 'b'] as const).map(l => (
            <label class="f" key={l} style="margin:0;flex:1">
              <span>{tn(l === 'a' ? a : b)}</span>
              <input
                class="inp"
                id={'pen' + l}
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={l === 'a' ? pa : pb}
                onInput={e => pen((e.currentTarget as HTMLInputElement).value, l === 'a' ? nb : na, l)}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('mata.depois')}
        </button>
        <button class="btn primary" data-a="salvarQuemPassou" id="passouOk" disabled={p == null}>
          {tx('mata.confirmar')}
        </button>
      </div>
    </>
  );
}
export const janelaQuemPassou = (s: Slot) => <QuemPassou s={s} />;
