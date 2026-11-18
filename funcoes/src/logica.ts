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
   - avisosEnviados/_teto_{gid}: quantos avisos o grupo mandou no dia (k = o dia) (KAN-275: teto por grupo, para um abusador
     trocando a resposta pelo link não gastar os avisos de todos). Passou, só esse grupo para até o dia virar.
   - avisosEnviados/_teto_mes_{parte}: o teto do mês (k = o mês) para todos, dividido em PARTES documentos (cada envio grava numa
     parte sorteada: um documento só não aguentaria muitas gravações por segundo). Último recurso contra gasto.
   Falha de teto vai para o banco de falhas uma vez só por dia (por grupo, e uma no total para o teto do mês), com a
   marca em avisosEnviados/_teto_{gid}_marca e avisosEnviados/_teto_mes_marca. */
import {
  agoraNoFuso,
  faltaAlgo,
  faltas,
  horasValidas,
  idiomaValido,
  jogosNaJanela,
  linkDaRodada,
  temMinimo,
  textoAniversario,
  textoFalta,
  HORA_ANIVERSARIO,
  textoResposta,
  tipoDaResposta,
  type Aviso,
  type Idioma,
  type Presenca,
  type Rodada,
} from '../../src/dominio/avisos.ts';
import { aniversariantesNoDia } from '../../src/dominio/aniversario.ts';

/* O pedaço do Firestore (biblioteca de administrador) que a lógica usa. */
type Snap = { id: string; exists: boolean; ref: Ref; data(): Record<string, any> | undefined };
type QSnap = { docs: Snap[]; size: number };
type Query = {
  where(campo: string, op: string, valor: unknown): Query;
  get(): Promise<QSnap>;
  /* Contagem no servidor (1 leitura, em vez de ler a lista inteira). */
  count(): { get(): Promise<{ data(): { count: number } }> };
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
  /* Valor que soma no próprio servidor (FieldValue.increment): várias gravações ao mesmo tempo sem disputa. */
  somar(n: number): unknown;
};
type Transacao = { get(r: Ref): Promise<Snap>; set(r: Ref, d: Record<string, unknown>): unknown };

export type Mensagem = Aviso & { token: string; link: string; tag: string; lang: Idioma };
/* Envia e diz, para cada mensagem: 'ok', 'invalido' (o celular desinstalou ou tirou a permissão: o registro é apagado,
   é rotina) ou o código do erro (falha de verdade, que vai para o banco de falhas). */
export type Resultado = 'ok' | 'invalido' | string;
export type Enviar = (ms: Mensagem[]) => Promise<Resultado[]>;

/* Teto de gasto (KAN-275). O envio do Firebase Cloud Messaging é grátis; o que custa é a função rodar.
   - por grupo e por dia: 300 avisos (um grupo grande, com 30 respostas e trocas e 3 administradores, fica bem abaixo);
   - para todos, por mês: 200 mil (cerca de 400 grupos com aviso), dividido em PARTES contadores. */
export const LIMITE_GRUPO_DIA = 300;
export const LIMITE_MES = 200000;
export const PARTES = 10;

/* elenco: o administrador pode ver a data de nascimento (KAN-278): o organizador, quem é de antes das permissões (sem
   perm gravada) ou quem tem a permissão de Elenco. A mesma conta de temPerm nas regras do Firebase. */
type Destino = { uid: string; token: string; lang: Idioma; ref: Ref; elenco: boolean };

/* Celulares dos administradores que ligaram os avisos do grupo e ainda são administradores. */
export async function destinos(db: Db, gid: string): Promise<Destino[]> {
  const q = await db.collection('avisos').where('gid', '==', gid).where('ligado', '==', true).get();
  const out: Destino[] = [];
  for (const d of q.docs) {
    const uid = String((d.data() || {}).uid || '');
    const m = uid ? await db.doc('grupos/' + gid + '/membros/' + uid).get() : null;
    if (!m || !m.exists) continue;
    const md = m.data() || {},
      elenco = md.role === 'owner' || md.perm == null || (md.perm || {}).elenco === true;
    const ap = await db.collection('usuarios/' + uid + '/aparelhos').get();
    ap.docs.forEach(a => {
      const x = a.data() || {};
      if (typeof x.token === 'string' && x.token)
        out.push({ uid, token: x.token, lang: idiomaValido(x.lang), ref: a.ref, elenco });
    });
  }
  return out;
}

const mesDe = (ms: number) => new Date(ms).toISOString().slice(0, 7);
const diaDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/* Reserva n avisos num contador; 'ok', 'cheio' ou 'avisar' (cheio pela primeira vez: registra a falha uma vez só).
   KAN-275 (teste de carga): sem transação no caminho comum. Lê o contador e soma no servidor (somar), então muitas
   respostas ao mesmo tempo no mesmo grupo não disputam o documento. Pode passar do teto por poucas mensagens (as que
   leram juntas), o que não importa para um teto de gasto. Só a primeira recusa usa transação, num documento à parte
   (marca), para a falha ir uma vez só ao banco de falhas; depois, o próprio contador guarda "avisou". */
type Reserva = 'ok' | 'cheio' | 'avisar';
async function reservar(
  db: Db,
  caminho: string,
  chave: string,
  n: number,
  limite: number,
  marca: string,
  chaveMarca = chave
): Promise<Reserva> {
  const ref = db.doc(caminho);
  const d = (await ref.get()).data() || {};
  const mesmo = d.k === chave;
  const usados = mesmo ? Number(d.n) || 0 : 0;
  if (usados + n <= limite) {
    await ref.set(mesmo ? { n: db.somar(n) } : { k: chave, n, avisou: false }, { merge: true });
    return 'ok';
  }
  if (mesmo && d.avisou) return 'cheio';
  const m = db.doc(marca);
  const r = await db.runTransaction(async t => {
    if (((await t.get(m)).data() || {}).k === chaveMarca) return 'cheio' as Reserva;
    t.set(m, { k: chaveMarca });
    return 'avisar' as Reserva;
  });
  await ref.set({ k: chave, avisou: true }, { merge: true });
  return r;
}

/* Teto do grupo no dia. */
/* KAN-279: as respostas pelo link e a rotina (faltam pessoas e aniversário) têm tetos separados, para quem abusa do
   link não calar os avisos da rotina. */
export type Teto = 'resp' | 'rotina';
export const cabeNoGrupo = (
  db: Db,
  gid: string,
  n: number,
  agora: number,
  limite = LIMITE_GRUPO_DIA,
  teto: Teto = 'resp'
) => {
  const c = 'avisosEnviados/_teto_' + gid + (teto === 'rotina' ? '_rotina' : '');
  return reservar(db, c, diaDe(agora), n, limite, c + '_marca');
};

/* Teto do mês para todos, numa das PARTES (sorteada, salvo nos testes). Cada parte guarda 1/PARTES do limite. A falha
   vai ao banco de falhas no máximo uma vez por dia (marca única, com o dia), seja qual for a parte que encheu. */
export const cabeNoMes = (
  db: Db,
  n: number,
  agora: number,
  limite = LIMITE_MES,
  parte = Math.floor(Math.random() * PARTES)
) =>
  reservar(
    db,
    'avisosEnviados/_teto_mes_' + parte,
    mesDe(agora),
    n,
    Math.ceil(limite / PARTES),
    'avisosEnviados/_teto_mes_marca',
    diaDe(agora)
  );

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
  agora: number,
  teto: Teto = 'resp'
) {
  if (!ds.length) return 0;
  const rg = await cabeNoGrupo(db, gid, ds.length, agora, LIMITE_GRUPO_DIA, teto);
  if (rg !== 'ok') {
    if (rg === 'avisar')
      await registrarFalha(
        db,
        'Teto de ' + LIMITE_GRUPO_DIA + ' avisos no dia atingido neste grupo: avisos dele parados até o dia virar',
        gid,
        ds.length,
        agora
      );
    return 0;
  }
  const rm = await cabeNoMes(db, ds.length, agora);
  if (rm !== 'ok') {
    console.warn('Avisos: teto do mês atingido; nada enviado.');
    if (rm === 'avisar')
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

/* KAN-279: freio por pessoa e rodada. A mesma pessoa gera no máximo 1 aviso de resposta a cada FREIO_MS; o que ela
   trocar nesse meio fica guardado (pend) e a rotina de 15 minutos manda a resposta mais recente depois do intervalo,
   se ela for diferente da última avisada. Fica em avisosEnviados/{gid}_{rid}_{pid}_r. */
export const FREIO_MS = 10 * 60 * 1000;
const freioRef = (db: Db, gid: string, rid: string, pid: string) =>
  db.doc('avisosEnviados/' + gid + '_' + rid + '_' + pid + '_r');
async function passaNoFreio(
  db: Db,
  ids: { gid: string; rid: string; pid: string },
  s: string,
  nome: string,
  agora: number
): Promise<boolean> {
  const ref = freioRef(db, ids.gid, ids.rid, ids.pid);
  return db.runTransaction(async t => {
    const d = (await t.get(ref)).data() || {};
    if (typeof d.t === 'number' && agora - d.t < FREIO_MS) {
      t.set(ref, Object.assign({}, d, { pend: true, ps: s, nome: nome || d.nome || '' }));
      return false;
    }
    t.set(ref, { gid: ids.gid, rid: ids.rid, pid: ids.pid, t: agora, s, pend: false, nome });
    return true;
  });
}

/* Monta e manda o aviso de uma resposta (na hora ou, depois do freio, pela rotina). */
async function avisarResposta(
  db: Db,
  ids: { gid: string; rid: string; pid: string },
  g: Grupo,
  tipo: NonNullable<ReturnType<typeof tipoDaResposta>>,
  nome0: string,
  enviar: Enviar,
  agora: number
): Promise<string> {
  const { gid, rid, pid } = ids;
  const ds = await destinos(db, gid);
  if (!ds.length) return 'ninguem';
  const base = 'grupos/' + gid;
  let nome = nome0;
  if (!nome) nome = String(((await db.doc(base + '/jogadores/' + pid).get()).data() || {}).name || '');
  if (!nome) nome = String(((await db.doc(base + '/avulsos/' + pid).get()).data() || {}).nome || '');
  const rod = ((await db.doc(base + '/rodadas/' + rid).get()).data() || {}) as Rodada;
  const date = rod.date || dataDoId(rid);
  const conf = (
    await db
      .collection(base + '/rodadas/' + rid + '/presencas')
      .where('s', '==', 'in')
      .count()
      .get()
  ).data().count;
  const formato = (g.cfg || {}).formato;
  const n = await mandar(
    db,
    gid,
    ds,
    d =>
      Object.assign(textoResposta(tipo, { nome, grupo: g.name || '', date, confirmados: conf, formato }, d.lang), {
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

/* Gravação de uma presença: avisa os administradores se foi uma resposta pelo link (quem gravou não é administrador).
   KAN-279: o freio vem antes de ler administradores e celulares. */
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
  const { gid } = ids;
  if (depois.by && (await db.doc('grupos/' + gid + '/membros/' + depois.by).get()).exists) return 'administrador';
  if (!(await passaNoFreio(db, ids, String(depois.s), String(depois.nome || ''), agora))) return 'freio';
  const g = (await db.doc('grupos/' + gid).get()).data() as Grupo | undefined;
  if (!grupoAtivo(g)) return 'grupo-inativo';
  return avisarResposta(db, ids, g!, tipo, String(depois.nome || ''), enviar, agora);
}

/* Rotina (KAN-279): respostas que ficaram no freio. Depois do intervalo, manda a mais recente se ela mudou desde o
   último aviso daquela pessoa. */
async function respostasGuardadas(db: Db, enviar: Enviar, agora: number): Promise<string[]> {
  const q = await db.collection('avisosEnviados').where('pend', '==', true).get();
  const feitos: string[] = [];
  for (const d of q.docs) {
    const x = d.data() || {};
    if (typeof x.t !== 'number' || agora - x.t < FREIO_MS) continue;
    const ids = { gid: String(x.gid || ''), rid: String(x.rid || ''), pid: String(x.pid || '') };
    try {
      await d.ref.set({ t: agora, s: x.ps, pend: false }, { merge: true });
      const tipo = tipoDaResposta(x.s ? { s: x.s } : null, { s: x.ps });
      if (!tipo || !ids.gid) continue;
      const g = (await db.doc('grupos/' + ids.gid).get()).data() as Grupo | undefined;
      if (!grupoAtivo(g)) continue;
      await avisarResposta(db, ids, g!, tipo, String(x.nome || ''), enviar, agora);
      feitos.push(ids.gid + '/' + ids.rid + '/' + ids.pid);
    } catch (e) {
      console.error('Avisos: resposta guardada', ids, e);
    }
  }
  return feitos;
}

const ymd = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

type Feito = { faltas: string[]; niver: string[]; grupos: number; cortada: boolean; guardadas: string[] };

/* "Faltam pessoas" de um grupo já lido: rodadas que entraram na janela do aviso e ainda estão abaixo do mínimo.
   Uma vez por rodada (avisosEnviados/{gid}_{rid}). */
async function faltasDoGrupo(db: Db, gid: string, g: Grupo, enviar: Enviar, agora: number): Promise<string[]> {
  const base = 'grupos/' + gid;
  const cfg = g.cfg || {};
  if (!temMinimo(cfg.minPos)) return [];
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
  const feitos: string[] = [];
  for (const j of jogosNaJanela(cfg.fixos || [], docs, local, horas)) {
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
          textoFalta(f, { grupo: g.name || '', date: j.date, time: j.time, formato: cfg.formato }, d.lang),
          {
            token: d.token,
            lang: d.lang,
            link: linkDaRodada(gid, j.id),
            tag: 'f-' + j.id,
          }
        ),
      enviar,
      agora,
      'rotina'
    );
    feitos.push(gid + '/' + j.id);
  }
  return feitos;
}

/* KAN-272: às 9h no fuso do grupo (ou na primeira verificação depois), avisa quem faz aniversário hoje. Uma vez por
   dia por grupo (avisosEnviados/{gid}_niver_{data}), mesmo quando ninguém faz aniversário (assim não relê os contatos
   a cada 15 minutos). Só jogadores ativos do elenco; a data vem de privado/contatos (só o servidor e os
   administradores com Elenco leem). */
async function niverDoGrupo(db: Db, gid: string, g: Grupo, enviar: Enviar, agora: number): Promise<string[]> {
  const base = 'grupos/' + gid;
  const local = agoraNoFuso(agora, (g.cfg || {}).fuso);
  if (local.getHours() < HORA_ANIVERSARIO) return [];
  const hoje = ymd(local),
    marca = db.doc('avisosEnviados/' + gid + '_niver_' + hoje);
  if ((await marca.get()).exists) return [];
  const cont = ((await db.doc(base + '/privado/contatos').get()).data() || {}) as Record<string, { nasc?: string }>;
  const nomes: string[] = [];
  for (const id of aniversariantesNoDia(cont, hoje)) {
    const j = (await db.doc(base + '/jogadores/' + id).get()).data();
    if (j && j.ativo !== false && j.name) nomes.push(String(j.name));
  }
  await marca.set({ em: agora, gid, n: nomes.length });
  if (!nomes.length) return [];
  /* KAN-278: a data de nascimento é de quem tem Elenco; o aviso vai só para quem pode vê-la. */
  const ds = (await destinos(db, gid)).filter(d => d.elenco);
  if (!ds.length) return [];
  await mandar(
    db,
    gid,
    ds,
    d =>
      Object.assign(textoAniversario(nomes, { grupo: g.name || '' }, d.lang), {
        token: d.token,
        lang: d.lang,
        link: './#/g/' + encodeURIComponent(gid),
        tag: 'n-' + gid + '-' + hoje,
      }),
    enviar,
    agora,
    'rotina'
  );
  return [gid + '/' + hoje];
}

/* KAN-275: quantos grupos ao mesmo tempo e o tempo que a rotina se dá antes de parar (a função tem 120 s). */
export const LOTE = 25;
export const TEMPO_ROTINA_MS = 90000;

/* A cada 15 minutos (KAN-275): a lista de avisos ligados e cada grupo são lidos uma vez só, e os grupos andam em
   paralelo, LOTE de cada vez. Se a rotina chegar perto do tempo, para de começar grupos novos e registra a falha
   "rotina cortada" (os que ficaram entram na próxima, 15 minutos depois). */
export async function verificarAvisos(
  db: Db,
  enviar: Enviar,
  agora = Date.now(),
  o: { faltas?: boolean; niver?: boolean; guardadas?: boolean; relogio?: () => number; tempo?: number } = {}
): Promise<Feito> {
  const fazFaltas = o.faltas !== false,
    fazNiver = o.niver !== false,
    relogio = o.relogio || Date.now,
    inicio = relogio(),
    tempo = o.tempo ?? TEMPO_ROTINA_MS;
  const q = await db.collection('avisos').where('ligado', '==', true).get();
  const gids = [...new Set(q.docs.map(d => String((d.data() || {}).gid || '')).filter(Boolean))];
  const r: Feito = { faltas: [], niver: [], grupos: 0, cortada: false, guardadas: [] };
  let i = 0;
  const um = async () => {
    while (i < gids.length) {
      if (relogio() - inicio > tempo) {
        r.cortada = true;
        return;
      }
      const gid = gids[i++]!;
      try {
        const g = (await db.doc('grupos/' + gid).get()).data() as Grupo | undefined;
        r.grupos++;
        if (!grupoAtivo(g)) continue;
        if (fazFaltas) r.faltas.push(...(await faltasDoGrupo(db, gid, g!, enviar, agora)));
        if (fazNiver) r.niver.push(...(await niverDoGrupo(db, gid, g!, enviar, agora)));
      } catch (e) {
        /* Um grupo com problema não para os outros. */
        console.error('Avisos: grupo', gid, e);
        await registrarFalha(db, 'Erro na rotina de avisos: ' + String((e as Error)?.message || e), gid, 1, agora);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOTE, gids.length) }, um));
  /* KAN-279: as respostas que ficaram no freio. */
  if (o.guardadas !== false)
    try {
      r.guardadas = await respostasGuardadas(db, enviar, agora);
    } catch (e) {
      console.error('Avisos: respostas guardadas', e);
    }
  if (r.cortada)
    await registrarFalha(
      db,
      'Rotina de avisos cortada pelo tempo: ' + (gids.length - r.grupos) + ' grupos ficaram para a próxima',
      '',
      gids.length - r.grupos,
      agora
    );
  return r;
}

/* Os dois avisos da rotina, separados (usados nos testes). */
export const verificarFaltas = async (db: Db, enviar: Enviar, agora = Date.now()) =>
  (await verificarAvisos(db, enviar, agora, { niver: false, guardadas: false })).faltas;
export const verificarAniversarios = async (db: Db, enviar: Enviar, agora = Date.now()) =>
  (await verificarAvisos(db, enviar, agora, { faltas: false, guardadas: false })).niver;
