/* Regras do painel "Uso do app" do portal (KAN-313, pelada-v132). Cada registro é uso/{dia}_{login}, gravado pelo
   próprio aparelho (nucleo/uso.ts). O painel mostra, por dia, quantos aparelhos usaram o app, quantos pelo link, quantos
   com conta, quantos grupos tiveram movimento e quantos pedidos ao banco o app contou, com e sem os aparelhos de quem
   está no portal (o tráfego interno). Os registros com mais de 90 dias saem do banco. */
export const DIAS_USO = 14;
export const GUARDA_USO = 90;
const LINK = ['link', 'voto', 'aval'];

export type RegUso = {
  dia?: number;
  d?: string;
  onde?: string[];
  grupos?: string[];
  conta?: boolean;
  n?: number;
  e?: number;
};
export type DiaUso = {
  d: string;
  aparelhos: number;
  link: number;
  contas: number;
  grupos: number;
  pedidos: number;
  meus: number;
  meusPedidos: number;
};

/* Dia do registro: o número de dias desde 1970 (UTC), o mesmo que as regras do Firebase conferem. */
export const diaUso = (ms: number) => Math.floor(ms / 864e5);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/* Junta os registros por dia (a data do aparelho, d), do mais recente para o mais antigo. eu: o login de quem está no
   portal; os registros dele contam à parte (meus, meusPedidos) e ficam fora dos outros números. */
export function resumoDoUso(regs: Record<string, RegUso>, eu: string): DiaUso[] {
  const dias = new Map<string, DiaUso & { gs: Set<string> }>();
  for (const [id, r] of Object.entries(regs || {})) {
    if (!r || typeof r.d !== 'string') continue;
    let x = dias.get(r.d);
    if (!x) {
      x = { d: r.d, aparelhos: 0, link: 0, contas: 0, grupos: 0, pedidos: 0, meus: 0, meusPedidos: 0, gs: new Set() };
      dias.set(r.d, x);
    }
    if (eu && id.slice(id.indexOf('_') + 1) === eu) {
      x.meus++;
      x.meusPedidos += num(r.n);
      continue;
    }
    x.aparelhos++;
    if ((r.onde || []).some(o => LINK.includes(o))) x.link++;
    if (r.conta) x.contas++;
    (r.grupos || []).forEach(g => x!.gs.add(g));
    x.pedidos += num(r.n);
  }
  return [...dias.values()].map(({ gs, ...x }) => ({ ...x, grupos: gs.size })).sort((a, b) => b.d.localeCompare(a.d));
}

/* Totais do período (soma dos dias; aparelhos de dias diferentes contam de novo, como no App Check). */
export function totalDoUso(dias: DiaUso[]) {
  return dias.reduce(
    (t, x) => ({
      aparelhos: t.aparelhos + x.aparelhos,
      pedidos: t.pedidos + x.pedidos,
      meusPedidos: t.meusPedidos + x.meusPedidos,
    }),
    { aparelhos: 0, pedidos: 0, meusPedidos: 0 }
  );
}
