/* KAN-217 (pelada-v82): os estilos de cada parte sob demanda chegam com ela (src/estilos/<parte>.css, importado como
   texto e já compactado na montagem) e entram na página uma vez só. Assim o link e a gestão não baixam o CSS de telas
   que a pessoa talvez nunca abra.
   antes: entra antes do estilo principal, para valer a mesma ordem de quando estava no meio do app.css (a apresentação:
   os componentes que vêm depois, como .btn, continuam ganhando dela, como sempre foi). */
export function usarEstilo(id: string, css: string, antes = false) {
  if (typeof document === 'undefined' || document.getElementById('css-' + id)) return;
  const s = document.createElement('style');
  s.id = 'css-' + id;
  s.textContent = css;
  const principal = antes ? document.head.querySelector('style') : null;
  if (principal) document.head.insertBefore(s, principal);
  else document.head.appendChild(s);
}
