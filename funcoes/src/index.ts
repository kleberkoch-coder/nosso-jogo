/* Funções do servidor do Nosso Jogo (Cloud Functions do Firebase, plano Blaze). Primeira: avisos no celular dos
   administradores (KAN-242, pelada-v116). A lógica fica em logica.ts; aqui só se liga ao Firebase.
   Teto de gasto: no máximo 10 cópias de cada função ao mesmo tempo, 256 MB, e limites de avisos por grupo e por mês
   (logica.ts, KAN-275).
   Montado por funcoes/montar.mjs e publicado pela automação "Publicar as funções" no Merge. */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { REGIAO } from './config';
import { aoResponder, registrarFalha, verificarAvisos, type Db, type Enviar } from './logica';

initializeApp();
/* KAN-275: até 10 cópias (cada uma atende um aviso por vez com 256 MB); a rotina de 15 min tem 120 s. */
setGlobalOptions({ region: REGIAO, maxInstances: 10, memory: '256MiB', timeoutSeconds: 60 });

const db = () => getFirestore() as unknown as Db;
const NO_EMULADOR = process.env.FUNCTIONS_EMULATOR === 'true';
const TOKEN_INVALIDO = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

/* Só dados (sem "notification"): quem mostra o aviso é o service worker do app (site/sw.js), que controla o texto,
   o ícone e o que o toque abre. No emulador, grava em avisosTeste em vez de mandar (para os testes). */
const enviar: Enviar = async ms => {
  if (NO_EMULADOR) {
    await Promise.all(
      ms.map(m =>
        getFirestore()
          .collection('avisosTeste')
          .add(Object.assign({ em: Date.now() }, m))
      )
    );
    return ms.map(m =>
      m.token === 'token-invalido' ? 'invalido' : m.token === 'token-com-erro' ? 'messaging/internal-error' : 'ok'
    );
  }
  const r = await getMessaging().sendEach(
    ms.map(m => ({
      token: m.token,
      data: { titulo: m.titulo, corpo: m.corpo, link: m.link, tag: m.tag },
      webpush: { headers: { Urgency: 'high', TTL: '21600' } },
    }))
  );
  return r.responses.map(x =>
    x.success
      ? 'ok'
      : TOKEN_INVALIDO.includes(String(x.error?.code))
        ? 'invalido'
        : String(x.error?.code || 'desconhecido')
  );
};

/* Erro na função: vai para o banco de falhas (o Portal mostra) e não repete (repetir mandaria o aviso duas vezes). */
const comFalha = async (nome: string, gid: string, f: () => Promise<unknown>) => {
  try {
    await f();
  } catch (e) {
    console.error('Avisos:', nome, e);
    await registrarFalha(db(), 'Erro na função ' + nome + ': ' + String((e as Error)?.message || e), gid, 1);
  }
};

export const avisoResposta = onDocumentWritten('grupos/{gid}/rodadas/{rid}/presencas/{pid}', ev =>
  comFalha('avisoResposta', ev.params.gid, async () => {
    const antes = ev.data?.before?.data(),
      depois = ev.data?.after?.data();
    const r = await aoResponder(db(), ev.params as { gid: string; rid: string; pid: string }, antes, depois, enviar);
    if (r.startsWith('enviados')) console.log('Avisos de resposta', ev.params.gid, r);
  })
);

export const avisoFaltas = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'America/Sao_Paulo', timeoutSeconds: 120 },
  () =>
    comFalha('avisoFaltas', '', async () => {
      /* KAN-275: "faltam pessoas" e aniversário (KAN-272) numa passada só, com os grupos em paralelo. */
      const r = await verificarAvisos(db(), enviar);
      if (r.faltas.length) console.log('Avisos de faltam pessoas', r.faltas.join(', '));
      if (r.niver.length) console.log('Avisos de aniversário', r.niver.join(', '));
      console.log('Rotina de avisos:', r.grupos, 'grupos', r.cortada ? '(cortada pelo tempo)' : '');
    })
);
