/* Aniversário do jogador na gestão (KAN-272, pelada-v118): 🎂 ao lado do nome na semana do aniversário (elenco e
   rodada) e "Aniversariantes do mês" na aba Jogadores. A data vem de privado/contatos, que só quem tem Elenco lê;
   sem ela, nada aparece. Nunca vai para o link do jogador. Regra em dominio/aniversario.ts. */
import { aniversariantesDoMes, aniversarioNoAno, aniversarioPerto } from '../dominio/aniversario';
import { pname } from '../dominio/grupo.js';
import { FORMATO, LOCAL } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-niver';
import { S as estado } from '../nucleo/estado.js';

juntarTextos(textos);

type Obj = Record<string, any>;
const cont = (): Obj => (estado as Obj).cont || {};
const diaMes = (data: string) =>
  new Date(data + 'T12:00').toLocaleDateString(FORMATO, { day: '2-digit', month: '2-digit' });

/* 🎂 ao lado do nome, de 3 dias antes a 3 dias depois da data (hoje, ou a data da rodada). */
export function Bolo({ id, data }: { id: string; data: string }) {
  const n = cont()[id]?.nasc;
  if (!data || !aniversarioPerto(n, data)) return null;
  const dia = diaMes(aniversarioNoAno(n, +data.slice(0, 4)));
  const r = tx('niver.rotulo', { data: dia });
  return (
    <>
      {' '}
      <span class="tag bolo" title={r} aria-label={r} role="img">
        🎂
      </span>
    </>
  );
}

/* Aniversariantes do mês (aba Jogadores), na ordem do dia. Some quando ninguém faz aniversário no mês. */
export function Aniversariantes({ ids, hoje }: { ids: string[]; hoje: string }) {
  const lista = aniversariantesDoMes(cont(), hoje.slice(0, 7), ids);
  if (!lista.length) return null;
  const mes = new Date(hoje.slice(0, 7) + '-15T12:00').toLocaleDateString(LOCAL, { month: 'long' });
  return (
    <div class="panel" id="aniversariantes">
      <h3>{tx('niver.mes', { mes })}</h3>
      <ul class="plist">
        {lista.map(x => (
          <li key={x.id}>
            <span class="pn">
              {pname(x.id)}
              <Bolo id={x.id} data={hoje} />
            </span>
            <span class="tag">{tx('niver.dia', { dia: x.dia })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
