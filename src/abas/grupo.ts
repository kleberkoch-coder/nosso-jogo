/* Aba Grupo sob demanda (pelada-v71): baixa na primeira vez que a aba é aberta, como Caixa e Ranking,
   para a gestão abrir leve (D7). As ações da aba ficam em acoes/grupo.ts (que baixa acoes/grupo-lote.js no primeiro uso, desde a v84); as da janela Partidas e caixa vêm com ela. */
import estilo from '../estilos/grupo.css' with { type: 'text' };
import { usarEstilo } from '../ui/estilo';
import { juntarTextos } from '../i18n/index.js';
import textos from '../i18n/pt-BR-grupo';
usarEstilo('grupo', estilo);
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textos);
export { vGrupo as ver, montarGrupo as montar } from '../telas/GrupoTela';
/* KAN-209: a janela Partidas e caixa vem com a aba. */
export { acoes as ACOES } from '../acoes/partidas-caixa';
