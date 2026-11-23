/* Galeria de fundos prontos dos cards (KAN-303, pelada-v128): desenhos próprios do Nosso Jogo, em SVG, nas duas cores
   do modelo (c1 = fundo, c2 = detalhe). Ocupam a área toda do card (400 × 500); o recorte vem de quem usa. Sem imagem
   de terceiros, sem arquivo para baixar: leves, funcionam sem internet e seguem as cores do time. */
import type { JSX } from 'preact';

const W = 400,
  H = 500;
type P = { c1: string; c2: string; id: string };

/* Pontos fixos (sem sorteio na hora: o mesmo card sempre igual, em qualquer aparelho). */
const fixo = (n: number, sem: number) => {
  let x = sem;
  return Array.from({ length: n }, () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  });
};

const base = (c1: string) => <rect width={W} height={H} fill={c1} />;

const DESENHOS: Record<string, (p: P) => JSX.Element> = {
  /* Gramado com as listras do corte. */
  gramado: ({ c1, c2 }) => (
    <>
      {base(c1)}
      {Array.from({ length: 10 }, (_, i) =>
        i % 2 ? <rect key={i} y={i * 50} width={W} height={50} fill={c2} opacity=".16" /> : null
      )}
    </>
  ),
  /* Quadra vista de cima. */
  quadra: ({ c1, c2 }) => (
    <>
      {base(c1)}
      <g fill="none" stroke={c2} stroke-width="5" opacity=".45">
        <rect x="30" y="30" width="340" height="440" />
        <line x1="30" y1="250" x2="370" y2="250" />
        <circle cx="200" cy="250" r="58" />
        <rect x="110" y="30" width="180" height="80" />
        <rect x="110" y="390" width="180" height="80" />
        <rect x="160" y="30" width="80" height="30" />
        <rect x="160" y="440" width="80" height="30" />
      </g>
      <circle cx="200" cy="250" r="6" fill={c2} opacity=".45" />
    </>
  ),
  /* Rede do gol. */
  rede: ({ c1, c2, id }) => (
    <>
      {base(c1)}
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 V28 M0 0 H28" stroke={c2} stroke-width="2.5" fill="none" opacity=".4" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  ),
  /* Faixas diagonais largas. */
  faixas: ({ c1, c2 }) => (
    <>
      {base(c1)}
      <path d="M-60 330 L460 70 L460 150 L-60 410Z" fill={c2} opacity=".28" />
      <path d="M-60 430 L460 170 L460 200 L-60 460Z" fill={c2} opacity=".18" />
      <path d="M-60 250 L460 -10 L460 20 L-60 280Z" fill={c2} opacity=".12" />
    </>
  ),
  /* Raios saindo do alto (sol, estádio). */
  raios: ({ c1, c2 }) => (
    <>
      {base(c1)}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI * (i + 0.5)) / 12,
          b = (Math.PI * (i + 1)) / 12;
        const p = (t: number) => `${200 - Math.cos(t) * 700} ${-40 + Math.sin(t) * 700}`;
        return i % 2 ? null : <path key={i} d={`M200 -40 L${p(a)} L${p(b)}Z`} fill={c2} opacity=".16" />;
      })}
    </>
  ),
  /* Holofotes nos cantos de cima. */
  holofotes: ({ c1, c2, id }) => (
    <>
      {base(c1)}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={c2} stop-opacity=".55" />
          <stop offset="1" stop-color={c2} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M-10 -10 L60 -10 L330 520 L120 520Z" fill={`url(#${id})`} />
      <path d="M410 -10 L340 -10 L70 520 L280 520Z" fill={`url(#${id})`} />
      <circle cx="25" cy="10" r="26" fill={c2} opacity=".5" />
      <circle cx="375" cy="10" r="26" fill={c2} opacity=".5" />
    </>
  ),
  /* Gomos da bola (hexágonos). */
  hexagonos: ({ c1, c2, id }) => (
    <>
      {base(c1)}
      <defs>
        <pattern id={id} width="60" height="104" patternUnits="userSpaceOnUse">
          <path
            d="M30 0 L60 17 L60 52 L30 69 L0 52 L0 17Z M30 69 L30 104 M0 52 L-30 69 M60 52 L90 69"
            fill="none"
            stroke={c2}
            stroke-width="3"
            opacity=".35"
          />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  ),
  /* Ondas. */
  ondas: ({ c1, c2 }) => (
    <>
      {base(c1)}
      {Array.from({ length: 9 }, (_, i) => {
        const y = 40 + i * 55;
        return (
          <path
            key={i}
            d={`M-20 ${y} Q80 ${y - 34} 180 ${y} T380 ${y} T580 ${y}`}
            fill="none"
            stroke={c2}
            stroke-width={i % 3 ? 4 : 9}
            opacity=".25"
          />
        );
      })}
    </>
  ),
  /* Linhas de velocidade. */
  velocidade: ({ c1, c2 }) => {
    const r = fixo(48, 7);
    return (
      <>
        {base(c1)}
        {Array.from({ length: 16 }, (_, i) => {
          const y = 20 + i * 30,
            x = r[i * 3]! * 200,
            w = 80 + r[i * 3 + 1]! * 260;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={3 + Math.round(r[i * 3 + 2]! * 6)}
              rx="4"
              fill={c2}
              opacity=".3"
            />
          );
        })}
      </>
    );
  },
  /* Xadrez de bandeira. */
  xadrez: ({ c1, c2, id }) => (
    <>
      {base(c1)}
      <defs>
        <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <rect width="40" height="40" fill={c2} opacity=".18" />
          <rect x="40" y="40" width="40" height="40" fill={c2} opacity=".18" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  ),
  /* Concreto (granulado gerado pelo navegador). */
  concreto: ({ c1, c2, id }) => (
    <>
      {base(c1)}
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.3" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={c2} filter={`url(#${id})`} opacity=".35" />
    </>
  ),
  /* Confete de comemoração. */
  confete: ({ c1, c2 }) => {
    const r = fixo(160, 31);
    return (
      <>
        {base(c1)}
        {Array.from({ length: 40 }, (_, i) => {
          const x = r[i * 4]! * W,
            y = r[i * 4 + 1]! * H,
            g = Math.round(r[i * 4 + 2]! * 180),
            o = 0.25 + r[i * 4 + 3]! * 0.35;
          return i % 3 ? (
            <rect
              key={i}
              x={x}
              y={y}
              width="14"
              height="6"
              rx="2"
              fill={c2}
              opacity={o}
              transform={`rotate(${g} ${x} ${y})`}
            />
          ) : (
            <circle key={i} cx={x} cy={y} r="4" fill={c2} opacity={o} />
          );
        })}
      </>
    );
  },
  /* Círculos do centro (radar). */
  radar: ({ c1, c2 }) => (
    <>
      {base(c1)}
      {Array.from({ length: 9 }, (_, i) => (
        <circle
          key={i}
          cx="200"
          cy="250"
          r={30 + i * 40}
          fill="none"
          stroke={c2}
          stroke-width={i % 2 ? 3 : 7}
          opacity=".22"
        />
      ))}
    </>
  ),
  /* Triângulos (baixo polígono). */
  triangulos: ({ c1, c2 }) => {
    const r = fixo(40, 17),
      pts: string[] = [];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 4; x++) {
        const a = `${x * 100} ${y * 100}`,
          b = `${(x + 1) * 100} ${y * 100}`,
          c = `${x * 100} ${(y + 1) * 100}`,
          d = `${(x + 1) * 100} ${(y + 1) * 100}`;
        pts.push(`M${a} L${b} L${c}Z`, `M${b} L${d} L${c}Z`);
      }
    return (
      <>
        {base(c1)}
        {pts.map((d, i) => (
          <path key={i} d={d} fill={c2} opacity={(r[i]! * 0.3).toFixed(2)} />
        ))}
      </>
    );
  },
};

export function FundoPronto({ p, c1, c2, id }: { p?: string; c1: string; c2: string; id: string }) {
  const d = DESENHOS[p || ''] || DESENHOS.gramado!;
  return d({ c1, c2, id });
}
