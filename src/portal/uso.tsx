/* Painel "Uso do app" do portal (KAN-313, pelada-v132): por dia, os aparelhos que usaram o app, quantos pelo link,
   quantos com conta, os grupos com movimento e os pedidos ao banco contados pelo app, para comparar com o gráfico do
   App Check do mesmo dia. Os aparelhos de quem está no portal aparecem à parte (tráfego interno). As contas são as de
   dominio/uso.ts; a leitura pega só os últimos 14 dias e apaga os registros com mais de 90 dias. */
import { DIAS_USO, GUARDA_USO, diaUso, resumoDoUso, totalDoUso, type DiaUso, type RegUso } from '../dominio/uso.ts';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from './textos.js';

type Banco = any; // FirebaseBackend ou LocalBackend (JavaScript sem tipos)
export type Uso = { dias: DiaUso[]; apagados: number; erro: boolean };

async function todos(B: Banco, q: { campo: string; de?: number; ate?: number; limite: number }) {
  const o: Record<string, RegUso> = {};
  let cursor: unknown = null,
    fim = false;
  for (let i = 0; !fim && i < 50; i++) {
    const r: { itens: [string, RegUso][]; cursor: unknown; fim: boolean } = await B.pagina('uso', q, cursor);
    r.itens.forEach(([k, v]) => (o[k] = v));
    cursor = r.cursor;
    fim = r.fim;
  }
  return o;
}

export async function carregarUso(B: Banco, eu: string): Promise<Uso> {
  try {
    const hoje = diaUso(Date.now()),
      regs = await todos(B, { campo: 'dia', de: hoje - DIAS_USO + 1, limite: 1000 }),
      velhos = Object.keys(await todos(B, { campo: 'dia', de: 1, ate: hoje - GUARDA_USO - 1, limite: 400 }));
    for (let i = 0; i < velhos.length; i += 400)
      await B.lote(velhos.slice(i, i + 400).map(k => ({ tipo: 'del', p: 'uso/' + k }))).catch(() => {});
    return { dias: resumoDoUso(regs, eu), apagados: velhos.length, erro: false };
  } catch {
    return { dias: [], apagados: 0, erro: true };
  }
}

const num = (n: number) => n.toLocaleString(LOCAL);
const data = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString(LOCAL, { weekday: 'short', day: '2-digit', month: '2-digit' });

export function UsoPainel({ uso }: { uso: Uso | null }) {
  const dias = (uso && uso.dias) || [],
    t = totalDoUso(dias);
  return (
    <div class="panel" id="usoPainel">
      <h3 style="margin:0 0 6px">{tx('uso.titulo', { n: DIAS_USO })}</h3>
      <p class="small muted" style="margin:0 0 10px">
        {tx('uso.ajuda')}
      </p>
      {uso && uso.apagados ? (
        <p class="small" id="usoApagados" role="status">
          {tx('uso.apagados', { n: uso.apagados })}
        </p>
      ) : null}
      {uso && uso.erro ? (
        <p class="small muted" role="status">
          {tx('uso.erro')}
        </p>
      ) : dias.length ? (
        <>
          <p class="small" id="usoTotal">
            {tx('uso.total', { a: num(t.aparelhos), p: num(t.pedidos), m: num(t.meusPedidos) })}
          </p>
          <div class="tbl" tabIndex={0} aria-label={tx('uso.rolar')}>
            <table id="usoTab">
              <thead>
                <tr>
                  <th scope="col">{tx('uso.dia')}</th>
                  <th scope="col">{tx('uso.aparelhos')}</th>
                  <th scope="col">{tx('uso.link')}</th>
                  <th scope="col">{tx('uso.contas')}</th>
                  <th scope="col">{tx('uso.grupos')}</th>
                  <th scope="col">{tx('uso.pedidos')}</th>
                  <th scope="col">{tx('uso.meus')}</th>
                </tr>
              </thead>
              <tbody>
                {dias.map(x => (
                  <tr key={x.d} data-d={x.d}>
                    <th scope="row" style="text-align:left">
                      {data(x.d)}
                    </th>
                    <td>{num(x.aparelhos)}</td>
                    <td>{num(x.link)}</td>
                    <td>{num(x.contas)}</td>
                    <td>{num(x.grupos)}</td>
                    <td>{num(x.pedidos)}</td>
                    <td>{x.meus ? tx('uso.meusN', { a: x.meus, p: num(x.meusPedidos) }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p class="small muted">{tx('uso.nenhum')}</p>
      )}
    </div>
  );
}
