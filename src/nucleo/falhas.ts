/* Coletor de falhas no uso (KAN-239, 1ª parte, pelada-v105). Grava em falhas/{id}, que só o portal lê:
   - "appcheck": o comprovante do App Check não veio (backend.js avisa com o evento nj-appcheck-falhou), para achar o
     aparelho dos picos de "solicitações inválidas" (KAN-88);
   - "erro": erro de código (window.onerror e promessas recusadas sem tratamento);
   - "gravacao": o Firebase recusou uma gravação (evento nj-gravacao-falhou, de nucleo/estado.ts).
   Leva os dados de navegação (dominio/falhas.ts) e a tela, nunca dados pessoais. A mesma falha na mesma visita vira um
   registro só, com a contagem; no máximo 20 por aparelho por dia. Nunca atrapalha o app: tudo aqui ignora os próprios
   erros. Sem sinal, a gravação fica na fila do Firebase e sobe quando a conexão volta.
   Aqui fica só o mínimo (ouvir e juntar); a montagem do registro baixa na primeira falha, para o link continuar leve. */
import * as backend from './backend.js';
import { S } from './estado';
import { today } from './util.js';

type Tipo = 'appcheck' | 'erro' | 'gravacao';
/* A versão vem direto da montagem (como em nucleo/versao.js): importar aquele arquivo daqui o separaria num pedaço a
   mais, que o link baixaria à toa. */
declare const __VERSAO__: string;
const VERSAO = typeof __VERSAO__ !== 'undefined' ? __VERSAO__ : 'dev';
const vistas = new Map<string, number>();

export function registrarFalha(t: Tipo, mensagem: unknown, pilha?: unknown) {
  try {
    const m = String(mensagem == null ? '' : mensagem).slice(0, 400),
      k = t + '|' + m;
    if (vistas.has(k)) return void vistas.set(k, vistas.get(k)! + 1);
    vistas.set(k, 1);
    const r = String((S.route && S.route.n) || ''),
      g = S.gid;
    setTimeout(
      () =>
        import('../dominio/falhas')
          .then(d => {
            const b = (backend as any).B;
            if (!b || !S.user) return;
            const o = d.registro(
              t,
              m,
              pilha,
              vistas.get(k) || 1,
              { v: VERSAO, r, g, hoje: today() },
              (backend as any).op.agora()
            );
            if (o && d.cabeNoAparelho(today())) return b.patch('falhas/' + b.newId(), o);
          })
          .catch(() => {}),
      3000
    );
  } catch {
    /* o coletor nunca atrapalha o app */
  }
}

let ligado = false;
export function ligarColetor() {
  if (ligado) return;
  ligado = true;
  addEventListener('error', e => {
    const ev = e as ErrorEvent;
    if (ev.message) registrarFalha('erro', ev.message, (ev.error && ev.error.stack) || ev.filename + ':' + ev.lineno);
  });
  addEventListener('unhandledrejection', e => {
    const r = (e as PromiseRejectionEvent).reason;
    registrarFalha('erro', (r && (r.code || r.message)) || String(r), r && r.stack);
  });
  document.addEventListener('nj-gravacao-falhou', e => registrarFalha('gravacao', (e as CustomEvent).detail || '?'));
  document.addEventListener('nj-appcheck-falhou', e => registrarFalha('appcheck', (e as CustomEvent).detail || '?'));
}
