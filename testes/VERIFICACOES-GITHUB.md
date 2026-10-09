# Verificações do GitHub e do Netlify, por versão

Este arquivo existe porque os agentes (Qualidade, Arquiteto, Segurança) **não enxergam o GitHub nem a prévia do Netlify**. Quem entrega a versão anota aqui o que só dá para ver lá. Os agentes usam como evidência, sem precisar deixar cartões em "validação parcial" por falta de acesso.

Atualizado a cada entrega (quando a proposta é aberta) e de novo depois do Merge.

## Como ler
- **Testes do app:** o roteiro `testes/testes_app.py` rodado pelo GitHub sobre o site **publicado** (compactado desde a v19).
- **Regras do Firebase (emulador):** tarefa `regras-firebase`, desde a v19 (KAN-104). Casos em `testes/regras-firebase/regras.test.mjs`.
- **Regras de negócio:** `npm run regras` (testes de `testes/regras/`), dentro da tarefa "montar".
- **Tamanho:** app comprimido medido na montagem (limite 80 KB, decisão D7).
- **No ar:** Merge feito e site publicado pelo Netlify (a versão aparece no rodapé desde a v19).

## Versões

| Versão | Proposta | Testes do app | Regras de negócio | Regras do Firebase (emulador) | Tamanho | Mapa de origem | Regras publicadas | No ar |
|---|---|---|---|---|---|---|---|---|
| pelada-v19 | [#12](https://github.com/kleberkoch-coder/nosso-jogo/pull/12) | ✅ 125 de 125 (site compactado) | ✅ 34 de 34 | ✅ 21 de 21 | 65,5 KB | ✅ `main.js.map` e `main.css.map` no `dist/` | não mudaram | ✅ Merge 08/10 17h47 |
| pelada-v18 | [#11](https://github.com/kleberkoch-coder/nosso-jogo/pull/11) | ✅ 122 de 122 | ✅ 34 de 34 | (não existia) | 77,3 KB | — | ✅ publicadas no Merge | ✅ Merge 08/10 17h00 |
| pelada-v17 | [#10](https://github.com/kleberkoch-coder/nosso-jogo/pull/10) | ✅ 109 de 109 | ✅ 24 de 24 | (não existia) | 72,9 KB | — | ✅ publicadas no Merge | ✅ Merge 08/10 16h24 |
| pelada-v16 | [#9](https://github.com/kleberkoch-coder/nosso-jogo/pull/9) | ✅ 101 de 101 | ✅ 16 de 16 | (não existia) | 70,8 KB | — | não mudaram | ✅ Merge 08/10 15h53 |
| pelada-v15 | [#8](https://github.com/kleberkoch-coder/nosso-jogo/pull/8) | ✅ 80 de 80 | ✅ 9 de 9 | (não existia) | 68,8 KB | — | não mudaram | ✅ Merge 08/10 14h50 |
| pelada-v14 | [#6](https://github.com/kleberkoch-coder/nosso-jogo/pull/6) | ✅ 61 de 61 | — | (não existia) | cerca de 67 KB | — | não mudaram | ✅ Merge 08/10 12h38 |
| pelada-v13 | [#4](https://github.com/kleberkoch-coder/nosso-jogo/pull/4) | ✅ 49 de 49 | — | (não existia) | 53,6 KB | — | não mudaram | ✅ Merge 08/10 10h45 |

Propostas só de documentação (sem mudança no app): #5, #7 (D12) e #13 (D14), todas verdes e com Merge.
