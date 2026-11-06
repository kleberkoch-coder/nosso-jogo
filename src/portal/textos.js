/* Textos do Portal do Nosso Jogo (site separado, KAN-116). Ficam fora do dicionário do app dos clientes,
   para não irem junto para o celular de todo mundo (pedido do Arquiteto em 14/10/2026). */
const T = {
  'comum.carregando': 'Carregando…',
  'comum.copiado': 'Copiado.',
  'portal.titulo': 'Portal do Nosso Jogo',
  'portal.entrarAjuda':
    'Área da administração do Nosso Jogo. Não há cadastro aqui: só as contas Google liberadas entram.',
  'portal.entrarGoogle': 'Entrar com o Google',
  'portal.erroEntrar': 'Não foi possível entrar com o Google. Tente de novo.',
  'portal.negado':
    'Esta conta ainda não está liberada no portal. Para liberar, o identificador abaixo precisa ser incluído nas regras do Firebase, numa proposta de mudança aprovada no GitHub.',
  'portal.seuId': 'Identificador desta conta:',
  'portal.copiarId': 'Copiar identificador',
  'portal.sair': 'Sair',
  'portal.clientes': 'Clientes',
  'portal.ajuda':
    'Organizadores e administradores com conta. Aqui aparecem só dados de cadastro e de uso, nunca notas, caixa ou contatos dos grupos. O último acesso começou a ser registrado em 13/10/2026.',
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
  'portal.teste': 'teste grátis do Plano A até {d}',
  'portal.grupos': '{a} ativo(s), {i} inativo(s)',
  'portal.semNome': 'Sem nome',
  'portal.acesso': 'Último acesso: {d}',
  'portal.ultimaRodada': 'última rodada gravada: {d}',
  'portal.desde': 'registrado em {d}',
  'portal.atualizado': 'Atualizado em {d}.',
  'portal.erro': 'Não foi possível carregar agora. Verifique a conexão e tente de novo.',
  /* Ficha do cliente (KAN-117) */
  'ficha.abrir': 'Ficha',
  'ficha.abrirRotulo': 'Abrir a ficha de {email}',
  'ficha.voltar': 'Voltar à lista',
  'ficha.emVigor': 'Plano em vigor:',
  'ficha.origem.pago': 'dado pelo portal',
  'ficha.origem.teste': 'teste grátis de 14 dias',
  'ficha.origem.transicao': 'grátis na chegada dos planos',
  'ficha.origem.gratis': 'sem plano pago',
  'ficha.gravado': 'Gravado pelo portal: {plano}',
  'ficha.obsLinha': 'obs.: {obs}',
  'ficha.mudarTitulo': 'Mudar o plano',
  'ficha.plano': 'Plano',
  'ficha.validade': 'Válido até (opcional)',
  'ficha.motivoRotulo': 'Motivo',
  'ficha.escolha': 'Escolha…',
  'ficha.motivo.pago': 'Pago por fora',
  'ficha.motivo.cortesia': 'Cortesia',
  'ficha.motivo.parceria': 'Parceria',
  'ficha.motivo.teste': 'Teste estendido',
  'ficha.ajuda':
    'Sem data, o plano vale até alguém mudar. Com data, vale até o fim desse dia e depois volta sozinho ao Grátis, sem apagar nada. Para cortesia ou teste estendido, escolha o plano, a data e o motivo.',
  'ficha.gratisAviso':
    'No Grátis não há validade nem motivo. Para cortesia, parceria ou teste estendido, escolha o Plano A ou B.',
  'ficha.obs': 'Observação (opcional)',
  'ficha.salvar': 'Salvar plano',
  'ficha.salvo': 'Salvo: {plano}. Vale na próxima vez que o organizador abrir o app.',
  'ficha.semValidade': 'sem validade',
  'ficha.historico': 'Histórico de mudanças',
  'ficha.semHistorico': 'Nenhuma mudança feita pelo portal ainda.',
  'ficha.erroPlano': 'Escolha um plano da lista.',
  'ficha.erroMotivo': 'Escolha o motivo (pago por fora, cortesia, parceria ou teste estendido).',
  'ficha.erroValidade': 'A validade precisa ser hoje ou depois.',
  'ficha.nadaMudou': 'Nada mudou: o plano, a validade, o motivo e a observação são os mesmos.',
  'ficha.erroGravar': 'Não foi possível salvar. Verifique a conexão e tente de novo.',
  /* Bloqueio da conta e limites contra abuso (KAN-117, 2ª parte) */
  'bloq.titulo': 'Bloqueio da conta',
  'bloq.tag': 'Bloqueada',
  'bloq.desde':
    'desde {d}. A conta não cria nem muda nada, e os links dos grupos dela mostram "grupo indisponível". Nada foi apagado.',
  'bloq.ajuda':
    'Use só em caso de abuso. A conta continua vendo tudo, mas não cria nem muda nada, e os links dos {n} grupo(s) dela passam a mostrar "grupo indisponível". Nada é apagado e dá para desbloquear quando quiser.',
  'bloq.motivo': 'Motivo do bloqueio (vai para o histórico)',
  'bloq.bloquear': 'Bloquear conta',
  'bloq.confirmaTexto':
    'Bloquear a conta e os {n} grupo(s) dela agora? Vale na hora para o organizador e os administradores.',
  'bloq.cancelar': 'Cancelar',
  'bloq.confirmar': 'Bloquear',
  'bloq.desbloquear': 'Desbloquear conta',
  'bloq.bloqueada': 'Conta bloqueada, com {n} grupo(s).',
  'bloq.desbloqueada': 'Conta desbloqueada, com {n} grupo(s). Tudo volta a funcionar na hora.',
  'bloq.acao.bloquear': 'Conta bloqueada',
  'bloq.acao.desbloquear': 'Conta desbloqueada',
  'lim.titulo': 'Limites contra abuso',
  'lim.ajuda':
    'Valem na hora para todos os grupos. Padrão: {a} avulsos novos pelo link por rodada e {g} grupos por conta.',
  'lim.avulsos': 'Avulsos novos pelo link, por rodada',
  'lim.grupos': 'Grupos que cada conta pode criar',
  'lim.salvar': 'Salvar limites',
  'lim.erro': 'Use números inteiros de 1 a 500.',
  'lim.salvo': 'Limites salvos: {a} avulsos por rodada e {g} grupos por conta.',
};
function tx(chave, vars) {
  let s = T[chave];
  if (s == null) {
    console.warn('Texto sem tradução:', chave);
    s = chave;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}

export { tx };
