/* Países (KAN-162): código do telefone, quantos dígitos tem o número, moeda, formato de datas e números e fusos.
   O país da conta é sugerido pelo fuso do aparelho (celular ou computador); o grupo guarda país, moeda, fuso e formato
   na configuração (cfg.pais, cfg.moeda, cfg.fuso, cfg.formato). Como mostrar fica em dominio/regiao.ts, que não precisa
   desta tabela: assim o link do jogador não baixa a lista de países.
   Regra pura, sem tela: testada em testes/regras/paises.test.mjs. Os nomes dos países e das moedas vêm do
   navegador (ui/regiao.ts), no idioma do app, então não ficam aqui. */

export type Pais = {
  iso: string; // código de 2 letras (BR, US…)
  ddi: string; // código do telefone, sem o "+"
  min: number; // dígitos do número no país, sem o código (mínimo e máximo)
  max: number;
  tronco: boolean; // o número costuma ser escrito com um "0" na frente, que sai no formato internacional
  moeda: string; // código da moeda (BRL, USD…)
  formato: string; // local de datas e números (pt-BR, en-US…)
  fusos: string[]; // o primeiro é o principal
};

/* [país, código, mín, máx, "0" na frente, moeda, idioma do formato, fusos separados por |].
   Fuso sem continente é da América (America/…). */
const T: [string, string, number, number, 0 | 1, string, string, string][] = [
  [
    'BR',
    '55',
    10,
    11,
    0,
    'BRL',
    'pt',
    'Sao_Paulo|Bahia|Fortaleza|Recife|Maceio|Belem|Araguaina|Santarem|Noronha|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe',
  ],
  ['PT', '351', 9, 9, 0, 'EUR', 'pt', 'Europe/Lisbon|Atlantic/Madeira|Atlantic/Azores'],
  ['AO', '244', 9, 9, 0, 'AOA', 'pt', 'Africa/Luanda'],
  ['MZ', '258', 8, 9, 0, 'MZN', 'pt', 'Africa/Maputo'],
  ['CV', '238', 7, 7, 0, 'CVE', 'pt', 'Atlantic/Cape_Verde'],
  [
    'US',
    '1',
    10,
    10,
    0,
    'USD',
    'en',
    'New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Pacific/Honolulu|Detroit|Boise|Indiana/Indianapolis|Kentucky/Louisville',
  ],
  ['CA', '1', 10, 10, 0, 'CAD', 'en', 'Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina'],
  ['MX', '52', 10, 10, 0, 'MXN', 'es', 'Mexico_City|Cancun|Monterrey|Merida|Chihuahua|Hermosillo|Tijuana'],
  ['AR', '54', 10, 11, 1, 'ARS', 'es', 'Argentina/Buenos_Aires|Buenos_Aires|Argentina/Cordoba|Argentina/Mendoza'],
  ['CL', '56', 9, 9, 0, 'CLP', 'es', 'Santiago|Punta_Arenas|Pacific/Easter'],
  ['CO', '57', 10, 10, 0, 'COP', 'es', 'Bogota'],
  ['PE', '51', 9, 9, 0, 'PEN', 'es', 'Lima'],
  ['UY', '598', 8, 8, 1, 'UYU', 'es', 'Montevideo'],
  ['PY', '595', 9, 9, 1, 'PYG', 'es', 'Asuncion'],
  ['BO', '591', 8, 8, 0, 'BOB', 'es', 'La_Paz'],
  ['EC', '593', 9, 9, 1, 'USD', 'es', 'Guayaquil|Pacific/Galapagos'],
  ['VE', '58', 10, 10, 1, 'VES', 'es', 'Caracas'],
  ['CR', '506', 8, 8, 0, 'CRC', 'es', 'Costa_Rica'],
  ['PA', '507', 7, 8, 0, 'USD', 'es', 'Panama'],
  ['GT', '502', 8, 8, 0, 'GTQ', 'es', 'Guatemala'],
  ['DO', '1', 10, 10, 0, 'DOP', 'es', 'Santo_Domingo'],
  ['ES', '34', 9, 9, 0, 'EUR', 'es', 'Europe/Madrid|Atlantic/Canary'],
  ['FR', '33', 9, 9, 1, 'EUR', 'fr', 'Europe/Paris'],
  ['IT', '39', 9, 11, 0, 'EUR', 'it', 'Europe/Rome'],
  ['DE', '49', 7, 11, 1, 'EUR', 'de', 'Europe/Berlin'],
  ['GB', '44', 10, 10, 1, 'GBP', 'en', 'Europe/London'],
  ['IE', '353', 7, 9, 1, 'EUR', 'en', 'Europe/Dublin'],
  ['NL', '31', 9, 9, 1, 'EUR', 'nl', 'Europe/Amsterdam'],
  ['BE', '32', 8, 9, 1, 'EUR', 'fr', 'Europe/Brussels'],
  ['LU', '352', 6, 11, 0, 'EUR', 'fr', 'Europe/Luxembourg'],
  ['CH', '41', 9, 9, 1, 'CHF', 'de', 'Europe/Zurich'],
  ['AT', '43', 7, 13, 1, 'EUR', 'de', 'Europe/Vienna'],
  ['PL', '48', 9, 9, 0, 'PLN', 'pl', 'Europe/Warsaw'],
  ['SE', '46', 7, 9, 1, 'SEK', 'sv', 'Europe/Stockholm'],
  ['NO', '47', 8, 8, 0, 'NOK', 'nb', 'Europe/Oslo'],
  ['DK', '45', 8, 8, 0, 'DKK', 'da', 'Europe/Copenhagen'],
  ['ZA', '27', 9, 9, 1, 'ZAR', 'en', 'Africa/Johannesburg'],
  ['AE', '971', 8, 9, 1, 'AED', 'en', 'Asia/Dubai'],
  ['IL', '972', 8, 9, 1, 'ILS', 'he', 'Asia/Jerusalem|Asia/Tel_Aviv'],
  ['IN', '91', 10, 10, 1, 'INR', 'en', 'Asia/Kolkata|Asia/Calcutta'],
  ['JP', '81', 9, 10, 1, 'JPY', 'ja', 'Asia/Tokyo'],
  ['CN', '86', 11, 11, 0, 'CNY', 'zh', 'Asia/Shanghai'],
  [
    'AU',
    '61',
    9,
    9,
    1,
    'AUD',
    'en',
    'Australia/Sydney|Australia/Melbourne|Australia/Brisbane|Australia/Perth|Australia/Adelaide|Australia/Hobart|Australia/Darwin',
  ],
  ['NZ', '64', 8, 10, 1, 'NZD', 'en', 'Pacific/Auckland'],
];

export const PAISES: Pais[] = T.map(([iso, ddi, min, max, tronco, moeda, lang, z]) => ({
  iso,
  ddi,
  min,
  max,
  tronco: !!tronco,
  moeda,
  formato: lang + '-' + iso,
  fusos: z.split('|').map(f => (/^(Europe|Atlantic|Africa|Asia|Australia|Pacific)\//.test(f) ? f : 'America/' + f)),
}));
export const PADRAO = 'BR';

export const paisPor = (iso?: string): Pais | undefined => PAISES.find(p => p.iso === iso);
const brasil = () => paisPor(PADRAO) as Pais;

/* Moedas da lista (sem repetir), para escolher outra no grupo. */
export const MOEDAS: string[] = [...new Set(PAISES.map(p => p.moeda))];

/* País sugerido para a conta nova: pelo fuso do aparelho; se o fuso não ajudar, pela região do idioma (pt-BR → BR). */
export function detectarPais(fuso?: string, idioma?: string): string {
  const porFuso = fuso ? PAISES.find(p => p.fusos.includes(fuso)) : undefined;
  if (porFuso) return porFuso.iso;
  const reg = /[-_]([A-Za-z]{2})$/.exec(String(idioma || ''));
  const porIdioma = reg ? paisPor(reg[1].toUpperCase()) : undefined;
  return porIdioma ? porIdioma.iso : PADRAO;
}

export type Regiao = { pais: string; moeda: string; fuso: string; formato: string };

/* Região de um grupo novo, a partir do país do organizador. O fuso é o do aparelho se ele for do país; senão, o principal. */
export function regiaoNova(iso: string | undefined, fusoAparelho?: string): Regiao {
  const p = paisPor(iso) || brasil();
  return {
    pais: p.iso,
    moeda: p.moeda,
    fuso: fusoAparelho && p.fusos.includes(fusoAparelho) ? fusoAparelho : p.fusos[0],
    formato: p.formato,
  };
}

/* ---------- telefone ---------- */
export type Telefone = { ok: true; valor: string } | { ok: false; erro: 'invalido' | 'curto' | 'longo' | 'semPais' };

/* Número digitado → formato internacional (+código e número). Com "+" (ou "00") na frente, vale o código digitado;
   sem ele, vale o país escolhido ao lado do campo (iso). País vazio ("Outro") exige o "+". */
export function telefonePais(texto: string, iso: string): Telefone {
  const t = String(texto || '').trim();
  if (!t) return { ok: true, valor: '' };
  if (/[^\d\s()+.\-]/.test(t)) return { ok: false, erro: 'invalido' };
  let d = t.replace(/\D/g, '');
  if (t.startsWith('+') || t.startsWith('00')) {
    if (t.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) return { ok: false, erro: 'invalido' };
    if (d.length < 8) return { ok: false, erro: 'curto' };
    if (d.length > 15) return { ok: false, erro: 'longo' };
    return { ok: true, valor: '+' + d };
  }
  const p = iso === '' ? undefined : paisPor(iso) || brasil();
  if (!p) return { ok: false, erro: 'semPais' };
  // Quem digitou o código do país sem o "+" (ex.: 5511…, 1415…).
  if (d.startsWith(p.ddi) && d.length - p.ddi.length >= p.min && d.length - p.ddi.length <= p.max + (p.tronco ? 1 : 0))
    d = d.slice(p.ddi.length);
  if (p.tronco && d[0] === '0') d = d.slice(1);
  if (d.length < p.min) return { ok: false, erro: 'curto' };
  if (d.length > p.max) return { ok: false, erro: 'longo' };
  if (d[0] === '0') return { ok: false, erro: 'invalido' };
  // EUA, Canadá e vizinhos (+1): o código de área nunca começa com 1 (pega um número brasileiro com o combo em +1).
  if (p.ddi === '1' && d[0] === '1') return { ok: false, erro: 'invalido' };
  return { ok: true, valor: '+' + p.ddi + d };
}

/* Telefone gravado → país do combo e número do campo. Números antigos, sem "+", são brasileiros.
   Códigos usados por mais de um país (+1) ficam com o país do grupo quando ele usa o mesmo código. */
export function separarTelefone(tel: string, padrao: string): { pais: string; numero: string } {
  const t = String(tel || '').trim();
  if (!t) return { pais: paisPor(padrao) ? padrao : PADRAO, numero: '' };
  if (!t.startsWith('+')) return { pais: PADRAO, numero: t };
  const d = t.slice(1),
    cand = PAISES.filter(p => d.startsWith(p.ddi));
  if (!cand.length) return { pais: '', numero: t };
  const maior = Math.max(...cand.map(p => p.ddi.length)),
    melhores = cand.filter(p => p.ddi.length === maior),
    p = melhores.find(x => x.iso === padrao) || melhores[0];
  return { pais: p.iso, numero: d.slice(p.ddi.length) };
}
