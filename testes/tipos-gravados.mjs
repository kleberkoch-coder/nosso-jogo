/* Tipos de dado que o app grava no banco (KAN-170), lidos do próprio código: cada GB/B.set, patch e del
   e cada operação de lote ({ tipo: 'set', p: '...' }). Ex.: 'rodadas/' + rid + '/presencas/' + id → "rodadas/presencas".
   Usado pela conferência da entrega: todo tipo precisa de um caso no roteiro de gravação (testes/persistencia-cobertura.json). */
import fs from 'node:fs';
import path from 'node:path';

const arquivos = [];
(function varre(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const c = path.join(d, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'portal') varre(c);
    } else if (/\.(js|ts|tsx)$/.test(f.name)) arquivos.push(c);
  }
})('src');

const RX = [/\b(?:GB|B)\.(?:set|patch|del)\(\s*([^,)]+)/g, /tipo:\s*'(?:set|patch|del)',\s*p:\s*([^,}]+)/g];
export function tiposGravados(textos = arquivos.map(f => fs.readFileSync(f, 'utf8'))) {
  const tipos = new Set();
  for (const t of textos)
    for (const rx of RX)
      for (const m of t.matchAll(rx)) {
        const literais = [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]);
        if (!literais.length) continue;
        const partes = literais
          .join('/')
          .split('/')
          .filter(x => /^[a-z]+$/.test(x));
        // privado/<doc> e config/app são documentos fixos; nas coleções, o nome da subcoleção entra no tipo
        if (partes.length) tipos.add(partes.join('/'));
      }
  return [...tipos].sort();
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(tiposGravados().join('\n'));
