/* Vigia da conexão (KAN-276 e KAN-277, pelada-v120): a regra fica em dominio/conexao.ts.
   - backend.js avisa nj-appcheck-falhou (sem comprovante) e nj-appcheck-ok (comprovante bom) e atende o pedido de
     comprovante novo (evento nj-pedir-comprovante); no modo demonstração não há App Check, e os testes disparam os eventos;
   - quando a internet volta ou a aba volta a aparecer, pede um comprovante novo; enquanto estiver sem, tenta de novo a
     cada 30 s; passado o limite, mostra o aviso com Recarregar;
   - se a cópia local do banco quebrar (Safari do iPhone), mostra o aviso na hora;
   - quando o comprovante volta sozinho, registra "appCheck/recuperou" no coletor de falhas, para medir a correção.
   Recarregar espera até 4 s o que estiver por enviar ao banco antes de recarregar. */
import { erroDoBancoLocal, LIMITE_RECUSA_MS, mostrarAviso, pedirAoVoltar } from '../dominio/conexao';
import { tx } from '../i18n/index.js';
import * as backend from './backend.js';
import { registrarFalha } from './falhas';

type Motivo = '' | 'appcheck' | 'banco';
type Janela = Window & { __njConexaoLimite?: number; __njConexaoIntervalo?: number };
const W = window as Janela;

const pedir = (forcar: boolean) => document.dispatchEvent(new CustomEvent('nj-pedir-comprovante', { detail: forcar }));

let falhaDesde: number | null = null,
  escondidaDesde: number | null = null,
  motivo: Motivo = '';
const limite = () => Number(W.__njConexaoLimite) || LIMITE_RECUSA_MS;
const visivel = () => document.visibilityState !== 'hidden';

function mostrar(m: Exclude<Motivo, ''>) {
  if (motivo === 'banco') return; // o aviso do banco local vale mais (recarregar resolve os dois)
  motivo = m;
  const el = document.getElementById('recon'),
    b = document.getElementById('reconBtn');
  if (!el || !b) return;
  el.firstElementChild!.textContent = tx('conexao.' + m);
  b.textContent = tx('conexao.recarregar');
  b.onclick = () => {
    const bk = backend as any;
    bk.setBusy(b, true);
    Promise.resolve(bk.B && bk.B.semPendencias(4000))
      .catch(() => {})
      .then(() => location.reload());
  };
  el.hidden = false;
}
function esconder() {
  if (motivo !== 'appcheck') return;
  motivo = '';
  const el = document.getElementById('recon');
  if (el) el.hidden = true;
}
function conferir() {
  if (mostrarAviso(falhaDesde, Date.now(), visivel(), navigator.onLine, limite())) mostrar('appcheck');
}

let ligado = false;
export function ligarVigia() {
  if (ligado) return;
  ligado = true;
  document.addEventListener('nj-appcheck-falhou', () => {
    if (falhaDesde == null) falhaDesde = Date.now();
    conferir();
  });
  document.addEventListener('nj-appcheck-ok', () => {
    if (falhaDesde == null) return;
    falhaDesde = null;
    registrarFalha('appcheck', 'appCheck/recuperou');
    esconder();
  });
  addEventListener('online', () => pedir(true));
  document.addEventListener('visibilitychange', () => {
    const agora = Date.now();
    if (!visivel()) {
      escondidaDesde = agora;
      return;
    }
    if (pedirAoVoltar(escondidaDesde, agora, falhaDesde != null)) pedir(true);
    escondidaDesde = null;
    conferir();
  });
  setInterval(
    () => {
      if (falhaDesde == null) return;
      pedir(false);
      conferir();
    },
    Number(W.__njConexaoIntervalo) || 30000
  );
  const banco = (m: unknown) => {
    if (erroDoBancoLocal(m)) mostrar('banco');
  };
  addEventListener('error', e => banco((e as ErrorEvent).message));
  addEventListener('unhandledrejection', e => {
    const r = (e as PromiseRejectionEvent).reason;
    banco((r && (r.message || r.code)) || String(r));
  });
}
