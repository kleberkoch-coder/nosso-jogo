/* Janela "Avisos no celular" (KAN-242, pelada-v116), aberta pelo menu da conta. Baixa só quando aberta
   (acoes/avisos.ts). Cada administrador liga os avisos no próprio celular e escolhe os grupos; o horário do aviso de
   "faltam pessoas" vale para o grupo todo (qualquer administrador muda). Os avisos saem do servidor (funcoes/).
   Estados: iPhone sem o app instalado, navegador sem suporte, permissão bloqueada, desligado e ligado. */
import { render } from 'preact';
import { temMinimo } from '../dominio/avisos';
import estilo from '../estilos/avisos.css' with { type: 'text' };
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-avisos';
import * as banco from '../nucleo/backend.js';
import * as aparelho from '../nucleo/avisos-aparelho';
import { S } from '../nucleo/estado.js';
import { $, toast } from '../nucleo/util.js';
import { closeDlg, dlg, openDlg } from './dialogos.js';
import { usarEstilo } from './estilo';

juntarTextos(textos);
usarEstilo('avisos', estilo);

type Obj = Record<string, any>;
type El = HTMLElement & { dataset: DOMStringMap };
const st = (): Obj => S as Obj;
/* O banco é trocado ao iniciar (setB): lido na hora. */
const bk = (): Obj => (banco as Obj).B;
const w = window as unknown as Obj;
const HORAS = [1, 2, 3, 4, 6, 8, 12, 24];

type Grupo = { gid: string; nome: string; ligado: boolean; horas: number; minimo: boolean };
let grupos: Grupo[] | null = null;
let est: aparelho.Estado = 'desligado';

const uid = () => (st().user && st().user.uid) || '';
const meusGrupos = () =>
  Object.entries((st().me && st().me.grupos) || {})
    .filter(([, g]) => (g as Obj).ativo !== false)
    .map(([gid, g]) => ({ gid, nome: String((g as Obj).name || gid) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

async function lerGrupos(): Promise<Grupo[]> {
  const B = bk();
  const u = uid();
  return Promise.all(
    meusGrupos().map(async ({ gid, nome }) => {
      const [pref, priv, g] = await Promise.all([
        B.get('avisos/' + gid + '_' + u).catch(() => null),
        B.get('grupos/' + gid + '/privado/avisos').catch(() => null),
        B.get('grupos/' + gid).catch(() => null),
      ]);
      return {
        gid,
        nome: (g && g.name) || nome,
        ligado: !!(pref && pref.ligado),
        horas: (priv && priv.horas) || 3,
        minimo: temMinimo(g && g.cfg && g.cfg.minPos),
      };
    })
  );
}

function Grupos() {
  if (!grupos) return <p class="muted small">{tx('comum.carregando')}</p>;
  if (!grupos.length) return <p class="muted small">{tx('av.semGrupos')}</p>;
  return (
    <ul class="av-grupos" id="avGrupos">
      {grupos.map(g => (
        <li key={g.gid} class="av-grupo" data-gid={g.gid}>
          <button
            class="av-liga"
            role="switch"
            aria-checked={g.ligado ? 'true' : 'false'}
            data-a="avisosGrupo"
            data-v={g.gid}
          >
            <span class="av-nome">{g.nome}</span>
            <span class={'av-estado' + (g.ligado ? ' on' : '')}>{tx(g.ligado ? 'av.on' : 'av.off')}</span>
          </button>
          {g.ligado ? (
            g.minimo ? (
              <label class="av-horas">
                <span class="small muted">{tx('av.horas')}</span>
                <select class="sel" data-gid={g.gid} aria-label={tx('av.horas') + ' — ' + g.nome}>
                  {HORAS.map(h => (
                    <option key={h} value={h} selected={h === g.horas}>
                      {tx('av.horasN', { n: h })}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p class="small muted av-semmin">
                {tx('av.semMinimo')}{' '}
                <button class="linkbtn" data-a="avisosMinimo" data-v={g.gid}>
                  {tx('av.definirMinimo')}
                </button>
              </p>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Janela() {
  const demo = !(w.FIREBASE_CONFIG && w.FIREBASE_CONFIG.apiKey);
  return (
    <div class="av" id="avisosJanela" data-estado={est}>
      <h3 id="avisosTitulo">{tx('av.titulo')}</h3>
      <p class="small muted">{tx('av.ajuda')}</p>
      {demo ? <p class="small muted">{tx('av.demo')}</p> : null}
      {est === 'instalarIphone' ? (
        <>
          <p class="warn-alt" role="status">
            {tx('av.instalarIphone')}
          </p>
          <button class="btn" data-a="avisosInstalar">
            {tx('av.comoInstalar')}
          </button>
        </>
      ) : est === 'semSuporte' ? (
        <p class="warn-alt" role="status">
          {tx('av.semSuporte')}
        </p>
      ) : est === 'negado' ? (
        <p class="warn-alt" role="status">
          {tx('av.negado')}
        </p>
      ) : est === 'desligado' ? (
        <>
          <button class="btn primary av-ligar" id="avLigar" data-a="avisosLigar" data-foco>
            {tx('av.ligar')}
          </button>
          <p class="small muted">{tx('av.ligarAjuda')}</p>
        </>
      ) : (
        <>
          <p class="small">{tx('av.ligado')}</p>
          <Grupos />
        </>
      )}
      <div class="dlg-f">
        {est === 'ligado' ? (
          <button class="btn ghost" data-a="avisosDesligar" id="avDesligar">
            {tx('av.desligar')}
          </button>
        ) : null}
        <button class="btn" data-a="close">
          {tx('av.fechar')}
        </button>
      </div>
    </div>
  );
}

const desenhar = () => {
  const raiz = $('#avisosRaiz');
  if (raiz) render(<Janela />, raiz);
};

async function carregarGrupos() {
  grupos = null;
  desenhar();
  grupos = await lerGrupos();
  desenhar();
}

export function abrir() {
  est = aparelho.estado();
  openDlg('avisosRaiz');
  dlg.setAttribute('aria-labelledby', 'avisosTitulo');
  desenhar();
  if (est === 'ligado') carregarGrupos();
}

/* Horário do aviso de "faltam pessoas": grava na hora que escolhe (o grupo todo). */
document.addEventListener('change', e => {
  const s = e.target as HTMLSelectElement;
  if (!s || !s.matches || !s.matches('#avGrupos select[data-gid]')) return;
  const gid = s.dataset.gid!,
    horas = +s.value,
    B = bk();
  B.set('grupos/' + gid + '/privado/avisos', { horas })
    .then(() => {
      const g = (grupos || []).find(x => x.gid === gid);
      if (g) g.horas = horas;
      toast(tx('av.horasSalvas'));
    })
    .catch(() => toast(tx('av.naoLigou')));
});

async function gravarGrupo(gid: string, ligado: boolean) {
  const B = bk();
  await B.set('avisos/' + gid + '_' + uid(), { gid, uid: uid(), ligado, em: Date.now() });
  const g = (grupos || []).find(x => x.gid === gid);
  if (g) g.ligado = ligado;
}

export const acoes: Record<string, (el: El) => unknown> = {
  avisosDlg: () => abrir(),
  avisosInstalar: () => {
    closeDlg();
    ($('#installBtn') as HTMLElement | null)?.click();
  },
  avisosLigar: async () => {
    try {
      est = await aparelho.ligar();
    } catch (e) {
      console.warn('avisos: ligar', e);
      toast(tx('av.naoLigou'));
      return;
    }
    if (est === 'ligado') {
      /* Na primeira vez, todos os grupos vêm ligados (dá para desmarcar). */
      grupos = await lerGrupos();
      await Promise.all(grupos.filter(g => !g.ligado).map(g => gravarGrupo(g.gid, true).catch(() => {})));
      toast(tx('av.pronto'));
    }
    desenhar();
  },
  avisosDesligar: async () => {
    await aparelho.desligar();
    est = aparelho.estado();
    toast(tx('av.desligado'));
    desenhar();
  },
  avisosGrupo: async el => {
    const liga = el.getAttribute('aria-checked') !== 'true';
    try {
      await gravarGrupo(el.dataset.v!, liga);
    } catch (e) {
      toast(tx('av.naoLigou'));
    }
    desenhar();
  },
  avisosMinimo: el => {
    closeDlg();
    st().tab = 'rodada';
    location.hash = '#/g/' + el.dataset.v;
    toast(tx('av.minimoAqui'), 6000);
  },
};
