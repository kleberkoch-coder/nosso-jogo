/* Tipos da memória do app (o estado S, em nucleo/estado.ts) — KAN-220, pelada-v87.
   Cada documento do banco tem o seu tipo, com os campos que o app usa. Campos antigos ou raros ficam opcionais.
   O que o app guarda só enquanto a tela está aberta (filtros, seleção, carregamento) está no fim de Estado.
   Regra de ordem (D12): o estado é lido sempre dentro das funções, nunca no carregamento do arquivo. */
import type { Afastamentos, Isencoes } from '../dominio/afastamento';
import type { Avaliacao, Resposta } from '../dominio/avaliacao';
import type { Ciclo } from '../dominio/ciclo';
import type { Limites } from '../dominio/limites';
import type { Perm } from '../dominio/permissoes';
import type { Rateio } from '../dominio/rateio';
import type { Espelho } from '../dominio/planos';

export type Mapa<T> = Record<string, T>;

/* ---- conta e grupo ---- */
export type Usuario = {
  uid: string;
  email?: string | null;
  anon?: boolean;
  via?: string;
  [k: string]: unknown;
};
export type MeuGrupo = {
  name?: string;
  role?: 'owner' | 'admin';
  sport?: string;
  sportName?: string;
  ativo?: boolean;
  criado?: number | null;
};
export type Me = {
  grupos?: Mapa<MeuGrupo>;
  pais?: string;
  formato?: string;
  fuso?: string;
  [k: string]: unknown;
};
export type Conta = {
  plano?: string;
  planoAte?: number | null;
  teste?: number;
  ativos?: string[];
  ng?: number;
  ult?: string;
  [k: string]: unknown;
};
/* Configuração do grupo (config/app.cfg): partidas, caixa, dias fixos, região e o que mais o grupo escolhe. */
export type ConfigGrupo = {
  time?: string;
  place?: string;
  porTime?: number;
  novelty?: number;
  fixos?: { id?: string; dow: number; ini: string; fim?: string; place?: string }[];
  foraPos?: string[];
  minPos?: Mapa<number>;
  pais?: string;
  moeda?: string;
  fuso?: string;
  formato?: string;
  vagasCtrl?: boolean;
  [k: string]: unknown;
};
export type Grupo = {
  name: string;
  sport?: string;
  sportName?: string;
  owner?: string;
  ativo?: boolean;
  inativadoEm?: number;
  createdAt?: number;
  cfg: ConfigGrupo;
  posx?: [string, string][];
  pl?: Partial<Espelho> | null;
  adms?: string[];
  [k: string]: unknown;
};
export type Membro = {
  uid?: string;
  email?: string;
  role?: 'owner' | 'admin';
  perm?: Perm | null;
  via?: string;
  at?: number;
};

/* ---- elenco ---- */
export type Jogador = {
  name: string;
  pos?: string;
  ativo?: boolean;
  criado?: number;
  inativadoEm?: number;
  vaga?: boolean;
  [k: string]: unknown;
};
export type Avulso = { nome: string; pos?: string; criado?: number };
export type Contato = { tel?: string; email?: string };
export type Notas = { stars?: Mapa<number>; nivel?: Mapa<number>; sep?: [string, string][] };

/* ---- rodada, presença e partidas ---- */
export type Time = { c: number; players: string[]; res?: string[] };
export type Rodada = {
  id?: string;
  date: string;
  time?: string;
  fim?: string;
  place?: string;
  createdAt?: number;
  locked?: boolean;
  cancelada?: boolean;
  fixo?: boolean;
  np?: number;
  times?: Time[] | null;
  base?: string[];
  info?: Mapa<{ n: string; p?: string }>;
  cores?: Mapa<number>;
  vagas?: { aberta?: boolean; max?: number };
  [k: string]: unknown;
};
export type Presenca = {
  s: 'in' | 'out';
  t?: number;
  nome?: string;
  avulso?: boolean;
  pos?: string;
  by?: string;
  dev?: string;
};
export type Gol = { t: 'a' | 'b'; pid: string | null; og?: boolean; pts?: number };
export type Partida = {
  id: string;
  rid?: string;
  date?: string;
  ga: number;
  gb: number;
  ta?: number;
  tb?: number;
  at?: number;
  ver?: number;
  goals?: Gol[];
  [k: string]: unknown;
};

/* Partida em andamento (aba Partida): times em quadra, gols, cronômetro, limite e escalação. */
export type AoVivo = {
  rid: string;
  a: number;
  b: number;
  goals: Gol[];
  lim?: number;
  esc?: Mapa<any>;
  [k: string]: any;
};

/* ---- caixa ---- */
export type Lancamento = {
  k: string;
  v: number;
  d?: string;
  pid?: string | null;
  ref?: string;
  note?: string;
  rat?: string;
  fora?: string;
  refs?: string[];
  [k: string]: unknown;
};
export type PrivadoCaixa = {
  tipos?: Mapa<string>;
  porJogo?: Mapa<{ v: number; desde?: string }>;
  rat?: Mapa<Rateio>;
  ciclo?: Ciclo;
  afIsen?: Isencoes;
  [k: string]: unknown;
};

/* ---- votação ---- */
export type Categoria = { id: string; name: string; pos?: string | null; neg?: boolean };
export type Votacao = {
  rid: string;
  rdate?: string;
  title: string;
  open?: boolean;
  selfVote?: boolean;
  cats: Categoria[];
  createdAt?: number;
  resultado?: Mapa<{ counts: Mapa<number>; total: number; winners: string[] }>;
};
export type Voto = { pid?: string; v?: Mapa<string>; t?: number };
/* Troca de voto (KAN-222): a hora do servidor chega como Timestamp do Firebase (ou número no modo demonstração). */
export type TrocaGravada = { u: string; pid: string; c: string; p: string; em: unknown };

/* ---- o estado ---- */
export type Rota = { n: string; gid?: string; id?: string; token?: string; [k: string]: unknown };
export type Estado = {
  /* quem está usando */
  user: Usuario | null;
  me?: Me | null;
  conta?: Conta | null;
  authMode?: string;
  paisNovo?: string;
  paisGravando?: boolean;
  ativosGravando?: boolean;
  homeShown?: boolean;
  /* onde está */
  route: Rota;
  tab: string;
  gid?: string | null;
  rid: string | null;
  vid: string | null;
  month: string;
  /* grupo */
  app: Grupo | null;
  owner?: string;
  admins: Mapa<unknown>;
  mem?: Membro | null;
  membros?: Mapa<Membro>;
  convite?: { token: string } | null;
  myInv?: unknown;
  planosCfg?: { planos?: Mapa<unknown>; transicaoAte?: unknown } | null;
  /* elenco */
  jog: Mapa<Jogador>;
  avul?: Mapa<Avulso>;
  cont?: Mapa<Contato>;
  rat: Notas | null;
  af?: Afastamentos;
  /* rodadas */
  rod: Mapa<Rodada>;
  rodF?: Mapa<Rodada>;
  rodP?: Mapa<Rodada>;
  rodAll?: Mapa<Rodada> | null;
  rodMes?: Mapa<Rodada>;
  rodMesM?: string | null;
  rodPag?: Mapa<Rodada>;
  rodPagDe?: string | null;
  rodJunt?: Mapa<Rodada> | null;
  rodX?: Mapa<Rodada>;
  rodXid?: string | null;
  pres: Mapa<Presenca>;
  presRid?: string | null;
  presFiltro?: string;
  alvoTime?: number | null;
  limAv?: { n?: number; ult?: string } | null;
  limVg?: { n?: number; ult?: string } | null;
  limCfg?: Limites;
  ajVagas?: unknown;
  /* partidas e ranking */
  live: AoVivo | null;
  parts?: Mapa<Partida>;
  partsRid?: string | null;
  res?: Mapa<any> | null;
  resK?: string | null;
  rankSort: string;
  rankAno?: number | string;
  rankMes?: string;
  /* caixa */
  caixa: Mapa<Lancamento>;
  caixaDe?: string | null;
  pc?: PrivadoCaixa | null;
  resCx?: Mapa<any> | null;
  /* votação */
  vot: Mapa<Votacao>;
  votos: Mapa<Voto>;
  votosVid?: string | null;
  trocas?: Mapa<TrocaGravada>;
  myVote?: Voto | null;
  /* avaliação por link */
  av?: Avaliacao | null;
  minhaAv?: Resposta | null;
  minhaAvAdm?: Mapa<Resposta>;
  /* histórico, migração e carga */
  hist?: any;
  conv: Mapa<unknown>;
  loaded: Mapa<boolean>;
  falhou?: Mapa<string>;
  dataOn?: boolean;
  migr?: { v?: number; [k: string]: unknown } | null;
  migrando?: boolean;
  migrandoDados?: boolean;
  migrErro?: unknown;
};
