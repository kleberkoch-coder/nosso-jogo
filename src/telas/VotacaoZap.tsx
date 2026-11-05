/* KAN-231: resultado da votação no WhatsApp (os mais votados de cada categoria) e, se o administrador quiser,
   quem votou em quem, com aviso para mandar só ao grupo dos administradores. E a planilha de "Quem votou".
   Vem com a aba Votação. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { pname } from '../dominio/grupo.js';
import { auditoria, tally, type Categoria, type LinhaAuditoria } from '../dominio/votacao';
import { emCsv, linhasDaPlanilha, maisVotados } from '../dominio/votacao-resultado';
import { FORMATO, FUSO, LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { Compartilhar } from '../ui/Compartilhar';
import { dlg, openDlg } from '../ui/dialogos.js';

type Votacao = { title: string; rid: string; open?: boolean; cats: Categoria[]; resultado?: Record<string, any> };
type Votos = Record<string, { pid?: string; v?: Record<string, string>; t?: number } | null>;

export function textoResultado(v: Votacao, votos: Votos, comDetalhe: boolean): string {
  const res = v.resultado || tally(v, votos);
  let t = `🗳️ *${v.title}*\n`;
  v.cats.forEach(c => {
    const top = maisVotados(res[c.id], pname, 3, LOCAL);
    t +=
      `\n🏅 *${c.name}*: ` +
      (top.length
        ? top.map(([p, n]) => tx('votzap.nomeVotos', { nome: pname(p), n })).join(' · ')
        : tx('votacao.semVotosCurto'));
  });
  if (comDetalhe) {
    const linhas = auditoria(votos, {}).sort((a, b) => pname(a.pid).localeCompare(pname(b.pid), LOCAL));
    t += `\n\n👀 *${tx('votzap.quemEmQuem')}*`;
    linhas.forEach(l => {
      const escolhas = v.cats
        .filter(c => l.v[c.id])
        .map(c => tx('aud.escolha', { cat: c.name, nome: pname(l.v[c.id]!) }));
      if (escolhas.length) t += `\n• ${pname(l.pid)}: ${escolhas.join('; ')}`;
    });
  }
  return t;
}

function ResultadoZap({ v, votos }: { v: Votacao; votos: Votos }) {
  const [detalhe, setDetalhe] = useState(false);
  const opcoes = (
    <>
      <label class="chk-linha">
        <input
          type="checkbox"
          id="votDetalhe"
          checked={detalhe}
          onChange={e => setDetalhe((e.currentTarget as HTMLInputElement).checked)}
        />
        <span>{tx('votzap.incluir')}</span>
      </label>
      {detalhe ? (
        <p class="aviso-alerta small" id="votAviso" role="note">
          ⚠️ {tx('votzap.aviso')}
        </p>
      ) : null}
    </>
  );
  return (
    <Compartilhar titulo={tx('votacao.mandarResultado')} texto={textoResultado(v, votos, detalhe)} opcoes={opcoes} />
  );
}

export function mandarResultado(v: Votacao, votos: Votos) {
  openDlg('votZapRaiz');
  dlg.setAttribute('aria-labelledby', 'shTitulo');
  const el = document.getElementById('votZapRaiz');
  if (el) render(<ResultadoZap v={v} votos={votos} />, el);
}

/* Planilha (CSV, que abre no Excel e no Google Planilhas): com vírgula decimal, separador ";"; senão, ",". */
export function baixarPlanilha(v: Votacao, linhas: LinhaAuditoria[]) {
  const quando = (ms: number) =>
      new Date(ms).toLocaleString(FORMATO, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: FUSO,
      }),
    rows = linhasDaPlanilha(
      linhas,
      v.cats,
      pname,
      {
        quem: tx('votzap.colQuem'),
        hora: tx('votzap.colHora'),
        trocas: tx('votzap.colTrocas'),
        repetido: tx('aud.repetido'),
      },
      quando
    ),
    sep = (1.5).toLocaleString(FORMATO).includes(',') ? ';' : ',',
    blob = new Blob(['﻿' + emCsv(rows, sep)], { type: 'text/csv;charset=utf-8' }),
    a = document.createElement('a'),
    nome = (v.title || tx('votacao.semTitulo')).replace(/[\\/:*?"<>|]+/g, ' ').trim();
  a.href = URL.createObjectURL(blob);
  a.download = nome + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
