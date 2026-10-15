# Verificações do GitHub e do site no ar, por versão

Este arquivo existe porque os agentes (Qualidade, Arquiteto, Segurança) **não enxergam o GitHub, a prévia nem o site no ar**. Quem entrega a versão anota aqui o que só dá para ver lá. Os agentes usam como evidência, sem precisar deixar cartões em "validação parcial" por falta de acesso.

Atualizado a cada entrega (quando a proposta é aberta) e de novo depois do Merge.

## Como ler
- **Testes do app:** o roteiro `testes/testes_app.py` rodado pelo GitHub sobre o site **publicado** (compactado desde a v19).
- **Regras do Firebase (emulador):** tarefa `regras-firebase`, desde a v19 (KAN-104). Casos em `testes/regras-firebase/regras.test.mjs`.
- **Regras de negócio:** `npm run regras` (testes de `testes/regras/`), dentro da tarefa "montar".
- **Tamanho:** app comprimido medido na montagem (limite 80 KB, decisão D7).
- **Prévia:** roda em modo demonstração (não usa dados reais nem o App Check); o GitHub confere isso na tarefa "montar". Desde a v24, a prévia sai no Firebase Hosting (automação "Prévia da proposta").
- **No ar:** desde a v24, vem da automação "Publicar o site", que **confere a versão no endereço oficial** (`https://nosso-jogo-f4762.web.app`). Antes disso, era anotado com base no Merge, e isso escondeu que a v20 a v23 não chegaram ao ar (ver abaixo).

## Versões

| Versão | Proposta | Testes do app | Regras de negócio | Regras do Firebase (emulador) | Tamanho | Mapa de origem | Regras publicadas | No ar |
|---|---|---|---|---|---|---|---|---|
| pelada-v39 | [#45](https://github.com/kleberkoch-coder/nosso-jogo/pull/45) | ✅ 318 de 318 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 75,5 KB | ✅ | não mudaram | ✅ Merge 15/10; **conferido no ar** (pelada-v39) |
| pelada-v38 | [#44](https://github.com/kleberkoch-coder/nosso-jogo/pull/44) | ✅ 317 de 317 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 75,3 KB | ✅ | não mudaram | ✅ Merge 15/10; **conferido no ar** (pelada-v38) |
| pelada-v37 | [#43](https://github.com/kleberkoch-coder/nosso-jogo/pull/43) | ✅ 314 de 314 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 75,1 KB | ✅ | não mudaram | substituída pela #44 (v38 inclui a v37) |
| pelada-v36 | [#42](https://github.com/kleberkoch-coder/nosso-jogo/pull/42) | ✅ 312 de 312 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 75,0 KB | ✅ | não mudaram | ✅ Merge 15/10; **conferido no ar** (pelada-v36) |
| pelada-v35 | [#41](https://github.com/kleberkoch-coder/nosso-jogo/pull/41) | ✅ 309 de 309 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 75,0 KB | ✅ | não mudaram | ✅ Merge 15/10; **conferido no ar** (pelada-v35) |
| pelada-v34 | [#40](https://github.com/kleberkoch-coder/nosso-jogo/pull/40) | ✅ 300 de 300 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 73,9 KB | ✅ | não mudaram | ✅ Merge 15/10; **conferido no ar** (pelada-v34). Política de senha do Firebase em Exigir, com minúscula (Kleber, 15/10) |
| pelada-v33 | [#37](https://github.com/kleberkoch-coder/nosso-jogo/pull/37) | ✅ 295 de 295 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 73,3 KB | ✅ | não mudaram | ✅ Merge 15/10 08h42; **conferido no ar** pela automação "Publicar o site" (pelada-v33) |
| pelada-v32 | [#36](https://github.com/kleberkoch-coder/nosso-jogo/pull/36) | ✅ 290 de 290 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 73,0 KB | ✅ | não mudaram | ✅ Merge 14/10 18h34; **conferido no ar** pela automação "Publicar o site" (pelada-v32) |
| pelada-v31 | [#35](https://github.com/kleberkoch-coder/nosso-jogo/pull/35) | ✅ 289 de 289 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 73,0 KB | ✅ | não mudaram | ✅ Merge 14/10 18h00; **conferido no ar**. O Kleber ainda viu o aviso "A lista mudou" piscar ao abrir: corrigido na v32 |
| pelada-v30 | [#34](https://github.com/kleberkoch-coder/nosso-jogo/pull/34) | ✅ 287 de 287 (site e portal compactados) | ✅ 55 de 55 | ✅ 59 de 59 | 72,9 KB (portal 46,1 KB) | ✅ | não mudaram | ✅ Merge 14/10 17h59; **conferido no ar** pela automação "Publicar o site" |
| pelada-v29 | [#33](https://github.com/kleberkoch-coder/nosso-jogo/pull/33) | ✅ 266 de 266 (site e portal compactados) | ✅ 49 de 49 | ✅ 59 de 59 | 70,5 KB (portal 45,1 KB) | ✅ | não mudaram | ✅ Merge 14/10 16h36; **conferido no ar** pela automação "Publicar o site" (pelada-v29) |
| pelada-v28 | [#31](https://github.com/kleberkoch-coder/nosso-jogo/pull/31) | ✅ 229 de 229 (site e portal compactados) | ✅ 49 de 49 | ✅ 59 de 59 (nenhum caso pulado) | 67,7 KB (portal 43,5 KB) | ✅ | ✅ publicadas no Merge (limites de avulsos e grupos obrigatórios de novo, KAN-134) | ✅ Merge 14/10 14h16; **conferido no ar** pela automação "Publicar o site" (pelada-v28 e portal). Netlify apagado e acessos removidos pelo Kleber (14/10) |
| pelada-v27 | [#29](https://github.com/kleberkoch-coder/nosso-jogo/pull/29) | ✅ 211 de 211 (site e portal compactados) | ✅ 49 de 49 | ✅ 59 de 59 | 68,1 KB | ✅ | não mudaram | ✅ Merge 14/10 11h35; **conferido no ar** (pelada-v27). Portal no ar, conferido à mão (a conferência automática do portal falhava à toa; corrigida na #30) |
| pelada-v26 | [#27](https://github.com/kleberkoch-coder/nosso-jogo/pull/27) | ✅ 208 de 208 (site e portal compactados) | ✅ 49 de 49 | ✅ 59 de 59 (2 casos temporariamente pulados, da #21) | 68,0 KB (portal à parte: 51,7 KB) | ✅ | ✅ publicadas no Merge (plano só pelo portal, último acesso, listar grupos só no portal); conta do portal liberada na #28 (14/10 11h09) | ✅ Merge 14/10 09h52; **conferido no ar** (pelada-v26); portal no ar em https://nosso-jogo-portal.web.app |
| pelada-v25 | [#24](https://github.com/kleberkoch-coder/nosso-jogo/pull/24) | ✅ 195 de 195 (site compactado) | ✅ 41 de 41 | ✅ 50 de 50 (2 casos temporariamente pulados, da #21) | 67,5 KB | ✅ | ✅ publicadas no Merge (ordem e nome da presença, datas do jogo fixo, mensalidade e diária) | ✅ Merge 13/10 14h29; **conferido no ar** (pelada-v25 em https://nosso-jogo-f4762.web.app) |
| pelada-v24 | [#22](https://github.com/kleberkoch-coder/nosso-jogo/pull/22) | ✅ 156 de 156 (site compactado) | ✅ 41 de 41 | ✅ 40 de 40 | 67,4 KB | ✅ | não mudaram | ✅ Merge 13/10 10h02; **conferido no ar** pela automação "Publicar o site" (pelada-v24 em https://nosso-jogo-f4762.web.app). Com ela, a v20 a v23 também foram ao ar |
| pelada-v23 | [#20](https://github.com/kleberkoch-coder/nosso-jogo/pull/20) | ✅ 155 de 155 (site compactado) | ✅ 41 de 41 | ✅ 40 de 40 | 67,3 KB | ✅ | ✅ publicadas no Merge (limites de avulsos e grupos, nomes até 40 letras); contadores ficaram opcionais na #21 | ⚠️ Merge 09/10 16h45, mas **não foi ao ar** (Netlify sem créditos; o site ficou na v19). Vai ao ar com a v24 |
| pelada-v22 | [#17](https://github.com/kleberkoch-coder/nosso-jogo/pull/17) | ✅ 147 de 147 (site compactado) | ✅ 35 de 35 | ✅ 25 de 25 | 66,4 KB | ✅ | ✅ publicadas no Merge (identificador válido em presença e voto) | ⚠️ Merge 09/10 12h08, mas **não foi ao ar** (Netlify sem créditos; o site ficou na v19). Vai ao ar com a v24 |
| pelada-v21 | [#16](https://github.com/kleberkoch-coder/nosso-jogo/pull/16) | ✅ 140 de 140 (site compactado) | ✅ 34 de 34 | ✅ 21 de 21 | 66,1 KB | ✅ | não mudaram | ⚠️ Merge 09/10 10h41, mas **não foi ao ar** (Netlify sem créditos; o site ficou na v19). Vai ao ar com a v24 |
| pelada-v20 | [#15](https://github.com/kleberkoch-coder/nosso-jogo/pull/15) | ✅ 140 de 140 (site compactado) | ✅ 34 de 34 | ✅ 21 de 21 | 65,9 KB | ✅ | não mudaram | ⚠️ Merge 09/10 10h10, mas **não foi ao ar** (Netlify sem créditos; o site ficou na v19). Vai ao ar com a v24 |
| pelada-v19 | [#12](https://github.com/kleberkoch-coder/nosso-jogo/pull/12) | ✅ 125 de 125 (site compactado) | ✅ 34 de 34 | ✅ 21 de 21 | 65,5 KB | ✅ `main.js.map` e `main.css.map` no `dist/` | não mudaram | ✅ Merge 08/10 17h47 |
| pelada-v18 | [#11](https://github.com/kleberkoch-coder/nosso-jogo/pull/11) | ✅ 122 de 122 | ✅ 34 de 34 | (não existia) | 77,3 KB | — | ✅ publicadas no Merge | ✅ Merge 08/10 17h00 |
| pelada-v17 | [#10](https://github.com/kleberkoch-coder/nosso-jogo/pull/10) | ✅ 109 de 109 | ✅ 24 de 24 | (não existia) | 72,9 KB | — | ✅ publicadas no Merge | ✅ Merge 08/10 16h24 |
| pelada-v16 | [#9](https://github.com/kleberkoch-coder/nosso-jogo/pull/9) | ✅ 101 de 101 | ✅ 16 de 16 | (não existia) | 70,8 KB | — | não mudaram | ✅ Merge 08/10 15h53 |
| pelada-v15 | [#8](https://github.com/kleberkoch-coder/nosso-jogo/pull/8) | ✅ 80 de 80 | ✅ 9 de 9 | (não existia) | 68,8 KB | — | não mudaram | ✅ Merge 08/10 14h50 |
| pelada-v14 | [#6](https://github.com/kleberkoch-coder/nosso-jogo/pull/6) | ✅ 61 de 61 | — | (não existia) | cerca de 67 KB | — | não mudaram | ✅ Merge 08/10 12h38 |
| pelada-v13 | [#4](https://github.com/kleberkoch-coder/nosso-jogo/pull/4) | ✅ 49 de 49 | — | (não existia) | 53,6 KB | — | não mudaram | ✅ Merge 08/10 10h45 |

Propostas só de documentação ou testes (sem mudança no app): #5, #7 (D12), #13 (D14), #14 (testes sugeridos pela Qualidade, 138 de 138), #18 (KAN-59, ícones mantidos e teste dos 5 ícones, 148 de 148, Merge 09/10 12h30) e #19 (registro do Merge da #18), todas verdes e com Merge. Só regras: #25 (KAN-79, caixa nunca no documento público; Merge 13/10 15h21).

**Correção urgente #21 (10/10/2026, Merge 14h04):** regras do Firebase com os contadores da KAN-89 opcionais, para a v19 que estava no ar voltar a aceitar avulso pelo link e criação de grupo. 40 de 40 no emulador (2 casos pulados, marcados como temporários). Voltar a exigir os contadores depois que a v24 estiver no ar.
