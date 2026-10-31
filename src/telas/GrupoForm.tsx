/* Formulário do grupo (Novo grupo e Editar grupo), como componente em TypeScript + Preact (KAN-165).
   Por fora, igual ao de antes: os mesmos ids e classes, que as ações (acoes/grupo.ts) e os testes leem.
   Os botões continuam com data-a; as ações de escolha (frequência, esporte, dias) chamam este componente.
   KAN-163: os horários seguem o relógio do país (12h com AM/PM ou 24h) e a lista de dias começa no dia do país. */
import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SPORTS, porTimePadrao } from '../dominio/esportes.js';
import { dupName, freq } from '../dominio/grupo.js';
import { paisPor, regiaoNova } from '../dominio/paises.ts';
import { ordemDias } from '../dominio/relogio';
import { relogio12 } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-grupoform';
import { S as estado } from '../nucleo/estado.js';
import { $, diaSemana, toast, uid } from '../nucleo/util.js';
import { HoraCampo } from '../ui/HoraCampo';
import { val } from '../ui/dialogos.js';
import { fusoAparelho, listaFuso, listaMoeda, listaPais } from '../ui/regiao.ts';

juntarTextos(textos);

type Fixo = { id?: string; dow: number; ini: string; fim?: string; place?: string };
type Grupo = {
  name?: string;
  sport?: string;
  sportName?: string;
  freq?: string;
  cfg?: { fixos?: Fixo[]; porTime?: number; pais?: string; moeda?: string; fuso?: string };
};
type Linha = { k: number; x: Fixo | null };
type Regiao = { pais: string; moeda: string; fuso: string };
type Esporte = { e: string; n: string };

const st = () => estado;
const esportes = SPORTS as Record<string, Esporte>;
const nomeEsporte = (sp: string) => (esportes[sp] || esportes.futebol).n;

/* Ações de escolha do formulário aberto (registradas ao montar). */
let aberto: {
  freq: (v: string) => void;
  esporte: (v: string) => void;
  maisDia: () => void;
  menosDia: (el: HTMLElement) => void;
} | null = null;

/* País, moeda e fuso do grupo (KAN-162). Grupo novo: os do organizador (país da conta e fuso do aparelho, se for do país).
   Grupo antigo, sem país: Brasil e Real. A moeda e o fuso podem ser trocados à parte. */
function regiaoInicial(g: Grupo, editing: boolean): Regiao {
  const c = g.cfg || {};
  if (editing && c.pais) return { pais: c.pais, moeda: c.moeda || 'BRL', fuso: c.fuso || '' };
  const r = regiaoNova(editing ? 'BR' : st().me?.pais, fusoAparelho());
  if (editing) r.moeda = c.moeda || 'BRL';
  return r;
}

function porTimeAjuda(sp: string) {
  return tx('grupo.porTimeAjuda', { esporte: nomeEsporte(sp), n: porTimePadrao(sp) });
}

/* Um dia fixo: dia da semana, início, término (opcional), remover e local. */
function LinhaDia({ x, doze, dias }: { x: Fixo | null; doze: boolean; dias: number[] }) {
  const f = x || { dow: 1, ini: '20:00', fim: '22:00', place: '' };
  return (
    <div class={'srow' + (doze ? ' doze' : '')} data-id={f.id || ''}>
      <select class="sel sd" aria-label={tx('grupo.diaSemana')}>
        {dias.map(i => (
          <option key={i} value={i} selected={i === +f.dow}>
            {diaSemana(i)}
          </option>
        ))}
      </select>
      <span class="hrot">
        <span class="hrot-t" aria-hidden="true">
          {tx('grupo.inicio')}
        </span>
        <HoraCampo cls="si" valor={f.ini || ''} rotulo={tx('grupo.inicio')} doze={doze} />
      </span>
      <span class="hrot">
        <span class="hrot-t" aria-hidden="true">
          {tx('grupo.terminoOpcional')}
        </span>
        <HoraCampo cls="sf" valor={f.fim || ''} opcional rotulo={tx('grupo.termino')} doze={doze} />
      </span>
      <button class="btn sm ghost danger" data-a="rmSched" aria-label={tx('grupo.removerDia')}>
        ✕
      </button>
      <input class="inp sl" defaultValue={f.place || ''} maxLength={200} placeholder={tx('grupo.localOpcional')} />
    </div>
  );
}

function GrupoForm({ g, editing }: { g: Grupo; editing: boolean }) {
  const c = g.cfg || {},
    fx = c.fixos || [];
  const [fq, setFq] = useState<string>(editing ? freq(g) : 'fixo');
  const [sp, setSp] = useState<string>(g.sport || 'futebol');
  const [pt, setPt] = useState<string>(String(c.porTime || porTimePadrao(g.sport || 'futebol')));
  const [linhas, setLinhas] = useState<Linha[]>(() => (fx.length ? fx : [null]).map((x, k) => ({ k, x })));
  const [reg, setReg] = useState<Regiao>(() => regiaoInicial(g, editing));
  const prox = useRef(linhas.length),
    caixa = useRef<HTMLDivElement>(null),
    focar = useRef(false);
  // Relógio e semana do país escolhido no formulário, mesmo antes de salvar (KAN-186).
  const p = paisPor(reg.pais),
    doze = relogio12((p && p.formato) || 'pt-BR'),
    dias = ordemDias(reg.pais),
    paises = useMemo(listaPais, []);

  aberto = {
    freq: setFq,
    esporte: v => {
      // Jogadores por time (pelada-v16): vem do esporte; se a pessoa não mexeu, acompanha o esporte novo.
      if (+pt === porTimePadrao(sp)) setPt(String(porTimePadrao(v)));
      setSp(v);
    },
    /* Outro dia: parte do último (dois dias depois, mesmo horário e local). */
    maisDia: () => {
      const rows = caixa.current ? [...caixa.current.querySelectorAll<HTMLElement>('#sched .srow')] : [],
        last = rows[rows.length - 1],
        v = (s: string) => (last.querySelector(s) as HTMLInputElement).value;
      const x = last ? { dow: (+v('.sd') + 2) % 7, ini: v('.si'), fim: v('.sf'), place: v('.sl') } : null;
      focar.current = true;
      setLinhas(l => l.concat({ k: prox.current++, x }));
    },
    menosDia: el => {
      if (linhas.length <= 1) {
        toast(tx('grupo.deixeUmDia'));
        return;
      }
      const row = el.closest('.srow'),
        i = [...(caixa.current?.querySelectorAll('#sched .srow') || [])].indexOf(row as Element);
      if (i >= 0) setLinhas(l => l.filter((_, j) => j !== i));
    },
  };
  useEffect(() => {
    if (!focar.current) return;
    focar.current = false;
    const s = caixa.current?.querySelectorAll<HTMLElement>('#sched .srow .sd');
    s && s.length && s[s.length - 1].focus();
  }, [linhas.length]);
  useEffect(
    () => () => {
      aberto = null;
    },
    []
  );

  const trocarPais = (iso: string) => {
    // Trocou o país: moeda e fuso voltam aos do país novo (a pessoa ainda pode mudar cada um).
    const r = regiaoNova(iso, fusoAparelho());
    // KAN-186: os dias fixos já digitados são montados de novo no relógio e na semana do país novo, sem perder nada.
    const de = (row: Element, s: string) => (row.querySelector(s) as HTMLInputElement).value;
    const rows = caixa.current ? [...caixa.current.querySelectorAll('#sched .srow')] : [];
    if (rows.length)
      setLinhas(
        rows.map(row => ({
          k: prox.current++,
          x: {
            id: (row as HTMLElement).dataset.id || '',
            dow: +de(row, '.sd'),
            ini: de(row, '.si'),
            fim: de(row, '.sf'),
            place: de(row, '.sl'),
          },
        }))
      );
    setReg({ pais: r.pais, moeda: r.moeda, fuso: r.fuso });
  };
  const fusos = listaFuso(reg.pais, reg.fuso);

  return (
    <div id="ngBox" ref={caixa} data-sp={sp} data-freq={fq}>
      <label class="f">
        <span>{tx('grupo.nome')}</span>
        <input class="inp" id="ngn" maxLength={40} defaultValue={g.name || ''} placeholder={tx('grupo.nomeExemplo')} />
      </label>
      <div class="err" id="ngErr" style="margin-top:-8px"></div>
      <div class="f">
        <span class="lbl">{tx('grupo.frequencia')}</span>
        <span class="seg" style="display:flex">
          <button style="flex:1" data-a="pickFreq" data-v="fixo" aria-pressed={fq === 'fixo'}>
            {tx('grupo.frequente')}
          </button>
          <button style="flex:1" data-a="pickFreq" data-v="esporadico" aria-pressed={fq === 'esporadico'}>
            {tx('grupo.esporadico')}
          </button>
        </span>
        <p class="small muted" id="fqHelp" style="margin:6px 0 0">
          {tx(fq === 'fixo' ? 'grupo.frequenteAjuda' : 'grupo.esporadicoAjuda')}
        </p>
      </div>
      <div id="schedW" hidden={fq !== 'fixo'}>
        <span class="lbl">{tx('grupo.diasHorarios')}</span>
        <div id="sched">
          {linhas.map(l => (
            <LinhaDia key={l.k} x={l.x} doze={doze} dias={dias} />
          ))}
        </div>
        <button class="btn sm" data-a="addSched" style="margin:4px 0 12px">
          {tx('grupo.outroDia')}
        </button>
      </div>
      <div class="f">
        <span class="lbl">{tx('grupo.esporte')}</span>
        <div class="sgrid">
          {Object.entries(esportes).map(([k, v]) => (
            <button key={k} class="opt" aria-pressed={k === sp} data-a="pickSport" data-v={k}>
              <span class="gem sm">{v.e}</span>
              {v.n}
            </button>
          ))}
        </div>
      </div>
      <label class="f" id="ngoW" hidden={sp !== 'outro'}>
        <span>{tx('grupo.qualEsporte')}</span>
        <input
          class="inp"
          id="ngo"
          maxLength={30}
          defaultValue={g.sportName || ''}
          placeholder={tx('grupo.qualEsporteExemplo')}
        />
      </label>
      <label class="f">
        <span>{tx('grupo.porTime')}</span>
        <input
          class="inp"
          id="ngt"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={pt}
          onInput={e => setPt((e.currentTarget as HTMLInputElement).value)}
          style="max-width:120px"
        />
      </label>
      <p class="small muted" id="ngtHelp" style="margin-top:-6px">
        {porTimeAjuda(sp)}
      </p>
      {editing && (
        <p class="small muted" style="margin-top:-6px">
          {tx('grupo.mudarEsporte')}
        </p>
      )}
      <div class="f" id="ngReg">
        <span class="lbl">{tx('regiao.titulo')}</span>
        <div class="reg-campos">
          <label class="f">
            <span>{tx('regiao.pais')}</span>
            <select
              class="sel"
              id="ngp"
              value={reg.pais}
              onChange={e => trocarPais((e.currentTarget as HTMLSelectElement).value)}
            >
              {paises.map(o => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </select>
          </label>
          <label class="f">
            <span>{tx('regiao.moeda')}</span>
            <select
              class="sel"
              id="ngm"
              value={reg.moeda}
              onChange={e => setReg({ ...reg, moeda: (e.currentTarget as HTMLSelectElement).value })}
            >
              {listaMoeda(reg.moeda).map(o => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </select>
          </label>
          <label class="f" id="ngzW" hidden={!(p && p.fusos.length > 1)}>
            <span>{tx('regiao.fuso')}</span>
            <select
              class="sel"
              id="ngz"
              value={reg.fuso || (fusos[0] && fusos[0].v)}
              onChange={e => setReg({ ...reg, fuso: (e.currentTarget as HTMLSelectElement).value })}
            >
              {fusos.map(o => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p class="small muted" style="margin-top:-6px">
          {tx('regiao.grupoAjuda')}
        </p>
      </div>
    </div>
  );
}

/* Monta o formulário dentro do diálogo já aberto (lugar: #ngRaiz). */
function montarGrupoForm(g: Grupo, editing: boolean) {
  const el = document.getElementById('ngRaiz');
  if (el) render(<GrupoForm g={g} editing={editing} />, el);
}
const formAberto = () => aberto;

/* Lê e confere o formulário. Devolve null (com o aviso na tela) quando falta algo. */
function readGroupForm(except: string | null) {
  const box = $('#ngBox') as HTMLElement,
    err = $('#ngErr') as HTMLElement;
  err.textContent = '';
  const name = val('ngn'),
    sp = box.dataset.sp!,
    fq = box.dataset.freq!,
    spn = sp === 'outro' ? val('ngo') : '';
  const erro = (t: string, foco?: string) => {
    if (foco === 'ngn') err.textContent = t;
    else toast(t);
    if (foco) ($('#' + foco) as HTMLElement).focus();
    return null;
  };
  if (name.length < 2) return erro(tx('grupo.semNome'), 'ngn');
  if (dupName(name, except)) return erro(tx('grupo.nomeRepetido'), 'ngn');
  if (sp === 'outro' && spn.length < 2) return erro(tx('grupo.semEsporte'), 'ngo');
  const pt = +val('ngt');
  if (!(pt >= 1 && pt <= 30 && Number.isInteger(pt))) return erro(tx('grupo.porTimeInvalido'), 'ngt');
  let fixos: Fixo[] = [];
  if (fq === 'fixo') {
    const de = (r: Element, s: string) => (r.querySelector(s) as HTMLInputElement).value;
    fixos = [...box.querySelectorAll('.srow')].map(r => ({
      id: (r as HTMLElement).dataset.id || uid(),
      dow: +de(r, '.sd'),
      ini: de(r, '.si'),
      fim: de(r, '.sf'),
      place: de(r, '.sl').trim(),
    }));
    if (!fixos.length || fixos.some(x => !x.ini)) return erro(tx('grupo.semInicio'));
    const vistos = new Set<string>();
    for (const x of fixos) {
      const k = x.dow + '|' + x.ini;
      if (vistos.has(k)) return erro(tx('grupo.horarioRepetido'));
      vistos.add(k);
    }
  }
  const pais = val('ngp') || 'BR',
    regiao = {
      pais,
      moeda: val('ngm') || 'BRL',
      fuso: val('ngz') || '',
      formato: (paisPor(pais) && paisPor(pais)!.formato) || 'pt-BR',
    };
  return { name, sport: sp, sportName: spn, freq: fq, fixos, porTime: pt, regiao };
}

export { formAberto, montarGrupoForm, readGroupForm };
