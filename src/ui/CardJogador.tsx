/* Card do jogador de verdade (KAN-295, pelada-v129): o modelo do grupo para o card "Jogador", a foto e os números do
   período, lidos da cópia pública dos resumos do mês (resumosPub, dominio/resumo-publico.ts). Abre na ficha do jogador
   (gestão) e no "Meu card" do link do jogador. "Mandar no WhatsApp" gera a imagem de 1080 × 1350 e abre o compartilhar
   do celular (sem isso, baixa a imagem). Baixa sob demanda, com o desenho do card.
   KAN-295 (v131): os cards da rodada (craque, artilheiro, garçom e campeão) abrem esta mesma janela, com o modelo do
   tipo, os números da rodada junto com os da temporada e a mensagem pronta da rodada. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { lerCards, modeloDe, numerosDoPeriodo, valor, type Numeros, type TipoCard } from '../dominio/cards';
import { siglaTela, sport } from '../dominio/esportes.js';
import { gname } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
import { S as estado } from '../nucleo/estado.js';
import { fmonth, toast, today } from '../nucleo/util.js';
import { CardDesenho } from './CardDesenho';
import { dadosDoCard } from './card-dados';
import { cardParaPng, compartilharCard } from './card-imagem';
import { srcFundo } from './cards-src';
import { openDlg } from './dialogos.js';
import { usarEstilo } from './estilo';
import { srcFoto } from './foto-src';
import { srcLogo } from './logo-src';
import estilo from '../estilos/cards.css' with { type: 'text' };

usarEstilo('cards', estilo);

type Obj = Record<string, any>;
const st = () => estado as Obj;
const temAst = () => !!(sport() as { ast?: boolean }).ast;

/* Números públicos de todos os meses do grupo (poucos documentos; a cópia do aparelho serve sem internet). */
async function lerNumeros(gid: string): Promise<Record<string, Obj>> {
  const B = (banco as Obj).B;
  return ((await B.get('grupos/' + gid + '/resumosPub')) || {}) as Record<string, Obj>;
}

/* Card da rodada: o tipo, os números da rodada, a data e, para outra categoria da votação, o título dela. */
export type CardDaRodada = { tipo: TipoCard; rod: Numeros; data: string; titulo?: string; nome?: string };

/* "CRAQUE" vira "craque" na mensagem; siglas curtas (MVP) ficam como estão. */
const naFrase = (t: string) => (t.length <= 3 ? t : t.toLowerCase());

function Janela({ pid, origem, rodada }: { pid: string; origem: 'ficha' | 'link'; rodada?: CardDaRodada }) {
  const gid = st().gid as string,
    app = (st().app || {}) as Obj,
    av = ((st().avul || {}) as Obj)[pid] || {},
    j = { ...av, ...((st().jog || {}) as Obj)[pid] };
  /* Avulso que jogou a rodada também ganha o card da rodada (sem foto). */
  if (!j.name) j.name = av.nome || (rodada && rodada.nome) || '';
  const tipo: TipoCard = rodada ? rodada.tipo : 'perfil';
  const cards = lerCards((app.cfg || {}).cards, temAst()),
    u0 = cards.usos[tipo]!,
    u = rodada && rodada.titulo && !u0.titulo ? { ...u0, titulo: rodada.titulo.toUpperCase() } : u0,
    m = modeloDe(cards, u.m);
  const [nums, setNums] = useState<Numeros | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    lerNumeros(gid).then(
      r => vivo && setNums({ ...numerosDoPeriodo(r as never, pid, u.per, today()), ...(rodada ? rodada.rod : {}) }),
      () => vivo && setNums({})
    );
    return () => {
      vivo = false;
    };
  }, [gid, pid]);
  const hoje = today();
  const periodo = tx('cardj.per.' + u.per, { ano: hoje.slice(0, 4), mes: fmonth(hoje.slice(0, 7)) });
  const d = dadosDoCard(
    m,
    u,
    tipo,
    { nome: j.name || '', pos: j.pos ? siglaTela(j.pos) : '', foto: srcFoto(gid, pid, j.foto) },
    nums || {},
    { logo: srcLogo(gid, app.logo), nome: gname() || '' }
  );
  const semNumeros = nums && !nums.jogos && !rodada;
  const mandar = async () => {
    const svg = caixa.current && (caixa.current.querySelector('svg.card-svg') as SVGSVGElement | null);
    if (!svg || ocupado) return;
    setOcupado(true);
    try {
      const png = await cardParaPng(svg);
      if (!png) {
        toast(tx('cardj.naoGerou'));
        return;
      }
      const texto = rodada
        ? textoDaRodada(rodada, d.titulo, j.name || '')
        : origem === 'link'
          ? tx('cardj.texto', { grupo: gname() || '' })
          : tx('cardj.textoAdm', { nome: j.name || '', grupo: gname() || '' });
      const r = await compartilharCard(
        png,
        'card-' + String(j.name || 'jogador').replace(/[^\w-]+/g, '-') + '.png',
        texto
      );
      if (r === 'baixou') toast(tx('cardj.baixou'));
    } catch (e) {
      toast(tx('cardj.naoGerou'));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div class="dlg card-jog" id="cardJogador">
      <h3 id="cardJogT">{tx('cardj.titulo', { nome: j.name || '' })}</h3>
      <p class="small muted" id="cardJogPer" aria-live="polite">
        {nums
          ? rodada
            ? tx('cardj.rodada', { data: rodada.data })
            : semNumeros
              ? tx('cardj.semNumeros')
              : periodo
          : tx('cardj.carregando')}
      </p>
      <div class="card-jog-svg" ref={caixa}>
        <CardDesenho m={m} d={d} rotulo={tx('cardj.rotulo', { nome: j.name || '' })} src={n => srcFundo(gid, n)} />
      </div>
      <div class="dlg-f">
        <button type="button" class="btn" data-a="close">
          {tx('cardj.fechar')}
        </button>
        <button
          type="button"
          id="cardMandar"
          class={ocupado ? 'btn primary busy' : 'btn primary'}
          aria-busy={ocupado}
          disabled={ocupado || !nums}
          onClick={mandar}
        >
          {tx('cardj.mandar')}
        </button>
      </div>
    </div>
  );
}

/* A mensagem pronta da rodada (KAN-295): o título do card na frase, a data e, no artilheiro e no garçom, o número. */
function textoDaRodada(r: CardDaRodada, titulo: string, nome: string): string {
  const SP = sport() as { word?: string; e?: string },
    a = r.rod.asRod || 0;
  const base = { nome, titulo: naFrase(titulo), data: r.data, grupo: gname() || '' };
  if (r.tipo === 'artilheiro')
    return tx('cardj.zap.artilheiro', {
      ...base,
      e: SP.e || '',
      n: valor('golsRod', r.rod),
      ponto: String(SP.word || '').toLowerCase(),
    });
  if (r.tipo === 'garcom') return a === 1 ? tx('cardj.zap.garcom1', base) : tx('cardj.zap.garcom', { ...base, n: a });
  return tx('cardj.zap.' + (r.tipo === 'campeao' ? 'campeao' : 'craque'), base);
}

export function abrirCardJogador(pid: string, origem: 'ficha' | 'link', rodada?: CardDaRodada) {
  openDlg(<Janela pid={pid} origem={origem} rodada={rodada} />);
}
