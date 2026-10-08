/* Ponto de partida do Nosso Jogo.
   A ordem dos imports segue a ordem original do código: utilidades, regras de negócio, telas, ações e, por último, a inicialização. */
import './estilos/app.css';
import './nucleo/util.js';
import './nucleo/links.js';
import './dominio/esportes.js';
import './telas/login.js';
import './ui/tema.js';
import './dominio/rodadas.js';
import './nucleo/backend.js';
import './nucleo/estado.js';
import './dominio/caixa.js';
import './dominio/grupo.js';
import './nucleo/edicoes.js';
import './dominio/sorteio.js';
import './dominio/whatsapp.js';
import './ui/render.js';
import './telas/convite.js';
import './telas/grupos.js';
import './telas/apresentacao.js';
import './telas/rodada.js';
import './telas/grupo-form.js';
import './telas/grupo.js';
import './telas/jogadores.js';
import './telas/partida.js';
import './telas/ranking.js';
import './telas/caixa.js';
import './telas/votacao.js';
import './telas/publico-rodada.js';
import './telas/publico-voto.js';
import './ui/dialogos.js';
import './acoes.js';
import './eventos.js';
import './rotas.js';
import './pwa.js';
import { S } from './nucleo/estado.js';
import { boot } from './inicio.js';

/* Em modo demonstração (sem Firebase), o estado fica visível para os testes automáticos. */
if (!(window.FIREBASE_CONFIG || {}).apiKey) window.S = S;

boot();
