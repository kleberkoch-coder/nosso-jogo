/* Janela do colete (v60) e paleta da cor livre (KAN-235). A janela mostra as 8 cores de sempre, as livres desta
   rodada e das últimas rodadas e "Outra cor…". A paleta é como o "Editar cores" do Paint, sem código de cor: um quadro
   com o tom (da esquerda para a direita) e a intensidade (de cima para baixo), a barra de claro e escuro, a amostra e
   o nome sugerido pela cor, que a pessoa pode trocar. Baixa só quando alguém toca no colete (gestão mais leve). */
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ehCorLivre, lerCorLivre } from '../dominio/cores';
import { corLivre, familia, hsl, hsvParaHex } from '../dominio/cores-paleta';
import { COL, col, corClara, tn } from '../dominio/esportes.js';
import { recentes } from '../dominio/cores-recentes';
import { S } from '../nucleo/estado.js';
import estilo from '../estilos/paleta.css' with { type: 'text' };
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-cores';
import { toast } from '../nucleo/util.js';
import { dlg, openDlg } from './dialogos.js';
import { usarEstilo } from './estilo';

juntarTextos(textos);
usarEstilo('paleta', estilo);

type Hsv = { h: number; s: number; v: number };
type Rodada = { id: string; times?: { c: number | string }[] | null };

/* Cor do colete (v60): escolha livre entre as cores; se outro time já usa, os dois trocam. */
function Coletes({ r, ti }: { r: Rodada; ti: number }) {
  const times = r.times || [],
    /* KAN-235: as cores livres desta rodada e as das últimas rodadas do grupo (até 4), depois das 8 de sempre. */
    livres = [
      ...new Set([...times.map(t => t.c).filter(ehCorLivre), ...recentes(Object.values(S.rod || {}) as never)]),
    ].filter((c, i, a) => a.findIndex(o => o.slice(0, 7) === c.slice(0, 7)) === i);
  return (
    <>
      <h3 id="coleteTitulo">{tx('colete.titulo', { time: tn(ti) })}</h3>
      <p class="small muted">{tx('colete.ajuda')}</p>
      <div class="vgrid" id="coletes">
        {(COL.map((_: unknown, i: number) => i) as (number | string)[]).concat(livres).map(c => {
          const dono = times.findIndex(t => t.c === c),
            x = col(c);
          return (
            <button
              key={c}
              class="opt"
              data-a="pickColor"
              data-v={ti}
              data-c2={c}
              aria-pressed={dono === ti ? 'true' : 'false'}
            >
              <span class={'dot' + (corClara(x) ? ' branco' : '')} style={{ background: x.c }}></span>
              {x.n}
              {dono >= 0 && dono !== ti ? (
                <span class="tag" style="margin-left:auto">
                  {tn(dono)}
                </span>
              ) : null}
            </button>
          );
        })}
        <button class="opt" data-a="outraCor" data-v={ti} id="outraCor">
          <span class="dot dot-paleta" aria-hidden="true"></span>
          {tx('colete.outra')}
        </button>
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
      </div>
    </>
  );
}
export function montarColetes(r: Rodada, ti: number) {
  const el = document.getElementById('coleteRaiz');
  if (el) render(<Coletes r={r} ti={ti} />, el);
}

const limitar = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const nomeSugerido = (hex: string) => tx('cor.' + familia(hex));

/* Ponto de partida: a cor livre do time (se já tiver) ou um rosa médio, longe das 8 de sempre. */
function inicio(c: unknown): Hsv {
  if (!ehCorLivre(c)) return { h: 330, s: 0.55, v: 0.9 };
  const [h, s, l] = hsl(c.slice(0, 7)),
    v = l + s * Math.min(l, 1 - l);
  return { h, s: v ? 2 * (1 - l / v) : 0, v };
}

/* O que está na janela, para a ação "usarCor" ler. */
let atual: { ti: number; valor: string } | null = null;
export const corEscolhida = () => atual;

function Paleta({ ti, c }: { ti: number; c: unknown }) {
  const [hsv, setHsv] = useState<Hsv>(() => inicio(c)),
    hex = hsvParaHex(hsv.h, hsv.s, hsv.v),
    [nome, setNome] = useState(() => (ehCorLivre(c) ? lerCorLivre(c).n : nomeSugerido(hex))),
    [editou, setEditou] = useState(ehCorLivre(c)),
    quadro = useRef<HTMLDivElement>(null);
  atual = { ti, valor: corLivre(hex, nome) };
  const mudar = (n: Hsv) => {
    setHsv(n);
    if (!editou) setNome(nomeSugerido(hsvParaHex(n.h, n.s, n.v)));
  };
  const doPonto = (e: PointerEvent) => {
    const r = quadro.current!.getBoundingClientRect();
    mudar({
      ...hsv,
      h: limitar((e.clientX - r.left) / r.width) * 359.9,
      s: 1 - limitar((e.clientY - r.top) / r.height),
    });
  };
  useEffect(() => quadro.current?.focus(), []);
  return (
    <>
      <h3 id="paletaTitulo">{tx('paleta.titulo', { time: tn(ti) })}</h3>
      <p class="small muted">{tx('paleta.ajuda')}</p>
      <div
        ref={quadro}
        class="paleta"
        id="paletaQuadro"
        tabIndex={0}
        role="slider"
        aria-label={tx('paleta.quadro')}
        aria-valuetext={nome}
        onPointerDown={e => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          doPonto(e);
        }}
        onPointerMove={e => {
          if (e.buttons) doPonto(e);
        }}
        onKeyDown={e => {
          const passo = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
          if (!passo) return;
          e.preventDefault();
          mudar({ ...hsv, h: (hsv.h + passo[0]! + 360) % 360, s: limitar(hsv.s + passo[1]!) });
        }}
      >
        <span
          class="paleta-mira"
          style={{ left: (hsv.h / 360) * 100 + '%', top: (1 - hsv.s) * 100 + '%', background: hex }}
        ></span>
      </div>
      <label class="f" style="margin-top:8px">
        <span>{tx('paleta.brilho')}</span>
        <input
          type="range"
          class="paleta-brilho"
          id="paletaBrilho"
          min="8"
          max="100"
          value={Math.round(hsv.v * 100)}
          onInput={e => mudar({ ...hsv, v: +(e.currentTarget as HTMLInputElement).value / 100 })}
        />
      </label>
      <div class="paleta-fim">
        <span
          class="paleta-amostra"
          id="paletaAmostra"
          role="img"
          aria-label={tx('paleta.amostra', { nome })}
          style={{ background: hex }}
        ></span>
        <label class="f">
          <span>{tx('paleta.nome')}</span>
          <input
            class="inp"
            id="corNome"
            maxLength={20}
            autocomplete="off"
            enterkeyhint="done"
            value={nome}
            onInput={e => {
              setEditou(true);
              setNome((e.currentTarget as HTMLInputElement).value);
            }}
          />
        </label>
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="color" data-v={ti}>
          {tx('paleta.voltar')}
        </button>
        <button class="btn primary" data-a="usarCor" data-v={ti}>
          {tx('paleta.usar')}
        </button>
      </div>
    </>
  );
}

export function abrirPaleta(ti: number, c: unknown) {
  openDlg('paletaRaiz');
  dlg.setAttribute('aria-labelledby', 'paletaTitulo');
  const el = document.getElementById('paletaRaiz');
  if (el) render(<Paleta ti={ti} c={c} />, el);
}

/* Confirma a cor: devolve o valor para gravar, ou nada (sem nome, avisa e põe o cursor no nome). */
export function confirmar(): { ti: number; valor: string } | null {
  if (!atual) return null;
  if (!atual.valor.split('|').slice(2).join('').trim()) {
    toast(tx('paleta.semNome'));
    (document.getElementById('corNome') as HTMLInputElement | null)?.focus();
    return null;
  }
  return atual;
}
