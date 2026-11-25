#!/usr/bin/env bash
# Roda o roteiro de gravação dentro do emulador (KAN-170). Antes, grava sistema/planos.transicaoAte em 2100 (KAN-309):
# a transição de verdade acaba em 28/11/2026 e o roteiro assume o Plano A dela. "Bearer owner" passa por cima das regras,
# o que só o emulador aceita.
set -euo pipefail
curl -sf -X PATCH -H 'Authorization: Bearer owner' -H 'Content-Type: application/json' \
  'http://127.0.0.1:8080/v1/projects/demo-nosso-jogo/databases/(default)/documents/sistema/planos' \
  -d '{"fields":{"transicaoAte":{"integerValue":"4102444800000"}}}' >/dev/null
python testes/persistencia_app.py "$1"
