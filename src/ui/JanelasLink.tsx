/* Janelas do link do jogador (KAN-218, v84): "Adicionar meu nome", "Instalar no celular" e, desde a pelada-v107,
   "Pôr na agenda" (KAN-124). Componentes; antes eram montadas como texto (acoes/publico.ts e pwa.js).
   KAN-262 (pelada-v106): parte sob demanda, com os próprios textos. O link abre sem ela; o service worker a guarda na
   primeira visita (PARTES_LINK em site/sw.js), para abrir também sem internet. */
import { nomeArquivo, textoAgenda } from '../dominio/agenda';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-janelaslink';
import { toast } from '../nucleo/util.js';
import { closeDlg, openDlg } from './dialogos.js';
import { CampoPosicao, ComNegrito } from './componentes';

juntarTextos(textos);

export function janelaMeuNome(nome: string) {
  openDlg(
    <>
      <h3>{tx('publico.addTitulo')}</h3>
      <label class="f">
        <span>{tx('publico.addNome')}</span>
        <input class="inp" id="anm" maxLength={40} autocomplete="off" value={nome} />
      </label>
      <div id="avsug"></div>
      <div id="avnew">
        <CampoPosicao id="apos" />
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="pubSaveAdd">
          {tx('publico.addConfirmar')}
        </button>
      </div>
    </>
  );
}

export function janelaInstalar(ios: boolean) {
  const passos = ios ? ['pwa.ios1', 'pwa.ios2', 'pwa.ios3'] : ['pwa.and1', 'pwa.and2'];
  openDlg(
    <>
      <h3>{tx('pwa.titulo')}</h3>
      <ol class="small" style="padding-left:18px;line-height:1.8">
        {passos.map(k => (
          <li key={k}>
            <ComNegrito texto={tx(k)} />
          </li>
        ))}
      </ol>
      <p class="small muted">{tx('pwa.icone')}</p>
      <div class="dlg-f">
        <button class="btn primary" data-a="close">
          {tx('comum.entendi')}
        </button>
      </div>
    </>
  );
}

/* KAN-124 (pelada-v107): o que o link passa para montar o evento (acoes/publico.ts: dadosAgenda). */
export type Agenda = {
  r: { id: string; date: string; time?: string; fim?: string; place?: string };
  grupo: string;
  esporte: string;
  fuso: string;
  gid: string;
  semanal: boolean;
  dia: string;
  dow: number;
  hora: string;
  linkRodada: string;
  linkGrupo: string;
};

/* Em grupo com dias fixos, pergunta "Só esta rodada" ou "Toda semana"; nos outros, baixa direto. */
export function janelaAgenda(d: Agenda) {
  if (!d.semanal) return baixarAgenda(d, false);
  openDlg(
    <>
      <h3>{tx('agenda.titulo')}</h3>
      <div class="vgrid" id="agOpcoes">
        <button class="opt" data-a="pubAgendaGerar" data-v="uma">
          {tx('agenda.so', { dia: d.dia })}
        </button>
        <button class="opt" data-a="pubAgendaGerar" data-v="semana">
          {tx('agenda.semana', { dias: tx('agenda.dias.' + d.dow), hora: d.hora })}
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

/* Monta o arquivo no aparelho (sem servidor e sem internet) e entrega ao celular, que abre a agenda. */
export function baixarAgenda(d: Agenda, semanal: boolean) {
  closeDlg();
  const link = semanal ? d.linkGrupo : d.linkRodada,
    r = d.r;
  try {
    const texto = textoAgenda({
      titulo: tx('agenda.evento', { esporte: d.esporte, grupo: d.grupo }),
      descricao: tx('agenda.descricao', { link }),
      link,
      data: r.date,
      ini: r.time,
      fim: r.fim,
      local: r.place,
      fuso: d.fuso,
      semanal,
      uid: d.gid + '-' + (semanal ? 'semana-' + d.dow + '-' + (r.time || '') : r.id) + '@nosso-jogo',
      agora: new Date(),
    });
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/calendar;charset=utf-8' })),
      a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo(r.date, semanal);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(tx('agenda.pronto'));
  } catch (e) {
    toast(tx('agenda.erro'), 6000);
  }
}
