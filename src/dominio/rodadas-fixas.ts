/* Rodadas fixas: qual é a próxima data de cada jogo fixo (uma das 5 regras da D12).
   Regra pura: recebe os horários fixos, as rodadas já gravadas e o "agora"; não lê o estado do app.
   - A próxima rodada de cada dia fixo existe sozinha ("virtual") até alguém gravar algo nela.
   - Ela vira para a semana seguinte quando o jogo termina (horário de término; sem término, fim do dia).
   - Data cancelada pula para a semana seguinte. */

export type Fixo = { dow: number | string; ini: string; fim?: string; place?: string };
export type RodadaBase = { date: string; time?: string; fim?: string; cancelada?: boolean };

export const ymd = (d: Date): string =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* Quando o jogo termina. Término antes do início (ex.: 23:00–01:00) cai no dia seguinte. */
export function endTs(r: RodadaBase): number {
  let t = new Date(r.date + 'T' + (r.fim || '23:59')).getTime();
  if (r.fim && r.time && r.fim < r.time) t += 864e5;
  return t;
}

export function fixId(date: string, ini?: string): string {
  return 'f-' + date + '-' + String(ini || '0000').replace(':', '');
}

export function virtualOf(fx: Fixo, date: string) {
  return { id: fixId(date, fx.ini), date, time: fx.ini, fim: fx.fim, place: fx.place, fixo: true, virtual: true, locked: false, times: null };
}

/* Próxima rodada de cada horário fixo que ainda não tem documento gravado. */
export function proximasFixas(fixos: Fixo[], docs: Record<string, Partial<RodadaBase> | undefined>, agora: Date) {
  const out: ReturnType<typeof virtualOf>[] = [], now = agora.getTime();
  fixos.forEach(fx => {
    /* Começa por ontem (KAN-111): um jogo que passou da meia-noite ainda está valendo até o horário de término. */
    const d = new Date(agora); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1);
    for (let k = 0; k < 71; k++) {
      if (d.getDay() === +fx.dow) {
        const date = ymd(d), v = virtualOf(fx, date), doc = docs[v.id];
        if (endTs(doc ? Object.assign({}, v, doc) : v) > now && !(doc && doc.cancelada)) { if (!doc) out.push(v); break; }
      }
      d.setDate(d.getDate() + 1);
    }
  });
  return out;
}
