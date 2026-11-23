/* Desenho de um card do grupo (KAN-294, pelada-v126): um SVG só (400 × 500, a proporção 4:5 da imagem que vai para o
   WhatsApp no KAN-295), montado a partir do modelo (dominio/cards.ts) e dos dados do jogador. Desenho próprio do
   Nosso Jogo. Sem HTML em texto: tudo em elementos do Preact. Vem sob demanda com a janela de cards. */
import { coresDoMetal, type Fundo, type Modelo } from '../dominio/cards';
import { APP } from '../dominio/esportes.js';
import { FundoPronto } from './fundos-prontos';

export type DadosCard = {
  nome: string;
  pos: string;
  foto: string;
  logo: string;
  iniciais: string;
  titulo: string;
  grande: string;
  rotGrande: string;
  campos: { r: string; v: string }[];
};

const W = 400,
  H = 500;
let seq = 0;

const FORMA: Record<string, string> = {
  classico:
    'M70 66 L150 66 Q188 66 200 38 Q212 66 250 66 L330 66 Q336 66 336 72 L336 372 L346 386 L346 408 Q346 430 326 440 L200 478 L74 440 Q54 430 54 408 L54 386 L64 372 L64 72 Q64 66 70 66Z',
  destaque:
    'M100 30 H300 Q320 30 330 46 L346 70 V300 L356 314 V394 Q356 414 336 420 L200 470 L64 420 Q44 414 44 394 V314 L54 300 V70 L70 46 Q80 30 100 30Z',
  escudo:
    'M62 44 H170 L200 28 L230 44 H338 Q348 44 348 54 V368 Q348 390 330 402 L200 466 L70 402 Q52 390 52 368 V54 Q52 44 62 44Z',
};
/* Formatos do Clássico metálico (v127). */
const FORMA_METAL: Record<string, string> = {
  coroa: FORMA.classico!,
  reto: 'M92 50 H308 L340 82 V380 Q340 406 316 420 L200 474 L84 420 Q60 406 60 380 V82Z',
  arco: 'M62 92 Q200 22 338 92 V384 Q338 408 316 420 L200 474 L84 420 Q62 408 62 384Z',
};
/* Endereço da imagem de fundo enviada pelo grupo (v127); quem desenha informa (ui/cards-src.ts). */
type Src = (nome: string) => string;

/* Fundo (cor, degradê, listras, pontos ou mármore) ocupando a área toda; o recorte vem de quem usa. */
function Preenche({ f, id, src }: { f: Fundo; id: string; src?: Src }) {
  if (f.t === 'cor') return <rect width={W} height={H} fill={f.c1} />;
  if (f.t === 'pronto') return <FundoPronto p={f.p} c1={f.c1} c2={f.c2} id={id} />;
  if (f.t === 'imagem') {
    const u = f.img && src ? src(f.img) : '';
    return (
      <>
        <rect width={W} height={H} fill={f.c1} />
        {u ? <image href={u} width={W} height={H} preserveAspectRatio="xMidYMid slice" /> : null}
      </>
    );
  }
  if (f.t === 'grad')
    return (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color={f.c1} />
            <stop offset="1" stop-color={f.c2} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${id})`} />
      </>
    );
  if (f.t === 'listras')
    return (
      <>
        <defs>
          <pattern id={id} width="70" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <rect width="22" height="70" fill={f.c2} opacity=".35" />
            <rect x="40" width="10" height="70" fill={f.c2} opacity=".18" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={f.c1} />
        <rect width={W} height={H} fill={`url(#${id})`} />
      </>
    );
  if (f.t === 'pontos')
    return (
      <>
        <defs>
          <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="2.2" fill={f.c2} opacity=".4" />
            <circle cx="14" cy="14" r="2.2" fill={f.c2} opacity=".4" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={f.c1} />
        <rect width={W} height={H} fill={`url(#${id})`} />
      </>
    );
  /* Mármore: veios gerados pelo próprio navegador (ruído), na cor 2 sobre a cor 1. */
  return (
    <>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.008 0.022" numOctaves="5" seed="11" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 1.1" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={f.c1} />
      <rect width={W} height={H} fill={f.c2} filter={`url(#${id})`} opacity=".45" />
    </>
  );
}

/* Tamanho da letra para o texto caber na largura (medida aproximada da fonte condensada). */
const caber = (t: string, tam: number, max: number) =>
  t.length * tam * 0.58 > max ? Math.max(8, Math.floor(max / (t.length * 0.58))) : tam;

/* Texto que encolhe para caber na largura (nome longo, número de 4 dígitos). */
function Texto(p: {
  x: number;
  y: number;
  t: string;
  tam: number;
  max: number;
  cor: string;
  peso?: number;
  ancora?: 'start' | 'middle' | 'end';
  esp?: number;
}) {
  const tam = caber(p.t, p.tam, p.max);
  return (
    <text
      x={p.x}
      y={p.y}
      font-size={tam}
      font-weight={p.peso || 700}
      fill={p.cor}
      text-anchor={p.ancora || 'middle'}
      letter-spacing={p.esp || 0}
    >
      {p.t}
    </text>
  );
}

function Escudinho({ x, y, r, d, m, id }: { x: number; y: number; r: number; d: DadosCard; m: Modelo; id: string }) {
  return d.logo ? (
    <>
      <defs>
        <clipPath id={id}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={r + 2} fill={m.linha} />
      <image
        href={d.logo}
        x={x - r}
        y={y - r}
        width={r * 2}
        height={r * 2}
        clip-path={`url(#${id})`}
        preserveAspectRatio="xMidYMid slice"
      />
    </>
  ) : (
    <>
      <circle cx={x} cy={y} r={r} fill="none" stroke={m.linha} stroke-width="2.5" />
      <Texto x={x} y={y + r * 0.36} t={d.iniciais} tam={Math.round(r * 0.9)} max={r * 1.6} cor={m.linha} />
    </>
  );
}

function Foto({ d, x, y, w, h }: { d: DadosCard; x: number; y: number; w: number; h: number }) {
  return d.foto ? (
    <image href={d.foto} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMax meet" />
  ) : (
    <g opacity=".35">
      <circle cx={x + w / 2} cy={y + h * 0.32} r={w * 0.2} fill="#ffffff" />
      <path d={`M${x + w * 0.18} ${y + h} Q${x + w / 2} ${y + h * 0.45} ${x + w * 0.82} ${y + h}Z`} fill="#ffffff" />
    </g>
  );
}

export function CardDesenho({ m, d, rotulo, src }: { m: Modelo; d: DadosCard; rotulo: string; src?: Src }) {
  const k = 'cd' + ++seq,
    forma = m.base === 'metalico' ? FORMA_METAL[m.forma || 'coroa']! : FORMA[m.base]!;
  const fundoFora = <Preenche f={m.fora} id={k + 'f'} src={src} />;
  const dentro = (
    <>
      <defs>
        <clipPath id={k + 'c'}>
          <path d={forma} />
        </clipPath>
      </defs>
      <g clip-path={`url(#${k}c)`}>
        <Preenche f={m.dentro} id={k + 'd'} src={src} />
      </g>
    </>
  );
  let corpo;
  if (m.base === 'classico') {
    const n = Math.max(1, d.campos.length),
      passo = 252 / n,
      tamR = Math.min(...d.campos.map(c => caber(c.r, 12, passo - 4)), 12);
    corpo = (
      <>
        {dentro}
        <g clip-path={`url(#${k}c)`}>
          <rect x="0" y="350" width={W} height="150" fill="#ffffff" opacity=".18" />
        </g>
        <path d={forma} fill="none" stroke={m.linha} stroke-width="5" />
        <path
          d={forma}
          transform="translate(200 258) scale(.955) translate(-200 -258)"
          fill="none"
          stroke={m.linha}
          stroke-width="1.6"
        />
        <Foto d={d} x={156} y={74} w={180} h={278} />
        <Escudinho x={112} y={100} r={14} d={d} m={m} id={k + 'l'} />
        <Texto x={112} y={166} t={d.grande} tam={54} max={84} cor={m.letra} />
        <Texto x={112} y={184} t={d.rotGrande} tam={12} max={84} cor={m.letra} esp={1} />
        <Texto x={112} y={210} t={d.pos} tam={22} max={84} cor={m.letra} />
        <line x1="96" y1="352" x2="304" y2="352" stroke={m.linha} stroke-width="1.5" />
        <Texto x={200} y={388} t={d.nome} tam={34} max={260} cor={m.letra} />
        {d.campos.map((c, i) => (
          <g key={i}>
            <Texto x={74 + passo * (i + 0.5)} y={410} t={c.r} tam={tamR} max={passo - 4} cor={m.letra} peso={600} />
            <Texto x={74 + passo * (i + 0.5)} y={434} t={c.v} tam={22} max={passo - 2} cor={m.letra} />
          </g>
        ))}
        <Escudinho x={200} y={458} r={11} d={d} m={m} id={k + 'e'} />
      </>
    );
  } else if (m.base === 'metalico') {
    const cores = coresDoMetal(m),
      g = `url(#${k}m)`,
      coroa = (m.forma || 'coroa') === 'coroa',
      n = Math.max(1, d.campos.length),
      larg = coroa ? 252 : 220,
      x0 = (W - larg) / 2,
      passo = larg / n,
      tamR = Math.min(...d.campos.map(c => caber(c.r, 12, passo - 4)), 12);
    corpo = (
      <>
        <defs>
          <linearGradient id={k + 'm'} x1="0" y1="0" x2="1" y2="1">
            {cores.map((c, i) => (
              <stop key={i} offset={i / (cores.length - 1)} stop-color={c} />
            ))}
          </linearGradient>
          <linearGradient id={k + 'b'} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
            <stop offset=".5" stop-color="#ffffff" stop-opacity=".38" />
            <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
          </linearGradient>
          <filter id={k + 's'}>
            <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity=".35" />
          </filter>
        </defs>
        <g filter={`url(#${k}s)`}>
          <path d={forma} fill={g} transform="translate(200 258) scale(1.045) translate(-200 -258)" />
        </g>
        {dentro}
        <g clip-path={`url(#${k}c)`}>
          <rect x="0" y="352" width={W} height="150" fill="#ffffff" opacity=".35" />
          <path d="M290 0 L380 0 L190 500 L100 500Z" fill={`url(#${k}b)`} />
        </g>
        <path d={forma} fill="none" stroke={g} stroke-width="3" />
        <path
          d={forma}
          transform="translate(200 258) scale(.945) translate(-200 -258)"
          fill="none"
          stroke={g}
          stroke-width="1.6"
        />
        <Foto d={d} x={156} y={coroa ? 74 : 92} w={180} h={coroa ? 278 : 260} />
        <Texto x={112} y={166} t={d.grande} tam={54} max={84} cor={m.letra} />
        <Texto x={112} y={184} t={d.rotGrande} tam={12} max={84} cor={m.letra} esp={1} />
        <line x1="92" y1="194" x2="132" y2="194" stroke={g} stroke-width="2" />
        <Texto x={112} y={218} t={d.pos} tam={22} max={84} cor={m.letra} />
        <line x1="110" y1="354" x2="290" y2="354" stroke={g} stroke-width="2" />
        <Texto x={200} y={388} t={d.nome} tam={34} max={240} cor={m.letra} />
        {d.campos.map((c, i) => (
          <g key={i}>
            <Texto x={x0 + passo * (i + 0.5)} y={410} t={c.r} tam={tamR} max={passo - 4} cor={m.letra} peso={600} />
            <Texto x={x0 + passo * (i + 0.5)} y={434} t={c.v} tam={22} max={passo - 2} cor={m.letra} />
          </g>
        ))}
        <circle cx="200" cy="456" r="13" fill={g} />
        <Escudinho x={200} y={456} r={10} d={d} m={{ ...m, linha: m.letra }} id={k + 'e'} />
      </>
    );
  } else if (m.base === 'destaque') {
    const [a, b] = [d.campos[0], d.campos[1]];
    corpo = (
      <>
        {dentro}
        <g clip-path={`url(#${k}c)`}>
          <path d="M40 20 H176 V236 L40 296Z" fill={m.faixa} />
          <path d="M176 20 L200 20 L176 250Z" fill={m.linha} opacity=".8" />
          <rect x="40" y="318" width="320" height="170" fill={m.placa} />
        </g>
        <path d={forma} fill="none" stroke={m.linha} stroke-width="5" />
        <Foto d={d} x={176} y={40} w={176} h={278} />
        <Escudinho x={112} y={82} r={24} d={d} m={m} id={k + 'l'} />
        <Texto x={112} y={144} t={d.titulo} tam={24} max={108} cor={m.letraFaixa} esp={1} />
        <Texto x={112} y={196} t={d.grande} tam={50} max={108} cor={m.letraFaixa} />
        <Texto x={112} y={218} t={d.rotGrande} tam={12} max={108} cor={m.letraFaixa} esp={1} />
        <Texto x={200} y={360} t={d.nome} tam={34} max={280} cor={m.letra} />
        {b ? <line x1="200" y1="376" x2="200" y2="424" stroke={m.linha} stroke-width="1.5" /> : null}
        {a ? (
          <>
            <Texto x={b ? 140 : 200} y={390} t={a.r} tam={12} max={110} cor={m.letra} peso={600} />
            <Texto x={b ? 140 : 200} y={420} t={a.v} tam={30} max={110} cor={m.letra} />
          </>
        ) : null}
        {b ? (
          <>
            <Texto x={260} y={390} t={b.r} tam={12} max={110} cor={m.letra} peso={600} />
            <Texto x={260} y={420} t={b.v} tam={30} max={110} cor={m.letra} />
          </>
        ) : null}
        <Escudinho x={200} y={448} r={11} d={d} m={m} id={k + 'e'} />
      </>
    );
  } else {
    const tamE = Math.min(...d.campos.map(c => caber(c.r, 11, 56)), 11);
    corpo = (
      <>
        {dentro}
        <path d={forma} fill="none" stroke={m.linha} stroke-width="4" />
        <Foto d={d} x={168} y={52} w={172} h={262} />
        <Texto x={78} y={112} t={d.grande} tam={56} max={110} cor={m.letra} ancora="start" />
        <Texto x={80} y={132} t={d.rotGrande} tam={13} max={100} cor={m.letra} ancora="start" esp={1} />
        <Texto x={80} y={158} t={d.pos} tam={22} max={80} cor={m.letra} ancora="start" />
        <Escudinho x={96} y={192} r={16} d={d} m={m} id={k + 'l'} />
        <Texto x={200} y={340} t={d.nome} tam={34} max={260} cor={m.letra} />
        <line x1="96" y1="352" x2="304" y2="352" stroke={m.linha} stroke-width="1.5" />
        {d.campos.map((c, i) => (
          <g key={i}>
            <Texto x={140 + (i % 3) * 60} y={380 + Math.floor(i / 3) * 42} t={c.v} tam={22} max={56} cor={m.letra} />
            <Texto
              x={140 + (i % 3) * 60}
              y={394 + Math.floor(i / 3) * 42}
              t={c.r}
              tam={tamE}
              max={56}
              cor={m.letra}
              peso={600}
            />
          </g>
        ))}
      </>
    );
  }
  return (
    <svg class="card-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo} xmlns="http://www.w3.org/2000/svg">
      {fundoFora}
      {corpo}
      <Texto x={W - 12} y={H - 10} t={APP} tam={10} max={80} cor={m.letra} ancora="end" peso={600} />
    </svg>
  );
}
