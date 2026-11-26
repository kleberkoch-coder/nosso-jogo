/* Uso real do app por dia (KAN-313, pelada-v132), para comparar com o App Check (KAN-88). Cada login (inclusive o
   anônimo do link) grava uso/{dia}_{login}: onde usou (link, votação, avaliação, gestão, início), os grupos, se tem
   conta e quantos pedidos ao banco a página fez (nucleo/backend.js, USO; aproximado). Nada pessoal.
   - A 1ª gravação do dia sai alguns segundos depois de abrir; as outras só ao sair da página ou ir para o segundo plano,
     se algo mudou, no máximo uma a cada 2 minutos. Os pedidos são somados (op.somar), sem ler antes.
   - Só o portal lê (painel "Uso do app"); as regras conferem que cada login só grava o próprio registro do dia.
   - Nunca atrapalha o app: tudo aqui ignora os próprios erros. */
import * as backend from './backend.js';
import { S } from './estado';
import { today } from './util.js';

declare const __VERSAO__: string;
const VERSAO = typeof __VERSAO__ !== 'undefined' ? __VERSAO__ : 'dev';
const ONDE: Record<string, string> = { r: 'link', v: 'voto', a: 'aval', admin: 'gestao', home: 'inicio' };
const onde = new Set<string>(),
  grupos = new Set<string>();
let enviado = { n: 0, e: 0 },
  ultima = 0,
  sinalEnviado = '';
const w = window as unknown as { __njUsoEspera?: number; __njUsoIntervalo?: number };

function anotar() {
  const r = S.route && S.route.n;
  if (r) onde.add(ONDE[r] || 'outro');
  if (S.gid && grupos.size < 20) grupos.add(String(S.gid).slice(0, 64));
}

export function gravarUso(saindo: boolean) {
  try {
    const b = (backend as any).B,
      u = S.user as { uid?: string; anon?: boolean } | null,
      c = (backend as any).USO as { n: number; e: number };
    if (!b || !u || !u.uid) return;
    anotar();
    const dia = Math.floor(Date.now() / 864e5),
      marca = dia + '_' + u.uid,
      sinal = [...onde].join() + '|' + [...grupos].join(),
      dn = c.n - enviado.n;
    let feito = '';
    try {
      feito = localStorage.getItem('nj-uso') || '';
    } catch {}
    if (feito === marca) {
      if (!saindo || (!dn && sinal === sinalEnviado)) return;
      if (Date.now() - ultima < (w.__njUsoIntervalo ?? 120000)) return;
    }
    const op = (backend as any).op;
    b.patch('uso/' + marca, {
      dia,
      d: today(),
      onde: op.uniao([...onde]),
      grupos: op.uniao([...grupos]),
      conta: !u.anon,
      n: op.somar(dn),
      e: op.somar(c.e - enviado.e),
      v: VERSAO,
      em: op.agora(),
    }).catch(() => {});
    enviado = { n: c.n, e: c.e };
    ultima = Date.now();
    sinalEnviado = sinal;
    try {
      localStorage.setItem('nj-uso', marca);
    } catch {}
  } catch {
    /* o registro de uso nunca atrapalha o app */
  }
}

export function ligarUso() {
  /* Trocar de tela anota onde usou; depois de entrar na conta (sem recarregar), grava o registro do dia da conta. */
  addEventListener('hashchange', () => setTimeout(() => gravarUso(false), 1500));
  addEventListener('pagehide', () => gravarUso(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && gravarUso(true));
  /* A 1ª do dia: alguns segundos depois de abrir, e de novo a cada minuto (o login pode chegar depois, ou o dia virar). */
  setTimeout(() => {
    gravarUso(false);
    setInterval(() => gravarUso(false), 60000);
  }, w.__njUsoEspera ?? 8000);
}
