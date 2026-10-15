/* Conferência da entrega (pelada-v44): o que costumava ser esquecido agora barra a proposta no GitHub.
   Uso: node testes/conferir-entrega.mjs <commit-base>   (o texto da proposta vem na variável DESCRICAO_PR)
   Regras:
   1. Mudou o app (src/ ou site/)? A VERSION do site/sw.js tem que subir.
   2. Entrou componente novo (src/ui/*) ou estilo novo (classe nova no src/estilos/app.css)? O docs/DESIGN-SYSTEM.md tem que mudar junto.
   3. Mudou tela ou ação (src/telas, src/acoes)? O docs/REGRAS.md tem que mudar, ou a proposta diz "sem mudança de regra".
   4. Mudou o firestore.rules? A proposta tem que avisar ("regras do Firebase").
   5. A proposta traz o checklist de entrega preenchido (nenhum "- [ ]" sobrando). */
import { execSync } from 'node:child_process';

const base = process.argv[2];
if (!base) { console.log('Sem commit-base: conferência pulada (só roda em proposta de mudança).'); process.exit(0); }
const git = c => execSync('git ' + c, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const mudou = git(`diff --name-status ${base}...HEAD`).trim().split('\n').filter(Boolean).map(l => { const [st, ...p] = l.split('\t'); return { st, f: p[p.length - 1] }; });
const arq = mudou.map(m => m.f), tem = re => arq.some(f => re.test(f));
const desc = (process.env.DESCRICAO_PR || '').toLowerCase();
const erros = [];

const versao = t => (/VERSION\s*=\s*'([^']+)'/.exec(t) || [])[1];
const naBase = f => { try { return git(`show ${base}:${f}`); } catch { return ''; } };
if (tem(/^(src|site)\//) && versao(naBase('site/sw.js')) === versao(git('show HEAD:site/sw.js')))
  erros.push('O app mudou, mas a VERSION do site/sw.js não subiu (os celulares não vão atualizar).');

const classes = t => new Set((t.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.[a-zA-Z][\w-]*(?=[^}]*\{)/g) || []));
const novasClasses = [...classes(git('show HEAD:src/estilos/app.css'))].filter(c => !classes(naBase('src/estilos/app.css')).has(c));
const componenteNovo = mudou.some(m => m.st === 'A' && /^src\/ui\/.*\.tsx$/.test(m.f));
if ((novasClasses.length || componenteNovo) && !arq.includes('docs/DESIGN-SYSTEM.md'))
  erros.push(`Entrou ${componenteNovo ? 'componente novo em src/ui/' : 'estilo novo (' + novasClasses.slice(0, 5).join(' ') + ')'}, mas o docs/DESIGN-SYSTEM.md não mudou. Registre o componente no Design System (documento e página).`);

if (tem(/^src\/(telas|acoes)\//) && !arq.includes('docs/REGRAS.md') && !desc.includes('sem mudança de regra'))
  erros.push('Mudou tela ou ação, mas o docs/REGRAS.md não mudou. Atualize a regra ou escreva "sem mudança de regra" na descrição da proposta.');

if (arq.includes('firestore.rules') && !desc.includes('regras do firebase'))
  erros.push('O firestore.rules mudou: a descrição da proposta precisa avisar sobre as "regras do Firebase" (elas vão ao ar no Merge).');

if (/- \[ \]/.test(process.env.DESCRICAO_PR || '')) erros.push('O checklist da descrição da proposta tem itens sem marcar ("- [ ]"). Marque ou explique o que ficou pendente.');

if (erros.length) { erros.forEach(e => console.log('::error::' + e)); process.exit(1); }
console.log(`Conferência da entrega: tudo certo (${arq.length} arquivos).`);
