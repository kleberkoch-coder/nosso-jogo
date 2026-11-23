/* Card do jogador de verdade (KAN-295, pelada-v129): o modelo do grupo para o card "Jogador", a foto e os números do
   período, lidos da cópia pública dos resumos do mês (resumosPub, dominio/resumo-publico.ts). Abre na ficha do jogador
   (gestão) e no "Meu card" do link do jogador. "Mandar no WhatsApp" gera a imagem de 1080 × 1350 e abre o compartilhar
   do celular (sem isso, baixa a imagem). Baixa sob demanda, com o desenho do card. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { lerCards, modeloDe, numerosDoPeriodo, type Numeros } from '../dominio/cards';
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

function Janela({ pid, origem }: { pid: string; origem: 'ficha' | 'link' }) {
  const gid = st().gid as string,
    app = (st().app || {}) as Obj,
    j = ((st().jog || {}) as Obj)[pid] || {};
  const cards = lerCards((app.cfg || {}).cards, temAst()),
    u = cards.usos.perfil!,
    m = modeloDe(cards, u.m);
  const [nums, setNums] = useState<Numeros | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    lerNumeros(gid).then(
      r => vivo && setNums(numerosDoPeriodo(r as never, pid, u.per, today())),
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
    'perfil',
    { nome: j.name || '', pos: j.pos ? siglaTela(j.pos) : '', foto: srcFoto(gid, pid, j.foto) },
    nums || {},
    { logo: srcLogo(gid, app.logo), nome: gname() || '' }
  );
  const semNumeros = nums && !nums.jogos;
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
      const texto =
        origem === 'link'
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
        {nums ? (semNumeros ? tx('cardj.semNumeros') : periodo) : tx('cardj.carregando')}
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

export function abrirCardJogador(pid: string, origem: 'ficha' | 'link') {
  openDlg(<Janela pid={pid} origem={origem} />);
}
