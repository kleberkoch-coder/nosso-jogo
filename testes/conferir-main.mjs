/* Conferência da origem do código (27/10/2026, repositório público): antes de começar uma versão nova,
   confere que cada mudança que entrou na main veio de uma proposta (pull request) aprovada pelo Kleber no GitHub.
   Cada mudança no Git tem uma assinatura digital (hash) que depende de todo o histórico anterior: se alguém alterasse
   algo antigo, todas as assinaturas seguintes mudariam. Aqui, cada mudança da main precisa:
     1. ser o Merge de uma proposta (o GitHub liga a assinatura à proposta);
     2. ter o Merge feito pela conta do Kleber;
     3. estar verificada pelo GitHub (Merge feito pelo site, com a assinatura do próprio GitHub).
   Uso (precisa do gh com acesso ao repositório): node testes/conferir-main.mjs [quantas mudanças olhar, padrão 30]
   Sai com erro e explica em português se alguma mudança não tem origem conhecida. */
import { execFileSync } from 'node:child_process';

const REPO = 'kleberkoch-coder/nosso-jogo',
  DONO = 'kleberkoch-coder',
  N = +(process.argv[2] || 30);
const gh = path => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 1 << 26 }));

// Só a linha principal da main (cada item é o Merge de uma proposta, ou algo que entrou direto).
const linha = [];
let sha = gh(`repos/${REPO}/commits/main`).sha;
while (sha && linha.length < N) {
  const c = gh(`repos/${REPO}/commits/${sha}`);
  linha.push(c);
  sha = c.parents && c.parents[0] && c.parents[0].sha;
}

const problemas = [];
for (const c of linha) {
  const curto = c.sha.slice(0, 8),
    titulo = c.commit.message.split('\n')[0].slice(0, 70);
  const prs = gh(`repos/${REPO}/commits/${c.sha}/pulls`).filter(p => p.merge_commit_sha === c.sha);
  if (!prs.length) {
    problemas.push(`${curto} "${titulo}": entrou na main sem proposta (pull request).`);
    continue;
  }
  const pr = gh(`repos/${REPO}/pulls/${prs[0].number}`);
  if (!pr.merged_by || pr.merged_by.login !== DONO)
    problemas.push(
      `${curto} (#${pr.number}): Merge feito por ${pr.merged_by ? pr.merged_by.login : 'ninguém'}, não pela conta ${DONO}.`
    );
  if (!c.commit.verification || !c.commit.verification.verified)
    problemas.push(`${curto} (#${pr.number}): o GitHub não verificou a assinatura deste Merge.`);
}

if (problemas.length) {
  console.error(`Conferência da origem: ${problemas.length} problema(s) nas últimas ${linha.length} mudanças da main:`);
  problemas.forEach(p => console.error(' - ' + p));
  console.error('Não comece uma versão nova antes de entender cada item acima.');
  process.exit(1);
}
console.log(
  `Conferência da origem: tudo certo. As últimas ${linha.length} mudanças da main vieram de propostas com Merge do Kleber, verificadas pelo GitHub (última: ${linha[0].sha.slice(0, 8)}).`
);
