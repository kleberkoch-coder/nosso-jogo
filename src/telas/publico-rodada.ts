import { montarPublico } from './PublicoRodada';

/* ---------- Página pública da rodada (jogador sem conta) ----------
   A tela em si é o componente Preact de PublicoRodada.tsx.
   Aqui fica o "quem sou eu" deste aparelho, usado também na votação (TypeScript desde a pelada-v106, KAN-262). */
const MEK = 'pelada-eu';
function myLocal(): string | null {
  try {
    return localStorage.getItem(MEK);
  } catch (e) {
    return null;
  }
}
function renderPublicRodada() {
  montarPublico();
}

export { MEK, myLocal, renderPublicRodada };
