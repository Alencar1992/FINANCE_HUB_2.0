# FINANCE HUB 2.0

Aplicativo pessoal mobile-first com visual Executivo (preto e azul).

## Status

- Interface Executivo V2.2: visual aprovado.
- Google Sheets HML: 32 abas criadas no Google Drive privado.
- Apps Script HML: **código somente leitura preparado nesta branch; ainda não vinculado ou executado**.
- Pagamentos, lançamentos e fechamento: ainda não implementados.

## Arquitetura

Celular (HTML + CSS + JS) -> Apps Script (`google.script.run`) -> planilha Google privada (`SpreadsheetApp.openById`).

**Este repositório é público.** Não envie registros reais, credenciais, tokens, e-mail pessoal, ID da planilha, .clasp.json ou backups para o GitHub.

## Código da primeira integração

- `apps-script/Main.gs`: ponto de entrada Web App e teste.
- `apps-script/Security.gs`: configurações privadas e validação da conta que executa.
- `apps-script/Schema.gs`: esquema das 32 abas e verificações.
- `apps-script/SheetConnection.gs`: diagnóstico de conexão somente leitura.
- `apps-script/Index.html`: tela técnica provisória para testar no celular.
- `apps-script/appsscript.json`: manifesto da implantação restrita.
- `.clasp.example.json`: modelo local sem credenciais.
- `docs/IMPLANTACAO_HML.md`: guia completo para configurar e conectar.
- `tests/hml-connection.test.mjs`: testes estáticos.

## Teste local

```bash
node --test tests/*.test.mjs
```

**Importante:** testes estáticos não comprovam conexão com a conta Google. Siga o guia [Instalação HML](docs/IMPLANTACAO_HML.md) para vincular seu projeto Apps Script, configurar Script Properties e testar `runConnectionTest` no Google.

## Segurança

A primeira fase NÃO grava, exclui, altera ou fecha lançamentos. A implantação do Web App deve ser **Somente eu** e **Executar como eu**. Quando se executa como proprietário, `getEffectiveUser()` não identifica o visitante; a proteção depende da restrição de implantação. A interface Executivo aprovada será conectada depois.


## Fase 2B — Dashboard Executivo HML (em validação)

A branch \`feat/dashboard-executivo-hml\` adiciona o Dashboard mobile-first preto e azul usando o mesmo projeto Apps Script e a mesma base HML, **somente para leitura**.

Os indicadores são derivados de \`CONTAS\`, \`MOVIMENTOS_CONTA\`, \`FATURAS\`, \`PARCELAS\`, \`OCORRENCIAS\`, \`METAS\`, \`APORTES_METAS\` e \`TRANSACOES\`. Sem dados registrados, o Dashboard mostra zeros explicitamente indicados como base vazia; jamais inventa saldos.

Instruções: [Fase 2B — Dashboard Executivo](docs/FASE_2B_DASHBOARD.md)

**A fase não contém cadastro, pagamento, criação de recorrências nem fechamento de mês.** O acesso via Web App permanece limitado ao proprietário.
