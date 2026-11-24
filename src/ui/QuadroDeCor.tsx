/* Quadro de cor (KAN-235, separado na pelada-v130 para o KAN-304): o quadro do tom (da esquerda para a direita) e da
   intensidade (de cima para baixo), com a barra de claro e escuro, como no "Editar cores" do Paint. Usado na cor livre
   do colete (ui/PaletaDeCor.tsx) e nas cores dos cards (ui/CardsCampos.tsx), para as duas telas terem o mesmo
   seletor. Controlado: quem usa guarda a cor (tom, intensidade e brilho) e recebe cada mudança. */
import { useEffect, useRef } from 'preact/hooks';
import { hsl, hsvParaHex } from '../dominio/cores-paleta';
import estilo from '../estilos/paleta.css' with { type: 'text' };
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-cores';
import { usarEstilo } from './estilo';

juntarTextos(textos);
usarEstilo('paleta', estilo);

export type Hsv = { h: number; s: number; v: number };

const limitar = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/* "#rrggbb" em tom, intensidade e brilho. */
export function hexParaHsv(hex: string): Hsv {
  const [h, s, l] = hsl(hex.slice(0, 7)),
    v = l + s * Math.min(l, 1 - l);
  return { h, s: v ? 2 * (1 - l / v) : 0, v };
}
export const hsvHex = (c: Hsv) => hsvParaHex(c.h, c.s, c.v);

export function QuadroDeCor({
  hsv,
  mudar,
  id,
  rotulo,
  focar,
  min = 0,
}: {
  hsv: Hsv;
  mudar: (c: Hsv) => void;
  id: string;
  rotulo: string;
  focar?: boolean;
  /* Brilho mínimo, em %: o colete não fica preto puro (8), o card pode (0). */
  min?: number;
}) {
  const quadro = useRef<HTMLDivElement>(null);
  const doPonto = (e: PointerEvent) => {
    const r = quadro.current!.getBoundingClientRect();
    mudar({
      ...hsv,
      h: limitar((e.clientX - r.left) / r.width) * 359.9,
      s: 1 - limitar((e.clientY - r.top) / r.height),
    });
  };
  useEffect(() => {
    if (focar) quadro.current?.focus();
  }, []);
  return (
    <>
      <div
        ref={quadro}
        class="paleta"
        id={id + 'Quadro'}
        tabIndex={0}
        role="slider"
        aria-label={tx('paleta.quadro')}
        aria-valuetext={rotulo}
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
          style={{ left: (hsv.h / 360) * 100 + '%', top: (1 - hsv.s) * 100 + '%', background: hsvHex(hsv) }}
        ></span>
      </div>
      <label class="f" style="margin-top:8px">
        <span>{tx('paleta.brilho')}</span>
        <input
          type="range"
          class="paleta-brilho"
          id={id + 'Brilho'}
          min={min}
          max="100"
          value={Math.round(hsv.v * 100)}
          onInput={e => mudar({ ...hsv, v: +(e.currentTarget as HTMLInputElement).value / 100 })}
        />
      </label>
    </>
  );
}
