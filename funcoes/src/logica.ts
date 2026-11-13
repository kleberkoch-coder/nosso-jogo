/* Avisos no celular (KAN-242, pelada-v116): o que as funções do servidor fazem, sem depender da biblioteca do
   Firebase (o banco e o envio chegam de fora). Assim a mesma lógica roda nas funções (index.ts), no emulador e nos
   testes (testes/funcoes). As regras do que avisar e os textos ficam em src/dominio/avisos.ts.

   Onde fica cada coisa no banco:
   - avisos/{gid}_{uid}: o administrador uid quer os avisos do grupo gid (ligado: sim ou não). Cada um liga para si.
   - usuarios/{uid}/aparelhos/{id}: cada celular que recebe avisos (token do Firebase Cloud Messaging e idioma).
   - grupos/{gid}/privado/avisos: horas antes do jogo para o aviso de "faltam pessoas" (o grupo todo).
   - avisosEnviados/{gid}_{rid}: o aviso de "faltam pessoas" já foi desta rodada (só o servidor lê e grava).
   - falhas/{id}: falhas dos avisos (tipo "aviso"), no mesmo banco de falhas do app, que o Portal mostra: envio recusado
     pelo Firebase, erro na função e teto do mês atingido. Sem nada pessoal: só o grupo, o motivo e quantos.
   - avisosEnviados/_teto: quantos avisos saíram no mês (teto de gasto: passou do limite, para até o mês virar). */
import {
  agoraNoFuso,
  faltaAlgo,
  faltas,
  horasValidas,
  idiomaValido,
  jogosNaJanela,
  linkDaRodada,
  temMinimo,
  textoFalta,
  textoResposta,
  tipoDaResposta,
  type Aviso,
  type Idioma,
  type Presenca,
  type Rodada,
} from '../../src/dominio/avisos.ts';

/* O pedaço do Firestore (biblioteca de administrador) que a lógica usa. */
type Snap = { id: string; exists: boolean; ref: Ref; data(): Record<string, any> | undefined };
type QSnap = { docs: Snap[]; size: number };
type Query = {
  where(campo: string, op: string, valor: unknown): Query;
  get(): Promise<QSnap>;
};
type Ref = {
  id: string;
  get(): Promise<Snap>;
  set(d: Record<string, unknown>, o?: { merge?: boolean }): Promise<unknown>;
  delete(): Promise<unknown>;
  collection(c: string): Query & { doc(id: string): Ref };
};
export type Db = {
  doc(p: string): Ref;
  collection(p: string): Query & { doc(id: string): Ref };
  runTransaction<T>(f: (t: Transacao) => Promise<T>): Promise<T>;
};
type Transacao = { get(r: Ref): Promise<Snap>; set(r: Ref, d: Record<string, unknown>): unknown };

export type Mensagem = Aviso & { token: string; link: string; tag: string; lang: Idioma };
/* Envia e diz, para cada mensagem: 'ok', 'invalido' (o celular desinstalou ou tirou a permissão: o registro é apagado,
   é rotina) ou o código do erro (falha de verdade, que vai para o banco de falhas). */
export type Resultado = 'ok' | 'invalido' | string;
export type Enviar = (ms: Mensagem[]) => Promise<Resultado[]>;

/* Teto de gasto: avisos por mês. O envio do Firebase Cloud Messaging é grátis; o que custa é a função rodar. */
export const LIMITE_MES = 20000;

type Destino = { uid: string; token: string; lang: Idioma; ref: Ref };

/* Celulares dos administradores que ligaram os avisos do grupo e ainda são administradores. */
export async function destinos(db: Db, gid: string): Promise<Destino[]> {
  const q = await db.collection('avisos').where('gid', '==', gid).where('ligado', '==', true).get();
  const out: Destino[] = [];
  for (const d of q.docs) {
    const uid = String((d.data() || {}).uid || '');
    if (!uid || !(await db.doc('grupos/' + gid + '/membros/' + uid).get()).exists) continue;
    const ap = await db.collection('usuarios/' + uid + '/aparelhos').get();
    ap.docs.forEach(a => {
      const x = a.data() || {};
      if (typeof x.token === 'string' && x.token)
        out.push({ uid, token: x.token, lang: idiomaValido(x.lang), ref: a.ref });
    });
  }
  return out;
}

const mesDe = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/* Reserva n avisos no teto do mês; devolve falso se passou do limite. */
export async function cabeNoTeto(db: Db, n: number, agora: number, limite = LIMITE_MES): Promise<boolean> {
  const ref = db.doc('avisosEnviados/_teto'),
    mes = mesDe(agora);
  return db.runTransaction(async t => {
    const d = (await t.get(ref)).data() || {};
    const usados = d.mes === mes ? Number(d.n) || 0 : 0;
    if (usados + n > limite) return false;
    t.set(ref, { mes, n: usados + n });
    return true;
  });
}

/* Registra uma falha dos avisos no banco de falhas (KAN-239), que o Portal mostra junto com as do app. */
export async function registrarFalha(db: Db, m: string, gid: string, n: number, agora = Date.now()): Promise<void> {
  const d = new Date(agora).toISOString().slice(0, 10);
  const id = 'aviso-' + agora.toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const o: Record<string, unknown> = {
    v: 'servidor',
    t: 'aviso',
    m: String(m).replace(/\s+/g, ' ').trim().slice(0, 300),
    r: 'servidor',
    nav: 'servidor',
    so: '',
    disp: 'computador',
    inst: false,
    lang: '',
    n: Math.max(1, Math.min(n, 1000)),
    em: agora,
    d,
  };
  if (gid) o.g = gid.slice(0, 64);
  await db
    .doc('falhas/' + id)
    .set(o)
    .catch(e => console.error('Avisos: não registrou a falha', e));
}

async function mandar(
  db: Db,
  gid: string,
  ds: Destino[],
  fazer: (d: Destino) => Mensagem,
  enviar: Enviar,
  agora: number
) {
  if (!ds.length) return 0;
  if (!(await cabeNoTeto(db, ds.length, agora))) {
    console.warn('Avisos: teto do mês atingido; nada enviado.');
    await registrarFalha(
      db,
      'Teto de ' + LIMITE_MES + ' avisos no mês atingido: avisos parados até o mês virar',
      gid,
      ds.length,
      agora
    );
    return 0;
  }
  const ms = ds.map(fazer);
  const rs = await enviar(ms);
  await Promise.all(ds.map((d, i) => (rs[i] === 'invalido' ? d.ref.delete().catch(() => {}) : null)));
  const erros: Record<string, number> = {};
  rs.forEach(r => {
    if (r !== 'ok' && r !== 'invalido') erros[r] = (erros[r] || 0) + 1;
  });
  for (const [codigo, n] of Object.entries(erros))
    await registrarFalha(db, 'Envio recusado pelo Firebase: ' + codigo, gid, n, agora);
  return rs.filter(r => r === 'ok').length;
}

type Grupo = { name?: string; ativo?: boolean; bloq?: boolean; cfg?: Record<string, any> };
const grupoAtivo = (g: Grupo | undefined) => !!g && g.ativo !== false && !g.bloq;
const dataDoId = (rid: string) => (/^f-(\d{4}-\d{2}-\d{2})-\d{4}$/.exec(rid) || [])[1] || '';

/* Gravação de uma presença: avisa os administradores se foi uma resposta pelo link (quem gravou não é administrador). */
export async function aoResponder(
  db: Db,
  ids: { gid: string; rid: string; pid: string },
  antes: Presenca | null | undefined,
  depois: Presenca | null | undefined,
  enviar: Enviar,
  agora = Date.now()
): Promise<string> {
  const tipo = tipoDaResposta(antes, depois);
  if (!tipo || !depois) return 'sem-mudanca';
  const { gid, rid, pid } = ids;
  if (depois.by && (await db.doc('grupos/' + gid + '/membros/' + depois.by).get()).exists) return 'administrador';
  const g = (await db.doc('grupos/' + gid).get()).data() as Grupo | undefined;
  if (!grupoAtivo(g)) return 'grupo-inativo';
  const ds = await destinos(db, gid);
  if (!ds.length) return 'ninguem';
  const base = 'grupos/' + gid;
  let nome = String(depois.nome || '');
  if (!nome) nome = String(((await db.doc(base + '/jogadores/' + pid).get()).data() || {}).name || '');
  if (!nome) nome = String(((await db.doc(base + '/avulsos/' + pid).get()).data() || {}).nome || '');
  const rod = ((await db.doc(base + '/rodadas/' + rid).get()).data() || {}) as Rodada;
  const date = rod.date || dataDoId(rid);
  const conf = (
    await db
      .collection(base + '/rodadas/' + rid + '/presencas')
      .where('s', '==', 'in')
      .get()
  ).size;
  const formato = (g!.cfg || {}).formato;
  const n = await mandar(
    db,
    gid,
    ds,
    d =>
      Object.assign(textoResposta(tipo, { nome, grupo: g!.name || '', date, confirmados: conf, formato }, d.lang), {
        token: d.token,
        lang: d.lang,
        link: linkDaRodada(gid, rid),
        tag: 'r-' + rid + '-' + pid,
      }),
    enviar,
    agora
  );
  return 'enviados:' + n;
}

const ymd = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* A cada 15 minutos: rodadas que entraram na janela do aviso e ainda estão abaixo do mínimo. Uma vez por rodada. */
export async function verificarFaltas(db: Db, enviar: Enviar, agora = Date.now()): Promise<string[]> {
  const q = await db.collection('avisos').where('ligado', '==', true).get();
  const gids = [...new Set(q.docs.map(d => String((d.data() || {}).gid || '')).filter(Boolean))];
  const feitos: string[] = [];
  for (const gid of gids) {
    const base = 'grupos/' + gid;
    const g = (await db.doc(base).get()).data() as Grupo | undefined;
    const cfg = (g && g.cfg) || {};
    if (!grupoAtivo(g) || !temMinimo(cfg.minPos)) continue;
    const horas = horasValidas(((await db.doc(base + '/privado/avisos').get()).data() || {}).horas);
    const local = agoraNoFuso(agora, cfg.fuso);
    const ini = new Date(local),
      fim = new Date(local);
    ini.setDate(ini.getDate() - 1);
    fim.setDate(fim.getDate() + 2);
    const rs = await db
      .collection(base + '/rodadas')
      .where('date', '>=', ymd(ini))
      .where('date', '<=', ymd(fim))
      .get();
    const docs: Record<string, Rodada> = {};
    rs.docs.forEach(d => (docs[d.id] = (d.data() || {}) as Rodada));
    const jogos = jogosNaJanela(cfg.fixos || [], docs, local, horas);
    for (const j of jogos) {
      const marca = db.doc('avisosEnviados/' + gid + '_' + j.id);
      if ((await marca.get()).exists) continue;
      const ps = await db
        .collection(base + '/rodadas/' + j.id + '/presencas')
        .where('s', '==', 'in')
        .get();
      const conf: { pos?: string }[] = [];
      for (const p of ps.docs) {
        const x = p.data() || {};
        let pos = String(x.pos || '');
        if (!pos) pos = String(((await db.doc(base + '/jogadores/' + p.id).get()).data() || {}).pos || '');
        conf.push({ pos });
      }
      const f = faltas(conf, cfg.minPos || {});
      if (!faltaAlgo(f)) continue;
      const ds = await destinos(db, gid);
      if (!ds.length) continue;
      await marca.set({ em: agora, gid, rid: j.id });
      await mandar(
        db,
        gid,
        ds,
        d =>
          Object.assign(
            textoFalta(f, { grupo: (g && g.name) || '', date: j.date, time: j.time, formato: cfg.formato }, d.lang),
            {
              token: d.token,
              lang: d.lang,
              link: linkDaRodada(gid, j.id),
              tag: 'f-' + j.id,
            }
          ),
        enviar,
        agora
      );
      feitos.push(gid + '/' + j.id);
    }
  }
  return feitos;
}
