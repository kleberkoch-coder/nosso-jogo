/* Estilos importados como texto (`with { type: 'text' }`, KAN-217): o conteúdo do arquivo .css chega como string. */
declare module '*.css' {
  const css: string;
  export default css;
}
