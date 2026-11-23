/* Janela "Cards do grupo" (KAN-294, pelada-v126): escolher, para cada tipo de card, o modelo e o que ele mostra;
   copiar um modelo pronto (ou do grupo) e editar a cópia: fundo de fora e de dentro, cores das linhas, das letras,
   da faixa e da placa. Tudo fica nesta janela até "Salvar", que grava cfg.cards do grupo (só com Configurações e
   Plano A; as regras do Firebase conferem). Vem sob demanda (acoes/cards.ts), com o estilo e os textos dela. */
import { useState } from 'preact/hooks';
import estilo from '../estilos/cards.css' with { type: 'text' };
import {
  BASES,
  ESPACOS,
  MAX_MODELOS,
  MAX_NOME,
  MAX_TITULO,
  PERIODOS,
  PRONTOS,
  EXEMPLO,
  apagar,
  copiar,
  estatsDe,
  imagensParaApagar,
  lerCards,
  modeloDe,
  paraGravar,
  poucoContraste,
  pronto,
  tiposDe,
  valor,
  type Cards,
  type Modelo,
  type TipoCard,
  type Uso,
} from '../dominio/cards';
import { siglaTela, sport } from '../dominio/esportes.js';
import { gname, players } from '../dominio/grupo.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-cards';
import * as banco from '../nucleo/backend.js';
import { editApp } from '../nucleo/edicoes';
import { S as estado } from '../nucleo/estado.js';
import { toast } from '../nucleo/util.js';
import { CardDesenho, type DadosCard } from './CardDesenho';
import { closeDlg, marcarAlterada, openDlg } from './dialogos.js';
import { usarEstilo } from './estilo';
import { srcFoto } from './foto-src';
import { srcLogo } from './logo-src';
import { srcFundo } from './cards-src';
import { Cor, FundoCampos, MetalCampos } from './CardsCampos';
import { curtoEstat, dadosDoCard } from './card-dados';
import { apagarFundos, enviadas } from '../acoes/fundo-card';

juntarTextos(textos);
usarEstilo('cards', estilo);

type El = HTMLElement & { dataset: DOMStringMap };
type Obj = Record<string, any>;
const st = () => estado as Obj;
const temAst = () => !!(sport() as { ast?: boolean }).ast;

/* O que está na janela agora (as ações leem daqui). */
let atual: { cards: Cards; tipo: TipoCard } | null = null;

const nomeModelo = (c: Cards, id: string) =>
  pronto(id)
    ? tx('card.base.' + (PRONTOS[id] || PRONTOS['p-classico']!).base)
    : modeloDe(c, id).n || tx('card.semNome');
const rotEstat = (k: string) => tx('card.est.' + k, { ponto: String((sport() as { word?: string }).word || '') });

/* O jogador da prévia: o primeiro com foto (ou o primeiro do elenco, ou "Exemplo"). Números de exemplo. */
function dadosPrevia(c: Cards, tipo: TipoCard, u: Uso): DadosCard {
  const gid = st().gid as string,
    jog = (st().jog || {}) as Record<string, Obj>;
  const ps = players() as { id: string; name: string; pos?: string }[];
  const p = ps.find(x => jog[x.id] && jog[x.id]!.foto) || ps[0];
  return dadosDoCard(
    modeloDe(c, u.m),
    u,
    tipo,
    {
      nome: p ? p.name : tx('card.exemplo'),
      pos: p && p.pos ? siglaTela(p.pos) : '',
      foto: p ? srcFoto(gid, p.id, jog[p.id] && jog[p.id]!.foto) : '',
    },
    EXEMPLO,
    { logo: srcLogo(gid, st().app && st().app.logo), nome: gname() || '' }
  );
}

function Janela({ inicial }: { inicial: Cards }) {
  const [c, setC] = useState<Cards>(inicial);
  const [tipo, setTipo] = useState<TipoCard>('perfil');
  atual = { cards: c, tipo };
  const tipos = tiposDe(temAst());
  const u = c.usos[tipo]!,
    m = modeloDe(c, u.m),
    meu = !pronto(u.m);
  const ok = estatsDe(tipo, temAst());
  const mudar = (n: Cards) => {
    setC(n);
    marcarAlterada();
  };
  const mudarUso = (p: Partial<Uso>) => mudar({ ...c, usos: { ...c.usos, [tipo]: { ...u, ...p } } });
  const mudarModelo = (p: Partial<Modelo>) => mudar({ ...c, modelos: { ...c.modelos, [u.m]: { ...m, ...p } } });
  const copiarAgora = () => {
    const id = ((banco as Obj).B as Obj).newId() as string;
    const r = copiar(c, u.m, id, tx('card.copiaDe', { nome: nomeModelo(c, u.m) }));
    if (!r) {
      toast(tx('card.limite', { n: MAX_MODELOS }));
      return;
    }
    mudar({ ...r.cards, usos: { ...r.cards.usos, [tipo]: { ...u, m: r.id } } });
    setTimeout(() => (document.getElementById('cardNome') as HTMLInputElement | null)?.focus(), 0);
  };
  const espacos = ESPACOS[m.base];
  const campos = Array.from({ length: espacos }, (_, i) => u.campos[i] || '');
  const dados = dadosPrevia(c, tipo, u);
  return (
    <div id="cardsJanela">
      <h3 id="cardsTitulo">{tx('card.titulo')}</h3>
      <p class="small muted" style="margin-top:-6px">
        {tx('card.ajuda')}
      </p>
      <div class="seg card-tipos" role="group" aria-label={tx('card.tipoRot')}>
        {tipos.map(t => (
          <button key={t} type="button" class="opt" aria-pressed={t === tipo} data-tipo={t} onClick={() => setTipo(t)}>
            {tx('card.tipo.' + t)}
          </button>
        ))}
      </div>
      <div class="card-grade">
        <div class="card-previa">
          <CardDesenho
            m={m}
            d={dados}
            rotulo={tx('card.previaRot', { tipo: tx('card.tipo.' + tipo) })}
            src={n => srcFundo(st().gid as string, n)}
          />
          <p class="small muted">{tx('card.previaAjuda')}</p>
        </div>
        <div class="card-campos">
          <label class="lbl" for="cardModelo">
            {tx('card.modelo')}
          </label>
          <select
            id="cardModelo"
            class="sel"
            data-foco
            onChange={e => mudarUso({ m: (e.currentTarget as HTMLSelectElement).value })}
          >
            <optgroup label={tx('card.prontos')}>
              {BASES.map(b => (
                <option key={b} value={'p-' + b} selected={u.m === 'p-' + b}>
                  {tx('card.base.' + b)}
                </option>
              ))}
            </optgroup>
            {Object.keys(c.modelos).length ? (
              <optgroup label={tx('card.meus')}>
                {Object.keys(c.modelos).map(id => (
                  <option key={id} value={id} selected={u.m === id}>
                    {nomeModelo(c, id)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <div class="card-botoes">
            <button type="button" class="btn sm" id="cardCopiar" onClick={copiarAgora}>
              {tx('card.copiar')}
            </button>
            {meu ? (
              <button
                type="button"
                class="btn sm ghost danger"
                id="cardApagar"
                onClick={() => {
                  mudar(apagar(c, u.m));
                  toast(tx('card.apagado'));
                }}
              >
                {tx('card.apagar')}
              </button>
            ) : null}
          </div>
          {meu ? (
            <div class="card-modelo" id="cardModeloEd">
              <label class="lbl" for="cardNome">
                {tx('card.nomeModelo')}
              </label>
              <input
                id="cardNome"
                class="inp"
                maxLength={MAX_NOME}
                value={m.n}
                onInput={e => mudarModelo({ n: (e.currentTarget as HTMLInputElement).value })}
              />
              <FundoCampos k="fora" f={m.fora} on={fora => mudarModelo({ fora })} />
              <FundoCampos k="dentro" f={m.dentro} on={dentro => mudarModelo({ dentro })} />
              {m.base === 'metalico' ? <MetalCampos m={m} on={mudarModelo} /> : null}
              <div class="card-cores">
                <Cor id="ccLinha" rot={tx('card.linha')} v={m.linha} on={linha => mudarModelo({ linha })} />
                <Cor id="ccLetra" rot={tx('card.letra')} v={m.letra} on={letra => mudarModelo({ letra })} />
                {m.base === 'destaque' ? (
                  <>
                    <Cor id="ccFaixa" rot={tx('card.faixa')} v={m.faixa} on={faixa => mudarModelo({ faixa })} />
                    <Cor
                      id="ccLetraFaixa"
                      rot={tx('card.letraFaixa')}
                      v={m.letraFaixa}
                      on={letraFaixa => mudarModelo({ letraFaixa })}
                    />
                    <Cor id="ccPlaca" rot={tx('card.placa')} v={m.placa} on={placa => mudarModelo({ placa })} />
                  </>
                ) : null}
              </div>
              {poucoContraste(m) ? (
                <p class="warn-alt small" id="cardContraste" role="status">
                  {tx('card.contraste')}
                </p>
              ) : null}
            </div>
          ) : (
            <p class="small muted">{tx('card.prontoAjuda')}</p>
          )}
          {m.base === 'destaque' ? (
            <>
              <label class="lbl" for="cardTitulo">
                {tx('card.tituloCard')}
              </label>
              <input
                id="cardTitulo"
                class="inp"
                maxLength={MAX_TITULO}
                placeholder={tx('card.tituloPadrao.' + tipo)}
                value={u.titulo}
                onInput={e => mudarUso({ titulo: (e.currentTarget as HTMLInputElement).value })}
              />
            </>
          ) : null}
          <label class="lbl" for="cardGrande">
            {tx('card.grande')}
          </label>
          <select
            id="cardGrande"
            class="sel"
            onChange={e => mudarUso({ grande: (e.currentTarget as HTMLSelectElement).value })}
          >
            {ok.map(k => (
              <option key={k} value={k} selected={k === u.grande}>
                {rotEstat(k)}
              </option>
            ))}
          </select>
          <fieldset class="card-espacos">
            <legend class="lbl">{tx('card.espacos', { n: espacos })}</legend>
            {campos.map((k, i) => (
              <select
                key={i}
                class="sel"
                data-espaco={i}
                aria-label={tx('card.espaco', { n: i + 1 })}
                onChange={e => {
                  const v = (e.currentTarget as HTMLSelectElement).value;
                  const novos = campos.slice();
                  novos[i] = v;
                  mudarUso({ campos: novos });
                }}
              >
                <option value="">{tx('card.vazio')}</option>
                {ok.map(x => (
                  <option key={x} value={x} selected={x === k}>
                    {rotEstat(x)}
                  </option>
                ))}
              </select>
            ))}
          </fieldset>
          {tipo === 'perfil' ? (
            <>
              <label class="lbl" for="cardPer">
                {tx('card.periodo')}
              </label>
              <select
                id="cardPer"
                class="sel"
                onChange={e => mudarUso({ per: (e.currentTarget as HTMLSelectElement).value as Uso['per'] })}
              >
                {PERIODOS.map(p => (
                  <option key={p} value={p} selected={p === u.per}>
                    {tx('card.per.' + p)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="cardsSalvar">
          {tx('card.salvar')}
        </button>
      </div>
    </div>
  );
}

/* KAN-302 (v128): o que estava gravado ao abrir, para apagar do Storage as imagens que deixaram de ser usadas. */
let sessao: { antes: Cards; gid: string; salvo: boolean } | null = null;
function limpar(s: { antes: Cards; gid: string }, depois: Cards | null) {
  const sobras = imagensParaApagar(s.antes, depois, enviadas.splice(0));
  if (sobras.length) apagarFundos(s.gid, sobras);
}

export function abrir() {
  const c = lerCards(((st().app || {}).cfg || {}).cards, temAst());
  enviadas.splice(0);
  const s = (sessao = { antes: c, gid: st().gid as string, salvo: false });
  openDlg(<Janela inicial={c} />);
  const dlg = document.getElementById('dlg');
  if (dlg)
    dlg.addEventListener(
      'close',
      () => {
        if (sessao === s && !s.salvo) limpar(s, null);
      },
      { once: true }
    );
}

export const acoes: Record<string, (el: El) => unknown> = {
  cardsAbrir: () => abrir(),
  cardsSalvar: () => {
    if (!atual) return;
    const n = paraGravar(atual.cards),
      depois = atual.cards,
      s = sessao;
    if (s) s.salvo = true;
    const p = editApp(a => {
      a.cfg.cards = n;
    });
    if (s)
      Promise.resolve(p).then(
        () => limpar(s, depois),
        () => undefined
      );
    closeDlg();
    toast(tx('card.salvo'));
    return p;
  },
};
