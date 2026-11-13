/* Funções do servidor do Nosso Jogo (Cloud Functions do Firebase, plano Blaze). Primeira: avisos no celular dos
   administradores (KAN-242, pelada-v116). A lógica fica em logica.ts; aqui só se liga ao Firebase.
   Teto de gasto: no máximo 3 cópias de cada função ao mesmo tempo, 256 MB, e um limite de avisos por mês (logica.ts).
   Montado por funcoes/montar.mjs e publicado pela automação "Publicar as funções" no Merge. */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { REGIAO } from './config';
import { aoResponder, verificarFaltas, type Db, type Enviar } from './logica';

initializeApp();
setGlobalOptions({ region: REGIAO, maxInstances: 3, memory: '256MiB', timeoutSeconds: 60 });

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
    return ms.map(m => m.token === 'token-invalido');
  }
  const r = await getMessaging().sendEach(
    ms.map(m => ({
      token: m.token,
      data: { titulo: m.titulo, corpo: m.corpo, link: m.link, tag: m.tag },
      webpush: { headers: { Urgency: 'high', TTL: '21600' } },
    }))
  );
  return r.responses.map(x => !x.success && TOKEN_INVALIDO.includes(String(x.error?.code)));
};

export const avisoResposta = onDocumentWritten('grupos/{gid}/rodadas/{rid}/presencas/{pid}', async ev => {
  const antes = ev.data?.before?.data(),
    depois = ev.data?.after?.data();
  const r = await aoResponder(db(), ev.params as { gid: string; rid: string; pid: string }, antes, depois, enviar);
  if (r.startsWith('enviados')) console.log('Avisos de resposta', ev.params.gid, r);
});

export const avisoFaltas = onSchedule({ schedule: 'every 15 minutes', timeZone: 'America/Sao_Paulo' }, async () => {
  const feitos = await verificarFaltas(db(), enviar);
  if (feitos.length) console.log('Avisos de faltam pessoas', feitos.join(', '));
});
