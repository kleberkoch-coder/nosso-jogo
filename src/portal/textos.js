/* Textos do Portal do Nosso Jogo (site separado, KAN-116). Ficam fora do dicionário do app dos clientes,
   para não irem junto para o celular de todo mundo (pedido do Arquiteto em 14/10/2026). */
const T = {
  'comum.carregando': 'Carregando…',
  'comum.copiado': 'Copiado.',
  'portal.titulo': 'Portal do Nosso Jogo',
  'portal.entrarAjuda': 'Área da administração do Nosso Jogo. Não há cadastro aqui: só as contas Google liberadas entram.',
  'portal.entrarGoogle': 'Entrar com o Google',
  'portal.erroEntrar': 'Não foi possível entrar com o Google. Tente de novo.',
  'portal.negado': 'Esta conta ainda não está liberada no portal. Para liberar, o identificador abaixo precisa ser incluído nas regras do Firebase, numa proposta de mudança aprovada no GitHub.',
  'portal.seuId': 'Identificador desta conta:',
  'portal.copiarId': 'Copiar identificador',
  'portal.sair': 'Sair',
  'portal.clientes': 'Clientes',
  'portal.ajuda': 'Organizadores e administradores com conta. Aqui aparecem só dados de cadastro e de uso, nunca notas, caixa ou contatos dos grupos. O último acesso começou a ser registrado em 13/10/2026.',
  'portal.buscar': 'Buscar por e-mail ou grupo',
  'portal.filtro': 'Filtrar clientes',
  'portal.todos': 'Todos os clientes',
  'portal.semAcesso30': 'Sem acesso há mais de 30 dias',
  'portal.vence7': 'Plano vence em até 7 dias',
  'portal.atualizar': 'Atualizar',
  'portal.nenhum': 'Nenhum cliente com esse filtro.',
  'portal.semEmail': '(e-mail não registrado)',
  'portal.ate': 'até {d}',
  'portal.vencido': 'plano vencido, voltou ao Grátis',
  'portal.grupos': '{a} ativo(s), {i} inativo(s)',
  'portal.acesso': 'Último acesso: {d}',
  'portal.ultimaRodada': 'última rodada gravada: {d}',
  'portal.desde': 'registrado em {d}',
  'portal.atualizado': 'Atualizado em {d}.',
  'portal.erro': 'Não foi possível carregar agora. Verifique a conexão e tente de novo.',
};
function tx(chave, vars) {
  let s = T[chave];
  if (s == null) { console.warn('Texto sem tradução:', chave); s = chave; }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}

export { tx };
